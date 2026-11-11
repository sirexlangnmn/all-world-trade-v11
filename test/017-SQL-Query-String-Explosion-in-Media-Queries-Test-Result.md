# Finding 17 — SQL Query String Explosion in Media Queries

## Test Result and Production Readiness Report

| Field | Value |
|---|---|
| Finding | 17 — SQL Query String Explosion in Media Queries |
| Primary location | `app/query/users_business_medias.query.js` |
| Branch | `feature/017-SQL-Query-String-Explosion-in-Media-Queries` |
| Reviewer role | Senior Software Engineer / QA / Production Readiness |
| Test framework | Node.js built-in test runner (`node:test`, `node:assert/strict`) |
| Date | 2026-11-02 |
| Verdict | **PASS — READY WITH CONDITIONS** (no release-blocking defect in scope; two pre-existing out-of-scope risks documented) |

---

## A. Change Summary

This task was **verification-first**. Investigation confirmed that the historical
combinatorial `INSERT`/`UPDATE` SQL constants for `users_business_medias` were already
replaced by `buildInsert` / `buildUpdate` in commit `9069411` (Finding 13). No runtime
builder defect was found, so the production query module, routes, upload configuration,
and persistence helper were **not modified**.

The only change in scope was test hardening: `test/013-business-media-route-config.test.js`
gained coverage for the remaining builder security/correctness boundaries that were not
already asserted:

- Every allowlisted media column is accepted and value order matches column order.
- `buildInsert({})`, `buildInsert(null)`, mixed-case and whitespace-padded keys fail safely.
- Very long hostile values remain bound parameters and never appear in generated SQL.

### Files modified

| File | Change |
|---|---|
| `test/013-business-media-route-config.test.js` | Added 3 tests (boundary/allowlist/format edge cases). No production code changed. |

### Files added

| File | Purpose |
|---|---|
| `test/017-SQL-Query-String-Explosion-in-Media-Queries-Test-Result.md` | This report. |

### Files deleted

None.

### Files referenced only (verified, unmodified)

| File | Why |
|---|---|
| `app/query/users_business_medias.query.js` | Subject of the finding; already correct. |
| `app/routes/upload-file.js` | Verified all builder call sites; no request-controlled column names. |
| `app/utils/business-media-upload-config.js` | Verified fixed field→column mapping. |
| `app/utils/business-media-persistence.js` | Verified parameterized execution + Finding 52 cleanup. |
| `app/middleware/business-media-upload.middleware.js` | Verified per-route field/file policies. |
| `test/052-business-media-db-failure.test.js` | Regression baseline; all green. |
| `app/models/users-business-medias.model.js` | Investigated legacy read interpolation; out of scope, left untouched. |
| `app/db_models/users_business_medias.model.js` | Confirm allowlist columns; no migration performed. |
| `README.md`, `AGENTS.md`, `CODE_REVIEW.md` | Architecture, schema, and finding status. |

---

## B. Test Scenarios

All scenarios were executed with `node --test` against the local configured environment.
Shown statuses are actual results from this run.

### B.1 Positive / functional

