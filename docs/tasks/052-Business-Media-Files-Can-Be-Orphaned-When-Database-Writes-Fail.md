# AI Implementation Task: Clean Up Business Media Files When Database Writes Fail

## 1. Task Title

# Prevent Orphaned Business Media Files After Database Failures

## 2. Objective

Ensure business-media uploads have an explicit and reliable outcome when their MySQL persistence fails. If a media INSERT or UPDATE fails after the request's files have been published, remove only those newly generated files, log the underlying failure, and return a sanitized non-success response. When persistence succeeds, preserve the existing endpoint success text, stored filenames, and public URL behavior.

This is a production-sensitive, incremental reliability fix. Keep the existing upload endpoints and media workflows working; do not use this task to consolidate their SQL variants or change their upload policy.

## 3. Problem / Finding

**Finding:** Finding 52 — Business Media Files Can Be Orphaned When Database Writes Fail  
**Source:** `CODE_REVIEW.md`, Detailed Findings  
**Severity:** Medium, as stated in the review priority table.

The shared business-media upload middleware validates and processes the request's files, then publishes them under `public/uploads/users_upload_files/`. The route handlers in `app/routes/upload-file.js` subsequently persist the generated filenames through legacy `db.query(...)` callbacks. The finding reports that many callback error branches only log the error (or throw it), do not send a clear failure response, and leave the new files on disk.

This produces two related failure modes:

- A client may receive no clear response, or an unhandled server error, even though the upload failed to persist.
- Files published by a request whose database write failed can remain publicly accessible without a database reference and accumulate over time.

Cleanup must be scoped to files created for the failed request. In particular, an update request must never delete its previously referenced media merely because replacing it failed.

**Verified current behavior:** `app/routes/upload-file.js` uses the shared middleware created by `app/middleware/business-media-upload.middleware.js`. The middleware publishes successful validation results into the public upload directory and updates each `req.files` entry with the generated filename and final path before calling `next()`. The route module contains many database callbacks, with varying success messages and inconsistent error handling.

**Important documentation discrepancy:** `README.md` describes the upload validation and staging flow, but its upload-flow diagram does not fully represent the interval between publication and database persistence. The implementation agent must rely on the current code for exact behavior and update directly related documentation only if the fix changes documented behavior.

## 4. Affected Functionality

This affects business media creation and replacement workflows, including registration uploads, standalone media uploads, and profile/upgrade media updates. The route module includes many combinations of uploaded fields and SQL variants; do not assume one callback covers every affected path.

### Current high-level flow

```text
Browser multipart request
   ↓
Upload middleware validates and processes files
   ↓
Middleware publishes generated files under public/uploads/users_upload_files/
   ↓
Route builds SQL values from req.files[*][0].filename and request fields
   ↓
Legacy mysql2 db.query(...) INSERT / UPDATE callback
   ├─ success: existing endpoint response (varies by route)
   └─ failure: currently inconsistent response and possible orphaned files
```

### Target high-level flow

```text
Published files belonging to this request
   ↓
Database persistence callback
   ├─ success: preserve existing success response and leave new files in place
   └─ error: log the underlying error, unlink only this request's new files,
             then return a sanitized HTTP 500 response
```

For routes that perform multiple database operations before persistence is complete, inspect the exact flow and do not report success or retain the request's files until the operation that establishes the media reference has succeeded.

## 5. Investigation Phase

Complete this investigation before changing code:

1. Read `README.md`, `AGENTS.md`, and `CODE_REVIEW.md`, including Finding 52 and the incremental refactoring guidance. Treat current code as authoritative if documentation is stale.
2. Inspect the full current `app/routes/upload-file.js`. Enumerate every handler that accepts uploaded media and identify:
   - Route path and upload middleware.
   - File fields and generated filenames used.
   - Database query, values, and callback(s).
   - Existing success response text, status, and response shape.
   - Existing failure behavior, including thrown errors and branches that never respond.
