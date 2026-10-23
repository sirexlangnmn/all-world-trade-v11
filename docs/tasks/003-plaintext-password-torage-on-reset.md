# Fix Plaintext Password Storage on Password Reset (Finding 3)

- **Source finding:** `CODE_REVIEW.md` → Detailed Findings → **Finding 3: Plaintext Password Storage on Reset**
- **Priority:** HIGH (security — prevents credential exposure). Roadmap item **#3**, "Effort: Low".
- **Reported location:** `app/routes/forgot-password.js:205-209`
- **Related findings — investigate/report, do NOT fix in this task:** Finding 4 (password embedded in an unused JWT reset token), Finding 5 (public bcrypt hash/compare endpoints), Finding 6 (null reset-token crash), Finding 7 (no rate limiting), Finding 19 (reset-token lookup can 500), Finding 23 (reset token never invalidated), Finding 34 (frozen mysql2 layer), Finding 36 (fat route handlers).
- **Repository rules:** `README.md`, `AGENTS.md`, `CODE_REVIEW.md` — read all three before touching code. New business logic goes in `app/services/`; new data access goes in the Sequelize stack (`app/db_models/`). The mysql2 layer is frozen except for the existing parameterized query this task already uses.

---

# 1. Task Title

**Hash Password-Reset Passwords Server-Side with bcrypt and Stop Trusting the Client-Supplied Hash (route → password-reset service → Sequelize `users_accounts.password`)**

---

# 2. Objective

- Make the server — not the browser — authoritative for password hashing during password reset.
- Guarantee that **no non-bcrypt value can ever be written** to `users_accounts.password` by `POST /reset-password/:token`.
- Remove the reset page's dependency on the public `POST /api/post/password-hashing` endpoint.
- Preserve the externally visible reset flow: same URL, same success response string, same redirect behaviour, same login behaviour with the new password.
- Keep the change small. Do not refactor the rest of `forgot-password.js` (dead JWT code, unused `User` global, token expiry, token invalidation) in this task — those are separate findings.

**Expected end result:** a user submits a new password; the server receives the plaintext password over the existing form request, validates it, hashes it with bcrypt (12 rounds, unique salt), and stores only the hash. Sending a plaintext password directly to the reset endpoint via `curl` also stores a hash — never plaintext. An old cached browser tab that still sends both `password` and a pre-hashed `password3` continues to work because the server hashes `password` and ignores `password3`.

---

# 3. Problem / Finding

## Vulnerability type

- **Cleartext storage of a sensitive credential** (CWE-256: Plaintext Storage of a Password; OWASP A02:2021 — Cryptographic Failures).
- **Severity per `CODE_REVIEW.md`:** CRITICAL / HIGH security finding ("This completely undermines the bcrypt hashing used elsewhere and means a database breach exposes reset passwords in cleartext.").
- **Attack surface:** `POST /reset-password/:token` — public, unauthenticated beyond possession of a reset token.
- **Affected functionality:** password reset and every subsequent login for that account.

## What `CODE_REVIEW.md` reported

The reset route reads `req.body.password3` and passes it directly to the update query:

```js
const inputObject = {
    password: password3,
};

db.query(USERS_ACCOUNTS.UPDATE_PASSWORD, [...Object.values(inputObject), UUID], function (err, result) {
    // ...
});
```

`UPDATE_PASSWORD` is already parameterized (`app/query/users_accounts.query.js:26-28`), so this is **not** an SQL injection finding. The problem is that the value itself is stored verbatim.

## Verified current state — important nuance (do not overstate, do not understate)

This must be documented honestly in the implementation report:

1. **The normal browser flow usually sends a bcrypt hash, not plaintext.** `public/assets/js/reset-password.js:16-34` listens to `keyup` on the visible password field, calls the public endpoint `POST /api/post/password-hashing`, and copies the returned bcrypt hash into the hidden `password3` field. The visible `password` field is still serialized separately.
2. **The server does not enforce that.** `POST /reset-password/:token` accepts any string in `password3`. A direct request can store:
    - a plaintext password,
    - an empty string (if the hash request has not completed),
    - an arbitrary attacker-chosen value.
3. **The client-side hash flow is racy.** If the user types and submits before the asynchronous hash response arrives, `password3` can be empty or stale. If JavaScript is disabled or the hash endpoint fails, `password3` is never populated.
4. **The server also has no fallback.** It reads only `password3`; it never reads the plaintext `password` field that the form already submits.
5. **The public hashing endpoint uses 10 rounds**, not the 12 that `README.md` §12.2 and `CODE_REVIEW.md` describe (`app/routes/password.js:5`). Existing accounts created through the normal registration flow are therefore likely cost-10 hashes. bcrypt itself is still correct; only the work factor differs.

**Therefore the finding is not "the browser always writes plaintext."** The finding is: **the server stores whatever the client sends, with no guarantee that it is a hash.** That is a real cleartext-storage path (direct request / race / JS failure) and it also makes the reset flow depend on a public bcrypt oracle (Finding 5). The fix must be server-side hashing, not a client-side workaround.

