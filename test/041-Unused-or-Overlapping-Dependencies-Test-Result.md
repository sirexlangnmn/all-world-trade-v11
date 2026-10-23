# Test Result — 041 Unused or Overlapping Dependencies

| Field                    | Value                                                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Document                 | `test/041-Unused-or-Overlapping-Dependencies-Test-Result.md`                                                                                    |
| Task                     | `docs/tasks/041-Unused-or-Overlapping-Dependencies.md`                                                                                          |
| Source finding           | `CODE_REVIEW.md` → Finding 41                                                                                                                   |
| Reviewed scope           | Direct dependency cleanup, development dependency classification, Express body parser replacement and order, test script, related documentation |
| Environment              | Ubuntu 26.04 via WSL, Node.js v24.19.0, npm 12.0.2                                                                                              |
| Test file                | `test/041-unused-or-overlapping-dependencies.test.js`                                                                                           |
| Overall automated result | **79/79 focused offline regression tests passed; 0 failed, 0 skipped.**                                                                         |
| Production readiness     | **READY WITH CONDITIONS** — scoped checks passed; full database-backed suite and application startup were not run.                              |

---

## A. Change Summary

The implementation removes confirmed-unused direct packages (`body-parser`, `cookie-session`, `method-override`, `passport`, and `passport-local`), moves the retained development tools `nodemon` and `npm-check-updates` into `devDependencies`, replaces the duplicate body-parser setup with Express 5 parsers before route registration, and changes the test script to `node --test`.

The README and agent instructions now describe the actual session-based authentication, parser order, and available test suite. A focused test file was added to verify package classification and request parsing behavior.

No database, production environment values, API contracts, or authentication logic were changed.

## B. Test Scenarios

All scenarios below are automated cases in `test/041-unused-or-overlapping-dependencies.test.js`. Actual results are from the executed test command, not inferred from code inspection.

| ID            | Feature                                 | Objective / Procedure                                                                                                                                                                   | Expected Result                                                                                                        | Actual Result                                                 | Status |
| ------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------ |
| 041-DEP-01    | Dependency declarations                 | Load `package.json`; assert the five removed packages are absent from both dependency sections, development tools are in `devDependencies`, and production start invokes Node directly. | No unused direct declarations; tools remain available for development; production start does not depend on nodemon.    | Assertions passed.                                            | PASS   |
| 041-PARSE-01  | Application parser wiring               | Inspect `app/src/server.js`; count configured Express parsers and compare their position with API route registration.                                                                   | Exactly one JSON parser and one URL-encoded parser; both precede API routes; no removed parser/session imports remain. | Assertions passed.                                            | PASS   |
| 041-PARSE-02  | JSON and URL-encoded requests           | Send a JSON body and a nested URL-encoded body through an ephemeral Express parser app configured with the production parser options.                                                   | JSON remains an object and `extended: true` continues to parse nested form fields.                                     | Both HTTP 200 responses contained the expected parsed values. | PASS   |
| 041-PARSE-03  | Malformed JSON                          | Submit malformed JSON through the parser harness and existing error-response shape.                                                                                                     | HTTP 400 with the established `{ status: 404, message }` response shape; process remains available.                    | HTTP 400 and expected response fields returned.               | PASS   |
| 041-REG-01    | Password/reset regression               | Run existing password-reset, reset-token, forgot-password response, JWT-removal, and reset-rate-limit tests.                                                                            | Existing password/reset behavior and security checks remain intact.                                                    | All included cases passed.                                    | PASS   |
| 041-LOCK-01   | Dependency graph / lockfile consistency | Run `npm ls --depth=0` and `npm ci --ignore-scripts --dry-run`.                                                                                                                         | Direct dependency tree is valid and npm can resolve the ignored local lockfile without installation errors.            | Both commands exited successfully.                            | PASS   |
| 041-STATIC-01 | Syntax and formatting                   | Run `node --check` for changed JavaScript, Prettier checks for new/changed formatted files, and scoped whitespace checks.                                                               | No syntax, formatting, or changed-line whitespace errors.                                                              | Checks passed after formatting the new test file.             | PASS   |

