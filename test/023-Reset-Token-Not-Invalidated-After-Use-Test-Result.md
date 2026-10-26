# Test Result — Finding 23: Reset Token Not Invalidated After Use

| Field | Value |
|---|---|
| Task guide | `docs/tasks/023-Reset-Token-Not-Invalidated-After-Use.md` |
| Source finding | `CODE_REVIEW.md` — Finding 23 |
| Related finding | Finding 49 covers the same invalidation defect together with expiry enforcement. |
| Reviewed scope | Reset-token validation, expiry, single-use deletion, password update ordering, and reset-password response contract. |
| Date executed | 2026-10-24 |
| Test framework | Node.js built-in `node:test` and `node:assert` |
| Overall automated result | **48 passed, 0 failed, 0 skipped** |
| Live database / SMTP | Not executed |
| Production readiness | **READY WITH CONDITIONS** |

## A. Change Summary

No application code was changed for this review. The reported behavior was already present in `app/routes/forgot-password.js` at inspection:

- The shared reset-token lookup rejects empty, missing, expired, and orphaned tokens.
- GET rejects invalid tokens before rendering the reset form.
- POST rejects invalid tokens before changing the password.
- On a valid POST, `PasswordResetService.setNewPassword` runs before `reset_tokens.destroy({ where: { token } })`.
- The exact success response, `'reset password successfully'`, is sent only after token deletion succeeds.
- A failed password update or token deletion returns the existing failure string rather than success.

The route tests capture the actual registered GET and POST handler functions and stub the Sequelize models. They do not connect to MySQL or SMTP. The service and service-regression tests exercise password hashing and validation with local stubs/bcrypt.

## B. Test Scenarios

### B1. Reset-token route acceptance tests

Executed:

```text
node --test test/049-reset-token-invalidation-and-expiry.test.js
```

All 20 cases passed.

| ID | Scenario / objective | Preconditions and input | Procedure | Expected result | Actual result | Status |
|---|---|---|---|---|---|---|
| TC023-01 | Render reset form for a valid token | Future-expiring token and matching account | Invoke captured GET handler | Form renders with matching account email; no writes | Rendered expected reset view and email; no update or deletion | PASS |
| TC023-02 | Successful reset invalidates only the submitted token | Valid token/account; matching password fields | Invoke captured POST handler | Password update, then exact-token deletion, then unchanged success response | Write order was update → delete; exact token matched; success string returned | PASS |
| TC023-03 | GET rejects unknown token | Token lookup returns no row | Invoke GET with an unknown token | Generic 404; no account lookup or writes | 404 generic message; no account lookup or writes | PASS |
| TC023-04 | POST rejects unknown token | Token lookup returns no row | Invoke POST with an unknown token | Existing failure string; no writes | Failure string returned; no account lookup or writes | PASS |
| TC023-05 | Empty token does not reach database | Empty token string | Invoke GET and POST | Rejected without database lookup or writes | No token lookup, update, or deletion | PASS |
| TC023-06 | Missing POST body is handled safely | Valid token/account; undefined request body | Invoke POST with body omitted | Existing failure string; no password/token write | Failure string returned; no writes | PASS |
| TC023-07 | Orphaned token is rejected | Valid token row but no matching account | Invoke GET and POST | No account exposure, password update, or deletion | GET rejected; POST failed; no writes | PASS |
| TC023-08 | User-controlled token is bound as a value | Very long, SQL-shaped, wildcard, and Unicode tokens | Invoke POST for each token with no matching row | Token is passed to Sequelize condition as a value, not interpolated into SQL | All inputs were supplied through `{ where: { token } }`; no writes | PASS |
| TC023-09 | GET rejects expired token | Expiration in the past | Invoke GET | Generic 404 before account lookup or render | 404; account lookup and writes did not occur | PASS |
| TC023-10 | POST rejects expired token | Expiration in the past | Invoke POST | Existing failure string; no password update or deletion | Failure string returned; no account lookup or writes | PASS |
| TC023-11 | Expiration at current time is rejected | Expiration equals current time | Invoke GET and POST | Token is treated as expired | Both handlers rejected the token; no writes | PASS |
| TC023-12 | Missing/unparseable expiration fails closed | Expiration is null, empty, malformed, or undefined | Invoke GET and POST for each value | Token is rejected | All values were rejected; no writes | PASS |
| TC023-13 | Future expiration is accepted | Expiration is safely in the future | Invoke GET and POST | GET renders; POST succeeds and deletes token | Both accepted; POST deleted token once | PASS |
| TC023-14 | Sequential replay is prevented | Valid token; destroy stub removes token row | POST twice with same token | First succeeds; second fails; only one password update and deletion | First returned success; second returned failure; one update and one deletion | PASS |
| TC023-15 | Consumed token cannot render reset form | Valid token before first POST | POST successfully, then invoke GET with same token | Subsequent GET is rejected | Subsequent GET returned generic 404 | PASS |
| TC023-16 | GET does not consume token | Valid, future-expiring token | Invoke GET | Form renders and token remains available | No deletion; token remained present | PASS |
| TC023-17 | Password validation failure preserves token | Valid token; mismatched confirmation | Invoke POST | Failure response; no deletion | Failure returned; no deletion | PASS |
| TC023-18 | Missing password fields preserve token for retry | Valid token; empty form body | Invoke POST | Failure response; no update/deletion; token retained | Failure returned; no update/deletion; token retained | PASS |
| TC023-19 | Deletion failure is not reported as success | Valid token; destroy stub throws | Invoke POST | Failure response; error is surfaced through existing logging | Failure returned and deletion error logged; password update had already occurred | PASS |
| TC023-20 | Database lookup failures are not disguised as invalid tokens | Token or account lookup throws | Invoke GET/POST and assert rejection | Lookup error propagates; no password/token writes | Both lookup errors propagated; no writes | PASS |