## Why a naive fix is wrong

Do **not** simply add:

```js
const hashedPassword = await bcrypt.hash(password3, 12);
```

while leaving `reset-password.js` unchanged. In the normal browser flow `password3` is already a bcrypt hash (cost 10), so this would store a **hash of a hash**. The user's plaintext would then not match at login and the account would be locked out.

The client pre-hashing and the server update must be changed together.

---

# 4. Affected Functionality

**Feature:** password reset via emailed token.

```text
public/view/reset-password/index.ejs
   ↓ user types "password" / "password2"
public/assets/js/reset-password.js
   ├─ keyup → POST /api/post/password-hashing  (bcrypt cost 10)
   │            ↓ returns hash
   │          hidden input "password3" = hash
   └─ submit → jQuery serialize() → POST /reset-password/:token
                    fields: password, password2, password3
   ↓
app/routes/forgot-password.js
   POST /reset-password/:token
   ├─ Reset_tokens.findOne({ token })                   (Sequelize)
   ├─ Users_accounts.findOne({ uuid: resetToken.uuid }) (Sequelize)
   ├─ inputObject.password = req.body.password3         ← UNVERIFIED CLIENT VALUE
   └─ db.query(USERS_ACCOUNTS.UPDATE_PASSWORD, [value, uuid])
   ↓
users_accounts.password  (plaintext, empty, arbitrary, or a pre-hashed value)
   ↓
login: app/services/auth.service.js → bcrypt.compare(plaintext, stored)
```

**Consumers that must keep working:**

- `public/assets/js/reset-password.js:44-52` — success handler compares the response with the **exact string** `'reset password successfully'`. Any other string shows a generic warning.
- `app/services/auth.service.js:31-42` — `verifyPassword` uses `bcrypt.compare`; it tolerates non-bcrypt stored values by returning `false` instead of throwing, but such an account cannot log in.
- `app/services/auth.service.js:13-18` — documents that existing stored hashes are cost 10. A cost-12 hash is still accepted by `bcrypt.compare`; no login change is needed.
- `README.md` §12.2 — claims bcrypt 12 rounds. After this fix, reset passwords will actually use 12; existing hashes remain valid at their original cost.

**Not in scope (report only):**

- `app/models/forgot-password.model.js` returns the stored password hash to the browser in the forgot-password response (Finding 4/security hygiene).
- `app/routes/forgot-password.js:48-64` creates an unused JWT that embeds the password/hash (Finding 4).
- `app/routes/forgot-password.js:163-184` and `:186-191` have missing null/expiry checks for reset tokens (Findings 6/19/23).
- `app/routes/password.js` is a public bcrypt hash/compare oracle (Finding 5). It is still used by every registration flow; do not remove it here.
- Registration controllers trust a client-supplied `hashedPassword` (`app/db_controllers/registration_v2.controller.js:78` and siblings). That is a separate, larger migration (Findings 5/35). Report it; do not expand this task into the registration stack.

---

# 5. Investigation Phase (MANDATORY — do before editing)

The coding agent must complete these checks and record any deviation from this document in the final report:

1. **Re-read the repository rules:** `README.md` (§9 data flow, §10 `users_accounts` schema, §12 Authentication & Security), `AGENTS.md` (Auth & sessions; Known technical debt), `CODE_REVIEW.md` (Findings 3, 4, 5, 6, 7, 19, 23, 34, 36).
2. **Read the finished sibling tasks:**
    - `docs/tasks/001-fix-sql-injection-search.md`
    - `docs/tasks/002-fix-sql-injection-login.md`
    - `app/services/business-search.service.js`, `app/services/auth.service.js`, `app/db_controllers/search-businesses.controller.js`
    - `test/search-businesses.test.js`, `test/login.test.js`

    Match the house style: small injectable service, thin route/controller, `node:test` tests. Do not introduce a new test framework.

3. **Verify the exact current reset flow.** Read, verbatim:
    - `app/routes/forgot-password.js` (especially lines 163-221)
    - `public/assets/js/reset-password.js`
    - `public/view/reset-password/index.ejs` (lines 42-92 and 127)
    - `app/query/users_accounts.query.js` (`UPDATE_PASSWORD`)
    - `app/db_models/users_accounts.model.js`
    - `app/services/auth.service.js` (`verifyPassword`)
      Confirm that the visible form sends `password` and `password2`, and the hidden field is `password3`.
4. **Confirm there are no other consumers of `POST /reset-password/:token`.** Run:
    ```bash
    grep -rn "reset-password" app public test --include=*.js --include=*.ejs
    grep -rn "password3" app public test --include=*.js --include=*.ejs
    ```
    Today the only client is `public/assets/js/reset-password.js`. If anything else appears, re-evaluate the request-contract decision in §8/§12 before editing.
