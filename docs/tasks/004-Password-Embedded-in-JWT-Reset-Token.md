# 004 — Remove the Password-Bearing, Unused JWT from the Password-Reset Token Flow

| Field | Value |
| --- | --- |
| Document ID | `004` |
| Requested filename | `docs/tasks/004-Password-Embedded-in-JWT-Reset-Token.md` |
| Source finding | `CODE_REVIEW.md` → Detailed Findings → **Finding 4: Password Embedded in JWT Reset Token** (`app/routes/forgot-password.js:48-53`, expanded to `:46-95`) |
| Priority | HIGH security hygiene / LOW effort. Roadmap item **#8**: "Remove JWT from reset token — Eliminates password exposure". |
| Task type | Dead-code removal + removal of unnecessary credential handling. **No new feature, no schema change, no behavior change to the reset link.** |
| Repository | All World Trade v11 — production Express/EJS/MySQL SSR application. Treat production behavior as the contract. |

> **Important scope note — Finding 3 vs. Finding 4.**
>
> The request that produced this document mentions "Finding 3: Plaintext Password Storage on Reset", but the requested filename is `004-Password-Embedded-in-JWT-Reset-Token.md`, which is **`CODE_REVIEW.md` Finding 4**.
>
> Finding 3 is already covered by `docs/tasks/003-plaintext-password-torage-on-reset.md` and `docs/tasks/003.2-plaintext-password-storage-on-reset.md`, and a candidate implementation already exists in the working tree (`app/services/password-reset.service.js`).
>
> **This document covers Finding 4 only.** It must not revert, re-implement, or duplicate the Finding 3 fix. The bcrypt server-side hashing performed by `PasswordResetService` is a required invariant and must remain untouched.

---

# 1. Task Title

**Remove the Unused JWT (and the Password-Derived Signing Secret) from `POST /api/post/create-reset-token`, Keep the UUID Reset Token, and Stop Passing the Stored Password from the Forgot-Password Client**

---

# 2. Objective

## What must be accomplished

1. Delete the JWT creation, the AES encryption/decryption round-trip, the URL encoding, and the password-derived signing secret from `POST /api/post/create-reset-token`.
2. Keep the real reset-token mechanism exactly as it is today: a server-generated UUID v4 stored in `reset_tokens`, embedded in the emailed link as `/reset-password/<uuid>`.
3. Stop the forgot-password browser client from reading and forwarding `res.password` to the reset-token endpoint.
4. Remove the now-unused `jsonwebtoken` and `crypto-js` imports from `app/routes/forgot-password.js`.
5. Preserve every externally visible behavior of the reset flow (link shape, response body, token expiry, DB row, email content, GET/POST reset behavior).

## Why this is necessary

`CODE_REVIEW.md` Finding 4 reports that the reset-token endpoint:

- takes the stored password value from the request body,
- embeds it in a JWT payload,
- uses it to derive the JWT signing secret (`JWT_SECRET + password`),
- then AES-encrypts that JWT,
- and finally ignores all of it and generates a UUID for the actual reset link.

The JWT is never stored, returned, emailed, or verified. It is dead code that unnecessarily handles credential material and weakens the mental model of the reset flow.

## Expected end result

A request to `POST /api/post/create-reset-token` with:

```text
uuid=<user uuid>
email_or_social_media=<email>
```

(and optionally the legacy `password` field) returns the same response shape as before:

```json
{
    "message": "reset tokens saved",
    "uuid": "<user uuid>",
    "link": "<AWT_HOSTNAME>reset-password/<fresh uuid v4>",
    "receiverEmailAddress": "<email>"
}
```

The link token is a UUID v4. No JWT, no base64 payload, no AES ciphertext, and no password/hash exists anywhere in the route, the response, the link, or the database.

---

# 3. Problem / Finding

## Vulnerability / weakness type

- **Sensitive credential material embedded in a token that does not need it** — CWE-522 (Insufficiently Protected Credentials) / CWE-312 (Cleartext Storage of Sensitive Information) class.
- **Weak secret derivation** — `SECRET = JWT_SECRET + password` turns the signing key into a password-dependent value.
- **Dead security code** — the JWT is never verified, so it provides no security benefit and creates a false impression that the reset token is JWT-based.
- **Unnecessary credential transit/handling** — the client obtains the stored password value from `/api/post/forgot-password-process` and forwards it to `/api/post/create-reset-token`, even though the reset-token endpoint does not need it.

## Severity

`CODE_REVIEW.md` lists this as a HIGH-priority security item ("Eliminates password exposure"). However, the implementation report must state the verified nuance below rather than overstating exploitability.

## Verified nuance — do not overstate

The current code computes the JWT and AES ciphertext but **never** places them in the response, the email, the link, the database, or a log. The link uses `originalText`, which is a fresh `uuidV4()`. Therefore:

- The JWT is not "in transit" today; it exists only as local variables on the server.
- The practical risk is dead credential handling, weak key derivation, future-use hazard, and the client/response leak that feeds it (Finding 50).
- The JWT payload is base64-encoded, not encrypted, so **if** it were ever logged or returned it would expose the password value. That is exactly why the dead code must be removed rather than left in place.
- `SECRET = JWT_SECRET + password` means the signing key changes per request and depends on a secret the server is not supposed to need in this flow. It is an anti-pattern even while the JWT remains unused.

The honest finding is:

> The reset route contains a dead JWT/AES pipeline that unnecessarily receives, embeds, and derives a secret from the stored password value, then discards the result. The actual token is an unrelated UUID. Remove the dead pipeline and stop sending the password value from the client.

## What `CODE_REVIEW.md` reported

Location: `app/routes/forgot-password.js:48-53` (the JWT block), with surrounding dead AES code at `:58-64`.

```js
const PAYLOAD = {
    password: password,
};

const SECRET = JWT_SECRET + password;
const TOKEN = jwt.sign(PAYLOAD, SECRET, { expiresIn: '15m' });
```

`CODE_REVIEW.md` recommends removing the JWT creation entirely, keeping the UUID-based reset link, and removing the `jsonwebtoken` import if no longer needed.

## Verified current data source for `password`

`public/assets/js/forgot-password.js` calls:

```js
createResetToken(res.email_or_social_media, res.password, res.uuid);
```

and `createResetToken` posts:

```js
data: {
    uuid: uuid,
    password: password,
    email_or_social_media: email,
},
```

`res.password` comes from `POST /api/post/forgot-password-process` → `app/models/forgot-password.model.js`, which returns `password: res[0].password`. That is the **stored** password value:

