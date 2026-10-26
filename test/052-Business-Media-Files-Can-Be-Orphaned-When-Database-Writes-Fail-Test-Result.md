# Test Result: Business Media Files After Database Write Failures

**Task:** `docs/tasks/052-Business-Media-Files-Can-Be-Orphaned-When-Database-Writes-Fail.md`  
**Execution date:** 2026-10-26  
**Scope:** Business-media persistence failure handling and directly related upload validation regression tests.

## A. Change Summary

The worktree contains a shared completion helper in `app/utils/business-media-persistence.js`, wired into the uploaded-media database callbacks in `app/routes/upload-file.js`. The helper logs persistence errors, removes only request file paths contained within the configured upload directory, logs cleanup errors, and returns a sanitized HTTP 500 JSON response without replying twice. Successful database callbacks continue to invoke the route-specific response unchanged.

During validation, the existing upload-validation test used a 1 MiB-plus-one image as its oversized case, while the configured `companyLogo` policy is 2 MiB. That payload was malformed, not oversized, and correctly received HTTP 400. The test fixture now uses 2 MiB plus one byte; no upload policy or middleware behavior was changed.

The helper, route wiring, and focused test file were already present in the worktree before this validation pass. The only implementation-adjacent change made during validation was correcting that boundary-test input.

## B. Test Scenarios

| ID | Feature / objective | Preconditions, test data, and procedure | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| BMF-001 | Successful media persistence preserves the callback response and file | Temporary upload directory; one generated logo file; invoke helper with a successful mocked `db.query`, query string, and values. | Original query/values reach the DB callback; success callback response is unchanged; file remains. | Assertions passed, including exact success text and one response. | PASS |
| BMF-002 | Failed INSERT removes all files owned by the request only | Temporary directory contains request logo/banner plus unrelated prior media; mocked query returns a DB error. | HTTP 500 with generic body; all request files removed; unrelated media remains; DB error logged and not leaked. | All assertions passed; exactly one sanitized response was sent. | PASS |
| BMF-003 | Failed replacement preserves previously stored media | Temporary directory contains a new replacement and an old referenced brochure; mocked UPDATE fails. | Remove only the replacement; retain old brochure contents; return non-success. | All assertions passed. | PASS |
| BMF-004 | Nested SELECT failure halts a chained persistence flow | One newly published banner; mocked SELECT callback returns an error; success continuation would fail the test. | Return non-success, remove the new file, and do not continue to INSERT/UPDATE. | All assertions passed; continuation did not run. | PASS |
| BMF-005 | Synchronous DB invocation errors use cleanup behavior | One new brochure; mocked `db.query` throws synchronously. | Log the underlying error, remove the new file, and send sanitized HTTP 500. | All assertions passed. | PASS |
| BMF-006 | Cleanup failure is visible and is not success-shaped | One new logo; DB callback errors; injected unlink raises `EACCES`. | Log both errors, send one sanitized non-success response, and do not claim success. | All assertions passed. | PASS |
| BMF-007 | Already-missing request file does not hide persistence failure | One new logo; DB callback errors; injected unlink reports `ENOENT`. | Treat missing file as already cleaned; still return sanitized HTTP 500 and log persistence failure. | All assertions passed; no false success. | PASS |
| BMF-008 | Late DB failure does not send a duplicate response | Response headers are already sent; one new logo; DB callback errors. | Clean up the request file and leave the prior response untouched. | All assertions passed; response count stayed at one. | PASS |
| BMF-009 | Cleanup rejects an out-of-directory path | Mock request file path points outside the temporary upload directory. | Refuse unlink, log cleanup failure, preserve outside file, and return non-success. | All assertions passed. | PASS |
| BMF-010 | Route query coverage includes all uploaded-media persistence sites | Read `app/routes/upload-file.js`; count active direct and wrapped query calls. | Uploaded-media queries use the helper; the no-upload registration query is the sole direct DB query. | Static test found 47 helper call sites and one direct no-upload query. | PASS |
| UP-001 | Valid uploaded media gets generated filenames and remains stored | Run upload middleware integration test with valid generated image/PDF/MP4 fixtures. | Files pass content checks, use generated names, and are published under the expected upload directory. | Assertions passed. | PASS |
| UP-002 | Spoofed MIME is rejected and staged content is removed | Upload PNG bytes with a mismatched declared type. | HTTP 400; no staged/public file remains. | Assertions passed. | PASS |
| UP-003 | Unsupported, empty, and oversized upload requests are rejected | Empty multipart request; unsupported content; logo payload of `2 * MiB + 1` bytes. | Reject with the expected client-error status; oversized image returns HTTP 413; no residual files. | Assertions passed after aligning the oversized fixture with the configured 2 MiB logo limit. | PASS |
| UP-004 | PDF size boundary remains enforced | Submit a valid PDF at 10 MiB and one beyond that limit. | At-limit PDF is accepted; over-limit PDF is rejected; no residual staged files. | Assertions passed. | PASS |
| UP-005 | Unexpected multipart fields are rejected | Submit a file field not configured for the route. | HTTP 400 and cleanup of staged content. | Assertions passed. | PASS |
| UP-006 | Malformed PDF and MP4 content are rejected | Submit fixtures lacking the required PDF cross-reference or MP4 video track. | HTTP 400; invalid content is not published. | Assertions passed. | PASS |