5. **Confirm the success contract.** `reset-password.js` requires the response body to be exactly `'reset password successfully'`. Do not change that string.
6. **Confirm current hashing cost and compatibility.** Read `app/routes/password.js:4-16` (cost 10) and `app/services/auth.service.js:31-42` (`bcrypt.compare`). Confirm `bcrypt@^6.0.0` is already in `package.json`; no install is needed.
7. **Confirm Sequelize model behaviour before using `.update()`.**
    - `app/db_models/users_accounts.model.js` does not disable timestamps. The current raw SQL does **not** update `updatedAt`.
    - If the new service uses `Users_accounts.update(...)`, pass `silent: true` so `updatedAt` is not modified and DB behaviour stays identical.
    - Alternative if `.update()` behaves unexpectedly: keep the existing parameterized `db.query(USERS_ACCOUNTS.UPDATE_PASSWORD, [hashedPassword, uuid])`. Document the choice.
8. **Check for existing plaintext rows in the local/dev database (do not run against production):**
    ```sql
    SELECT COUNT(*) AS non_bcrypt_passwords
    FROM users_accounts
    WHERE password IS NULL
       OR password NOT LIKE '$2a$%'
       AND password NOT LIKE '$2b$%'
       AND password NOT LIKE '$2y$%';
    ```
    Do not silently rewrite those rows. Report the count; remediation is a separate operational decision (see §14 “Legacy rows”).
9. **Start the app before changing it** (`npm run dev`) and record a working baseline: open a reset link, reset a disposable account's password, and log in with it.

---

# 6. File Impact Analysis

| File                                                                                    | Role                             | Action                                               | Reason                                                                                                  |
| --------------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `app/routes/forgot-password.js`                                                         | Reset route handler              | **MODIFY**                                           | Reads unverified `password3`; must read plaintext and delegate hashing                                  |
| `app/services/password-reset.service.js`                                                | New use-case service             | **ADD**                                              | Owns bcrypt hashing and the Sequelize password update; injectable for tests                             |
| `public/assets/js/reset-password.js`                                                    | Reset page client                | **MODIFY**                                           | Remove client-side hashing; submit the plaintext field the form already contains                        |
| `test/password-reset.test.js`                                                           | Unit/service tests               | **ADD**                                              | Proves plaintext is hashed with cost 12 and never passed to the update                                  |
| `app/query/users_accounts.query.js`                                                     | Parameterized update query       | **REFERENCE ONLY** (unless fallback in §5.7 is used) | Already parameterized; do not change SQL semantics                                                      |
| `app/db_models/users_accounts.model.js`                                                 | Sequelize model                  | **REFERENCE ONLY**                                   | Confirms `password` column and timestamp behaviour                                                      |
| `app/services/auth.service.js`                                                          | Login verification               | **REFERENCE ONLY**                                   | Confirms cost-12 hashes remain compatible; do not modify login                                          |
| `app/routes/password.js`                                                                | Public hash/compare endpoints    | **REFERENCE ONLY**                                   | Still used by registration; Finding 5 is separate                                                       |
| `public/view/reset-password/index.ejs`                                                  | Reset form                       | **REFERENCE ONLY** (optional cleanup later)          | Keep the hidden `password3` input for one release so old cached JS does not error; it is simply ignored |
| `app/db_controllers/registration_v2.controller.js` and sibling registration controllers | Client-supplied `hashedPassword` | **INVESTIGATE / REPORT ONLY**                        | Same trust problem, different flow; out of scope                                                        |
| `app/models/forgot-password.model.js`                                                   | Forgot-password response         | **INVESTIGATE / REPORT ONLY**                        | Leaks the stored hash to the client (Finding 4)                                                         |
| `docs/tasks/003-plaintext-password-torage-on-reset.md`                                  | This document                    | **REFERENCE ONLY**                                   | Implementation guide                                                                                    |

No database schema change, migration, dependency, or environment variable change is required.

---

# 7. Current Implementation

## Route — `app/routes/forgot-password.js` (relevant portion, verified)

```js
app.post(['/reset-password/:token'], async function (req, res) {
    const token = req.params.token;
    const { password3 } = req.body;

    const Users_accounts = db_models.users_accounts;
    const Reset_tokens = db_models.reset_tokens;

    const resetToken = await Reset_tokens.findOne({
        where: { token: token },
    });

    const userAccount = await Users_accounts.findOne({
        where: { uuid: resetToken.uuid },
    });

    try {
        const UUID = userAccount.uuid;

        const inputObject = {
            password: password3,
        };

        db.query(USERS_ACCOUNTS.UPDATE_PASSWORD, [...Object.values(inputObject), UUID], function (err, result) {
            if (err) {
                console.log(err);
            } else {
                res.send('reset password successfully');
            }
        });
    } catch (error) {
        res.send(error.message);
    }
});
```

## Query — `app/query/users_accounts.query.js`

```js
UPDATE_PASSWORD: `UPDATE users_accounts SET
            password = ?
            WHERE uuid = ?`,
```

This query is already parameterized. Keep the placeholders.

## Client — `public/assets/js/reset-password.js`