| ID | Feature / module | Objective | Procedure / input | Expected | Actual | Status |
|---|---|---|---|---|---|---|
| TC-017-001 | `buildInsert` | Representative logo/brochure insert | `{logo, brochure_title, uuid, date_created}` | Columns and `?` placeholders in order, values array matches | Exact SQL `INSERT INTO users_business_medias (logo, brochure_title, uuid, date_created) VALUES (?, ?, ?, ?)` | PASS |
| TC-017-002 | `buildInsert` | `uuid`/`date_created` ordering | Same as 001 | Values in same order as columns | Matched | PASS |
| TC-017-003 | `buildUpdate` | Update banner + date_created | `{banner, date_created}`, uuid | `SET banner = ?, date_created = ? WHERE uuid = ?`; no logo | Matched | PASS |
| TC-017-004 | `buildInsert`/`buildUpdate` | Every allowlisted media column accepted, order preserved | All 14 media columns populated | Query contains one `?` per column in insertion order; update appends uuid predicate | PASS (new test) | PASS |
| TC-017-005 | `mapBusinessMedia` | Fixed field→column mapping | Logo + video request fixture | Keys exactly `logo, video_thumbnail, video_link, video_title, video_description, uuid, date_created` | Matched | PASS |
| TC-017-006 | `mapBusinessMedia` | Standalone filename + metadata mapping | video/brochure fixture | Filenames and titles bound to fixed columns | Matched | PASS |
| TC-017-007 | Route config | Registration route combinations | Enumerate `MEDIA_GROUPS` | 30 unique registration routes, one per supported combination | 30 unique combinations | PASS |
| TC-017-008 | Route config | Standalone route field policies | 8 routes | URLs, multipart fields, operation, UUID source preserved | Matched expected array | PASS |
| TC-017-009 | Route config | Per-route multipart allowlist | All registration/upgrade groups | Only configured fields, `maxCount: 1` | Matched | PASS |
| TC-017-010 | `registration-no-upload` | Minimal insert | `{uuid, date_created}` | `buildInsert` used; no multer fields | Source assertion + builder accepts payload | PASS |

### B.2 Negative / invalid input

| ID | Feature / module | Objective | Input | Expected | Actual | Status |
|---|---|---|---|---|---|---|
| TC-017-011 | `buildInsert` | Reject empty payload | `{}` | Throw `Invalid business media columns.` | Threw | PASS (new) |
| TC-017-012 | `buildInsert` | Fail safely on non-object | `null` | Throws before any query is built | `TypeError` | PASS (new) |
| TC-017-013 | `buildUpdate` | Reject empty update | `{}`, uuid | Throw `Invalid business media columns.` | Threw | PASS |
| TC-017-014 | `buildUpdate` | Reject uuid-only update | `{uuid}` | Throw `At least one business media column must be updated.` | Threw | PASS |
| TC-017-015 | `buildInsert`/`buildUpdate` | Reject comma-injected key | `{'logo, status'}` | Throw before execution | Threw | PASS |
| TC-017-016 | `buildInsert` | Reject statement-injected key | `{'logo; DROP TABLE users_business_medias'}` | Throw | Threw | PASS |
| TC-017-017 | `buildInsert` | Reject comment-injected key | `{'uuid --'}` | Throw | Threw | PASS |
| TC-017-018 | `buildInsert` | Reject unknown column | `{unknown_column}` | Throw | Threw | PASS |
| TC-017-019 | `buildInsert` | Reject mixed-case key | `{LOGO}` | Throw | Threw | PASS (new) |
| TC-017-020 | `buildInsert` | Reject whitespace-padded keys | `{'logo '}`, `{' logo'}` | Throw | Threw | PASS (new) |
| TC-017-021 | Route config | Unknown media group | `getUploadFields(['videoInput'])` | Throw `Unknown business media group` | Threw | PASS |

### B.3 Boundary / security

| ID | Feature / module | Objective | Input | Expected | Actual | Status |
|---|---|---|---|---|---|---|
| TC-017-022 | `buildInsert` | Malicious value stays bound | `logo: "logo.png' OR 1=1 --"` | Query is `... VALUES (?, ?)`; payload not in SQL text | Matched; `/OR 1=1/` absent from query | PASS |
| TC-017-023 | `buildInsert` | Stacked-statement value stays data | `brochure: "file.pdf'; UPDATE users_accounts SET type=1; --"` | Value bound; `UPDATE users_accounts` absent from SQL | Matched | PASS |
| TC-017-024 | `buildInsert` | Quotes/commas/newlines/Unicode | Mixed hostile string | Value preserved verbatim; query only has `?` | Matched | PASS |
| TC-017-025 | `buildInsert` | Excessive length stays bound | 100,000-char value + `' OR 1=1 --` | Value in `values[]`; query is exactly one placeholder | Matched (new test) | PASS |
| TC-017-026 | `buildUpdate` | uuid excluded from SET | `{logo, uuid:'ignored'}`, target uuid | `SET logo = ? WHERE uuid = ?`; predicate uses target | Matched | PASS |
| TC-017-027 | Static search | No old per-combination constants active | Repo-wide grep | Only builder-generated SQL remains | Only builder emits INSERT/UPDATE | PASS |

