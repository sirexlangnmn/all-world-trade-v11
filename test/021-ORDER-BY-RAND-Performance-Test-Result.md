# 021 - `ORDER BY RAND()` Performance (Finding 21): Test Result and Production Readiness Report

- **Task:** `docs/tasks/021-ORDER-BY-RAND-Performance.md`
- **Reviewed scope:** random-company fallback endpoint `POST /api/get/get-random-companies` -> `selection.findRandomCompanies` -> `Model.getRandomCompanies`
- **Review date:** 2026-11-13 (Asia/Manila)
- **Environment:** local working tree, Node.js v24.19.0, configured MySQL reachable (`allworldtrade`; 900 `users_businesses`, 27 eligible rows at review time)

---

## A. Change Summary

This is a **verify-and-close** task for CODE_REVIEW Finding 21. The fix was already present in the working tree before this QA session:

- `app/models/selection.model.js` (uncommitted change, `+47 / -12`) replaced the active `ORDER BY RAND() LIMIT 5` with:
    1. a `SELECT COUNT(*) AS total` over the **same** eligibility joins/filters;
    2. a pure `computeRandomOffset(total, limit, random)` helper that returns an integer in `[0, max(total - 5, 0)]`;
    3. a bounded `SELECT <legacy columns> ... ORDER BY users_businesses.id ASC LIMIT ? OFFSET ?` read using bound numeric parameters.
- The legacy response contract is unchanged: bare JSON array, same flat snake_case columns, `isPaid = 1`, non-empty `banner`/`logo`, both INNER joins, at most 5 rows, `[]` when nothing is eligible.
- `selection.controller.js`, `app/routes/index.js`, and `public/assets/js/selection.js` are unchanged.

What this QA session did:

1. Verified the repository-wide `RAND()` inventory against the current tree.
2. Traced the full call path and confirmed the response/eligibility contract.
3. Reviewed the existing regression suite and **added 3 focused tests** (route/client URL contract, app-wide no-`ORDER BY RAND()` sweep, media-join multiplicity preservation). No existing test was modified, removed, skipped, or weakened.
4. Executed the targeted suite, the full suite, lint/format checks, and live-DB runtime evidence.
5. Did **not** modify production code, schema, environment, controller, route, or client.

---

## B. Test Scenarios

### B.1 Automated regression suite — `test/021-ORDER-BY-RAND-Performance.test.js`

Precondition for unit cases: `app/models/db.js` is replaced in `require.cache` by a controllable fake pool, so no DB is needed. Live case uses the configured DB and skips gracefully if unreachable (it executed in this run).

