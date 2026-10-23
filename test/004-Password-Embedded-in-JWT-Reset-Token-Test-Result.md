# Test Result — Task 004: Remove the Password-Bearing, Unused JWT from the Password-Reset Token Flow

| Field | Value |
| --- | --- |
| Task document | `docs/tasks/004-Password-Embedded-in-JWT-Reset-Token.md` |
| Source finding | `CODE_REVIEW.md` → Finding 4: Password Embedded in JWT Reset Token |
| Branch | `feature/004-Password-Embedded-in-JWT-Reset-Token` |
| Review date | 2026-10-23 |
| Reviewer role | Senior Software Engineer / QA / Production Readiness Reviewer |
| Scope | `app/routes/forgot-password.js`, `public/assets/js/forgot-password.js`, `test/004-password-embedded-in-jwt-reset-token.test.js`, `README.md` §8.12 |
| Environment | Node.js v24.19.0; local non-production MySQL (`NODE_ENV=nonprod`); no production data or SMTP used |
| Repository changes made by this review | None (verification scripts were kept in `/tmp/opencode`; only this report is added) |

---

## 1. Change Summary

| Item | Detail |
| --- | --- |
| Problem | The reset-token endpoint received the stored password/hash, embedded it in an unused JWT payload, derived the signing secret from it (`JWT_SECRET + password`), AES-encrypted the JWT, then discarded all of it and used a fresh UUID. |
| Server change | Removed `jsonwebtoken`, `crypto-js`, `JWT_SECRET`, `req.body.password`, `PAYLOAD`, `SECRET`, `TOKEN`, `ciphertext`, `encoded`, `decoded`, and `bytes` from `app/routes/forgot-password.js`. The route now builds only a fresh UUID token, link, 60-minute expiry, and the five-field insert object. |
| Client change | `public/assets/js/forgot-password.js` no longer reads `res.password` and no longer posts `password` to `/api/post/create-reset-token`. |
| Test added | `test/004-password-embedded-in-jwt-reset-token.test.js` — 7 source-invariant regression guards. |
| Documentation | `README.md` §8.12 corrected from “JWT Lifecycle” to the UUID reset-token lifecycle. |
| Preserved | Endpoint path, `message: 'reset tokens saved'`, response property names, link shape `<AWT_HOSTNAME>reset-password/<uuid>`, 60-minute expiry, `reset_tokens` insertion order, email endpoint contract, GET/POST reset handlers, and `PasswordResetService` bcrypt cost 12. |
| JWT status | The JWT/AES block was still present at `HEAD` and was removed in the working tree; it was not already removed. |

### Traceability — code change to test cases

| Code change | Expected behavior | Test cases |
| --- | --- | --- |
| Removed JWT/AES/password-derived secret from the route | No JWT, AES, `JWT_SECRET + password`, or password handling in the create-reset-token route | A-01, S-01, M-05, M-19 |
| Removed `req.body.password` read | Legacy clients may still send `password`; it is ignored | A-01, M-02, M-03, M-09, M-10, M-11 |
| Kept `uuidV4()` token and link | Link token is a fresh UUID v4, not a JWT or ciphertext | A-01, M-01, M-04, M-05, M-15 |
| Kept 60-minute expiry | Inserted expiration is approximately one hour ahead | A-01, M-01, M-06 |
| Kept `RESET_TOKENS.CREATE` parameterized insert | Same five columns and parameter order; user input is data | M-06, M-12, M-13 |
| Kept response shape and message | `{ message: 'reset tokens saved', uuid, link, receiverEmailAddress }` | A-01, M-01, M-02 |
| Client no longer sends `res.password` | Client posts only `uuid` and `email_or_social_media` | A-01, S-03 |
| `PasswordResetService` untouched | Reset still stores only a bcrypt cost-12 hash | A-02, M-17 |
| README corrected | Documentation describes the UUID flow | Documentation diff review |

---

## 2. Test Scenarios and Results

