# Finding 19 — Password Reset Null-Handling Test Result

## 1. Scope

This report records verification of [the Finding 19 implementation guide](../docs/tasks/019-Missing-Null-Check-Causing-Crash-in-Password-Reset.md) and the narrowly related password-reset changes.

Finding 19 in `CODE_REVIEW.md` describes `resetToken.uuid` being accessed when the reset-token lookup returns no row. The current route already guards missing/expired token rows and missing account rows in the shared `findUserAccountByResetToken` helper. During review, an adjacent crash case was found: the POST handler destructured `req.body` without guarding against it being absent.

The route now defaults a missing/null body to an empty object before extracting the password fields. The route-level regression test verifies that an explicitly undefined body reaches the ordinary password-validation failure path without a password update or token deletion.

## 2. Changes Under Test

| File                                                                   | Change                                                                                                                                                                 |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/routes/forgot-password.js`                                        | Safely destructure password fields when `req.body` is nullish. Existing token/account null guards remain unchanged.                                                    |
| `test/049-reset-token-invalidation-and-expiry.test.js`                 | Exercises an actually undefined body and confirms token/account lookup proceeds, the request fails safely, and no writes occur. Also verifies lookup errors propagate. |
| `docs/tasks/019-Missing-Null-Check-Causing-Crash-in-Password-Reset.md` | Documents the existing Finding 19 guard and the adjacent absent-body case.                                                                                             |

`app/services/password-reset.service.js` had a separate pre-existing worktree modification and was not changed as part of this verification.

## 3. Test Scenarios and Results

The following scenarios were executed in the targeted Node.js test run. Each listed scenario passed; the suite totals are in Section 4.

| ID     | Feature / objective             | Preconditions and procedure                                                                                              | Expected result                                                                                   | Actual result                                                                               | Status |
| ------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------ |
| RST-01 | Valid reset page                | Stub a valid, unexpired token and matching account; invoke GET.                                                          | Form renders with account email; no writes.                                                       | Rendered with expected email; no writes.                                                    | PASS   |
| RST-02 | Valid password reset            | Submit matching valid password fields with valid token/account.                                                          | Password update occurs, then only the used token is deleted, then success is returned.            | Observed expected order and response.                                                       | PASS   |
| RST-03 | Missing token row               | Return no token row; invoke GET and POST.                                                                                | Existing invalid-token responses; account lookup/write is skipped.                                | GET 404 and POST failure response; no account lookup or writes.                             | PASS   |
| RST-04 | Missing/empty token             | Submit an empty token.                                                                                                   | Reject before database lookup or write.                                                           | No token/account lookup and no writes.                                                      | PASS   |
| RST-05 | Undefined request body          | Submit a valid token with `req.body === undefined`.                                                                      | No destructuring exception; normal password validation failure; no update or token deletion.      | Failure response; token/account checked; no writes.                                         | PASS   |
| RST-06 | Missing account row             | Return a valid token row but no matching account.                                                                        | Controlled invalid response; no null dereference or write.                                        | GET/POST failed safely; no writes.                                                          | PASS   |
| RST-07 | Malformed token values          | Submit long, SQL-shaped, special-character, and Unicode tokens.                                                          | Treat values as bound Sequelize filter data; do not perform writes.                               | Inputs reached `where: { token }`; no writes.                                               | PASS   |
| RST-08 | Expired or malformed expiry     | Test past, current, null, empty, unparseable, and absent expiry values.                                                  | Reject the token without account lookup or writes.                                                | All invalid expiry cases rejected; writes absent.                                           | PASS   |
| RST-09 | Reused reset token              | Complete a reset, then retry the token for POST and GET.                                                                 | The token cannot be reused.                                                                       | Second reset failed; form was not rendered again.                                           | PASS   |
| RST-10 | Password validation and hashing | Run password-reset service and plaintext-storage regression tests for invalid, boundary, Unicode, and SQL-shaped values. | Enforce validation; store only bcrypt hash; preserve existing contract.                           | Targeted service/regression assertions passed.                                              | PASS   |
| RST-11 | Lookup errors                   | Make token and account lookups reject.                                                                                   | Propagate database errors rather than converting them to an invalid-token response; do not write. | Both errors propagated; no writes.                                                          | PASS   |
| RST-12 | Token deletion failure          | Make token deletion fail after password update.                                                                          | Do not report success; log the failure.                                                           | Failure response and log observed; test confirmed the password update had already occurred. | PASS   |

The route-level tests capture the actual handlers registered by the route module but use stubbed Sequelize models and a stubbed legacy database module. They do not exercise a live Express server, middleware stack, or database.

## 4. Test Execution Summary

### Automated test command

```sh
node --test test/049-reset-token-invalidation-and-expiry.test.js test/password-reset.test.js test/003.2-plaintext-password-storage-on-reset.test.js
```

| Result                                |                                                           Count |
| ------------------------------------- | --------------------------------------------------------------: |
| Passed                                |                                                              48 |
| Failed                                |                                                               0 |
| Skipped                               |                                                               0 |
| Cancelled                             |                                                               0 |
| Not executed within this targeted run | Full repository suite and production/database integration tests |

The run emitted a Sequelize `operatorsAliases` deprecation warning. It did not fail a test and was not changed because it is unrelated to Finding 19.

### Additional checks

| Check                                                               | Result                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node --check app/routes/forgot-password.js`                        | PASS                                                                                                                                                                                                                                        |
| `node --check test/049-reset-token-invalidation-and-expiry.test.js` | PASS                                                                                                                                                                                                                                        |
| Prettier check for the task guide and modified route test           | PASS                                                                                                                                                                                                                                        |
| `git diff --check` for scoped changed files                         | PASS                                                                                                                                                                                                                                        |
| Prettier check for `app/routes/forgot-password.js`                  | FAIL — the route file does not match Prettier formatting. The same check also fails against the committed `HEAD` version, confirming the formatting difference predates this change. The file was not reformatted to avoid unrelated churn. |
| Full-project `npm test`                                             | NOT RUN — the full suite may include database-dependent tests; no isolated test database was established for this task.                                                                                                                     |
| Production runtime/database verification                            | NOT RUN — no production service or data was used.                                                                                                                                                                                           |