| ID        | Feature / module              | Objective                                                                    | Preconditions / test data             | Procedure                                        | Input                                                              | Expected                                                                                 | Actual                        | Status | Defect / remediation |
| --------- | ----------------------------- | ---------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ----------------------------- | ------ | -------------------- |
| TC-021-01 | `computeRandomOffset`         | No room to shuffle returns 0                                                 | `limit = 5`                           | Call helper for `total` 0, 1, 4, 5               | totals `[0,1,4,5]`                                                 | `0`                                                                                      | `0` for all                   | PASS   | None                 |
| TC-021-02 | `computeRandomOffset`         | Offset stays in `[0, max(total-5,0)]` for valid/invalid seeds                | `limit = 5`                           | Loop totals and seeds, assert integer/in-range   | totals `[0,1,4,5,6,1000]`, seeds `[0,0.5,0.999999999999,NaN,-1,2]` | Always integer in range                                                                  | Always in range               | PASS   | None                 |
| TC-021-03 | `computeRandomOffset`         | Extremes map to first/last valid window                                      | `limit = 5`                           | Assert boundary seeds                            | `total=6` seeds `0`/`0.999...`; `total=1000` seeds `0`/`0.999...`  | `0` / `1` / `0` / `995`                                                                  | Matched                       | PASS   | None                 |
| TC-021-04 | `computeRandomOffset`         | Invalid inputs do not throw                                                  | —                                     | Call with `undefined`, `limit=0`, negative total | as listed                                                          | `0`                                                                                      | `0`                           | PASS   | None                 |
| TC-021-05 | `computeRandomOffset`         | Default path samples `Math.random`                                           | Temporarily stub `Math.random`        | Call without seed                                | seeded `0.999999999`, then `0`                                     | `995`, then `0`                                                                          | Matched                       | PASS   | None                 |
| TC-021-06 | `computeRandomOffset`         | Function seed and number seed both accepted                                  | —                                     | Call with function/number seeds                  | `() => 0.999999999`, `() => 0`                                     | `995`, `0`                                                                               | Matched                       | PASS   | None                 |
| TC-021-07 | Active SQL shape              | No active `ORDER BY RAND()`; id-ordered bounded window exists                | Read model source                     | Regex assertions                                 | source file                                                        | No `ORDER BY RAND()`; contains `ORDER BY users_businesses.id ASC` and `LIMIT ? OFFSET ?` | Matched                       | PASS   | None                 |
| TC-021-08 | Eligibility preservation      | Count/data path keep `isPaid=1`, banner/logo, both INNER joins               | Read active method source             | Regex assertions                                 | source slice from `Model.getRandomCompanies`                       | All predicates/joins present                                                             | Matched                       | PASS   | None                 |
| TC-021-09 | Response contract             | Selected columns match legacy key list                                       | Read active `selectColumns`           | Assert 28 legacy keys present                    | `LEGACY_KEYS`                                                      | All present                                                                              | All present                   | PASS   | None                 |
| TC-021-10 | Route/client contract (added) | URL/method unchanged for the fallback carousel                               | Read route and client source          | Regex assertions                                 | `app/routes/index.js`, `public/assets/js/selection.js`             | `POST /api/get/get-random-companies` registration and client `url`/`type` match          | Matched                       | PASS   | None                 |
| TC-021-11 | Repository sweep (added)      | No active `ORDER BY RAND()` under `app/`                                     | Recursively read `app/**/*.js`        | Scan every file                                  | `app/` tree                                                        | Zero offenders                                                                           | Zero offenders                | PASS   | None                 |
| TC-021-12 | Happy path behavior           | Runs COUNT, then bounded `LIMIT ? OFFSET ?` with legacy params               | Fake pool returns `total=12`, one row | Invoke model                                     | stubbed pool                                                       | 2 queries; page params `[5, offset]`, offset in range; rows returned as-is               | Matched                       | PASS   | None                 |
| TC-021-13 | Empty set                     | `total=0` returns `[]` without the window query                              | Fake count `0`                        | Invoke model                                     | stubbed pool                                                       | `[]`, exactly 1 query                                                                    | Matched                       | PASS   | None                 |
| TC-021-14 | Small set boundary            | `total < limit` reads offset 0 and returns every row                         | Fake count `3`, 3 rows                | Invoke model                                     | stubbed pool                                                       | `[5, 0]`, rows unchanged                                                                 | Matched                       | PASS   | None                 |
| TC-021-15 | Data integrity (added)        | Media-join duplicates preserve legacy multiplicity; no `DISTINCT`            | Fake count `2`, duplicate-id rows     | Invoke model                                     | stubbed pool                                                       | Rows returned unchanged; no `DISTINCT` in count/page SQL                                 | Matched                       | PASS   | None                 |
| TC-021-16 | Error handling                | Count-query failure preserves legacy callback convention                     | Fake count fails                      | Invoke model                                     | `Error('count failed')`                                            | Callback `(null, error)`                                                                 | Matched                       | PASS   | None                 |
| TC-021-17 | Error handling                | Window-query failure preserves legacy callback convention                    | Fake count `10`, window fails         | Invoke model                                     | `Error('window failed')`                                           | Callback `(null, error)`                                                                 | Matched                       | PASS   | None                 |
| TC-021-18 | Security / input isolation    | Controller does not read request body                                        | Read controller source                | Regex assertions                                 | `findRandomCompanies` slice                                        | No `req.body`; calls `Model.getRandomCompanies`                                          | Matched                       | PASS   | None                 |
| TC-021-19 | Live DB integration           | Real call returns bare array of legacy-shaped rows, ≤5, repeated calls valid | Configured DB reachable               | Call model 3 times                               | no request input                                                   | Array; ≤5 rows; every legacy key present                                                 | Executed, all assertions held | PASS   | None                 |

### B.2 Static / runtime evidence executed in this session

| ID        | Check                     | Procedure                                                         | Expected                                | Actual                                                                                           | Status                                   |
| --------- | ------------------------- | ----------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| TC-021-20 | Active `RAND()` inventory | `grep -rn "ORDER BY RAND\|RAND()" app public --include='*.js'`    | No active matches                       | No matches                                                                                       | PASS                                     |
| TC-021-21 | Live row cap + variation  | Call `Model.getRandomCompanies` 5 times against configured DB     | ≤5 rows per call; samples vary          | 5 rows each; 18 distinct ids across 5 calls                                                      | PASS                                     |
| TC-021-22 | Live response keys        | Inspect keys of a live row                                        | Exactly 28 legacy keys, flat snake_case | `id ... banner, logo` (28 keys)                                                                  | PASS                                     |
| TC-021-23 | Live latency sanity       | Time each of 5 live calls                                         | No obvious regression                   | ~25–33 ms/call on 27 eligible rows                                                               | PASS (informational; not a benchmark)    |
| TC-021-24 | Full regression suite     | `npm test`                                                        | All pass, zero failures/skips           | 329 passed, 0 failed, 0 skipped                                                                  | PASS                                     |
| TC-021-25 | Formatting (test file)    | `npx prettier --check test/021-ORDER-BY-RAND-Performance.test.js` | Clean                                   | Clean                                                                                            | PASS                                     |
| TC-021-26 | Formatting (model)        | `npx prettier --check app/models/selection.model.js`              | Clean                                   | Fails on default CRLF setting; passes with `--end-of-line crlf`; HEAD version also fails default | PASS with documented pre-existing caveat |

