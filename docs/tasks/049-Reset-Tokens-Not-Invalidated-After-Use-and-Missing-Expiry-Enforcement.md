# 049 — Invalidate Reset Tokens After Use and Enforce Expiry on GET/POST

| Field | Value |
| --- | --- |
| Document ID | `049` |
| Requested filename | `docs/tasks/049-Reset-Tokens-Not-Invalidated-After-Use-and-Missing-Expiry-Enforcement.md` |
| Source finding | `CODE_REVIEW.md` → Detailed Findings → **Finding 49: Reset Tokens Not Invalidated After Use and Missing Expiry Enforcement** (`app/routes/forgot-password.js`) |
| Duplicate finding | `CODE_REVIEW.md` → **Finding 23: Reset Token Not Invalidated After Use** describes the same defect. This document is the canonical fix for both. Do not implement Finding 23 separately. |
| Priority | Security — token reuse / password-reset takeover window. `CODE_REVIEW.md` roadmap item **#12**, effort **Low**. |
| Task type | Security hardening of an existing public flow. No schema change, no dependency change, no password-hashing change. |
| Repository | All World Trade v11 — production Express/EJS/MySQL SSR application. Current production behavior is the contract unless this document explicitly changes it. |
| Expected change size | Small: one route module, one focused test, optionally a stale code comment. |
| Current route location | `app/routes/forgot-password.js:153-192` (line numbers may shift; verify before editing). |

> **Scope note — related findings that must NOT be fixed here.**
>
> - Finding 19 (missing null checks) is separate. This task needs a **minimal null guard** because an expiry check cannot be implemented safely without handling a missing token. Do not expand that into a general error-handling refactor.
> - Finding 23 is a duplicate of this finding and is fixed by the same change.
> - Finding 3 (plaintext password storage on reset) is already addressed by `app/services/password-reset.service.js`; keep it intact.
> - Finding 4 (password-bearing unused JWT) is already addressed; do not restore JWT/AES handling.
> - Finding 50 (forgot-password response exposes the stored hash) is separate.
> - Finding 51 (missing rate limiting) is separate.
> - Finding 48 (public bcrypt oracle) is separate.
> - Finding 34 (mysql2-to-Sequelize migration) is separate.
>
> This task only makes reset tokens single-use and rejects expired/missing tokens on the reset page and reset submission. It does not redesign the reset flow.

---

# 1. Task Title

**Delete the Reset Token After a Successful Password Reset and Reject Missing or Expired Tokens in Both `GET /reset-password/:token` and `POST /reset-password/:token`**

---

# 2. Objective

## What must be accomplished

1. After a **successful** password update through `POST /reset-password/:token`, delete the matching row from `reset_tokens` so the link cannot be used again.
2. On `GET /reset-password/:token`, verify that the token exists and has not expired **before** looking up the account or rendering the form.
3. On `POST /reset-password/:token`, verify that the token exists and has not expired **before** calling `PasswordResetService.setNewPassword`.
4. Return a safe, user-facing failure for missing or expired tokens instead of crashing, rendering the form, or updating the password.
5. Preserve the existing successful reset behavior and the exact success string used by the browser client.
6. Add focused automated tests proving single-use behavior, expiry enforcement, and preservation of the existing reset flow.

## Why this is necessary

`CODE_REVIEW.md` Finding 49 reports two related weaknesses:

- The reset token is never removed after use, so one emailed link can reset the password repeatedly for the full token lifetime.
- Expiration is stored in `reset_tokens.expiration` but is not enforced by the reset handlers.

If a reset link is intercepted through email, proxy logs, browser history, or a shared device, an attacker can keep reusing it inside the one-hour window. Even after the legitimate user resets the password, the attacker can reset it again and take over the account. Enforcing expiry also prevents old links from remaining usable indefinitely and blocks crash-prone lookups for missing tokens.

## Expected end result

- A valid, unexpired token opens the reset page and can reset the password once.
- Immediately after a successful reset, the token row is gone.
- A second POST with the same token returns the existing failure response; the password is not updated again.
- A second GET with the same token does not render a working reset form.
- A missing, malformed, or expired token never causes a `TypeError` and never renders the form.
- The successful response remains exactly `'reset password successfully'`.
- Password hashing remains server-side bcrypt cost 12 through `PasswordResetService`; this task does not touch it.

---

# 3. Problem / Finding

## Weakness type

- **Insufficient token lifetime / reusable password-reset token** — CWE-640 (Weak Password Recovery Mechanism for Forgotten Password) and CWE-613 (Insufficient Session Expiration) class.
- **Missing expiry enforcement** — the expiry value exists but is not checked.
- **Null dereference on an invalid token** — adjacent to Finding 19; an invalid token currently reaches `resetToken.uuid` and throws.

## Severity

`CODE_REVIEW.md` does not assign a numeric severity to Finding 49. The realistic assessment is **high impact, low effort**:

- A reset token is equivalent to account takeover.
- Reuse extends the compromise window for the full token lifetime (currently one hour).
- Expiry is not enforced, so the stored value is decorative as far as the reset handlers are concerned.
- The endpoints are public and, at the time of writing, have no rate limiting (Finding 51, separate).

## Attack surface

```text
GET  /reset-password/:token     ← renders the reset form for any token-shaped value
POST /reset-password/:token     ← updates the account password if the token row exists
```

There is no authentication middleware on either handler. Possession of the token is the only authorization.

## Current vulnerable behavior (verified at time of writing)

### Shared lookup helper — `app/routes/forgot-password.js:153-164`

```js
// Both reset handlers need the account behind a token. Null handling for a
// missing token is intentionally unchanged (Finding 19); that is a separate
// task.
async function findUserAccountByResetToken(token) {
    const resetToken = await db_models.reset_tokens.findOne({
        where: { token: token },
    });

    return db_models.users_accounts.findOne({
        where: { uuid: resetToken.uuid },
    });
}
```

Observed problems:

1. `resetToken` can be `null`; `resetToken.uuid` then throws.
2. `resetToken.expiration` is never read.
3. The function returns only the account, so the handler has no token object to delete later (the raw `req.params.token` is still available, but no expiry context is returned).

### GET handler — `app/routes/forgot-password.js:166-176`

