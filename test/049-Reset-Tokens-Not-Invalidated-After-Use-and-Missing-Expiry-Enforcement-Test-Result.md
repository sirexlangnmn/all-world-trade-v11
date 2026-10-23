# Test Result — 049 Reset Tokens Not Invalidated After Use and Missing Expiry Enforcement

| Field                | Value                                                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document             | `test/049-Reset-Tokens-Not-Invalidated-After-Use-and-Missing-Expiry-Enforcement-Test-Result.md`                                                    |
| Task under test      | `docs/tasks/049-Reset-Tokens-Not-Invalidated-After-Use-and-Missing-Expiry-Enforcement.md`                                                          |
| Source finding       | `CODE_REVIEW.md` → Finding 49 (canonical; duplicate Finding 23)                                                                                    |
| Reviewed scope       | `GET`/`POST /reset-password/:token` token validation, single-use invalidation, expiry enforcement, response contract, password-reset service usage |
| Environment          | Linux, Node.js v24.19.0, npm 12.0.2, in-repo `node:test` + `node:assert`                                                                           |
| Test file            | `test/049-reset-token-invalidation-and-expiry.test.js` (untracked, added)                                                                          |
| Overall result       | **18/18 focused tests pass; 69/69 consolidated related tests pass. Live DB/SMTP end-to-end not executed (see C).**                                 |
| Production readiness | **READY WITH CONDITIONS**                                                                                                                          |

---

## A. Change Summary

### What changed

The working tree contains the Finding 49 implementation. This review inspected it end to end, ran the focused and related regression suites, strengthened the focused test with one missing-password retention case, and applied Prettier to the new test file. No production code was modified during this review.

| File                                                                                   | Change                                                                                                                                                                                                                                                                                                                                                                                              | Purpose                                                                       |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `app/routes/forgot-password.js`                                                        | Added `isNonEmptyString`, `isResetTokenExpired` (fails closed), and a shared `findUserAccountByResetToken` that rejects empty/missing/expired tokens and returns `{ resetToken, userAccount }`. GET returns 404 generic message for invalid tokens. POST returns the legacy failure string and, on success, calls `reset_tokens.destroy({ where: { token } })` before returning the success string. | Enforce expiry on GET/POST and make reset tokens single-use.                  |
| `test/049-reset-token-invalidation-and-expiry.test.js`                                 | **Added.** 18 offline `node:test` cases capturing the real route handlers with a fake Express app and stubbing Sequelize models.                                                                                                                                                                                                                                                                    | Prove single-use behavior, expiry enforcement, safe failure paths, contracts. |
| `app/db_models/reset_tokens.model.js`                                                  | Reference only, unchanged.                                                                                                                                                                                                                                                                                                                                                                          | Confirms `expiration` is `Sequelize.DATE` and `destroy` is available.         |
| `app/query/reset_tokens.query.js`                                                      | Reference only, unchanged.                                                                                                                                                                                                                                                                                                                                                                          | Confirms the existing insert/TTL is untouched.                                |
| `app/services/password-reset.service.js`                                               | Reference only, unchanged.                                                                                                                                                                                                                                                                                                                                                                          | Server-side bcrypt cost 12 and validation remain the only write path.         |
| `public/assets/js/reset-password.js`, `public/view/reset-password/index.ejs`           | Reference only, unchanged.                                                                                                                                                                                                                                                                                                                                                                          | Success string and `password`/`password2` form contract preserved.            |
| `app/controllers/forgot-password.controller.js`, `app/models/forgot-password.model.js` | Reference only, unchanged.                                                                                                                                                                                                                                                                                                                                                                          | Finding 50 isolation maintained.                                              |

### Implementation behavior (verified in source)

- Shared helper: `app/routes/forgot-password.js:157-195`
    - rejects non-string/empty tokens before any query;
    - `findOne({ where: { token } })` (Sequelize binding);
    - returns `null` when the row is missing;
    - treats `expiration <= Date.now()` and invalid/unparseable expiration as expired (fail closed);
    - only then looks up the account and returns `null` if it is missing;
    - returns both records so POST can delete the exact token.