### 2.1 Automated tests

| ID | Test file | Objective | Command | Expected | Actual | Status |
| --- | --- | --- | --- | --- | --- | --- |
| A-01 | `test/004-password-embedded-in-jwt-reset-token.test.js` | No JWT/AES/password handling; UUID/link/insert remain | `node --test test/004-password-embedded-in-jwt-reset-token.test.js` | 7 passed | 7 passed, 0 failed | PASS |
| A-02 | `test/password-reset.test.js` | Finding 3 bcrypt behavior remains intact | `node --test test/password-reset.test.js` | 17 passed | 17 passed, 0 failed | PASS |
| A-03 | `test/003.2-plaintext-password-storage-on-reset.test.js` | Finding 3 hashing regression | `node --test test/003.2-plaintext-password-storage-on-reset.test.js` | 11 passed | 11 passed, 0 failed | PASS |
| A-04 | `test/login.test.js` | Login regression | `node --test test/login.test.js` | 34 passed | 34 passed, 0 failed | PASS |
| A-05 | `test/search-businesses.test.js` | Search regression | `node --test test/search-businesses.test.js` | 13 passed | 13 passed, 0 failed | PASS |

### 2.2 Manual runtime tests

These were executed against an isolated Express instance that mounted the real `app/routes/forgot-password.js` module and the real local non-production MySQL connection. No production data, credentials, or SMTP were used.

| ID | Scenario / Input | Expected | Actual | Status |
| --- | --- | --- | --- | --- |
| M-01 | New client: `uuid` + `email_or_social_media`, no `password` | 200; exact response shape; UUID link; DB row; ~60-minute expiry | Verified: 200, `reset tokens saved`, UUID link, row persisted, expiry ~60 minutes | PASS |
| M-02 | Legacy client still sends `password=LegacyValue123!` | Password ignored; not in response or DB; still creates a token | Verified: ignored; no value in response or insert values; distinct token created | PASS |
| M-03 | Legacy client sends a stored bcrypt hash in `password` | Hash ignored; not in response or DB | Verified: ignored | PASS |
| M-04 | Two consecutive requests for the same UUID | Two distinct UUID tokens | Verified: two distinct tokens | PASS |
| M-05 | Inspect response, link, and DB rows | No JWT, no `eyJ` value, no credential material | Verified: link token is a UUID; no JWT; no password/hash | PASS |
| M-06 | Inspect insert SQL and parameter values | 5 columns in order: token, expiration, uuid, createdAt, updatedAt | Verified against real DB and mocked DB | PASS |
| M-07 | Missing `uuid` and missing email | Existing behavior; no new JWT-related crash | 200; row created with NULL uuid (pre-existing behavior) | PASS (observed) |
| M-08 | Missing email only | Existing behavior; no crash | 200; token created | PASS (observed) |
| M-09 | `password` scalar | Ignored | 200; ignored | PASS |
| M-10 | `password[]` array | Ignored | 200; ignored | PASS |
| M-11 | `password[x]` object | Ignored | 200; ignored | PASS |
| M-12 | SQL-shaped `uuid` (`x' OR '1'='1`) | Stored as data; no SQL injection | Stored literally; no injection | PASS |
| M-13 | SQL-shaped email (`' OR 1=1 --`) | Treated as data | Echoed and stored as data | PASS |
| M-14 | 263-character email | No crash | Token created | PASS |
| M-15 | 500-character `uuid` | Existing DB behavior; no new JWT issue | Insert failed with `ER_DATA_TOO_LONG`; route logged the raw error and never responded; request hung until the test command timed out | **FAIL — pre-existing, not introduced by Task 004** |
| M-16 | `GET /reset-password/:token` using the token from M-01 | Render reset form with account email | 200; form rendered; account email present | PASS |
| M-17 | `POST /reset-password/:token` with matching new password | `reset password successfully`; bcrypt cost-12 hash stored | Verified: success; hash cost 12; new password verifies; old password no longer verifies | PASS |
| M-18 | `POST /reset-password/:token` with mismatched confirmation | `reset password failed`; existing hash unchanged | Verified | PASS |
| M-19 | Email template contract | Template uses `code` and `link`; no JWT | Verified in `public/view/email/request-for-change-password.handlebars` | PASS |

