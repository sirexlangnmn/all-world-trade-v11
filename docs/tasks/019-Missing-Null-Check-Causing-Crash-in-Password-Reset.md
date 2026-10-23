# 019 — Handle Missing Reset Tokens and Accounts Without Crashing

| Field                  | Value                                                                                                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document ID            | `019`                                                                                                                                                                                  |
| Requested filename     | `docs/tasks/019-Missing-Null-Check-Causing-Crash-in-Password-Reset.md`                                                                                                                 |
| Source finding         | `CODE_REVIEW.md` → Detailed Findings → **Finding 19: Missing Null Check Causing Crash in Password Reset**                                                                              |
| Related implementation | `docs/tasks/049-Reset-Tokens-Not-Invalidated-After-Use-and-Missing-Expiry-Enforcement.md` already includes safe missing-token/account handling as part of the reset-token lookup flow. |
| Priority               | Reliability and security hardening — invalid reset links must not cause an unhandled null dereference.                                                                                 |
| Task type              | Focused password-reset error-path fix or verification of the existing fix.                                                                                                             |
| Repository             | All World Trade v11 — production Express/EJS/MySQL SSR application.                                                                                                                    |
| Expected change size   | If the current guard is present: no code change; verify and report. If it has regressed: one route module and a focused regression test.                                               |
| Production constraint  | The password-reset workflow is production-critical. Preserve valid reset behavior and existing client response contracts.                                                              |

> **Overlap / current-state warning:** Finding 19's null-check requirement is already covered by the implementation described in Finding 49 and its regression tests. Inspect the current branch first. Do not add a second implementation or duplicate helper if the current shared lookup already safely handles missing token/account rows.

---

# 1. Task Title

**Prevent Missing or Unmatched Password-Reset Records from Causing Null-Dereference Errors**

---

# 2. Objective

Ensure that an absent reset-token row or an existing token row without a corresponding user account is handled as an invalid reset request, not as an attempt to access a property of `null`.

The coding agent must first determine whether the current implementation already satisfies this requirement. If it does, make no production-code changes: run or inspect the existing regression coverage and report the evidence. If it does not, implement the smallest guard in the shared reset-token lookup path and add/update focused tests.

Expected behavior:

- Missing/empty token values are rejected without an account lookup, password update, or token deletion.
- A POST with no parsed request body must not throw while extracting password fields; it should follow the existing invalid-token or password-validation failure path.
- A token lookup that returns no row is treated as invalid without reading `resetToken.uuid`.
- A token row with no matching account is treated as invalid without reading `userAccount.uuid`.
- GET and POST keep their existing response contracts for invalid reset tokens.
- Database and unexpected application errors remain errors; they must not be disguised as an ordinary invalid-token result.

---

# 3. Problem / Finding

## Finding details

`CODE_REVIEW.md` Finding 19 identifies an unsafe access in the password-reset flow:

```js
const resetToken = await Reset_tokens.findOne({ where: { token: token } });
const userAccount = await Users_accounts.findOne({ where: { uuid: resetToken.uuid } });
```

If `findOne` returns `null` for an invalid, expired, or already-used token, evaluating `resetToken.uuid` throws a `TypeError`. The related account lookup can also return `null`; downstream code that reads `userAccount.uuid` or the account email can fail in the same way.

## Impact

An invalid or stale link can trigger an unhandled exception or an error response instead of a controlled invalid-token response. It can also lead to an attempted password update if an invalid lookup result is not stopped before the write path.

This is an availability and correctness defect in a public password-recovery workflow. The review does not assign a severity rating; do not invent one.

## Current implementation status to verify

The current `app/routes/forgot-password.js` has a shared `findUserAccountByResetToken` helper that:

1. Rejects a non-empty-string failure before querying.
2. Looks up the token.
3. Returns `null` when the token row is absent or expired.
4. Looks up the account only after a valid token row is found.
5. Returns `null` when the account row is absent.
6. Returns both records only when both lookups succeed.

