# 020 - SQL Logic Bug in Search Filter (Finding 20): Test Result and Production Readiness Report

## A. Change Summary

This task is a **verify-and-close** task for CODE_REVIEW Finding 20 (SQL `!= null` semantics and unparenthesized `OR` breaking the base-condition `AND` chain in the company-search filter).

The three logic bugs described in Finding 20 were already fixed in every active code path by the Finding 1 Sequelize migration (`app/services/business-search.service.js`) and the parallel legacy-query fixes. The remaining work, and what is present in the current worktree:

1. **Verified** the corrected semantics in the active Sequelize search path and the four legacy selection queries (line-cited evidence below).
2. **Deleted** the last surviving copies of the buggy pattern: two dead commented-out blocks in `app/models/selection.model.js` that contained `OR users_business_medias.banner != null`. This is a comment-only deletion; no active behavior changed.
3. **Added regression tests** to `test/search-businesses.test.js` pinning the Finding 20 invariant: the base conditions (`isPaid = 1`, non-empty/non-null `banner` and `logo`) cannot be bypassed by any search facet.
4. **Recorded** a `**Status:**` note on Finding 20 in `CODE_REVIEW.md` (matching the Findings 12/13/17 convention).
5. **Swept** the repository for the bug class: zero SQL-context `!= null` occurrences remain and no active unparenthesized `OR` exists in any raw-SQL `WHERE` chain in `app/models/` or `app/query/`.

Affected modules: company search (`/selection` -> `POST /api/post/selection-search-parameter`) and the four legacy selection carousel endpoints. No service, controller, route, model query, schema, client, or view behavior was modified.

## B. Test Scenarios

### Automated and static checks (executed in this verification run)

| ID | Module | Objective / Procedure | Input | Expected | Actual | Status |
| --- | --- | --- | --- | --- | --- | --- |
| TC-020-01 | `business-search.service` | Base conditions remain `isPaid=1` + INNER-joined media with `banner/logo != '' AND IS NOT NULL` | `{}` | Base where + media where exact | Matched | PASS |
| TC-020-02 | Finding 20 regression | Facet payload cannot relax the media include where | `product_service_input=coffee`, `minor_sub_categories=148`, `selectionCity=Manila` | `medias.required===true`, media where unchanged, no facet values in media where | Matched | PASS |
| TC-020-03 | Finding 20 regression | Free-text facet stays inside the single parenthesized `OR` group after `{isPaid:1}` | `product_service_input=coffee` | `where[Op.and][0]={isPaid:1}`, exactly one OR group, no facet value outside it | Matched | PASS |
| TC-020-04 | Search structure | Minor sub-category is a data-only facet; characteristics include carries no standalone filter | `minor_sub_categories=148` | Value kept as parameter, one OR facet, no include where | Matched | PASS |
| TC-020-05 | Security | Free-text injection payload appears only as `Op.like` parameter values | `x' UNION SELECT password FROM users_accounts -- ` | No raw SQL fragment/template interpolation; tokens only as `%word%` values | Matched | PASS |
| TC-020-06 | Search structure | Facets are OR-composed (union) under the base conditions | company + minor + city | One OR group with three facets after base | Matched | PASS |
| TC-020-07 | Controller whitelist | Only whitelisted keys forwarded | extra/`constructor` keys | Whitelisted keys only | Matched | PASS |
| TC-020-08 | Security | Prototype-pollution keys dropped | `__proto__` body | `Object.prototype` untouched | Matched | PASS |
| TC-020-09 | Input coercion | Scalars coerced; operator objects and arrays dropped | number, `{[Op.gt]:1}`, array | Number becomes facet; objects/arrays dropped | Matched | PASS |
| TC-020-10 | Response contract | Flat snake_case rows, no dotted keys/credentials | fake joined row | Legacy flat shape | Matched | PASS |
| TC-020-11 | Tokenizer | `#` stripping and whitespace/comma split preserved | `#co#ffee` | One free-text group | Matched | PASS |
| TC-020-12 | Live DB - normal | Real search returns flat array of paid businesses with media | `minor_sub_categories=148`, `product_service_input=coffee` | Array; rows have `business_name`, `banner`, `logo`, `uuid`; no password/email/dotted keys | Array returned, assertions held | PASS |
| TC-020-13 | Live DB - empty input | Base-conditions-only query returns array (possibly empty), never null/error | `{}` | Array | Array | PASS |
| TC-020-14 | Live DB - union | Company and minor facet results are subsets of the union | `company_name_input=All World` vs `minor_sub_categories=148` vs both | All members contained in union | Held | PASS |
| TC-020-15 | Live DB - Finding 20 | Free-text-only results all satisfy banner/logo base conditions | `product_service_input=All World` | Every row has non-empty string `banner` and `logo` | Rows returned (non-zero) and all satisfied the invariant | PASS |
| TC-020-16 | Live DB - security | SQL injection battery treated as data (no crash, leak, or bulk rows) | 8 payloads | Arrays; no password/email; injected minor returns 0 rows | Held | PASS |
| TC-020-17 | Static sweep | No SQL-context `!= null`/`!= NULL` remains | `grep -rn --include='*.js' -- '!= null\|!= NULL' app test` | 0 matches | 0 | PASS |
| TC-020-18 | Static sweep | No `banner != null` remains | `grep -rn --include='*.js' -- 'banner != null' app public test` | 0 matches | 0 | PASS |
| TC-020-19 | Static audit | Only legacy SQL `OR` is correctly parenthesized | `grep -rnE '\bOR\b' app/models app/query` | Only `get-count.model.js:29` `AND (banner = '' OR banner IS NULL)` | Only that match | PASS |
| TC-020-20 | Dead-code cleanup | `selection.model.js` contains exactly the four active methods; commented buggy blocks removed | `git diff` + method count | 130 deletions, 0 insertions; 4 `Model.*` methods; 283 lines | Matched | PASS |
| TC-020-21 | Route/method audit | `getAllBySearchParameter` no longer exists as an active method | repo grep | No active definition/call; only historical comments | Matched | PASS |
| TC-020-22 | Documentation | Finding 20 carries a Status note, original text preserved | `CODE_REVIEW.md` | Status note present | Present (line 525) | PASS |
| TC-020-23 | Regression | Full Node test suite unaffected | `npm test` | All pass or documented skips | 310/310 pass, 0 fail, 0 skip | PASS |

