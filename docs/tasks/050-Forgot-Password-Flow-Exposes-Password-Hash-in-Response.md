# 050 — Stop Returning the Stored Password/Hash from the Forgot-Password Endpoint

| Field | Value |
| --- | --- |
| Document ID | `050` |
| Requested filename | `docs/tasks/050-Forgot-Password-Flow-Exposes-Password-Hash-in-Response.md` |
| Source finding | `CODE_REVIEW.md` → Detailed Findings → **Finding 50: Forgot Password Flow Exposes Password Hash in Response** (`app/controllers/forgot-password.controller.js`, `app/models/forgot-password.model.js`) |
| Priority | Security hygiene — medium/high. No numeric priority is assigned to Finding 50 in `CODE_REVIEW.md`; it is not in the "High Priority" roadmap table. Treat it as a real credential-disclosure defect, not as cosmetic cleanup. |
| Task type | API response hardening / removal of unnecessary credential handling. No schema change, no dependency change, no reset-flow behavior change. |
| Repository | All World Trade v11 — production Express/EJS/MySQL SSR application. Production behavior is the contract unless this document explicitly says otherwise. |
| Expected change size | Small: one model, one controller, optionally one shared query constant, plus one focused test. |

> **Scope note — related findings that must NOT be fixed here.**
>
> - Finding 3 (plaintext password storage on reset) is already addressed by `app/services/password-reset.service.js` and must remain intact.
> - Finding 4 (password-bearing unused JWT) is already addressed in the working tree; do not restore or re-implement the JWT/AES pipeline.
> - Finding 19/49 (missing null checks, expired-token checks, token invalidation) are separate.
> - Finding 46 (legacy non-bcrypt rows) is separate.
> - Finding 51 (no rate limiting on reset endpoints) is separate.
> - Finding 48 (public bcrypt hash/compare endpoints) is separate.
> - Finding 34 (migration of the legacy mysql2 stack to Sequelize) is separate.
>
> This task only removes the stored password value from the forgot-password lookup response and from the unused session copy of that row. It does not redesign the reset flow.

---

# 1. Task Title

**Remove the Stored Password/Hash from `POST /api/post/forgot-password-process` and Return Only the Non-Credential Fields the Reset Flow Needs**

---

# 2. Objective

## What must be accomplished

1. Stop `POST /api/post/forgot-password-process` from returning `password` to the client.
2. Ensure the controller cannot pass credential material through accidentally.
3. Stop storing the full `users_accounts` row (which currently includes the password value) in `req.session.forgotPassword`, because no code consumes that session value.
4. Where safe, stop fetching the password column for this lookup at all (defense in depth). This is conditional on the investigation proving that `USERS_ACCOUNTS.GET_BY_EMAIL` has no remaining consumer that needs `password`.
5. Preserve the response contract required by the current browser client:
    - `message: 'found'`
    - `email_or_social_media`
    - `uuid`
6. Preserve the not-found response, the HTTP behavior, and the entire downstream reset-token/reset-password flow.

## Why this is necessary

`CODE_REVIEW.md` Finding 50 reports that the forgot-password lookup returns `password: res[0].password` to the browser. Password hashes are sensitive credential material and must never leave the server unnecessarily. Worse, this codebase historically had a reset bug that stored plaintext passwords (Finding 3), so a legacy row may contain an actual plaintext password, not only a bcrypt hash.

The endpoint is public, has no authentication middleware, and has no rate limiting. Anyone who knows or guesses an email address can receive the account's stored password value in the JSON response. Even if the value is a bcrypt hash, it enables accelerated offline cracking, credential stuffing preparation, and disclosure through browser devtools, proxies, logs, monitoring, or API intermediaries.

## Expected end result

For an existing account, the response becomes:

```json
{
    "message": "found",
    "email_or_social_media": "user@example.com",
    "uuid": "550e8400-e29b-41d4-a716-446655440000"
}
```

It must contain **no** `password` key, no bcrypt hash, and no plaintext password.

For a non-existent account, the response remains:

```json
{
    "message": "not found"
}
```

The client still calls `/api/post/create-reset-token` with `email_or_social_media` and `uuid`, and that route still works because it does not need the password value.

---

# 3. Problem / Finding

## Weakness type

- **Exposure of sensitive information in an API response** — CWE-200.
- **Insufficiently protected credentials** — CWE-522.
- **Unnecessary credential handling/storage** — CWE-312 class for the unused session copy and unnecessary column selection.

## Severity

`CODE_REVIEW.md` does not assign a numeric severity to Finding 50. The realistic assessment is:

- The value is normally a bcrypt hash, so it is not immediately usable as a plaintext password.
- However, exposing it is unnecessary, increases the attack surface, and can expose plaintext for legacy rows written before Finding 3 was fixed.
- The endpoint is unauthenticated and unthrottled, so the leak is easy to reach.
- The same response also confirms whether an email exists and returns the account UUID used to create a reset token. That enumeration issue belongs to Finding 51 and is not changed here.

Do not describe this as "only a harmless hash". The correct description is: **the endpoint unnecessarily discloses credential material to any caller who submits an email address.**

## Attack surface

```text
POST /api/post/forgot-password-process
Content-Type: application/x-www-form-urlencoded

emailAddress=<victim-email>
```

Current response for a known account:

```json
{
    "message": "found",
    "email_or_social_media": "victim@example.com",
    "password": "$2b$12$........................................",
    "uuid": "........-....-....-....-............"
}
```

The endpoint has no auth middleware and no rate limiting. The response is produced for anyone who can reach the server.

## Current vulnerable code (verified)

`app/models/forgot-password.model.js:9-28`:

```js
Model.create = (newModel, result) => {
    let email = newModel.email_or_social_media;

    sql.query(USERS_ACCOUNTS.GET_BY_EMAIL, [email], (err, res) => {
        if (err) {
            result(null, { message: 'not found' });
            return;
        } else if (res.length > 0) {
            newModel.session.forgotPassword = res[0];
            result(null, {
                message: 'found',
                email_or_social_media: email,
                password: res[0].password,
                uuid: res[0].uuid,
            });
        } else {
            result(null, { message: 'not found' });
        }
    });
};
```