- normally a bcrypt hash,
- possibly plaintext for legacy non-bcrypt rows (Finding 46).

So the JWT payload is not guaranteed to be a plaintext password; it is guaranteed to be **credential material that should not be in the reset-token request at all**. The finding title is the review's shorthand; the implementation report should use the precise description above.

---

# 4. Affected Functionality

**Feature:** "Forgot password" → create reset token → email reset link → reset password.

```text
public/view/forgot-password/index.ejs
   ↓ user enters emailAddress
public/assets/js/forgot-password.js
   ↓ POST /api/post/forgot-password-process
app/controllers/forgot-password.controller.js
   ↓
app/models/forgot-password.model.js
   └─ returns { message, email_or_social_media, password, uuid }   ← Finding 50 leaks the stored value
   ↓
public/assets/js/forgot-password.js
   ↓ POST /api/post/create-reset-token  { uuid, password, email_or_social_media }
app/routes/forgot-password.js  ← THIS TASK
   ├─ [DEAD] PAYLOAD = { password }
   ├─ [DEAD] SECRET = JWT_SECRET + password
   ├─ [DEAD] jwt.sign(...)
   ├─ [DEAD] CryptoJS.AES.encrypt/decrypt round-trip
   ├─ originalText = uuidV4()                      ← the real token
   ├─ LINK = AWT_HOSTNAME + reset-password/<uuid>
   ├─ INSERT INTO reset_tokens (token, expiration, uuid, createdAt, updatedAt)
   └─ res.send({ message: 'reset tokens saved', uuid, link, receiverEmailAddress })
   ↓
public/assets/js/forgot-password.js
   ↓ POST /api/post/send-email-for-change-password { uuid, link, receiverEmailAddress }
app/routes/forgot-password.js
   └─ sends the reset email with `code: uuid`, `link: link`
   ↓
GET /reset-password/:token
   └─ Reset_tokens.findOne({ token }) → render form with account email
   ↓
POST /reset-password/:token
   └─ Reset_tokens.findOne({ token }) → PasswordResetService.setNewPassword(...)
```

**What must keep working:**

- `POST /api/post/create-reset-token` route path and response shape.
- Response `message` must remain exactly `'reset tokens saved'`.
- Response `link` must remain `<AWT_HOSTNAME>reset-password/<uuid>`.
- `reset_tokens` insert with the same five fields and their insertion order.
- 60-minute expiration calculation.
- `POST /api/post/send-email-for-change-password` receives `uuid`, `link`, `receiverEmailAddress` and uses `uuid` as the email template `code`.
- The reset email template `request-for-change-password` continues to render the same link/code.
- GET and POST `/reset-password/:token` continue to find the token by UUID and call `PasswordResetService`.
- The Finding 3 fix (server-side bcrypt cost 12 in `PasswordResetService`) remains intact.

**Not in scope (report only):**

- Finding 19/49: missing null checks and expiration enforcement on token lookup.
- Finding 23/49: reset token is never deleted/invalidated after use.
- Finding 50: `/api/post/forgot-password-process` still returns the stored password/hash to the client.
- Finding 48: public bcrypt hash/compare endpoints remain.
- Finding 51: no rate limiting on reset endpoints.
- Finding 24/45: other dead code in the same file (`User` global, unused imports, development artifacts).
- Finding 34: migration of the mysql2 insert to Sequelize.
- Finding 41: removing the now-unused `jsonwebtoken` package from `package.json`.

---

# 5. Investigation Phase (MANDATORY — do this before editing)

The coding agent must complete these checks and report any deviation from this document.

1. **Re-read the repository rules:**
    - `README.md` — §3.2 (architecture decisions), §8.12 (JWT lifecycle diagram), §12 (Authentication & Security).
    - `AGENTS.md` — Auth & sessions, Known technical debt.
    - `CODE_REVIEW.md` — Findings 4, 19, 23, 24, 41, 46, 49, 50, 51.

2. **Read the sibling task documents and confirm the Finding 3 fix must remain:**
    - `docs/tasks/003-plaintext-password-torage-on-reset.md`
    - `docs/tasks/003.2-plaintext-password-storage-on-reset.md`
    - `app/services/password-reset.service.js`
    - `test/password-reset.test.js`

3. **Verify the JWT is truly unused.** Run and record the output:
    ```bash
    grep -rn "jsonwebtoken\|jwt\.sign\|jwt\.verify\|jwt\.decode" app public test --include=*.js
    grep -rn "TOKEN\|ciphertext\|encoded\|decoded\|bytes\|PAYLOAD\|SECRET" app/routes/forgot-password.js
    ```
    Expected: `jsonwebtoken` and `jwt.sign` occur only in `app/routes/forgot-password.js`. `TOKEN`, `ciphertext`, `encoded`, `decoded`, `bytes`, `PAYLOAD`, and `SECRET` occur only inside the dead block and must have no consumer.

4. **Verify the real reset mechanism is UUID-only.** Read:
    - `app/routes/forgot-password.js:64-77` (`originalText = uuidV4()`, `LINK`, `resetTokensObject`).
    - `app/routes/forgot-password.js:86-94` (raw insert).
    - `app/routes/forgot-password.js:168-176` (`findUserAccountByResetToken`).
    - `app/routes/forgot-password.js:178-204` (GET/POST reset handlers).
    - `app/query/reset_tokens.query.js`.
    - `app/db_models/reset_tokens.model.js`.
    Confirm that no handler reads or verifies a JWT.

5. **Verify the client data flow.** Read:
    - `public/assets/js/forgot-password.js` in full.
    - `public/view/forgot-password/index.ejs` (field name `emailAddress`).
    - `app/models/forgot-password.model.js` and `app/controllers/forgot-password.controller.js`.
    Confirm `res.password` is used only to populate the `password` field sent to `/api/post/create-reset-token`.

6. **Confirm there are no other callers of `createResetToken` or of `POST /api/post/create-reset-token`.**
    ```bash
    grep -rn "create-reset-token\|createResetToken" app public test --include=*.js --include=*.ejs
    ```
    At the time of writing the only client is `public/assets/js/forgot-password.js`.

7. **Confirm the email endpoint contract.** Read `send-email-for-change-password` and the template at `public/view/email/request-for-change-password.handlebars` (or its actual extension). Confirm it uses `code` and `link`, not the JWT.

