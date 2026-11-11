Please optimize and refactor the following code according to best practices, updated, modern approach.
Break down the code into smaller, more focused functions, each handling a specific task.
Ensure the code is aligned with the 'Don't Repeat Yourself' (DRY), SOLID, and 'Keep It Simple, Stupid' (KISS) principles.
The goal is to enhance security, readability, performance, reusability, testability, and maintainability.

# Fix SQL Logic Bug in Search Filter (Finding 20)

- **Source finding:** `CODE_REVIEW.md` → Detailed Findings → **Finding 20: SQL Logic Bug in Search Filter**
- **Priority:** MEDIUM-HIGH (correctness — the production search endpoint returned businesses that violate the documented visibility rules)
- **Related findings (do NOT fix here):** Finding 1 (SQL injection in the same query — already migrated to Sequelize, see `docs/tasks/001-fix-sql-injection-search.md`), Finding 21 (`ORDER BY RAND()` performance), Finding 24/45 (dead code / copy files), Finding 34 (freeze the mysql2 layer)
- **Repository rules:** `README.md`, `AGENTS.md`, `CODE_REVIEW.md` — read all three before touching code. The mysql2 layer (`app/models/` + `app/query/`) is **frozen**; bugfix-level changes only. New code belongs in the Sequelize stack.
- **CRITICAL CONTEXT — read before anything else:** Finding 20 was written against a snapshot of `app/models/selection.model.js` that **no longer exists**. The search endpoint was since migrated to Sequelize (commit `51f9db0`, Finding 1 task), and the three logic bugs described in Finding 20 are **already fixed in all active code paths**. The remaining work for this finding is: **verify the fix, remove the dead commented-out code that still contains the buggy pattern, pin the corrected semantics with regression tests, and record the status in `CODE_REVIEW.md`.** This document is primarily a **verify-and-close** task, not a rewrite task. Do not "re-fix" working code.

---

# 1. Task Title

**Verify and Close Finding 20: SQL Logic Bugs (`!= null`, Unparenthesized `OR`) in the Business Search Filter**

---

# 2. Objective

- Confirm that all three logic bugs from Finding 20 are gone from **every active code path** of the company-search feature:
    1. `!= null` used instead of `IS NOT NULL` (NULL comparisons in SQL never evaluate to TRUE).
    2. Unparenthesized `OR` in the base media conditions that broke the `AND` chain.
    3. Unparenthesized `OR` in the dynamic search branches (free-text / optional filters) that let matching rows bypass the base conditions entirely.
- Remove the **dead commented-out code blocks** in `app/models/selection.model.js` that still contain the buggy `OR users_business_medias.banner != null` pattern — they are the last surviving copies of the Finding 20 bug and a trap for future edits.
- Add explicit **regression tests** to `test/search-businesses.test.js` that pin the corrected semantics: base conditions (`isPaid = 1`, banner and logo non-empty/non-null) can never be bypassed by any search facet.
- Record the outcome as a **Status note on Finding 20 in `CODE_REVIEW.md`**, following the existing status-note style used by Findings 12, 13, and 17.
- Expected end result: the buggy pattern no longer exists anywhere in the repository (active or commented), the corrected behavior is enforced by tests, and the finding can be marked as addressed with evidence.

---

# 3. Problem / Finding

## 3.1 The three logic bugs (as documented by CODE_REVIEW.md)

**Location at review time:** `app/models/selection.model.js:122-123, 192, 207, 210` — inside `Model.getAllBySearchParameter` and its sibling queries.

**Bug (1) — `!= null` instead of `IS NOT NULL`:**

```sql
AND users_business_medias.banner != ''
OR users_business_medias.banner != null
```

In SQL, any comparison against `NULL` (`= NULL`, `!= NULL`) evaluates to **UNKNOWN**, never TRUE. The author clearly intended "banner must be non-null", but `banner != null` never filters anything — the intended condition is silently a no-op. The correct predicate is `banner IS NOT NULL`.

**Bug (2) — unparenthesized `OR` breaking the base-condition `AND` chain:** SQL operator precedence binds `AND` tighter than `OR`, so `A AND B OR C` parses as `(A AND B) OR C`. With the `OR` outside any parentheses, the base conditions (`isPaid = 1`, banner/logo checks) stopped being a mandatory chain and became just one disjunct of a flattened `OR` list.

**Bug (3) — unparenthesized `OR` in the dynamic search branches:**

```js
if (param.product_service_input) {
    query += ` OR users_business_characteristics.business_industry_belong_to LIKE '%${param.product_service_input}%'`;
}
```

Because these `OR`s were appended after the base conditions with no grouping, the effective query became:

```sql
WHERE isPaid = 1 AND banner != '' AND logo != '' AND (other filters)
   OR industry LIKE '%term%'
   OR business_name LIKE '%term%'
```

Any row matching a free-text `LIKE` branch was returned **regardless of the base conditions** — i.e. unpaid businesses and businesses without banner/logo media appeared in search results whenever a search term matched them. This directly violates the documented business rule (AGENTS.md): _"Search endpoint `getAllBySearchParameter` only returns `isPaid = 1` rows that have logo+banner media."_