### 2.3 Static checks

| ID | Check | Expected | Actual | Status |
| --- | --- | --- | --- | --- |
| S-01 | Grep for `jsonwebtoken`, `jwt.sign`, `jwt.verify`, `jwt.decode`, `CryptoJS`, `JWT_SECRET`, `PAYLOAD`, `SECRET`, `ciphertext`, `encoded`, `decoded`, `bytes`, `req.body.password` | No forbidden matches in the reset-token route | Only legitimate `RESET_TOKENS` / `RESET_TOKEN_TTL_MS` matches; no forbidden symbols | PASS |
| S-02 | Grep callers of `create-reset-token` / `createResetToken` | Only the forgot-password client | Only `public/assets/js/forgot-password.js` and the test file | PASS |
| S-03 | Grep `res.password` / `password:` in the client | No matches | No matches | PASS |
| S-04 | `node --check` on route, client, and test | Valid syntax | All valid | PASS |
| S-05 | Prettier formatting | Clean | Fails because the files use CRLF line endings that also exist at `HEAD`; after LF normalization the files conform to `.prettierrc.js` | PASS with pre-existing CRLF caveat |
| S-06 | README §8.12 diff review | UUID flow documented; no unrelated rewrite | Only §8.12 changed | PASS |

### 2.4 Not executed

| Scenario | Reason | Required evidence before relying on it |
| --- | --- | --- |
| Actual SMTP email delivery | Avoided sending a real email from the local environment | Run in a safe test inbox/SMTP environment and confirm the link and `code` render correctly |
| Login through `/api/post/login-process` after reset | The reset flow was verified with `bcrypt.compare`; the login route was not exercised in this review | Log in with the newly reset password against a disposable local account |
| Full `npm run dev` boot | The real route module was mounted in isolation to avoid starting cron jobs, Socket.io, and the full server | Start the app and repeat the manual flow if a full boot regression check is required |
| Token invalidation and expiry enforcement | Out of scope for Task 004 (Findings 19/23/49) | Separate task and tests |
| Browser-level XSS execution | The reset form uses escaped EJS output; no browser automation was run | Add browser/E2E coverage if required |

---

## 3. Test Execution Summary

| Category | Passed | Failed | Skipped | Not executed |
| --- | ---: | ---: | ---: | ---: |
| Automated (`node --test`, 5 files) | 82 | 0 | 0 | 0 |
| Manual runtime | 18 | 1 | 0 | 4 |
| Static checks | 6 | 0 | 0 | 0 |

- Automated total: 7 + 17 + 11 + 34 + 13 = **82 passed, 0 failed**.
- Manual runtime total: **18 passed, 1 failed** (M-15, pre-existing long-UUID insert failure).
- The failed boundary case is not a regression from Task 004. It exposes a pre-existing error-handling defect: the route logs the raw database error and does not send a response when the insert fails.
- All disposable `reset_tokens` and `users_accounts` rows created during verification were deleted.
- No production credentials, personal information, or production data were exposed in test output.
- `npm test` remains the intentional repository stub (`echo "Error: no test specified" && exit 1`); `node --test` was used as required by the task document.

---

## 4. Defects Found

