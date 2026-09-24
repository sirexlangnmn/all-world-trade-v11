Please optimize and refactor the following code according to best practices, updated, modern approach.
Break down the code into smaller, more focused functions, each handling a specific task.
Ensure the code is aligned with the 'Don't Repeat Yourself' (DRY), SOLID, and 'Keep It Simple, Stupid' (KISS) principles.
The goal is to enhance security, readability, performance, reusability, testability, and maintainability.

# Fix SQL Injection in Business Search Function (Finding 1)

- **Source finding:** `CODE_REVIEW.md` → Detailed Findings → **Finding 1: SQL Injection in Search Function**
- **Priority:** HIGH (security — prevents data breach) — first item on the roadmap table
- **Related findings to keep in mind (do NOT fix here):** Finding 20 (OR/NULL SQL-logic bug), Finding 21 (`ORDER BY RAND()`), Finding 2 (login SQL injection — separate file), Finding 45 (dead copies)
- **Repository rules:** `README.md`, `AGENTS.md`, `CODE_REVIEW.md` — read all three before touching code. Put all new code in the **Sequelize stack** (`app/db_controllers/` + `app/db_models/`); treat the mysql2 layer as frozen.

---

# 1. Task Title

**Fix SQL Injection in the Business Search Function and Migrate It to the Sequelize Stack**

---

# 2. Objective

- Remove the SQL injection exposure in the search endpoint used by the `/selection` page (`POST /api/post/selection-search-parameter`).
- Migrate the search query from the legacy raw-SQL model (`app/models/selection.model.js`) onto the established Sequelize stack, so that **all user input is passed via parameterized operators** (`Op.like`, `Op.eq`, `Op.or`, `Op.and`) and never concatenated into SQL.
- Restore any search filters that were silently disabled during a prior partial parameterization, without changing the business behavior.
- Keep the **HTTP route, request parameters, and response shape byte-for-byte compatible** with the current frontend (`public/assets/js/selection.js`) so no client changes are required.
- Expected end result: the search endpoint returns the same array of business rows it returns today, but the query can no longer be injected.

---

# 3. Problem / Finding

## Vulnerability type

- **SQL Injection** (OWASP A03:2021 — Injection).
- **Severity:** CRITICAL per `CODE_REVIEW.md`.
- **Attack surface:** Public HTTP endpoint, no authentication middleware (the whole `/api` layer currently has none — see Finding 6, out of scope here).
- **Affected functionality:** Company search / discovery (`/selection` page → `POST /api/post/selection-search-parameter`).

## Why the original implementation was unsafe (as described by CODE_REVIEW.md)

`CODE_REVIEW.md` Finding 1 documented `Model.getAllBySearchParameter` in `app/models/selection.model.js` (~lines 137–227 of the reviewed version) concatenating user-supplied parameters directly into SQL:

```js
query += ` AND users_business_characteristics.business_major_category = '${param.trade_categories}'`;
query += ` AND users_businesses.country_of_operation LIKE '%${param.countryCode}%'`;
query += ` AND users_businesses.business_language_of_communication LIKE '%${param.language}%'`;
```

Every conditional branch in the query builder was vulnerable. An attacker could inject arbitrary SQL through any search field; the `LIKE '...%'` wrappers allow multi-statement injection (e.g. `' OR '1'='1' UNION SELECT ... --`). Because the vulnerable code also contained commented-out and copied variants, the review treated the entire search data path as suspect.

## Current state of the code (VERIFY — a partial fix already landed)

**Important nuance:** since the CODE_REVIEW was written, `getAllBySearchParameter` has **already been partially revised**. The code you will find today in `app/models/selection.model.js:310-447`:

- Uses `?` parameterized placeholders with helper functions `addEqual(column, value)` and `addLike(column, value)`.
- Accumulates values in a `queryParams` array and calls `sql.query(query, queryParams, cb)`.
- Keeps free-text keyword search (`product_service_input`, `company_name_input`) parameterized.
- **But** most filter branches are **commented out** — `trade_categories`, `regionOfOperationCode`, `countryCode`, `selectionState`, `selectionCity`, `language`, `business_scale`, `sub_categories` — only `minor_sub_categories` and the free-text search terms are active.

The genuinely dangerous string-interpolation pattern from the review can still be found in **dead copy files**:

- `app/models/selection.model copy.js`
- `app/models/selection.model copy 2.js`

(e.g. `query += \` OR users_businesses.states_of_operation = '${param.selectionState}'\``).

**The coding agent must verify this actual state before changing anything.** Do not assume the review matches the file; the review is a snapshot.

## Why this still needs to be fixed

1. The remaining legacy mysql2 path is not the target DAL (AGENTS.md: "Put all new code in the Sequelize stack").
2. The parameterization is incomplete: disabled filters mean the search silently returns fewer criteria than the client sends.
3. Dead copy files still hold the raw interpolation and create a trap for future edits / a misleading reference.
4. `CODE_REVIEW.md`'s Recommended Approach for Finding 1 is the Sequelize migration, matching the v2/v3 pattern and Finding 34 (freeze mysql2).

---

# 4. Affected Functionality

**Feature:** Company search & discovery (`/selection` page).

**Data flow to investigate and preserve:**

```text
selection.js (jQuery AJAX POST)
   ↓  data: regionOfOperationCode, countryCode, selectionState, selectionCity,
   ↓       language, business_scale, trade_categories, sub_categories,
   ↓       minor_sub_categories, product_service_input, company_name_input
POST /api/post/selection-search-parameter        app/routes/index.js:144
   ↓
app/controllers/selection.controller.js → findAllBySearchParameter (legacy, callback)
   ↓  builds `parameters` object including req.session.user.uuid
app/models/selection.model.js → getAllBySearchParameter (raw mysql2, `?` placeholders today)
   ↓
MySQL: users_businesses JOIN users_business_characteristics JOIN users_business_medias
   ↓
res.send(array)                                    frontend expects plain JSON array of rows
```

**Client consumer (must not break):** `public/assets/js/selection.js:1845-1899` — expects the response to be a **plain JSON array**; uses `data.length`, `data[0]`, and row fields like `business_name`, `business_tagline`, `banner`, `logo`, `uuid`, etc. The current controller returns it via bare `res.send(data)`.

---

# 5. Investigation Phase (MANDATORY — do before editing)

The coding agent must run these investigations before making any change:

1. **Read `README.md`, `AGENTS.md`, `CODE_REVIEW.md`** (repository rules, architecture, business rules; esp. Finding 1, 20, 34, 36, 45).
2. **Inspect current `app/models/selection.model.js`** — confirm which parameter branches are active vs commented out; confirm the placeholders.
3. **Inspect the dead copies** — `app/models/selection.model copy.js`, `app/models/selection.model copy 2.js`:
    - Run `rg -l "selection.model" app public` to check **nothing requires them** before considering deletion (Finding 45 rule: grep first, delete only if truly unused).
4. **Inspect the current controller** — `app/controllers/selection.controller.js` (`findAllBySearchParameter`, lines 60–85) and how it maps `req.body` → `parameters`.
5. **Inspect the route wiring** — `app/routes/index.js:144` (`app.post(['/api/post/selection-search-parameter'], selection.findAllBySearchParameter)`).
6. **Study the established Sequelize patterns:**
    - `app/db_controllers/users-businesses.controller.js` (async/await + `db.Sequelize.Op`)
    - `app/db_controllers/registration_v2.controller.js` (transaction + validation style)
    - `app/services/analytics.service.js` (called a "reference implementation" by CODE_REVIEW)
    - `app/db_models/index.js` barrel (`db.users_businesses`, `db.users_business_characteristics`, `db.users_business_medias`).