## 3.2 SQL semantics primer (why the fix has exactly this shape)

An executing agent must understand these three rules to verify the fix rather than guess at it:

1. **Precedence:** `AND` binds tighter than `OR`. `x AND y OR z` ≡ `(x AND y) OR z`. Every optional `OR` branch must therefore live inside an explicit parenthesized group: `... AND (branch1 OR branch2)`.
2. **Three-valued logic:** `col != NULL` and `col = NULL` are always UNKNOWN. A row passes `WHERE` only when the whole predicate is TRUE. So `banner != null` neither admits nor excludes rows — it silently does nothing. NULL checks must use `IS NULL` / `IS NOT NULL`.
3. **MySQL nuance:** `col != ''` already excludes NULL rows (the comparison yields UNKNOWN for NULL). So `banner != '' AND banner IS NOT NULL` is redundant but **correct and harmless** — and matches the style used consistently across the fixed legacy queries. Do not "simplify" it as part of this task.

**Precision note on the CODE_REVIEW text:** the review states "`banner != null` is always true (in SQL semantics)". That is imprecise — `banner != null` is always **UNKNOWN**, never TRUE. The practical damage was real but came from a different mechanism: (a) the intended NULL filter never applied, and (b) the unparenthesized `OR` restructured the whole `WHERE` clause so trailing `LIKE` branches bypassed the base conditions (bug 3 above). This distinction matters when writing tests: the _observable_ legacy failure is "free-text matches return rows that violate base conditions", not "every row returned unconditionally". Treat this clarification as verified SQL semantics, and re-verify against your own test run.

**Warning — do not apply the review's literal suggestion:** CODE_REVIEW's Implementation step 1 proposes replacing the condition with `AND (banner != '' OR banner IS NOT NULL)`. That expression is itself wrong for the evident intent: an empty-string banner (`''`) passes `IS NOT NULL`, so the `OR` admits banner-less rows. The intent — confirmed by the fixed code and the AGENTS.md business rule — is conjunction: `banner != '' AND banner IS NOT NULL`. The correct grouping for bug 2/3 is `WHERE base_conditions AND (facet1 OR facet2 OR ...)`.

## 3.3 Verified current state (investigated against the working tree — re-verify before acting)

The vulnerable method `Model.getAllBySearchParameter` **no longer exists**. The search endpoint was migrated to the Sequelize stack (Finding 1, commit `51f9db0`):

- Route: `app/routes/index.js:151` → `searchBusinesses.findAllBySearchParameter` (Sequelize controller).
- Controller: `app/db_controllers/search-businesses.controller.js` (whitelist + `toScalar` coercion).
- Service: `app/services/business-search.service.js` — the fixed query builder.
- Legacy controller method `findAllBySearchParameter` was removed from `app/controllers/selection.controller.js`.

In the fixed Sequelize path:

- **Null semantics:** `buildBaseMediaWhere()` (`app/services/business-search.service.js:55-61`) returns `{ banner: { [Op.ne]: '', [Op.not]: null }, logo: {...} }`. Sequelize renders `[Op.not]: null` as `IS NOT NULL` — bug (1) fixed.
- **AND-chain integrity:** base media conditions live on the `users_business_medias` include `where` with `required: true` (INNER JOIN), and `where: { [Op.and]: [{ isPaid: 1 }, facetGroup] }` (`business-search.service.js:126-163, 182`) — Sequelize emits `WHERE isPaid = 1 AND (...facets...)`. Base conditions cannot be bypassed — bugs (2) and (3) fixed.
- **Facet composition is deliberately OR (union):** each active facet is OR-ed with the others inside one parenthesized group AND-ed to the base conditions. This preserves the legacy search result behavior (see the comment block at `business-search.service.js:154-159`). Whether facets _should_ be AND-composed (intersection) is a product decision, **out of scope** — see Section 15.

In the remaining legacy raw-SQL queries in `app/models/selection.model.js` (all still routed and active, but all correct):

- `getCompaniesRelatedToCurrentUser` (lines ~121-130): `WHERE isPaid = 1 AND banner != '' AND banner IS NOT NULL AND logo != '' AND logo IS NOT NULL` — fixed form.
- `getPrevFiveCompanies` / `getNextFiveCompanies` (conditions attached to the JOIN chain, ~lines 198-202 / 273-277): same fixed `AND` chain; valid inside an INNER JOIN `ON` clause.
- `getRandomCompanies` (~lines 397-399): `WHERE banner != '' AND logo != '' AND isPaid = 1` — no `!= null` bug; `!= ''` excludes NULLs implicitly (rule 3 above).

**The only surviving copies of the Finding 20 bug are dead commented-out code** in `app/models/selection.model.js`:

- Lines ~7-84: an early commented draft of `Model.getCompaniesRelatedToCurrentUser` containing `OR users_business_medias.banner != null` at lines ~23 and ~67.
- Lines ~310-359: a commented draft of `Model.getRandomCompanies` (dead code, no `!= null` occurrence, but superseded).