8. **Record a baseline.** Run `npm run dev` and, with a disposable local account, exercise the full forgot-password → email link → reset flow. Do not use production data, production SMTP, or production database credentials.

9. **Check the working tree.**
    ```bash
    git status --short
    git diff -- app/routes/forgot-password.js public/assets/js/forgot-password.js
    ```
    The Finding 3 change is already present in the working tree in some branches. Do not assume line numbers in this document match; re-read the actual file.

---

# 6. File Impact Analysis

| File | Role | Action | Reason |
| --- | --- | --- | --- |
| `app/routes/forgot-password.js` | Reset-token route | **MODIFY** | Delete `jsonwebtoken`/`CryptoJS` imports, `JWT_SECRET`, the JWT payload/signature, the AES round-trip, and the unused `password` request field; keep the UUID token and insert unchanged |
| `public/assets/js/forgot-password.js` | Forgot-password client | **MODIFY** | Stop reading `res.password` and stop posting `password` to `create-reset-token`; keep the same endpoint, UUID, email, and email-send sequence |
| `test/004-password-embedded-in-jwt-reset-token.test.js` | Regression guard | **ADD** | Source-invariant test: no JWT/AES/password handling in the reset-token route; the real UUID/link/insert remain |
| `app/services/password-reset.service.js` | Finding 3 implementation | **REFERENCE ONLY** | Must remain the only password-hashing path for reset; do not modify |
| `test/password-reset.test.js` | Finding 3 tests | **REFERENCE ONLY** | Must continue to pass; do not modify |
| `app/query/reset_tokens.query.js` | Insert query | **REFERENCE ONLY** | Parameterized insert already correct; do not change |
| `app/db_models/reset_tokens.model.js` | Sequelize model | **REFERENCE ONLY** | Confirms token lookup fields; no schema change |
| `app/models/forgot-password.model.js` | Forgot-password lookup | **INVESTIGATE / REPORT ONLY** | Leaks the stored password/hash to the client (Finding 50) but this task only stops the client from consuming it |
| `app/controllers/forgot-password.controller.js` | Forgot-password controller | **INVESTIGATE / REPORT ONLY** | Passes the model response through; Finding 50 is separate |
| `public/view/email/request-for-change-password.*` | Reset email template | **REFERENCE ONLY** | Must keep rendering `code`/`link`; no change |
| `README.md` | Human architecture docs | **MODIFY (documentation only, recommended)** | §8.12 currently claims the reset flow generates and verifies a JWT; correct it to the UUID flow |
| `package.json` / `package-lock.json` | Dependencies | **REFERENCE ONLY** | `jsonwebtoken` becomes unused after this task, but dependency removal is Finding 41; do not change it here |
| `docs/tasks/003*.md` | Finding 3 documentation | **REFERENCE ONLY** | Do not alter |
| `CODE_REVIEW.md` | Review record | **REFERENCE ONLY** | Do not alter the historical finding |

**No** database schema change, migration, environment-variable change, new dependency, or new framework is required.

---

# 7. Current Implementation

## CURRENT IMPLEMENTATION (verified working tree)

### Server — `app/routes/forgot-password.js`

Imports (relevant):

```js
const jwt = require('jsonwebtoken');
const CryptoJS = require('crypto-js');
const { v4: uuidV4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET;
const AWT_HOSTNAME = process.env.AWT_HOSTNAME;
```

`POST /api/post/create-reset-token` (lines 46-95):

```js
app.post('/api/post/create-reset-token', async function (req, res, next) {
    let uuid = req.body.uuid;
    let password = req.body.password;
    let receiverEmailAddress = req.body.email_or_social_media;

    const PAYLOAD = {
        password: password,
    };

    const SECRET = JWT_SECRET + password;
    const TOKEN = jwt.sign(PAYLOAD, SECRET, { expiresIn: '15m' });

    // Encrypt
    let ciphertext = CryptoJS.AES.encrypt(TOKEN, SECRET).toString();
    let encoded = encodeURIComponent(ciphertext);
    let decoded = decodeURIComponent(encoded);
    let bytes = CryptoJS.AES.decrypt(decoded, SECRET);
    // let originalText = bytes.toString(CryptoJS.enc.Utf8);
    let originalText = uuidV4();

    // const LINK = AWT_HOSTNAME + `reset-password/${encoded}`;
    const LINK = AWT_HOSTNAME + `reset-password/${originalText}`;
    var expireDate = new Date(new Date().getTime() + 60 * 60 * 1000);
    let datetime = currentDatetime();

    const resetTokensObject = {
        token: originalText,
        expiration: expireDate,
        uuid: uuid,
        createdAt: datetime,
        updatedAt: datetime,
    };

    const emailObject = {
        message: 'reset tokens saved',
        uuid: uuid,
        link: LINK,
        receiverEmailAddress: receiverEmailAddress,
    };

    db.query(RESET_TOKENS.CREATE, Object.values(resetTokensObject), (err, rows) => {
        if (err) {
            //throw err;
            console.log(err);
        } else {
            res.send(emailObject);
            return;
        }
    });
});
```

### Client — `public/assets/js/forgot-password.js`

```js
if (res.message === 'found') {
    createResetToken(res.email_or_social_media, res.password, res.uuid);
}

function createResetToken(email, password, uuid) {
    $.ajax({
        url: '/api/post/create-reset-token',
        type: 'POST',
        data: {
            uuid: uuid,
            password: password,
            email_or_social_media: email,
        },
        success: function (data) {
            if (data.message == 'reset tokens saved') {
                sendEmailForChangePasswordRequest(data);
            } else {
            }
        },
        error: function (e) {
            // some code here
        },
    });
}
```

### Source of `res.password`

`app/models/forgot-password.model.js`:

```js
newModel.session.forgotPassword = res[0];
result(null, {
    message: 'found',
    email_or_social_media: email,
    password: res[0].password,
    uuid: res[0].uuid,
});
```

This is the stored value (normally a bcrypt hash). This leak is Finding 50 and is **not** fixed here; this task only stops the reset-token path from consuming it.

## Current problems

1. The JWT payload contains credential material that the endpoint does not need.
2. The JWT signing secret is derived from that credential (`JWT_SECRET + password`).
3. The AES encrypt/decrypt round-trip is computed and immediately discarded.
4. `TOKEN`, `ciphertext`, `encoded`, `decoded`, and `bytes` have no consumer.
5. The client must receive and forward the stored password from the forgot-password response, coupling this task to Finding 50.
6. `jsonwebtoken` is imported only for dead code; `JWT_SECRET` is read only for dead code in this file.
7. The dead code can throw (for example, a malformed `jsonwebtoken` call) before the real insert, turning a harmless request into a 500.
8. The code misleads future maintainers into thinking the reset token is a JWT.