```js
app.get(['/reset-password/:token'], async function (req, res, next) {
    const token = req.params.token;
    const userAccount = await findUserAccountByResetToken(token);
    const EMAIL = userAccount.email_or_social_media;

    try {
        res.render(path.join(__dirname, '../../', 'public/view/reset-password/index'), { email: EMAIL });
    } catch (error) {
        res.send(error.message);
    }
});
```

Observed problems:

- A missing token crashes before the `try` block.
- An expired token is treated as valid.
- The account lookup happens before any validity decision, so the app does unnecessary work and may disclose data for stale tokens.

### POST handler — `app/routes/forgot-password.js:178-192`

```js
app.post(['/reset-password/:token'], async function (req, res) {
    const token = req.params.token;
    const { password, password2 } = req.body;

    const userAccount = await findUserAccountByResetToken(token);

    try {
        await passwordResetService.setNewPassword(userAccount.uuid, { password, password2 });

        return res.send('reset password successfully');
    } catch (error) {
        console.error('Password reset failed:', error.message);
        return res.send('reset password failed');
    }
});
```

Observed problems:

- A missing or expired token can still reset the password if the row exists.
- The token is never deleted after success.
- The same token can be submitted again and again.

### Token creation — `app/routes/forgot-password.js:43-95`

`POST /api/post/create-reset-token` inserts a UUID token with a one-hour expiration:

```js
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
// ...
expiration: new Date(new Date().getTime() + RESET_TOKEN_TTL_MS),
```

The creation side is already correct for this finding. **Do not change the token format or the TTL.**

### Model / schema — `app/db_models/reset_tokens.model.js`

```js
const Reset_tokens = sequelize.define('reset_tokens', {
    token: {
        type: Sequelize.TEXT('long'),
    },
    expiration: {
        type: Sequelize.DATE,
    },
    used: {
        type: Sequelize.TINYINT,
    },
    uuid: {
        type: Sequelize.STRING,
    },
});
```

Facts:

- `expiration` is a Sequelize `DATE`; compare it as a `Date`/epoch, not as a formatted string.
- `used` exists in the model, but at the time of writing no route writes it. Do not invent `used` semantics in this task; Finding 49 recommends deleting the row.
- `app/query/reset_tokens.query.js` inserts `token, expiration, uuid, createdAt, updatedAt`. It does not set `used`.

## Why the current implementation is unsafe

1. **Reuse:** the token remains in the table after a successful reset.
2. **No expiry:** `expiration` is never checked on GET or POST.
3. **Crash on invalid token:** `resetToken.uuid` is dereferenced without a null check, so an arbitrary link can trigger a 500 or rejected promise.
4. **No single-use guarantee:** even if the user resets successfully, the same link continues to work until the row is removed or the database is manually cleaned.

---

# 4. Affected Functionality

**Feature:** password reset via an emailed UUID token.

```text
public/view/forgot-password/index.ejs
   ↓ user enters email
public/assets/js/forgot-password.js
   ↓ POST /api/post/forgot-password-process
app/controllers/forgot-password.controller.js → app/models/forgot-password.model.js
   ↓ returns { message, email_or_social_media, uuid }
public/assets/js/forgot-password.js
   ↓ POST /api/post/create-reset-token
app/routes/forgot-password.js
   ├─ INSERT reset_tokens (token, expiration, uuid, createdAt, updatedAt)
   └─ send reset email with /reset-password/<token>
   ↓
GET /reset-password/:token
   ├─ reset_tokens.findOne({ where: { token } })        ← currently no expiry check
   ├─ users_accounts.findOne({ where: { uuid } })       ← currently crashes if token is null
   └─ render reset form
   ↓
POST /reset-password/:token
   ├─ reset_tokens.findOne({ where: { token } })        ← currently no expiry check
   ├─ users_accounts.findOne({ where: { uuid } })
   ├─ PasswordResetService.setNewPassword(uuid, { password, password2 })
   │     ├─ validate password
   │     ├─ bcrypt.hash(password, 12)
   │     └─ users_accounts.update({ password }, { where: { uuid }, silent: true })
   ├─ (MISSING) reset_tokens.destroy({ where: { token } })
   └─ res.send('reset password successfully')
   ↓
login: app/services/auth.service.js → bcrypt.compare
```

**Consumers that must keep working:**

- `public/assets/js/reset-password.js` compares the response with the exact string `'reset password successfully'` and redirects to `/login` after three seconds.
- The reset form sends `password` and `password2`; the legacy hidden `password3` may also be present and must continue to be ignored.
- `PasswordResetService` owns validation, bcrypt cost 12, and the `silent: true` update. Do not change it.
- The emailed link format `AWT_HOSTNAME + 'reset-password/' + token` must not change.
- `POST /api/post/create-reset-token` must continue to create a fresh token with the existing one-hour TTL.

**Not in scope (report only):**

- Missing null checks beyond the minimal guard needed here (Finding 19).
- Rate limiting or email-enumeration protection (Finding 51).
- Forgot-password response credential disclosure (Finding 50).
- Password hashing/validation changes (Finding 3, already fixed).
- JWT/AES reset-token handling (Finding 4, already fixed).
- Public bcrypt endpoints (Finding 48).
- Cleaning up all existing tokens in the database.
- Invalidating other outstanding tokens when a new token is requested.

---

# 5. Investigation Phase (MANDATORY — do this before editing)

The coding agent must complete these checks and record any deviation in the final report.

1. **Re-read the repository rules:**
    - `README.md` — §8.12 Password Reset Token Lifecycle, §10 `reset_tokens` schema, §12 Authentication & Security, §19 Testing Strategy.
    - `AGENTS.md` — Auth & sessions, Database & models, Known technical debt.
    - `CODE_REVIEW.md` — Findings 3, 4, 19, 23, 49, 50, 51.

2. **Establish the current working-tree state before touching anything.**
    ```bash
    git status --short
    git diff -- app/routes/forgot-password.js app/services/password-reset.service.js
    git show HEAD:app/routes/forgot-password.js
    ```
    Do not assume the line numbers in this document still match. Finding 3/4/50 changes may already be present; do not revert them.