7. **Confirm model association behavior:** the three Sequelize models exist, but there are **no DB-level foreign keys** — relationships are logical via `uuid`. Verify whether any `belongsTo`/`hasOne` associations exist in `app/db_models/index.js` (they do **not** today). If none exist, the new query must use `include` with explicit `on` conditions (e.g. `required: true`, `on: { uuid: { [Op.eq]: <col> } }`) — otherwise `include` will generate wrong joins. **TO INVESTIGATE** the exact join keys: `users_businesses.uuid = users_business_characteristics.uuid = users_business_medias.uuid`.
8. **Confirm the response contract** in `public/assets/js/selection.js` (array of plain snake_case row objects; no `{status, data}` wrapper).
9. **Check the DB config for Sequelize** — `app/config/sequelize.config.js` and confirm `db.Sequelize` exposes `Op`.

> Do not skip this phase. If the repository state differs from this document, document the differences in the final report.

---

# 6. File Impact Analysis

| File                                                      | Role                                                                     | Action                                                                  | Reason                                                                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `app/models/selection.model.js`                           | Current legacy implementation (`getAllBySearchParameter`, lines 310–447) | MODIFY (remove/replace the search method)                               | Source of the migration; leave other methods (`getCompaniesRelatedToCurrentUser`, `getPrevFiveCompanies`, etc.) untouched |
| `app/controllers/selection.controller.js`                 | Legacy controller (`findAllBySearchParameter`, lines 60–85)              | MODIFY (re-point to the new Sequelize controller) or DELETE this method | Route must keep URL; decouple HTTP mapping from the vuln query                                                            |
| `app/routes/index.js`                                     | Route wiring (line 144)                                                  | MODIFY (line ~144 point to new controller; add `require` near line 26)  | Keep URL identical, swap handler target                                                                                   |
| `app/db_controllers/search-businesses.controller.js`      | New Sequelize search controller                                          | ADD                                                                     | Target implementation (follows Finding 1 recommended approach + client pattern in `users-businesses.controller.js`)       |
| `app/db_models/index.js`                                  | Barrel export                                                            | REFERENCE ONLY                                                          | Provides `db.users_businesses`, `db.users_business_characteristics`, `db.users_business_medias`, `db.Sequelize.Op`        |
| `app/db_models/users_businesses.model.js`                 | Sequelize model                                                          | REFERENCE ONLY                                                          | Attributes used in `include`/`where`/`attributes`                                                                         |
| `app/db_models/users_business_characteristics.model.js`   | Sequelize model                                                          | REFERENCE ONLY                                                          | JOIN target for search filters                                                                                            |
| `app/db_models/users_business_medias.model.js`            | Sequelize model                                                          | REFERENCE ONLY                                                          | JOIN target for banner/logo base conditions                                                                               |
| `app/db_controllers/users-businesses.controller.js`       | Existing Sequelize pattern                                               | REFERENCE ONLY                                                          | Established `require('../db_models')` + `db.Sequelize.Op` pattern                                                         |
| `app/models/selection.model copy.js`                      | Dead copy containing the true vulnerable interpolation                   | DELETE (only after `rg` proves unused)                                  | Removes the injection trap; Finding 45                                                                                    |
| `app/models/selection.model copy 2.js`                    | Dead copy containing the true vulnerable interpolation                   | DELETE (only after `rg` proves unused)                                  | Removes the injection trap; Finding 45                                                                                    |
| `app/controllers/selection.controller.js` (other methods) | Unrelated legacy search helpers                                          | REFERENCE ONLY                                                          | Do not touch `findCompaniesRelatedToCurrentUser`, `findPrevFiveCompanies`, `findNextFiveCompanies`, `findRandomCompanies` |
| `app/src/server.js`                                       | App boot / `/selection` page render                                      | REFERENCE ONLY                                                          | Confirms page + session context; do not modify                                                                            |

---

# 7. Current Implementation

## Legacy controller — `app/controllers/selection.controller.js`

```js
exports.findAllBySearchParameter = (req, res) => {
    const uuid = req.session.user.uuid;
    const parameters = {
        uuid: uuid,
        regionOfOperationCode: req.body.regionOfOperationCode,
        countryCode: req.body.countryCode,
        selectionState: req.body.selectionState,
        selectionCity: req.body.selectionCity,
        language: req.body.language,
        business_scale: req.body.business_scale,
        trade_categories: req.body.trade_categories,
        sub_categories: req.body.sub_categories,
        minor_sub_categories: req.body.minor_sub_categories,
        product_service_input: req.body.product_service_input,
        company_name_input: req.body.company_name_input,
    };
    Model.getAllBySearchParameter(parameters, (err, data) => {
        if (err) res.status(500).send({ message: err.message || 'Some error occurred while retrieving companies.' });
        else res.send(data);
    });
};
```

## Legacy model — `app/models/selection.model.js` `getAllBySearchParameter` (current, partially parameterized)

Key facts the coding agent must reproduce exactly:

- **Base (always-on) conditions** (must be preserved in the Sequelize `where`):
    - `users_businesses.isPaid = 1`
    - `users_business_medias.banner != ''` AND `users_business_medias.banner IS NOT NULL`
    - `users_business_medias.logo != ''` AND `users_business_medias.logo IS NOT NULL`
- **JOINs:** `users_businesses` → `users_business_characteristics` → `users_business_medias` on `uuid = uuid`.
- **Exact-match filters** (`addEqual` → `column = ?`): `minor_sub_categories` → `business_minor_sub_category`.
- **Partially-active filters:** only `minor_sub_categories` + free-text are active today; the others are commented out. See `RECOMMENDED` below for the decision on restoring them.
- **Free-text matching** (current logic, lines 393–421):
    - Terms: `product_service_input` then `company_name_input` (each optional).
    - For each term: strip `#` characters (`term.replace(/#/g, '')`), split on whitespace/commas (`split(/[\s,]+/)`), drop empties.
    - Each word becomes: `(users_businesses.business_name LIKE '%word%' OR REPLACE(users_business_characteristics.business_industry_belong_to, '#', '') LIKE '%word%')`.
    - Words of one term are OR-ed; terms are OR-ed; everything is grouped and AND-ed to the base conditions.
- **No ORDER BY / LIMIT in the active query today** (`ORDER BY RAND() LIMIT 5` is commented out at line 435).

## Current problems

- Still on the frozen mysql2 layer.
- Filter branches disabled → incomplete search.
- Copy files still hold real interpolation.
- Response is a bare array; any new code must keep that.

---

# 8. Current → Target

## Current

```text
req.body/req.session → selection.controller.js (callback) → selection.model.js
   → concatenated chunk of raw SQL hardened partway with `?` placeholders
   → mysql2 pool → raw row objects → res.send(array)
```

## Target

```text
req.body/req.session → new Sequelize controller (async/await, uses db.Sequelize.Op)
   → dynamically-built parameterized where object (Op.or / Op.and / Op.like / Op.eq)
   → include-based INNER JOINs for characteristics + medias
   → Sequelize findAll(...) with raw: true (or mapped toJSON)
   → same row objects → same res.send(array) contract
```

## Before / After concept (adapt to the real codebase — do not force it)

```js
// BEFORE (original vulnerable pattern from CODE_REVIEW.md)
query += ` AND users_businesses.country_of_operation LIKE '%${param.countryCode}%'`;

// CURRENT in-tree state (mysql2 placeholders)
orConditions.push(`users_businesses.country_of_operation LIKE ?`);
queryParams.push(`%${value}%`);

// TARGET (Sequelize, intended pattern — the agent must adapt to exact model/where layout)
if (param.countryCode) {
    where[Op.and].push({ country_of_operation: { [Op.like]: `%${param.countryCode}%` } });
}
```

> Use this as the intended pattern. Inspect the existing architecture and adapt the implementation accordingly. The point is: **user data only ever appears inside an `Op.*` value, never inside a SQL literal**.

---

# 9. Detailed Implementation Plan

## Step 1 — Inspect existing implementation

- Read `app/models/selection.model.js` (lines 310–447), `app/controllers/selection.controller.js`, `app/routes/index.js` (lines 20–30 and 140–146).
- Read the three Sequelize models and `app/db_models/index.js`. Note the lack of registered associations → `include` will need explicit `on` + `required: true`.

## Step 2 — Identify all affected inputs

All of these come from `req.body` (plus `req.session.user.uuid`):