`app/controllers/forgot-password.controller.js:9-29`:

```js
exports.create = (req, res) => {
    if (!req.body) {
        res.status(400).send({
            message: 'Content can not be empty!',
        });
    }

    // Create a Controller
    const inputData = new Controller({
        email_or_social_media: req.body.emailAddress,
        session: req.session,
    });

    // Save Controller in the database
    Controller.create(inputData, (err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while creating the Model.',
            });
        else res.send(data);
    });
};
```

The controller does not whitelist the response. It sends whatever the model returns. The model explicitly adds the stored password value.

## Why the current implementation is unsafe

1. The response contains credential material.
2. The response is available without authentication.
3. The value may be a plaintext password for rows created by the historical reset bug (Finding 3).
4. The value is also copied into `req.session.forgotPassword` through `newModel.session.forgotPassword = res[0]`, even though no code reads that session key.
5. `USERS_ACCOUNTS.GET_BY_EMAIL` selects `password` even though this lookup only needs `email_or_social_media` and `uuid`.

## Important verified context

- The current browser client, `public/assets/js/forgot-password.js`, does **not** use `res.password`. It uses only `res.message`, `res.email_or_social_media`, and `res.uuid`.
- `POST /api/post/create-reset-token` destructures only `uuid` and `email_or_social_media` from `req.body` (`app/routes/forgot-password.js:46`). It does not need or accept password material.
- The Finding 4 work has already removed the JWT/AES/password forwarding from the client. An old cached client that still sends `password` to the reset-token route is harmless because the current route ignores it.
- No repository code reads `session.forgotPassword`. A repository-wide search found only the assignment in the model.

These facts are why removing `password` from the response is low risk and must not break the reset flow.

---

# 4. Affected Functionality

**Feature:** "Forgot password" request and reset-token creation.

```text
public/view/forgot-password/index.ejs
   ↓ user enters emailAddress
public/assets/js/forgot-password.js
   ↓ POST /api/post/forgot-password-process
app/routes/index.js:98
   ↓
app/controllers/forgot-password.controller.js
   ↓
app/models/forgot-password.model.js
   ├─ sql.query(USERS_ACCOUNTS.GET_BY_EMAIL, [email])
   ├─ session.forgotPassword = res[0]          ← unused, stores the full row
   └─ returns { message, email_or_social_media, password, uuid }
   ↓
app/controllers/forgot-password.controller.js
   └─ res.send(data)                            ← leaks password
   ↓
public/assets/js/forgot-password.js
   ├─ checks res.message === 'found'
   └─ createResetToken(res.email_or_social_media, res.uuid)
   ↓
POST /api/post/create-reset-token
   └─ app/routes/forgot-password.js:43-83 uses only uuid + email
   ↓
reset_tokens row + emailed reset link
   ↓
GET/POST /reset-password/:token
   └─ PasswordResetService (bcrypt cost 12) — unchanged
```

## What must keep working after this task

- Route path: `POST /api/post/forgot-password-process`.
- Route registration: `app/routes/index.js:98`.
- Request field: `emailAddress`.
- Found response: `message === 'found'`, plus `email_or_social_media`, plus `uuid`.
- Not-found response: `message === 'not found'`.
- Existing `res.status(500)` path for model errors.
- The browser client's branch `if (res.message === 'found')` and its call to `createResetToken(res.email_or_social_media, res.uuid)`.
- `POST /api/post/create-reset-token` and its UUID/link/insert behavior.
- The email reset link flow and the PasswordResetService hashing fix.
- The legacy callback-style model architecture (do not migrate this lookup to Sequelize in this task).

## Not in scope

- Login behavior or login session construction.
- Registration hashing.
- Reset-token expiry, invalidation, or null handling.
- Rate limiting or anti-enumeration behavior.
- Removal of the public bcrypt hash/compare endpoints.
- Removal of dead code elsewhere in `app/routes/forgot-password.js` (the global `User` function, unused imports, etc.).
- Database schema or column removal. **Do not drop or rename the `password` column.**

---

# 5. Investigation Phase (MANDATORY — do this before editing)

The coding agent must complete these checks and record any deviation in the final report.

1. **Re-read the repository rules:**
    - `README.md` — §8.2 Authentication Endpoints, §8.12 Password Reset Token Lifecycle, §12 Authentication & Security.
    - `AGENTS.md` — Auth & sessions, Backend conventions, Known technical debt.
    - `CODE_REVIEW.md` — Findings 3, 4, 19, 46, 49, 50, 51.

2. **Read the current implementation end to end:**
    - `app/controllers/forgot-password.controller.js`
    - `app/models/forgot-password.model.js`
    - `app/query/users_accounts.query.js` (`GET_BY_EMAIL`)
    - `app/routes/index.js:47,98`
    - `app/routes/forgot-password.js:43-83` (`create-reset-token`)
    - `public/assets/js/forgot-password.js`
    - `public/view/forgot-password/index.ejs`
    - `app/services/password-reset.service.js`
    - `test/password-reset.test.js` and `test/003.2-plaintext-password-storage-on-reset.test.js`

3. **Establish the current working-tree state before touching anything.**
    ```bash
    git status --short
    git diff -- app/models/forgot-password.model.js app/controllers/forgot-password.controller.js app/query/users_accounts.query.js public/assets/js/forgot-password.js
    ```
    The Finding 3 and Finding 4 changes are already present in some trees. Do not revert them. Do not assume line numbers in this document still match; re-read the files.