### B.3 Not executed (documented limitations)

| ID        | Scenario                                                                         | Reason                                                                                                                          | Status       |
| --------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| TC-021-27 | Manual `/selection` fallback UI (`showRandomChoices` carousel) via `npm run dev` | Not run in this session to avoid starting a competing server; route/client contract verified statically and model verified live | NOT EXECUTED |
| TC-021-28 | Production-scale benchmark (≥10k eligible rows)                                  | Review DB has only 27 eligible rows; a meaningful before/after benchmark needs a controlled large dataset                       | NOT EXECUTED |

---

## C. Test Execution Summary

Executed 2026-11-13:

- Targeted file: `node --test test/021-ORDER-BY-RAND-Performance.test.js` -> **19 tests, 19 passed, 0 failed, 0 cancelled, 0 skipped** (`duration_ms` ≈ 0.79 s; live-DB case executed because the configured DB was reachable).
- Full suite: `npm test` -> **329 tests, 329 passed, 0 failed, 0 cancelled, 0 skipped, 0 todo** (`duration_ms` ≈ 17.6 s).
- Static/runtime checks: 7 executed, all as expected (inventory, live cap/variation, keys, latency sanity, full suite, formatting x2).
- Not executed: 2 (manual UI smoke, production-scale benchmark), listed in B.3.
- Blocked: 0 automated tests.

No test was skipped, removed, weakened, or fabricated. The 3 added tests are in addition to the pre-existing 16.

---

## D. Defects Found

**None attributable to the Finding 21 change.** No release-blocking defect was found in the reviewed scope.

Observations (pre-existing, out of scope, no fix applied):

1. **Legacy callback/controller error-convention mismatch (Medium, pre-existing).**
   `Model.getRandomCompanies` reports errors as `result(null, err)`, while `selection.controller.js` checks the **first** callback argument (`if (err)`). On a DB failure the controller therefore falls into the success branch and sends the error object as the response body instead of HTTP 500. This pattern exists across the legacy `selection.model.js` methods and pre-dates Finding 21. The task explicitly requires preserving the `result(null, err)` convention and leaving the controller unchanged, so it was **not** modified. Recommended follow-up: normalize the legacy callback contract or the controller error check in a dedicated task, with regression tests.
2. **Bounded window still sorts/scans (Low, documented remaining scope).**
   `EXPLAIN` on the live query showed `Using temporary; Using filesort` on `users_business_characteristics` (819 rows) with `ALL` scans on the two joined tables, because the optimizer drives the join from characteristics before ordering by `users_businesses.id`. The change removes per-row `RAND()` generation and the global random sort, but a large `OFFSET` can still scan. This matches the task's stated remaining scope; the constant-time random-start-id pattern is a separately benchmarked follow-up.
3. **Pre-existing CRLF line endings (Informational).**
   `app/models/selection.model.js` uses CRLF; default Prettier (`endOfLine: lf`) reports a style warning even on the unmodified `HEAD` version. The new code passes `prettier --check --end-of-line crlf`. The project's `npm run lint` is `prettier --write .`, which would convert line endings repo-wide; that unrelated churn was intentionally avoided.
4. **Two round-trips per random call (Informational, by design).**
   Count + window is two statements instead of one. This is the intended trade-off for removing the random sort; no correctness or security impact.

---

## E. Security and Regression Findings

- **No active `ORDER BY RAND()`** remains in `app/` or `public/` (verified by source scan test and `grep`).
- **No request input reaches the query.** `findRandomCompanies` ignores `req.body`; there is no SQL-injection surface added. `LIMIT`/`OFFSET` are bound numeric parameters; on the live DB the bounded query executed successfully.
- **Eligibility cannot be relaxed.** Count and window queries are both built from the same `fromClause`; `isPaid = 1`, non-empty `banner`/`logo`, and both INNER joins are intact.
- **Response contract preserved.** Bare array, 28 legacy columns, ≤5 rows, `[]` when empty; live runtime evidence matched.
- **Data integrity preserved.** No writes, no schema change, no transaction change. Media-join multiplicity is passed through unchanged and a test now pins that (`DISTINCT` was not added).
- **Route/client compatibility preserved.** `POST /api/get/get-random-companies` registration and the client `url`/`type` are pinned by a test.
- **Regression risk: low.** Controller, route, client, schema, and the other three selection methods (`getCompaniesRelatedToCurrentUser`, `getPrevFiveCompanies`, `getNextFiveCompanies`) were untouched; full suite green (329/329).