The former dead-copy files (`app/models/selection.model copy.js`, `selection.model copy 2.js`) that also contained the pattern were already deleted. A repo-wide sweep for `!= null` / `!= NULL` currently matches **only** the two commented lines above; the only other `OR`-in-SQL usage in the legacy layer (`app/models/get-count.model.js:29`) is already correctly parenthesized with `IS NULL`. Re-run these sweeps yourself at execution time — see Section 5.

## 3.4 Why this still needs action

1. The buggy pattern still exists in the repository (in comments) — a future "uncomment to restore" or copy-paste edit would reintroduce a production search bug. CODE_REVIEW Finding 24 already calls for dead-code removal.
2. The existing tests (`test/search-businesses.test.js`) pin the query _structure_ and OR-union semantics, but there is **no test that explicitly asserts the Finding 20 invariant** — "no search result may violate the base conditions" (e.g. free-text-only results must all be paid businesses with banner+logo).
3. `CODE_REVIEW.md` Finding 20 still reads as an open finding; the repo convention (Findings 12/13/17) is to record the verified status so future agents don't redo or undo the work.

---

# 4. Affected Functionality

**Feature:** Company search & discovery — `/selection` page → `POST /api/post/selection-search-parameter` — plus the four related carousel/list endpoints that share the same base media conditions.

**Current flow (after the Finding 1 migration):**

```text
selection.js (jQuery, public/assets/js/selection.js:1845-1863)
   ↓  POST /api/post/selection-search-parameter  (filter payload)
app/routes/index.js:151
   ↓
app/db_controllers/search-businesses.controller.js  (mapSearchParams whitelist)
   ↓
app/services/business-search.service.js
   buildBaseMediaWhere()  → banner/logo { [Op.ne]: '', [Op.not]: null } on INNER-JOINed medias
   buildSearchOptions()   → where: { [Op.and]: [ {isPaid: 1}, { [Op.or]: facets } ] }
   ↓
db.users_businesses.findAll(options)  (parameterized SQL)
   ↓
MySQL: users_businesses ⋈ users_business_characteristics ⋈ users_business_medias
   ↓
flattenSearchRows() → res.send(bare JSON array) → selection.js renders company cards
```

**Adjacent legacy endpoints using the same base-condition pattern (verify, do not redesign):**

```text
POST /api/get/get-companies-related-to-current-user   → selection.model.js getCompaniesRelatedToCurrentUser
POST /api/get/get-prev-five-companies                 → selection.model.js getPrevFiveCompanies
POST /api/get/get-next-five-companies                 → selection.model.js getNextFiveCompanies
POST /api/get/get-random-companies                    → selection.model.js getRandomCompanies
```

**Client consumer (must not break):** `public/assets/js/selection.js` — expects a bare JSON array of flat snake_case rows and renders `business_name`, `banner`, `logo`, `uuid`, etc.

---

# 5. Investigation Phase (MANDATORY — do before editing)

The repository has changed since `CODE_REVIEW.md` was written. Do not trust this document blindly either — verify each point and note discrepancies in your final report.

1. **Read `README.md`, `AGENTS.md`, `CODE_REVIEW.md`** — especially Findings 1, 20, 21, 24, 34, and the "Refactoring Principles" section. Read `docs/tasks/001-fix-sql-injection-search.md` for the history of the search migration.
2. **Inspect the current search path end to end:**
    - `app/routes/index.js:26-27, 143-151` (route wiring).
    - `app/db_controllers/search-businesses.controller.js` (whole file, 44 lines).
    - `app/services/business-search.service.js` (whole file — focus on `buildBaseMediaWhere`, `buildSearchOptions`, and the comments explaining which facets are disabled and why).
    - `test/search-businesses.test.js` (whole file — know exactly which invariants are already pinned).
3. **Inspect `app/models/selection.model.js`** — confirm:
    - No method named `getAllBySearchParameter` exists.
    - The two commented-out dead blocks (~lines 7-84 and ~310-359) and the location of the two `OR users_business_medias.banner != null` occurrences (~lines 23 and 67).
    - The four active methods use the fixed `AND` + `IS NOT NULL` form (cite exact line numbers in your report — they may have shifted).
4. **Confirm nothing references the dead blocks:** they are comments, so no `require`/call sites can exist — but confirm the _active_ methods that supersede them are the ones actually wired in `app/controllers/selection.controller.js` and `app/routes/index.js:143-149`.
5. **Sweep for the bug pattern repo-wide.** Run all of:
    ```bash
    grep -rn --include='*.js' -- '!= null\|!= NULL' app public test
    grep -rn --include='*.js' -- 'banner != null' app public test
    grep -rn --include='*.js' -- 'IS NOT NULL' app
    ```
    Expected today: the `!= null` matches are only the commented lines in `selection.model.js`; `IS NOT NULL` matches are the fixed queries; no unparenthesized `OR` conditions exist in `app/query/` or other `app/models/` files (`get-count.model.js:29` is the correctly parenthesized counter-example). Any hit outside comments must be analyzed before proceeding — if you find an active unparenthesized `OR` in a raw SQL `WHERE` chain, that is a new Finding-20-class bug: report it and fix it **only** using parenthesized grouping / `IS NOT NULL`, without changing result semantics beyond the bug itself.