### Test execution detail

Executed:

```sh
npm test -- \
  test/041-unused-or-overlapping-dependencies.test.js \
  test/003.2-plaintext-password-storage-on-reset.test.js \
  test/004-password-embedded-in-jwt-reset-token.test.js \
  test/049-reset-token-invalidation-and-expiry.test.js \
  test/050-forgot-password-response.test.js \
  test/051-reset-endpoints-rate-limit.test.js \
  test/password-reset.test.js
```

Result: **79 tests, 79 passed, 0 failed, 0 skipped.** These tests use Node's built-in `node:test`; the focused dependency/parser checks and password-reset regression tests did not require writing to a live database.

The parser behavior tests run an isolated ephemeral Express app using the same Express built-in parser options. A source assertion separately confirms the actual server config has exactly one of each parser and registers them before the API routes. The test does not import/start the monolithic production server.

## C. Test Execution Summary

| Category                                                     |             Passed | Failed | Skipped | Blocked / Not Run |
| ------------------------------------------------------------ | -----------------: | -----: | ------: | ----------------: |
| Focused automated tests                                      |                 79 |      0 |       0 |                 0 |
| Dependency tree / lockfile dry-run                           |           2 checks |      0 |       0 |                 0 |
| Syntax, formatting, and scoped whitespace checks             | 1 validation batch |      0 |       0 |                 0 |
| Full `npm test` suite                                        |                  — |      — |       — |           Not run |
| Full app startup / database-backed login integration         |                  — |      — |       — |           Not run |
| Production-only installation and deployed runtime smoke test |                  — |      — |       — |           Not run |

The full suite was not run because existing login integration cases can create and delete database fixture records. The configured database was not independently verified as an isolated test database, so those cases were not run against it.

`package-lock.json` is ignored by the repository's `.gitignore`. npm updated the existing local lockfile and its dry-run consistency check succeeded, but the lockfile is not tracked and therefore is not part of the repository diff.

## D. Defects Found

No defect in the scoped implementation was found by the executed tests.

The source tree contains other pre-existing dependency references in old task documents and comments. They are explanatory historical text rather than active imports. The README's inaccurate Passport statements were corrected. No unrelated documentation was rewritten.

## E. Security and Regression Findings

- The runtime session implementation remains `express-session`; the unused `cookie-session` import and dependency were removed without changing session configuration.
- No Passport strategy or middleware is configured in the application source; `passport` and `passport-local` direct dependencies were removed.
- JSON and URL-encoded parsing remain before API route registration, with `extended: true` preserved.
- The server keeps its existing malformed JSON error response shape.
- `nodemon` and `npm-check-updates` remain installed for development but are no longer production dependencies.
- `npm` reported **20 dependency audit findings** during manifest operations (5 moderate, 13 high, 2 critical). No audit remediation or package upgrades were attempted because that would exceed Finding 41's scope. Their exact packages and fix compatibility were not investigated in this task.
- The test suite contains database-backed tests; a safe isolated database was not confirmed, so full-suite and production-server validation remain outstanding.

## F. Production Readiness Decision

**READY WITH CONDITIONS**

Evidence supports the scoped dependency cleanup and parser behavior: the 79 selected offline regression tests passed, the direct dependency tree is valid, the lockfile dry-run succeeded, and changed JavaScript passed syntax validation. The focused tests prove package classification and verify the parser configuration/order against the application source.

This is not a full-system release approval. The app was not started against an isolated integration database or a production-like environment, and the full database-backed test suite was not run. In addition, the npm audit findings remain unresolved and were not assessed for release impact.

## G. Remaining Actions

1. Run the full `npm test` suite against an explicitly isolated test database and verify fixture cleanup.
2. Validate `npm start` in a production-like environment with the production dependency installation procedure.
3. Decide whether `package-lock.json` should remain intentionally ignored or be tracked for reproducible installs; this test did not change `.gitignore`.
4. Review the reported npm audit findings separately and determine whether any require a security update.