```js
const password1 = getId('password');
const password2 = getId('password2');
const password3 = getId('password3');

password1.onkeyup = function () {
    hashedPassword();
};

function hashedPassword() {
    let password = password1.value;

    if (password !== '') {
        $.ajax({
            url: '/api/post/password-hashing',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ password: password }),
            success: function (response) {
                password3.value = response;
            },
        });
    } else {
        password3.value = '';
    }
}

function forgotPasswordSubmitHandler(e) {
    e.preventDefault();

    let password_1 = password1.value;
    let password_2 = password2.value;

    if (password_1 === password_2) {
        $.ajax({
            url: window.location.href,
            type: 'POST',
            data: resetPasswordForm.serialize(),
            success: function (res) {
                if (res === 'reset password successfully') {
                    Swal.fire('Success', 'Reset Password Successfully.', 'success');
                    setInterval(function () {
                        location.replace(host + '/login');
                    }, 3000);
                } else {
                    Swal.fire('Warning', 'Something wrong. Contact your administrator', 'warning');
                }
            },
        });
    } else {
        Swal.fire('Warning', 'Confirm Password Failed', 'warning');
    }
}
```

## View — `public/view/reset-password/index.ejs`

The form contains visible `password` and `password2` inputs plus a hidden `password3` input. `password3` exists only to carry the client-generated hash to the server.

## Current problems

1. The server trusts `password3` unconditionally.
2. A direct POST can store plaintext or empty `password`.
3. The reset flow depends on a public bcrypt oracle (`/api/post/password-hashing`), which Finding 5 will eventually remove.
4. The hash is generated before the user submits, so a race can send an empty/stale value.
5. The client-side hash uses cost 10, not 12.
6. Error logging prints the raw DB error, and the catch block returns `error.message` to the client.

---

# 8. Current → Target

## Current

```text
Browser types password
   ↓ keyup
POST /api/post/password-hashing  → bcrypt hash (cost 10)
   ↓
hidden password3 = hash
   ↓ submit (password, password2, password3)
Server reads password3 and stores it verbatim.
```

## Target

```text
Browser types password
   ↓ submit (password, password2; password3 may still be present from cached JS)
Server reads the plaintext "password" field, ignores "password3"
   ↓
validate: non-empty string, confirmation matches when supplied
   ↓
bcrypt.hash(password, 12)  → unique-salted hash
   ↓
Users_accounts.update({ password: hash }, { where: { uuid }, silent: true })
   ↓
response: "reset password successfully"   (unchanged)
```

## Before / after (adapt to the real codebase — do not force this exact formatting)

**Current:**

```js
const { password3 } = req.body;
const inputObject = { password: password3 };
db.query(USERS_ACCOUNTS.UPDATE_PASSWORD, [...Object.values(inputObject), UUID], (err, result) => {
    // ...
});
```

**Target (conceptual):**

```js
const { password, password2 } = req.body;

await passwordResetService.setNewPassword(userAccount.uuid, {
    password,
    password2,
});

return res.send('reset password successfully');
```

**Client target (conceptual):**

```js
// No password3, no /api/post/password-hashing call.
function forgotPasswordSubmitHandler(e) {
    e.preventDefault();

    if (password1.value !== password2.value) {
        Swal.fire('Warning', 'Confirm Password Failed', 'warning');
        return;
    }

    $.ajax({
        url: window.location.href,
        type: 'POST',
        data: resetPasswordForm.serialize(),
        // success handler unchanged
    });
}
```

**Key contract decision:** the server reads the existing visible field name **`password`**, not the hidden `password3`. This is deliberate:

- New client: sends `password` (plaintext) and `password2`.
- Old cached client: also sends `password` (plaintext), plus a hash in `password3`. The server ignores `password3`, so no double hash occurs.
- There is **no bcrypt-shaped-input detection branch** and no “trust this hash if it looks like a hash” path. Server-side hashing is the only path.

---

# 9. Detailed Implementation Plan

## Step 1 — Inspect Existing Implementation

Complete §5, especially:

- the exact fields posted by `reset-password.js`,
- the exact success string,
- the model/timestamp behaviour,
- existing `app/services/` conventions (`auth.service.js`, `business-search.service.js`).

Do not edit anything until this is done.

## Step 2 — Identify the Affected Input

The request body currently contains:

- `password` — visible new password, currently unused by the server.
- `password2` — visible confirmation, currently unused by the server.
- `password3` — hidden client-generated hash, currently the stored value.

The target trust boundary is:

- **Untrusted:** all three fields.
- **Authoritative:** server-generated bcrypt hash.
- **Never stored:** `password`, `password2`, `password3` raw values.
- **Never returned/logged:** any of them, or the resulting hash.

## Step 3 — Inspect the Existing Project Pattern

Read `app/services/auth.service.js` and `test/login.test.js`. Copy these conventions:

- `class XService { constructor(dbRef = db) { ... } }`
- dependency injection for testability,
- no `req`/`res` inside the service,
- no credential logging,
- `node:test` tests with `node:assert` (no Jest/Mocha/Supertest).

Do not add a new dependency.

## Step 4 — Add the Password-Reset Service

Create `app/services/password-reset.service.js` following this pattern:

```js
const bcrypt = require('bcrypt');

const db = require('../db_models');

const PASSWORD_HASH_ROUNDS = 12;

async function hashPassword(plainPassword) {
    if (typeof plainPassword !== 'string' || plainPassword.length === 0) {
        throw new TypeError('Password must be a non-empty string');
    }

    return bcrypt.hash(plainPassword, PASSWORD_HASH_ROUNDS);
}

class PasswordResetService {
    constructor(dbRef = db) {
        this.UsersAccounts = dbRef.users_accounts;
    }

    async setNewPassword(uuid, { password, password2 } = {}) {
        if (typeof uuid !== 'string' || uuid.length === 0) {
            throw new TypeError('A user UUID is required');
        }

        if (typeof password2 === 'string' && password !== password2) {
            throw new TypeError('Password confirmation does not match');
        }

        const hashedPassword = await hashPassword(password);

        // `silent: true` preserves the old raw-SQL behaviour of not touching
        // `updatedAt`. Do not return the hash to the caller.
        await this.UsersAccounts.update({ password: hashedPassword }, { where: { uuid }, silent: true });
    }
}

module.exports = { PasswordResetService, hashPassword, PASSWORD_HASH_ROUNDS };
```

Rules for this step:

- Do **not** log `password`, `password2`, or `hashedPassword`.
- Do **not** return the hash from `setNewPassword`.
- If the Sequelize update is not viable (verify at runtime), fall back to:
    ```js
    await new Promise((resolve, reject) => {
        db.query(USERS_ACCOUNTS.UPDATE_PASSWORD, [hashedPassword, uuid], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
    ```
    State the reason in the final report.
- Do not use CryptoJS, AES, SHA-256, or any reversible encoding for passwords. bcrypt only.

## Step 5 — Modify the Reset Route

In `app/routes/forgot-password.js`:

1. Add the service import at the top of the exported route function:
    ```js
    const { PasswordResetService } = require('../services/password-reset.service.js');
    const passwordResetService = new PasswordResetService();
    ```
2. Change the POST handler to read `{ password, password2 }` instead of `{ password3 }`.
3. Keep the existing `Reset_tokens.findOne` and `Users_accounts.findOne` lookups unchanged.
4. Replace the raw `inputObject`/`db.query` block with:
    ```js
    await passwordResetService.setNewPassword(UUID, { password, password2 });
    return res.send('reset password successfully');
    ```
5. Replace the catch block:
    ```js
    } catch (error) {
        console.error('Password reset failed:', error.message);
        return res.send('reset password failed');
    }
    ```
    Do not return `error.message` to the client and do not log the submitted password.
6. Keep the success response **exactly** `'reset password successfully'`.
7. Do **not** fix dead JWT code, unused `User`, null-token handling, expiry, or token invalidation in this task.

## Step 6 — Modify the Client

In `public/assets/js/reset-password.js`:

1. Delete `const password3 = getId('password3');`.
2. Delete `password1.onkeyup = ...` and the entire `hashedPassword()` function.
3. Leave the submit handler's confirmation check intact.
4. Do not change the AJAX URL, method, serialization, success comparison, or redirect timing.
5. Keep the hidden `password3` input in the EJS for one release so an old cached `reset-password.js` still finds its element. The server ignores the value. A later cleanup task can remove the input.

Deployment order: deploy/restart the server first, then let clients fetch the new static JS. A new JS file loaded against the old server would not send `password3`; that mismatch exists only for the seconds around a deploy.

## Step 7 — Add or Update Tests

Add `test/password-reset.test.js` using `node:test` and `node:assert`. Follow `test/login.test.js` style. Cover:

- Real bcrypt hashing:
    - `hashPassword('ResetMe123!')` returns a `$2b$12$...` hash.
    - `bcrypt.compare('ResetMe123!', hash)` is `true`.
    - `bcrypt.compare('wrong', hash)` is `false`.
    - The hash is not equal to the plaintext and is different on a second call (unique salt).
- Service data flow with an injected fake `dbRef`:
    - `setNewPassword('uuid-1', { password: 'ResetMe123!', password2: 'ResetMe123!' })` calls `UsersAccounts.update` with a bcrypt hash, not the plaintext.
    - The update `where` uses the supplied UUID and `silent: true` is set.
    - Confirmation mismatch rejects and does **not** call `update`.
    - Empty/missing/non-string password rejects and does **not** call `update`.
- No test should touch a real production database. If a DB integration test is added, gate it behind an explicit local-only environment check.

Run:

```bash
node --test test/password-reset.test.js
```

`npm test` is intentionally a failing stub; do not “fix” it as part of this task.

## Step 8 — Review the Implementation

Before declaring completion, verify:

- No `password3` is read by the server.
- No client-side hashing remains on the reset page.
- The only bcrypt call in the new path is `bcrypt.hash(..., 12)`.
- The update receives the hash, never plaintext.
- Old-client compatibility: a body containing `password`, `password2`, and `password3` still stores a hash of `password`.
- No secret is logged or returned.
- The success string is byte-identical.
- `git diff` contains no unrelated changes.