3. Search the repository for uses of `createBusinessMediaUpload`, the upload route paths, `req.files`, `users_upload_files`, and stored media filenames. Verify whether every route using the shared upload middleware is in scope, including nested read-then-write callbacks.
4. Inspect `app/middleware/business-media-upload.middleware.js` to confirm when files are published, how `req.files` paths are represented, and what cleanup guarantees already exist for failures before a route handler runs. Do not conflate its temporary validation-file cleanup with post-database-failure cleanup.
5. Inspect `app/models/db.js` and `app/query/users_business_medias.query.js` only as needed to understand mysql2 callback behavior and query contracts. Keep this fix in the existing route/persistence path; the legacy data-access layer is frozen for new features, but a scoped correction to its existing upload callers is required here.
6. Inspect any client scripts that call the affected endpoints. Determine how they handle HTTP failures and whether a generic sanitized error response can be surfaced without changing successful responses.
7. Review the existing `node:test` tests under `test/`, especially `test/012-file-upload-without-validation.test.js`, and match their cleanup/setup conventions. Confirm how database calls can be isolated or injected for deterministic failure tests without a production database.
8. Check whether any upload route is intentionally allowed to complete without a file or without a database write. Preserve those semantics unless evidence shows they are themselves part of this finding.
9. Check the worktree before editing and preserve unrelated changes. Do not modify environment files, production data, or existing user uploads.

Do not infer that all database callback errors are equivalent. For updates, distinguish the newly uploaded replacement file from the old media already referenced by the database. For nested queries, identify which failure means the request has not established a durable reference.

## 6. File Impact Analysis

| File | Role | Action | Reason |
|---|---|---|---|
| `app/routes/upload-file.js` | Business media routes and MySQL callbacks | MODIFY | Route every in-scope media persistence completion and error through a consistent cleanup/response path without consolidating route variants. |
| `app/utils/business-media-persistence.js` or a helper local to the route module | Small shared persistence/cleanup helper | ADD or MODIFY, based on existing conventions | Implement the completion behavior once if that is the simplest testable fit. Confirm the helper location and export style before creating a file. |
| `test/052-business-media-db-failure.test.js` | Focused regression tests | ADD | Verify database-failure response and request-scoped cleanup using temporary directories and a controlled failing query callback. Use the repository's existing `node:test` conventions. |
| `app/middleware/business-media-upload.middleware.js` | Upload validation, publication, and pre-route cleanup | REFERENCE ONLY by default | Confirm that final published file paths are available to the route and distinguish middleware cleanup from persistence cleanup. Modify only if evidence shows the route cannot safely identify files created by the request. |
| `app/models/db.js` and `app/query/users_business_medias.query.js` | Legacy MySQL connection and media SQL | REFERENCE ONLY | Confirm callback/query semantics; do not rewrite SQL or migrate this path to Sequelize for this finding. |
| Client upload scripts and related EJS forms | Upload request and response consumers | REFERENCE ONLY / INVESTIGATE | Confirm failure handling and contract compatibility. Modify only if required to surface the new non-success response, and avoid changes to successful workflows. |
| `README.md` | Project and upload-flow documentation | MODIFY only if needed | Correct directly related upload/persistence documentation if the implemented behavior materially changes it. |
| `package.json` and lockfile | Dependencies and test command | NO CHANGE expected | Existing Node.js test infrastructure and filesystem APIs should suffice; do not add a dependency without a demonstrated need. |

Do not delete routes or query variants. Do not refactor the complete upload module as part of this task.

## 7. Current Implementation

### Verified facts

- `app/routes/upload-file.js` imports the legacy MySQL model module and `app/query/users_business_medias.query.js`.
- The route module creates the shared upload middleware with a destination under `public/uploads/users_upload_files/`.
- The middleware validates files, processes them, copies them into the public destination, and invokes the route handler after publication.
- Generated filenames are placed in the upload middleware's `req.files` entries and are used by the route handlers as database values.
- `app/routes/upload-file.js` contains many media-upload handlers and database callbacks with different SQL variants and success messages.
- At least some database error branches log an error without responding or cleaning up the request's published files; other branches throw.
- The existing upload middleware has cleanup logic for parsing/validation/publication failures. That logic runs before database persistence and does not solve the failure described in Finding 52.
- The repository has a Node built-in test suite, including `test/012-file-upload-without-validation.test.js`, that uses temporary directories and a local Express server for upload behavior.

### Must be verified by the implementation agent

- The complete route list currently affected, including every registration, upload, and update endpoint.
- Which handlers use a single query versus chained queries, and whether any callback can run after the response is already sent.
- The exact response text and shape for successful writes on each endpoint.
- Whether upload errors are transformed by an existing request-level error handler and what logging utility is standard for these callbacks.

