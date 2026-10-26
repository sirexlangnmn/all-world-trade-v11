# AI Task: Invalidate Password Reset Tokens After Use

> **Finding:** `CODE_REVIEW.md` — Finding 23: Reset Token Not Invalidated After Use  
> **Task file:** `docs/tasks/023-Reset-Token-Not-Invalidated-After-Use.md`  
> **Related task:** [`docs/tasks/049-Reset-Tokens-Not-Invalidated-After-Use-and-Missing-Expiry-Enforcement.md`](./049-Reset-Tokens-Not-Invalidated-After-Use-and-Missing-Expiry-Enforcement.md) covers the same token invalidation issue together with expiry enforcement. Treat that document and this one as overlapping descriptions of one code change, not two separate implementations.

## 1. Task Title

**Make Password Reset Tokens Single-Use**

## 2. Objective

Ensure a password reset token cannot be reused after a successful password reset. Preserve the existing reset flow and response contract, and reject missing or expired tokens wherever the reset link is validated.

The expected outcome is that a valid token can successfully update its account password once, is then invalidated, and cannot be used for another reset. The coding agent must first establish whether the finding is still present: the current route inspected while preparing this guide already checks expiry and deletes the token after a successful password update.

## 3. Problem / Finding

### Finding as reported

`CODE_REVIEW.md` reports that `POST /reset-password/:token` updates the password without deleting the matching row from `reset_tokens`. A person who obtains the reset link could therefore reuse it while it remains valid. Finding 23 also recommends enforcing token expiry in the GET handler.

The finding does not assign a numeric severity. Do not invent one in reports or use it as a reason to broaden the task.

### Current source observation — verify before acting

At the time this guide was written, `app/routes/forgot-password.js` already contains:

- A shared token/account lookup that rejects empty, missing, expired, or account-less tokens.
- Expiry validation using the stored `reset_tokens.expiration` value.
- A `destroy({ where: { token } })` call after `PasswordResetService.setNewPassword` succeeds and before the success response is sent.
- Existing GET and POST failure handling for invalid tokens.

Therefore, do not assume the reported defect is still present or add duplicate logic. Inspect the current branch and tests first. If the behavior is already correct, verify it and report that no production-code change was needed.

## 4. Affected Functionality

The public password-reset link workflow is implemented in the Express route module:

```text
POST /api/post/create-reset-token
    -> stores a generated token and expiration
    -> email contains /reset-password/:token
GET /reset-password/:token
    -> validates the token and renders the reset form
POST /reset-password/:token
    -> validates the token
    -> PasswordResetService updates the password
    -> token must be invalidated after successful update
    -> returns the response consumed by the reset page
```

The token row is in the Sequelize `reset_tokens` model. Password hashing and password validation belong to `PasswordResetService`; they are not part of this task.

## 5. Investigation Phase

Complete these checks before editing:

1. Read the repository guidance in `README.md`, `AGENTS.md`, and the relevant Finding 23 text in `CODE_REVIEW.md`. Review the README password-reset lifecycle, database model, security, and testing sections.
2. Check the worktree and inspect the current diff for every file you may touch. Preserve unrelated user changes.
3. Read the live implementations of:
   - `app/routes/forgot-password.js`
   - `app/db_models/reset_tokens.model.js`
   - `app/services/password-reset.service.js`
   - `app/query/reset_tokens.query.js`
   - `public/assets/js/reset-password.js`
4. Search for all reset-token reads, writes, deletions, and consumers of the reset handlers. Confirm whether any other flow relies on a token remaining after reset.
5. Check the existing tests, especially:
   - `test/049-reset-token-invalidation-and-expiry.test.js`
   - `test/003.2-plaintext-password-storage-on-reset.test.js`
   - `test/password-reset.test.js`