---

## F. Production Readiness Decision

**READY WITH CONDITIONS**

Evidence:

- The targeted Finding 21 suite passes 19/19 and the full suite passes 329/329 with zero failures and zero skips; the live DB case executed.
- Repository-wide inventory confirms no active `ORDER BY RAND()` in application code.
- Live calls return 5 rows with exactly the 28 legacy keys and vary across calls (18 distinct ids across 5 calls).
- No production code was changed in this QA session; the reviewed fix is behavior-preserving for the documented contract.

Conditions / accepted limitations:

1. Manual `/selection` fallback UI smoke test was not re-executed in this session (route/client contract verified statically, model verified live). Run it during deployment smoke testing.
2. The pre-existing legacy error-convention mismatch (observation D.1) should be tracked and fixed in a separate task; it is not introduced by and does not block Finding 21.
3. No production-scale benchmark was performed (dataset too small); do not claim constant-time behavior. Large `OFFSET` remains a possible scan.
4. CRLF normalization in `selection.model.js` should be handled, if desired, by a dedicated formatting change.

---

## G. Remaining Actions

Before/at release:

1. Boot `npm run dev` (or PM2), trigger the no-related-results path on `/selection`, and confirm the random carousel renders (no client change required).
2. Commit the Finding 21 implementation (`app/models/selection.model.js`), the extended suite, and this report together once approved.
3. Open/track a separate follow-up for the legacy `result(null, err)` vs controller `if (err)` mismatch across the selection stack.
4. If scale demands it, benchmark the constant-time random-start-id pattern on a large eligible dataset before adopting it.
5. Optionally normalize `selection.model.js` line endings in a dedicated formatting task (do not mix with this perf change).

---

## Traceability: change -> tests

| Change under review                   | Expected behavior                         | Covering tests                             |
| ------------------------------------- | ----------------------------------------- | ------------------------------------------ |
| Removed `ORDER BY RAND() LIMIT 5`     | No full random sort; id-ordered window    | TC-021-07, TC-021-11, TC-021-20            |
| Added `computeRandomOffset`           | Integer offset in `[0, total-5]`          | TC-021-01 … TC-021-06                      |
| Added `COUNT(*)` + `LIMIT ? OFFSET ?` | Same filters, bounded read, `[]` on empty | TC-021-08, TC-021-12, TC-021-13, TC-021-14 |
| Preserved SELECT list                 | Same 28 flat columns / bare array         | TC-021-09, TC-021-19, TC-021-22            |
| Preserved callback convention         | `result(null, err)` on failure            | TC-021-16, TC-021-17                       |
| Preserved route/client                | `POST /api/get/get-random-companies`      | TC-021-10, TC-021-27                       |
| Preserved multiplicity                | No `DISTINCT`; duplicates passed through  | TC-021-15                                  |
| No request input                      | Controller ignores body                   | TC-021-18                                  |

---

## Files Modified / Added (this QA session)

| File                                                | Change                                                                                                                           |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `test/021-ORDER-BY-RAND-Performance.test.js`        | Added 3 tests: route/client contract, app-wide no-`ORDER BY RAND()` sweep, media-join multiplicity. Existing 16 tests untouched. |
| `test/021-ORDER-BY-RAND-Performance-Test-Result.md` | This report (new).                                                                                                               |

No production file was modified in this session. The reviewed implementation change in `app/models/selection.model.js` was already present in the working tree.

## Files Referenced Only

| File                                                    | Why                                                                                             |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `app/models/selection.model.js`                         | Reviewed implementation: `computeRandomOffset`, count + bounded window, legacy columns/filters. |
| `app/controllers/selection.controller.js`               | Confirmed thin adapter and `req.body`-free `findRandomCompanies`.                               |
| `app/routes/index.js:149`                               | Confirmed `POST /api/get/get-random-companies` registration.                                    |
| `public/assets/js/selection.js:1973-2032`               | Confirmed client URL/method and bare-array consumption.                                         |
| `app/models/db.js`                                      | Confirmed mysql2 pool `.query(sql, params, cb)` shape used by tests.                            |
| `app/db_models/users_businesses.model.js`               | Confirmed `uuid`, `isPaid`, `id` schema facts.                                                  |
| `app/db_models/users_business_characteristics.model.js` | Confirmed characteristic columns/join key.                                                      |
| `app/db_models/users_business_medias.model.js`          | Confirmed `banner`/`logo`/`uuid` columns.                                                       |
| `CODE_REVIEW.md` Finding 21                             | Confirmed status note already reflects the implemented fix and remaining scope.                 |

## Final Status

**PASS** (reviewed scope). Release disposition: **READY WITH CONDITIONS** per Section F.