4. **Confirm the leak exists.**
    ```bash
    sed -n '1,80p' app/models/forgot-password.model.js
    sed -n '1,80p' app/controllers/forgot-password.controller.js
    sed -n '25,45p' app/query/users_accounts.query.js
    ```
    Expected: `password: res[0].password` is returned, `session.forgotPassword = res[0]` stores the row, and `GET_BY_EMAIL` selects `password`.

5. **Find every consumer of the response field and the session field.**
    ```bash
    grep -rn "forgot-password-process" app public test --include=*.js --include=*.ejs
    grep -rn "res\.password" public app test --include=*.js --include=*.ejs
    grep -rn "forgotPassword" app public test --include=*.js --include=*.ejs
    grep -rn "GET_BY_EMAIL" app public test --include=*.js
    ```
    Expected at the time of writing:
    - `forgot-password-process` appears in `app/routes/index.js` and `public/assets/js/forgot-password.js`.
    - `res.password` does **not** appear in the current forgot-password client.
    - `forgotPassword` appears only as the model assignment.
    - `GET_BY_EMAIL` appears in `app/models/forgot-password.model.js` and in the unused global `User` function in `app/routes/forgot-password.js:140-151`.
    If any additional consumer exists, stop and report it before removing the field or changing the query.

6. **Confirm the reset-token route does not need the password.**
    ```bash
    sed -n '43,83p' app/routes/forgot-password.js
    ```
    Expected: `const { uuid, email_or_social_media: receiverEmailAddress } = req.body;` and no password read.

7. **Confirm the client's success branch.**
    ```bash
    sed -n '1,40p' public/assets/js/forgot-password.js
    ```
    Expected: it reads `res.message`, `res.email_or_social_media`, and `res.uuid`; it does not read `res.password`.

8. **Confirm `GET_BY_EMAIL` has no other credential consumer.**
    The unused global `User` function resolves the query result and never consumes a field. If that is still true, removing `password` from the SELECT list is safe. If the function or any new code has started using `elements[0].password`, leave the query unchanged and report the conflict.

9. **Read the existing test conventions.**
    Tests use `node:test` and `node:assert`. Do not add Jest, Mocha, Supertest, or a new dependency. `npm test` is intentionally a failing stub; run focused tests with `node --test`.

10. **Record a baseline in a local environment.**
    - Start the app with `npm run dev`.
    - Use a disposable local account, never production data or production SMTP.
    - Submit the forgot-password form and observe the JSON response in browser DevTools → Network → Response.
    - Record whether `password` is present. Do not copy a real production hash into the task report.

11. **Check whether the response is cached or logged anywhere.**
    ```bash
    grep -rn "forgot-password-process\|forgot-password.controller" app --include=*.js
    ```
    Confirm the controller is not wrapped by logging middleware that records the response body. If it is, report it as an additional place where the hash may have been exposed.

---

# 6. File Impact Analysis

| File | Role | Action | Reason |
| --- | --- | --- | --- |
| `app/models/forgot-password.model.js` | Builds the forgot-password result and writes the session copy | **MODIFY** | Remove `password: res[0].password`; remove the unused `session.forgotPassword` assignment. |
| `app/controllers/forgot-password.controller.js` | Builds model input and sends the model result | **MODIFY** | Stop passing `req.session` into the model constructor. Keep the existing response and error behavior. Optionally whitelist the response fields. |
| `app/query/users_accounts.query.js` | Shared raw query constant | **MODIFY (conditional, defense in depth)** | Remove `password` from `GET_BY_EMAIL` only after step 5/8 proves no consumer needs it. If a consumer is found, leave it unchanged and report. |
| `public/assets/js/forgot-password.js` | Browser client | **REFERENCE ONLY** | Already uses only `message`, `email_or_social_media`, and `uuid`; no change required. |
| `app/routes/forgot-password.js` | Reset-token and reset-password routes | **REFERENCE ONLY** | `create-reset-token` needs only `uuid` and `email_or_social_media`; do not change it. |
| `app/routes/index.js` | Route registration | **REFERENCE ONLY** | `POST /api/post/forgot-password-process` wiring must stay unchanged. |
| `app/services/password-reset.service.js` | Server-side bcrypt reset service | **REFERENCE ONLY** | Finding 3 fix must remain untouched. |
| `test/050-forgot-password-response.test.js` | Focused regression/security test | **ADD** | Prove the response and session contain no password value. Use `node:test` + `node:assert`. |
| `test/password-reset.test.js`, `test/003.2-plaintext-password-storage-on-reset.test.js` | Existing regression tests | **REFERENCE ONLY** | Run them; do not modify them. |
| `README.md` | Documentation | **REFERENCE ONLY** | The documented reset flow does not promise a password in the response. No update is required for this task. |
| `package.json` / `package-lock.json` | Dependencies | **REFERENCE ONLY** | No new dependency is needed. |
| `app/db_models/users_accounts.model.js` | Sequelize model | **REFERENCE ONLY** | Confirms the `password` column exists; do not modify the schema. |
| `CODE_REVIEW.md` | Historical review | **REFERENCE ONLY** | Do not edit it as part of the fix. |

No database migration, schema change, environment-variable change, package install, CSS change, or EJS change is required.

---

# 7. Current Implementation (verified)

## 7.1 Model — `app/models/forgot-password.model.js`

```js
const sql = require('./db.js');
const USERS_ACCOUNTS = require('../query/users_accounts.query.js');

const Model = function (model) {
    this.email_or_social_media = model.email_or_social_media;
    this.session = model.session;
};

Model.create = (newModel, result) => {
    let email = newModel.email_or_social_media;

    sql.query(USERS_ACCOUNTS.GET_BY_EMAIL, [email], (err, res) => {
        if (err) {
            result(null, { message: 'not found' });
            return;
        } else if (res.length > 0) {
            newModel.session.forgotPassword = res[0];
            result(null, {
                message: 'found',
                email_or_social_media: email,
                password: res[0].password,
                uuid: res[0].uuid,
            });
        } else {
            result(null, { message: 'not found' });
        }
    });
};

module.exports = Model;
```