### B2. Password storage and route regression tests

Executed:

```text
node --test test/003.2-plaintext-password-storage-on-reset.test.js
```

All 11 cases passed:

- Plaintext password is hashed with bcrypt cost 12 before storage.
- Legacy `password3` is ignored, including for an older cached client.
- A `password3`-only POST cannot write that value.
- The visible password field is used instead of `password3`, avoiding double hashing.
- Confirmation mismatch is rejected without a write.
- Empty or missing passwords are rejected without a write.
- Passwords beyond bcrypt's 72-byte limit are rejected.
- A password exactly at the 72-byte limit is accepted.
- Each reset uses a unique salt.
- SQL-shaped password input is hashed as data.
- Failures return a generic message and do not log or return the password.

Each observed result matched the expected result: **PASS**.

### B3. Password reset service tests

Executed:

```text
node --test test/password-reset.test.js
```

All 17 cases passed:

- Hash output is bcrypt cost 12 and verifies only the original password.
- Identical inputs receive unique salts.
- Work factor matches the configured constant.
- Missing, empty, or non-string passwords are rejected before hashing.
- Password byte length is bounded to bcrypt's supported input.
- The limit counts UTF-8 bytes rather than characters.
- Confirmation is optional only when absent; mismatches are rejected.
- Unicode and SQL-shaped passwords are handled as data.
- `setNewPassword` persists only a bcrypt hash keyed by UUID and leaves `updatedAt` unchanged.
- Missing confirmation remains supported.
- Mismatched confirmation is rejected without writing.
- Legacy `password3`-only input is rejected without writing.
- Empty or non-string values are rejected without writing.
- Legacy body with `password` and `password3` hashes only `password`.
- Invalid UUID is rejected without writing.
- UUID validation accepts only a non-empty string.
- Failed account update propagates and never returns the hash.

Each observed result matched the expected result: **PASS**.

## C. Test Execution Summary

