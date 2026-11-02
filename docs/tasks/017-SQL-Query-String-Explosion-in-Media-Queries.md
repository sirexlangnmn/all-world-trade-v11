# Verify and Harden the Parameterized Business Media Query Builders

## 1. Task Title

# Verify and Harden the Replacement for SQL Query String Explosion in Media Queries

## 2. Objective

Confirm that the historical combinatorial explosion of `INSERT` and `UPDATE` statements for `users_business_medias` has been fully replaced by a small, safe query-builder surface, and close any remaining test or hardening gaps.

The expected end result is:

- No per-media-combination `INSERT`/`UPDATE` constants remain in active use.
- Every SQL identifier is constrained by a fixed, reviewed allowlist.
- Every SQL value is bound through mysql2 `?` placeholders.
- Route-specific `UPDATE` behavior still updates only the intended media columns.
- Existing upload URLs, multipart fields, UUID sources, success responses, and persistence behavior remain unchanged.
- Automated tests prove both normal behavior and hostile-input rejection.

This is a **verification-first** task. `CODE_REVIEW.md` currently states that Finding 17 has already been addressed by `buildInsert` and `buildUpdate`. Do **not** rewrite the implementation from scratch. First verify the current state, then make only the smallest repair or test addition supported by evidence.

## 3. Problem / Finding

**Finding:** Finding 17 — SQL Query String Explosion in Media Queries  
**Primary location:** `app/query/users_business_medias.query.js`

The historical problem was that business media persistence used many hard-coded SQL constants, one for each combination of logo, banner, video, brochure, webinar, and related metadata fields. Adding or changing a media field required maintaining many near-identical SQL strings. That design increased the chance of inconsistent column lists, incorrect value ordering, and future injection mistakes if values were ever interpolated.

`CODE_REVIEW.md` records the current status as fixed:

> The per-combination SQL constants have been replaced by `buildInsert` and `buildUpdate`. Both helpers accept only fixed media-table columns and bind every value through mysql2 placeholders. The route configuration and tests cover INSERT and UPDATE generation, including rejection of request-controlled column names.

`CODE_REVIEW.md` also records this remaining risk:

> This remains a narrow compatibility helper on the legacy mysql2 stack. Keep identifiers constrained by the explicit allowlist, and preserve the route-specific set of columns on UPDATE so omitted media fields remain unchanged.

The work therefore is not a greenfield feature. The work is to prove that the replacement is still correct in the live codebase, that no old variant has returned, and that tests cover the security boundary rather than only one happy path.

### Security relevance

- Dynamic SQL identifiers must never come from `req.body`, `req.files`, filenames, route parameters, or any other request-controlled source.
- SQL values must never be concatenated or interpolated into the query string.
- Unknown or mixed-case column names must be rejected before a query is executed.
- Route-specific update semantics must not accidentally clear columns that were not part of the request.

### Related but out of scope

`app/models/users-business-medias.model.js` contains legacy read queries that still build SQL with string interpolation. Do not silently fold that separate issue into this task. Investigate it, avoid expanding its usage, and report it for a separate finding if it is still present.

## 4. Affected Functionality

The media query builder supports these workflows:

- Business registration with media uploads.
- Upgrade flows that add or replace business media.
- Standalone logo, banner, video, brochure, webinar, and thumbnail uploads.
- The banner profile upsert workflow.
- Registration without files via `/api/post/registration-no-upload`.

Current general flow:

```text
Browser multipart request
   ↓
Existing /api/post/... upload URL
   ↓
app/middleware/business-media-upload.middleware.js
   ↓
Route configuration in app/utils/business-media-upload-config.js
   ↓
mapBusinessMedia resolves fixed multipart fields to fixed media columns
   ↓
buildInsert / buildUpdate generate SQL with an allowlisted column list and ? placeholders
   ↓
app/utils/business-media-persistence.js executes db.query(query, values, callback)
   ↓
users_business_medias
   ↓
Existing success response or sanitized persistence failure
```

The coding agent must inspect the actual route configuration and middleware before relying on this diagram. Some routes have distinct UUID sources, success text, or read-before-write behavior.

## 5. Investigation Phase

