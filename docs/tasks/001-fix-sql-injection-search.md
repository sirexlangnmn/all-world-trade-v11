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

| File | Role | Action | Reason |
|---|---|---|---|
| `app/models/selection.model.js` | Current legacy implementation (`getAllBySearchParameter`, lines 310–447) | MODIFY (remove/replace the search method) | Source of the migration; leave other methods (`getCompaniesRelatedToCurrentUser`, `getPrevFiveCompanies`, etc.) untouched |
| `app/controllers/selection.controller.js` | Legacy controller (`findAllBySearchParameter`, lines 60–85) | MODIFY (re-point to the new Sequelize controller) or DELETE this method | Route must keep URL; decouple HTTP mapping from the vuln query |
| `app/routes/index.js` | Route wiring (line 144) | MODIFY (line ~144 point to new controller; add `require` near line 26) | Keep URL identical, swap handler target |
| `app/db_controllers/search-businesses.controller.js` | New Sequelize search controller | ADD | Target implementation (follows Finding 1 recommended approach + client pattern in `users-businesses.controller.js`) |
| `app/db_models/index.js` | Barrel export | REFERENCE ONLY | Provides `db.users_businesses`, `db.users_business_characteristics`, `db.users_business_medias`, `db.Sequelize.Op` |
| `app/db_models/users_businesses.model.js` | Sequelize model | REFERENCE ONLY | Attributes used in `include`/`where`/`attributes` |
| `app/db_models/users_business_characteristics.model.js` | Sequelize model | REFERENCE ONLY | JOIN target for search filters |
| `app/db_models/users_business_medias.model.js` | Sequelize model | REFERENCE ONLY | JOIN target for banner/logo base conditions |
| `app/db_controllers/users-businesses.controller.js` | Existing Sequelize pattern | REFERENCE ONLY | Established `require('../db_models')` + `db.Sequelize.Op` pattern |
| `app/models/selection.model copy.js` | Dead copy containing the true vulnerable interpolation | DELETE (only after `rg` proves unused) | Removes the injection trap; Finding 45 |
| `app/models/selection.model copy 2.js` | Dead copy containing the true vulnerable interpolation | DELETE (only after `rg` proves unused) | Removes the injection trap; Finding 45 |
| `app/controllers/selection.controller.js` (other methods) | Unrelated legacy search helpers | REFERENCE ONLY | Do not touch `findCompaniesRelatedToCurrentUser`, `findPrevFiveCompanies`, `findNextFiveCompanies`, `findRandomCompanies` |
| `app/src/server.js` | App boot / `/selection` page render | REFERENCE ONLY | Confirms page + session context; do not modify |

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
  - `users_business_medias.logo != ''`  AND `users_business_medias.logo IS NOT NULL`
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

Explain the important changes (where-building, includes, REPLACE/Op handling).

## Testing

| Test | Result |
|---|---|
| Normal case | PASS/FAIL |
| Edge case | PASS/FAIL |
| Security case | PASS/FAIL |
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