3. **Read the exact current reset path end to end:**
    - `app/routes/forgot-password.js` — `create-reset-token`, `findUserAccountByResetToken`, GET and POST reset handlers.
    - `app/db_models/reset_tokens.model.js`
    - `app/query/reset_tokens.query.js`
    - `app/services/password-reset.service.js`
    - `public/assets/js/reset-password.js`
    - `public/view/reset-password/index.ejs`
    - `app/src/server.js:166` (route registration)
    - `README.md` §8.12

4. **Find every consumer of the token lookup.**
    ```bash
    grep -rn "findUserAccountByResetToken" app test --include=*.js
    grep -rn "reset_tokens\|Reset_tokens" app --include=*.js
    grep -rn "reset-password" app public test --include=*.js --include=*.ejs
    ```
    Expected at the time of writing: `findUserAccountByResetToken` is used only by the GET and POST reset handlers. If another consumer exists, re-evaluate before changing its return shape.

5. **Confirm the token schema and expiry semantics.**
    - Read `app/db_models/reset_tokens.model.js`: `expiration` is `Sequelize.DATE`, `token` is `Sequelize.TEXT('long')`.
    - Read `app/routes/forgot-password.js:43-95`: the insert uses a `Date` object one hour in the future.
    - Check whether `reset_tokens.used` is populated anywhere:
        ```bash
        grep -rn "used" app/query app/routes app/services app/db_controllers app/controllers --include=*.js
        ```
        If `used` is effectively unused, do not switch to a `used` flag. Delete the row as Finding 49 recommends. If `used` is populated by an unknown consumer, stop and report it before choosing an approach.

6. **Confirm the `destroy` API is available and how timestamps behave.**
    - `db_models.reset_tokens` is a Sequelize model, so `destroy({ where: { token } })` is available.
    - Do not add a transaction unless the investigation shows an existing transactional pattern in this route. There is none at the time of writing.

7. **Confirm the success contract.**
    ```bash
    sed -n '1,120p' public/assets/js/reset-password.js
    ```
    Expected: the client accepts only `'reset password successfully'`; any other string shows `Something wrong. Contact your administrator`. Preserve that exact success string.

8. **Confirm invalid/expired behavior expectations.**
    - There is no existing error view for expired reset links at the time of writing.
    - `CODE_REVIEW.md` Finding 19 recommends `res.status(404).send('Invalid or expired reset token')`.
    - `public/assets/js/reset-password.js` only handles the success callback. If POST returns a 4xx/5xx, the UI shows nothing. Therefore keep POST failures on the existing HTTP 200 + `'reset password failed'` contract unless the investigation proves the client has changed. Do not silently break the warning UI.

9. **Read existing test conventions.**
    - `test/003.2-plaintext-password-storage-on-reset.test.js` captures the real route handlers with a fake Express app and stubs the Sequelize models.
    - `test/password-reset.test.js` tests the service.
    - `test/004-password-embedded-in-jwt-reset-token.test.js` shows source-invariant checks when runtime capture is impractical.
    - Use `node:test` and `node:assert`. Do not add Jest, Mocha, Supertest, or any dependency.
    - `npm test` is intentionally a failing stub. Run focused tests with `node --test`.

10. **Record a baseline in a local environment.**
    - Start the app with `npm run dev`.
    - Use a disposable local account and a local database. Never use production data or production SMTP.
    - Create a reset token, open the link, reset the password, and confirm the current implementation lets the same link reset the password again.
    - Record the behavior in the final report without copying real tokens or account data.

11. **Check whether the token is logged.**
    ```bash
    grep -rn "reset-password\|req.params.token\|resetToken" app/middleware app/src app/services --include=*.js
    ```
    If the token is logged by middleware, report it. Do not add new token logging in this task.

---

# 6. File Impact Analysis

| File | Role | Action | Reason |
| --- | --- | --- | --- |
| `app/routes/forgot-password.js` | Reset-token lookup, GET and POST reset handlers | **MODIFY** | Add expiry validation, a minimal null guard, and token deletion after successful reset. |
| `test/049-reset-token-invalidation-and-expiry.test.js` | Focused acceptance/regression test | **ADD** | Prove missing/expired tokens are rejected and a successful reset deletes the token. Use `node:test` + `node:assert`. |
| `app/db_models/reset_tokens.model.js` | Sequelize reset-token model | **REFERENCE ONLY** | Confirms `expiration` is a `DATE`, `token` is text, and `destroy` is available. Do not change the schema. |
| `app/query/reset_tokens.query.js` | Raw insert query | **REFERENCE ONLY** | Confirms token creation and TTL. Do not change it. |
| `app/services/password-reset.service.js` | Password validation + bcrypt hashing | **REFERENCE ONLY** | Must remain untouched; this task only controls token lifetime. |
| `public/assets/js/reset-password.js` | Reset page client | **REFERENCE ONLY** | Defines the exact success/failure string contract. Do not change it. |
| `public/view/reset-password/index.ejs` | Reset form | **REFERENCE ONLY** | No form/UI change is required. |
| `app/controllers/forgot-password.controller.js`, `app/models/forgot-password.model.js` | Forgot-password lookup | **REFERENCE ONLY** | Finding 50 is separate. Do not touch this flow. |
| `app/src/server.js` | Route registration | **REFERENCE ONLY** | `require('../routes/forgot-password.js')(app)` must stay unchanged. |
| `test/password-reset.test.js`, `test/003.2-plaintext-password-storage-on-reset.test.js`, `test/004-password-embedded-in-jwt-reset-token.test.js`, `test/050-forgot-password-response.test.js` | Existing regression tests | **REFERENCE ONLY** | Run them; do not modify them. |
| `README.md` | Documentation | **REFERENCE ONLY** | §8.12 describes the flow. An optional documentation note about single-use/expiry is not required to fix the finding. |
| `package.json`, `package-lock.json` | Dependencies | **REFERENCE ONLY** | No new dependency is needed. |
| `CODE_REVIEW.md` | Historical review | **REFERENCE ONLY** | Do not edit it as part of the fix. |

No database migration, schema change, environment-variable change, package install, CSS change, or EJS change is required.

---

# 7. Current Implementation (verified)

## 7.1 Shared lookup — `app/routes/forgot-password.js:153-164`