---

# 10. Architecture and Existing Patterns

Prefer the existing project patterns:

- **Service extraction:** `app/services/auth.service.js` and `app/services/business-search.service.js`.
- **Dependency injection for tests:** constructor parameter defaulting to `require('../db_models')`.
- **Parameterized data access:** the existing `UPDATE_PASSWORD` query already uses `?`; Sequelize `.update()` parameterizes too.
- **Password hashing:** `bcrypt` is already used in `app/routes/password.js`, `app/models/help-and-support-login.model.js`, and `app/services/auth.service.js`. Use it directly; do not wrap it in CryptoJS.
- **Test style:** `node:test` + `node:assert`; no new dev dependencies.
- **Error shape:** the reset page only understands a success string; keep the success string and use a generic failure string rather than leaking internals.

Do not introduce:

- a new framework or ORM,
- a new password library,
- a client-side cryptography step for this flow,
- a new migration (the column already fits bcrypt),
- global middleware just for this route (rate limiting is Finding 7).

---

# 11. Security Requirements

Required:

- The server must generate the hash. Never store a value received from the client as the final password.
- Use bcrypt with a per-password salt (bcrypt does this automatically).
- Use **12 rounds** to match `CODE_REVIEW.md` Finding 3 and `README.md` §12.2. Existing cost-10 hashes remain valid and do not need to be rehashed.
- Validate that `password` is a non-empty string before hashing.
- If `password2` is supplied, require it to equal `password`.
- Keep the SQL/Sequelize query parameterized. Never interpolate the hash, UUID, or password into SQL.
- Never log the plaintext password, the hash, or the full request body.
- Never return the password or hash in the response.
- Never send the stored hash back to the browser from this route.
- Keep the success response and status unchanged for normal use.
- Ensure a direct `curl` POST with `password=PlainText123!` results in a bcrypt hash in the database.
- Ensure a direct `curl` POST with only `password3=<anything>` does not write that value.

Attack cases to test:

| Input                                                       | Expected result                                                                              |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `password=ResetMe123!&password2=ResetMe123!`                | Success; DB stores `$2b$12$...`; login works                                                 |
| `password=ResetMe123!` (no `password2`)                     | Success or explicit validation rejection, but never plaintext; document the chosen rule      |
| `password=ResetMe123!&password2=different`                  | Rejected; DB unchanged                                                                       |
| `password=`                                                 | Rejected; DB unchanged                                                                       |
| `password` repeated / array                                 | Rejected as non-string; DB unchanged                                                         |
| `password3=$2b$10$...` with no `password`                   | Rejected; DB unchanged                                                                       |
| Old client body (`password`, `password2`, `password3` hash) | Success; stores hash of `password`, not hash of `password3`                                  |
| 1,000-character password                                    | Either hashed successfully or rejected by an explicit documented cap; never stored plaintext |
| `password="' OR 1=1 --"`                                    | Hashed as data; SQL unaffected (parameterized)                                               |

Sweep obligation:

- Search the reset path for any other place that writes `users_accounts.password` (`grep -rn "password" app/routes app/services app/db_controllers app/models --include=*.js`). Report every writer.
- Do not claim the whole application is free of plaintext passwords. Registration still accepts `hashedPassword` from the client; report that as a follow-up.

---

# 12. Backward Compatibility

Preserve:

- **URL:** `POST /reset-password/:token` unchanged.
- **Success response:** exactly `'reset password successfully'`.
- **Failure UX:** any non-success string triggers the existing warning in `reset-password.js`.
- **Token lookup:** unchanged.
- **Login:** unchanged; bcrypt compares cost-10 and cost-12 hashes identically.
- **Database column:** `users_accounts.password` (`VARCHAR(255)`) fits a 60-character bcrypt hash.
- **Old cached client:** it sends `password` (plaintext) and `password3` (hash); the new server reads `password` and ignores `password3`, so it still works.
- **Hidden `password3` element:** keep it in the EJS for one release to avoid old-JS null-reference errors.

Intentional, documented changes:

- The server no longer reads `password3`. A client that sends **only** `password3` can no longer reset a password. No known client does this.
- The server uses cost 12 instead of the client's cost 10 for new resets.
- On failure the route now returns a generic message instead of leaking `error.message` or hanging.

Do **not** change:

- `UPDATE_PASSWORD` SQL semantics or column name.
- The reset token schema or expiry behaviour.
- The login flow, session payload, or UUID encryption.
- The public `/api/post/password-hashing` endpoint (registration still depends on it).

---

# 13. Testing Strategy

## Normal Case

- Submit matching `password`/`password2`.
- Assert success string.
- Assert `users_accounts.password` begins with `$2b$12$`.
- Assert `bcrypt.compare(plaintext, stored)` is `true`.
- Log in with the new password.

## Empty / Missing Input

- Missing `password`.
- Empty `password`.
- Missing `password2` (document whether allowed; if allowed, still hash).
- Empty token / nonexistent token (existing behaviour; do not fix, but confirm no plaintext write).