| ID | Severity | Introduced by Task 004? | Description | Root cause | Recommended remediation |
| --- | --- | --- | --- | --- | --- |
| D-1 | Medium | No — pre-existing | `POST /api/post/create-reset-token` hangs when the database insert fails (observed with a 500-character `uuid`, `ER_DATA_TOO_LONG`). The error is logged and no HTTP response is sent. | Error branch only calls `console.log(err)`; no input length validation; no error response or `next(err)`. | Validate `uuid` and email length; always respond with a safe 400/500; do not log raw SQL. This belongs to Findings 32/43. |
| D-2 | High | No — pre-existing | `/api/post/forgot-password-process` still returns the stored password/hash to the client (Finding 50). The client no longer consumes it, but the API leak remains. | The model response includes `password: res[0].password`. | Stop returning the password/hash from that endpoint; update any consumers. |
| D-3 | High | No — pre-existing | Reset-token and reset-email endpoints have no authentication or rate limiting. `send-email-for-change-password` accepts `receiverEmailAddress` and `link` from the request body. | Findings 6 and 51; the email endpoint trusts client-supplied recipient/link. | Add rate limiting; restrict the email endpoint to server-generated state; do not accept arbitrary recipient/link from the client. |
| D-4 | Medium | No — pre-existing | Reset tokens are not invalidated after use; expiry is not enforced in the GET/POST handlers; invalid tokens can trigger a null dereference. | `findUserAccountByResetToken` does not check null, expiry, or `used` (Findings 19/23/49). | Check null/expiry/used; delete the token after a successful reset. |
| D-5 | Low | Working-tree hygiene | `git status` shows unrelated CRLF-only changes in about 20 files plus `PROMPT_*` edits. This violates the task's “diff only §6 files” acceptance criterion. | Line-ending conversion happened outside the Task 004 functional change. | Commit only the intended 004 files; normalize line endings in a separate explicit change. |
| D-6 | Low | Test design limitation | The 004 test is source-invariant only; it does not execute the route, so it cannot catch a wrong insert order or wrong expiry value. | The route is registered inline and the task chose source-invariant tests. | Optional: add a dependency-injected behavioral test that mounts the route and asserts the response/insert values. |
| D-7 | Low | No | `jsonwebtoken` is now unused in application code (only a comment remains in `app/src/server.js`). | Finding 41. | Remove the dependency in a separate change. |
| D-8 | Low | Documentation | README §8.12 omits the separate `send-email-for-change-password` step. | Diagram simplification. | Optionally add the email step to the diagram. |

---

## 5. Security and Regression Findings

- **Credential removal verified:** the reset-token route no longer imports or uses `jsonwebtoken`, `crypto-js`, `JWT_SECRET`, or `req.body.password`. Grep sweeps found no forbidden symbols in the route or client.
- **Token strength:** the only reset token is a server-generated UUID v4. Repeated requests produced distinct tokens; link segments were UUIDs, never dot-separated JWTs.
- **SQL injection:** the insert remains parameterized. SQL-shaped `uuid` and email values were treated as data; no syntax error, data leak, or bulk-row behavior occurred.
- **Credential exposure:** the Task 004 route does not return, store, or log a password, hash, JWT, or secret. The pre-existing Finding 50 leak from the forgot-password lookup remains, but the client no longer consumes it.
- **Regression:** all 82 automated tests passed. The full create-token → GET reset form → POST reset → bcrypt verification flow passed. `PasswordResetService` remains the only reset-password hashing path and uses bcrypt cost 12.
- **Remaining risk:** the endpoints are public and unauthenticated, with no rate limiting. The long-UUID case can occupy a request indefinitely when the insert fails. These are pre-existing and explicitly out of scope for Task 004.
- **Data integrity:** no schema change. Inserted reset-token rows contained only the expected five fields; all test rows were cleaned up.

---

## 6. Production Readiness Decision

**READY WITH CONDITIONS** for the scoped Finding 4 change.

### Evidence

- The credential-bearing JWT/AES pipeline is gone; the UUID reset-token mechanism is preserved and behaviorally verified against the local non-production database.
- All 82 automated tests pass, including the Finding 3 bcrypt regression tests and the new 004 guard.
- The full token → reset-form → reset-password flow works with bcrypt cost 12 and no plaintext storage.
- No regression was found in the login or search tests.