The GET handler maps a `null` result to the existing generic 404 message. The POST handler maps a `null` result to the existing failure string and does not update the password. Verify this against the checked-out files; source may change after this document is written.

---

# 4. Affected Functionality

The affected flow is the public password-reset page and submission:

```text
Browser opens reset link
   ↓
GET /reset-password/:token
   ↓
Route's shared token/account lookup
   ↓
reset_tokens.findOne({ where: { token } })
   ↓
users_accounts.findOne({ where: { uuid } })
   ↓
Render reset form or return invalid-token response

Browser submits new password
   ↓
POST /reset-password/:token
   ↓
Same token/account validity check
   ↓
PasswordResetService.setNewPassword(...)
   ↓
Existing failure or success response
```

The database access uses the Sequelize models from `app/db_models`. The route also imports a legacy mysql2 pool for other parts of the password-reset/email flow; do not migrate or refactor that unrelated code for this finding.

---

# 5. Investigation Phase

Complete these checks before changing code.

## 5.1 Read project guidance

Read:

- `README.md` sections on backend architecture, password-reset token lifecycle, authentication/security, error handling, and testing.
- `AGENTS.md` sections on Express route conventions, Sequelize usage, error handling, and tests.
- `CODE_REVIEW.md` Finding 19 and Finding 49.
- `docs/tasks/049-Reset-Tokens-Not-Invalidated-After-Use-and-Missing-Expiry-Enforcement.md`, which documents the overlapping token lookup behavior.

## 5.2 Inspect current implementation

Inspect:

- `app/routes/forgot-password.js`: token lookup helper and both `/reset-password/:token` handlers.
- `app/db_models/reset_tokens.model.js` and `app/db_models/users_accounts.model.js`: lookup fields and model behavior.
- `app/services/password-reset.service.js`: password update entry point and validation behavior.
- `app/middleware/rate-limit/password-reset.rate-limit.js` or its current equivalent: confirm the public route middleware remains in place; do not change limits here.
- `public/view/reset-password/index.ejs` and the reset-page client script: identify the existing request and response contract.

Search for all reset-token lookups and all usages of the lookup helper. Confirm both GET and POST use the same validated result and there is no alternate route that dereferences the lookup row without guarding it.

## 5.3 Inspect current regression coverage

Read and run the focused cases in:

- `test/049-reset-token-invalidation-and-expiry.test.js`
- `test/password-reset.test.js`
- `test/003.2-plaintext-password-storage-on-reset.test.js`

Finding 49 already includes missing-token and missing-account regression cases. Prefer extending that canonical test if coverage is missing rather than creating a redundant test file.

## 5.4 Determine whether a code change is needed

- If the helper already returns a not-found result for missing token/account rows and both handlers stop before rendering/updating, treat Finding 19 as already fixed.
- If either unsafe dereference remains, identify whether it is the shared helper or another code path and patch only that specific gap.
- If test coverage already proves the behavior, do not duplicate assertions without a clear gap.

---

# 6. File Impact Analysis