Do not copy a partial route list or assume that callback behavior is identical across the large route module.

## 8. Current → Target

### Current

```text
Upload middleware publishes files
    ↓
Route executes db.query(...)
    ├─ error: log/throw/inconsistently respond; published files may remain
    └─ success: send route-specific existing response
```

### Target

```text
Upload middleware publishes files
    ↓
Route executes the existing db.query(...) and observes its callback
    ├─ error: log underlying error → remove only uploaded paths from this request
    │         → send one sanitized non-success response
    └─ success: preserve existing response and keep the new files
```

Use a small shared completion helper for the repeated persistence behavior, as recommended by Finding 52. It should accept or otherwise capture the query operation, values, request-owned published file paths, and response behavior. Adapt its signature to the real mysql2 callback conventions and test architecture.

The helper must not:

- Accept arbitrary filesystem paths from request fields or original filenames.
- Delete paths derived from the old database media values.
- Send a success-shaped response when the query or cleanup fails.
- Send more than one response if an error is encountered after headers have been sent.
- Leak SQL, filesystem paths, or raw error details to the client.

The exact sanitized error body should follow the existing upload API/client conventions after investigation. The status must indicate failure (normally HTTP 500 for a database persistence error). Successful status/body/text must remain as currently implemented for each endpoint.

## 9. Detailed Implementation Plan

### Step 1 — Map every affected route

Build an implementation checklist from the current route module. Include all routes that publish media and then call `db.query(...)`, not only routes explicitly listed in the review. Note nested SELECT-then-INSERT/UPDATE flows and updates that replace existing media.

### Step 2 — Identify request-owned files safely

Derive cleanup paths only from the files produced by the upload middleware for the current request. Confirm whether the route receives `file.path` as an absolute path or another stable representation, and whether that path remains valid after publication. Use the middleware's generated paths rather than user-supplied names.

Before unlinking, constrain paths to the expected upload destination or otherwise establish that the middleware-generated file belongs to this request. Treat `ENOENT` according to existing cleanup conventions; do not silently ignore other filesystem errors.

### Step 3 — Add a small completion helper

Implement a helper consistent with repository conventions. It should:

1. Execute the existing database operation using the existing query and values.
2. On success, invoke the existing route-specific success response without changing its text or shape.
3. On query error, log the underlying database error, clean up only the current request's newly published files, and send a sanitized HTTP 500 response.
4. If cleanup itself fails, log both the persistence and cleanup failures and still return a non-success server response. Never represent failed cleanup as successful upload persistence.
5. Guard response handling so that an error path cannot cause a second response or an unhandled callback exception.

Do not move SQL construction, change query semantics, or consolidate the route definitions as part of this extraction.

### Step 4 — Wire all relevant database callbacks

Apply the helper to every in-scope media INSERT/UPDATE callback. Preserve each route's existing query, parameter order, and success behavior. For chained operations, define precisely when persistence is complete and ensure every failing operation reaches cleanup and a failure response.

Do not automatically delete old media after a successful replacement. Deleting old files requires separate evidence that no other record or workflow references them and is outside the required failure cleanup.

### Step 5 — Handle unusual callback outcomes

Inspect and explicitly handle relevant cases, including:

- `db.query` returns an error.
- The callback succeeds but an UPDATE affects zero rows.
- A nested SELECT fails before the write.
- Cleanup encounters `ENOENT` or another filesystem error.
- A callback fires after `res.headersSent`.
- A request contains multiple uploaded files and only some are referenced by a route's SQL.

Do not invent product semantics for zero-row updates. Establish the existing expected behavior first; if uncertain, document it as a remaining question rather than changing unrelated business behavior.

### Step 6 — Add focused tests

Use controlled query callbacks and temporary upload directories. Avoid reliance on a production database or shared public upload storage. Add tests for the requirements in Section 13.

### Step 7 — Verify coverage and response compatibility

Compare the route checklist against the final helper call sites. Search the module again for media-related `db.query(...)` callbacks that bypass the new failure path. Confirm all successful responses still match their pre-change values.

### Step 8 — Review the final diff

Keep the diff limited to the persistence error path, its focused tests, and directly related documentation if necessary. Check that no old file is unlinked, no endpoint is removed, no SQL changes were bundled, and no filesystem error is hidden.