### Not executed in this verification run (documented limitation)

| ID | Scenario | Reason | Status |
| --- | --- | --- | --- |
| TC-020-24 | Manual `/selection` page + four carousel endpoints via `npm run dev` | Not re-run in this session to avoid starting a competing server process; a prior run documented a clean boot and authenticated round-trips | NOT EXECUTED (prior evidence only) |
| TC-020-25 | `require('./app/models/selection.model.js')` smoke test | `node --check` passes. Direct `require()` opens the frozen mysql2 pool before `dotenv` is loaded in a bare Node process, which triggers the pre-existing reconnect/access-denied loop. Under the app's normal boot (`dotenv` first) this path is unaffected | BLOCKED (pre-existing environment caveat) |

## C. Test Execution Summary

Executed in this session (2026-11-11):

- Targeted file: `node --test test/search-businesses.test.js` -> **16 tests, 16 passed, 0 failed, 0 cancelled, 0 skipped** (`duration_ms` ~11.4s; DB reachable, live Finding 20 test exercised with non-zero rows).
- Full suite: `npm test` -> **310 tests, 310 passed, 0 failed, 0 cancelled, 0 skipped, 0 todo** (`duration_ms` ~14.7s).
- Static sweeps: 5 checks, all as expected (zero SQL `!= null`, zero `banner != null`, one correctly-parenthesized legacy `OR`).
- Not executed: 2 scenarios (manual server run, direct module require), documented above.
- Blocked: 0 automated tests.

No test was skipped, removed, or weakened.

## D. Defects Found

None attributable to this change.

Observations (pre-existing, out of scope, no action taken):

1. **Legacy pool reconnect spam on bare `require`:** requiring `app/models/selection.model.js` without `dotenv` loaded causes the frozen mysql2 layer (`app/models/db.js`) to retry connections with empty credentials (`ER_ACCESS_DENIED_ERROR`). This pre-exists the task; normal boot loads `dotenv` first. It is noted only because it prevented a direct `require()` smoke test.
2. **`console.log` in legacy methods:** `getCompaniesRelatedToCurrentUser` still logs its `param`; explicitly out of scope per the task and left unchanged.
3. **OR-vs-AND facet semantics:** facets are OR-composed (union) by design; this is a preserved legacy behavior, not a defect. Changing it is a product decision.
4. **Finding 21 (`ORDER BY RAND()`):** still open and intentionally untouched.

## E. Security and Regression Findings