| File                                                                                      | Role                                         | Action                                                                                              | Reason                                                                                                                                                 |
| ----------------------------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/routes/forgot-password.js`                                                           | Reset-token lookup and GET/POST handlers     | `MODIFY` only if the current null guards are missing or incomplete; otherwise `REFERENCE ONLY`      | The unsafe dereference identified by Finding 19 is in this route flow. Current branch already appears to guard both missing token and missing account. |
| `test/049-reset-token-invalidation-and-expiry.test.js`                                    | Canonical reset-token route regression tests | `MODIFY` only if a missing-token or missing-account assertion is absent; otherwise `REFERENCE ONLY` | Finding 49 consolidates token lifecycle validation and already covers Finding 19's null cases.                                                         |
| `app/services/password-reset.service.js`                                                  | Password validation and password update      | `REFERENCE ONLY`                                                                                    | Ensure invalid lookup results never reach this service. Do not change password hashing or validation.                                                  |
| `app/db_models/reset_tokens.model.js`                                                     | Reset token persistence model                | `REFERENCE ONLY`                                                                                    | Confirm the lookup model returns nullable results as expected. No schema change is indicated.                                                          |
| `app/db_models/users_accounts.model.js`                                                   | Account persistence model                    | `REFERENCE ONLY`                                                                                    | Confirm account lookup behavior.                                                                                                                       |
| `public/view/reset-password/index.ejs` and reset client script                            | User-facing form and response consumer       | `REFERENCE ONLY`                                                                                    | Preserve existing front-end response handling.                                                                                                         |
| `docs/tasks/049-Reset-Tokens-Not-Invalidated-After-Use-and-Missing-Expiry-Enforcement.md` | Related implementation guidance              | `REFERENCE ONLY`                                                                                    | Identifies the overlapping implementation and tests; do not create a second fix plan.                                                                  |

No new production module, dependency, route, or database migration should be needed for this finding.

---

# 7. Current Implementation

## Finding's reported behavior

The review's reported implementation queried `reset_tokens`, then immediately accessed `resetToken.uuid`. An absent token row caused a null dereference. The account lookup result was then used without a null check as well.

## Current branch behavior to confirm

The current shared helper has explicit not-found guards and returns either a complete valid result or `null`. GET and POST inspect the helper result before accessing account properties or calling the password service.

The coding agent must inspect this implementation before proceeding. Do not treat the old Finding 19 snippet as proof that the checked-out code is still vulnerable.

---

# 8. Current → Target

## Current

The code described by Finding 19 assumes every database lookup returns a record:

```text
find token → read token.uuid → find account → use account
```

When either row is missing, the application may throw before returning a controlled response.

## Target

Treat lookup results as nullable data:

```text
validate token input
   ↓
find token
   ↓
if absent or otherwise invalid: return invalid-result sentinel
   ↓
find account
   ↓
if absent: return invalid-result sentinel
   ↓