6. **Inspect git history for context:** `git log --oneline -- app/models/selection.model.js` and `git show 51f9db0` (the Finding 1 migration commit) to understand what was deliberately preserved (OR facet composition) versus fixed.
7. **Confirm the DB is reachable for live tests** (`.env` present, MySQL running). Live tests in `test/search-businesses.test.js` skip gracefully when it is not — if they skip, report the skips separately per AGENTS.md and rely on the structural tests plus `npm run dev` manual verification.

> If the repository state differs from Section 3.3 in any way that affects this plan, stop and document the difference in your final report before making changes.

---

# 6. File Impact Analysis

| File                                                      | Role                                                   | Action                                                         | Reason                                                                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `app/models/selection.model.js`                           | Legacy search-adjacent queries + dead commented blocks | MODIFY (delete commented dead blocks ~lines 7-84 and ~310-359) | Last surviving copies of the Finding 20 bug pattern; dead code removal per Finding 24. Active methods must remain untouched |
| `test/search-businesses.test.js`                          | Existing search regression/security tests              | MODIFY (add Finding 20 regression tests)                       | Pin the "base conditions cannot be bypassed" invariant so the bug cannot silently return                                    |
| `CODE_REVIEW.md`                                          | Findings register                                      | MODIFY (add Status note to Finding 20)                         | Repo convention (Findings 12/13/17) — record verified state so future agents don't redo/undo the work                       |
| `app/services/business-search.service.js`                 | Fixed Sequelize query builder                          | REFERENCE ONLY (verify, do not change)                         | The corrected implementation of this finding; its comments document the deliberate OR facet composition                     |
| `app/db_controllers/search-businesses.controller.js`      | Search controller (whitelist)                          | REFERENCE ONLY                                                 | Already correct; no Finding 20 concern                                                                                      |
| `app/routes/index.js`                                     | Route wiring                                           | REFERENCE ONLY                                                 | Confirm line 151 wiring; do not modify                                                                                      |
| `app/controllers/selection.controller.js`                 | Legacy controller for the four carousel endpoints      | REFERENCE ONLY                                                 | `findAllBySearchParameter` already removed; remaining methods unrelated to this finding                                     |
| `app/models/get-count.model.js`                           | Correctly parenthesized `OR` example                   | REFERENCE ONLY                                                 | In-repo exemplar of proper grouping: `AND (banner = '' OR banner IS NULL)`                                                  |
| `app/db_models/users_business_medias.model.js`            | Sequelize media model                                  | REFERENCE ONLY                                                 | Source of `banner`/`logo` attributes used by the include where                                                              |
| `public/assets/js/selection.js`                           | Search client                                          | REFERENCE ONLY                                                 | Response-shape contract; must not change                                                                                    |
| `docs/tasks/001-fix-sql-injection-search.md`              | Sibling task (Finding 1)                               | REFERENCE ONLY                                                 | History and rationale for the current search architecture                                                                   |
| `test/` (existing reports, e.g. `019-...-Test-Result.md`) | Repo report convention                                 | REFERENCE ONLY                                                 | Where your final report should also be saved (see Section 17)                                                               |

---

# 7. Current Implementation

## 7.1 Fixed Sequelize path — `app/services/business-search.service.js`

```js
// Base (always-on) media conditions: only paid businesses that carry both
// a banner and a logo (mirrors the legacy search path).
buildBaseMediaWhere() {
    const { Op } = this;
    return {
        banner: { [Op.ne]: '', [Op.not]: null },
        logo: { [Op.ne]: '', [Op.not]: null },
    };
}
```

Sequelize renders the include `where` as `banner != '' AND banner IS NOT NULL AND logo != '' AND logo IS NOT NULL` — correct null semantics (bug 1) and correct AND chaining (bug 2).

```js
// buildSearchOptions — facet composition
const whereAnd = [{ isPaid: 1 }];
// ... facets pushed (free-text, minor sub-category, city) ...
if (facets.length > 0) {
    whereAnd.push({ [Op.or]: facets });
}
// ...
where: { [Op.and]: whereAnd },   // line 182
```

The emitted SQL is `WHERE users_businesses.isPaid = 1 AND (facet1 OR facet2 OR ...)` — the OR group is parenthesized and nested inside the AND chain, so no facet branch can bypass the base conditions (bug 3). Note the service comments: the remaining filters (`trade_categories`, `business_scale`, `sub_categories`, `regionOfOperationCode`, `countryCode`, `selectionState`, `language`) are **intentionally disabled** to preserve current search results; that decision belongs to Finding 1 and must not be revisited here.

## 7.2 Fixed legacy raw-SQL path — `app/models/selection.model.js` (active methods)

