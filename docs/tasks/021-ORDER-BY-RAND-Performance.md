# Fix `ORDER BY RAND()` Performance in Random Company Selection (Finding 21)

- **Source finding:** `CODE_REVIEW.md` → Detailed Findings → **Finding 21: `ORDER BY RAND()` Performance**
- **Priority:** LOW (performance; correctness of the response must not change)
- **Related findings (do NOT fix here):** Finding 34 (freeze the mysql2 layer / migrate by domain), Finding 17 (SQL query-string explosion in media queries), Finding 45 (dead `* copy` files), Finding 6 (API authorization), Finding 7 (rate limiting). Do not expand this task into those.
- **Repository rules:** Read `README.md`, `AGENTS.md`, and `CODE_REVIEW.md` before touching code. The mysql2 layer is frozen **except for bugfixes** (`CODE_REVIEW.md` Finding 34, implementation note 2). This task is a **bugfix-level performance change**, not a domain migration.
- **CRITICAL CONTEXT — read before anything else:** The Finding-21 location metadata in `CODE_REVIEW.md` (`selection.model.js:124, 216, 317`) is **stale**, and the finding is already marked fixed there. The current implementation has no active `ORDER BY RAND()` in `app/`: `Model.getRandomCompanies` uses an eligibility `COUNT(*)`, `computeRandomOffset`, and an id-ordered `LIMIT ? OFFSET ?` query. Its regression tests are in `test/021-ORDER-BY-RAND-Performance.test.js`. Verify this against the current working tree before changing anything. If it remains true, do not re-implement the fix; validate the existing behavior and report that no code change is needed. The implementation steps below apply only if an active regression is found.

---

# 1. Task Title

**Keep Random Company Selection Efficient Without Changing Its Response Contract**

---

# 2. Objective

- Ensure no active full-table random sort (`ORDER BY RAND() LIMIT 5`) remains in random company selection.
- If the performance issue is present, replace it with a parameterized random-window read that avoids sorting every eligible row.
- Preserve **exactly** the existing observable behavior of `POST /api/get/get-random-companies`:
    - HTTP 200 with a bare JSON array on success.
    - Same row shape/columns as today (flat snake_case row objects, no added/removed keys).
    - Same eligibility filters: `users_businesses.isPaid = 1`, non-empty banner, non-empty logo, INNER-joined characteristics and media.
    - At most 5 rows.
    - A different-ish sample on repeated calls (random fallback experience).
- Keep the change small and reviewable. Do **not** migrate the endpoint to Sequelize as part of this finding; that is a separate Finding-34 domain migration.
- Expected end result: no active `ORDER BY RAND()` remains in the random-selection path, the fallback "show random choices" UI still renders, and regression tests verify the random-window query and its behavior.

---

# 3. Problem / Finding

## 3.1 What the review says

From `CODE_REVIEW.md` Finding 21:

- **Current approach:** `ORDER BY RAND() LIMIT 5`. MySQL generates a random value for every row in the result set, sorts the whole set by that random value, then keeps 5.
- **Why it is suboptimal:** On a table with 10,000 eligible businesses this generates 10,000 random numbers, sorts them, and discards 9,995. The sort work grows with the eligible result set.
- **Recommended approach:** For random samples use the `WHERE id >= FLOOR(RAND() * MAX(id))` pattern (approximate), or fetch IDs first and sample in application code; better yet, fetch the total count and use `OFFSET FLOOR(RAND() * count) LIMIT 5`. For small result sets (< 1000) the current approach is acceptable, but this endpoint is the documented bottleneck as the platform grows.

## 3.2 Current status (re-verify before acting)