## What is already correct and must stay

- `originalText = uuidV4()` — the real, high-entropy token.
- `LINK = AWT_HOSTNAME + 'reset-password/' + originalText`.
- `expireDate = now + 60 minutes`.
- `resetTokensObject` field order used by `Object.values(...)`.
- `RESET_TOKENS.CREATE` parameterized insert.
- `emailObject` response shape and exact `message` string.
- `send-email-for-change-password` uses `uuid` as the email `code`.
- `Reset_tokens.findOne({ where: { token } })` in GET/POST reset handlers.
- `PasswordResetService` server-side bcrypt hashing (Finding 3).

---

# 8. Current → Target

## Current

```text
Client has email, password/hash (from forgot-password-process), uuid
   ↓ POST /api/post/create-reset-token  { uuid, password, email }
Server:
   PAYLOAD = { password }
   SECRET  = JWT_SECRET + password
   TOKEN   = jwt.sign(PAYLOAD, SECRET, 15m)
   ciphertext = AES.encrypt(TOKEN, SECRET)
   encoded/decoded/bytes = ...        (discarded)
   originalText = uuidV4()            (the only value that survives)
   LINK = AWT_HOSTNAME + reset-password/originalText
   INSERT reset_tokens (token=originalText, expiration=+1h, uuid, ...)
   respond { message, uuid, link, receiverEmailAddress }
```

## Target

```text
Client has email, uuid
   ↓ POST /api/post/create-reset-token  { uuid, email }   (legacy password field tolerated and ignored)
Server:
   originalText = uuidV4()             (fresh, high-entropy reset token)
   LINK = AWT_HOSTNAME + reset-password/originalText
   INSERT reset_tokens (token=originalText, expiration=+1h, uuid, ...)
   respond { message: 'reset tokens saved', uuid, link, receiverEmailAddress }
```

There is no JWT, no password-derived secret, no AES, no base64 payload, and no credential material in this route.

## Before / after — server

**Before:**

```js
let uuid = req.body.uuid;
let password = req.body.password;
let receiverEmailAddress = req.body.email_or_social_media;

const PAYLOAD = { password: password };

const SECRET = JWT_SECRET + password;
const TOKEN = jwt.sign(PAYLOAD, SECRET, { expiresIn: '15m' });

let ciphertext = CryptoJS.AES.encrypt(TOKEN, SECRET).toString();
let encoded = encodeURIComponent(ciphertext);
let decoded = decodeURIComponent(encoded);
let bytes = CryptoJS.AES.decrypt(decoded, SECRET);
let originalText = uuidV4();
```

**After:**

```js
let uuid = req.body.uuid;
let receiverEmailAddress = req.body.email_or_social_media;

let originalText = uuidV4();
```

Everything after `originalText` stays the same.

**Also remove from the top of the exported route module:**

```js
const jwt = require('jsonwebtoken');
const CryptoJS = require('crypto-js');
const JWT_SECRET = process.env.JWT_SECRET;
```

Do **not** remove `uuidV4`, `AWT_HOSTNAME`, `RESET_TOKENS`, `db`, or `db_models`; they are still used.

## Before / after — client

**Before:**

```js
createResetToken(res.email_or_social_media, res.password, res.uuid);

function createResetToken(email, password, uuid) {
    $.ajax({
        url: '/api/post/create-reset-token',
        type: 'POST',
        data: {
            uuid: uuid,
            password: password,
            email_or_social_media: email,
        },
        // ...
    });
}
```

**After:**

```js
createResetToken(res.email_or_social_media, res.uuid);

function createResetToken(email, uuid) {
    $.ajax({
        url: '/api/post/create-reset-token',
        type: 'POST',
        data: {
            uuid: uuid,
            email_or_social_media: email,
        },
        // ...
    });
}
```

`res.password` is still present in the JSON response until Finding 50 is fixed. Do **not** read it, forward it, log it, or store it.

> **Do not** try to "preserve compatibility" by keeping the password in the request. The server must not need it. Old cached clients that still send it will work because Express ignores the extra field.

---

# 9. Detailed Implementation Plan

## Step 1 — Inspect the existing implementation

Complete §5. Do not edit anything until you have:

- confirmed the JWT/AES block has no consumer,
- confirmed the UUID is the real token,
- confirmed the client is the only caller,
- confirmed the response and insert contracts,
- established a working baseline for the reset flow.

## Step 2 — Identify the exact dead variables

In `app/routes/forgot-password.js`, the following are used **only** by the dead pipeline and can be removed:

| Symbol | Line (current) | Still used after removal? |
| --- | --- | --- |
| `jwt` require | 18 | No |
| `CryptoJS` require | 19 | No in this file (it is used elsewhere in the project) |
| `JWT_SECRET` local | 24 | No in this file |
| `let password = req.body.password` | 48 | No |
| `PAYLOAD` | 51-53 | No |
| `SECRET` | 55 | No |
| `TOKEN` | 56 | No |
| `ciphertext` | 59 | No |
| `encoded` | 60 | No (only in a commented-out link) |
| `decoded` | 61 | No |
| `bytes` | 62 | No (only in a comment) |
| `originalText` | 64 | **YES — keep** |
| `LINK`, `expireDate`, `datetime`, `resetTokensObject`, `emailObject` | 67-84 | **YES — keep** |

Before editing, re-verify this table with `grep`; line numbers may have shifted.

## Step 3 — Remove the dead server code

In `app/routes/forgot-password.js`:

1. Delete the `jsonwebtoken` require.
2. Delete the `crypto-js` require **only if** it is not used elsewhere in this file. Verify with `grep -n "CryptoJS" app/routes/forgot-password.js`.
3. Delete `const JWT_SECRET = process.env.JWT_SECRET;`.
4. Delete `let password = req.body.password;`.
5. Delete the `PAYLOAD`, `SECRET`, `TOKEN`, `ciphertext`, `encoded`, `decoded`, and `bytes` lines.
6. Keep `let originalText = uuidV4();`.
7. Keep everything from `const LINK = ...` through the `db.query(...)` callback byte-for-byte.
8. Keep the function signature `async function (req, res, next)` to minimize the diff; the unused `async`/`next` are pre-existing and out of scope.

> **Do not** rename `originalText` in this task unless you also update every use. The minimal diff is safer.