### Conditions

1. Clean the working tree so only the intended 004 files are committed; do not bundle the unrelated CRLF churn or prompt artifacts.
2. Accept and document the pre-existing issues in D-1 through D-4 and D-7, or schedule them separately.
3. Perform a safe-environment SMTP/email delivery check before relying on the complete email flow; it was intentionally not executed in this review.
4. Do not treat this decision as a whole-system production-readiness certification. Only the Task 004 scope was reviewed and tested.

---

## 7. Remaining Actions

1. **Before commit:** stage only `app/routes/forgot-password.js`, `public/assets/js/forgot-password.js`, `test/004-password-embedded-in-jwt-reset-token.test.js`, and `README.md` (plus the task document if intended). Exclude CRLF-only changes and prompt artifacts.
2. **Fix D-1 separately:** validate `uuid`/email length and always respond on database failure; stop logging raw SQL errors.
3. **Fix Finding 50:** stop returning the stored password/hash from `/api/post/forgot-password-process`.
4. **Fix Findings 19/23/49:** enforce expiry, reject null/used/invalid tokens, and delete tokens after a successful reset.
5. **Fix Findings 6/51:** add authentication/rate limiting and stop trusting client-supplied `receiverEmailAddress`/`link` on the email endpoint.
6. **Finding 41:** remove the now-unused `jsonwebtoken` dependency in a separate change.
7. **Optional:** add a behavioral test for `create-reset-token` to guard insert order, TTL, and response shape in addition to the source-invariant checks.
8. **Optional:** update README §8.12 to include the `send-email-for-change-password` step.

---

## 8. Commands and Evidence

### Automated tests

```bash
node --test test/004-password-embedded-in-jwt-reset-token.test.js
# tests 7, pass 7, fail 0

node --test test/password-reset.test.js
# tests 17, pass 17, fail 0

node --test test/003.2-plaintext-password-storage-on-reset.test.js
# tests 11, pass 11, fail 0

node --test test/login.test.js
# tests 34, pass 34, fail 0

node --test test/search-businesses.test.js
# tests 13, pass 13, fail 0
```

### Grep sweeps

```bash
grep -rn "jsonwebtoken\|jwt\.sign\|jwt\.verify\|jwt\.decode" app public test --include=*.js
# only app/src/server.js comment and the 004 test file

grep -rn "create-reset-token\|createResetToken" app public test --include=*.js --include=*.ejs
# only app/routes/forgot-password.js, public/assets/js/forgot-password.js, and the 004 test

grep -n "res.password\|password:" public/assets/js/forgot-password.js
# no matches

grep -n "jwt\|jsonwebtoken\|CryptoJS\|JWT_SECRET\|PAYLOAD\|SECRET\|TOKEN\|ciphertext\|encoded\|decoded\|bytes\|req.body.password" app/routes/forgot-password.js
# only legitimate RESET_TOKENS / RESET_TOKEN_TTL_MS matches
```

### Runtime verification highlights

- New client (no password): 200, exact response shape, UUID link, DB row, expiry approximately 60 minutes.
- Legacy client (password included): ignored; no password/hash in response or DB; distinct token created.
- SQL-shaped `uuid` and email: treated as data; no injection.
- Full flow: create token → GET form renders account email → POST new password → bcrypt cost-12 hash stored → old password fails; mismatch rejected without overwriting.
- Boundary failure: 500-character `uuid` produced `ER_DATA_TOO_LONG`, the route logged the error and did not respond, and the request hung. This is pre-existing behavior.

### Cleanup

All disposable `reset_tokens` and `users_accounts` rows created during verification were deleted. No production data or credentials were used or exposed.

---

## 9. Final Status

**PASS for the Finding 4 implementation**, with the conditions and pre-existing risks listed above.

The Task 004 code change is functionally correct and regression-tested. The working tree is not yet clean enough to commit as-is because of unrelated line-ending churn and prompt-file edits.