Complete this investigation before editing anything:

1. Read `README.md`, `AGENTS.md`, and `CODE_REVIEW.md`, especially Findings 12, 13, 17, 34, 52, and 53 plus the incremental refactoring principles.
2. Read `app/query/users_business_medias.query.js` completely. Inventory every export:
   - `SELECT_ROW`
   - `MEDIA_COLUMN_ALLOWLIST`
   - `getAllowedColumns`
   - `buildInsert`
   - `buildUpdate`
3. Search the repository for all references to `users_business_medias.query.js`, `buildInsert`, `buildUpdate`, `SELECT_ROW`, and `MEDIA_COLUMN_ALLOWLIST`.
4. Read `app/routes/upload-file.js` and confirm every call site:
   - Registration uploads use `buildInsert`.
   - Upgrade uploads use `buildUpdate` with the correct UUID.
   - Standalone insert routes use `buildInsert`.
   - Standalone update routes use `buildUpdate`.
   - The banner route retains its SELECT-then-UPDATE-or-INSERT upsert.
   - `/api/post/registration-no-upload` uses `buildInsert` and does not accept files.
5. Read `app/utils/business-media-upload-config.js` and verify:
   - `MEDIA_GROUPS` and `STANDALONE_MEDIA_GROUPS` map request fields to fixed column names.
   - No configuration value derives a database column from arbitrary request data.
   - Each route preserves its existing multipart field allowlist.
6. Read `app/utils/business-media-persistence.js` and confirm it only transports the already-built query and values, and that its Finding 52 cleanup behavior remains intact.
7. Read `test/013-business-media-route-config.test.js` and `test/052-business-media-db-failure.test.js`. Identify which builder properties are already covered and which are missing.
8. Search for old per-combination SQL constants or dead variants under `app/query/`, `app/models/`, `app/controllers/`, and `app/db_controllers/`. Treat commented-out or ` copy` files separately from active runtime code.
9. Inspect `app/db_models/users_business_medias.model.js` only to understand whether a future Sequelize migration is possible. Do not migrate this path as part of Finding 17. `CODE_REVIEW.md` notes that the Sequelize model does not define the `video` attribute used by standalone video uploads.
10. Confirm the current Git worktree state before editing. This repository may contain unrelated in-progress changes. Preserve them.
11. Resolve any uncertainty as `TO INVESTIGATE`. Do not invent call sites, schema columns, or tests.

Suggested searches:

```text
grep -R "users_business_medias.query" app test
grep -R "buildInsert\|buildUpdate" app test
grep -R "INSERT INTO users_business_medias" app test
grep -R "UPDATE users_business_medias" app test
grep -R "MEDIA_COLUMN_ALLOWLIST" app test
```

## 6. File Impact Analysis

| File | Role | Action | Reason |
|---|---|---|---|
| `app/query/users_business_medias.query.js` | Allowlist, INSERT builder, UPDATE builder, SELECT constant | REFERENCE ONLY; MODIFY only for a verified defect | Current implementation is the subject of this finding. Do not rewrite it without evidence. |
| `app/routes/upload-file.js` | Current call sites for insert, update, upsert, and no-upload registration | REFERENCE ONLY; MODIFY only if a call site violates the builder contract | Preserve existing routes, UUID sources, responses, and upload behavior. |
| `app/utils/business-media-upload-config.js` | Field-to-column mapping and route configuration | REFERENCE ONLY | Confirms only fixed fields become column values; not part of the SQL builder fix. |
| `app/utils/business-media-persistence.js` | Executes parameterized query and handles failures | REFERENCE ONLY | Preserve Finding 52 cleanup and sanitized error behavior. |
| `test/013-business-media-route-config.test.js` | Route configuration and builder tests | MODIFY / ADD | Add missing builder edge-case and hostile-input coverage if absent. |
| `test/052-business-media-db-failure.test.js` | Persistence failure tests | REFERENCE ONLY | Must remain green; do not remove structural assertions merely to simplify. |
| `app/models/users-business-medias.model.js` | Legacy media read queries | INVESTIGATE; do not modify in this task | May contain related unsafe interpolation, but it is a separate finding. |
| `app/db_models/users_business_medias.model.js` | Sequelize model for media columns | REFERENCE ONLY | Relevant only to a future, separately approved migration. |
| `README.md` / `CODE_REVIEW.md` | Architecture and finding status documentation | REFERENCE ONLY | Use as guidance; update only if this task changes documented behavior. |