6. Confirm the browser's response contract. The reset client recognizes the exact success string `'reset password successfully'`; preserve it. Confirm current failure behavior before changing status codes or message bodies.
7. Compare this finding with the related task guide, `docs/tasks/049-Reset-Tokens-Not-Invalidated-After-Use-and-Missing-Expiry-Enforcement.md`. Do not create a second implementation or alter behavior beyond the agreed scope.
8. If current code already satisfies the requirements, run the focused tests and inspect the relevant call order. Do not edit production files simply to create a diff.

Use repository searches rather than relying on the paths above as an exhaustive list. Current line numbers may have changed.

## 6. File Impact Analysis

| File | Role | Action | Reason |
|---|---|---|---|
| `app/routes/forgot-password.js` | Reset-token validation and GET/POST handlers | `MODIFY` only if a verified defect remains | The reported behavior belongs to these handlers. Current source may already contain the fix. |
| `test/049-reset-token-invalidation-and-expiry.test.js` | Focused reset-token route tests | `REFERENCE ONLY` or `MODIFY` if coverage is missing | Verify token deletion, expiry rejection, and preservation of existing responses. Reuse existing coverage where adequate. |
| `app/db_models/reset_tokens.model.js` | Sequelize token model | `REFERENCE ONLY` | Confirm available token fields and model behavior; do not change schema for this finding. |
| `app/query/reset_tokens.query.js` | Existing token creation query | `REFERENCE ONLY` | Confirm token creation behavior; do not change its SQL or contract. |
| `app/services/password-reset.service.js` | Password validation, hashing, and update | `REFERENCE ONLY` | Preserve server-side password hashing and existing validation. |
| `public/assets/js/reset-password.js` | Browser response handling | `REFERENCE ONLY` | Preserve the exact success/failure contract unless current code proves it has changed and a client adjustment is necessary. |
| `README.md` | Project and reset-flow documentation | `REFERENCE ONLY` | Update only if implementation changes the documented behavior and the update is directly required. |
| Related task guide 049 | Combined invalidation/expiry implementation guide | `REFERENCE ONLY` | Avoid implementing the same finding twice. |

Do not add or delete files unless investigation establishes a concrete need. Do not change dependencies or database schema for the expected fix.

## 7. Current Implementation

### Finding snapshot

The review describes the original defect as a password update followed by a success response, with no token deletion. It also recommends that the reset-page GET route reject expired tokens.

### Current implementation to inspect

The current route may already use a shared lookup and perform invalidation after the password update, conceptually:

```js
const result = await findUserAccountByResetToken(token);

if (!result) {
    return res.send(RESET_PASSWORD_FAILURE_MESSAGE);
}

await passwordResetService.setNewPassword(result.userAccount.uuid, { password, password2 });
await db_models.reset_tokens.destroy({ where: { token } });

return res.send(RESET_PASSWORD_SUCCESS_MESSAGE);
```

This excerpt describes the inspected behavior, not a mandate to copy it blindly. Re-read the live source, confirm the actual ordering and error paths, and check for changes on the current branch.

The reset token is created with an expiration in `app/routes/forgot-password.js`; the schema is defined in `app/db_models/reset_tokens.model.js`. The reset page's JavaScript compares the response against the exact success string. `PasswordResetService` owns the password update and hashing.

## 8. Current → Target

### Current — as reported by Finding 23

```text
Password reset request
  -> token exists
  -> password is updated
  -> success is returned
  -> token row remains available for reuse
```

### Target

```text
Reset link is opened or submitted
  -> token is present, exists, and is unexpired
  -> invalid tokens do not render a usable reset form or update a password
  -> valid POST updates the password
  -> only after a successful update, the matching token is invalidated
  -> existing success response is returned
  -> a later request with that token cannot reset the password again
```

If this target is already implemented, keep it and prove it through tests and code-path inspection. Adapt any implementation to the existing route/model conventions; do not introduce a parallel token mechanism.

## 9. Detailed Implementation Plan

### Step 1 — Establish current state

Inspect the current route, worktree diff, and existing test coverage. Determine whether each requirement below is already satisfied before proposing a code change.

### Step 2 — Trace token lifecycle