## 10. Architecture and Existing Patterns

- Follow the repository's CommonJS route/module conventions and Node built-in `node:test` patterns.
- Keep the existing upload middleware responsible for request parsing, content checks, validation, publication, and failures before the route handler.
- Keep the current route module responsible for its legacy endpoint wiring and existing SQL calls; this finding requires safe behavior at that boundary, not a broad architectural migration.
- Follow `CODE_REVIEW.md`'s incremental function-decomposition guidance: extract only the repeated completion/cleanup behavior needed here, keep it shallow, and leave HTTP response decisions in the route/controller layer where practical.
- Reuse the logger/error-handling pattern found in the current application. Do not rely on guessed logger APIs; inspect the repository before selecting one.
- Do not introduce a new dependency, framework, storage architecture, Sequelize migration, or general-purpose upload abstraction.

## 11. Security and Reliability Requirements

- Only unlink files that were newly generated and published for the current request.
- Never construct cleanup paths from `originalname`, request body values, database values, or client-provided paths.
- Keep filesystem cleanup inside the known business-media upload directory, using path-safe handling consistent with the platform.
- Log the underlying database and cleanup errors server-side; return only a generic sanitized failure message to clients.
- Treat cleanup failures as failures. Do not send a success response if a request's database persistence failed or if required cleanup failed.
- Make callback completion safe against duplicate responses and unhandled thrown database errors.
- Preserve current authorization and public-registration behavior; do not add or remove route authentication as part of this finding.
- Do not weaken file validation, upload limits, content inspection, or static-serving protections.
- Do not remove a previously stored media file during a failed update.

## 12. Backward Compatibility

Preserve:

- Every existing upload endpoint and accepted request field.
- Existing SQL queries, query parameter ordering, and intended data semantics.
- Existing successful HTTP status and success response text/body for each route.
- Existing generated filename format and `/uploads/users_upload_files/` URL behavior.
- Existing registration, profile-update, and upgrade flows.
- Existing validation and file-size policies.

The intentional behavior change is limited to database persistence failures: the client must receive an explicit non-success response and files created by that failed request must be removed when cleanup succeeds. If clients depend on unusual current error behavior, document the compatibility finding and make the smallest safe adjustment.

## 13. Testing Strategy

Use the existing Node.js built-in test runner and isolate filesystem/database effects.

### Normal persistence

- Simulate a successful database callback.
- Assert the pre-existing success response is returned exactly as before.
- Assert the newly published files remain in place.
- Assert the database query and its values are passed through unchanged.

### Database failure

- Simulate an INSERT error after one or more files have been published.
- Assert the response is non-success (HTTP 500 or the established equivalent), sanitized, and sent once.
- Assert every newly published file for that request is removed.
- Assert the underlying database error is logged using the established logger.
- Assert no success text/body is returned.

### Update safety

- Pre-create a file representing an already referenced media asset.
- Simulate a failed replacement UPDATE after publishing a new request file.
- Assert the new request file is removed and the pre-existing file remains byte-for-byte intact.
- Assert no old media filename/path is passed to cleanup.

### Multiple files and chained operations

- Test a request with multiple uploaded files and verify only its own newly published files are removed on failure.
- For nested SELECT/INSERT/UPDATE flows, simulate failure at each persistence stage and verify the same no-orphan/no-false-success behavior.
- Verify one failed callback cannot produce duplicate responses.

### Cleanup failure

- Simulate an unlink error other than `ENOENT`.
- Assert the failure is logged, the client still receives a sanitized non-success response, and no success response is sent.
- Verify `ENOENT` handling matches the chosen cleanup contract and does not hide other filesystem failures.

### Regression

- Confirm at least one registration upload, one single-media upload, and one update route retain their existing successful behavior.
- Confirm the pre-existing upload-validation tests still pass.
- Run the focused test and then `npm test` if the focused test passes and environment permits. Report database-dependent skips separately.

## 14. Verification / Evidence

Before reporting completion, provide evidence that:

1. Every affected uploaded-media database callback in `app/routes/upload-file.js` uses the cleanup/error-response path, including nested query branches.
2. A simulated database failure returns a non-success response and removes all and only the current request's newly published files.
3. A failed update leaves pre-existing media files intact.
4. Successful uploads preserve existing response bodies/text, filenames, and public URL behavior.
5. Cleanup failures are logged and cannot produce success-shaped outcomes.
6. Relevant automated tests pass, with skipped database-dependent tests called out separately.
7. The final diff does not include unrelated route consolidation, schema changes, upload-policy changes, or environment modifications.