```sql
-- getCompaniesRelatedToCurrentUser (~lines 121-130), representative of all four methods
WHERE users_businesses.isPaid = 1
AND users_business_medias.banner != ''
AND users_business_medias.banner IS NOT NULL
AND users_business_medias.logo != ''
AND users_business_medias.logo IS NOT NULL
```

`getPrevFiveCompanies` / `getNextFiveCompanies` attach the same conditions to the INNER JOIN `ON` chain (valid SQL, equivalent filtering for INNER JOINs). `getRandomCompanies` uses `banner != '' AND logo != '' AND isPaid = 1` (NULLs excluded implicitly by `!= ''`). **None of these are to be modified.**

## 7.3 The remaining bug copies — dead commented blocks in `app/models/selection.model.js`

```js
// Lines ~7-84: commented-out early draft of getCompaniesRelatedToCurrentUser, containing:
//                 AND users_business_medias.banner != ''
//                 OR users_business_medias.banner != null`,
// (and the same OR-without-parens pattern again at ~line 66-67)
//
// Lines ~310-359: commented-out early draft of getRandomCompanies (dead, superseded)
```

> The coding agent must inspect these blocks in the working tree before deleting them, and must confirm the two `!= null` occurrences live only inside comments.

---

# 8. Current → Target

## Current

```text
Active search path  : Sequelize, correctly grouped — WHERE isPaid = 1 AND (facets OR-group),
                      media conditions AND-chained with IS NOT NULL on an INNER JOIN. FIXED.
Legacy raw-SQL path : four active methods, correctly AND-chained. FIXED.
Dead commented code : selection.model.js still carries the buggy
                      "banner != '' OR banner != null" pattern in two commented blocks.
Tests               : structure + OR-union semantics pinned; no explicit test that search
                      results may never violate base conditions.
CODE_REVIEW.md      : Finding 20 reads as open/unresolved.
```

## Target

```text
Same active code paths (unchanged).
selection.model.js   : dead commented blocks deleted; the buggy pattern no longer exists
                      anywhere in the repository (active or commented).
Tests               : Finding 20 regression tests added — every row returned by any search
                      facet (incl. free-text only) satisfies isPaid/banner/logo base
                      conditions; user facets can never land in the medias include where.
CODE_REVIEW.md      : Finding 20 carries a Status note documenting the verification and
                      the dead-code cleanup, in the style of Findings 12/13/17.
```

## Before / after

```js
// CURRENT (commented dead code, selection.model.js ~line 22-23 — to be DELETED, not fixed)
// WHERE users_business_characteristics.business_major_category = '${tradeCategoryId}'
// AND users_businesses.country_of_operation = '${param.country}'
// AND users_business_medias.banner != ''
// OR users_business_medias.banner != null