- GET: `app/routes/forgot-password.js:197-211` — invalid token → `404 'Invalid or expired reset token'`, no account email disclosure, no render.
- POST: `app/routes/forgot-password.js:213-235` — invalid token → HTTP 200 `'reset password failed'`, no update/delete; valid token → `setNewPassword` → `destroy({ where: { token } })` → `'reset password successfully'`. A deletion failure is logged and reported as failure.

### Preserved contracts

- Success response remains exactly `'reset password successfully'` (`public/assets/js/reset-password.js:28`).
- POST failure remains `'reset password failed'` with HTTP 200.
- Token UUID format, emailed link format, and one-hour TTL unchanged.
- `PasswordResetService` validation + bcrypt cost 12 + `silent: true` update unchanged.
- `used` column remains unused; only the used token is deleted, not all tokens for the user.

---

## B. Test Scenarios

### B.1 Focused automated scenarios (`test/049-reset-token-invalidation-and-expiry.test.js`)

| ID        | Feature / Module   | Objective                                                | Preconditions / Test data                                                    | Procedure and input               | Expected result                                                                                                                  | Actual result | Status |
| --------- | ------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------ |
| TC-049-01 | GET reset form     | Valid token renders form with account email              | Token row `expiration = now + 1h`; account exists                            | Invoke captured real GET handler  | Render `.../reset-password/index` with `email`; bound `{token}` then `{uuid}`                                                    | As expected   | PASS   |
| TC-049-02 | POST reset         | Success updates, deletes only used token, then returns   | Valid token; valid `password`/`password2`; stubbed update/destroy            | Invoke captured real POST handler | Exactly one update with `{where:{uuid},silent:true}`; one destroy `{where:{token}}`; writes `['update','destroy']`; body success | As expected   | PASS   |
| TC-049-03 | GET missing token  | Reject missing token generically, no account lookup      | `tokenRow = null`                                                            | GET `does-not-exist`              | HTTP 404 `Invalid or expired reset token`; zero account lookups; no writes                                                       | As expected   | PASS   |
| TC-049-04 | POST missing token | Reject missing token with legacy failure                 | `tokenRow = null`                                                            | POST `does-not-exist`             | HTTP 200 `reset password failed`; zero account lookups; no writes                                                                | As expected   | PASS   |
| TC-049-05 | Empty token        | Reject before any database call                          | n/a                                                                          | GET/POST `''`                     | GET non-render, POST failure; zero token lookups; no writes                                                                      | As expected   | PASS   |
| TC-049-06 | Orphan token       | Token row without matching account fails safely          | Token row exists; `account = null`                                           | GET then POST valid token         | GET 404; POST failure; token not deleted                                                                                         | As expected   | PASS   |
| TC-049-07 | Malicious input    | Long/SQL-shaped/Unicode tokens remain bound values       | `10000×'a'`, `' OR '1'='1`, `" OR 1=1 --`, `%_\`, `tökén-🦄`; token row null | POST each                         | Failure each time; each lookup is `where: { token: <input> }`; no interpolation                                                  | As expected   | PASS   |
| TC-049-08 | GET expired        | Expired token rejected before account lookup             | `expiration = now - 1h`                                                      | GET valid token                   | HTTP 404 generic; zero account lookups; no writes                                                                                | As expected   | PASS   |
| TC-049-09 | POST expired       | Expired token never updates/deletes                      | `expiration = now - 1h`                                                      | POST valid token                  | HTTP 200 failure; zero account lookups; no update/destroy                                                                        | As expected   | PASS   |
| TC-049-10 | Expiry boundary    | Expiration equal to now is expired                       | `expiration = new Date()`                                                    | GET and POST                      | GET 404, POST failure; no writes                                                                                                 | As expected   | PASS   |
| TC-049-11 | Invalid expiration | Null/empty/unparseable/undefined expiration fails closed | `null`, `''`, `'not-a-date'`, `undefined`                                    | GET and POST each                 | GET 404, POST failure each; no writes                                                                                            | As expected   | PASS   |
| TC-049-12 | Future expiration  | Comfortably future token accepted                        | `expiration = now + 60s`                                                     | GET then POST                     | GET renders; POST success; exactly one destroy                                                                                   | As expected   | PASS   |
| TC-049-13 | Single-use         | Same token cannot reset twice                            | Valid token; sequential POSTs                                                | POST, then POST again             | First success; second failure; exactly one update and one destroy                                                                | As expected   | PASS   |
| TC-049-14 | Single-use GET     | Used token cannot render the form again                  | Valid token; successful POST first                                           | POST then GET                     | GET HTTP 404 generic                                                                                                             | As expected   | PASS   |
| TC-049-15 | GET non-mutation   | GET never deletes the token                              | Valid token                                                                  | GET                               | Zero destroys; token row still present                                                                                           | As expected   | PASS   |
| TC-049-16 | Validation failure | Confirmation mismatch does not delete token              | Valid token; `password2 = 'different'`                                       | POST                              | Failure; no update/destroy                                                                                                       | As expected   | PASS   |
| TC-049-17 | Missing fields     | Missing password fields keep token for retry             | Valid token; `body = {}`                                                     | POST                              | HTTP 200 failure; no update/destroy; token row still present                                                                     | As expected   | PASS   |
| TC-049-18 | Delete failure     | Deletion failure must not report success                 | Valid token; `destroy` throws `delete failed`                                | POST                              | Failure body; one update (password may have changed); error logged                                                               | As expected   | PASS   |

### B.2 Regression scenarios

| ID        | Suite                                                    | Objective                                                        | Input / Precondition              | Expected result | Actual result | Status |
| --------- | -------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------- | --------------- | ------------- | ------ |
| TC-049-19 | `test/password-reset.test.js`                            | Finding 3 bcrypt reset service intact                            | 17 existing service tests         | All pass        | 17/17 pass    | PASS   |
| TC-049-20 | `test/003.2-plaintext-password-storage-on-reset.test.js` | Reset route stores only bcrypt cost-12 hash, ignores `password3` | 11 existing route-level tests     | All pass        | 11/11 pass    | PASS   |
| TC-049-21 | `test/004-password-embedded-in-jwt-reset-token.test.js`  | Finding 4 removal of password-bearing JWT/AES remains intact     | 7 existing source-invariant tests | All pass        | 7/7 pass      | PASS   |
| TC-049-22 | `test/050-forgot-password-response.test.js`              | Finding 50 no credential disclosure in forgot-password response  | 16 existing tests                 | All pass        | 16/16 pass    | PASS   |

### B.3 Manual / static scenarios

| ID        | Activity             | Procedure                                                                                     | Expected                                                                 | Actual                                                                                              | Status                 |
| --------- | -------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ---------------------- |
| TC-049-23 | Consumer sweep       | `grep -rn "findUserAccountByResetToken" app test --include=*.js`                              | Only GET and POST reset handlers consume the helper                      | Exactly `forgot-password.js:173,198,216`                                                            | PASS                   |
| TC-049-24 | Deletion scope sweep | `grep -n "destroy" app/routes/forgot-password.js`                                             | One destroy, by exact token, only in POST                                | `reset_tokens.destroy({ where: { token } })` at line 228 only                                       | PASS                   |
| TC-049-25 | `used` column audit  | Inspect `reset_tokens.model.js`, query, and route for `used` writes                           | No `used` semantics introduced                                           | `used` declared but never written; deletion approach used as specified                              | PASS                   |
| TC-049-26 | SQL-binding review   | Inspect helper/destroy source                                                                 | Parameterized Sequelize only                                             | `findOne({where:{token}})`, `destroy({where:{token}})`, `findOne({where:{uuid}})`; no interpolation | PASS                   |
| TC-049-27 | Token logging sweep  | `grep -rn "req.params.token\|resetToken\|reset-password" app/middleware app/src app/services` | No token logging added                                                   | No matches                                                                                          | PASS                   |
| TC-049-28 | Response contract    | Inspect `public/assets/js/reset-password.js` and route constants                              | Success string exactly `'reset password successfully'`; POST failure 200 | Matches; client still compares the exact success string                                             | PASS                   |
| TC-049-29 | Route registration   | `grep -n "forgot-password" app/src/server.js`                                                 | Route module still registered                                            | `require('../routes/forgot-password.js')(app)` at line 166                                          | PASS                   |
| TC-049-30 | Formatting           | `npx prettier --write` on the new test; `--check --end-of-line crlf` on the legacy route      | New test formatted; edited legacy route matches repo CRLF style          | Both pass                                                                                           | PASS                   |
| TC-049-31 | Diff scope           | `git status --short` / `git diff --stat` for the task files                                   | Only route + new test changed for this task                              | `M app/routes/forgot-password.js`, `?? test/049-...test.js` (unrelated working-tree churn predates) | PASS                   |
| TC-049-32 | Live end-to-end      | Disposable local DB/SMTP: request reset → email link → GET → POST → reuse → login             | Token row deleted; reuse rejected; login works                           | **Not executed**                                                                                    | BLOCKED / NOT EXECUTED |

---

## C. Test Execution Summary

### Commands executed

```bash
node --test test/049-reset-token-invalidation-and-expiry.test.js