Use `DELETE` only if repository-wide search proves an old query constant has no runtime references and a test confirms the replacement. Do not delete code speculatively.

## 7. Current Implementation

### Verified current facts

`app/query/users_business_medias.query.js` currently exports:

- `SELECT_ROW: 'SELECT * FROM users_business_medias WHERE uuid = ?'`
- `MEDIA_COLUMN_ALLOWLIST`, a `Set` of fixed media columns and `uuid` / `date_created`
- `getAllowedColumns(values)`, which rejects empty objects and any column outside the allowlist
- `buildInsert(values)`, which builds an `INSERT ... (columns) VALUES (?, ...)` query
- `buildUpdate(values, uuid)`, which removes `uuid` from the `SET` list and appends the UUID as the final predicate value

Current builder shape:

```js
function getAllowedColumns(values) {
    const columns = Object.keys(values);
    if (columns.length === 0 || columns.some((column) => !MEDIA_COLUMN_ALLOWLIST.has(column))) {
        throw new Error('Invalid business media columns.');
    }
    return columns;
}

function buildInsert(values) {
    const columns = getAllowedColumns(values);
    return {
        query: `INSERT INTO users_business_medias (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
        values: columns.map((column) => values[column]),
    };
}

function buildUpdate(values, uuid) {
    const columns = getAllowedColumns(values).filter((column) => column !== 'uuid');
    if (columns.length === 0) {
        throw new Error('At least one business media column must be updated.');
    }
    return {
        query: `UPDATE users_business_medias SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE uuid = ?`,
        values: [...columns.map((column) => values[column]), uuid],
    };
}
```

`app/routes/upload-file.js` currently uses these builders for registration, upgrade, standalone insert, standalone update, banner upsert, and `/api/post/registration-no-upload`.

`test/013-business-media-route-config.test.js` currently verifies:

- The expected media route combinations are registered.
- Browser-used registration and upgrade URLs still exist.
- Standalone route field policies and persistence semantics are preserved.
- `buildInsert` and `buildUpdate` produce placeholder-based SQL.
- A request-controlled column key such as `'logo, status'` is rejected.
- An empty `buildUpdate` payload is rejected.
- The shared upload handler preserves success responses and the update UUID predicate.

`test/052-business-media-db-failure.test.js` currently verifies persistence failure cleanup and sanitized failures.

### Important facts to verify during implementation

- Whether any old per-combination `INSERT` or `UPDATE` constants remain referenced anywhere in runtime code.
- Whether any route passes a request-controlled object directly to `buildInsert`/`buildUpdate` without going through `mapBusinessMedia`.
- Whether every `UPDATE` path intentionally includes `date_created` and whether omitting media fields still leaves those fields unchanged.
- Whether the banner upsert still performs its SELECT before deciding between UPDATE and INSERT.
- Whether any builder input can produce an empty column list, duplicate columns, or undefined SQL identifiers.
- Whether tests cover malicious values as well as malicious keys.

Do not treat the current implementation as perfect merely because it uses placeholders. Verify the whole input path.

## 8. Current → Target

### Historical / problem state

```text
Media field combinations
   ↓
Many hand-maintained INSERT/UPDATE SQL constants
   ↓
High duplication, inconsistent column lists, growing maintenance surface
```

### Current verified state

```text
Fixed media route configuration
   ↓
mapBusinessMedia maps request fields to known column names
   ↓
buildInsert / buildUpdate validate column names against an allowlist
   ↓
Values are bound with ? placeholders
   ↓
mysql2 executes the query
```

### Target verified state

```text
Same as current, plus:
   ↓
Proof that no old variants remain active
   ↓
Tests for each builder security boundary
   ↓