## Step 4 — Update the client

In `public/assets/js/forgot-password.js`:

1. Change the call to `createResetToken(res.email_or_social_media, res.uuid);`.
2. Change the function signature to `function createResetToken(email, uuid) {`.
3. Remove the `password: password,` entry from the AJAX `data` object.
4. Keep the URL, method, success/error callbacks, `email_or_social_media` field, and `sendEmailForChangePasswordRequest(data)` call unchanged.
5. Do not read `res.password` anywhere.
6. Do not change the server response handling; `data.message === 'reset tokens saved'` must still trigger the email call.

## Step 5 — Preserve the token persistence contract

Do not change:

- the `RESET_TOKENS.CREATE` query or its parameter order,
- the `resetTokensObject` property insertion order (the query uses `Object.values(...)`),
- the 60-minute expiry,
- the link format,
- the response property names or the `message` string,
- the email endpoint's `uuid`/`link`/`receiverEmailAddress` contract.

If the insert fails, the current route logs the error and does not respond. That behavior is pre-existing (Finding 32/43 territory). Do not "fix" it here; report it.

## Step 6 — Update documentation (recommended, documentation-only)

`README.md` §8.12 ("JWT Lifecycle (Password Reset)") currently says:

- "Generate JWT (exp: 1hr)"
- "Verify JWT"

That is inaccurate after this change and was already inaccurate before it (the reset flow uses a UUID). Update the diagram/text to describe:

```text
Generate UUID reset token
Store token + 1-hour expiration in reset_tokens
Email link /reset-password/<uuid>
On GET/POST: look up reset_tokens by token; no JWT verification
```

Do not rewrite unrelated README sections. Do not modify `CODE_REVIEW.md`; it is a historical review record.

## Step 7 — Add a regression guard test

Create `test/004-password-embedded-in-jwt-reset-token.test.js` using `node:test` + `node:assert`. Follow the style of `test/password-reset.test.js`; do not add Jest/Mocha/Supertest.

The test should assert **source invariants** (because the route is not exported and the project has no route-test harness):

```js
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROUTE_PATH = path.join(__dirname, '..', 'app', 'routes', 'forgot-password.js');
const CLIENT_PATH = path.join(__dirname, '..', 'public', 'assets', 'js', 'forgot-password.js');

const routeSource = fs.readFileSync(ROUTE_PATH, 'utf8');
const clientSource = fs.readFileSync(CLIENT_PATH, 'utf8');

function createResetTokenBlock() {
    const start = routeSource.indexOf("app.post('/api/post/create-reset-token'");
    const end = routeSource.indexOf("app.post('/api/post/send-email-for-change-password'");
    assert.ok(start !== -1 && end !== -1 && end > start, 'create-reset-token block must exist');
    return routeSource.slice(start, end);
}

test('the reset-token flow does not import or use jsonwebtoken', () => {
    const block = createResetTokenBlock();
    assert.doesNotMatch(block, /require\(['"]jsonwebtoken['"]\)/);
    assert.doesNotMatch(block, /\bjwt\.sign\s*\(/);
});

test('the reset-token flow does not create a password-derived secret or JWT payload', () => {
    const block = createResetTokenBlock();
    assert.doesNotMatch(block, /JWT_SECRET\s*\+/);
    assert.doesNotMatch(block, /\bPAYLOAD\b/);
    assert.doesNotMatch(block, /\bSECRET\b/);
});

test('the reset-token flow does not use CryptoJS/AES', () => {
    const block = createResetTokenBlock();
    assert.doesNotMatch(block, /\bCryptoJS\b/);
    assert.doesNotMatch(block, /AES\.(encrypt|decrypt)/);
});

test('the reset-token flow does not read a password from the request', () => {
    const block = createResetTokenBlock();
    assert.doesNotMatch(block, /req\.body\.password\b/);
    assert.doesNotMatch(block, /\bpassword\s*[:=]/);
});

test('the real UUID token, link, expiration, and insert still exist', () => {
    const block = createResetTokenBlock();
    assert.match(block, /uuidV4\(\)/);
    assert.match(block, /reset-password\//);
    assert.match(block, /60\s*\*\s*60\s*\*\s*1000/);
    assert.match(block, /RESET_TOKENS\.CREATE/);
    assert.match(block, /message:\s*'reset tokens saved'/);
});

test('the forgot-password client no longer reads or sends res.password', () => {
    assert.doesNotMatch(clientSource, /res\.password/);
    assert.doesNotMatch(clientSource, /password\s*:\s*password/);
});

test('the forgot-password client still sends the uuid and email', () => {
    assert.match(clientSource, /createResetToken\(res\.email_or_social_media,\s*res\.uuid\)/);
    assert.match(clientSource, /email_or_social_media:\s*email/);
    assert.match(clientSource, /sendEmailForChangePasswordRequest\(data\)/);
});
```

Notes:

- The `password:` regex in the block is intentionally strict. If a future edit adds a legitimate password-related comment inside this block, adjust the test rather than weakening the production invariant.
- Do not make the test read a real database or start Express.
- Run:
    ```bash
    node --test test/004-password-embedded-in-jwt-reset-token.test.js
    ```

## Step 8 — Run the existing tests

```bash
node --test test/password-reset.test.js
node --test test/login.test.js
node --test test/search-businesses.test.js
```

The Finding 3 tests must still pass unchanged. Do not modify them.

## Step 9 — Review before declaring completion

Verify:

- No `jwt`, `jsonwebtoken`, `CryptoJS`, `JWT_SECRET`, `PAYLOAD`, `SECRET`, `TOKEN`, `ciphertext`, `encoded`, `decoded`, or `bytes` remains in `app/routes/forgot-password.js`.
- `req.body.password` is not read in the reset-token route.
- `res.password` is not read in `public/assets/js/forgot-password.js`.
- `uuidV4()`, the link, the 1-hour expiry, the insert, and the response are byte-identical to the previous behavior.
- The `message` is still exactly `'reset tokens saved'`.
- The `resetTokensObject` property order is unchanged.
- `PasswordResetService` is untouched.
- The final diff contains only the files listed in §6.

---

# 10. Architecture and Existing Patterns

## Prefer the existing route and token mechanism

This task is a **deletion**, not a redesign. Keep:

- `app/routes/forgot-password.js` as the route module (`module.exports = (app) => { ... }`).
- The existing raw `db.query(RESET_TOKENS.CREATE, ...)` insert. It is parameterized and already works. Migrating it to Sequelize is Finding 34/37 and would add risk for no security benefit here.
- `uuid` package's `v4` as `uuidV4` — already imported and used.
- `AWT_HOSTNAME` for the link prefix — already used.
- `currentDatetime()` — pre-existing helper; keep it.
- The browser's jQuery AJAX flow — do not convert to `fetch` in this task (Finding 39 is separate).

## Do not introduce

- a new JWT library or JWT verification (the point is to remove JWT),
- a new reset-token service class,
- a new migration or table,
- a new dependency,
- a new test framework,
- a new API response shape,
- auth middleware or rate limiting on this route (Findings 6/51).

## Testing pattern

Use `node:test` and `node:assert`, matching `test/password-reset.test.js`. Source-invariant tests are appropriate here because the route is defined inline and the project intentionally has no Supertest harness.

---

# 11. Security Requirements

Required:

- The reset-token route must never receive, store, embed, hash, encrypt, log, or return a password.
- The reset token must remain a server-generated UUID v4 (or an equivalent cryptographically random value). Do not switch to a predictable value (timestamp, email, uuid from the request body).
- Never derive a cryptographic secret from user input. `JWT_SECRET + password` must not exist anywhere.
- Never put credential material in a JWT payload, an AES ciphertext, a URL, a response body, a database column, or a log.
- Keep the `reset_tokens` insert parameterized (`?` placeholders). Never interpolate `uuid`, email, or token into SQL.
- Do not expose the reset token in server logs. The response to the authenticated requester already contains the link; that is the existing contract.
- Do not weaken the Finding 3 fix: `PasswordResetService` must remain the only password-hashing path for reset, with bcrypt cost 12.
- Old clients that still send `password` must be tolerated (ignored), not rejected with a new error.
- The route must remain reachable without authentication, as today; adding auth is a separate task and would break the existing flow.

## Attack cases to test / reason about

| Case | Expected result |
| --- | --- |
| Request contains `password=PlainText123!` | Route ignores it; no JWT/AES; same response; DB row unaffected by the password |
| Request contains `password=$2b$12$...` (stored hash) | Ignored; no credential copied into JWT/link/DB |
| Request omits `password` (new client) | Works; token created and response returned |
| Request contains a SQL-injection-shaped `uuid` | Parameterized insert treats it as data (existing behavior); no new SQL path introduced |
| Request contains a very long `uuid`/email | Existing DB behavior; do not add a new limit in this task |
| JWT-shaped value in the response/link | Must not occur; the link must end in a UUID |
| Response body inspected | Contains only `message`, `uuid`, `link`, `receiverEmailAddress` |
| Logs inspected | No password, hash, JWT, secret, or reset token logged by this route |
| Old cached client (sends `password`) | Still works; field ignored |
| New client (does not send `password`) | Works; server does not require it |

## Sweep obligation

Search the reset path for any other JWT/password-in-token usage:

```bash
grep -rn "jwt\|jsonwebtoken\|CryptoJS.AES\|JWT_SECRET +" app/routes/forgot-password.js
grep -rn "res\.password" public/assets/js/forgot-password.js
```

Report every match. Do not claim the entire application is JWT-free: `JWT_SECRET` is still used as a CryptoJS AES key for UUID encryption elsewhere (Finding 25). That is not this task.

---

# 12. Backward Compatibility

Preserve:

- **Endpoint:** `POST /api/post/create-reset-token` unchanged.
- **Request fields:** `uuid` and `email_or_social_media` unchanged. The legacy `password` field is accepted but ignored.
- **Response:** exactly the same object shape and the exact `message: 'reset tokens saved'`.
- **Link:** `<AWT_HOSTNAME>reset-password/<uuid>` unchanged.
- **Expiry:** 60 minutes unchanged.
- **Database insert:** same table, same five fields, same property order, same parameterization.
- **Email flow:** `send-email-for-change-password` still receives `uuid`, `link`, `receiverEmailAddress`; the template still receives `code: uuid` and `link`.
- **GET/POST reset handlers:** still look up `reset_tokens` by the UUID token; no JWT verification is added.
- **Finding 3:** server-side bcrypt cost 12 remains the only reset password storage path.
- **Old cached client:** it sends `password`; the server ignores it. No breakage.
- **New client:** it stops sending `password`; the server does not require it.

Intentional, documented changes:

- The route no longer computes a JWT or AES ciphertext. Nothing observed by the client, email, or database changes.
- The client no longer reads/forwards `res.password`. The forgot-password response still contains it until Finding 50 is fixed, but it is ignored.
- `jsonwebtoken` and `CryptoJS` are no longer imported by `app/routes/forgot-password.js`. `JWT_SECRET` is no longer read in that file.
- `README.md` §8.12 is corrected from "JWT" to "UUID token" (documentation only).

Do **not** change:

- `RESET_TOKENS.CREATE` SQL or parameter order.
- `reset_tokens` schema, expiration semantics, or lookup behavior.
- `PasswordResetService` or the reset success/failure strings.
- Login, session, UUID encryption, or `JWT_SECRET` in other files.
- The forgot-password response shape (Finding 50 is separate).
- `package.json`/`package-lock.json` for dependency removal.

---

# 13. Testing Strategy

## Normal case

- Start the app with `npm run dev`.
- Request a reset for a disposable local account.
- Confirm the client posts only `uuid` and `email_or_social_media` to `/api/post/create-reset-token`.
- Confirm the response has `message: 'reset tokens saved'` and a `link` ending in a UUID.
- Confirm a `reset_tokens` row exists with that token, the user's UUID, and an expiration about 60 minutes in the future.
- Confirm the email is sent and the link opens `GET /reset-password/:token`.
- Reset the password and log in with the new password (Finding 3 regression).

## Empty / missing input

- Missing `password` (new client) — must work.
- Missing `email_or_social_media` — existing behavior; do not add new validation in this task; confirm no crash caused by the JWT removal.
- Missing `uuid` — existing behavior; report what happens; do not fix.
- Empty `uuid`/email — existing behavior; no new SQL path.

## Boundary cases

- Very long email or UUID — existing DB behavior; no new JWT length/encoding issue remains.
- Unicode email — existing behavior; the link/token generation is unaffected.
- `AWT_HOSTNAME` with or without a trailing slash — preserve the existing concatenation exactly; do not "normalize" it in this task.
- Multiple reset requests for the same user — each must generate a distinct UUID token (as today); no JWT reuse issue because there is no JWT.