```js
// Both reset handlers need the account behind a token. Null handling for a
// missing token is intentionally unchanged (Finding 19); that is a separate
// task.
async function findUserAccountByResetToken(token) {
    const resetToken = await db_models.reset_tokens.findOne({
        where: { token: token },
    });

    return db_models.users_accounts.findOne({
        where: { uuid: resetToken.uuid },
    });
}
```

Observed behavior:

- The token lookup is parameterized by Sequelize. Do not replace it with raw SQL.
- No expiry check.
- No null check.
- The helper returns only the user account. The handler later has no token context except `req.params.token`.

## 7.2 GET handler — `app/routes/forgot-password.js:166-176`

```js
app.get(['/reset-password/:token'], async function (req, res, next) {
    const token = req.params.token;
    const userAccount = await findUserAccountByResetToken(token);
    const EMAIL = userAccount.email_or_social_media;

    try {
        res.render(path.join(__dirname, '../../', 'public/view/reset-password/index'), { email: EMAIL });
    } catch (error) {
        res.send(error.message);
    }
});
```

Observed behavior:

- The account lookup and `userAccount.email_or_social_media` run outside the `try`.
- A missing token throws before rendering.
- Expired tokens still render the form.
- The form receives the account email; do not expose it for invalid/expired tokens.

## 7.3 POST handler — `app/routes/forgot-password.js:178-192`

```js
app.post(['/reset-password/:token'], async function (req, res) {
    const token = req.params.token;
    const { password, password2 } = req.body;

    const userAccount = await findUserAccountByResetToken(token);

    try {
        await passwordResetService.setNewPassword(userAccount.uuid, { password, password2 });

        return res.send('reset password successfully');
    } catch (error) {
        console.error('Password reset failed:', error.message);
        return res.send('reset password failed');
    }
});
```

Observed behavior:

- The password update happens whenever the token row exists, regardless of `expiration`.
- The token is never deleted.
- The existing failure string is `'reset password failed'` and is sent with HTTP 200.
- The success string is exactly `'reset password successfully'`.
- `PasswordResetService` validates the password and hashes it with bcrypt cost 12. Do not change that.

## 7.4 Token creation — `app/routes/forgot-password.js:43-95`

```js
app.post('/api/post/create-reset-token', async function (req, res, next) {
    const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

    const { uuid, email_or_social_media: receiverEmailAddress } = req.body;

    // A fresh UUID v4 is the reset token. Nothing credential-related is
    // accepted, derived, or embedded here.
    function buildResetTokenData() {
        const token = uuidV4();
        const link = AWT_HOSTNAME + `reset-password/${token}`;
        const datetime = currentDatetime();

        const resetToken = {
            token,
            expiration: new Date(new Date().getTime() + RESET_TOKEN_TTL_MS),
            uuid,
            createdAt: datetime,
            updatedAt: datetime,
        };

        // ...
    }

    // db.query(RESET_TOKENS.CREATE, Object.values(resetToken), ...)
});
```

Observed behavior:

- Token creation is correct for this finding.
- Do not change the UUID format, link format, TTL, insert query, or response.

## 7.5 Model — `app/db_models/reset_tokens.model.js`

```js
const Reset_tokens = sequelize.define('reset_tokens', {
    token: {
        type: Sequelize.TEXT('long'),
    },
    expiration: {
        type: Sequelize.DATE,
    },
    used: {
        type: Sequelize.TINYINT,
    },
    uuid: {
        type: Sequelize.STRING,
    },
});
```

Observed behavior:

- `expiration` is a `DATE`. Compare using `new Date(resetToken.expiration).getTime()` and `Date.now()`.
- `used` exists but is not written by the reset flow.
- `destroy` is available on the Sequelize model.

---

# 8. Current → Target

## Current

```text
GET /reset-password/:token
  → find reset_tokens by token
  → if null: crash at resetToken.uuid
  → ignore expiration
  → find user by uuid
  → render form with email

POST /reset-password/:token
  → find reset_tokens by token
  → if null: crash at resetToken.uuid
  → ignore expiration
  → find user by uuid
  → validate + hash password
  → update users_accounts.password
  → return 'reset password successfully'
  → token row remains valid forever (until manual cleanup)
```

## Target

```text
GET /reset-password/:token
  → find reset_tokens by token
  → if missing: generic 404, do not look up user, do not render
  → if expired/invalid expiration: generic 404, do not look up user, do not render
  → find user by uuid
  → if user missing: generic 404, do not render
  → render form with email

POST /reset-password/:token
  → find reset_tokens by token
  → if missing: return 'reset password failed', do not look up user, do not update
  → if expired/invalid expiration: return 'reset password failed', do not update
  → find user by uuid
  → if user missing: return 'reset password failed', do not update
  → validate + hash password via PasswordResetService
  → update users_accounts.password
  → delete reset_tokens row by token
  → return 'reset password successfully'
  → a second POST or GET with the same token is rejected
```

## Recommended code shape (adapt to the actual file; do not copy blindly)

The exact implementation may vary, but it must preserve the semantics below.

```js
const INVALID_TOKEN_MESSAGE = 'Invalid or expired reset token';

async function findUserAccountByResetToken(token) {
    if (typeof token !== 'string' || token.length === 0) {
        return null;
    }

    const resetToken = await db_models.reset_tokens.findOne({
        where: { token: token },
    });

    if (!resetToken) {
        return null;
    }

    const expiresAt = new Date(resetToken.expiration).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        return null;
    }

    const userAccount = await db_models.users_accounts.findOne({
        where: { uuid: resetToken.uuid },
    });

    if (!userAccount) {
        return null;
    }

    return { resetToken, userAccount };
}
```

```js
app.get(['/reset-password/:token'], async function (req, res, next) {
    const token = req.params.token;
    const result = await findUserAccountByResetToken(token);

    if (!result) {
        return res.status(404).send(INVALID_TOKEN_MESSAGE);
    }

    try {
        res.render(path.join(__dirname, '../../', 'public/view/reset-password/index'), {
            email: result.userAccount.email_or_social_media,
        });
    } catch (error) {
        res.send(error.message);
    }
});
```