No unintended changes to routes, responses, UUID handling, or UPDATE semantics
```

There is no requirement to introduce a new query abstraction, ORM migration, or repository layer. The current builder is the intended narrow compatibility helper. Only modify it if investigation finds an actual defect.

## 9. Detailed Implementation Plan

### Step 1 — Establish a baseline

1. Inspect `git status` and `git diff` before making changes.
2. Run the targeted tests:

```bash
node --test test/013-business-media-route-config.test.js test/052-business-media-db-failure.test.js
```

3. Record the baseline result. If tests already fail for unrelated reasons, do not hide that fact; report it.

### Step 2 — Inventory all builder callers

Search the repository for all references to the query module and builder functions. Build a table for your own work:

| Caller | Operation | Input source | UUID source | Expected result |
|---|---|---|---|---|
| `app/routes/upload-file.js` registration handler | INSERT | `mapBusinessMedia` | route config / body | New media row |
| Upgrade handler | UPDATE | `mapBusinessMedia` | `req.body.uuid` | Only configured columns updated |
| Standalone insert routes | INSERT | `mapBusinessMedia` | body/session | New media row |
| Standalone update routes | UPDATE | `mapBusinessMedia` | body/session | Only configured columns updated |
| Banner upsert | SELECT then UPDATE or INSERT | `mapBusinessMedia` banner only | session | Preserve existing row |
| `/api/post/registration-no-upload` | INSERT | fixed `uuid` + `date_created` | body | Minimal media row |

Confirm the table against the actual code. Do not add rows based only on this document.

### Step 3 — Verify allowlist containment

Inspect `MEDIA_COLUMN_ALLOWLIST` against the actual database columns and Sequelize model. Confirm:

- Every column used by `business-media-upload-config.js` is present.
- No column needed by an active route is missing.
- No request field name is accepted as a column name unless it is also a real media column.
- `uuid` and `date_created` behavior matches existing persistence expectations.

Do not add new columns merely for convenience. If a column truly must change, verify the schema and route contract first and document why.

### Step 4 — Verify INSERT behavior

For `buildInsert`:

- The column order must match the value order.
- Every value must be represented by `?`.
- Unknown keys must throw before a query is built.
- An empty object must throw.
- `uuid` and `date_created` must continue to be inserted where current routes need them.
- Values must never be interpolated into the SQL text.

### Step 5 — Verify UPDATE behavior

For `buildUpdate`:

- `uuid` in the values object must not be emitted in the `SET` clause.
- The UUID must be the final predicate parameter.
- Passing only `uuid` must throw because there is nothing to update.
- Omitted media columns must remain untouched.
- `date_created` behavior must match the current route behavior; do not remove it unless the code and tests prove it is safe.
- The update path must not clear columns that the original route did not intend to change.

### Step 6 — Verify route call sites

Confirm that all dynamic column names originate from configuration helpers, not from arbitrary request keys. Specifically check:

- `mapBusinessMedia` constructs a new object with known attributes.
- Route handlers do not spread `req.body` or `req.files` into the builder.
- The banner upsert still uses `mapBusinessMedia(req, ['banner'], originalUuid)`.
- The no-upload registration route builds only fixed keys.
- Error behavior on a rejected builder input is handled without executing SQL.

### Step 7 — Add only missing tests

If existing tests already cover a behavior, do not duplicate it. Add tests only for uncovered security or correctness gaps, for example:

- Every allowlisted column is accepted and preserves value order.
- Unknown column names are rejected, including comma injection, whitespace tricks, and mixed-case variants.
- `buildUpdate` removes `uuid` from `SET` and uses it only in the predicate.
- `buildUpdate` rejects an empty payload and a payload containing only `uuid`.
- Malicious values such as `"' OR 1=1 --"` remain bound values and do not appear in the query text.
- Values containing commas, quotes, semicolons, and Unicode are passed through as data.
- Existing route-configuration and persistence-failure tests still pass.

Use `node:test` and `node:assert/strict`, consistent with the existing tests. Do not add a new test framework.

Example security assertion:

```js
const payload = {
    logo: "logo.png' OR 1=1 --",
    uuid: 'business-uuid',
};

const insert = USERS_BUSINESS_MEDIAS.buildInsert(payload);