Observed behavior:

- The query is parameterized: `sql.query(USERS_ACCOUNTS.GET_BY_EMAIL, [email], ...)`. Do not change that safety property.
- On a database error, the model reports `not found`. That behavior is unusual but pre-existing; do not change it in this task.
- On a match, the full row is copied into `newModel.session.forgotPassword`.
- On a match, the response object explicitly includes `password`.

## 7.2 Controller — `app/controllers/forgot-password.controller.js`

```js
const Controller = require('../models/forgot-password.model.js');

// Create and Save a new Controller
exports.create = (req, res) => {};

// ===================
// Create a new object
// ===================
exports.create = (req, res) => {
    if (!req.body) {
        res.status(400).send({
            message: 'Content can not be empty!',
        });
    }

    // Create a Controller
    const inputData = new Controller({
        email_or_social_media: req.body.emailAddress,
        session: req.session,
    });

    // Save Controller in the database
    Controller.create(inputData, (err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while creating the Model.',
            });
        else res.send(data);
    });
};
```

Observed behavior:

- The controller passes `req.session` into the model.
- The controller sends the model result directly with `res.send(data)`.
- The duplicate empty `exports.create` at the top is existing dead code. Do not clean it up in this task.

## 7.3 Query — `app/query/users_accounts.query.js:30-35`

```js
GET_BY_EMAIL: `SELECT 
        email_or_social_media, 
        password, 
        uuid
        FROM users_accounts 
        WHERE email_or_social_media = ? `,
```

Observed behavior:

- The query is parameterized.
- It selects `password` even though the forgot-password lookup only needs `email_or_social_media` and `uuid`.
- The query is shared with the unused `User` function in `app/routes/forgot-password.js:140-151`.

## 7.4 Client — `public/assets/js/forgot-password.js:4-20`

```js
function forgotPasswordSubmitHandler(e) {
    e.preventDefault();

    $.ajax({
        url: '/api/post/forgot-password-process',
        type: 'POST',
        data: forgotPasswordForm.serialize(),
        success: function (res) {
            Swal.fire('Success', 'Email Send Successfully', 'success');
            if (res.message === 'found') {
                createResetToken(res.email_or_social_media, res.uuid);
            } else {
                Swal.fire('Warning', 'Email not found', 'warning');
            }
        },
    });
}
```

Observed behavior:

- The client does not read `res.password`.
- The client needs `message`, `email_or_social_media`, and `uuid`.
- Removing `password` therefore does not require a client change.

## 7.5 Downstream route — `app/routes/forgot-password.js:43-83`

```js
app.post('/api/post/create-reset-token', async function (req, res, next) {
    const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

    const { uuid, email_or_social_media: receiverEmailAddress } = req.body;

    // A fresh UUID v4 is the reset token. Nothing credential-related is
    // accepted, derived, or embedded here.
    function buildResetTokenData() {
        // ...token/link/expiration/response...
    }

    // ...insert reset_tokens and send the response...
});
```

Observed behavior:

- The reset-token route does not consume a password value.
- Removing the password from the forgot-password response cannot break reset-token creation.

---

# 8. Current → Target

## Current

```text
POST /api/post/forgot-password-process
  → model queries users_accounts and receives { email, password, uuid }
  → model copies the entire row into session.forgotPassword
  → model returns { message, email, password, uuid }
  → controller res.send(data)
  → browser receives the password/hash
```

## Target

```text
POST /api/post/forgot-password-process
  → model queries users_accounts for { email, uuid } only
  → model does not copy the row into the session
  → model returns { message, email, uuid }
  → controller res.send(data)
  → browser receives no password/hash
```

## Before/after — model result

CURRENT:

```js
newModel.session.forgotPassword = res[0];
result(null, {
    message: 'found',
    email_or_social_media: email,
    password: res[0].password,
    uuid: res[0].uuid,
});
```

TARGET:

```js
result(null, {
    message: 'found',
    email_or_social_media: email,
    uuid: res[0].uuid,
});
```

Do not add a replacement field such as `hashed_password`, `password_hash`, `credentials`, `row`, or `user`. The target response must not contain any credential material under a different name.

## Before/after — model constructor and controller input

CURRENT:

```js
const Model = function (model) {
    this.email_or_social_media = model.email_or_social_media;
    this.session = model.session;
};
```

```js
const inputData = new Controller({
    email_or_social_media: req.body.emailAddress,
    session: req.session,
});
```

TARGET:

```js
const Model = function (model) {
    this.email_or_social_media = model.email_or_social_media;
};
```

```js
const inputData = new Controller({
    email_or_social_media: req.body.emailAddress,
});
```

This is safe only because the investigation proves no consumer reads `session.forgotPassword`. If a consumer exists, stop and report it instead of removing the assignment.

## Before/after — query (conditional defense in depth)

CURRENT:

```js
GET_BY_EMAIL: `SELECT 
        email_or_social_media, 
        password, 
        uuid
        FROM users_accounts 
        WHERE email_or_social_media = ? `,
```

TARGET (only if no consumer needs `password`):

```js
GET_BY_EMAIL: `SELECT 
        email_or_social_media, 
        uuid
        FROM users_accounts 
        WHERE email_or_social_media = ? `,
```

If the unused `User` function or any other code is found to consume `password` from this query, leave the query unchanged and report the conflict. The response must still not include the password; the model-level removal is non-negotiable.

---

# 9. Detailed Implementation Plan

## Step 1 — Inspect the existing implementation

Read all files listed in §5. Record:
- whether the tree already has Finding 3/4 changes,
- whether `password` is still returned,
- whether `session.forgotPassword` is still assigned,
- every consumer of `GET_BY_EMAIL`, `forgot-password-process`, `res.password`, and `forgotPassword`.

Do not edit before completing this step.

## Step 2 — Confirm the response consumers

Run the searches in §5, steps 5-8. Confirm that the only in-repo consumer of the forgot-password response uses `message`, `email_or_social_media`, and `uuid`.