```js
app.post(['/reset-password/:token'], async function (req, res) {
    const token = req.params.token;
    const { password, password2 } = req.body;

    const result = await findUserAccountByResetToken(token);

    if (!result) {
        return res.send('reset password failed');
    }

    try {
        await passwordResetService.setNewPassword(result.userAccount.uuid, { password, password2 });
        await db_models.reset_tokens.destroy({ where: { token: token } });

        return res.send('reset password successfully');
    } catch (error) {
        console.error('Password reset failed:', error.message);
        return res.send('reset password failed');
    }
});
```

**Important:** the failure response for POST must remain the existing `'reset password failed'` string with HTTP 200 unless the client is verified to have changed. The current jQuery client only handles the success callback; returning 404 would show the user nothing.

**Important:** the GET response for missing/expired/malformed tokens must not reveal whether an email or account exists. Use the same generic message for all invalid cases.

---

# 9. Detailed Implementation Plan

## Step 1 — Inspect the existing implementation

Read all files listed in §5 and §6. Confirm the working-tree state with `git status` and `git diff`. Do not edit until you have verified:

- whether `findUserAccountByResetToken` still has the current shape,
- whether expiry is already checked (it should not be at the time of writing),
- whether token deletion already exists (it should not),
- whether any other code writes `reset_tokens.used`.

## Step 2 — Decide the minimal helper shape

Use one shared helper so GET and POST cannot diverge. It must:

1. Reject non-string/empty tokens before querying.
2. Look up the token with Sequelize (`where: { token }`).
3. Return `null` when the token is missing.
4. Treat a missing, null, empty, or invalid `expiration` as expired (fail closed).
5. Treat `expiration <= Date.now()` as expired.
6. Only then look up the account.
7. Return `null` when the account is missing.
8. Return both `resetToken` and `userAccount` (or an equivalent object) so the POST handler can delete the token.

Do not add a new service layer for this. The route module already owns this flow.

## Step 3 — Update the GET handler

Add an early invalid-token check **before** reading the email or rendering. For invalid/expired/missing tokens:

- return HTTP 404 with a generic message such as `Invalid or expired reset token`;
- do not render the reset form;
- do not look up the account after the expiry check fails;
- do not delete the token on GET (a GET is not a use).

## Step 4 — Update the POST handler

Add the same early invalid-token check **before** calling `PasswordResetService.setNewPassword`.

For invalid/expired/missing tokens:

- return the existing `'reset password failed'` string with HTTP 200;
- do not update the password;
- do not delete the token;
- do not throw.

For a valid token:

1. Call `passwordResetService.setNewPassword(uuid, { password, password2 })` exactly as today.
2. On success, delete the token row:
    ```js
    await db_models.reset_tokens.destroy({ where: { token: token } });
    ```
3. Only after the delete completes, return `'reset password successfully'`.

Do **not** delete the token when validation fails, when the password update throws, or when the request is a GET.

## Step 5 — Handle deletion failure explicitly

If `reset_tokens.destroy` throws after the password was already updated:

- log the failure with the existing `console.error` style;
- return `'reset password failed'` rather than claiming success, because the token may remain reusable;
- report this as a residual risk in the final report (the password may already have changed).

Do not silently swallow the deletion error and return success.

## Step 6 — Update the stale comment

The comment above `findUserAccountByResetToken` says null handling is intentionally unchanged. After this task, that is no longer true. Update or remove the stale comment so it describes the new behavior. Do not add unrelated commentary.

## Step 7 — Add focused tests

Create `test/049-reset-token-invalidation-and-expiry.test.js` using `node:test` + `node:assert`. Capture the real GET and POST handlers with a fake Express app, as `test/003.2-plaintext-password-storage-on-reset.test.js` does, and stub:

- `db.reset_tokens.findOne`
- `db.reset_tokens.destroy`
- `db.users_accounts.findOne`
- `db.users_accounts.update`

Cover at least the cases in §13. Close the legacy mysql2 pool in `after()` if the route import opens it.

## Step 8 — Run focused and regression tests

```bash
node --test test/049-reset-token-invalidation-and-expiry.test.js
node --test test/password-reset.test.js
node --test test/003.2-plaintext-password-storage-on-reset.test.js
node --test test/004-password-embedded-in-jwt-reset-token.test.js
node --test test/050-forgot-password-response.test.js
```

`npm test` is intentionally a failing stub. Do not change it.

## Step 9 — Run formatting

```bash
npx prettier --write app/routes/forgot-password.js test/049-reset-token-invalidation-and-expiry.test.js
```

If the repository convention requires `npm run lint`, run it and review the diff to avoid unrelated formatting churn.

## Step 10 — Perform a local runtime verification

Use a disposable local account only:

1. Request a reset token.
2. Open the reset link → form renders.
3. Submit a new password → exact success string.
4. Confirm the `reset_tokens` row is gone:
    ```sql
    SELECT * FROM reset_tokens WHERE token = '<test-token>';
    ```
    Expected: zero rows.
5. Submit the same token again → `'reset password failed'`; password is unchanged.
6. Open the same token in GET → 404 generic message.
7. Manually insert/update a token with an expiration in the past → both GET and POST reject it.
8. Request a missing token → no crash, generic failure.
9. Log in with the new password → success.

## Step 11 — Review the diff

Confirm only the files in §6 changed. Confirm no token, password, or hash was added to logs, responses, or test fixtures.

---

# 10. Architecture and Existing Patterns

Follow the existing project patterns:

- **Route module:** `app/routes/forgot-password.js` exports `module.exports = (app) => { ... }`. Keep this structure.
- **Data access:** use the existing Sequelize model `db_models.reset_tokens`; do not add raw SQL or a new repository.
- **Password reset service:** keep `app/services/password-reset.service.js` as the only place that hashes/updates passwords.
- **Testing:** use `node:test` + `node:assert`, and capture route handlers with a fake Express app as in `test/003.2-plaintext-password-storage-on-reset.test.js`.
- **Errors:** preserve the existing simple string responses. Do not introduce an error envelope, HTTP exception library, or new view.
- **Timestamps:** use `Date`/epoch comparison. Do not format dates into strings for comparison.
- **Validation:** the token is a public request parameter; treat it as untrusted input and let Sequelize bind it. Do not interpolate it into SQL.