## Invalid input

- `password` set to an array/object — ignored; no JWT coercion errors.
- `email_or_social_media` as an array/object — existing behavior; report, do not fix.
- Non-string `uuid` — existing behavior; parameterized insert still treats it as data.

## Security cases

- Inspect the response body: no `password`, `hash`, `token` (JWT), `secret`, `ciphertext`, or `encoded` field beyond the existing `link`/`uuid`.
- Inspect the link: the path segment must be a UUID, not a three-part dot-separated JWT and not a base64 blob.
- Inspect the database row: only `token`, `expiration`, `uuid`, `createdAt`, `updatedAt` are written; no password column.
- Inspect logs: no password/hash/JWT/secret is logged by this route.
- Send a legacy `password` value and confirm it does not appear in the response or DB.
- Confirm no code path calls `jwt.verify` or decodes a JWT.
- Confirm `JWT_SECRET` is not concatenated with user input anywhere in the file.

## Regression testing

- `node --test test/password-reset.test.js` — all Finding 3 tests pass.
- `node --test test/004-password-embedded-in-jwt-reset-token.test.js` — all new source-invariant tests pass.
- `node --test test/login.test.js` — login tests pass.
- `node --test test/search-businesses.test.js` — search tests pass.
- Forgot-password page still loads and submits.
- Email template still renders the reset link.
- GET `/reset-password/:token` still renders the form with the account email.
- POST `/reset-password/:token` still resets the password and returns `'reset password successfully'`.
- Old cached client (sends `password`) and new client (does not) both work.
- No new console errors on the forgot-password page.

## Manual verification (local disposable account only)

```bash
# 1. Create a reset token WITHOUT the legacy password field (new client behavior)
curl -s -X POST http://localhost:<PORT>/api/post/create-reset-token \
  --data-urlencode 'uuid=<USER_UUID>' \
  --data-urlencode 'email_or_social_media=<EMAIL>'
# expect: {"message":"reset tokens saved","uuid":"<USER_UUID>","link":"<AWT_HOSTNAME>reset-password/<UUID>","receiverEmailAddress":"<EMAIL>"}
# The link token must be a UUID (8-4-4-4-12), not a JWT (three dot-separated parts).

# 2. Simulate an old cached client (still sends password)
curl -s -X POST http://localhost:<PORT>/api/post/create-reset-token \
  --data-urlencode 'uuid=<USER_UUID>' \
  --data-urlencode 'password=LegacyValue123!' \
  --data-urlencode 'email_or_social_media=<EMAIL>'
# expect: same response shape; the password value must not appear anywhere.

# 3. Confirm the database row
mysql -u <user> -p <db> -e \
  "SELECT token, expiration, uuid FROM reset_tokens WHERE uuid = '<USER_UUID>' ORDER BY id DESC LIMIT 1;"
# expect: token equals the UUID from the link; expiration about 1 hour ahead.

# 4. Use the emailed link to reset the password, then log in.
```

Never run these against production data or production SMTP. If a local database/token is unavailable, mark the task **NEEDS REVIEW** and state exactly what was not verified.

---

# 14. Verification / Evidence

The task is not complete because the code compiles. Provide evidence for each item.

1. **Code-path evidence:** paste the final `create-reset-token` handler and the removed-import section, showing no JWT/AES/password handling and the unchanged UUID/link/insert.
2. **Grep sweep:**
    ```bash
    grep -n "jwt\|jsonwebtoken\|CryptoJS\|JWT_SECRET\|PAYLOAD\|SECRET\|TOKEN\|ciphertext\|encoded\|decoded\|bytes\|req.body.password" app/routes/forgot-password.js
    ```
    Expected: no matches from the removed dead block. (`JWT_SECRET` may still appear in comments or other files; it must not appear in this file after removal.)
3. **Client sweep:**
    ```bash
    grep -n "res.password\|password:" public/assets/js/forgot-password.js
    ```
    Expected: no `res.password`; no `password:` in the create-reset-token payload.
4. **New tests:** `node --test test/004-password-embedded-in-jwt-reset-token.test.js` output.
5. **Finding 3 regression:** `node --test test/password-reset.test.js` output.
6. **Runtime evidence:** the curl commands in §13 and the DB row (token/expiration/uuid only; never print a password).
7. **Link evidence:** show the returned link's path segment is a UUID; state that it contains no `.`-separated JWT and no base64 ciphertext.
8. **Diff review:** `git diff --stat` and `git diff`; confirm only the files in §6 changed.
9. **Remaining findings:** explicitly report Finding 50 (forgot-password response still returns the stored password/hash), Finding 49 (no token invalidation/expiry enforcement), Finding 51 (no rate limiting), and Finding 41 (`jsonwebtoken` dependency now unused).

If any code path still computes a JWT/AES value or receives a password in the reset-token route, the task is **NOT** complete.

---

# 15. Do NOT Do

- Do not keep the JWT creation "for compatibility"; nothing consumes it.
- Do not keep the password in the JWT payload or in the signing secret.
- Do not keep reading `req.body.password` in `create-reset-token`.
- Do not keep `res.password` in the client reset-token call.
- Do not introduce JWT verification; the token is a UUID stored in `reset_tokens`.
- Do not replace the UUID with a JWT, a timestamp, an email, or a predictable value.
- Do not change the link format, the 60-minute expiry, the response shape, or the `'reset tokens saved'` string.
- Do not change the `reset_tokens` schema, query, or parameter order.
- Do not change `PasswordResetService` or the bcrypt cost.
- Do not fix Finding 50 by changing the forgot-password server response in this task; only stop the client from consuming `res.password`. Report Finding 50.
- Do not fix Finding 49 (token invalidation/expiry/null checks) in this task.
- Do not add authentication, rate limiting, CSRF, or new middleware to this route (Findings 6/51).
- Do not migrate the route to Sequelize (Finding 34/37).
- Do not remove `jsonwebtoken` from `package.json`/`package-lock.json` in this task (Finding 41); report it.
- Do not remove or redefine `JWT_SECRET` from `.env`/environment; it is still used elsewhere for AES UUID encryption.
- Do not remove `CryptoJS` from the project; it is used elsewhere.
- Do not modify `.env`, secrets, deployment config, or SSL config.
- Do not modify `CODE_REVIEW.md`; it is a historical review.
- Do not rewrite `README.md` beyond correcting §8.12.
- Do not "fix" the intentionally failing `npm test` stub.
- Do not declare success from code inspection alone; run the tests and the manual local verification.
- Do not run destructive database commands or use production data.