`regionOfOperationCode`, `countryCode`, `selectionState`, `selectionCity`, `language`, `business_scale`, `trade_categories`, `sub_categories`, `minor_sub_categories`, `product_service_input`, `company_name_input`.

`uuid` is currently read but **not used in the query** — preserve that (don't add it to the query).

## Step 3 — Inspect existing project pattern

- Model `app/db_controllers/users-businesses.controller.js` for `const db = require('../db_models')` + `const Op = db.Sequelize.Op` + async/await style.
- `app/services/analytics.service.js` for a more complete Sequelize example.
- Registration controller for validation/error conventions (out of scope for behavior, but good for error handling style).

## Step 4 — Implement the new Sequelize search controller

Create `app/db_controllers/search-businesses.controller.js`:

- `exports.findAllBySearchParameter = async (req, res, next) => { ... }`.
- Build a `where` object where the **base conditions** AND all filters are expressed as data structures (never SQL strings).
- Base conditions: `{ isPaid: 1 }` plus media banner/logo conditions — apply them on the **included** `users_business_medias` `where` (e.g. `banner: { [Op.ne]: '' }`, `banner: { [Op.ne]: null }`, same for `logo`), with `required: true` so the joins stay INNER.
- `include` the characteristics and medias models with explicit `on` on `uuid` (because no associations are registered) and `required: true`.
- Replicate the free-text algorithm (Step 3 of current behavior) with `[Op.or]`/`[Op.and]` groups. For the `REPLACE(business_industry_belong_to, '#', '')` matching, use `db.sequelize.where(db.sequelize.fn('REPLACE', db.sequelize.col('users_business_characteristics.business_industry_belong_to'), '#', ''), { [Op.like]: '%' + word + '%' })`. **TO INVESTIGATE** the exact col-qualified syntax for your Sequelize version.
- Keep the same `attributes` list as the current SELECT (the exact snake_case columns). Use `raw: true` so rows are plain objects (keys = attribute names = column names in this codebase, since no `camelCase` aliasing is configured).
- No `ORDER BY` / `LIMIT` to match current active behavior. (Finding 21 recommends pagination/random-sampling improvements, but that is a separate task — do not change ordering here.)
- Error handling: on failure call `next(err)` (or settle on a consistent `res.status(500).send(...)` matching the existing controllers) — see Steps on consistency. Preserve the **bare array** success response.

## Step 5 — Update the route

In `app/routes/index.js`:

- Add `const searchBusinesses = require('../db_controllers/search-businesses.controller.js');` near line 26.
- Change line 144 from `selection.findAllBySearchParameter` to `searchBusinesses.findAllBySearchParameter`.
- Keep the URL string identical.

## Step 6 — Re-point/trim the legacy controller model

- Remove the now-unused `findAllBySearchParameter` from `app/controllers/selection.controller.js` (and, if `Model.getAllBySearchParameter` is then unused, remove that method from `app/models/selection.model.js`) — OR leave them only if other callers exist. **Search for all usages first** (`rg "getAllBySearchParameter|findAllBySearchParameter"`). Favor removing the vulnerability surface once nothing requires it, and delete the two `selection.model copy*.js` files only after `rg` confirms they are unrequired.

## Step 7 — Add or update tests

Add tests per Section 13 (at minimum a parameterized-query regression test and injection attempts). If no test runner exists, create the smallest test file that can run with Node's built-in `node:test` or add Jest per General Recommendation 1 — do NOT ship a fix with zero verification if a runner can be added cheaply.

## Step 8 — Review the implementation

Verify against Section 14 before declaring completion.

---

# 10. Architecture and Existing Patterns

- Follow the **existing Sequelize controller pattern** in `app/db_controllers/` (require `../db_models`, use `db.Sequelize.Op`, async/await).
- Preserve the **existing route file convention** (`app/routes/index.js`).
- Preserve the **existing response contract** (bare JSON array).
- Explicitly:

> Do not introduce a new dependency, framework, architecture, or design pattern when an appropriate existing project pattern already exists.

If the Sequelize `include` + `REPLACE`/`fn` combination proves overly fragile in this codebase, an acceptable **fallback** is to keep the query in mysql2 **but fully parameterized with `?` placeholders** for every value (per CODE_REVIEW: "If staying with raw SQL temporarily, use mysql2 parameterized placeholders exclusively"). The primary recommended path is Sequelize.

---

# 11. Security Requirements

- **Never** concatenate user input into SQL — not into string literals, not into `LIKE` patterns, not into `ORDER BY`, not into `LIMIT`.
- **Never** interpolate user input into SQL strings (no `'${param.x}'`, no `%${x}%` inside the SQL template).
- If mysql2 fallback is used: every value must go through the `?` placeholder + params array.
- If Sequelize is used: every value must be passed inside `{ [Op.like]: value }`, `{ [Op.eq]: value }`, etc.
- Do **not** pass user input as column names, table names, or operators. (Column names here are compile-time constants from the current SELECT list.)
- Do not log `req.body`, passwords, UUIDs, or session objects. The current model has `console.log('getAllBySearchParameter param :', param)` — remove logging of the request parameters in the new controller (or log at debug level without content).
- Test injection cases (Section 13).
- Inspect the affected code path for **similar vulnerabilities**: the two `selection.model copy*.js` files, and other legacy search/`LIKE` usages (`rg "LIKE '%" app`). Do not leave a known interpolation behind in this search path.

---

# 12. Backward Compatibility

The fix must preserve:

- **URL:** `POST /api/post/selection-search-parameter` (unchanged).
- **Request params:** all current keys mapped the same way (the client sends exactly the keys listed in Step 2; `selection.js` also sends a hardcoded `countryCode: 'PH'`, `selectionState: 1347`).
- **Response:** bare JSON **array** of rows, with the **same snake_case keys and types** (numbers remain numbers, strings remain strings; Sequelize returns strings for string columns and may need `dataValues` handling — `raw: true` is the simplest).
- **Filter semantics:** same matching behavior (exact match vs `LIKE %...%`) per original logic.
- **The empty-results case:** client checks `data.length > 0`; an empty array must still be returned (not `null`).
- **The base "paid + banner + logo" filtering** must remain.
- UI behavior: no EJS/view changes.

Do not accidentally "improve" searching (e.g. do not make all filters active if that changes results) unless the task owner explicitly approves — see note about restoring commented-out filters below.

---

# 13. Testing Strategy

> NOTE: the repo has **no test suite** (`npm test` is a stub that fails). Verify by (a) adding focused tests if cheap, and (b) running the server and exercising the endpoint.

### Normal Case

- POST valid filters (e.g. `minor_sub_categories`, `product_service_input: 'coffee'`, `company_name_input`) → expect the same rows as the current endpoint.
- Verify response is a JSON array, rows carry `business_name`, `banner`, `logo`, `uuid`, etc.

### Empty / Missing Input

- POST with no filters → still returns rows matching only base conditions (`isPaid=1` + banner/logo), same as today (empty array is also acceptable if current behavior returns empty).

### Boundary Cases

- Empty strings, whitespace-only, very long strings (10k chars), special characters (`'`, `"`, `;`, `#`, `%`, `_`, `\`), null/undefined values, arrays, numbers passed where strings expected.
- `product_service_input` containing `#` (e.g. `'#co#ffee'`) → `#` must be stripped exactly like today.

### Invalid Input

- Malformed payloads must not crash the server (the global error handler may be absent — see Finding 32; the new controller should still not throw to an unhandled state).

### Security Cases

- `minor_sub_categories = "' OR '1'='1"` → must not return all rows / must not error with SQL syntax.
- `product_service_input = "' UNION SELECT password FROM users_accounts -- "` → must be treated as data.
- `countryCode = "x' OR '1'='1' UNION SELECT * FROM users_accounts -- "` (will be sent by client as a number sometimes - treat robustly).
- Double quote payloads, backtick payloads, comment payloads (SQL comments `--`, `#`).
- Confirmed: **no SQL errors and no auth/credential data leaking**.

### Regression Testing

- Login, registration, `/selection` page render, and the OTHER selection endpoints (`get-companies-related-to-current-user`, `get-next-five-companies`, `get-prev-five-companies`, `get-random-companies`) must still work.
- Compare results of new endpoint vs current endpoint on the same DB sample for at least the active filter cases (run the server, hit both, diff arrays).

---

# 14. Verification / Evidence

The coding agent must provide concrete evidence, not a bare "fixed":

- **Code paths:** show the final `where`-building code; grep that no `'${` or `${` remains inside SQL strings in the new search path.
- **Files:** list final diff (`git diff`) for review.
- **Tests:** test results table (normal / edge / injection / regression).
- **Security conditions:** demo payload results from a live run (server log + response).
- **Runtime behavior:** run `npm run dev` (or `node app/src/server.js`), hit `POST /api/post/selection-search-parameter` with normal and malicious payloads, confirm responses.
- **Similar-pattern sweep:** `rg "\\s\\)\\)?.*\\$\{" app/models app/db_controllers` and `rg "LIKE '%\"" app` — list any remaining interpolation in search/login paths found.
- **Final diff** reviewed and included in the report.

---

# 15. Do NOT Do

- Do not modify unrelated functionality (other selection methods, login, registration, uploads).
- Do not rewrite the entire application.
- Do not introduce unnecessary dependencies.
- Do not change the database schema.
- Do not change API contracts (URL, params, response array shape).
- Do not modify environment secrets or `.env`.
- Do not disable security checks.
- Do not remove tests simply because they fail.
- Do not hide or suppress errors (no `catch {}` swallowing).
- Do not change ordering/pagination semantics (leave `ORDER BY`/`LIMIT` out, matching the current active query) — handle Finding 21 separately.
- Do not blanket-restore the commented-out filters without confirming expected behavior; if restoring them, keep it a **separate, approved** decision and call it out in the report.

---

# 16. Acceptance Criteria

## Acceptance Criteria

- [ ] Original vulnerability (raw user interpolation into search SQL) is resolved in the search data path.
- [ ] No user-controlled value is ever concatenated into SQL — all values are parameterized (`Op.*` or `?` placeholders).
- [ ] Search endpoint migrated to the Sequelize stack following existing `app/db_controllers/` patterns (or, if unavoidable, fully parameterized mysql2).
- [ ] All affected code paths were investigated (model, controller, route, client, dead copies).
- [ ] Existing functionality preserved: same URL, same params, same base filtering, same free-text algorithm, bare array response.
- [ ] The previously disabled filter branches (trade_categories, countryCode, language, etc.) are either correctly re-enabled with the same semantics or explicitly documented as intentionally disabled.
- [ ] Dead copy files with raw interpolation are deleted (after `rg` confirmed unused) or documented as still-present with reason.
- [ ] Sensitive `console.log` of request params removed in the new path.
- [ ] Relevant tests added and passing; security payloads verified against a live server.
- [ ] No unrelated files were modified.
- [ ] Final diff was reviewed.
- [ ] Remaining risks are documented (tables below).

---

# 17. Expected Final Report

Finish with this structure:

```markdown
# Implementation Report

## Summary

Brief explanation of what was implemented.

## Files Modified

| File  | Changes |
| ----- | ------- |
| `...` | ...     |

## Files Added

| File  | Purpose |
| ----- | ------- |
| `...` | ...     |

## Files Deleted

| File  | Reason |
| ----- | ------ |
| `...` | ...    |

## Files Referenced Only

| File  | Why |
| ----- | --- |
| `...` | ... |

## Implementation Details

Explain the important changes (where-building, includes, REPLACE/Op handling).

## Testing

| Test            | Result    |
| --------------- | --------- |
| Normal case     | PASS/FAIL |
| Edge case       | PASS/FAIL |
| Security case   | PASS/FAIL |
| Regression test | PASS/FAIL |

## Verification

Explain how the original issue was verified as fixed (live payload runs, grep sweep, diff).

## Remaining Risks

List anything that could not be verified (e.g. filter restoration decision, SEQUELIZE include/fn caveats).

## Final Status

PASS / NEEDS REVIEW
```

---

# 18. Important Rules for Generating the Task Document

### Rule 1 — Do not hallucinate

This document follows that rule. Where the repository facts needed verification, this document says **TO INVESTIGATE** or marks the source as CODE_REVIEW-snapshot vs verified-current-state. The coding agent must do the same in its report.

### Rule 2 — Separate facts from recommendations

- `CURRENT IMPLEMENTATION` = what is actually in `app/models/selection.model.js` (verified: partially parameterized, filters commented out).
- `RECOMMENDED` = the Sequelize migration described here.
- The original interpolation from `CODE_REVIEW.md` was NOT re-presented as current file state beyond the dead copies.

### Rule 3 — Prefer project consistency

Follow `app/db_controllers/` + `app/db_models/` conventions; fallback to parameterized mysql2 only if the Sequelize path is not viable, and say why.

### Rule 4 — Preserve behavior

Same URL, params, filters, response array, free-text algorithm.

### Rule 5 — Think about the entire code path

Input → route → controller → model → MySQL → response were all traced (Section 4, 5).

### Rule 6 — Make the task executable

WHAT (migrate search to Sequelize, parameterize), WHERE (Section 6 table), WHY (Section 3), HOW (Section 9), WHAT NOT (Section 15), HOW TO TEST (Section 13), HOW TO VERIFY (Section 14).

---

# 19. Software-Engineer Data Flow Primer (Mentoring Reference)

> **What this section is:** the mechanical fix in Sections 3–18 is _what_ we build; this section is _why_. It is a full mentoring lesson on how data actually flows through a production-quality web app, using this repo's real search feature (`/selection`) as the running example. Read it once end-to-end, then keep §19.10 (checklist) and §19.11 (golden rules) as day-to-day references.

---

## 19.0 Why "Frontend → Controller → Model → Database" is not enough

That four-box diagram is the _happy path drawing_ of a toy app. A production system is not one flow, it is a **supply chain with checkpoints**. Every arrow in the drawing is a place where things can go wrong — and every professional layer exists to answer one question at one specific **trust boundary**.

**Analogy.** A storefront flow is:

```
Customer → Clerk takes order → Stockroom → Shelf
```

That works for a corner shop. A real business adds:

- The **customer is not inherently trusted** → add an ID check (authentication) and a "may they even do this?" check (authorization).
- The **order form can be forged or mistyped** → add a form reviewer who checks the shape and size of every field (validation).
- The **stockroom keeps records and supports many customers and can be tuned into** → add a specialist who only writes well-formed _requisitions_ (repository), and who tells the stock clerks exactly which record and which field (parameterized query).
- The **shelf label must not be treated as a command** → when we present the product to the next customer, we put it behind glass (output encoding).
- The **store can be overwhelmed by a mob** → limit how many orders per customer per hour (rate limiting).
- The **stockroom can fail** → the specialist reports a clean "we ran into a problem" instead of dumping the warehouse blueprint to the customer (error handling + logging).

Each layer is a _role_, not a "file that has to exist." If a role is missing, its responsibility silently collapses onto its neighbor — and that is exactly how the old bug here happened: the **model** (data access) was doing the **validation, the normalization, and the SQL-escaping question** all at once, and it failed at the one that matters.

---

## 19.1 Trace one real search byte-by-byte (your code, end to end)

The user types `coffee` into the company-name box and presses Enter.

| #   | Step                                       | Where                                                                                                                                                                                                | What crosses this hop                                                                |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | Browser captures keystrokes                | `public/assets/js/selection.js:1780` (`keydown` listener) + `selectionSearchParameter()` at `:1801`                                                                                                  | DOM → JS variables                                                                   |
| 2   | JS reads **every** filter into one payload | `selection.js:1802-1812`                                                                                                                                                                             | DOM values → object                                                                  |
| 3   | JS de-duplicates unchanged searches        | `selection.js:1814-1831` (`lastSelectionSearchKey`)                                                                                                                                                  | (load protection, **not** security)                                                  |
| 4   | HTTP request                               | `selection.js:1845-1863` — `$.ajax` `POST /api/post/selection-search-parameter`. Note: the client _hardcodes_ `countryCode: 'PH'`, `selectionState: 1347`, `regionOfOperationCode: 'SouthEast Asia'` | object → HTTP body                                                                   |
| 5   | Express routing                            | `app/routes/index.js:145`                                                                                                                                                                            | HTTP → handler                                                                       |
| 6   | Controller (HTTP mapping + key whitelist)  | `app/db_controllers/search-businesses.controller.js:37-43` (`mapSearchParams`)                                                                                                                       | `req.body` → **only 11 whitelisted keys**                                            |
| 7   | Service (business logic + query building)  | `app/services/business-search.service.js` — `buildSearchOptions` → `Op.*` values, includes, `flattenSearchRows`                                                                                      | params object → Sequelize `where` data structure                                     |
| 8   | Repository / model (data access)           | `app/db_models/` → `db.users_businesses.findAll(...)`                                                                                                                                                | data structure → **parameterized SQL**                                               |
| 9   | Database executes                          | MySQL                                                                                                                                                                                                | `SELECT ... WHERE ... AND business_name LIKE ?` with `['%coffee%']` bound separately |
| 10  | Response                                   | controller `res.send(flattenSearchRows(rows))` → `selection.js:1864-1896` renders banners/details                                                                                                    | rows → bare JSON array → DOM                                                         |

Each numbered hop is where a truthful "where should X happen?" question lands. The rest of this section walks the layers one by one.

---

## 19.2 Why each layer exists (the full walkthrough)

For every layer: responsibility, what enters, what leaves, validation, security, what must **never** happen there, why it exists, a realistic snippet from this codebase, a beginner analogy, and a golden rule.

### 19.2.1 Frontend UI (HTML/EJS)

- **Responsibility:** present data; capture intent (typing, choosing filters).
- **Enters:** user keystrokes/gestures.
- **Leaves:** DOM element values.
- **Validation:** only _cosmetic_ — `required`, `maxlength`, input `type`, disable buttons. It prevents a _clumsy_ user, not an _attacker_.
- **Security:** nothing meaningful; the attacker can view-source and change anything. Never treat the DOM as a security boundary.
- **Must never:** decide whether a search is allowed, decide who a user is, or pass judgment on "is this safe to run."
- **Why it exists:** humans are sloppy and hostile to complexity, not to data.
- **Golden rule:** the UI is a display case, not a door.

### 19.2.2 JavaScript (the client app)

- **Responsibility:** capture intent, build the HTTP payload, render the response.
- **Enters:** DOM values + server response JSON.
- **Leaves:** an HTTP request body; later, DOM updates.
- **Validation:** client-side — used for instant feedback (e.g., skip re-request when nothing changed, `selection.js:1828`).
- **Security:** client-side sanitization buys **zero** security (anyone can call the API with `fetch`/`curl` and bypass your JS). Its only valid security-adjacent duty is **output encoding when rendering data into the DOM** (see §19.4.10) — and remember _you_ decided the strings are data; the DOM is where they can become code.
- **Must never:** be the only validation, decide authorization, or "clean" the input and think that makes the backend safe.
- **Why it exists:** it is the bridge between human and machine; it optimizes the _experience_, not the _enforcement_.
- **Golden rule:** JS is a messenger, not a bouncer.

### 19.2.3 HTTP request (the wire)

- **Responsibility:** carry bytes between processes.
- **Enters:** whatever the client serialized.
- **Leaves:** `req.body` / `req.query` / `req.params` server-side.
- **Validation:** none here — HTTP is content-agnostic.
- **Security:** this is the first **trust boundary**. Everything arriving on the wire is **untrusted until proven otherwise**: body parsers, Content-Type, size, encoding. (This app uses `express.json()`/`express.urlencoded()`; oversized bodies are rejected by body-parser's default `100kb` limit — that is one rate/size control that _is_ already in place.)
- **Must never:** be believed.
- **Why it exists:** separation of processes; without it there is no "server."
- **Golden rule:** the wire is untrusted; assume every request is hostile until a lower layer says otherwise.

### 19.2.4 API Route (the gate)

- **Responsibility:** map a method+path to a handler; attach middleware.
- **Enters:** `(req, res)`.
- **Leaves:** a call chain: `middleware → controller`.
- **Validation:** none itself, but it is where validators are _wired in_ (see §19.2.5).
- **Security:** the route table is the first place you _name_ what is public. Example: `app/routes/index.js:145` exposes this search with **no auth middleware** (the whole `/api` layer has none — Finding 6, still open). A production route for something user-scoped would attach `ensureAuthenticated` here.
- **Must never:** contain business logic or SQL.
- **Why it exists:** one URL, one job — the dependency-injection point of a request.
- **Golden rule:** routes only direct traffic; they never inspect cargo.

### 19.2.5 Request-validation middleware

- **Responsibility:** verify the _shape, type, and size_ of what arrived, **before** the controller touches it.
- **Enters:** raw `req.body/query/params`.
- **Leaves:** the same request — now guaranteed to have fields with the right types, lengths, and presence — or an early `400` response.
- **Validation:** ALL of it that is structural: required vs optional, string/number/boolean, allowed values (e.g. `business_scale` must be `1|2|3|4`, country must be a 2-letter ISO code), max length (e.g. search ≤ 100 chars), no unexpected keys.
- **Security:** blocks malformed payloads from ever reaching SQL or eager logic; this is also where the **extremely-long-string** and **type-confusion** (array/object where string expected) cases die first.
- **Must never:** run business rules that depend on the DB, or do the query itself.
- **Why it exists:** fail fast at the edge — reject garbage while handling the request is still cheap and side-effect-free. This is the layer the current code partially replaces with `mapSearchParams` + `toScalar` (see §19.12).
- **Golden rule:** garbage is rejected at the door, not in the kitchen.

### 19.2.6 Controller

- **Responsibility:** translate HTTP ⇄ application concerns. Read the (now validated) request, decide "this is a search", call the service, translate the result into a response.
- **Enters:** validated request data (+ context like session).
- **Leaves:** a call to a service and, later, a `res.status(...).send(...)`.
- **Validation:** should be a no-op if middleware already validated — the controller _assumes_ validated input. (In this repo today the controller does the whitelist because there is no middleware yet.)
- **Security:** no SQL, no filesystem writes; only session/context reading (e.g. "who is searching") and choosing status codes. Never echo raw error messages.
- **Must never:** build queries, run business rules, or render HTML.
- **Why it exists:** the _only_ layer that knows about HTTP on the way in **and** out; everything else should be framework-agnostic.
- **Snippet:**

```js
// app/db_controllers/search-businesses.controller.js:37
exports.findAllBySearchParameter = async (req, res) => {
    try {
        const rows = await service.searchBusinesses(mapSearchParams(req.body));
        res.send(service.flattenSearchRows(rows));
    } catch (err) {
        res.status(500).send({ message: 'Failed to retrieve companies.' });
    }
};
```

- **Golden rule:** thin controller, thick service.

### 19.2.7 Service / business logic

- **Responsibility:** encode the business rules and compose the query _as a data structure_. This is the brain.
- **Enters:** validated, structured params (an in-memory object, not `req.body`).
- **Leaves:** an executed result (rows) **or** a domain-level success/failure.
- **Validation:** _business-rule_ validation lives here — e.g., the rule embedded in `buildSearchOptions`: only `isPaid = 1` companies that have both `banner` and `logo` are searchable (`business-search.service.js:134`, `:61-67`). Also normalization: `tokenizeSearchTerm` (`:71`) strips `#` and splits words — _this_ is normalization done in the right place (server-side, at the point where the shape of the search is defined).
- **Security:** the service is where safety of the _query shape_ is decided: every user value must end up **inside an `Op.*` object**, never inside a SQL literal (`:84-95`). It also runs a value **coercion** guard, `toScalar` (`:43-47`), which silently drops arrays/objects — meaning an attacker can't smuggle Sequelize operator objects (`{ $ne: ... }` / `/norm/`) in as a value.
- **Must never:** touch `req`/`res`, talk HTTP, or render. (This service is clean — the legacy models did all of this and that is why they were unmaintainable.)
- **Why it exists:** business rules change; by isolating them you can change "searchable = paid+banner+logo" without touching a route or a controller, and you can unit-test the whole brain with no server running.
- **Golden rule:** the service speaks _domain_; it never speaks HTTP or SQL syntax.

### 19.2.8 Repository / model (data access)

- **Responsibility:** the _last_ deliberate layer: convert a well-formed request into exactly one database operation and shape the rows back.
- **Enters:** the service's structured options (here: `{ attributes, include, where, raw }`).
- **Leaves:** plain rows.
- **Validation:** none — must trust its caller; if stale data was "validated" upstream this is where a bad row would surface, and then the DB constraints (§19.4.14) are the backstop.
- **Security:** **this is where SQL-injection protection is physically enforced** — every value goes through the driver's parameterization (`op.like`, `op.eq`, bind parameters). Nothing user-controlled may be assembled into a SQL _string_, and nothing user-controlled may appear as an identifier (table/column/operator).
- **Must never:** run business logic, re-validate just to compensate for a missing validator, or interpolate.
- **Why it exists:** it is the single choke point that owns the SQL; because _all_ queries go through it, _all_ queries become safe by construction.
- **Snippet (what this layer produces for the DB driver):**

```js
where: {
  [Op.and]: [
    { isPaid: 1 },
    { [Op.or]: facets },
  ],
}
// → SELECT ... FROM users_businesses
//   JOIN ... WHERE users_businesses.isPaid = 1
//   AND (users_businesses.business_name LIKE ? ...)   -- bound value: '%coffee%'
```

- **Golden rule:** the repository is the last line of defense between a string and the engine — never break rank.

### 19.2.9 Database

- **Responsibility:** store, index, enforce integrity, return rows.
- **Enters:** parameterized SQL + bound values.
- **Leaves:** result rows.
- **Validation:** **database constraints are the authority on truth** — `NOT NULL`, `UNIQUE`, `CHECK`, `ENUM`, `FOREIGN KEY`, column `VARCHAR(n)` lengths. If upstream layers lie, the DB refuses.
- **Security:** parameterized/prepared statements make the DB treat values as data; privileges (least-privilege DB user), and constraints are the enforcement of last resort.
- **Must never:** be asked to "figure out intent" — ambiguity belongs to the service.
- **Why it exists:** it is the durable, concurrent, crash-safe source of truth.
- **Golden rule:** the database is judge, not negotiator.

### 19.2.10 The response & the frontend render

- **Responsibility:** return rows in a stable contract; render them safely.
- **Enters:** rows.
- **Leaves:** JSON → DOM.
- **Validation:** output _encoding_ — the mirror-image rule. Data you wrote as JSON can be rendered into HTML and become a `<script>` (see §19.4.10). In this repo, rows are interpolated into `innerHTML` (`selection.js:835-845`, `formattingBusinessTags` at `:1734-1746`) — a **real XSS gap** if an attacker can control a `business_name` (they can, via another public signup endpoint). Follow-up scope; calling it out because it is the textbook answer to "I fixed SQLi, am I done?" — no: the data simply moved to a different execution context.
- **Must never:** leak stack traces, internal errors, or SQL to the client.
- **Golden rule:** what left as data must arrive as data — escape at every context change.

---

## 19.3 VALIDATION ≠ SANITIZATION ≠ SQL-INJECTION PROTECTION

These three are routinely (falsely) conflated. They are answers to three **different questions**:

| Concept                      | Question it answers                                                                                      | Where it belongs                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Validation**               | "Is this data allowed to exist, and is it shaped correctly?" (type, length, allowed values)              | Client (UX) + middleware/validators (enforcement)                      |
| **Sanitization**             | "Should this data be _changed_ because of where it is going?" (strip `#`, trim whitespace, canonicalize) | At the point the value crosses into a different _context_, server-side |
| **SQL-injection protection** | "Can this value break out of _data_ into _command_?"                                                     | Always at the query layer — parameterization, full stop                |

**Sanitization is destination-specific.** "Sanitize everything" is wrong _because_ the correct treatment depends on the destination: an HTML comment, a `<script>` block, an attribute, a URL, a SQL string, and a JSON value each need _different_ (often opposite) handling. A "all-purpose" sanitizer either over-escapes (breaks legitimate data like `' OR 1=1 --` in a product name, or `#co#ffee`) or under-escapes (feels safe). The professional decision procedure is:

> **"What type of data is this? Where is it going? What security/control is appropriate for _that destination_?"** — then apply the control at the boundary of that destination, and nowhere else.

### 19.3.1 The attack, end to end: `' OR 1=1 --`

**BAD implementation — the value becomes code:**

```text
User
 → Frontend (JS only trims, no guard)
 → API  (POST body passes straight through)
 → Controller (blindly renames req.body into parameters)
 → Model (query += ` AND users_businesses.country_of_operation LIKE '%${param.countryCode}%'`)
 → SQL text build
 → Database parses:
      ... WHERE country_of_operation LIKE '%' OR 1=1 --%'
      ─────────────────────────────────────────────^ closes the literal
            ────────────────^ always-true condition
                              ───^ comment: everything after this is ignored
 → ALL ROWS (including accounts, if UNION used) are returned
```

Why it is vulnerable: string **concatenation merges the _template_ and the _data_ into one text blob**, so the database can no longer tell "these bytes are instructions" from "these bytes are a value." The attacker's characters become part of the parser's input. Escaping functions (`escape`, `real_escape_string`) help but are a patch on a broken design — encoding/edge cases historically defeat them.

**GOOD implementation — the value stays data:**

```text
User
 → Frontend (UX only)
 → API
 → Request-validation middleware  (shape/type/length; rejection of junk)
 → Controller (whitelist keys, still HTTP-only)
 → Service (business rules + normalization, e.g. strip '#', tokenize)
 → Repository (builds Op.like / prepared statement)
 → Parameterized SQL:  VALUES NEVER ENTER THE SQL TEXT
 → Database
```

Where the protection happens: **at the `Repository` boundary.** The SQL template is `... AND business_name LIKE ?` and the value `' OR 1=1 --` is delivered to the driver as a _bind parameter, on a separate channel_ (binary protocol). The database treats every byte of the value as a search pattern — the operator characters simply have no syntax meaning anymore. The query can never be injected, regardless of what the value contains, because the _command template_ is fixed by the repository and the _data_ never gets parsed as command.

**Sanitization is NOT the fix.** Even if you strip `'` and `--` in JS, an attacker calls the API directly with `curl` and bypasses your filter. The only robust fix is the design one: parameterize at the boundary where the value would otherwise touch the SQL grammar.

### 19.3.2 Concretely, in this repo

```js
// ❌ NEVER
const query = `
    SELECT *
    FROM users
    WHERE name LIKE '%${search}%'
`;

// ✅ ALWAYS — an indexed placeholder; the value is bound, never interpolated
const query = `SELECT * FROM users WHERE name LIKE ?`;
db.query(query, [`%${search}%`]);
```

The second form is safer **not because the `%` magic is escaped** (the driver still knows `%` is a wildcard inside the pattern) but because `?: the value never becomes SQL grammar. `' OR 1=1 --` is delivered as data, and the parser never sees it as syntax. The Sequelize equivalent used in this codebase:

```js
{ business_name: { [Op.like]: `%${value}%` } }   // value is an Op value → bound
```

Same principle — the `value` sits inside an operator object, and Sequelize generates a placeholder instead of splicing text into SQL.

---

## 19.4 The 14 terms every engineer must be able to defend

1. **Client-side validation** — checks in the browser for instant feedback (required fields, input masks, Enter-to-search). _It is UX, not security._ Anyone can disable it or call the API directly.
2. **Server-side validation** — authoritative checks on the server: type, size, allowed values, presence. This is what actually protects the system. If the two disagree, the server wins. Rule: **the backend must never trust frontend validation**, because the browser runs in an attacker-owned environment (a "real" user opens DevTools — the payload is no longer _yours_).
3. **Input sanitization** — deliberately changing input _for a destination context_ (here: `tokenizeSearchTerm` strips `#` because `#co#ffee` and `coffee` should match, and splits on whitespace). Not about evil-doers; about canonical form.
4. **Data normalization** — making equivalent values identical before comparison: trim, lowercase, Unicode NFC, category codes as `PH` not `ph`. Lives in the service, so every caller searches the same way.
5. **Authentication** — _who are you?_ Establishing identity (login, session, token). In this app: `req.session.user`; the uuid is AES-encrypted and must be decrypted via `app/shared/ecdc.js`. **Currently the search endpoint performs none** — anyone, authenticated or not, can search. Finding 6.
6. **Authorization** — _may you do X with this?_ After identity, decide scope (a Small-tier user may not see paid-only data patterns; user A may not read user B's rows). Usually a middleware/controller concern; per-row checks happen in the service.
7. **SQL-injection protection** — preventing a value from escaping _data_ into _command_ context. Never in the frontend; always at the query boundary.
8. **Parameterized queries / prepared statements** — _the mechanism_ behind #7: template + bind parameters delivered separately. In this app: Sequelize `Op.*` operators and mysql2 `?` placeholders. The safe-by-construction default.
9. **Business-rule validation** — rules about _the domain_, not the wire format: "only paid businesses with logo+banner appear in search," "free tier caps contact emails." These live in the service and often need DB state, so they cannot run in middleware (which runs before the DB is consulted).
10. **Output encoding** — escaping data _when it moves into a new render context_ so it cannot execute: HTML-escape user text before `innerHTML`, URL-encode before putting in a `href`, JSON-stringify before embedding in a script. This is the _other_ half of "never let data become code," and it is precisely where this app's frontend is still exposed (§19.2.10, `selection.js:835-845`).
11. **Rate limiting** — cap requests per IP/per user (e.g., 10 searches/minute). Stops scraping, brute force, and payload-flood DoS. **Not present in this app today.**
12. **Error handling** — catch → classify (4xx user error vs 5xx system error) → log a _safe_ detail → return a _generic_ message. The current catch returns `err.message` to the client (`search-businesses.controller.js:42`), leaking internal details (table names, DB engine, stack). Professional form: `res.status(500).send({ message: 'Search failed.' })` + log the real error server-side.
13. **Logging** — record what happened (WHO, WHEN, WHAT, OUTCOME, LATENCY) without secrets. Never log passwords, full bodies, uuid/session. The legacy search path `console.log`'d the whole params object — removed in the new controller.
14. **Database constraints** — the DB's own integrity rules (`NOT NULL`, `UNIQUE`, `CHECK`, `ENUM`, lengths, FKs). The last line of defense: if every upstream layer lies, the DB still refuses. Note: this schema has **no DB-level FKs** — relationships are logical by `uuid`, so integrity enforcement is weaker than ideal (documented in README §11).

---

## 19.5 Trust boundaries (who believes whom)

```
Browser DOM .......... UNTRUSTED        (user types/serves anything)
         │
HTTP body/query ....... UNTRUSTED       (first boundary: body-parser size caps, then validators)
         │
Controller input ...... UNTRUSTED until validated
         │
Service input ......... validated/structured (domain objects, not req.body)
         │
Repository params ..... safely parameterized (values only ever bound)
         │
Database ............. final enforcement via constraints; query plan never derived from user text
```

Rules of the road:

- **Frontend input = UNTRUSTED.** It is not even _sent_ by your code necessarily — it is sent by whatever the attacker runs in a browser or a script.
- **API request = UNTRUSTED.** Assume hostile until the validator signs off.
- **Controller input = UNTRUSTED until validated.** If you skipped middleware, the controller is the de-facto validator (as this repo does today) — better than nothing, worse than explicit middleware.
- **Service input = validated/structured.** By the time it arrives, the service must be able to reason about it confidently.
- **Repository parameters = safely parameterized.** No matter what the value is, it is a _value_.
- **Database = final enforcement.** Constraints, privileges, parameter binding.
- **The client "lies":** in this very feature, `selection.js:1852-1854` hardcodes `countryCode: 'PH'` / `selectionState: 1347` / `regionOfOperationCode: 'SouthEast Asia'`. Those are cosmetic; the same endpoint accepts `countryCode: { "$ne": null }` from a script if nothing stops it. That is exactly why `toScalar` exists and why the free-text _types_ must be enforced.

**Frontend vs backend validation (A/B/C):** the professional answer is **C — both, for different reasons**:

- **Frontend (B would be wrong, A would be catastrophic):** instant feedback, less wasted traffic, defensive UX. Zero security value by itself.
- **Backend (the only guarantee):** even if one validates in the frontend, the backend must validate everything independently, because the frontend is not yours. "But I already check in JS" is the exact sentence that leads to the injection bug this task fixed.

---

## 19.6 Folder responsibilities (target architecture)

| Folder                             | Owns                                                                                      | Must never contain    |
| ---------------------------------- | ----------------------------------------------------------------------------------------- | --------------------- |
| `routes/`                          | Method+path → handler wiring; middleware attachment                                       | Business logic, SQL   |
| `middlewares/`                     | Cross-cutting request concerns: auth, rate limit, request validation                      | Endpoint decisions    |
| `validators/`                      | Shape/type/length schemas (e.g. a `searchSchema` for this endpoint)                       | DB access             |
| `controllers/`                     | HTTP ⇄ domain translation, status codes, response shaping                                 | SQL, business rules   |
| `services/`                        | Business rules, orchestration, normalization (the brain)                                  | `req`/`res`, SQL text |
| `repositories/`                    | A single choke point that owns queries; parameterization                                  | HTTP, rendering       |
| `models/` (Sequelize `db_models/`) | Table mapping, associations, columns                                                      | Request logic         |
| `utils/`                           | Pure, deterministic helpers (date formatting to `Asia/Manila`, uuid helpers, ECM/decrypt) | I/O with side effects |

---

## 19.7 DTO vs Request Object vs Validation Schema vs Domain Object vs Database Model vs Entity vs Repository vs Service vs Controller

| Term                           | Plain meaning                                                                                  | Analogy                                                | In THIS repo                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| **Request Object**             | The raw thing that arrived on the wire (`req.body`)                                            | The filled-in paper form                               | `req.body`                                                              |
| **Validation Schema**          | The rules describing an _acceptable_ request                                                   | The "how to fill this form correctly" poster           | (missing — future `validators/search.validator.js`)                     |
| **DTO** (Data Transfer Object) | A validated, shape-<em>guaranteed</em> object you _hand inward_; it carries data, not behavior | A cleaner, typed copy of the form for the office       | `mapSearchParams(req.body)` result (whitelist → DTO-ish)                |
| **Domain Object**              | A richer object carrying business rules/identity                                               | The customer's actual _account_, not the form          | `BusinessSearchService` instances / search options object               |
| **Database Model** (Sequelize) | A class bound to a table (columns, table name)                                                 | The filing cabinet's index card                        | `app/db_models/users_businesses.model.js`                               |
| **Entity**                     | A _row_ — one in-memory instance of a model with an identity (`uuid`)                          | One person's filled card                               | A found row                                                             |
| **Repository**                 | The class owning _all_ queries to a table/aggregate                                            | The warehouse clerk who knows exactly which shelf      | Sequelize model calls (thin here: the service uses the models directly) |
| **Service**                    | Business logic + orchestration over one or more repos                                          | The department that implements the company policy      | `BusinessSearchService`                                                 |
| **Controller**                 | HTTP in/out translation                                                                        | The receptionist + the person who leaves the voicemail | `search-businesses.controller.js`                                       |

One line summary: **request → validate → DTO → [service performs business rules] → repository → model → entity → back out to JSON.**

---

## 19.8 What actually happens to tricky inputs (decision exercise)

The professional question is always _"what type of data is this, where is it going, what control fits that destination?"_ — not "sanitize everything."

| Payload                            | Verdict                                                                                   | Why                                                                                       | Where the control lives in this repo                                                                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search=` (empty)                  | **Treat as normal data** → normalize → no filter                                          | Empty means "no search term," not "attack." Trim it and drop it; return the base set.     | `if (term)` skips free-text facet (`business-search.service.js:141`)                                                                                        |
| `search=<script>alert(1)</script>` | **Treat as normal data** on the way **in**; **must be output-encoded** on the way **out** | In JSON/SQL it is inert characters. It only becomes code if rendered into HTML unescaped. | Verdict on input: none needed (parameterized). Verdict on output: **currently vulnerable** — `selection.js:835-845` writes `business_name` into `innerHTML` |
| `search=' OR 1=1 --`               | **Treat as normal data** — parameterized, so the DB sees a literal pattern                | Injection protection lives at the query boundary, not in input cleaning                   | `[Op.like]: '%' + word + '%'` binds it (§19.3.2)                                                                                                            |
| extremely long string (10k chars)  | **Reject or truncate** (e.g. 400 if > ~100 chars); add rate limiting                      | Unbounded LIKE patterns = CPU/memory/DoS surface. No redeeming reason to allow it.        | **Not enforced** — open follow-up (validation middleware + `length`)                                                                                        |

---

## 19.9 Worked example: `GET /api/users?search=john` (the whole chain)

Abstracted version of the exact flow this repo implements, showing the value `"john"` traveling:

```js
// 1. Frontend JS (UX only)
fetch('/api/users?search=' + encodeURIComponent('john'));

// 2. Route + middleware (gate + validator)
app.get('/api/users', validateSearchParam, findUsers);         // validator: type string, ≤100 chars

// 3. Controller (HTTP ⇄ domain, thin)
exports.findUsers = async (req, res) => {
    const users = await userService.searchUsers(req.validatedQuery.search);
    res.json(users);
};

// 4. Service (business rules + normalization)
async searchUsers(search) {
    const term = search.trim();                                 // normalize
    if (term.length > 100) throw new ValidationError('too long');
    if (term.length < 2) return [];                             // business rule: min length
    return this.userRepo.findByKeyword(term);
}

// 5. Repository (data access — the only SQL, always parameterized)
findByKeyword(keyword) {
    return db.query('SELECT id, name FROM users WHERE name LIKE ?', [`%${keyword}%`]);
}

// 6. Database returns rows → repository → service → controller → JSON
// 7. Frontend renders with encoding:  el.textContent = user.name;  (never innerHTML+"")
```

What happens at each stage to `"john"`:

- `"john"` (wire, as a query string) → **validator** confirms: is a string, length ok → `req.validatedQuery.search = "john"`
- **controller** passes it through untouched → **service** normalizes: `"john".trim()` = `"john"`; min-length business rule passes
- **repository** builds `LIKE %john%` → `<value>` is bound, never spliced → **SQL**: `WHERE name LIKE ?` with `['%john%']`
- **DB** returns matching rows → **JSON** → **frontend** renders with `textContent` so `"john"` displays as text.

Now feed the same pipeline the hostile values from §19.8 and watch each of the four "decisions" (validator / normalizer / owner of SQL text / DOM writer) do its specific job.

---

## 19.10 The Software-Engineer Data Flow Checklist

Use for _every_ new feature. Fill in the "Answer" column before you write the route.

| #   | Check                                         | Where to look / how                                                                                 | Answer |
| --- | --------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------ |
| 1   | Where does the data originate?                | DOM? external API? DB? A third-party webhook?                                                       |        |
| 2   | Is the source trusted or untrusted?           | Anything over the wire = untrusted; DB rows = trusted-ish (still escape on render)                  |        |
| 3   | Where is authentication performed?            | Route middleware (`ensureAuthenticated`) — is `req.session.user` decrypted & present?               |        |
| 4   | Where is authorization performed?             | Controller/service: is this user _allowed_ this data/action (`users.type`, ownership via `uuid`)?   |        |
| 5   | Where is request validation performed?        | Validator middleware: type / allowed values / max length / required?                                |        |
| 6   | Where is normalization performed?             | Service: trim, lowercase, strip `#`, canonical codes                                                |        |
| 7   | Where are business rules enforced?            | Service: paid-only, logo+banner required, tier gates                                                |        |
| 8   | Is SQL parameterized?                         | Grep for `'${` / `${` inside query strings; all values in `Op.*` or `?` bindings                    |        |
| 9   | Are database constraints present?             | Column types, `NOT NULL`, lengths; review `db_models/` after adding columns                         |        |
| 10  | Is output safely encoded?                     | No `innerHTML += ${userData}`; use `textContent` / escaping                                         |        |
| 11  | Are errors handled safely?                    | Catch → classify → generic typo client message → real detail in logs; never `err.message` to client |        |
| 12  | Is sensitive info excluded from logs?         | No password/body/uuid/session logging                                                               |        |
| 13  | Is rate limiting needed?                      | Public/search/brute-force endpoints: yes (this search: yes — open)                                  |        |
| 14  | Can the user manipulate the request directly? | Yes, always — can they submit anything you didn't whitelist?                                        |        |
| 15  | What happens if input is malformed?           | Validator returns 400 before logic runs                                                             |        |
| 16  | What happens if input is extremely large?     | Validator caps length; body-parser caps size; DB row caps                                           |        |
| 17  | What happens if the database fails?           | Service throws → controller 500 generic; is there a load-shed path / retry?                         |        |

---

## 19.11 Golden rule per layer (memorize this table)

| Layer                         | Golden rule                                                       |
| ----------------------------- | ----------------------------------------------------------------- |
| Frontend UI & JS              | Display case + messenger — never a bouncer                        |
| HTTP / wire                   | Untrusted; assume hostile until proven otherwise                  |
| Route                         | Directs traffic; never inspects cargo                             |
| Request-validation middleware | Garbage is rejected at the door, not in the kitchen               |
| Controller                    | Thin — translate HTTP in, shape JSON out                          |
| Service                       | The brain — business rules and normalization, never SQL/HTTP      |
| Repository / model            | Last line of defense: every value binds, nothing interpolates     |
| Database                      | Judge — enforces truth via constraints and privileges             |
| Errors/Logs                   | Tell the client "it failed"; tell yourself _why_                  |
| Output rendering              | What left as data must arrive as data — escape at context changes |

---

## 19.12 Current repo state vs the ideal (honest gap list)

**Already done (verified in-tree):**

- [x] Search migrated to the Sequelize stack (controller + service exist; route re-pointed at `app/routes/index.js:145`).
- [x] All user values flow through `Op.*` operators / bindings — no string interpolation in the search path.
- [x] Key whitelist (`mapSearchParams`) + value coercion (`toScalar`, drops arrays/objects → blocks operator smuggling).
- [x] Legacy normalization preserved server-side (`tokenizeSearchTerm`).
- [x] No more `console.log` of request params in the new path.
- [x] Service is unit-testable (`constructor(dbRef)`, dependency-injected).

**Still open (do NOT claim "secure" yet):**

- [ ] No request-validation **middleware** — shape/type/length checks currently happen implicitly in `toScalar`/facets. An explicit `validators/search.validator.js` (max length ~100, string typing, allowed enums for `business_scale`, ISO codes) would be the professional version.
- [ ] No **rate limiting** on this public endpoint.
- [ ] No **authentication** on `/api/*` routes (Finding 6) — search can be called unauthenticated at will.
- [ ] Free-text length unbounded — a 10k-char search becomes a heavy `LIKE` (DoS-ish). Cap it.
- [ ] **XSS**: frontend renders DB-controlled strings via `innerHTML` (`selection.js:835-845`, `formattingBusinessTags`). Escape output (textContent / escaping) — this is output encoding, the mirror of this task.
- [ ] `search-businesses.controller.js:42` leaks `err.message` to clients; switch to a generic message + server-side log.
- [ ] DB-constraint parity: lengths/`NOT NULL` that upstream code relies on should be in `db_models/` (the schema already mirrors them for the joined tables, but verify on the free-text columns).
- [ ] The `selection.model copy*.js` files still hold the raw literal interpolation patterns — delete after `rg` proves nothing requires them (Finding 45).