Do not introduce a new dependency, framework, architecture, or design pattern when an appropriate existing project pattern already exists.

---

# 11. Security Requirements

## Must never happen

- A reset token must never be usable more than once after a successful reset.
- An expired token must never update a password.
- A missing token must never cause a `TypeError`, unhandled rejection, or 500 crash.
- An invalid token must never cause the reset form to render with an account email.
- The token must never be concatenated into a SQL string.
- The token must never be added to logs, error messages, analytics, or response bodies beyond the existing URL behavior.
- The reset success string must not be returned when the token was not invalidated.

## What must be validated

- Token presence and type.
- Token existence.
- Expiration presence and validity.
- Expiration is strictly in the future (`>` now; equality is expired).
- Account existence.
- Password validation remains in `PasswordResetService` (non-empty string, ≤72 UTF-8 bytes, confirmation match when supplied).

## What must be parameterized

- `reset_tokens.findOne({ where: { token } })`
- `reset_tokens.destroy({ where: { token } })`
- `users_accounts.findOne({ where: { uuid: resetToken.uuid } })`

All of these must remain Sequelize operations with bound values.

## Attack cases to test

- Missing token: `GET/POST /reset-password/does-not-exist`.
- Empty token: `GET/POST /reset-password/`.
- Very long token (thousands of characters).
- SQL-shaped token: `' OR '1'='1`, `" OR 1=1 --`, `%`, `_`, backslashes.
- Expired token: expiration in the past.
- Exactly-expired token: expiration equal to now (must be rejected).
- Null/invalid expiration value (must be rejected, fail closed).
- Reuse: successful reset followed by a second POST and a second GET.
- Missing user account for an otherwise valid token (must fail safely).
- Concurrent double-submit (report residual risk; see §13).

Do not limit security testing to the exact example in the finding. Inspect the affected code path for similar token-handling gaps.

---

# 12. Backward Compatibility

Preserve the following unless this document explicitly changes them:

- Route paths:
    - `GET /reset-password/:token`
    - `POST /reset-password/:token`
- Route registration in `app/src/server.js:166`.
- The reset form and its fields (`password`, `password2`, legacy ignored `password3`).
- The exact success response string: `'reset password successfully'`.
- The existing failure string for password validation/update errors: `'reset password failed'`.
- HTTP 200 for POST failure, so `public/assets/js/reset-password.js` continues to show its warning.
- The reset email link format and token UUID format.
- The one-hour token TTL in `POST /api/post/create-reset-token`.
- `PasswordResetService` validation, bcrypt cost 12, unique salt, and `silent: true` update behavior.
- The `reset_tokens` table and its columns; do not drop `used` or `expiration`.
- The forgot-password lookup response (Finding 50 is separate; do not change it here).
- The order of password update and success response for valid tokens; only add token deletion between them.

**Intentional behavior changes:**

- A missing/expired token now returns a generic error instead of crashing/rendering/updating.
- A token is removed after a successful reset and cannot be reused.

**Client compatibility note:** A user who opens an already-used link will now see a plain 404 message on GET instead of a working form. That is the intended security behavior. The POST path keeps the existing 200 + failure string contract so the current client still shows its warning.

---

# 13. Testing Strategy

## Normal Case

- Valid, unexpired token:
    - GET renders `public/view/reset-password/index` with the account email.
    - POST calls `setNewPassword` once and updates the password.
    - POST calls `reset_tokens.destroy` once with `{ where: { token } }`.
    - POST returns exactly `'reset password successfully'`.
    - The stored password is a bcrypt cost-12 hash (existing service behavior).
    - Login with the new password works.
    - The `reset_tokens` row is gone.

## Empty / Missing Input

- Missing token row:
    - GET returns 404, does not render, does not look up the account.
    - POST returns `'reset password failed'`, does not update, does not destroy.
- Empty token string.
- Missing `password` / `password2` with a valid token:
    - existing validation failure behavior remains (`'reset password failed'`);
    - token is **not** deleted so the user can retry.
- Missing body (`req.body` undefined) with a valid token:
    - existing behavior may throw when destructuring; do not change it as part of this task, but ensure the token is not deleted on failure.

## Boundary Cases

- Expiration exactly at `Date.now()` → reject.
- Expiration one millisecond in the future → accept (unless the test is flaky; use a comfortable margin such as 60 seconds).
- `expiration: null` → reject.
- `expiration: ''` → reject.
- `expiration: 'not-a-date'` → reject.
- Very long token (e.g., 10,000 characters) → reject/return not found without crashing.
- Unicode token.
- Token row exists but `uuid` does not match any account → reject safely.

## Invalid Input

- SQL injection-shaped token strings.
- Tokens with quotes, wildcards, slashes, and encoded characters.
- Unexpected HTTP methods (not required to change; report current behavior).
- Token containing NUL/control characters if the test harness allows it.

## Security Cases

- Successful reset followed by a second POST → failure; password not updated again.
- Successful reset followed by a second GET → 404; form not rendered.
- Expired token POST → no update, no destroy, failure response.
- Expired token GET → no account lookup, no render, 404.
- Missing token cannot crash the process (no unhandled rejection).
- Invalid token responses do not reveal whether the email/account exists.
- No token/password/hash is logged by the new code.
- Sequelize binding remains in place; no SQL string interpolation.

## Regression Testing

Run all of these:

```bash
node --test test/049-reset-token-invalidation-and-expiry.test.js
node --test test/password-reset.test.js
node --test test/003.2-plaintext-password-storage-on-reset.test.js
node --test test/004-password-embedded-in-jwt-reset-token.test.js
node --test test/050-forgot-password-response.test.js
```

Also perform the local end-to-end flow from §9, Step 10.

## Suggested test skeleton