Do not claim the problem is fixed based only on a helper existing. Demonstrate that all relevant route paths call it and that its failure behavior is covered.

## 15. Do NOT Do

- Do not rewrite or consolidate all 30+ upload route variants.
- Do not change query strings, query parameter order, schema, or migrate this legacy path to Sequelize.
- Do not change successful endpoint response contracts, generated filenames, or public URLs.
- Do not delete old media files as part of failed-upload cleanup.
- Do not delete files using original filenames, request fields, or database values.
- Do not change file validation, MIME allowlists, limits, sanitization, or publication policy.
- Do not add a dependency without establishing that existing Node APIs are insufficient.
- Do not hide database or cleanup errors, return success after failure, or throw from a callback in a way that bypasses Express handling.
- Do not modify unrelated routes, frontend flows, environment files, production data, or existing uploaded files.
- Do not disable tests or security checks to make the change pass.

## 16. Acceptance Criteria

- [ ] All media upload routes that persist newly published files have been inventoried.
- [ ] Database errors in each affected persistence path lead to a clear non-success HTTP response.
- [ ] Only newly published files belonging to the failed request are removed.
- [ ] A failed update never deletes its previously referenced file.
- [ ] Cleanup failures are logged and do not result in a success response.
- [ ] No callback path produces a duplicate response or unhandled thrown database error.
- [ ] Successful route status, response text/body, generated filenames, and URL behavior are unchanged.
- [ ] Existing query semantics and business behavior are unchanged.
- [ ] Focused regression tests cover successful persistence, failed persistence, update safety, multiple files, and cleanup errors.
- [ ] Existing upload-validation tests pass; broader test results and skips are reported accurately.
- [ ] Final diff is limited to the finding and directly related tests/documentation.
- [ ] Remaining uncertainties, including zero-row UPDATE semantics, are documented.

## 17. Expected Final Report

Finish implementation with this report structure:

```markdown
# Implementation Report

## Summary

Brief explanation of the persistence-failure cleanup behavior.

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
| None | No files deleted. |

## Files Referenced Only

| File | Why |
|---|---|
| `...` | ... |

## Implementation Details

Explain how all affected database callbacks reach cleanup, how paths are constrained to the request's new files, and how update safety is preserved.

## Testing

| Test | Result |
|---|---|
| Successful persistence regression | PASS/FAIL |
| Database failure cleanup | PASS/FAIL |
| Failed update preserves old file | PASS/FAIL |
| Cleanup failure handling | PASS/FAIL |
| Existing upload validation tests | PASS/FAIL/SKIPPED |

## Verification

Explain how route coverage and the original orphan-file condition were verified.

## Remaining Risks

List anything that could not be verified, including database-dependent skips or unresolved update semantics.

## Final Status

PASS / NEEDS REVIEW
```

## 18. Important Rules for the Implementing Agent

### Rule 1 — Verify current behavior

The code review and README may not describe every current callback or the exact publication timing. Inspect the current implementation before editing.

### Rule 2 — Separate established facts from decisions

Mark unresolved response, logger, callback, or zero-row-update semantics as `TO INVESTIGATE`. Do not present a recommendation as existing behavior.

### Rule 3 — Preserve production behavior

This system is working in production. Make the smallest coherent change that resolves failed persistence without changing successful upload behavior.

### Rule 4 — Follow the entire failure path

Trace the path from multipart request through upload middleware, publication, query callback, cleanup, and HTTP response. Include nested database operations.

### Rule 5 — Prove request-scoped cleanup

Test that cleanup removes the new file(s) created by the failed request while preserving old files and unrelated files.

### Rule 6 — Keep the task bounded

Finding 52 is about persistence failures and orphaned files. Upload validation, endpoint consolidation, query modernization, and old-file garbage collection are separate concerns.

## 19. Output Requirements

Implement the behavior described here in the existing codebase. Keep changes scoped, test them, review the final diff, and provide the implementation report in Section 17. If a production-sensitive decision cannot be established from the repository or tests, document it and request clarification rather than making a breaking assumption.