// TARGET (already live in the Sequelize path — keep as-is; shown here as the reference pattern)
// app/services/business-search.service.js
buildBaseMediaWhere() {
    return {
        banner: { [Op.ne]: '', [Op.not]: null },   // renders: banner != '' AND banner IS NOT NULL
        logo: { [Op.ne]: '', [Op.not]: null },
    };
}
// ...
where: { [Op.and]: [{ isPaid: 1 }, { [Op.or]: facets }] },  // renders: isPaid = 1 AND (facet1 OR ...)
```

```sql
-- If (and only if) an unparenthesized OR is ever found in ACTIVE raw SQL during the sweep,
-- the fix shape is grouping, not deletion of conditions:
-- CURRENT:  WHERE isPaid = 1 AND banner != '' OR industry LIKE '%x%'
-- TARGET:   WHERE isPaid = 1 AND banner != '' AND (industry LIKE '%x%')
--           (and `col != null` → `col IS NOT NULL`)
```

> Use this as the intended pattern. Inspect the existing architecture and adapt the implementation accordingly. Do not rewrite already-correct code to match examples.

---

# 9. Detailed Implementation Plan

## Step 1 — Inspect existing implementation

Complete the Section 5 investigation. Record the exact current line numbers of: the two dead comment blocks in `selection.model.js`, the `buildBaseMediaWhere` / `buildSearchOptions` definitions, and the route wiring line.

## Step 2 — Identify all affected inputs and code paths

There is no new input handling in this task. The affected _surfaces_ are: the search facet payload keys whitelisted in `SEARCH_PARAM_KEYS` (`search-businesses.controller.js:10-22`), and every SQL `WHERE` chain in the legacy layer. Your sweep (Section 5.5) is the authoritative input for "where could this bug class still live".

## Step 3 — Inspect existing project patterns

- Correct parenthesized OR in raw SQL: `app/models/get-count.model.js:29`.
- Correct NULL-safe AND chains: the four active methods in `app/models/selection.model.js`.
- Correct Sequelize composition: `app/services/business-search.service.js`.
- Test style: `node:test` + `assert`, live-DB tests that skip gracefully via `t.diagnostic` (`test/search-businesses.test.js:195-199`).
- Status-note style in `CODE_REVIEW.md`: Findings 12, 13, 17.

## Step 4 — Delete the dead commented blocks

In `app/models/selection.model.js`, remove the two commented-out dead blocks (~lines 7-84 and ~310-359). Do not touch any active method, the file header comment, or the commented `require` on line 2 unless it sits inside a deleted block. After deletion the file must contain exactly the four active model methods. This is a comment-only change — no runtime behavior can change. Confirm with `node -e "require('./app/models/selection.model.js')"` (from repo root) that the module still loads.

## Step 5 — Add Finding 20 regression tests

In `test/search-businesses.test.js`, add (following the existing test style and helper functions `runLive`, `collectValues`):

1. **Structural test — facets can never relax the media base conditions:** build options with facet params (e.g. `product_service_input`, `minor_sub_categories`, `selectionCity`) and assert the `business_medias` include `where` deep-equals the base media object `{ banner: {[Op.ne]: '', [Op.not]: null}, logo: {...} }` and `required === true` — i.e. user input never lands on the include where, and the base conditions remain exactly the fixed form.
2. **Structural test — every facet lives inside the parent AND group:** assert `options.where[Op.and][0]` deep-equals `{ isPaid: 1 }` and that no facet object appears outside the `[Op.or]` group (extends the existing `'facets are OR-composed under the base conditions'` test by covering the free-text-only case explicitly).
3. **Live test — base conditions hold on free-text-only results:** run a free-text-only search (reuse the seeded `'All World'` term pattern from the existing OR-semantics test); for every returned row assert `row.banner` and `row.logo` are non-empty strings (this is the direct Finding 20 regression — the legacy bug returned unpaid/media-less businesses on free-text matches). Skip gracefully with `t.diagnostic` when the DB is unavailable, and note the skip in your report. If the local DB has no matching rows, assert the empty-array contract and state in the report that the row-level assertions could not be exercised.

Run: `npm test` (`node --test`). All existing tests must still pass unchanged; report any pre-existing failures separately instead of "fixing" them.

## Step 6 — Record the status in CODE_REVIEW.md

Add a short `**Status:**` note to Finding 20 (do not delete the original finding text), mirroring the style of Findings 12/13/17. State: base conditions and OR grouping verified correct in the Sequelize search path (`app/services/business-search.service.js`) and the four legacy selection queries; the buggy pattern's last copies (dead commented blocks in `selection.model.js`) removed; regression tests added in `test/search-businesses.test.js`; note that OR-facet (union) composition is the deliberately preserved legacy behavior and any change to AND (intersection) semantics is a separate product decision.

## Step 7 — Review the implementation

- `git diff` review: the diff must show only comment deletions in `selection.model.js`, test additions, and the `CODE_REVIEW.md` status note.
- Re-run the Section 5.5 sweeps: `!= null` must return **zero matches** repo-wide (excluding `node_modules`).
- `npm test` green (or skips reported). `npm run lint` (Prettier `--write`) run and any resulting formatting of your edited files included in the diff.
- Boot `npm run dev` and manually exercise the `/selection` page: run a search with a keyword, and confirm the related-company carousel endpoints still respond (they use the untouched legacy methods).

---

# 10. Architecture and Existing Patterns

- This task deliberately performs **no new architecture**. The fix already lives in the Sequelize stack (`app/services/business-search.service.js` + `app/db_controllers/`), which is the project's target DAL per AGENTS.md and Finding 34.
- The legacy mysql2 selection queries stay exactly as they are (frozen layer; they are already correct).
- Tests follow the existing `node:test` conventions of `test/search-businesses.test.js` — no new test framework, no new dependencies.
- The `CODE_REVIEW.md` status note follows the existing convention of Findings 12/13/17.

> Do not introduce a new dependency, framework, architecture, or design pattern when an appropriate existing project pattern already exists.

---

# 11. Security Requirements

Finding 20 is a _correctness_ bug, but it shares its code path with the SQL-injection surface fixed in Finding 1, and its impact is a **visibility-rule bypass** (unpaid / media-less businesses exposed in search — the same data-exposure class as the documented business rules):

- Do not alter any parameterization achieved by Finding 1: user values stay inside `Op.*` objects or `?` placeholders — never inside SQL string literals. This task adds no SQL.
- Never reintroduce `!= null` / `= null` comparisons in SQL. NULL checks use `IS NULL` / `IS NOT NULL` (raw) or `[Op.not]: null` / `[Op.is]: null` (Sequelize).
- Never emit an `OR` condition outside an explicit parenthesized group in a raw SQL `WHERE` chain; in Sequelize, `OR` groups must be nested inside the `where`/`[Op.and]` structure.
- Base visibility rules (`isPaid = 1`, banner and logo present) must remain impossible to bypass via any request payload — that is precisely what the new regression tests must prove.
- Do not log `req.body` or query parameters while testing (the legacy model's `console.log('getCompaniesRelatedToCurrentUser param :', param)` is pre-existing, out of scope here — leave it, but do not add new logging).
- While sweeping, if you find an _active_ unparenthesized `OR` in raw SQL anywhere in `app/models/` or `app/query/`, treat it as a Finding-20-class bug: analyze its blast radius (which base conditions can be bypassed, which endpoint is affected), fix with grouping, and report it — do not silently widen the fix beyond the search path.

---

# 12. Backward Compatibility

The task must be behavior-preserving by construction:

- **No active query changes.** Deleting commented-out code and adding tests cannot change runtime behavior — verify that claim in the report (module still loads, route table untouched).
- **Response contract:** bare JSON array of flat snake_case rows — unchanged.
- **Search semantics:** OR-facet (union) composition, disabled-filter set, free-text tokenization (`#` stripping, whitespace/comma split) — all unchanged. These are deliberate Finding 1 decisions.
- **Carousel endpoints** (`get-companies-related-to-current-user`, `get-prev/next-five-companies`, `get-random-companies`) — untouched.
- **UI:** no EJS/view/CSS/JS changes.
- The `CODE_REVIEW.md` note must not delete or contradict the original finding text — status notes only.