```js
// test/049-reset-token-invalidation-and-expiry.test.js
const { test, before, after } = require('node:test');
const assert = require('node:assert');

require('dotenv').config();

const db = require('../app/db_models');
const legacyDb = require('../app/models/db.js');
const registerResetRoutes = require('../app/routes/forgot-password.js');

const TOKEN = 'task-049-reset-token';
const UUID = 'aaaa1111-bbbb-cccc-dddd-eeee4949ffff';
const EMAIL = 'task049@example.com';

let getHandler;
let postHandler;

function captureRoute(app, method, paths, handler) {
    const registered = [].concat(paths);
    if (registered.includes('/reset-password/:token')) {
        if (method === 'get') getHandler = handler;
        if (method === 'post') postHandler = handler;
    }
}

before(() => {
    // Stub db.reset_tokens.findOne / destroy, db.users_accounts.findOne / update.
    const app = {
        use: () => {},
        get: (paths, handler) => captureRoute(app, 'get', paths, handler),
        post: (paths, handler) => captureRoute(app, 'post', paths, handler),
    };
    registerResetRoutes(app);
});

after(async () => {
    // Restore stubs.
    await new Promise((resolve) => legacyDb.end(resolve));
});
```

Do not import the real database or SMTP. Do not add a test framework.

## Concurrency residual risk

Two truly concurrent POST requests can both pass the token lookup before either deletes it. The Finding 49 fix removes the token after a successful update, which prevents reuse in normal sequential use but does not provide a strict at-most-once guarantee under simultaneous requests. Do not add a transaction/row-lock redesign in this task unless the user explicitly asks; report this as a residual risk. If a small transactional change is proposed, it must be verified against the existing Sequelize setup and must not change success/failure contracts.

---

# 14. Verification / Evidence

The task is not complete because the code compiles. Provide evidence for each item.

1. **Final route code:** show the helper rejects missing/expired tokens and that POST deletes the token before returning success.
2. **Grep sweeps:**
    ```bash
    grep -n "expiration\|destroy\|findUserAccountByResetToken" app/routes/forgot-password.js
    grep -rn "reset_tokens.destroy\|reset_tokens.findOne" app/routes app/services --include=*.js
    ```
    Expected: expiry validation exists in one shared helper; token deletion exists only in the successful POST path.
3. **No accidental broad deletion:**
    ```bash
    grep -n "destroy" app/routes/forgot-password.js
    ```
    Expected: no `destroy({ where: {} })`, no deletion by `uuid` that would invalidate unrelated tokens, and no deletion in GET.
4. **Automated test output:** `node --test test/049-reset-token-invalidation-and-expiry.test.js`.
5. **Existing regression test output:**
    ```bash
    node --test test/password-reset.test.js
    node --test test/003.2-plaintext-password-storage-on-reset.test.js
    node --test test/004-password-embedded-in-jwt-reset-token.test.js
    node --test test/050-forgot-password-response.test.js
    ```
6. **Database evidence (local only):**
    - Before reset: `SELECT id, expiration, uuid FROM reset_tokens WHERE token = '<test-token>';` → one row.
    - After successful reset: same query → zero rows.
    - Second POST: response is `'reset password failed'`; the password hash in `users_accounts` is unchanged.
7. **Runtime evidence for expiry:** insert/update a token with `expiration = NOW() - INTERVAL 1 HOUR` in a local database; GET returns 404, POST returns failure, password unchanged.
8. **Runtime evidence for missing token:** `GET /reset-password/not-a-real-token` and `POST` the same → no crash, generic response.
9. **Full-flow evidence:** request reset → receive local email/link → open link → reset → login succeeds → revisit link → rejected.
10. **Diff review:** `git diff --stat` and focused `git diff`; only files in §6 changed.
11. **Log review:** confirm the new code does not log the token or password.
12. **Remaining findings:** explicitly report Findings 19, 23, 49, 50, 51, 3, 4 as fixed/separate/still present. Do not silently expand scope.

If a token can still be reused after a successful reset, or an expired token can still update a password, the task is **NOT** complete.

---

# 15. Do NOT Do

- Do not mark the token as used with `used = 1` unless the user explicitly requests that design. Finding 49 recommends deleting the row. An unused `used` column must not become a second, unenforced state.
- Do not delete the token on GET; GET is not a reset.
- Do not delete the token when password validation fails, confirmation mismatches, or the update throws. The user may need to retry with the same valid token.
- Do not delete all tokens for the user (`where: { uuid }`); only delete the token that was used.
- Do not delete tokens in `create-reset-token`; invalidating other outstanding tokens is a separate design decision.
- Do not change the token format, link format, or one-hour TTL.
- Do not change `PasswordResetService`, bcrypt cost, validation rules, or `silent: true`.
- Do not change the exact success string `'reset password successfully'`.
- Do not change the existing POST failure string `'reset password failed'` or its HTTP 200 status without updating the client and verifying it.
- Do not change the reset page, client JS, or EJS form unnecessarily.
- Do not introduce a 500/exception for invalid tokens.
- Do not reveal whether an email/account exists for an invalid token. Use the same generic GET message.
- Do not interpolate the token into SQL. Keep Sequelize parameter binding.
- Do not add a new dependency, transaction framework, error-envelope library, or test framework.
- Do not migrate the legacy mysql2 layer to Sequelize as part of this task.
- Do not fix Finding 19 broadly, Finding 50, Finding 51, Finding 48, or Finding 4 here.
- Do not modify `CODE_REVIEW.md`.
- Do not modify `.env`, secrets, SMTP configuration, deployment config, or SSL config.
- Do not use production data, real tokens, real account emails, or production SMTP.
- Do not add token logging "for debugging".
- Do not claim success from code inspection alone. Run the tests and the local flow.
- Do not commit unless the user explicitly asks.

---

# 16. Acceptance Criteria

## Acceptance Criteria