assert.equal(insert.query, 'INSERT INTO users_business_medias (logo, uuid) VALUES (?, ?)');
assert.deepEqual(insert.values, [payload.logo, payload.uuid]);
assert.doesNotMatch(insert.query, /OR 1=1/);
```

Adapt names and assertions to the actual allowlist order. Do not invent columns that are not in the current file.

### Step 8 — Run regression tests

Run the targeted tests again, then the full test command if the environment supports it:

```bash
node --test test/013-business-media-route-config.test.js test/052-business-media-db-failure.test.js
npm test
```

Some integration tests may require the configured database. Report skips separately from passes. Do not claim a database-backed test passed if it was skipped.

### Step 9 — Review the final diff

Before declaring completion:

- Confirm only intended files changed.
- Confirm no endpoint URL, multipart field, success response, UUID source, or upload policy changed.
- Confirm no old SQL variant was reintroduced.
- Confirm no SQL value is interpolated.
- Confirm tests assert behavior, not just source-file text where runtime behavior is testable.
- Confirm any remaining related risk is reported rather than silently fixed.

## 10. Architecture and Existing Patterns

Follow the current project structure:

- `app/routes/` owns HTTP wiring.
- `app/query/` owns the narrow legacy SQL helper for this frozen mysql2 path.
- `app/utils/business-media-upload-config.js` owns fixed field-to-column mappings.
- `app/utils/business-media-persistence.js` owns query execution and failure cleanup.
- `test/` uses Node's built-in test runner and `node:assert/strict`.

`AGENTS.md` states that new database code should go in the Sequelize stack and that the mysql2 layer is frozen. However, `CODE_REVIEW.md` Finding 13 explicitly notes why this upload path remains on mysql2 for now: the Sequelize media model does not define the `video` attribute written by standalone video uploads. Do not migrate this path as part of Finding 17 unless a separate task explicitly approves and verifies that migration.

Do not introduce:

- A new ORM or query builder.
- A new dependency.
- A new generic SQL abstraction.
- A new repository/service layer for this narrow fix.
- New database tables or migrations.

## 11. Security Requirements

The implementation must satisfy all of the following:

- Never concatenate or interpolate a SQL value into a query string.
- Never derive a SQL identifier from request body keys, request file keys, filenames, route parameters, session values, or external configuration loaded at runtime.
- Column identifiers must come only from a fixed, reviewed allowlist.
- Unknown identifiers must be rejected before `db.query` is called.
- All values must be passed as a values array to mysql2 placeholders.
- Error responses must not expose SQL text, table names, or database error details. Preserve the sanitized failure response from `app/utils/business-media-persistence.js`.
- Update routes must not clear media columns outside the route's intended field set.
- Do not weaken existing upload middleware validation, limits, staging, or cleanup.
- Add hostile-input tests for both keys and values, not just one comma-injection example.
- Search for similar unsafe media-query patterns elsewhere, but report separate findings rather than broadening this task without approval.

Specific attack cases to test:

```text
Column name: logo, status
Column name: logo; DROP TABLE users_business_medias
Column name: uuid -- 
Column name: unknown_column
Value: logo.png' OR 1=1 --
Value: logo.png'; UPDATE users_accounts SET type=1; --
Value: text with quotes, commas, newlines, and Unicode
Empty values object
Update payload containing only uuid
```

For value cases, the expected result is that the suspicious text remains a bound value and never appears in the generated SQL text. For key cases, the expected result is a thrown `Invalid business media columns.` or `At least one business media column must be updated.` error before execution.

## 12. Backward Compatibility

Preserve all existing behavior unless investigation proves a behavior is part of the vulnerability:

- Existing upload endpoint URLs.
- Existing HTTP methods.
- Existing multipart field names and per-route field allowlists.
- Existing UUID sources: body, raw session UUID, decrypted session UUID.
- Existing success response text, including `'success upload files'` and `'success'`.
- Existing banner upsert SELECT-then-write behavior.
- Existing `date_created` value format: `YYYY-MM-DD HH:mm:ss`.
- Existing update semantics: only columns belonging to the route's configured groups change.
- Existing persistence failure response and file cleanup behavior.
- Existing database schema and Sequelize model definitions.

Do not change API contracts to make the builder simpler. Do not remove endpoints because a caller is hard to find.

## 13. Testing Strategy

### Normal cases

- `buildInsert` with a representative logo/banner payload returns the expected column order and values.
- `buildInsert` with `uuid` and `date_created` places values in the same order as the columns.
- `buildUpdate` with a banner or brochure payload updates only those columns and appends the UUID predicate value.
- The banner route still uses SELECT before deciding UPDATE versus INSERT.
- Registration, upgrade, and standalone route registration tests still pass.

### Empty / missing input

- `buildInsert({})` throws.
- `buildUpdate({}, uuid)` throws.
- `buildUpdate({ uuid }, uuid)` throws.
- Route handlers with no `req.files` preserve their current no-file behavior; do not convert it into a new error contract.

### Boundary cases

- Values containing commas, quotes, semicolons, backslashes, newlines, and Unicode remain bound parameters.
- Very long media titles or filenames remain bound parameters and do not alter SQL structure.
- An `UPDATE` payload omitting a media column does not include that column in the `SET` clause.
- `uuid` present in an update values object is not duplicated in the `SET` clause.

### Invalid input

- Unknown column names throw before query execution.
- Comma-injected keys throw.
- SQL-comment and statement-terminator keys throw.
- Mixed-case or whitespace-padded keys throw unless they are genuinely allowlisted.
- `buildInsert(null)` and similar non-object inputs fail safely. If the current behavior throws a generic `TypeError`, do not change the public contract without a documented reason; add a test only if it improves safety without altering route behavior.

### Security cases

- Malicious values remain data and never appear in the query text.
- Malicious keys are rejected before reaching mysql2.
- Persistence failures still return a sanitized 500 response.
- No SQL string is logged or returned to the client.

### Regression testing

- `test/013-business-media-route-config.test.js` passes.
- `test/052-business-media-db-failure.test.js` passes.
- `npm test` passes, or any skipped database-dependent tests are reported separately.
- Manual upload smoke test if the environment allows it: registration media, standalone logo/banner update, brochure update, and banner upsert.

Do not add tests that require a live database unless the existing suite already uses that pattern. Prefer pure builder tests and injected fake `db` objects.

## 14. Verification / Evidence

Provide evidence, not a bare statement that the issue is fixed.

Required verification:

1. Show the current builder implementation and the allowlist.
2. Show repository-wide search results proving no old per-combination `INSERT`/`UPDATE` constants remain in active use.
3. Show all builder call sites and confirm none passes request-controlled column names.
4. Show targeted test output for `test/013-business-media-route-config.test.js` and `test/052-business-media-db-failure.test.js`.
5. Show full `npm test` output or clearly report skipped tests.
6. Show tests that prove hostile keys throw and hostile values are bound.
7. Review `git diff` and confirm only intentional files changed.
8. Explicitly state whether `app/models/users-business-medias.model.js` still contains related interpolation and whether it was left untouched as out of scope.

Example verification commands:

```bash
node --test test/013-business-media-route-config.test.js test/052-business-media-db-failure.test.js
npm test
grep -R "INSERT INTO users_business_medias" app test
grep -R "UPDATE users_business_medias" app test
grep -R "buildInsert\|buildUpdate" app test
```

## 15. Do NOT Do

- Do not recreate the old per-combination SQL constants.
- Do not rewrite the builder if it already satisfies the target contract.
- Do not migrate this upload path to Sequelize in this task.
- Do not introduce a new query builder, ORM, dependency, or generic SQL layer.
- Do not derive SQL identifiers from request data.
- Do not concatenate or interpolate SQL values.
- Do not expand `MEDIA_COLUMN_ALLOWLIST` without schema and route verification.
- Do not change existing endpoint URLs, HTTP methods, multipart field names, UUID sources, or success response text.
- Do not modify `app/middleware/business-media-upload.middleware.js` unless the task explicitly requires a related correction.
- Do not weaken or remove Finding 52 cleanup behavior.
- Do not modify `app/models/users-business-medias.model.js` as part of this finding without separate approval.
- Do not change the database schema or Sequelize model definitions.
- Do not modify `.env` or secrets.
- Do not delete or skip failing tests to make the suite green.
- Do not hide or suppress errors.
- Do not modify unrelated in-progress changes in the worktree.

## 16. Acceptance Criteria

- [ ] Finding 17 current status was verified against the actual repository, not only against `CODE_REVIEW.md`.
- [ ] No active per-combination media `INSERT`/`UPDATE` constants remain.
- [ ] `buildInsert` and `buildUpdate` use only allowlisted column identifiers.
- [ ] All SQL values are bound through `?` placeholders.
- [ ] Unknown, comma-injected, comment-injected, and statement-injected column keys are rejected before query execution.
- [ ] Malicious values remain bound parameters and do not appear in generated SQL text.
- [ ] `buildUpdate` excludes `uuid` from the `SET` clause and uses it only in the predicate.
- [ ] Omitted media fields remain unchanged on update.
- [ ] Existing upload URLs, fields, UUID sources, success responses, and persistence failure behavior are preserved.
- [ ] Banner upsert behavior is unchanged.
- [ ] `test/013-business-media-route-config.test.js` passes.
- [ ] `test/052-business-media-db-failure.test.js` passes.
- [ ] Full `npm test` passes, or skips are reported separately with reasons.
- [ ] No unrelated files were modified.
- [ ] Final diff was reviewed.
- [ ] Any related risk, including legacy media read interpolation, is documented separately and not silently changed.
- [ ] Remaining risks and uncertainties are documented in the final report.

## 17. Expected Final Report

Finish with this structure:

```markdown
# Implementation Report