### Defects found

- **Test fixture mismatch (corrected):** The oversized logo assertion used 1 MiB + 1 byte despite the current configured limit being 2 MiB. At that size, the all-zero payload was malformed image content and the observed HTTP 400 was correct. The test input was updated to 2 MiB + 1 byte to exercise the actual configured limit. No application-policy change was made.
- No other defects were identified by the listed automated tests.

## C. Test Execution Summary

| Test execution | Passed | Failed | Skipped | Blocked / not executed |
|---|---:|---:|---:|---:|
| Focused business-media persistence test (`node --test test/052-business-media-db-failure.test.js`) | 10 | 0 | 0 | 0 |
| Full suite (`npm test`) | 231 | 0 | 0 | 0 |
| Syntax checks (`node --check` on helper, route, and focused tests) | 4 files | 0 | N/A | 0 |
| Prettier check on helper and related tests | 3 files | 0 | N/A | 0 |
| Prettier check on `app/routes/upload-file.js` | 0 | 1 formatting check | N/A | 0 |

The focused upload-validation file was included in the full suite and all six of its tests passed. No database-dependent skips were reported by the runner.
The route formatting check reports existing style differences; checking the committed `HEAD` version also fails. The repository-wide `npm run lint` command was not run because it writes formatting changes across the whole working tree.

## D. Security and Regression Findings

- Cleanup uses `req.files[*].path` values supplied by the upload middleware and checks resolved paths remain inside the configured upload directory before unlinking.
- Old media is not taken from database values or request fields and is not deleted; the failed-update test verifies the previous file remains byte-for-byte intact.
- Database details and filesystem cleanup errors are logged server-side; the client receives only the generic failure response.
- The route source contains 47 `runBusinessMediaQuery` call sites. Its only active direct `db.query` call is `/api/post/registration-no-upload`, which has no newly uploaded files to clean.
- No schema, SQL, upload policy, endpoint, or successful response behavior was intentionally changed in this task.
- The complete route behavior was not exercised against a live/configured MySQL instance. Failure tests use controlled callbacks and temporary directories; route coverage is checked statically.

## E. Production Readiness Assessment

**Decision: READY WITH CONDITIONS (this change only).**

The focused persistence tests and full repository test suite pass, with no skipped tests. The failure cleanup behavior, callback failure responses, update safety, and route call-site coverage have execution evidence. Release confidence is conditional because tests do not run the production route/database combination or verify browser behavior against a running application. This report does not assess the production readiness of the whole marketplace.

## F. Remaining Actions

1. In a non-production environment, exercise one registration upload, one single-media upload, and one replacement update against the configured MySQL service, including an induced database failure.
2. Confirm a representative upload client displays the generic non-success response as expected.
3. Keep the existing 2 MiB image policy and its tests in sync if product requirements change.
4. Consider a separate, scoped formatting pass for the legacy upload route; its committed baseline already fails Prettier.

## G. Files and Evidence

### Files modified during this validation pass

| File | Change |
|---|---|
| `test/012-file-upload-without-validation.test.js` | Corrected the oversized-logo fixture from 1 MiB + 1 byte to 2 MiB + 1 byte to match the existing policy. |

### Files already present in the worktree and reviewed

| File | Purpose |
|---|---|
| `app/utils/business-media-persistence.js` | Shared DB callback and request-scoped cleanup helper. |
| `app/routes/upload-file.js` | Routes uploaded-media persistence through the helper. |
| `test/052-business-media-db-failure.test.js` | Isolated regression tests using temporary files and controlled DB callbacks. |
| `docs/tasks/052-Business-Media-Files-Can-Be-Orphaned-When-Database-Writes-Fail.md` | Implementation requirements and acceptance criteria. |
| `README.md` | Project overview and file-upload data flow. |
| `AGENTS.md` | Repository architecture and coding instructions. |
| `CODE_REVIEW.md` | Finding 52 and recommended incremental fix. |

No files were deleted. The result document does not represent a production database or live-route test.

## Final Status

**NEEDS REVIEW** — automated tests pass, but the route and MySQL integration still requires verification in a non-production environment before this change is treated as fully release-verified.