---

# 13. Testing Strategy

### Normal Case

- `npm test` — all existing search tests pass (structure, whitelist, flattening, live DB).
- Live: `POST /api/post/selection-search-parameter` with `{ product_service_input: 'coffee' }` (or a term known to match local data) → array of rows; every row has non-empty `banner` and `logo` (the Finding 20 invariant).

### Empty / Missing Input

- `{}` → base-conditions-only results (possibly empty array, never `null`, never an error).
- Free-text term that matches nothing → `[]`.

### Boundary Cases

- Terms with `#` (`'#co#ffee'`) → tokenized exactly like legacy (existing test covers; must remain green).
- Single-character and very long terms; numeric strings (`minor_sub_categories: '148'`).

### Invalid Input

- Non-scalar facet values (arrays, objects incl. `{ [Op.gt]: 1 }`) → dropped by `toScalar` (existing test must remain green).

### Security Cases

- The Finding 1 injection battery in `test/search-businesses.test.js:244-273` must remain green (this guarantees the logic fix did not regress the injection fix — they share the same query builder).
- **Finding 20 case specifically:** a payload consisting only of a broad free-text term must not surface rows lacking `banner`/`logo` or with `isPaid != 1` — asserted by the new live regression test.

### Regression Testing

- All other test files under `test/` still pass (`node --test` runs the whole suite).
- Manual: `/selection` page loads; search works; the related-companies carousel (`get-companies-related-to-current-user`, `get-random-companies`) still returns rows.
- `node -e "require('./app/models/selection.model.js')"` after the comment deletion.

---

# 14. Verification / Evidence

The coding agent must provide concrete evidence, not a bare "fixed/verified":

- **Sweep output:** the grep commands from Section 5.5 run before and after — after the change, `!= null` matches zero files repo-wide.
- **Code paths:** cite `business-search.service.js` lines showing `buildBaseMediaWhere` and the `where: { [Op.and]: ... }` composition; cite the four legacy method line ranges showing the fixed `AND` chains.
- **Tests:** full `npm test` output with pass/skip counts; skips listed separately with reasons (DB unavailable etc.).
- **Runtime:** `npm run dev` boot log + one manual search request/response (status, shape, sample row with banner/logo).
- **Diff:** final `git diff` containing only the three intended file changes.
- **Status note:** the exact text added to Finding 20 in `CODE_REVIEW.md`.
- **Similar-pattern sweep:** the Section 5.5 grep results for `app/models/` + `app/query/`, confirming no other unparenthesized `OR` in raw SQL (call out `get-count.model.js:29` as the verified-correct counter-example).

---

# 15. Do NOT Do

- Do not modify `app/services/business-search.service.js`, `app/db_controllers/search-businesses.controller.js`, `app/routes/index.js`, or any active method of `app/models/selection.model.js` — they already implement this finding correctly.
- Do not change the OR-facet (union) composition to AND (intersection), and do not re-enable the intentionally disabled filters (`trade_categories`, `business_scale`, `countryCode`, etc.) — those are documented Finding 1 decisions; changing them alters production search results and requires a separate approved task.
- Do not apply CODE_REVIEW's literal suggestion `AND (banner != '' OR banner IS NOT NULL)` — it admits empty-string banners and reintroduces the bug class (see Section 3.2 warning).
- Do not "simplify" `banner != '' AND banner IS NOT NULL` to one condition — behavior-preserving tasks keep the established form.
- Do not touch Finding 21 concerns (`ORDER BY RAND()` in `getRandomCompanies`) — separate task.
- Do not modify unrelated functionality, the database schema, API contracts, `.env`, or environment secrets.
- Do not remove or skip failing tests to make the suite green; report pre-existing failures.
- Do not delete the original Finding 20 text in `CODE_REVIEW.md` — add a status note only.
- Do not leave the `console.log` in legacy selection methods as "drive-by" scope creep — it is out of scope here (noted as remaining risk instead).

---

# 16. Acceptance Criteria

## Acceptance Criteria