The repository's `npm run lint` invokes Prettier with `--write` over the whole project, so it was not run as a non-destructive verification command.

## 5. Defects Found

| Defect                                                                                                       | Severity                                                      | Root cause                                                               | Resolution                                                                                               |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| A reset POST with an absent/null request body could throw during destructuring before controlled validation. | Reliability defect; no severity assigned by `CODE_REVIEW.md`. | The handler accessed `req.body.password` fields without a nullish guard. | Fixed with `const { password, password2 } = req.body ?? {};`; verified by the undefined-body route test. |

The original Finding 19 null dereference was not present in the current shared lookup helper. Existing missing-token and missing-account guards were verified rather than duplicated.

No other defect was identified within the tested scope.

## 6. Security and Regression Findings

- Missing or invalid token/account results do not reach password updates or token deletion.
- Token values continue to be passed to Sequelize through a `where` condition; SQL-shaped inputs were exercised as data.
- Existing successful reset behavior, response strings, expiry checks, and single-use behavior passed the targeted regression suite.
- Password hashing/validation and plaintext-storage regression tests passed.
- Lookup/database errors were not silently treated as invalid tokens.
- The targeted tests use in-process model stubs. Real database behavior, complete HTTP middleware behavior, rate-limit behavior, and deployment configuration were not verified.
- The reported token-deletion-failure test confirms the handler does not claim success; it also demonstrates that the password update may already have occurred before a deletion failure. This pre-existing two-operation behavior is outside this finding's scope and remains a risk to review separately.
- Formatting differences in the route file predate the change and remain unmodified.

## 7. Production Readiness Decision

**INCONCLUSIVE**

The scoped automated tests, syntax checks, task/test formatting checks, and whitespace checks passed. However, the full repository suite and real database/HTTP integration were not run. Therefore, this report does not claim that the entire application or deployment is production-ready.

## 8. Remaining Actions

1. In a safe staging environment, verify a reset POST with an absent body returns the existing failure response without an unhandled server error.
2. Run the full test suite with an isolated test database after confirming its fixtures cannot affect production data.
3. Verify the route through the deployed Express middleware stack and approved rate-limit configuration.
4. Consider the non-atomic password-update/token-deletion behavior separately; do not fold it into Finding 19 without its own scoped review.
5. Leave route-wide formatting cleanup for a dedicated change, since the formatter check fails on the committed baseline as well.