If another consumer exists, determine whether it needs `password`. If it does, stop and escalate rather than silently breaking it. Given the repository search at the time of writing, no such consumer exists.

## Step 3 — Modify the model

In `app/models/forgot-password.model.js`:

1. Remove `this.session = model.session;` from the constructor.
2. Remove `newModel.session.forgotPassword = res[0];`.
3. Remove `password: res[0].password,` from the returned object.
4. Keep `message`, `email_or_social_media`, and `uuid`.
5. Keep the existing `sql.query(USERS_ACCOUNTS.GET_BY_EMAIL, [email], ...)` call and its callback shape.
6. Keep the existing error/not-found branch behavior.

Expected result:

```js
const sql = require('./db.js');
const USERS_ACCOUNTS = require('../query/users_accounts.query.js');

const Model = function (model) {
    this.email_or_social_media = model.email_or_social_media;
};

Model.create = (newModel, result) => {
    const email = newModel.email_or_social_media;

    sql.query(USERS_ACCOUNTS.GET_BY_EMAIL, [email], (err, res) => {
        if (err) {
            result(null, { message: 'not found' });
            return;
        }

        if (res.length > 0) {
            result(null, {
                message: 'found',
                email_or_social_media: email,
                uuid: res[0].uuid,
            });
        } else {
            result(null, { message: 'not found' });
        }
    });
};

module.exports = Model;
```

The exact formatting should match Prettier. Do not change the `message` strings.

## Step 4 — Modify the controller

> **Ordering caution:** remove `newModel.session.forgotPassword = res[0]` from the model **before** removing `session` from the controller input. If the controller stops supplying a session but the model still assigns `newModel.session.forgotPassword`, the request will throw. Apply both halves of the change together and test the endpoint immediately.

In `app/controllers/forgot-password.controller.js`:

1. Stop passing `session: req.session` into `new Controller(...)`.
2. Keep `email_or_social_media: req.body.emailAddress`.
3. Keep `res.status(400)` and `res.status(500)` behavior unchanged.
4. Keep `res.send(data)` unless the team prefers an explicit response allowlist (see below).
5. Do not clean up the duplicate empty `exports.create` stub in this task.

Minimal target:

```js
const inputData = new Controller({
    email_or_social_media: req.body.emailAddress,
});
```

Optional stricter controller allowlist:

```js
Controller.create(inputData, (err, data) => {
    if (err) {
        res.status(500).send({
            message: err.message || 'Some error occurred while creating the Model.',
        });
        return;
    }

    res.send({
        message: data.message,
        email_or_social_media: data.email_or_social_media,
        uuid: data.uuid,
    });
});
```

Choose one approach and keep the response shape identical to the target in §2. If the allowlist is used, ensure the not-found response remains `{ "message": "not found" }` (the other keys become `undefined` and are omitted by JSON serialization). Do not expose `data.password` even if a future model regression reintroduces it.

## Step 5 — Remove the password from the shared query (conditional)

Only after Step 2 confirms no consumer needs `password`:

1. Edit `GET_BY_EMAIL` in `app/query/users_accounts.query.js` to select only `email_or_social_media` and `uuid`.
2. Keep the `WHERE email_or_social_media = ?` parameterized clause unchanged.
3. Do not rename the query constant.
4. Do not add a second near-identical query constant unless the team already prefers that pattern.

If any consumer needs the password from this query, skip this step and document why. The model and controller changes already remove the client exposure.

## Step 6 — Add a focused test

Add `test/050-forgot-password-response.test.js` using `node:test` and `node:assert`.

The test must prove:

1. A found account returns `message`, `email_or_social_media`, and `uuid` — and no `password` key.
2. The serialized response does not contain the hash/plaintext value supplied by the fake database row.
3. The session does not contain `forgotPassword` after the request.
4. A not-found account still returns `{ message: 'not found' }`.
5. A database error still follows the existing behavior (currently `{ message: 'not found' }`).
6. The `GET_BY_EMAIL` query string does not select `password` **if Step 5 was performed**.
7. A payload with quotes or SQL-shaped input is still passed as a bound parameter and is never interpolated into SQL (regression check).

### Suggested test approach

The model imports the legacy mysql2 pool from `app/models/db.js`. Stub `legacyDb.query` in `before()` and restore/close it in `after()`:

```js
const { test, before, after } = require('node:test');
const assert = require('node:assert');

require('dotenv').config();

const legacyDb = require('../app/models/db.js');
const Model = require('../app/models/forgot-password.model.js');
const controller = require('../app/controllers/forgot-password.controller.js');

const EMAIL = 'task050@example.com';
const UUID = 'aaaa1111-bbbb-cccc-dddd-eeee5050ffff';
const STORED_HASH = '$2b$12$fakehashfakehashfakehashfakehashfakehashfakehashfake';

let originalQuery;

before(() => {
    originalQuery = legacyDb.query;
});

after(async () => {
    legacyDb.query = originalQuery;
    await new Promise((resolve) => legacyDb.end(resolve));
});

function submit(body) {
    return new Promise((resolve, reject) => {
        const req = { body, session: {} };
        const res = {
            statusCode: 200,
            status(code) {
                this.statusCode = code;
                return this;
            },
            send(payload) {
                resolve({ statusCode: this.statusCode, body: payload, session: req.session });
            },
        };

        try {
            controller.create(req, res);
        } catch (error) {
            reject(error);
        }
    });
}

test('found response contains no password value', async () => {
    legacyDb.query = (sql, params, callback) => {
        assert.deepStrictEqual(params, [EMAIL]);
        callback(null, [{ email_or_social_media: EMAIL, password: STORED_HASH, uuid: UUID }]);
    };

    const result = await submit({ emailAddress: EMAIL });

    assert.strictEqual(result.body.message, 'found');
    assert.strictEqual(result.body.email_or_social_media, EMAIL);
    assert.strictEqual(result.body.uuid, UUID);
    assert.strictEqual(result.body.password, undefined);
    assert.ok(!JSON.stringify(result.body).includes(STORED_HASH));
    assert.strictEqual(result.session.forgotPassword, undefined);
});
```