only then render the form or perform the password update
```

The existing code already follows this pattern if it matches the implementation reviewed for this guide. If a guard is needed, use a single shared helper for both handlers rather than duplicating null checks at each call site.

Do not turn database exceptions into the same sentinel as a missing row. A query failure is not proof that a token is invalid; preserve repository-standard error propagation and logging.

---

# 9. Detailed Implementation Plan

## Step 1 — Verify the current code and tests

Inspect the current helper, both route handlers, related middleware, and existing `049` regression tests. Confirm exact status/body behavior before changing anything.

## Step 2 — Trace all lookup results

For each reset-token and account lookup, identify:

- Whether the returned value may be `null`.
- Every property access performed on that result.
- Whether invalid results can reach page rendering, password updates, or token deletion.
- Whether database exceptions are propagated or silently converted.

Search the repository for all helper call sites and other reset-token queries.

## Step 3 — Reuse the canonical implementation

If `findUserAccountByResetToken` already guards missing token and account rows and both handlers check its result, make no production code change. Record that Finding 19 is resolved by the existing implementation associated with Finding 49.

## Step 4 — Apply a minimal guard only if needed

If a current code path still dereferences a potentially null token/account:

1. Add the guard in the shared lookup/helper path where possible.
2. Return the established invalid-result sentinel for missing rows.
3. Ensure callers stop before property access, rendering, password update, or token deletion.
4. Preserve rejection/forwarding for actual database errors.
5. Do not refactor unrelated email, session, or legacy mysql2 logic.

## Step 5 — Preserve response behavior

Keep:

- GET invalid token/account: the existing generic HTTP 404 response.
- POST invalid token/account: the existing `'reset password failed'` response and status behavior.
- Valid GET: render the reset form with the existing email local.
- Valid POST: continue using `PasswordResetService` and the existing success string.

Verify these contracts from the current route and front-end before relying on these values.

## Step 6 — Test the cases

Extend `test/049-reset-token-invalidation-and-expiry.test.js` only if any of these assertions are missing:

- Missing token row returns the GET invalid-token response and does not query the account.
- Missing token row returns the POST failure response and performs no password update or deletion.
- A POST with an absent request body does not throw or perform writes.
- Token row with no account returns invalid responses and performs no write.
- Empty token is rejected before database access.
- Lookup/database errors are not misreported as an ordinary missing-token response.
- A valid token still renders/updates through the existing path.

## Step 7 — Review and report

Review the focused diff. If no code was necessary, report that explicitly and cite the existing passing tests. If code changed, rerun the targeted tests and report exact results and any unverified runtime conditions.

---

# 10. Architecture and Existing Patterns

- Routes are registered from `app/routes/*.js` modules using the Express application.
- Sequelize models are exposed through `app/db_models`; `findOne` can return `null`.
- Password changes go through `PasswordResetService` in `app/services/password-reset.service.js`.
- Existing regression tests use Node's built-in `node:test` and `node:assert`.
- `test/049-reset-token-invalidation-and-expiry.test.js` is the canonical route test for missing/expired/reused reset tokens.

Prefer the current shared lookup and test patterns. Do not introduce a repository layer, a new error abstraction, a second route helper, or a new test framework for a null guard.

---

# 11. Security Requirements

- Never dereference a token/account lookup result until it has been checked for absence.
- Never render account data or update a password unless both the token and account lookups succeeded.
- Do not reveal whether an email address or account exists in an invalid-token response.
- Bind token values through Sequelize's `where` condition; do not interpolate them into SQL.
- Do not swallow database exceptions or convert infrastructure failures into success-shaped or ordinary not-found results.
- Do not log reset tokens, passwords, session contents, or account credentials.
- Test malformed, empty, long, and SQL-shaped token strings as data; no direct raw SQL should be introduced.

This finding is specifically about null handling. Token expiry, single-use deletion, rate limiting, password hashing, and password-hash response exposure are separate concerns with their own task guidance. Preserve any existing protections, but do not expand this change into those workstreams.

---

# 12. Backward Compatibility

Preserve:

- Existing paths `GET /reset-password/:token` and `POST /reset-password/:token`.
- Existing valid-token behavior and reset-page template locals.
- The exact existing invalid and success response bodies/statuses consumed by the client.
- Existing password fields, password validation, and bcrypt behavior in `PasswordResetService`.
- The token and account database schema.
- Existing token expiry/single-use behavior already implemented in the current branch.
- Existing limiter middleware on reset endpoints.

Only behavior required to prevent a missing lookup record from causing an exception may change. Do not change the client response contract to a new JSON envelope without a separate approved task.

---

# 13. Testing Strategy

## Normal cases

- A valid token with a matching account continues to render the form.
- A valid token/account continues through the established password-reset service path.

## Missing and invalid data

- Token lookup returns `null`.
- Token input is empty or absent.
- Token lookup returns a row but the account lookup returns `null`.
- Token input is unusually long, contains special characters, or resembles SQL syntax.

## Error handling

- Token lookup throws a database error.
- Account lookup throws a database error.
- Verify database errors are not silently treated as missing records and do not produce an unhandled null dereference.

## Security and data integrity

- Invalid/missing token causes no password update.
- Invalid/missing token causes no token deletion.
- No password, hash, or reset token is reflected in the response or logs.
- A missing account does not reveal account-existence details.

## Regression

Run the canonical Finding 49 test and password-reset service tests:

```sh
node --test test/049-reset-token-invalidation-and-expiry.test.js
node --test test/password-reset.test.js
```

Use the repository's configured test command when appropriate. Do not run database-mutating integration tests against production. The existing `049` route test stubs Sequelize and the legacy pool to exercise the actual route handlers without a database or SMTP connection.

---

# 14. Verification / Evidence

Before declaring completion, provide:

1. The inspected helper and route behavior proving both missing token and missing account are checked.
2. The exact targeted test command and actual pass/fail/skip counts.
3. Evidence that invalid lookups do not reach `PasswordResetService` or mutate token/account rows.
4. Evidence that valid-token behavior and existing response contracts remain unchanged.
5. A note distinguishing a verified existing fix from any newly implemented code.
6. A final diff review confirming no unrelated reset-flow behavior changed.

If the current implementation already handles all cases, say that no code change was required and identify the existing test cases that cover the behavior. Do not create duplicate guards merely to produce a diff.

---

# 15. Do NOT Do

- Do not assume the vulnerable code in `CODE_REVIEW.md` is still present.
- Do not reimplement Finding 49 or duplicate its helper/tests.
- Do not dereference `resetToken.uuid` or `userAccount` properties before null checks.
- Do not change GET/POST response contracts or front-end handling unnecessarily.
- Do not alter password hashing, password validation, token expiry, token deletion, or rate limits beyond preserving their current behavior.
- Do not change database schema or add dependencies.
- Do not migrate the password-reset flow from mysql2 to Sequelize as part of this null-check task.
- Do not use broad catches, silent defaults, or success-shaped fallbacks.
- Do not expose account details, reset tokens, password values, or hashes.
- Do not run database-mutating tests against production.
- Do not modify unrelated files or clean up unrelated technical debt.

---

# 16. Acceptance Criteria

- [ ] The current Finding 19 behavior is verified before editing.
- [ ] The shared reset lookup handles a missing token without reading properties from `null`.
- [ ] The shared reset lookup handles a missing account without reading properties from `null`.
- [ ] GET and POST stop before rendering or writing when either lookup result is missing.
- [ ] Database exceptions remain distinguishable from ordinary missing records.
- [ ] Existing response bodies/statuses and valid reset behavior are preserved.
- [ ] Missing-token and missing-account regression tests pass.
- [ ] No password update or token deletion occurs for invalid lookup results.
- [ ] Existing expiry, single-use, rate-limit, and password-hashing behavior is preserved.
- [ ] No unrelated files or production data were changed.
- [ ] The final report states whether the fix was already present or newly implemented.

---

# 17. Expected Final Report

The implementing agent should finish with:

```markdown
# Implementation Report

## Summary

State whether Finding 19 was already handled by the Finding 49 implementation or required a focused code change.

## Files Modified

| File  | Changes |
| ----- | ------- |
| `...` | ...     |

## Files Added

| File  | Purpose |
| ----- | ------- |
| `...` | ...     |

## Files Deleted

| File | Reason                |
| ---- | --------------------- |
| None | No deletion expected. |

## Files Referenced Only

| File  | Why |
| ----- | --- |
| `...` | ... |

## Implementation Details

Explain how missing token and missing account results are handled.

## Testing

| Test                   | Result            |
| ---------------------- | ----------------- |
| Missing token GET      | PASS/FAIL/NOT RUN |
| Missing token POST     | PASS/FAIL/NOT RUN |
| Missing account        | PASS/FAIL/NOT RUN |
| Database error path    | PASS/FAIL/NOT RUN |
| Valid reset regression | PASS/FAIL/NOT RUN |

## Verification

Provide the exact commands and explain why they prove the null-dereference path is closed.

## Remaining Risks

List unverified runtime/database conditions.

## Final Status

PASS / NEEDS REVIEW
```

---

# 18. Important Rules for the Coding Agent

1. **Verify current state first.** Finding 19 is already covered by the later reset-token implementation; the unsafe historical snippet may not exist on the current branch.
2. **Avoid duplicate work.** Finding 49 is the canonical implementation/test path for the shared token lookup and already includes null checks.
3. **Keep error semantics correct.** A missing row is an invalid token; a database failure is an operational error. Do not conflate them.
4. **Preserve the production contract.** Keep valid reset behavior and existing invalid-token responses stable.
5. **Use evidence.** A passing test or inspected current guard is required; do not claim the issue is resolved based only on documentation.
6. **Report scope honestly.** If the fix is already present, report a verified no-code-change outcome rather than manufacturing a code edit.