- Active `ORDER BY RAND()` occurrences in `app/`: **none** (verify before acting).
- `Model.getRandomCompanies` already counts eligible joined rows, selects a clamped random offset with `computeRandomOffset`, and reads an id-ordered page using bound `LIMIT`/`OFFSET` parameters.
- Existing regression tests are in `test/021-ORDER-BY-RAND-Performance.test.js`.
- `Model.getCompaniesRelatedToCurrentUser`, `getPrevFiveCompanies`, and `getNextFiveCompanies` already paginate deterministically by `users_businesses.id`; do not touch them.
- The endpoint is `POST /api/get/get-random-companies` → `selection.findRandomCompanies` → `Model.getRandomCompanies`; verify exact route and call sites in the current tree.
- The controller ignores `req.body` entirely; there is no user input in the current query, so this is **not** a SQL-injection finding.
- The client (`public/assets/js/selection.js:1976`, `showRandomChoices`) requests the URL with `async: false`, expects `data.length`, and pushes the array into `companyDetailsJsonObj2`. It then reads row fields such as `id`, `uuid`, `banner`, `logo`, business name, etc. A shape change will break the fallback carousel.
- The current query also relies on `users_business_medias.banner != ''` / `logo != ''`. Because `NULL != ''` evaluates to UNKNOWN (not TRUE), NULL media rows are already excluded; adding `IS NOT NULL` is logically redundant. Preserve the existing predicate form unless you have a demonstrated reason to change it.

## 3.3 What to do

The production system is live and the optimization is already present in the current tree. First verify the active implementation and tests. Make a code change only if investigation finds a regression or another active `ORDER BY RAND()` path. For any necessary change, keep the same SQL `SELECT`/`FROM`/`JOIN`/`WHERE`, callback signature, and row contract; replace only the ordering/sampling strategy.

---

# 4. Affected Functionality

Feature: the "random choices" fallback on the business-selection experience. When the normal related-company query returns nothing, the client calls the random endpoint to show arbitrary published businesses.

Current flow:

```text
User selection page (no related results)
   ↓
public/assets/js/selection.js: showRandomChoices()  (line ~1973)
   ↓  POST /api/get/get-random-companies  (async: false)
app/routes/index.js:149
   ↓
app/controllers/selection.controller.js: findRandomCompanies (line 58)
   ↓
app/models/selection.model.js: getRandomCompanies (line 231)
   ↓
MySQL: COUNT eligible rows, then SELECT ... ORDER BY id LIMIT ? OFFSET ?
   ↓
res.send(rows)  → bare array consumed by the carousel
```

Authentication is outside this finding. Do not change route authorization or middleware as part of this performance task.

---

# 5. Investigation Phase (MANDATORY — do this before editing)

The coding agent must complete all of the following and record findings before changing code.

1. **Locate every `RAND()` usage.** Search the repository (not only `app/`) for `ORDER BY RAND`, `RAND()`, and `getRandomCompanies` / `get-random-companies`. Confirm the active inventory matches §3.2. Distinguish active code from comments/dead copies.
2. **Read the full call path:** `app/routes/index.js` (around line 149), `app/controllers/selection.controller.js` (lines 58–66), `app/models/selection.model.js` (`getRandomCompanies`, lines 231–281), and `public/assets/js/selection.js` (`showRandomChoices`, around lines 1973–2020).
3. **Capture the response contract.** List every selected column in the current query and confirm the client consumes the same names. The response is a **bare array**, not `{data: ...}`.
4. **Confirm the eligibility semantics.** Identify which joins are INNER, which WHERE predicates apply, and whether `users_business_medias` can contain more than one row per `uuid`. If it can, the current query can already return duplicate businesses; decide explicitly whether to preserve or de-duplicate, and document the decision. **Do not silently change result multiplicity.**
5. **Inspect the data-access API.** Confirm `app/models/db.js` exports the mysql2 **pool** with `.query(sql, params, callback)`. Confirm how other methods in `selection.model.js` pass placeholders (e.g. lines 53–56, 125–127).
6. **Inspect existing tests.** Read `test/search-businesses.test.js` for the project's test style: `node:test` + `node:assert`, pure unit tests that inspect query structures, and live-DB integration tests that `t.diagnostic('DB unavailable, skipping: ...')` instead of failing when the DB is absent.
7. **Check schema facts.** Confirm `users_businesses.id` is the primary key, `isPaid` is a TINYINT, and the columns selected still exist in `app/db_models/users_businesses.model.js`, `users_business_characteristics.model.js`, and `users_business_medias.model.js`.
8. **Establish a baseline if the DB is available.** Call the endpoint (or run the model directly) several times and note: row count (≤5), key names, and whether results vary. If no DB is available, reason from code and state that clearly.
9. **Search for existing random-sampling helpers.** If the project already has one, reuse it. Do not add a new utility if an existing one fits.