Add not-found and error cases with stubbed callbacks. Do not require a live database for these unit tests; the real pool is only imported and then closed in `after()`.

If the test is not feasible in the current environment because importing `app/models/db.js` opens an unavoidable live pool, fall back to the manual runtime verification in §13 and mark the automated test as **NEEDS REVIEW**. Do not add a new mocking dependency.

## Step 7 — Run the tests

```bash
node --test test/050-forgot-password-response.test.js
node --test test/password-reset.test.js
node --test test/003.2-plaintext-password-storage-on-reset.test.js
```

The existing reset tests must continue to pass. The repository's `npm test` is an intentionally failing stub; do not treat that as a regression.

## Step 8 — Run the formatter

```bash
npm run lint
```

`npm run lint` runs `npx prettier --write .` in this repository. Review the resulting diff and revert any unrelated formatting churn if the formatter touches files outside the task. Do not commit.

## Step 9 — Manual runtime verification

Use a local environment and a disposable account:

1. Start `npm run dev`.
2. Submit the forgot-password form for an existing local account.
3. Inspect the response body in DevTools or with `curl`.
4. Confirm there is no `password` key and no bcrypt string.
5. Confirm the client still proceeds to create a reset token and send the reset email.
6. Complete the reset and log in with the new password.
7. Repeat with a non-existent email and confirm the not-found behavior is unchanged.

## Step 10 — Review the final diff

```bash
git diff --stat
git diff -- app/models/forgot-password.model.js app/controllers/forgot-password.controller.js app/query/users_accounts.query.js test/050-forgot-password-response.test.js
```

Confirm:
- No unrelated files changed.
- No production secrets or real hashes were copied into tests or reports.
- Finding 3/4 changes are intact.
- No new dependency was added.

---

# 10. Architecture and Existing Patterns

The coding agent must prefer existing project patterns over introducing a new architecture.

Search for and follow:

- The legacy callback model/controller pattern used by `app/models/forgot-password.model.js`.
- The existing parameterized query style in `app/query/users_accounts.query.js`.
- The existing response behavior in `app/controllers/forgot-password.controller.js`.
- The existing `node:test` + `node:assert` test style in `test/login.test.js`, `test/password-reset.test.js`, and `test/003.2-plaintext-password-storage-on-reset.test.js`.
- The existing service/hashing patterns in `app/services/password-reset.service.js` only as a reference; do not modify that service.

Explicitly:

> Do not introduce a new dependency, framework, architecture, or design pattern when an appropriate existing project pattern already exists.

Do not migrate this endpoint to Sequelize in this task. Finding 34 is a separate, larger migration. A small targeted change in the existing legacy stack is safer for production.

Do not create a new service just to return three fields. The existing model is the correct place for this small response shaping.

---

# 11. Security Requirements

- Never return `password`, `password_hash`, `hashed_password`, a bcrypt string, or any equivalent credential material in the forgot-password response.
- Never return the raw database row (`res[0]`) to the controller or client.
- Never put the raw database row into `req.session` when no consumer needs it.
- Never log the response body or the hash.
- Never interpolate the email into SQL. Keep the existing `[email]` placeholder binding.
- Do not weaken the existing response behavior to "hide" the leak by returning a generic message only; the current client needs `message`, `email_or_social_media`, and `uuid`. Preserve those fields.
- Do not add the password back under a different field name.
- Do not rely on bcrypt being one-way as a justification for exposing it. A hash is still sensitive credential material.
- Remember that legacy rows may contain plaintext because of the historical Finding 3 bug. Treat the value as potentially plaintext.
- Do not add authentication, rate limiting, CSRF, or anti-enumeration changes in this task. Finding 51 covers rate limiting/enumeration.
- Test malicious input such as `" OR "1"="1`, `' OR '1'='1`, `%`, `_`, very long values, and Unicode. Confirm these remain bound values and are not reflected into SQL; the response must still not contain a password even when the lookup matches.

---

# 12. Backward Compatibility

Preserve the following unless this document explicitly changes them:

- `POST /api/post/forgot-password-process` route path and registration.
- Request field name `emailAddress`.
- Found response `message` value exactly `'found'`.
- Not-found response `message` value exactly `'not found'`.
- `email_or_social_media` and `uuid` still present on the found response.
- `res.status(400)` behavior for an empty body.
- `res.status(500)` behavior when the model callback returns an error.
- Existing database error behavior (the model currently maps query errors to `not found`).
- The callback-style model interface.
- The parameterized `GET_BY_EMAIL` query.
- The `users_accounts` schema; the `password` column stays in the database.
- The reset-token route, reset email, reset page, and PasswordResetService.
- No change to the `public/assets/js/forgot-password.js` behavior.
- No change to the login flow or session shape outside the removed unused `forgotPassword` key.

The only intentional API change is removing the `password` field. This is a security fix, and no in-repo consumer depends on it. If an unknown external API consumer exists, it must be identified during investigation; otherwise the task may break an undocumented integration. Report this risk rather than guessing.

Do not change the response to a different status code or wrap it in a new envelope. Do not rename `email_or_social_media`.

---

# 13. Testing Strategy

## Normal Case

- Existing email:
    - response is `{ message: 'found', email_or_social_media: <email>, uuid: <uuid> }`
    - no `password` key
    - no bcrypt hash or plaintext in `JSON.stringify(response)`
    - session has no `forgotPassword`
    - client proceeds to `/api/post/create-reset-token`
    - reset email flow still works
    - password can be reset and used to log in

## Empty / Missing Input

- Missing `emailAddress`:
    - current behavior may be a 400 or an error depending on the body-parser path; do not change it in this task.
    - verify no credential material is returned.