### B.4 Regression / integration / error handling

| ID | Feature / module | Objective | Expected | Actual | Status |
|---|---|---|---|---|---|
| TC-017-028 | Browser route compatibility | Registration upload URLs still registered | Configured routes equal client-used routes | Matched | PASS |
| TC-017-029 | Browser route compatibility | Upgrade upload URLs still registered | Configured routes equal client-used routes | Matched | PASS |
| TC-017-030 | Shared handler | Success text + update uuid predicate preserved | `success upload files`; uuid is final predicate | Matched | PASS |
| TC-017-031 | Shared handler | Route hooks + endpoint-specific success text | Before-upload hook runs; `success` preserved | Matched | PASS |
| TC-017-032 | Persistence success | Query/values forwarded, response/file preserved | Callback result forwarded; file untouched | Matched | PASS |
| TC-017-033 | Persistence failure | Remove new files, preserve prior media | New files deleted; existing media retained | Matched | PASS |
| TC-017-034 | Persistence failure | Sanitized 500 response | `{status:'error',message:'The upload could not be saved.'}`, no SQL/details | Matched | PASS |
| TC-017-035 | Banner upsert | SELECT failure stops write and cleans file | File removed, 500 response, no write callback | Matched | PASS |
| TC-017-036 | Persistence failure | Synchronous DB throw uses same cleanup | Sanitized 500; file removed | Matched | PASS |
| TC-017-037 | Persistence failure | Cleanup errors logged; single response | One response, cleanup error logged | Matched | PASS |
| TC-017-038 | Persistence failure | Path traversal refused during cleanup | File outside upload dir retained | Matched | PASS |
| TC-017-039 | Structure | Routes share handlers; no-upload route has no multer | Source assertions hold; counts 30/7/8 | Matched | PASS |
| TC-017-040 | Full suite | No regression across project | All tests pass | 296 pass / 0 fail / 0 skipped | PASS |

---

## C. Test Execution Summary

Commands executed:

```bash
node --test test/013-business-media-route-config.test.js test/052-business-media-db-failure.test.js
npm test
npx prettier --check test/013-business-media-route-config.test.js
```

| Metric | Result |
|---|---|
| Targeted tests — `013` + `052` | 25 |
| Targeted passed | 25 |
| Targeted failed | 0 |
| Targeted skipped | 0 |
| Full suite `npm test` — total | 296 |
| Full suite passed | 296 |
| Full suite failed | 0 |
| Full suite skipped / cancelled / todo | 0 / 0 / 0 |
| Full suite exit code | 0 |
| Database-dependent integration tests | Executed (0 skips; SQL observed in output) |
| Formatting check | PASS after formatting the modified test file |

No test was weakened, removed, or skipped to obtain these results.

---

## D. Defects Found

### In scope — Finding 17

**None.** The builder already satisfies the target contract. No production code change was required.

### Out-of-scope observations (pre-existing in `HEAD`, not introduced or modified by this task)

| ID | Severity | Location | Observation | Recommendation |
|---|---|---|---|---|
| OBS-017-01 | Medium | `app/models/users-business-medias.model.js:16,35,50` | Legacy media **read** queries still interpolate UUIDs into SQL strings (`WHERE uuid = "${originalUuid}"`, `WHERE uuid = '${companyUUID}'`). This is the separate risk explicitly called out as out of scope for Finding 17. | Track and fix under a separate finding; migrate to parameterized `?` or the Sequelize read path. Do not silently fold into this task. |
| OBS-017-02 | Medium | `app/routes/upload-file.js:84` | `registrationEmailVerification(...)` is referenced but not defined/imported anywhere in the repository. The `/api/post/users-medias-process` route sets `beforeUpload`, so invoking it will throw `ReferenceError` and return a 500. Pre-existing in `HEAD`; unrelated to the SQL builder. | Verify intended behavior and import/implement the verification helper in a separate change. |