Do not assume the review's line numbers are correct. The working tree is authoritative.

---

# 6. File Impact Analysis

| File | Role | Action | Reason |
| -------------------------------- | ----------------------------------------------- | -------------- | ------------------------------------------------------------------------ |
| `app/models/selection.model.js` | Random company query; optimized implementation is already present | MODIFY ONLY IF A REGRESSION IS FOUND | Preserve the contract while removing any active full random sort |
| `app/controllers/selection.controller.js` | Thin callback adapter | REFERENCE ONLY | Signature/response shape must stay identical |
| `app/routes/index.js` | Route registration | REFERENCE ONLY | URL and method must not change |
| `public/assets/js/selection.js` | Client consumer of the endpoint | REFERENCE ONLY | Defines the response contract the backend must preserve |
| `app/models/db.js` | mysql2 pool | REFERENCE ONLY | Confirms `.query(sql, params, cb)` usage |
| `app/db_models/users_businesses.model.js` | Sequelize schema reference | REFERENCE ONLY | Confirms selected columns/`id`/`isPaid` |
| `app/db_models/users_business_characteristics.model.js` | Sequelize schema reference | REFERENCE ONLY | Confirms characteristic columns |
| `app/db_models/users_business_medias.model.js` | Sequelize schema reference | REFERENCE ONLY | Confirms media columns |
| `app/services/business-search.service.js` | Established search conventions | REFERENCE ONLY | Shows the canonical column list and media filters; **do not** refactor into it in this task |
| `test/021-ORDER-BY-RAND-Performance.test.js` | Existing regression tests | MODIFY ONLY IF NEEDED | Retain or extend coverage for the query shape and offset helper |
| `CODE_REVIEW.md` | Finding tracker | REFERENCE ONLY | Finding 21 already records the fix; update only if new evidence changes its status |

Action legend: `MODIFY`, `ADD`, `DELETE` (only when explicitly necessary), `REFERENCE ONLY`, `INVESTIGATE`.

---

# 7. Current Implementation

Historical pre-fix behavior (the current working tree has already replaced this; inspect it before making changes):

```js
Model.getRandomCompanies = (result) => {
    sql.query(
        `SELECT
        users_businesses.id,
        users_businesses.business_name,
        ...
        users_business_medias.banner,
        users_business_medias.logo
        FROM users_businesses
        JOIN users_business_characteristics
        ON users_businesses.uuid = users_business_characteristics.uuid
        JOIN users_business_medias
        ON users_businesses.uuid = users_business_medias.uuid
        WHERE users_business_medias.banner != ''
        AND users_business_medias.logo != ''
        AND users_businesses.isPaid = 1
        ORDER BY RAND()
        LIMIT 5`,
        (err, res) => {
            if (err) {
                result(null, err);
                return;
            } else {
                result(null, res);
            }
        },
    );
};
```

Characteristics:

- No parameters; no user input.
- Callback contract: `result(errOrNull, rows)`; on error it passes `(null, err)` (this is the **existing** convention in this file — preserve it so the controller's `if (err)` branch keeps working).
- Bare array response, up to 5 rows.
- Full random sort over every eligible joined row.

Do not rewrite the surrounding methods. The duplicated `SELECT`/`FROM` blocks are Finding 17's problem, not this one.

---

# 8. Current → Target

## Historical current implementation (before the existing fix)

```text
count eligible rows implicitly
   ↓
assign RAND() to every eligible row
   ↓
sort all rows by RAND()          O(n log n)
   ↓
keep first 5
```

## Target (already implemented in the current tree; re-verify)

```text
1) COUNT(*) eligible joined rows                     may scan eligible rows
   ↓
2) choose a random integer offset in [0, total-limit]  (application code)
   ↓
3) SELECT same columns ... ORDER BY users_businesses.id ASC
   LIMIT ? OFFSET ?                                  bounded window read
   ↓
return the same bare array (≤5 rows, same keys)
```

Two queries per call remove the global random sort. The count can scan eligible rows, and a large `OFFSET` can still require scanning rows; this is not constant-time. `ORDER BY users_businesses.id` makes the window deterministic for a given offset (the old `ORDER BY RAND()` had no stable tie-break). Benchmark before claiming a production-scale improvement beyond removing the random sort.

### Before / after (intended pattern — adapt to the actual code)

```js
// BEFORE
`... WHERE ... ORDER BY RAND() LIMIT 5`

// AFTER (shape only; keep the existing SELECT list and WHERE exactly)
const COUNT_QUERY = `SELECT COUNT(*) AS total FROM ... WHERE ...`;
const PAGE_QUERY = `... WHERE ... ORDER BY users_businesses.id ASC LIMIT ? OFFSET ?`;

sql.query(COUNT_QUERY, (err, countRows) => {
    if (err) return result(null, err);

    const total = Number(countRows?.[0]?.total) || 0;
    if (total === 0) return result(null, []);

    const limit = 5;
    const offset = computeRandomOffset(total, limit);

    sql.query(PAGE_QUERY, [limit, offset], (err, rows) => {
        if (err) return result(null, err);
        return result(null, rows);
    });
});
```

Pure helper (recommended, testable):

```js
// Returns an integer in [0, max(total - limit, 0)].
// When total <= limit, returns 0 so the bounded window still yields all rows.
function computeRandomOffset(total, limit, random = Math.random) {
    const size = Number(total);
    const window = Number(limit);
    if (!Number.isFinite(size) || !Number.isFinite(window) || size <= 0 || window <= 0) return 0;

    const maxOffset = Math.max(Math.floor(size) - Math.floor(window), 0);
    if (maxOffset === 0) return 0;

    const r = Number(random);
    const clamped = Number.isFinite(r) ? Math.min(Math.max(r, 0), 0.999999999999) : 0;
    return Math.floor(clamped * (maxOffset + 1));
}
```

The offset must never exceed `total - limit`; otherwise `LIMIT 5` would return fewer than 5 rows even though enough eligible rows exist.

**Important:** Do not force an example implementation if the working tree differs. Inspect the actual architecture and adapt. The invariant is: *same columns, same filters, same callback/response contract; no full random sort; offset clamped to the eligible count.*

---

# 9. Detailed Implementation Plan

## Step 1 — Inspect existing implementation and current status

Read every file in §6 and capture the response keys. Search the repository for active `RAND()` queries. If none remain and the existing regression tests pass, stop: the finding is already resolved and no implementation change is required. If a regression is found, confirm its call path and that the controller ignores the request body.

## Step 2 — Identify affected inputs and invariants

- There are no request-driven inputs. The only runtime inputs are the eligible row count and the random seed.
- Invariants to preserve: bare array; ≤5 rows; `isPaid = 1`; non-empty banner/logo; same INNER joins; same column names/order; same error-passing convention (`result(null, err)`).
- Decide and document the duplicate-row question from §5.4. Default recommendation: **preserve existing multiplicity** (do not add `DISTINCT`) unless investigation proves the media join is strictly 1:1 and adding `DISTINCT` is behavior-neutral.

## Step 3 — Inspect existing project pattern

- Follow the placeholder style already used in `selection.model.js` (`.query(sql, [params], cb)`).
- Follow the test style in `test/search-businesses.test.js` (`node:test`, pure structure tests, live tests that skip gracefully).
- Do **not** introduce a new library. `Math.random` is sufficient for a non-security sample; `crypto` is unnecessary.

## Step 4 — Implement only if the finding is present

If an active `ORDER BY RAND()` remains, update `app/models/selection.model.js`:

1. Add a small, documented pure helper (module-scope function, optionally exported for tests as a non-breaking property on `Model`, e.g. `Model.computeRandomOffset = computeRandomOffset;`, or place it in a tiny `app/utils/` module if that better matches existing conventions).
2. Build the count query from the **same** `FROM`/`JOIN`/`WHERE` predicates as the data query.
3. Replace `ORDER BY RAND() LIMIT 5` with `ORDER BY users_businesses.id ASC LIMIT ? OFFSET ?`.
4. Pass `limit` and `offset` as bound parameters (numbers). Verify mysql2 formats them unquoted. If a specific driver/version rejects placeholders in `LIMIT/OFFSET`, coerce to validated integers (`Number.isInteger`) and interpolate **only** those validated integers — never interpolate any request-derived string.
5. Handle `total === 0` by returning `result(null, [])` (the client already checks `data.length > 0`).
6. Preserve the `(err) => result(null, err)` convention exactly.
7. Keep the method callback-based (`getRandomCompanies(result)`) and do not change the exported `Model` shape beyond an optional test hook.

If the existing implementation already meets the target, leave the model unchanged.

## Step 5 — Update related components

- Controller, route, and client should require **no** changes. If you believe one is required, stop and document why before changing it.
- Do not add pagination query parameters to this endpoint in this task. "Add pagination support" from the review is a possible future product change; the current client sends no parameters and expects a fixed random sample. Keep the URL/contract stable.

## Step 6 — Add or update tests

Use the existing `test/021-ORDER-BY-RAND-Performance.test.js`; add or adjust focused cases only if a gap is found:

- **Pure helper:** `computeRandomOffset` for `total` in `{0, 1, 4, 5, 6, 1000}`, `limit = 5`, with injected `random` values `{0, 0.5, 0.999...}`, asserting integer output within `[0, max(total-5,0)]`.
- **Query shape:** static source/behavior assertion that the active `getRandomCompanies` path contains no `ORDER BY RAND()` and does contain `ORDER BY users_businesses.id` plus `LIMIT`/`OFFSET` (prefer refactoring the SQL build into a testable helper if the project style favors it; otherwise a narrow source check is acceptable but document its brittleness).
- **Eligibility predicates unchanged:** assert the count/data SQL still contains the `isPaid = 1`, banner, and logo conditions and both INNER joins.
- **Live integration (skip if DB unavailable):** call `Model.getRandomCompanies`; assert `Array.isArray`, `length <= 5`, every row has the expected keys, and repeated calls return valid arrays. Use `t.diagnostic('DB unavailable, skipping: ' + e.message)` and return, matching `test/search-businesses.test.js`.
- **Regression:** call the route via the existing public-pages/supertest style **only if** a lightweight app harness already exists; otherwise test the controller/model directly and state the limitation.

Run with `node --test test/021-ORDER-BY-RAND-Performance.test.js` and then the full `npm test`.

## Step 7 — Review the implementation

Before declaring completion, verify:

- `grep -rn "ORDER BY RAND\\|RAND()" app/` returns nothing active.
- The diff is confined to the files in §6 (plus the test file).
- The response keys are byte-for-byte the same list as before.
- The error path still returns the error to the controller (no swallowed errors, no thrown promise).
- No new dependency was added.
- Lint passes: `npm run lint` (note: this project's `lint` runs Prettier with `--write`).

---

# 10. Architecture and Existing Patterns

- The project runs two data-access stacks. `app/models/` is the **frozen legacy mysql2** stack; `CODE_REVIEW.md` Finding 34 permits bugfixes there but forbids adding new domain logic. This task is explicitly a bugfix-level optimization, so modify `selection.model.js` in place.
- Do **not** migrate this endpoint to `app/services/business-search.service.js` in this task. That service is the reference for column names and media filters, not the target for this fix.
- Do not introduce a new dependency, framework, architecture, or design pattern when an existing project pattern already exists.
- Follow the file's existing conventions: `const Model = function (model) {}`, `Model.method = ...`, `module.exports = Model`, mysql2 placeholders, and callback-style `result(null, data)` / `result(null, err)`.
- If you extract the SQL into a helper for testability, keep it plain and local; do not restructure the whole file (Finding 17).

---

# 11. Security Requirements

Although this finding is performance-only, the implementation must not weaken security:

- Never interpolate any request-derived value into SQL. (This endpoint takes no body input today; keep it that way unless the task explicitly changes it.)
- Bind `LIMIT`/`OFFSET` as numeric parameters, or interpolate only `Number.isInteger`-validated values generated by server logic.
- Do not add `req.body`/`req.query` usage to the controller or model.
- Do not expose new columns or error internals. Preserve the existing error message path (controller maps `err.message` to a 500 message).
- Do not disable, bypass, or reorder the `isPaid = 1` / banner / logo eligibility predicates; doing so would leak unpaid or media-less businesses.
- Because the query becomes two statements, ensure no state or variable is shared in a way that could leak between concurrent requests (use locals only; the mysql2 pool is shared and safe for concurrent query calls).
- Test malicious input only to the extent that it proves the endpoint still ignores request data (e.g. posting SQL fragments in the body should not affect results or cause errors).

---

# 12. Backward Compatibility

Preserve all of the following unless a behavior change is explicitly justified and approved:

- **URL/method:** `POST /api/get/get-random-companies`.
- **Response envelope:** bare JSON array (not an object).
- **Row shape:** exactly the existing selected columns and names, flat snake_case.
- **Eligibility:** `isPaid = 1`, non-empty banner and logo, INNER joins on both related tables.
- **Cardinality:** at most 5 rows; return `[]` when no eligible rows exist.
- **Randomness:** repeated calls should produce varying samples in normal operation.
- **Error handling:** unchanged status/message mapping in `selection.controller.js`.
- **Client behavior:** `showRandomChoices()` continues to work with no client change.
- **Performance:** no worse than before for tiny tables; better as the eligible set grows.

If duplicate rows from the media join are possible, preserving them is the default for compatibility. Any de-duplication must be called out in the implementation report.

---

# 13. Testing Strategy

### Normal Case

- Eligible set > 5: each call returns 5 rows with the legacy keys.
- Repeated calls return arrays; samples should vary over several calls when the eligible set is larger than 5.

### Empty / Missing Input

- Endpoint is POST with no meaningful body: a request with `{}` or no body still works.
- Empty eligible set: returns `[]`, client shows its "no record" path without error.

### Boundary Cases

- `total = 0` → `[]`.
- `total = 1..4` → returns `total` rows (offset 0).
- `total = 5` → returns 5 rows (offset 0).
- `total = 6` → offset is 0 or 1; never returns fewer than 5.
- Very large `total` → offset stays within `[0, total-5]`, no negative/float offset.
- `random` injection values `0`, `0.5`, near-`1`, `NaN`, negative → helper always returns a valid integer in range.

### Invalid Input

- Body containing SQL fragments, arrays, objects, or unexpected types has no effect (controller ignores the body).
- Not applicable: the endpoint has no documented parameters. Do not invent parameter validation.

### Security Cases

- Confirm no string interpolation of external values into the query.
- Confirm the eligibility predicates cannot be skipped.
- Confirm the response still does not include credential/account columns beyond what it already returns.

### Regression Testing

- Run `node --test` (full suite) and confirm no existing test regresses.
- Exercise the client fallback path if a local DB and server are available (`npm run dev`, trigger no-related-results).
- Confirm `getCompaniesRelatedToCurrentUser`, `getPrevFiveCompanies`, and `getNextFiveCompanies` are untouched and still paginate deterministically.

---

# 14. Verification / Evidence

Do not report "Fixed." Provide concrete evidence:

1. **Inventory proof:** output of `grep -rn "ORDER BY RAND\\|RAND()" app/` showing no active matches.
2. **Diff:** the final `git diff` limited to the intended files.
3. **Contract proof:** the new SELECT column list matches the old one (paste both or show a test asserting the key set).
4. **Test output:** paste/attach results of the new test file and the full `npm test`, marking live-DB tests as executed or skipped with the skip reason.
5. **Runtime proof (if DB available):** several calls showing ≤5 rows, consistent keys, and variation across calls.
6. **Helper proof:** unit-test output for `computeRandomOffset` range/clamping.
7. **Similar-pattern audit:** confirm no other active `ORDER BY RAND()` exists (repository-wide search, excluding `node_modules`).
8. **Lint:** `npm run lint` result.

---

# 15. Do NOT Do

- Do not modify `getCompaniesRelatedToCurrentUser`, `getPrevFiveCompanies`, or `getNextFiveCompanies`; they are already id-paginated.
- Do not change the route URL, HTTP method, response envelope, or selected column list.
- Do not change the `isPaid`/banner/logo eligibility filters or the INNER joins.
- Do not migrate this endpoint to Sequelize or refactor `selection.model.js` into services (separate Finding 34/17 work).
- Do not add pagination request parameters or change the client.
- Do not add `DISTINCT` unless investigation proves it is behavior-neutral and you document the decision.
- Do not introduce new dependencies (no `lodash`, no crypto sampling library, no ORM work).
- Do not change the database schema or add indexes as part of this task. If an index recommendation is needed, document it as a follow-up.
- Do not modify `.env`, secrets, or environment configuration.
- Do not add or remove auth/rate-limiting middleware (Findings 6/7).
- Do not delete or rewrite unrelated dead code or `* copy` files.
- Do not hide, swallow, or reinterpret errors.
- Do not remove or skip existing tests to make the suite pass.

---

# 16. Acceptance Criteria

- [ ] A repository-wide search finds no active `ORDER BY RAND()` in application code.
- [ ] The endpoint still returns a bare array with the exact legacy columns/keys.
- [ ] Eligibility filters (`isPaid = 1`, non-empty banner/logo, INNER joins) are unchanged.
- [ ] The result is capped at 5 rows and returns `[]` for an empty eligible set.
- [ ] The offset is always an integer in `[0, max(total - 5, 0)]`.
- [ ] The model keeps its callback contract and `result(null, err)` error convention.
- [ ] Controller, route, and client are unchanged (or any change is explicitly justified in the report).
- [ ] Existing tests cover the helper, query shape, eligibility preservation, and a live-DB case that skips gracefully; any identified gap is addressed.
- [ ] `node --test` / `npm test` passes (skips reported separately).
- [ ] `npm run lint` passes.
- [ ] `CODE_REVIEW.md` Finding 21 reflects verified implementation status and remaining scope.
- [ ] No unrelated files were modified.
- [ ] Final diff reviewed and remaining risks documented.

---

# 17. Expected Final Report

The coding agent must finish with this structure:

```markdown
# Implementation Report

## Summary

Brief explanation of what was implemented.

## Files Modified

| File | Changes |
|---|---|
| `...` | ... |

## Files Added

| File | Purpose |
|---|---|
| `...` | ... |

## Files Deleted

| File | Reason |
|---|---|
| `...` | ... |

## Files Referenced Only

| File | Why |
|---|---|
| `...` | ... |

## Implementation Details

Explain the important changes, including:
- how the count + clamped-offset approach works,
- how the pure offset helper is tested,
- whether duplicate rows were possible and how that was handled.

## Testing

| Test | Result |
|---|---|
| Normal case (eligible set > 5) | PASS/FAIL/SKIP |
| Empty eligible set | PASS/FAIL/SKIP |
| Boundary (total 0/1/4/5/6) | PASS/FAIL/SKIP |
| Invalid/unexpected body | PASS/FAIL/SKIP |
| Security predicates preserved | PASS/FAIL/SKIP |
| Regression suite | PASS/FAIL/SKIP |

## Verification

Explain how the original issue was verified as fixed, including the grep evidence and the response-contract comparison.

## Remaining Risks

List anything that could not be verified (e.g. no local DB, duplicate-row uncertainty, offset still O(offset) on very large tables).

## Final Status

PASS / NEEDS REVIEW
```

---

# 18. Important Rules for Executing This Task Document

### Rule 1 — Do not hallucinate

Do not invent file paths, functions, APIs, tables, dependencies, or tests. If information is missing, mark it `TO INVESTIGATE`. The line numbers in `CODE_REVIEW.md` are stale; the working tree is authoritative.

### Rule 2 — Separate facts from recommendations

Label what the code **currently does** separately from what you intend to change. Do not present the target design as an existing fact.

### Rule 3 — Prefer project consistency

Follow the existing mysql2 callback style, placeholder style, and `node:test` conventions. Do not introduce a new architecture for a small perf fix.

### Rule 4 — Preserve behavior

This is an optimization. The response shape, eligibility rules, cardinality, and client contract must remain identical.

### Rule 5 — Think about the entire code path

Trace `client → route → controller → model → MySQL → response` before editing, and re-verify it after editing.

### Rule 6 — Make the change executable and verifiable

Another agent must be able to read this document and know exactly **what** to change, **where**, **why**, **how**, **what not to change**, and **how to prove** the fix works.

---

# 19. Follow-up (out of scope, record only)

If, during implementation, measurement shows that `OFFSET` still scans too many rows on very large eligible sets, document (do not implement here) the constant-time alternative:

```text
Pick a random starting id in [MIN(id), MAX(id)] among eligible rows,
read forward with WHERE id >= ? ORDER BY id LIMIT 5,
wrap to the beginning if fewer than 5 rows are found.
```

That pattern avoids a large offset but is approximate/biasing-prone when filters are sparse; it should be a separately reviewed optimization with benchmarks.