## Boundary Cases

- Very long password.
- Password with Unicode characters.
- Password containing `'`, `"`, `--`, `;`.
- `password` as an array or object (form/JSON shape abuse).
- Password exactly 72 bytes (bcrypt's truncation boundary); document if relevant.

## Invalid Input

- Confirmation mismatch.
- `password3` only.
- `password3` set to plaintext.
- Non-string values.

## Security Cases

- Direct POST with plaintext results in a hash.
- Direct POST with `password3` plaintext/hash does not store it.
- Database/logs do not contain the plaintext.
- Response does not contain the plaintext or hash.
- Hash has cost 12 and a unique salt.
- No double hashing when an old client sends both fields.
- SQL injection-shaped password is stored as a hash (proves it is data, not SQL).

## Regression Testing

- GET `/reset-password/:token` still renders the page with the email.
- Forgot-password flow still creates a token and sends the email (unchanged).
- Login still works with existing cost-10 hashes.
- Login works with a new cost-12 hash.
- Client still redirects to `/login` after success.
- No console errors on the reset page.

## Manual Verification (strongly recommended)

Use a disposable local account only:

```bash
# 1. Reset via curl (replace token)
curl -s -X POST http://localhost:<PORT>/reset-password/<token> \
  --data-urlencode 'password=ResetMe123!' \
  --data-urlencode 'password2=ResetMe123!'
# expect: reset password successfully

# 2. Confirm only a hash was stored
mysql -u <user> -p <db> -e \
  "SELECT password FROM users_accounts WHERE uuid = '<uuid>';"
# expect: $2b$12$... (60 chars), not "ResetMe123!"

# 3. Confirm bcrypt matches
node -e "const b=require('bcrypt'); const h=process.argv[1]; b.compare('ResetMe123!',h).then(r=>console.log(r))" '<stored-hash>'
# expect: true

# 4. Simulate an old cached client
curl -s -X POST http://localhost:<PORT>/reset-password/<token> \
  --data-urlencode 'password=AnotherPass1!' \
  --data-urlencode 'password2=AnotherPass1!' \
  --data-urlencode 'password3=$2b$10$fakehashfakehashfakehashfakehashfakehashfakehashfake'
# expect: success + hash of "AnotherPass1!", not a hash of password3

# 5. Attempt to store plaintext via the old field only
curl -s -X POST http://localhost:<PORT>/reset-password/<token> \
  --data-urlencode 'password3=PlainText123!'
# expect: failure; DB unchanged
```

Document the commands and observed results in the final report. Never run these against production data.

---

# 14. Verification / Evidence

The implementation is not complete because the code compiles. Provide evidence for each item:

1. **Code-path evidence:** paste the final reset handler and service, showing `password` → `bcrypt.hash(..., 12)` → `.update({ password: hash })`.
2. **Grep sweep:**
    ```bash
    grep -rn "password3" app public --include=*.js --include=*.ejs
    grep -rn "password-hashing" public/assets/js/reset-password.js
    grep -rn "bcrypt.hash" app/routes app/services
    ```
    Expect: no server read of `password3`; no reset-page call to `/api/post/password-hashing`; only the new server-side hash call.
3. **Unit tests:** `node --test test/password-reset.test.js` output.
4. **Database evidence:** the SQL query and observed hash prefix (`$2b$12$`), plus bcrypt compare result.
5. **Login evidence:** successful login with the reset password, and successful login with an untouched existing account (regression).
6. **Old-client evidence:** the `password3` simulation above.
7. **Diff review:** `git diff --stat` and `git diff`; confirm no unrelated files.
8. **Legacy-row audit:** report the result of the non-bcrypt query from §5.8 (count only, no raw passwords).

**Legacy rows:** if the audit query finds non-bcrypt values, do not silently rewrite them. They cannot be used to log in (bcrypt comparison returns false), so affected users need to reset again. A one-off script that hashes each plaintext value is possible only if the value is genuinely a plaintext password; that decision belongs to the operator and must be documented separately.

---

# 15. Do NOT Do

- Do not read or store `password3` as the credential.
- Do not hash an already-hashed `password3` (double hashing).
- Do not keep client-side hashing on the reset page.
- Do not remove `/api/post/password-hashing` or `/api/post/compare-password`; registration still uses them (Finding 5 is a separate task).
- Do not change the success string `'reset password successfully'`.
- Do not return `error.message` to the client.
- Do not log passwords, hashes, request bodies, or tokens.
- Do not use CryptoJS/AES/SHA for password storage.
- Do not change the database schema or add a migration.
- Do not add a dependency.
- Do not refactor unrelated parts of `forgot-password.js` (dead JWT, `User` global, token expiry, token deletion).
- Do not migrate the registration stack or change client-registration hashing in this task.
- Do not modify `.env`, secrets, or deployment configuration.
- Do not modify login/session code.
- Do not remove the hidden `password3` input in this release (it is harmless and aids old cached JS); schedule cleanup separately.
- Do not “fix” the failing `npm test` stub.
- Do not declare success from code inspection alone; run the tests and the manual curl/SQL verification.

---

# 16. Acceptance Criteria

## Acceptance Criteria

- [ ] `POST /reset-password/:token` reads the plaintext `password` field, not `password3`.
- [ ] The server hashes the password with bcrypt cost 12 before writing to `users_accounts.password`.
- [ ] A direct POST of a plaintext password stores a bcrypt hash, never plaintext.
- [ ] A direct POST containing only `password3` does not write that value.
- [ ] An old-client body containing both `password` and `password3` stores a hash of `password` (no double hash).
- [ ] The reset page no longer calls `/api/post/password-hashing`.
- [ ] The success response is exactly `'reset password successfully'`.
- [ ] The page still redirects to `/login` after success.
- [ ] The new password works for login; existing cost-10 accounts still work.
- [ ] Empty/missing/non-string passwords cannot reach the database as stored values.
- [ ] Confirmation mismatch is rejected (server-side; client-side check still present).
- [ ] No password, hash, or token is logged or returned.
- [ ] `test/password-reset.test.js` passes with `node --test`.
- [ ] The §5.8 legacy-row audit was run and reported (count only).
- [ ] `git diff` contains only the files listed in §6.
- [ ] Remaining findings (4, 5, 6, 7, 19, 23, registration hashing) are reported, not silently fixed.

---

# 17. Expected Final Report

Finish with this structure:

```markdown
# Implementation Report

## Summary

Brief explanation of what was implemented.

## Files Modified

| File  | Changes |
| ----- | ------- |
| `...` | ...     |

## Files Added

| File  | Purpose |
| ----- | ------- |
| `...` | ...     |

## Files Deleted

| File  | Reason |
| ----- | ------ |
| `...` | ...    |

## Files Referenced Only

| File  | Why |
| ----- | --- |
| `...` | ... |

## Implementation Details

Explain the route/service/client changes, the request-contract decision
(`password` instead of `password3`), the bcrypt cost, and the
old-client compatibility behaviour.

## Testing

| Test                                      | Result    |
| ----------------------------------------- | --------- |
| Normal reset                              | PASS/FAIL |
| Empty/missing password                    | PASS/FAIL |
| Confirmation mismatch                     | PASS/FAIL |
| Direct plaintext POST                     | PASS/FAIL |
| Old client (password + password3)         | PASS/FAIL |
| Password3-only POST                       | PASS/FAIL |
| Login with reset password                 | PASS/FAIL |
| Existing cost-10 login regression         | PASS/FAIL |
| `node --test test/password-reset.test.js` | PASS/FAIL |

## Verification

Show the grep sweep, DB hash prefix, bcrypt compare result, test output,
and final diff review.

## Remaining Risks

Report at minimum:

- legacy non-bcrypt rows and what operators must do,
- registration still trusts client-supplied `hashedPassword`,
- `/api/post/password-hashing` and `/api/post/compare-password` remain public,
- reset tokens are still not invalidated/expiry-checked,
- forgot-password response still leaks the stored hash,
- no rate limiting on reset endpoints.

## Final Status

PASS / NEEDS REVIEW
```

---

# 18. Important Rules for Generating the Task Document

### Rule 1 — Do not hallucinate

This document distinguishes verified repository facts from recommendations. Line numbers may shift after edits; re-verify before reporting. If a fact cannot be verified, mark it `TO INVESTIGATE` rather than assuming.

### Rule 2 — Separate facts from recommendations

- **CURRENT IMPLEMENTATION** (verified): the client pre-hashes with cost 10 and the server stores `password3` verbatim.
- **RECOMMENDED IMPLEMENTATION**: server-side bcrypt cost 12 reading `password`, with the client no longer hashing.

### Rule 3 — Prefer project consistency

Use `app/services/` + injectable dependencies + Sequelize, matching `auth.service.js` and the sibling tasks. Use `node:test`; do not add a test framework.

### Rule 4 — Preserve behavior

The URL, success string, redirect, login compatibility, and old-client flow must survive. The only intentional changes are where hashing happens, which field is read, and the failure message.

### Rule 5 — Think about the entire code path

Trace form → client JS → route → service → bcrypt → Sequelize/mysql2 → database → login. Do not fix only the single line named in the review.

### Rule 6 — Make the task executable

WHAT (server-side bcrypt on reset), WHERE (§6), WHY (§3), HOW (§9), WHAT NOT (§15), HOW TO TEST (§13), HOW TO VERIFY (§14).

---

# 19. Output Requirements for the Implementing Agent

- Produce only the implementation and the final report described in §17; do not add unrelated documentation files.
- Keep the change set to the files in §6.
- If any instruction in this document conflicts with verified repository behaviour, stop and report the conflict rather than guessing.
- Do not claim the finding is fixed until the database has been observed to contain a `$2b$12$` hash and a login with the new password succeeds.
- If the manual DB test cannot be run (no local database/token), mark the task **NEEDS REVIEW** and state exactly what remains unverified.