---

# 16. Acceptance Criteria

## Acceptance Criteria

- [ ] `app/routes/forgot-password.js` no longer imports `jsonwebtoken`.
- [ ] `app/routes/forgot-password.js` no longer imports `crypto-js` or reads `JWT_SECRET` in that file (unless a verified unrelated use exists; report it).
- [ ] `create-reset-token` no longer reads `req.body.password`.
- [ ] No `PAYLOAD`, `SECRET`, `TOKEN`, `ciphertext`, `encoded`, `decoded`, or `bytes` dead variables remain in the reset-token route.
- [ ] The JWT/AES block is deleted, not commented out.
- [ ] `originalText = uuidV4()` remains and is still used in the link and insert.
- [ ] The link is `<AWT_HOSTNAME>reset-password/<uuid>` and contains no JWT/ciphertext.
- [ ] The 60-minute expiration, `resetTokensObject` field order, `RESET_TOKENS.CREATE` query, and response shape are unchanged.
- [ ] The `message` is exactly `'reset tokens saved'`.
- [ ] `public/assets/js/forgot-password.js` no longer reads `res.password`.
- [ ] The client no longer posts `password` to `create-reset-token`.
- [ ] The client still posts `uuid` and `email_or_social_media` and still calls `sendEmailForChangePasswordRequest(data)`.
- [ ] An old cached client that still sends `password` works; the field is ignored.
- [ ] A new client that omits `password` works.
- [ ] `PasswordResetService` is untouched and its tests pass.
- [ ] The full forgot-password → email link → reset → login flow works locally.
- [ ] `node --test test/004-password-embedded-in-jwt-reset-token.test.js` passes.
- [ ] `node --test test/password-reset.test.js` passes.
- [ ] No password/hash/JWT/secret is logged or returned by the reset-token route.
- [ ] `README.md` §8.12 is corrected (if documentation edits are included).
- [ ] `git diff` contains only the files listed in §6.
- [ ] Remaining findings (41, 49, 50, 51) are reported, not silently fixed.
- [ ] The final report states whether the JWT was already removed or had to be removed.

---

# 17. Expected Final Report

Finish with this structure:

```markdown
# Implementation Report

## Summary

Brief explanation of what was removed/changed and confirmation that the
UUID reset-token mechanism and the Finding 3 bcrypt fix are preserved.

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

Explain the removed JWT/AES/password code, the retained UUID token,
the client payload change, and any documentation update.

## Testing

| Test | Result |
| --- | --- |
| Normal reset-token creation (no password field) | PASS/FAIL |
| Legacy client (password field present, ignored) | PASS/FAIL |
| Link token is a UUID, not a JWT | PASS/FAIL |
| Reset-token DB row (token/expiration/uuid) | PASS/FAIL |
| Full email → reset → login flow | PASS/FAIL |
| `node --test test/004-password-embedded-in-jwt-reset-token.test.js` | PASS/FAIL |
| `node --test test/password-reset.test.js` | PASS/FAIL |
| Login/search regression tests | PASS/FAIL |

## Verification

Show the grep sweep, the final handler, the new test output, the manual
curl/DB evidence, and the final diff review.

## Remaining Risks

Report at minimum:

- Finding 50: `/api/post/forgot-password-process` still returns the stored
  password/hash to the client.
- Finding 49: reset tokens are still not invalidated after use and expiry is
  not enforced in all paths.
- Finding 51: reset endpoints still have no rate limiting.
- Finding 41: `jsonwebtoken` is now unused in the application; dependency
  removal is a separate task.
- The reset-token route still logs raw database errors and does not respond
  on insert failure (pre-existing; not fixed here).

## Final Status

PASS / NEEDS REVIEW
```

---

# 18. Important Rules for the Implementing Agent

### Rule 1 — Do not hallucinate

This document distinguishes verified repository facts from recommendations. Line numbers may shift. Re-verify every claim before editing. If a fact cannot be verified, mark it `TO INVESTIGATE` rather than assuming.

### Rule 2 — Separate facts from recommendations

- **CURRENT IMPLEMENTATION (verified):** the route computes a JWT/AES pipeline from `req.body.password`, then discards it and uses `uuidV4()` for the real link. The JWT is not returned, stored, emailed, or verified.
- **RECOMMENDED IMPLEMENTATION:** delete the dead pipeline, keep the UUID mechanism, and stop the client from sending the stored password value.

### Rule 3 — Prefer project consistency

Keep the existing route module, raw parameterized insert, `uuidV4`, `AWT_HOSTNAME`, `currentDatetime`, and jQuery client. Use `node:test`; do not add a test framework or a new service layer for this deletion.

### Rule 4 — Preserve behavior

The endpoint, request fields (`uuid`, `email_or_social_media`), link format, 60-minute expiry, insert field order, response shape, exact `'reset tokens saved'` message, email contract, and GET/POST reset behavior must survive. The only intentional changes are removing dead code and removing the password field from the client payload.

### Rule 5 — Think about the entire code path

Trace:

```text
forgot-password form
  → /api/post/forgot-password-process
  → client res.password / res.uuid
  → /api/post/create-reset-token
  → reset_tokens insert
  → emailed link
  → GET/POST /reset-password/:token
  → PasswordResetService (bcrypt)
  → login
```

Do not fix only the single line named in the review. Verify no other code consumes the JWT and that the client change does not break the email step.

### Rule 6 — Make the task executable

WHAT: remove the dead JWT/AES/password pipeline. WHERE: §6. WHY: §3. HOW: §8-§9. WHAT NOT: §15. HOW TO TEST: §13. HOW TO VERIFY: §14.

---

# 19. Output Requirements for the Implementing Agent

- Produce the implementation and the final report described in §17. Do not add unrelated documentation files.
- Keep the change set to the files in §6. `README.md` is documentation-only and optional but recommended.
- If a verified fact conflicts with this document (for example, a consumer of the JWT does exist), stop and report the conflict instead of guessing.
- Do not claim the finding is fixed until the grep sweep is clean, the new test passes, the Finding 3 tests pass, and the manual local reset flow returns a UUID link and persists the reset token.
- If the manual runtime verification cannot be performed (no local database/SMTP), mark the task **NEEDS REVIEW** and state exactly what remains unverified.
- In the final report, explicitly preserve the distinction between Finding 3 (plaintext password storage — already fixed by `PasswordResetService`) and Finding 4 (this task — dead JWT containing credential material).