- Empty string email:
    - verify no hash is returned; behavior should remain whatever it is today.
- `req.body` missing entirely:
    - do not "fix" the pre-existing early-return bug in this task; just verify the change does not worsen it.

## Boundary Cases

- Very long email string.
- Unicode email-like input.
- `null` body values if the client can produce them.
- Email with `%` and `_` wildcard characters (the query uses `=` with a bound value, so they must be treated literally).
- An account whose stored password is a bcrypt hash.
- A legacy account whose stored password is plaintext (use a disposable local fixture only; never production data).

## Invalid Input

- SQL-shaped email strings.
- Email strings containing quotes, backslashes, comment markers, or semicolons.
- Unexpected content types.
- Multiple `emailAddress` values if the form parser allows them.

All invalid input must not cause the response to include a password value. It must also not change the parameterized query behavior.

## Security Cases

- Response body does not contain `password` as a key.
- Response body does not contain the stored hash string.
- Response body does not contain plaintext credentials.
- Session does not contain a full account row.
- No password value is logged.
- SQL injection style input remains a bound value.
- An old cached client that still sends `password` to `create-reset-token` continues to work because the route ignores it.
- Confirm the endpoint's known enumeration behavior is unchanged (Finding 51 owns the fix).

## Regression Testing

- `node --test test/050-forgot-password-response.test.js`
- `node --test test/password-reset.test.js`
- `node --test test/003.2-plaintext-password-storage-on-reset.test.js`
- Full local flow: forgot password → reset token → email link → reset password → login.
- Not-found flow: unknown email still shows the existing "Email not found" client behavior.

Do not add a test framework. Do not use production data, production SMTP, or production database credentials.

---

# 14. Verification / Evidence

The task is not complete because the code compiles. Provide evidence for each item.

1. **Final model code:** show the returned object contains only `message`, `email_or_social_media`, and `uuid`.
2. **Final controller code:** show no `session` is passed into the model, and no `data.password` is sent.
3. **Grep sweep — response construction:**
    ```bash
    grep -n "password" app/models/forgot-password.model.js
    grep -n "session\|password" app/controllers/forgot-password.controller.js
    ```
    Expected: no password field is added to the response; no `session.forgotPassword` remains.
4. **Grep sweep — consumers:**
    ```bash
    grep -rn "forgotPassword" app public test --include=*.js --include=*.ejs
    grep -rn "res\.password" public app test --include=*.js --include=*.ejs
    grep -rn "GET_BY_EMAIL" app public test --include=*.js
    ```
    Expected: the old session key is gone; no client reads `res.password`; the shared query usage is understood.
5. **Query evidence (if modified):**
    ```bash
    sed -n '25,45p' app/query/users_accounts.query.js
    ```
    Expected: `GET_BY_EMAIL` does not select `password`.
6. **Automated test output:** `node --test test/050-forgot-password-response.test.js`.
7. **Existing regression tests:** `node --test test/password-reset.test.js` and `node --test test/003.2-plaintext-password-storage-on-reset.test.js`.
8. **Runtime evidence:** paste the sanitized response from a disposable local account:
    ```json
    {
        "message": "found",
        "email_or_social_media": "disposable@example.com",
        "uuid": "...."
    }
    ```
    Do not paste a real hash or real account data.
9. **Negative runtime evidence:** unknown email returns `{ "message": "not found" }` and the client behavior is unchanged.
10. **Full-flow evidence:** the emailed reset link still opens, the password reset succeeds, and login works.
11. **Diff review:** `git diff --stat` and the focused `git diff`; only files listed in §6 changed.
12. **Remaining findings:** explicitly report Findings 3, 4, 19, 46, 49, 51, and 34 as either already fixed, separate, or still present. Do not silently expand scope.

If any response path still serializes a password/hash, the task is **NOT** complete.

---

# 15. Do NOT Do

- Do not expose the password value under any alternate key.
- Do not return the raw `res[0]` row object.
- Do not keep `session.forgotPassword = res[0]` "for compatibility" unless a verified consumer needs it. None is known.
- Do not store the hash in a cookie, JWT, URL, HTML, or log.
- Do not change the hashing algorithm, bcrypt cost, or `PasswordResetService`.
- Do not change the `users_accounts` schema or drop the `password` column.
- Do not remove the password column from the database; only stop selecting/returning it where unnecessary.
- Do not change the reset-token route, its UUID token, its expiration, or its email flow.
- Do not change the `'found'` / `'not found'` message strings; the client depends on them.
- Do not change the response status codes or introduce a new response envelope.
- Do not fix the pre-existing empty-body early-return bug in the controller (missing `return`).
- Do not clean up unrelated dead code in `app/routes/forgot-password.js`.
- Do not migrate the model/controller to Sequelize (Finding 34).
- Do not add authentication middleware, rate limiting, CSRF, or anti-enumeration behavior (Findings 6/51).
- Do not modify `.env`, secrets, SMTP configuration, deployment config, or SSL config.
- Do not add a new dependency or test framework.
- Do not modify `CODE_REVIEW.md`.
- Do not rewrite `README.md` for this small fix unless a verified documentation statement is actually wrong.
- Do not use production data, real hashes, or real SMTP.
- Do not claim success from code inspection alone. Run the tests and the local flow.
- Do not commit unless the user explicitly asks.

---

# 16. Acceptance Criteria

## Acceptance Criteria