Neither observation is a regression from this task, and neither affects the safety of the media SQL builders.

---

## E. Security and Regression Findings

### Security — verified

- **Identifiers** come only from the fixed `MEDIA_COLUMN_ALLOWLIST`; request keys cannot become column names.
- **Values** are bound exclusively through mysql2 `?` placeholders; hostile values never appear in SQL text.
- Hostile keys (comma, comment, statement terminator, unknown, mixed case, whitespace) throw **before** `db.query`.
- `buildUpdate` removes `uuid` from the `SET` list and uses it only as the predicate value.
- Omitted media columns are not emitted in `SET`, so they remain unchanged.
- Persistence failures return a sanitized 500 with no SQL/table/DB details, and Finding 52 file cleanup is preserved.
- Upload middleware per-route field policies, generated filenames, limits, and staging are untouched.

### Boundary verification

- The allowlist covers all media attributes referenced by `business-media-upload-config.js`.
- The `status` column exists in the schema but is intentionally not in the builder allowlist; no active call site inserts/updates it through these builders.
- `uuid` and `date_created` continue to be accepted for insert and (as `date_created`) update, preserving current behavior.

### Regression — verified

- All 30 registration, 7 upgrade, and 8 standalone route URLs/field policies remain intact.
- Success response text (`success upload files`, `success`) and UUID sources (`body`, `sessionRaw`, `session`) are unchanged.
- Banner SELECT-then-UPDATE-or-INSERT behavior is unchanged.
- Full suite green: 296/296.

---

## F. Production Readiness Decision

**READY WITH CONDITIONS**

Evidence supporting the decision:

- The Finding 17 target contract is met and proven by executed tests (allowlist containment, placeholder binding, hostile key rejection, hostile value binding, uuid predicate, omitted-column preservation).
- No old per-combination `INSERT`/`UPDATE` constant remains in active use (repository-wide search + git history).
- No production file was modified; only tests were added.
- Full regression suite passed with 0 failures and 0 skips.

Conditions (non-blocking for this finding, require separate follow-up):

1. OBS-017-01 — legacy read-query interpolation in `app/models/users-business-medias.model.js` remains and must be handled in its own finding.
2. OBS-017-02 — undefined `registrationEmailVerification` reference on `/api/post/users-medias-process` (pre-existing).
3. Manual multipart upload smoke testing against a running instance was **not** performed; automated route/builder/persistence coverage was used instead.

Because this decision covers only the reviewed scope (Finding 17 media query builders and their immediate tests), it does not certify the entire application as production-ready.

---

## G. Remaining Actions

| Priority | Action |
|---|---|
| Required before release of this finding | None. The in-scope work is complete and green. |
| Follow-up (separate task) | Parameterize legacy media read queries in `app/models/users-business-medias.model.js`. |
| Follow-up (separate task) | Resolve the undefined `registrationEmailVerification` reference and confirm the `/api/post/users-medias-process` contract. |
| Recommended | Run a manual upload smoke test (registration media, standalone logo/banner update, brochure update, banner upsert) in a non-production environment. |
| Recommended | Keep the mysql2 compatibility boundary; do not migrate this path to Sequelize until the model defines the `video` attribute and a separate migration task is approved. |

---

## H. Final Status

**PASS**

- Finding 17 verified against the actual repository, not only `CODE_REVIEW.md`.
- No active per-combination media SQL constants remain.
- Builder security boundaries are covered by executed tests.
- Existing routes, responses, UUID handling, upload policies, and Finding 52 cleanup are preserved.
- Full test suite: 296 passed, 0 failed, 0 skipped.