- [ ] All three Finding 20 sub-bugs verified absent from every **active** code path (Sequelize search + four legacy selection queries), with line-cited evidence.
- [ ] Dead commented blocks containing `OR users_business_medias.banner != null` deleted from `app/models/selection.model.js`; repo-wide `!= null` sweep returns zero matches.
- [ ] No active code path behavior changed (comment-only deletion + tests + doc note; module loads; route table untouched).
- [ ] New regression tests added and passing: (1) medias include `where` remains exactly the base conditions under any facet payload, (2) facets stay inside the parent `OR` group AND-ed after `{ isPaid: 1 }`, (3) live free-text-only results all satisfy banner/logo base conditions.
- [ ] Existing `test/search-businesses.test.js` tests (structure, injection battery, OR-union semantics) remain green; skips reported separately.
- [ ] Similar-pattern audit of `app/models/` + `app/query/` completed and documented (no other unparenthesized `OR` in raw SQL, or findings reported).
- [ ] Status note added to Finding 20 in `CODE_REVIEW.md` following the Findings 12/13/17 convention.
- [ ] `npm test` and `npm run lint` run; manual `/selection` verification performed via `npm run dev`.
- [ ] No unrelated files modified; final diff reviewed.
- [ ] Remaining risks documented (e.g. OR-vs-AND facet semantics as an open product decision, live-DB test skips).

---

# 17. Expected Final Report

Finish with this structure, and — following the repo convention visible in `test/` (e.g. `test/019-...-Test-Result.md`) — also save the report as `test/020-SQL-Logic-Bug-in-Search-Filter-Test-Result.md`:

```markdown
# Implementation Report

## Summary

Brief explanation of what was verified, cleaned up, and pinned.

## Files Modified

| File                             | Changes                                                         |
| -------------------------------- | --------------------------------------------------------------- |
| `app/models/selection.model.js`  | Deleted dead commented blocks containing the Finding 20 pattern |
| `test/search-businesses.test.js` | Added Finding 20 regression tests                               |
| `CODE_REVIEW.md`                 | Added Status note to Finding 20                                 |

## Files Added

| File                                                     | Purpose                       |
| -------------------------------------------------------- | ----------------------------- |
| `test/020-SQL-Logic-Bug-in-Search-Filter-Test-Result.md` | This report (repo convention) |

## Files Deleted

| File                                        | Reason |
| ------------------------------------------- | ------ |
| (none expected — blocks deleted, not files) | ...    |

## Files Referenced Only

| File                                      | Why                                           |
| ----------------------------------------- | --------------------------------------------- |
| `app/services/business-search.service.js` | Verified-fixed implementation of this finding |
| ...                                       | ...                                           |

## Implementation Details

Explain the verification evidence (line citations) and the test invariants added.

## Testing

| Test                                                              | Result         |
| ----------------------------------------------------------------- | -------------- |
| Normal case (search returns rows)                                 | PASS/FAIL/SKIP |
| Empty / missing input                                             | PASS/FAIL/SKIP |
| Boundary cases                                                    | PASS/FAIL/SKIP |
| Finding 20 regression (base conditions hold on free-text results) | PASS/FAIL/SKIP |
| Security cases (injection battery)                                | PASS/FAIL/SKIP |
| Regression test (full `node --test` suite)                        | PASS/FAIL/SKIP |

## Verification

How the original issue was verified as resolved (sweep outputs, test output, manual run, diff review).

## Remaining Risks

List anything that could not be verified (DB skips, OR-vs-AND facet semantics as an open product decision, pre-existing failures).

## Final Status

PASS / NEEDS REVIEW
```

---

# 18. Important Rules for Generating the Task Document

### Rule 1 — Do not hallucinate

Every repository fact in Sections 3.3, 4, 6, and 7 was verified against the working tree (file reads, greps, git history at commit `51f9db0`). Facts that could shift before execution are marked with approximate line numbers and re-verification instructions. Anything the executing agent cannot reproduce must be reported as a discrepancy, not assumed.

### Rule 2 — Separate facts from recommendations

- `CURRENT IMPLEMENTATION` = verified state of the working tree (Sequelize search path with grouped conditions; fixed legacy queries; buggy pattern surviving only in dead comments).
- `RECOMMENDED` = the verify-and-close plan in Sections 9 and 16.
- The CODE_REVIEW snapshot (including its imprecise "always true" phrasing and its flawed literal replacement suggestion) is quoted as history, clearly separated from verified SQL semantics.

### Rule 3 — Prefer project consistency

No new patterns are introduced: Sequelize stack untouched, `node:test` conventions followed, `CODE_REVIEW.md` status-note convention followed, mysql2 layer frozen.

### Rule 4 — Preserve behavior

This task is behavior-preserving by construction (comment deletion, tests, documentation). Sections 12 and 15 enumerate the contracts that must not move.

### Rule 5 — Think about the entire code path

Section 4 traces client → route → controller → service → model → database → response for both the migrated search path and the four adjacent legacy endpoints that share the base-condition pattern.

### Rule 6 — Make the task executable

WHAT (verify fix, delete dead code, add regression tests, record status), WHERE (Section 6 table), WHY (Section 3), HOW (Section 9), WHAT NOT (Section 15), HOW TO TEST (Section 13), HOW TO VERIFY (Section 14).