- **Base-condition bypass (the Finding 20 class):** not present in any active path. The emitted live SQL confirms `WHERE users_businesses.isPaid = 1 AND (<facets>)` plus INNER-joined media conditions `banner != '' AND banner IS NOT NULL` and `logo != '' AND logo IS NOT NULL`.
- **SQL injection:** the Finding 1 injection battery (8 payloads) passed on the live DB; payloads are carried only as parameter values, no password/email leakage, and the injected `minor_sub_categories` payload returned 0 rows.
- **NULL semantics:** all NULL checks in active raw SQL use `IS NOT NULL`; the repository has zero SQL `!= null` occurrences.
- **OR grouping:** the only legacy SQL `OR` (`app/models/get-count.model.js:29`) is parenthesized correctly; no active unparenthesized `OR` exists.
- **Regression risk:** low. The change set is comment deletion + new tests + documentation; route wiring (`app/routes/index.js:151`), controller, service, query builders, schema, and client contract are untouched. Full suite green.
- **Data integrity:** no writes, no schema changes, no transaction behavior touched.
- **Performance:** no query change in this task; the Finding 20 regression tests add no production-path cost.

## F. Production Readiness Decision

**READY WITH CONDITIONS**

Evidence:

- All automated checks for the reviewed scope pass: targeted 16/16 and full suite 310/310, with zero skips and a reachable database.
- Static verification confirms the buggy `!= null` / unparenthesized-`OR` pattern no longer exists anywhere in the repository (active or commented).
- The change is behavior-preserving by construction and the regression suite is green.

Conditions / accepted limitations:

- The manual `npm run dev` UI and carousel round-trip was not re-executed in this session (documented prior evidence only). Run it during deployment smoke testing.
- OR-facet (union) semantics and intentionally disabled filters remain unchanged by design; altering them requires a separate approved product decision.
- Finding 21 (`ORDER BY RAND()`) remains open as a separate task.
- The pre-existing legacy pool reconnect behavior on bare module `require` is unrelated to this change and unaffected under normal boot.

## G. Remaining Actions

Before/at release:

1. Perform the standard deployment smoke test: boot `npm run dev` (or PM2), load `/selection`, run a keyword search, and confirm the four carousel endpoints respond with rows that carry `banner` and `logo`.
2. Accept/record the OR-vs-AND facet product decision as out of scope.
3. Track Finding 21 (`ORDER BY RAND()`) in its own task.
4. Optionally address the pre-existing `console.log` and legacy pool bootstrap in a dedicated cleanup task.

---

## Files Modified

| File | Changes |
| --- | --- |
| `app/models/selection.model.js` | Deleted two dead commented-out blocks containing the Finding 20 pattern. Pure deletion: 130 lines removed, 0 added; file now has exactly the four active methods (283 lines). |
| `test/search-businesses.test.js` | Added three Finding 20 regression tests (two structural, one live-DB). |
| `CODE_REVIEW.md` | Added `**Status:**` note to Finding 20; original finding text preserved. |

## Files Added

| File | Purpose |
| --- | --- |
| `test/020-SQL-Logic-Bug-in-Search-Filter-Test-Result.md` | This report (repo convention). |

## Files Referenced Only

| File | Why |
| --- | --- |
| `app/services/business-search.service.js` | Verified-fixed Sequelize search builder: `buildBaseMediaWhere` (lines 55-61), facet composition (lines 126-185), `where: { [Op.and]: whereAnd }` (line 182). |
| `app/db_controllers/search-businesses.controller.js` | Whitelist (`SEARCH_PARAM_KEYS`) and scalar coercion; no Finding 20 concern. |
| `app/routes/index.js:151` | Search route wiring; untouched. |
| `app/controllers/selection.controller.js` | Wires the four legacy carousel methods; untouched. |
| `app/models/get-count.model.js:29` | In-repo exemplar of correct parenthesized `OR` grouping. |
| `public/assets/js/selection.js` | Response-shape contract (bare JSON array, flat snake_case); unchanged. |

## Verification Evidence

- `app/models/selection.model.js`: `git diff --numstat` = `0 130` (0 added, 130 deleted); `grep -c '^Model\.'` = 4; no commented dead blocks remain.
- Active legacy conditions verified at `selection.model.js` lines 47-51, 119-123, 194-198, and `getRandomCompanies` (`isPaid = 1` with `!= ''` which excludes NULL implicitly).
- Emitted live SQL from the test run shows the corrected composition:
  `INNER JOIN users_business_medias ... AND (banner != '' AND banner IS NOT NULL) AND (logo != '' AND logo IS NOT NULL) WHERE (users_businesses.isPaid = 1 AND (...facets...))`.
- `CODE_REVIEW.md` Finding 20 Status note present (line 525), original finding text intact.
- `getAllBySearchParameter` exists only in historical comments/report text, never as an active method or call site.

## Final Status

PASS (reviewed scope). Release disposition: READY WITH CONDITIONS per Section F.