- [ ] `GET /reset-password/:token` rejects a missing token with a generic response and does not crash.
- [ ] `GET /reset-password/:token` rejects an expired token with a generic response and does not render the form.
- [ ] `GET /reset-password/:token` still renders the form for a valid, unexpired token with the correct email.
- [ ] `POST /reset-password/:token` rejects a missing token with `'reset password failed'` and does not update the password.
- [ ] `POST /reset-password/:token` rejects an expired token with `'reset password failed'` and does not update the password.
- [ ] Expiration is treated as expired when `expiration <= Date.now()`.
- [ ] Null/empty/invalid `expiration` fails closed.
- [ ] A successful reset deletes exactly the matching `reset_tokens` row.
- [ ] The success response is returned only after token deletion completes.
- [ ] A second POST with the same token fails and does not update the password again.
- [ ] A second GET with the same token does not render the form.
- [ ] Password validation failures do not delete the token.
- [ ] `PasswordResetService` and its bcrypt cost-12 behavior are untouched.
- [ ] The successful response is exactly `'reset password successfully'`.
- [ ] The reset page client and form are unchanged and still work.
- [ ] Invalid-token GET responses do not expose the account email.
- [ ] The token lookup and deletion use Sequelize parameter binding; no SQL interpolation is introduced.
- [ ] The new test `test/049-reset-token-invalidation-and-expiry.test.js` passes.
- [ ] `test/password-reset.test.js` passes.
- [ ] `test/003.2-plaintext-password-storage-on-reset.test.js` passes.
- [ ] `test/004-password-embedded-in-jwt-reset-token.test.js` passes.
- [ ] `test/050-forgot-password-response.test.js` passes.
- [ ] The local end-to-end reset flow works, and the token row is confirmed deleted.
- [ ] `npm run lint` (or targeted Prettier) was run and unrelated formatting churn was reviewed/reverted.
- [ ] `git diff` contains only the files listed in §6 (plus the new test).
- [ ] Remaining findings and residual risks (including concurrent double-submit and deletion failure after password update) are reported, not silently fixed or hidden.

---

# 17. Expected Final Report

Finish with this structure:

```markdown
# Implementation Report

## Summary

Brief explanation of the single-use token and expiry enforcement change, and
confirmation that password hashing and the reset UI contract are preserved.

## Files Modified

| File | Changes |
| --- | --- |
| `...` | ... |

## Files Added

| File | Purpose |
| --- | --- |
| `...` | ... |

## Files Deleted

| File | Reason |
| --- | --- |
| `...` | ... |

## Files Referenced Only

| File | Why |
| --- | --- |
| `...` | ... |

## Implementation Details

Explain the shared validation helper, the GET behavior, the POST behavior, and
the token deletion point.

## Testing

| Test | Result |
| --- | --- |
| Valid token GET renders | PASS/FAIL |
| Missing token GET → 404, no crash | PASS/FAIL |
| Expired token GET → 404, no render | PASS/FAIL |
| Valid token POST → success + token deleted | PASS/FAIL |
| Second POST → failure, no second update | PASS/FAIL |
| Expired token POST → failure, no update | PASS/FAIL |
| Invalid password → failure, token retained | PASS/FAIL |
| Existing reset tests | PASS/FAIL |
| Local end-to-end flow | PASS/FAIL |

## Verification

Show the code paths and commands used to prove:
- expiry is enforced on both handlers,
- the token row is deleted after success,
- a reused token fails,
- a missing token cannot crash,
- the password hash still uses bcrypt cost 12.

## Remaining Risks

List anything that could not be verified. Include:
- concurrent double-submit behavior,
- deletion failure after a successful password update,
- any untested legacy tokens or local DB limitations,
- Findings 19/50/51 if still present.

## Final Status

PASS / NEEDS REVIEW
```

---

# 18. Important Rules for the Implementing Agent

### Rule 1 — Do not hallucinate

This document distinguishes verified repository facts from recommendations. Line numbers may shift. Re-verify every claim before editing. If a fact cannot be verified, mark it `TO INVESTIGATE` rather than assuming.

### Rule 2 — Separate facts from recommendations

- **CURRENT IMPLEMENTATION (verified):** `findUserAccountByResetToken` does not check `expiration`, does not null-check the token, and the successful POST never deletes the token.
- **RECOMMENDED IMPLEMENTATION:** one shared validation helper that fails closed on missing/expired tokens, plus `reset_tokens.destroy({ where: { token } })` after a successful password update.

### Rule 3 — Prefer project consistency

Keep the existing route module, Sequelize model, `PasswordResetService`, string response contract, and `node:test` conventions. Do not introduce a new framework, service layer, transaction abstraction, or dependency for a small security fix.

### Rule 4 — Preserve behavior

The route paths, form fields, success string, POST failure string, token format, TTL, password hashing, and login behavior must survive. Only missing/expired token handling and post-success token deletion are intentionally new.

### Rule 5 — Think about the entire code path

Trace:

```text
create-reset-token
  → reset_tokens row (token + expiration)
  → emailed link
  → GET /reset-password/:token
  → token lookup
  → expiration check
  → account lookup
  → render form
  → POST /reset-password/:token
  → token lookup
  → expiration check
  → account lookup
  → PasswordResetService (bcrypt cost 12)
  → users_accounts update
  → reset_tokens destroy
  → success string
  → login
```

Do not fix only the single line named in the review. Verify the GET and POST handlers share the same validity rules and that the client contract still holds.

### Rule 6 — Make the task executable

WHAT: enforce expiry and invalidate the token after use. WHERE: §6. WHY: §3. HOW: §8-§9. WHAT NOT: §15. HOW TO TEST: §13. HOW TO VERIFY: §14.

---

# 19. Output Requirements for the Implementing Agent

- Produce the implementation and the final report described in §17.
- Keep the change set to the files in §6. Do not add unrelated documentation files.
- If a verified fact conflicts with this document (for example, another consumer depends on the old helper return shape, or `used` is actively written elsewhere), stop and report the conflict instead of guessing.
- Do not claim the finding is fixed until:
    - missing and expired tokens are rejected on both GET and POST,
    - a successful POST deletes exactly the matching token,
    - a reused token cannot reset the password again,
    - the focused test passes,
    - the existing reset tests pass,
    - and the local end-to-end flow works with the token row confirmed deleted.
- If the live local flow cannot be performed (no local database or SMTP), mark that verification item **NEEDS REVIEW** and state exactly what remains unverified.
- In the final report, explicitly distinguish:
    - Finding 49 (this task — token invalidation and expiry enforcement),
    - Finding 23 (duplicate, fixed by this task),
    - Finding 19 (minimal null guard added here; broader null/error handling remains separate),
    - Finding 50 (separate — forgot-password response disclosure),
    - Finding 51 (separate — no rate limiting/enumeration protection),
    - Finding 3 (already fixed — server-side bcrypt on reset),
    - Finding 4 (already fixed — unused password-bearing JWT removed).