node --test \
  test/049-reset-token-invalidation-and-expiry.test.js \
  test/password-reset.test.js \
  test/003.2-plaintext-password-storage-on-reset.test.js \
  test/004-password-embedded-in-jwt-reset-token.test.js \
  test/050-forgot-password-response.test.js

npx prettier --write test/049-reset-token-invalidation-and-expiry.test.js
npx prettier --check test/049-reset-token-invalidation-and-expiry.test.js
npx prettier --check --end-of-line crlf app/routes/forgot-password.js
```

### Results (actual)

| Suite                                               | Tests  | Passed | Failed | Skipped | Status   |
| --------------------------------------------------- | ------ | ------ | ------ | ------- | -------- |
| `049-reset-token-invalidation-and-expiry.test.js`   | 18     | 18     | 0      | 0       | PASS     |
| `password-reset.test.js`                            | 17     | 17     | 0      | 0       | PASS     |
| `003.2-plaintext-password-storage-on-reset.test.js` | 11     | 11     | 0      | 0       | PASS     |
| `004-password-embedded-in-jwt-reset-token.test.js`  | 7      | 7      | 0      | 0       | PASS     |
| `050-forgot-password-response.test.js`              | 16     | 16     | 0      | 0       | PASS     |
| **Consolidated**                                    | **69** | **69** | **0**  | **0**   | **PASS** |

Focused runner output (tail):

```text
✔ GET renders the reset form with the account email for a valid token
✔ POST updates the password, deletes exactly the used token, then succeeds
✔ GET rejects a missing token with a generic 404 and does not look up the account
✔ POST rejects a missing token with the legacy failure string and writes nothing
✔ an empty token is rejected before any database lookup
✔ a token row without a matching account fails safely and is not deleted
✔ very long and SQL-shaped tokens are passed as bound Sequelize values
✔ GET rejects an expired token without looking up the account
✔ POST rejects an expired token without updating or deleting anything
✔ an expiration at or before now is treated as expired
✔ null, empty, and unparseable expirations fail closed
✔ a token with a comfortable future expiration is accepted
✔ a reused token cannot reset the password a second time
✔ a reused token cannot render the reset form after a successful reset
✔ GET does not delete the token
✔ a password validation failure does not delete the token
✔ missing password fields keep the valid token for a retry
✔ a token deletion failure does not report success
ℹ tests 18
ℹ pass 18
ℹ fail 0
ℹ skipped 0
```

Consolidated runner output (tail):

```text
ℹ tests 69
ℹ suites 0
ℹ pass 69
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5108.193833
```

### Scenario-level accounting

| Category                                    | Count                                 |
| ------------------------------------------- | ------------------------------------- |
| Automated scenarios executed and passed     | 22 (TC-049-01…22)                     |
| Manual/static scenarios executed and passed | 9 (TC-049-23…31)                      |
| Scenarios blocked / not executed            | 1 (TC-049-32 live DB+SMTP end-to-end) |
| **Total scenarios**                         | **32**                                |

### Environment limitations

- `npm test` is an intentionally failing stub. Focused tests were run with `node --test` as the repository convention requires.
- No isolated local MySQL/SMTP environment is available. `.env` points at the deployed environment, and booting `app/src/server.js` runs `db.sequelize.sync()` and can send real email. The live end-to-end flow was therefore **not** executed. All automated tests are fully offline: the legacy mysql2 module is stubbed before the route import, and Sequelize models are stubbed.
- The focused test imports the route module, which opens no socket because `app/models/db.js` is replaced in `require.cache`; the real pool is never used.
- Repo-wide `npm run lint` is `npx prettier --write .` and would rewrite unrelated files (the working tree already contains unrelated churn). Formatting was applied only to the new test and checked on the edited legacy route with CRLF-compatible settings.

---

## D. Defects Found

| ID       | Severity                                   | Status                                  | Description                                                                                                                                                                                       | Root cause                                                                   | Recommended fix                                                                                                                                              |
| -------- | ------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | ---------------------------------------------------------------------------------------- |
| D-049-01 | Low (pre-existing, out of scope)           | Open — separate ticket                  | POST destructures `req.body` (`const { password, password2 } = req.body`) **before** token validation. A request with no body/JSON parser result rejects instead of returning the legacy failure. | Pre-existing route shape; task §13 explicitly says not to change it here.    | Add `req.body                                                                                                                                                |     | {}` or a body guard in a separate hardening task; verify the client always sends a body. |
| D-049-02 | Medium residual security risk (documented) | Accepted — not fixed in this task scope | Two truly concurrent POSTs can both pass the token lookup before either deletes the row, so both may update the password. Sequential reuse is prevented; strict at-most-once is not guaranteed.   | No transaction/row lock; task §13 explicitly forbids a transaction redesign. | Add a transaction with `SELECT ... FOR UPDATE`/conditional delete, or use an atomic `UPDATE ... WHERE used = 0`, in a follow-up. Report as residual risk.    |
| D-049-03 | Low residual correctness risk (documented) | Accepted — matches task §9 Step 5       | If `reset_tokens.destroy` throws **after** the password update succeeds, the route reports failure while the password has already changed and the token remains valid.                            | Delete and update are not atomic.                                            | Move both operations into one transaction in a follow-up. Current behavior is the task-specified fail-safe (do not report success when invalidation failed). |
| D-049-04 | Informational (pre-existing, out of scope) | Open — separate ticket                  | On a render error, GET sends `error.message` to the client, which can leak internal details.                                                                                                      | Pre-existing `catch` block.                                                  | Replace with a generic 500 message in a separate hardening task.                                                                                             |
| D-049-05 | Informational (pre-existing, out of scope) | Open — separate ticket                  | No rate limiting on the reset endpoints (Finding 51), and the token row's `used` column remains unused (intentionally, per task).                                                                 | Separate findings.                                                           | Track Findings 51 and 49-follow-up separately.                                                                                                               |

No release-blocking defect was found in the reviewed change.

---

## E. Security and Regression Findings

### Security

- Missing, empty, malformed, very long, and SQL-shaped tokens never reach SQL string interpolation; they are passed as bound Sequelize values and rejected safely.
- A missing/expired/orphaned token no longer causes a `TypeError`/500; GET returns a generic 404 and POST returns the legacy failure string.
- POST does not update the password or delete anything for invalid/expired tokens.
- GET does not delete tokens and does not disclose the account email for invalid tokens.
- A successful reset deletes exactly the matching token row (`where: { token }`), not all tokens for the user.
- The success string is returned only after `destroy` completes; a deletion failure logs and returns failure.
- Expiry uses epoch comparison and fails closed for null/empty/unparseable/undefined expiration; equality with `Date.now()` is rejected.
- No token, password, or hash is logged by the new code; the token-logging sweep found no related logging.
- Password hashing remains server-side bcrypt cost 12 through `PasswordResetService`; unchanged and covered by existing tests.
- Residual risks: concurrent double-submit (D-049-02), non-atomic update+delete (D-049-03), missing rate limiting/enumeration protection (Finding 51), and the pre-existing missing-body behavior (D-049-01).

### Regression

- All 51 related pre-existing tests for Findings 3, 4, and 50 still pass.
- The reset page client and EJS form are unchanged; the exact success string and `password`/`password2` (plus ignored legacy `password3`) contract is preserved.
- Token creation, TTL, link format, and the raw insert query are untouched.
- The route module remains registered with `module.exports = (app) => {...}` and the same paths.
- No schema change, dependency change, environment change, CSS change, or migration was introduced.

### Traceability

| Code change / requirement                                  | Covered by                |
| ---------------------------------------------------------- | ------------------------- |
| Shared helper rejects empty/non-string tokens before query | TC-049-05                 |
| Missing token → safe GET 404 / POST failure                | TC-049-03, 04             |
| Missing account → safe failure                             | TC-049-06                 |
| Sequelize binding for token lookups                        | TC-049-07, 26             |
| Expiry enforcement on GET                                  | TC-049-08, 10, 11         |
| Expiry enforcement on POST                                 | TC-049-09, 10, 11         |
| Valid future token still works                             | TC-049-01, 02, 12         |
| Single-use token after success                             | TC-049-02, 13, 14         |
| GET is not a use                                           | TC-049-15                 |
| Validation failure retains token                           | TC-049-16, 17             |
| Deletion failure never reports success                     | TC-049-18                 |
| Only exact token is deleted                                | TC-049-02, 24             |
| No `used` semantics introduced                             | TC-049-25                 |
| No token logging                                           | TC-049-27                 |
| Success/failure string and HTTP contracts preserved        | TC-049-02, 03, 04, 09, 28 |
| Password hashing preserved                                 | TC-049-19, 20             |
| Findings 4 and 50 preserved                                | TC-049-21, 22             |
| Route wiring preserved                                     | TC-049-29                 |
| Formatting / diff hygiene                                  | TC-049-30, 31             |

---

## F. Production Readiness Decision

**READY WITH CONDITIONS**

### Evidence supporting the decision

- 18/18 focused Finding 49 tests pass, exercising the real captured GET/POST handlers.
- 69/69 consolidated related tests pass, including all Finding 3, 4, and 50 regression suites.
- Source review confirms expiry is enforced in one shared helper used by both handlers, the token is deleted only after a successful update, and the deletion targets only the used token.
- Consumer sweep found no other code depending on the old helper return shape.
- The response contract and password-hashing service are unchanged, so the existing client and login flow remain compatible.
- No dependency, schema, environment, or UI change was required.

### Conditions (why not “READY FOR RELEASE” without qualification)

1. The live DB + SMTP end-to-end flow (TC-049-32) was **not executed** because no isolated test environment is provided and the server boot path runs `sequelize.sync()` and sends real email. The route-level behavior is proven offline; database deletion and real email delivery remain unverified in this session.
2. Concurrent double-submit (D-049-02) is a documented residual risk accepted by the task scope.
3. Non-atomic update+delete (D-049-03) can report failure after the password changed; it is the task-specified safe behavior but should be addressed transactionally in a follow-up.
4. Pre-existing out-of-scope items remain: missing-body handling (D-049-01), Finding 51 rate limiting, and any legacy tokens already in the database.

No release-blocking defect was found within the reviewed scope.

---

## G. Remaining Actions

1. **Execute the live end-to-end flow in an isolated staging environment** with a disposable account and test SMTP:
    - request a reset token; confirm one `reset_tokens` row;
    - open the emailed link; confirm the form renders;
    - submit a new password; confirm the exact success string;
    - confirm `SELECT * FROM reset_tokens WHERE token = '<test-token>'` returns zero rows;
    - submit the same token again; confirm `reset password failed` and that the stored hash did not change;
    - GET the same token; confirm 404 generic message;
    - update a token's expiration to the past; confirm GET 404 and POST failure;
    - log in with the new password.
2. **Plan a follow-up for concurrency**: transactional/atomic single-use enforcement (D-049-02) and atomic password-update + token-delete (D-049-03).
3. **Plan separate tickets** for the pre-existing missing-body guard (D-049-01), generic render-error response (D-049-04), rate limiting (Finding 51), and cleanup of pre-existing/legacy reset tokens.
4. **Before commit**: stage only `app/routes/forgot-password.js`, `test/049-reset-token-invalidation-and-expiry.test.js`, and this result document. The working tree contains unrelated modifications from other tasks; do not include them in this change set.

### Finding status summary

| Finding | Status                                                                      |
| ------- | --------------------------------------------------------------------------- |
| 49      | **Fixed in the reviewed working tree** (expiry enforced, token single-use)  |
| 23      | **Fixed by the same change** (duplicate of 49)                              |
| 19      | Minimal null guard added here; broader null/error handling remains separate |
| 50      | Separate, already addressed; unchanged and passing                          |
| 51      | Still present (no rate limiting); separate task                             |
| 3       | Already fixed (server-side bcrypt cost 12); unchanged and passing           |
| 4       | Already fixed (no password-bearing JWT); unchanged and passing              |