Trace token creation, database lookup, expiry validation, account lookup, password update, token invalidation, and response handling. Search for all consumers of the token and ensure deletion will not break another flow.

### Step 3 — Verify token validation

If missing or expired-token handling is absent, ensure both GET and POST reject invalid tokens before rendering the form or updating the password. Handle a missing database row without dereferencing it. Treat an absent or unparseable expiration as invalid. Preserve existing endpoint response contracts.

### Step 4 — Invalidate after successful reset

If deletion is absent, delete only the token submitted to the successful reset operation. Perform deletion after the password service reports success and before returning the success response. If password validation or the password update fails, do not report success or consume the token as though a reset succeeded.

If deletion fails, do not send a success response that implies the token is safely single-use. Follow the route's existing error-reporting conventions and avoid swallowing the failure.

### Step 5 — Preserve adjacent behavior

Keep token generation, email-link format, token TTL, password hashing, validation, form fields, and response strings unchanged. Do not alter unrelated forgot-password endpoints or address other review findings.

### Step 6 — Test the behavior

Use the existing `node:test` tests. Extend the focused test only if the required behavior lacks coverage; avoid redundant new tests when the existing suite already proves it.

### Step 7 — Review and report

Review the final diff for scope and verify the tests exercise the actual registered route behavior, including the ordering of password update, token deletion, and success response.

## 10. Architecture and Existing Patterns

- Follow the route module and Sequelize model patterns already used in the repository.
- Keep password hashing and password validation in `PasswordResetService`.
- Reuse current token lookup/expiry helpers if they correctly implement the requirement; do not create duplicate helpers.
- Use the existing Node.js built-in `node:test` and `node:assert` testing conventions.
- Do not introduce a dependency, framework, data-access layer, or architectural pattern when the existing implementation is sufficient.
- The codebase has both legacy MySQL and Sequelize stacks. Do not migrate unrelated legacy code as part of this task.

## 11. Security Requirements

- A reset token is a bearer credential. Never log or expose its value beyond the existing reset-link flow.
- Reject absent, unknown, or expired tokens before exposing account information, rendering a usable reset form, or changing a password.
- Invalidate only the matching token after a successful password update.
- Never return success if password update or required token invalidation fails.
- Do not weaken password validation, hashing, or token-expiry checks.
- Test replay with the same token after success and verify that it cannot change the password again.
- Do not expand this task into rate limiting, email-enumeration mitigation, reset-token redesign, or other security findings.

## 12. Backward Compatibility

Preserve:

- `GET /reset-password/:token` and `POST /reset-password/:token`.
- Reset email link format and token creation behavior.
- Existing password form fields and `PasswordResetService` behavior.
- The exact successful response string `'reset password successfully'`.
- The existing failure response consumed by the reset-page JavaScript.
- Existing behavior for password validation failures and invalid tokens unless a targeted correction is necessary to enforce token validity.

Do not change HTTP status codes or response shapes without verifying all consumers and explaining why a contract change is required.

## 13. Testing Strategy

Run focused tests first, then the relevant regression tests. The project uses Node's built-in test runner; use `node --test <test-file>` for targeted execution and `npm test` only when appropriate for the repository's current test setup.

### Normal case

- A valid, unexpired token allows the reset form to render.
- A valid reset updates the password using the existing service and returns the existing success string.
- The exact token row is deleted after a successful update.

### Replay and invalid input

- A second POST using the consumed token does not update the password and does not return success.
- Missing, unknown, empty, and expired tokens are rejected by the relevant handlers without throwing.
- A token whose account cannot be found is rejected without rendering account information or updating a password.

### Failure and boundary cases

- Password validation/update failure does not return a success response.
- A password update failure does not falsely mark the reset as successful.
- Token deletion failure is surfaced through the established failure path; the response must not claim that the token is single-use.
- Expiration at or before the current time is rejected; a future expiration remains valid.

### Regression