- [ ] `app/models/forgot-password.model.js` no longer returns `password`.
- [ ] The found response contains exactly the intended public fields: `message`, `email_or_social_media`, `uuid` (plus no credential-material keys).
- [ ] The not-found response remains `{ "message": "not found" }`.
- [ ] `newModel.session.forgotPassword = res[0]` is removed, after confirming no consumer.
- [ ] `app/controllers/forgot-password.controller.js` no longer passes `req.session` into the model.
- [ ] The controller does not send `data.password` directly or indirectly.
- [ ] If the shared query is changed, `GET_BY_EMAIL` no longer selects `password`, and no consumer is broken.
- [ ] `public/assets/js/forgot-password.js` is unchanged and still works with `message`, `email_or_social_media`, and `uuid`.
- [ ] `POST /api/post/create-reset-token` is unchanged and still works without a password field.
- [ ] The reset email flow works end to end.
- [ ] `PasswordResetService` and its bcrypt cost-12 behavior are untouched.
- [ ] A found response never contains the test/fake hash or plaintext in its serialized body.
- [ ] A legacy plaintext-row scenario does not expose the plaintext in the response.
- [ ] No password value is logged.
- [ ] The `[email]` parameter binding remains; no SQL interpolation is introduced.
- [ ] `node --test test/050-forgot-password-response.test.js` passes.
- [ ] `node --test test/password-reset.test.js` passes.
- [ ] `node --test test/003.2-plaintext-password-storage-on-reset.test.js` passes.
- [ ] The full local forgot-password → reset → login flow passes.
- [ ] `npm run lint` was run and unrelated formatting churn was reviewed/reverted if necessary.
- [ ] `git diff` contains only the files listed in §6 (plus the new test).
- [ ] Remaining findings are reported, not silently fixed.

---

# 17. Expected Final Report

Finish with this structure:

```markdown
# Implementation Report

## Summary

Brief explanation of what was removed/changed and confirmation that the reset
flow and the Finding 3 bcrypt behavior are preserved.

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

Explain:
- the removed `password` field,
- the removed unused session copy,
- the controller input change,
- whether the shared query was changed and why,
- confirmation that the client and reset-token route did not need changes.

## Testing

| Test | Result |
| --- | --- |
| Found account returns no `password` key | PASS/FAIL |
| Found response does not contain the fake hash/plaintext | PASS/FAIL |
| Session has no `forgotPassword` | PASS/FAIL |
| Unknown email returns `not found` | PASS/FAIL |
| Database-error behavior unchanged | PASS/FAIL |
| SQL-shaped email remains a bound value | PASS/FAIL |
| Full forgot-password → reset → login flow | PASS/FAIL |
| `node --test test/050-forgot-password-response.test.js` | PASS/FAIL |
| `node --test test/password-reset.test.js` | PASS/FAIL |
| `node --test test/003.2-plaintext-password-storage-on-reset.test.js` | PASS/FAIL |

## Verification

Show the grep sweep, the final model/controller code, the sanitized runtime
response, the test output, and the final diff review. State explicitly whether
`GET_BY_EMAIL` still selects `password` and why.

## Remaining Risks

Report at minimum:

- Whether any external/undocumented consumer might still expect `res.password`.
- Finding 51: the endpoint still has no rate limiting and still reveals whether
  an email exists.
- Finding 19/49: reset-token null checks, expiry enforcement, and invalidation
  remain separate.
- Finding 46: legacy non-bcrypt password rows may still exist; this task stops
  returning them but does not migrate them.
- Any inability to run the live local flow or automated test.

## Final Status

PASS / NEEDS REVIEW
```

---

# 18. Important Rules for the Implementing Agent

### Rule 1 — Do not hallucinate

This document distinguishes verified repository facts from recommendations. Line numbers may shift. Re-verify every claim before editing. If a fact cannot be verified, mark it `TO INVESTIGATE` rather than assuming.

### Rule 2 — Separate facts from recommendations

- **CURRENT IMPLEMENTATION (verified):** the model returns `password: res[0].password`, copies the whole row into `session.forgotPassword`, and the controller sends the model result directly.
- **RECOMMENDED IMPLEMENTATION:** return only non-credential fields, remove the unused session copy, stop passing `session` into the model, and stop selecting `password` where it is no longer needed.

### Rule 3 — Prefer project consistency

Keep the existing route module, callback-style model, parameterized query constant, controller response shape, and `node:test` conventions. Do not introduce a new framework or architecture for a three-field response change.

### Rule 4 — Preserve behavior

The endpoint path, request field, `'found'` / `'not found'` messages, `email_or_social_media`, `uuid`, status handling, reset-token route, email flow, and bcrypt reset service must survive. The only intentional API change is the removal of the `password` field.

### Rule 5 — Think about the entire code path

Trace:

```text
forgot-password form
  → /api/post/forgot-password-process
  → controller
  → model
  → users_accounts query
  → session copy
  → response serialization
  → client
  → /api/post/create-reset-token
  → emailed reset link
  → GET/POST /reset-password/:token
  → PasswordResetService (bcrypt)
  → login
```

Do not fix only the single line named in the review. Verify that the client and the reset-token route do not depend on the removed field, and check the session copy.

### Rule 6 — Make the task executable

WHAT: remove credential material from the lookup response and unused session copy. WHERE: §6. WHY: §3. HOW: §8-§9. WHAT NOT: §15. HOW TO TEST: §13. HOW TO VERIFY: §14.

---

# 19. Output Requirements for the Implementing Agent

- Produce the implementation and the final report described in §17.
- Keep the change set to the files in §6. Do not add unrelated documentation files.
- If a verified fact conflicts with this document (for example, a real consumer of `res.password` or `session.forgotPassword` exists), stop and report the conflict instead of guessing.
- Do not claim the finding is fixed until:
    - the response construction no longer adds `password`,
    - the unused session copy is removed or a verified reason is documented,
    - the grep sweep is clean,
    - the focused test passes,
    - the existing reset tests pass,
    - and the local reset flow still works.
- If the live local flow cannot be performed (no local database or SMTP), mark that verification item **NEEDS REVIEW** and state exactly what remains unverified.
- In the final report, explicitly distinguish:
    - Finding 50 (this task — forgot-password response leaks the stored password/hash),
    - Finding 3 (already fixed — server-side bcrypt on reset),
    - Finding 4 (already fixed — unused password-bearing JWT removed),
    - Finding 51 (still separate — no rate limiting / enumeration).