| Category | Passed | Failed | Skipped | Not executed |
|---|---:|---:|---:|---:|
| Reset-token route tests | 20 | 0 | 0 | 0 |
| Password storage/route regression tests | 11 | 0 | 0 | 0 |
| Password reset service tests | 17 | 0 | 0 | 0 |
| **Total automated tests** | **48** | **0** | **0** | **0** |
| Live MySQL/SMTP end-to-end test | — | — | — | 1 |
| Browser-driven UI / deployed HTTP test | — | — | — | 1 |

The live MySQL/SMTP and browser/deployed HTTP tests were not attempted. Automated route tests use a fake Express registration surface and stubbed Sequelize models. They verify handler behavior and ordering, not database transaction semantics or deployed middleware/network integration.

Sequelize emitted the existing `operatorsAliases` deprecation warning during test setup. It did not fail any test and was not changed in this task.

## D. Defects Found

### D-023-01 — Concurrent reset submissions are not atomic

| Attribute | Assessment |
|---|---|
| Severity | Medium residual security risk |
| Status | Open; not changed in this task |
| Root cause | The route reads the token, updates the password, and deletes the token in separate operations without a transaction, row lock, or atomic consume operation. |
| Evidence | Sequential replay tests pass, but the current test uses a sequential fake database and does not establish behavior under simultaneous POST requests. |
| Impact | Two concurrent requests may both validate the same token before either deletes it, allowing both password updates. |
| Recommended remediation | Evaluate a transaction/locking or atomic token-consumption design in a separate scoped change. Verify Sequelize/MySQL behavior and retain current response contracts. |

### D-023-02 — Password update and token deletion are not atomic

| Attribute | Assessment |
|---|---|
| Severity | Low residual correctness risk |
| Status | Open; not changed in this task |
| Root cause | Password update succeeds before token deletion is attempted. |
| Evidence | The deletion-failure test proves that the route returns failure and logs the error, while the password update may already have occurred. |
| Impact | A deletion failure can leave the password changed while the token remains usable. |
| Recommended remediation | Consider making the password update and token invalidation atomic in a separate change, with explicit transaction-failure tests. |

No new release-blocking defect was found in the reviewed scope.

## E. Security and Regression Findings

- Missing, empty, unknown, expired, and malformed-expiration tokens are rejected before password updates.
- Invalid GET requests do not render the reset form or perform an account lookup after token rejection.
- Token conditions use Sequelize's `where` condition rather than SQL interpolation.
- A successful sequential reset deletes only the matching token and preserves the existing success response.
- Password validation, server-side bcrypt hashing, and existing form compatibility passed the related regression tests.
- Deletion failure is not reported as success. However, it may occur after the password has already changed.
- Simultaneous submissions and transaction rollback behavior were not tested against a real database.
- No actual frontend request, SMTP send, production deployment, or live database operation was executed.
- The repository worktree has unrelated pre-existing changes. No application code or test source was changed for this report.

## F. Production Readiness Decision

**READY WITH CONDITIONS**

The scoped implementation passes all 48 executed automated tests, including invalid/expired-token rejection, sequential replay prevention, deletion failure behavior, password hashing, and response compatibility. The route code already meets the stated Finding 23 behavior; this review did not require an application code change.

This is not a whole-system production-readiness assessment. Live database and SMTP integration were not run, and sequential tests do not prove single-use behavior under concurrent submissions. The non-atomic password-update/token-delete sequence also leaves a documented failure window. Accept those risks or complete a separately tested atomic-consumption improvement before claiming strict at-most-once semantics.

## G. Remaining Actions

1. Decide whether concurrent reset submission and update/delete atomicity require a separate release-blocking fix.
2. If pursuing atomicity, add controlled concurrent and rollback tests using an isolated MySQL test database.
3. Run a local end-to-end flow with disposable test accounts and non-production SMTP configuration before deployment, if operational release verification requires it.
4. Do not run the live reset flow against production data or SMTP as part of this test report.