- Existing password hashing/service tests pass.
- The reset client continues to recognize the unchanged success response.
- Existing forgot-password and reset-token tests pass.

Do not use production accounts, production SMTP, or production reset links for manual verification. If a local runtime check requires unavailable credentials or infrastructure, report that limitation rather than substituting production data.

## 14. Verification / Evidence

Provide evidence, not only a claim that the issue is fixed:

1. Identify the current GET and POST reset handlers and their token-validation logic.
2. Show that password update occurs before token deletion, and deletion occurs before the success response.
3. Show that invalid or expired tokens cannot reach the password update.
4. Run and report focused test names and outcomes, including replay and deletion-failure coverage when available.
5. Confirm the exact success string remains unchanged.
6. Inspect the final diff and report whether production code changed or was already correct.
7. Search for other reset-token consumers that could be affected by deletion.

If concurrency or non-atomicity remains a concern, record it as a residual risk; do not silently claim that a non-atomic sequence guarantees exactly one successful request under simultaneous submissions.

## 15. Do NOT Do

- Do not blindly reimplement behavior that is already present.
- Do not make a second code change solely because Finding 23 is repeated in another task document or review finding.
- Do not rewrite the reset workflow or migrate its data-access layer.
- Do not change token generation, link format, or expiry duration.
- Do not change the password hashing service or form contract.
- Do not modify the database schema or dependencies unless investigation proves it is essential.
- Do not change unrelated reset/email endpoints or fix adjacent findings in this task.
- Do not log reset tokens, credentials, or production data.
- Do not suppress database or password-update errors.

## 16. Acceptance Criteria

- [ ] Current implementation was inspected before editing; pre-existing changes were preserved.
- [ ] A valid, unexpired token can reset the password through the existing service.
- [ ] A successful reset invalidates only the matching token before returning success.
- [ ] A consumed token cannot be used for a later reset.
- [ ] Missing and expired tokens are rejected by GET and POST without a crash or password update.
- [ ] Password update or token-deletion failure is not reported as a successful reset.
- [ ] Existing routes, password handling, email-link format, and response contract remain compatible.
- [ ] Focused reset-token and password-reset regression tests pass, or limitations are clearly reported.
- [ ] No duplicate implementation or unrelated change was introduced.
- [ ] The final diff and residual risks were reviewed.

## 17. Expected Final Report

Finish with this structure:

```markdown
# Implementation Report

## Summary
State whether the finding required a code change or was already addressed.

## Files Modified
| File | Changes |
|---|---|

## Files Added
| File | Purpose |
|---|---|

## Files Deleted
| File | Reason |
|---|---|

## Files Referenced Only
| File | Why |
|---|---|

## Implementation Details
Explain token validation, password update, deletion ordering, and response compatibility.

## Testing
| Test | Result |
|---|---|

## Verification
Provide evidence that invalid tokens are rejected and a successful reset prevents replay.

## Remaining Risks
List unverified behavior, including any concurrency or infrastructure limitations.

## Final Status
PASS / NEEDS REVIEW
```

## 18. Important Rules for the Coding Agent

1. **Do not hallucinate:** inspect the live code and test files; do not assume the review snapshot or this guide reflects the current branch.
2. **Separate facts from recommendations:** treat the lack of invalidation as the reported finding; record current code behavior based on direct inspection.
3. **Prefer project consistency:** use the established route, service, model, and test patterns.
4. **Preserve behavior:** keep existing token creation, password handling, and browser response behavior.
5. **Trace the complete code path:** follow token creation, GET validation, POST validation, password update, invalidation, and response.
6. **Make only necessary changes:** if existing code and tests satisfy the acceptance criteria, make no production-code edits.
7. **Verify completion:** report exact tests and results, review the final diff, and disclose unresolved risks.

## 19. Output Requirements

The implementation agent must finish with the report format in Section 17. Its report must state whether it made a code change or verified an existing fix, list test outcomes, and identify any remaining uncertainty. Do not claim the finding is fixed without evidence.