## Summary

Brief explanation of what was verified, what was changed, and what was intentionally left alone.

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

Explain the builder contract, allowlist behavior, route call sites, and any test additions. State clearly whether the implementation already matched Finding 17's target or required a repair.

## Testing

| Test | Result |
|---|---|
| Normal insert | PASS/FAIL/SKIPPED |
| Normal update | PASS/FAIL/SKIPPED |
| Empty payload rejection | PASS/FAIL/SKIPPED |
| Malicious column key rejection | PASS/FAIL/SKIPPED |
| Malicious value binding | PASS/FAIL/SKIPPED |
| Update UUID predicate | PASS/FAIL/SKIPPED |
| Route compatibility tests | PASS/FAIL/SKIPPED |
| Persistence failure tests | PASS/FAIL/SKIPPED |
| Full `npm test` | PASS/FAIL/PARTIAL/SKIPPED |

## Verification

Explain how you proved the original problem is resolved. Include the searches performed, the call sites reviewed, and the test output summary.

## Remaining Risks

List anything that could not be verified, including:
- database-dependent tests that were skipped,
- legacy media read queries in `app/models/users-business-medias.model.js`,
- the intentional mysql2 compatibility boundary,
- any future Sequelize migration requirements.

## Final Status

PASS / NEEDS REVIEW
```

## 18. Important Rules for Generating the Task Document

### Rule 1 — Do not hallucinate

Do not invent file paths, functions, columns, routes, tests, or behavior. If a fact cannot be verified from the repository, mark it as `TO INVESTIGATE`.

### Rule 2 — Separate facts from recommendations

Keep "verified current implementation" distinct from "recommended implementation." The current builder already exists; do not describe it as missing.

### Rule 3 — Prefer project consistency

Use Node's built-in test runner, the existing query module, and the existing route configuration. Do not introduce a parallel architecture.

### Rule 4 — Preserve behavior

Finding 17 is a duplication and SQL-safety concern. It does not authorize changing upload contracts, persistence semantics, or database schema.

### Rule 5 — Think about the entire code path

Follow request data from route configuration through mapping, query building, mysql2 execution, and response. Do not review only the builder's line of code.

### Rule 6 — Make the task executable

The next agent must be able to read this document and know what to verify, where to look, what to change only if necessary, what not to change, how to test, and how to prove completion.

## 19. Output Requirements

Save this task document as:

```text
docs/tasks/017-SQL-Query-String-Explosion-in-Media-Queries.md
```

The completed implementation report must be specific to the repository's current state. If the builder already satisfies the target and tests pass, report `PASS` without manufacturing code changes. If a gap is found, make the smallest supported repair and report exactly what changed.
