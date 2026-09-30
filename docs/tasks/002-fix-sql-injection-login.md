Please optimize and refactor the following code according to best practices, updated, modern approach.
Break down the code into smaller, more focused functions, each handling a specific task.
Ensure the code is aligned with the 'Don't Repeat Yourself' (DRY), SOLID, and 'Keep It Simple, Stupid' (KISS) principles.
The goal is to enhance security, readability, performance, reusability, testability, and maintainability.

# Fix SQL Injection in Login (Finding 2)

- **Source finding:** `CODE_REVIEW.md` → Detailed Findings → **Finding 2: SQL Injection in Login**
- **Priority:** HIGH (security — prevents auth bypass). Roadmap item **#2**, "Effort: Low".
- **Sibling task already landed:** `docs/tasks/001-fix-sql-injection-search.md` (Finding 1) — its service/controller/test split is the pattern to copy.
- **Related findings touched by the same files (handle only if trivially in-scope, otherwise report):** Finding 3 (plaintext password on reset), Finding 24 (dead code: `ec()`, duplicate empty exports, credential `console.log`), Finding 25 (UUID crypto duplicated — `encryptUuid` missing from `ecdc.js`), Finding 27 (missing `return` after response), Finding 28 (duplicate `exports.create`), Finding 34 (freeze mysql2), Finding 36 (fat controllers), Finding 37 (callback → async), Finding 40 (session coupled to model), Finding 42 (mixed promise anti-patterns), Finding 45 (dead code/typos).
- **Repository rules:** `README.md`, `AGENTS.md`, `CODE_REVIEW.md` — read all three before touching code. New code goes in the **Sequelize stack** (`app/db_controllers/` + `app/db_models/` + `app/services/`); the mysql2 layer is frozen.

---

# 1. Task Title

**Fix the SQL Injection in the Login Data-Access Layer and Move Authentication onto the Sequelize Stack (route → validation middleware → thin controller → auth service → Sequelize models)**

---

# 2. Objective

- Remove the SQL injection **sink** in the login data-access layer: `app/models/login.model.js:40` and `app/models/login.model.js:69` build SQL by interpolating the client-supplied email into a string literal.
- Migrate authentication from the frozen mysql2/callback stack to the established Sequelize stack, so the email is **always passed as a bound value** (`where: { email_or_social_media: email }`) and can never be parsed as SQL.
- Move the HTTP/session concerns out of the model: the model currently encrypts the UUID, mutates `req.session`, and inserts session/login-status rows as a side effect of "querying" (Finding 40). Target: a service that returns plain data, a controller that owns `req.session` and the HTTP response.
- Stop writing credentials to the logs (today `console.log('model', model)` prints the submitted **password**, `login.controller.js:34` prints the email, `login.model.js:39` prints the whole input object).
- Keep the externally observable contract **byte-for-byte identical**: same URL, same request fields, same three response messages, same 200-on-validation-error behavior, same session payload shape, same encrypted-UUID format, same `login_at` / `login_status` writes.
- Expected end result: `POST /api/post/login-process` authenticates exactly as it does today, but the database call cannot be influenced by the request body — and the code no longer leaks passwords into stdout.

---

# 3. Problem / Finding

## Vulnerability type

- **SQL Injection** (OWASP A03:2021 — Injection) in an **authentication** path.
- **Severity per `CODE_REVIEW.md`:** CRITICAL ("Authentication is the highest-value target. SQL injection here allows complete authentication bypass and data exfiltration of all user credentials including password hashes.").
- **Attack surface:** `POST /api/post/login-process` — public, unauthenticated, and the only route on the app that ships with validation middleware.
- **Affected functionality:** user login (session creation, `user_sessions` row, `users_accounts.login_status` flag).

## Why the original implementation was unsafe (as described by CODE_REVIEW.md)

`CODE_REVIEW.md` Finding 2 documented `app/models/login.model.js` interpolating the user email into two raw SQL statements:

```js
const usersAccountsQuery = `SELECT password FROM users_accounts WHERE email_or_social_media = "${newModel.email_or_social_media}"`;
```

```sql
WHERE users_accounts.email_or_social_media = "${newModel.email_or_social_media}"
```

Both statements are unparameterized. The value is spliced into the SQL **text**, so the database can no longer distinguish "this is the email to look up" from "this is a clause". Because the second query runs *after* the password has already been verified, it is an **authenticated** exfiltration sink: an attacker who has legitimately logged in once can turn the email field into a `UNION SELECT` and read arbitrary tables (including `users_accounts.password` hashes) straight out of the JSON response path.

## Current state of the code (VERIFIED in-tree on the date this document was written)

The finding is **still present**. Verified current state of `app/models/login.model.js` (143 lines):

| Line(s) | What is there today                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------- |
| 7       | `console.log('model', model);` inside the constructor — **prints the submitted password**                 |
| 14–35   | A private copy of `phTime()` (duplicate of `app/utils/date.utils.js#getPhDateTimeString`)                 |
| 38      | Commented-out variant of the query, immediately above the live one                                        |
| 39      | `console.log('newModel', newModel);` — prints email + password + session                                  |
| **40**  | **Live injection:** `SELECT password FROM users_accounts WHERE email_or_social_media = "${...}"`          |
| 51      | `bcrypt.compareSync(plainPasswordInput, hashedPassword)` (verified: returns `false`, does not throw, for plaintext/garbage/empty stored values) |
| **54–69** | **Live injection #2:** the `users_accounts ⋈ users ⋈ users_addresses` join, with `email_or_social_media = "${...}"` |
| 62–63, 67 | The address table is named **`users_addresses`** in raw SQL. The Sequelize model is registered as `users_address`, which Sequelize pluralizes to `users_addresses` — i.e. the Sequelize model already maps to the same physical table. **TO INVESTIGATE / confirm at runtime** (see §5 step 6). |
| 77      | `let UuidToBeEncrypt = res[0].uuid;` — dereferences `res[0]` **before** the `if (res.length)` guard on line 90. An account row that exists but has no `users_addresses` row makes this throw a `TypeError` inside a mysql2 callback (unhandled → Finding 32/19 class of crash). |
| 78      | `CryptoJS.AES.encrypt(uuid, JWT_SECRET).toString()` — inline UUID encryption (Finding 25); **the algorithm must not change**, see §12 |
| 80–88   | Builds `sessionUser = { uuid, email_or_social_media, type, first_name, last_name, country, state_or_province }` |
| 91–102  | `INSERT INTO user_sessions (user_id, login_at) VALUES (?, ?)` — already parameterized, **fire-and-forget** (not awaited; failures only `console.log`) |
| 105–116 | `UPDATE users_accounts SET login_status = ? WHERE uuid = ?` — already parameterized, **fire-and-forget** |
| 118     | `newModel.session.user = sessionUser;` — the **model writes `req.session`** (Finding 40) |
| 119/122/127/131 | The three response messages: `{ message: 'found' }`, `{ message: 'not found' }`, `{ message: 'Please check your email address and password' }` |
| 137–141 | `ec()` — dead function that ignores its parameter and always encrypts the literal `31` (Finding 24) |

Verified current state of the surrounding path:

- `app/routes/index.js:94` — `app.post(['/api/post/login-process'], middleware.login_process, login.create);`
- `app/middleware/validations/login_process.validations.js` — a single chain: `check('loginEmailAddress').not().isEmpty().trim().escape().isEmail().withMessage('S: Email Address is required.')`. **`loginPassword` is not validated at all.** A comment on line 4 records that `normalizeEmail()` was already removed by the team ("it delete the point in my email address").
- `app/controllers/login.controller.js` (58 lines) — an empty `exports.create` at line 5 immediately overwritten at line 10 (Finding 28); `res.status(200).send({ message: errors.array() })` for validation errors (Finding 22); `if (!req.body) { res.status(400)... }` **without `return`** (Finding 27); `console.log('req.body.loginEmailAddress', ...)` at line 34; `res.status(500).send({ message: err.message || 'Some error occurred while creating the Model.' })` leaks the raw DB error to the client (Finding 45 boilerplate leftover); unused `check` import.
- `public/assets/js/login.js:7-21` — `$.ajax({ url: '/api/post/login-process', type: 'POST', data: formLogin.serialize() })`, then: `if (res.message === 'found') window.location.replace('/selection'); else if (res.message !== 'found') Swal.fire('Error', res.message, 'error');` — **no `error:` handler is registered**, so the client depends on a 2xx response even for failures.
- `public/view/login/index.ejs` — the form posts fields named `loginEmailAddress` and `loginPassword` (two copies of the form, desktop/mobile variants).

## Honest nuance — the sink is currently shielded *by accident* (do not overstate, do not understate)

The coding agent must understand this before claiming either "the site is exploitable today" or "it was never exploitable":

- `express-validator@7.3.2` (verified installed) **still supports `.escape()`**, and it mutates the value in `req.body` **in place**, HTML-escaping it (`"` → `&quot;`, `'` → `&#39;`, `&` → `&amp;`, `<`/`>`). Verified: posting `a" OR "1"="1` reaches the model as `a&quot; OR &quot;1&quot;=&quot;1`.
- `isEmail()` in the same chain rejects anything that is not an email, and the controller returns early on validation errors — so today, a request that would carry a raw `"` never reaches `Model.create`.

**Therefore:** the double-quote injection is *incidentally* neutralised on this one route. The correct engineering conclusion is **not** "no bug". It is:

1. **The sink itself is unprotected.** Parameterization must live at the data-access layer, not depend on an unrelated HTML sanitizer in a request-validation chain. `escape()` is an XSS-oriented sanitizer; it happens to remove the one character this SQL needed. That is luck, not design.
2. **The control is one refactor away from disappearing.** The team has already edited this exact chain once (removing `normalizeEmail()`), and the column is literally named **`email_or_social_media`** — the data model anticipates non-email identifiers (Viber/WeChat/WhatsApp, `social_media_contact_type`). Relaxing `isEmail()` to a generic identifier rule, or dropping `escape()` as "HTML-only", instantly re-opens a CRITICAL auth bypass.
3. **The reusable sink is reachable by design.** `Model.create(input, cb)` is a general model function. Any future route, cron, script, or admin tool that calls it without this exact middleware chain is directly injectable.
4. **The second query remains an exfiltration sink** even in the "verified" state, for the same reason.
5. **A structurally identical, *unvalidated* twin exists**: `app/models/help-and-support-login.model.js:13` and `:26` interpolate `email_address` into `support_accounts` SQL, and its route `app/post/help-and-support-login-process` (`app/routes/index.js:96`) is registered **with no validation middleware at all**. That is the genuinely exploitable instance of the same bug class. See §11 (sweep) — report it at minimum, and fix it as a tightly-scoped sibling if you can do so without behavior change.

**Why this task is still required regardless:** `AGENTS.md` mandates the Sequelize stack for anything touched; `CODE_REVIEW.md` Finding 2's recommended approach is exactly this migration; the layer is on the roadmap as item #2; and the fix also removes password logging, unhandled crash paths, and session coupling in the same 143-line file.

---

# 4. Affected Functionality

**Feature:** user login and session establishment.

```text
public/view/login/index.ejs  (form: loginEmailAddress, loginPassword)
   ↓ serialize()
public/assets/js/login.js:7   $.ajax POST /api/post/login-process
   ↓ application/x-www-form-urlencoded
app/routes/index.js:94   app.post([...], middleware.login_process, login.create)
   ↓
app/middleware/validations/login_process.validations.js   (escape + isEmail chain)
   ↓
app/controllers/login.controller.js   (validationResult → builds "model" instance → res.send)
   ↓
app/models/login.model.js   Model.create(input, cb)
   ├─ Q1  SELECT password FROM users_accounts WHERE email_or_social_media = "…"   ← INJECTION
   ├─ bcrypt.compareSync
   ├─ Q2  SELECT … FROM users_accounts JOIN users JOIN users_addresses
   │        WHERE users_accounts.email_or_social_media = "…"                        ← INJECTION
   ├─ INSERT INTO user_sessions (user_id, login_at) VALUES (?, ?)   (fire-and-forget)
   ├─ UPDATE users_accounts SET login_status = 1 WHERE uuid = ?    (fire-and-forget)
   └─ newModel.session.user = { uuid: <AES ciphertext>, … }       ← model mutates the session
   ↓
res.send({ message: 'found' })  →  login.js redirects to /selection
```

**Consumers of the produced session object** (must keep working — do not change the shape):
`app/src/server.js` page routes and `app.get('/logout')` read `req.session.user.uuid` and call `ecdc.decryptUuid(...)`; `app/db_controllers/users-accounts.controller.js:57-58` does the same; `app/models/visitors-of-traders.model.js` writes further keys onto the same session. **Every one of them depends on the UUID being CryptoJS-AES ciphertext keyed with `JWT_SECRET`.**

**Not in scope (report only):** `POST /api/post/help-and-support-login-process` (see §11 sweep), `POST /api/post/forgot-password-process`, registration.

---

# 5. Investigation Phase (MANDATORY — do before editing)

The coding agent must complete these investigations and record any deviation from this document in the final report:

1. **Re-read the repo rules:** `README.md` (§9.2 login flow, §12 auth, §16 stack), `AGENTS.md` (Auth & sessions; Known technical debt), `CODE_REVIEW.md` (Findings 2, 5, 6, 22, 24, 27, 28, 34, 36, 37, 38, 40, 42, 45 + §2b function-decomposition playbook + §2c "first week" list).
2. **Read the finished sibling fix** `docs/tasks/001-fix-sql-injection-search.md` and the code it produced:
   - `app/services/business-search.service.js` (service with injected `db` ref, `Op.*` query building, response flattening)
   - `app/db_controllers/search-businesses.controller.js` (whitelist mapper + thin async controller)
   - `test/search-businesses.test.js` (`node:test`, no framework installed)
   This is the house style for "a Sequelize service behind a thin controller, covered by a `node --test` file". **Match it.**
3. **Confirm the consumer contract:** read `public/assets/js/login.js` (lines 7–21) and `public/view/login/index.ejs`. Record: the exact field names posted, the exact strings compared (`res.message === 'found'`), and that there is **no `error:` callback** (therefore status codes must not change in this task).
4. **Confirm every reader of the session shape:** `grep -rn "req.session.user" app` and `grep -rn "decryptUuid" app`. List them. They constrain the session payload and the crypto format.
5. **Confirm the models exist and are exported:** `app/db_models/index.js` exposes `db.users_accounts`, `db.users`, `db.users_address`, `db.user_sessions`, `db.Sequelize`, `db.sequelize`. Read the four model files for exact column names (`email_or_social_media`, `password`, `type`, `status`, `login_status`, `uuid`; `first_name`, `last_name`, `uuid`; `country`, `state_or_province`, `uuid`; `user_id`, `login_at`, `logout_at`).
6. **Confirm the physical table names and the join strategy.** Two facts to verify before writing code:
   - Does Sequelize map `db.users_address` to the physical table `users_addresses` (what the raw SQL uses)? Verify with a one-liner and paste the output in the report: `node -e "const db=require('./app/db_models'); console.log(db.users_address.getTableName(), db.users_accounts.getTableName())"`.
   - `app/db_models/index.js:32-48` already declares two `hasOne` associations with `constraints: false` and the comment "Logical (non-FK) associations required for `include`-based joins". There is **no** association for `users_accounts ↔ users ↔ users_address`. Decide and document one of:
     - **(A) Add** `belongsTo`/`hasOne` for `users_accounts → users` and `users_accounts → users_address` with `foreignKey: 'uuid'`, `sourceKey: 'uuid'`, `constraints: false` (consistent with the existing comment), then use `include` with `required: true`; **or**
     - **(B)** use a single `db.sequelize.query(..., { replacements: { email } })` with explicit named placeholders (this is the pattern already used in `app/services/analytics.service.js:12-20`); **or**
     - **(C)** use `include` with an explicit `on` clause and no new associations.
     Prefer (A) if it works; fall back to (B). Record the choice and why.
7. **Confirm how the login row is joined today** so the replacement selects the same fields: `users_accounts.id, uuid, email_or_social_media, password, type` + `users.first_name, users.last_name` + `users_addresses.country, users_addresses.state_or_province`. Note the INNER JOIN semantics (see §12 "the missing address row").
8. **Confirm the timestamp format.** `app/models/login.model.js:14-35` builds `YYYY-MM-DD HH:mm:ss` in `Asia/Manila`; `app/utils/date.utils.js#getPhDateTimeString(new Date())` produces the identical string. Verify by running both and diffing the output before you delete the local copy. **Do not** replace it with `new Date()` — that would shift stored `login_at`/`logout_at` values by the UTC offset and corrupt the daily analytics report (`app/services/analytics.service.js`, cron at `server.js:163`).
9. **Check for other consumers before deleting anything:**
   `grep -rn "login.model\|login.controller" app public` — today the only consumer of `app/models/login.model.js` is `app/controllers/login.controller.js:1`, and the only consumer of that controller is `app/routes/index.js:46`. Re-run it yourself; if anything else appears, that file becomes `INVESTIGATE`, not `DELETE`.
10. **Run the app before you change it** (`npm run dev`) and log in once with a real account, so you have a working baseline (and a known-good `login_at` row to compare against).

---

# 6. File Impact Analysis

| File                                                            | Role                                                        | Action                        | Reason                                                                                                     |
| --------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `app/models/login.model.js`                                     | Legacy raw-SQL + session side effects (143 lines)           | **DELETE** (after step 9 grep) | Holds both injection sites; superseded by the Sequelize service. Only `login.controller.js` requires it      |
| `app/controllers/login.controller.js`                           | Legacy thin-ish controller (58 lines)                       | **DELETE** (after step 9 grep) | Its only job is mapping HTTP onto the vulnerable model; replaced by the Sequelize controller                  |
| `app/db_controllers/login.controller.js`                        | New thin HTTP controller (validation → service → session → response) | **ADD**                 | Target implementation; keeps route/response contract; owns `req.session` (Finding 40)                         |
| `app/services/auth.service.js`                                  | New use-case service (find account, verify, record login)   | **ADD**                       | Holds the only data access for auth; dependency-injected `db` so it is unit-testable                         |
| `app/db_controllers/index.js`                                   | Controller barrel                                           | **MODIFY** (one line)         | Project convention: `app/routes/sequelize.route.js` consumes the barrel                                      |
| `app/routes/index.js`                                           | Route wiring (line 46 require, line 94 handler)             | **MODIFY** (lines 46 + 94)    | Swap the handler target; keep the URL and the `middleware.login_process` position identical                  |
| `app/db_models/index.js`                                        | Model barrel + logical associations                        | **MODIFY** *only if* you take option (A) in §5 step 6 | Needed for `include`-based joins; must use `constraints: false` like the existing two                       |
| `app/db_models/users_accounts.model.js`                         | `users_accounts` table                                      | REFERENCE ONLY                | Column names for `where`/`attributes`; **do not** add validation or hooks                                    |
| `app/db_models/users.model.js`                                  | `users` table                                               | REFERENCE ONLY                | `first_name`, `last_name`, `uuid`                                                                            |
| `app/db_models/users_address.model.js`                          | `users_address` table                                       | REFERENCE ONLY                | `country`, `state_or_province`; confirm physical table name (§5 step 6)                                       |
| `app/db_models/user_sessions.model.js`                          | `user_sessions` table                                       | REFERENCE ONLY                | `user_id`, `login_at` for the login audit write                                                              |
| `app/middleware/validations/login_process.validations.js`       | Request validation chain                                   | MODIFY (optional, additive)   | **Only** to add a `loginPassword` presence/length check. **Do not** touch `isEmail()`/`escape()`/`normalizeEmail()` semantics (§12) |
| `app/shared/ecdc.js`                                            | `decryptUuid` only                                          | MODIFY (optional, additive)   | Adding `encryptUuid` (Finding 25 step 1) removes the inline CryptoJS from the model. **Never** change the algorithm |
| `app/utils/date.utils.js`                                       | Shared PH-time helpers                                      | REFERENCE ONLY                | `getPhDateTimeString` replaces the model's private `phTime()` copy                                           |
| `app/services/business-search.service.js`                       | Finished sibling fix (Finding 1)                           | REFERENCE ONLY                | The service/controller/test shape to imitate                                                                 |
| `app/db_controllers/search-businesses.controller.js`            | Finished sibling fix                                        | REFERENCE ONLY                | Whitelist-mapper + error-handling shape                                                                       |
| `test/search-businesses.test.js`                                | Finished sibling tests                                      | REFERENCE ONLY                | Style + `node --test` invocation for your new test file                                                      |
| `app/services/analytics.service.js`                             | `sequelize.query` + `replacements` usage                    | REFERENCE ONLY                | Fallback (B) parameterized pattern if you do not add associations                                             |
| `app/models/help-and-support-login.model.js`                    | Same bug class, **unvalidated** route                       | INVESTIGATE (fix only as a tightly-scoped sibling) | Sweep obligation (§11); separate endpoint, separate contract — do not silently expand scope                |
| `app/src/server.js`                                             | Boot + `/logout` + page routes                              | REFERENCE ONLY                | Confirms session consumers; **must not** be modified by this task                                            |
| `public/assets/js/login.js`                                     | Login client                                                | REFERENCE ONLY                | Defines the response contract; **must not** be modified by this task                                          |

---

# 7. Current Implementation

## Route — `app/routes/index.js`

```js
const login = require('../controllers/login.controller.js'); // line 46
// ...
app.post(['/api/post/login-process'], middleware.login_process, login.create); // line 94
```

## Validation middleware — `app/middleware/validations/login_process.validations.js`

```js
const validationMiddleware = [
    check('loginEmailAddress').not().isEmpty().trim().escape().isEmail().withMessage('S: Email Address is required.'),
];

module.exports = validationMiddleware;
```

`loginPassword` is unvalidated. `escape()` mutates `req.body` in place (verified behaviour of `express-validator@7.3.2`).

## Controller — `app/controllers/login.controller.js` (verbatim, trimmed of nothing)

```js
const Controller = require('../models/login.model.js');
const { check, validationResult } = require('express-validator');

exports.create = (req, res) => {}; // line 5 — dead stub, overwritten below (Finding 28)

exports.create = (req, res) => {
    const errors = validationResult(req);

    try {
        if (!errors.isEmpty()) {
            return res.status(200).send({ message: errors.array() });
        }
    } catch (error) {
        return res.status(400).json({ error: { message: error } });
    }

    if (!req.body) {
        res.status(400).send({ message: 'Content can not be empty!' }); // no return (Finding 27)
    }

    if (req.body.loginEmailAddress && req.body.loginPassword) {
        console.log('req.body.loginEmailAddress', req.body.loginEmailAddress);

        const inputData = new Controller({
            email_or_social_media: req.body.loginEmailAddress,
            password: req.body.loginPassword,
            session: req.session,
        });

        Controller.create(inputData, (err, data) => {
            if (err) res.status(500).send({ message: err.message || 'Some error occurred while creating the Model.' });
            else res.send(data);
        });
    } else {
        let errorData = { message: 'Please enter Username and Password!' };
        res.send(errorData);
        res.end();
    }
};
```

## Model — `app/models/login.model.js` (the two injection sites, verbatim)

```js
// line 40 — INJECTION SITE #1
const usersAccountsQuery = `SELECT password FROM users_accounts WHERE email_or_social_media = "${newModel.email_or_social_media}"`;
```

```js
// lines 54-69 — INJECTION SITE #2
const usersAccountsQuery = `SELECT
    users_accounts.id,
    users_accounts.uuid,
    users_accounts.email_or_social_media,
    users_accounts.password,
    users_accounts.type,
    users.first_name,
    users.last_name,
    users_addresses.country,
    users_addresses.state_or_province
    FROM users_accounts
    INNER JOIN users
    ON users.uuid = users_accounts.uuid
    INNER JOIN users_addresses
    ON users_addresses.uuid = users_accounts.uuid
    WHERE users_accounts.email_or_social_media = "${newModel.email_or_social_media}"`;
```

Everything after that (already parameterized, and the session write):

```js
let UuidToBeEncrypt = res[0].uuid;                                   // line 77 — unsafe deref
const cipherUuid = CryptoJS.AES.encrypt(UuidToBeEncrypt, JWT_SECRET).toString();

let sessionUser = {
    uuid: cipherUuid,
    email_or_social_media: res[0].email_or_social_media,
    type: res[0].type,
    first_name: res[0].first_name,
    last_name: res[0].last_name,
    country: res[0].country,
    state_or_province: res[0].state_or_province,
};

let insertSessionQuery = `INSERT INTO user_sessions (user_id, login_at) VALUES (?, ?)`;
sql.query(insertSessionQuery, [UuidToBeEncrypt, phTime()], (insertErr, insertRes) => { /* console.log only */ });

let updateQuery = `UPDATE users_accounts SET login_status = ? WHERE uuid = ?`;
sql.query(updateQuery, [1, UuidToBeEncrypt], (updateErr, updateRes) => { /* console.log only */ });

newModel.session.user = sessionUser;   // model mutates the session
result(null, { message: 'found' });
```

## Current problems (this file only)

1. Two string-interpolated SQL statements on the authentication path.
2. Passwords and emails written to stdout (lines 7, 39; controller line 34).
3. `res[0]` dereferenced before the emptiness check → unhandled `TypeError` inside a callback when the JOIN returns zero rows.
4. The model depends on the web layer (`this.session = model.session`, line 11) and mutates it — untestable without Express (Finding 40).
5. Duplicated `phTime()` (DRY violation; `app/utils/date.utils.js` already has it).
6. Fire-and-forget writes: a failed `user_sessions` insert or `login_status` update is invisible to the caller.
7. Dead code: `ec()` (137–141), the empty `exports.create` stub, an unused `check` import, the commented-out query at line 38, the tutorial string `'Some error occurred while creating the Model.'` (Finding 45).
8. The model name is `Controller` inside a *controller* that imports a *model* — misleading names (Finding 45).

---

# 8. Current → Target

## Current

```text
req.body → validation chain (HTML-escapes the email, requires isEmail)
         → login.controller.js (HTTP + mapping + response, one status bug)
         → login.model.js (raw SQL by string interpolation; bcrypt; inline AES;
                            session INSERT; login_status UPDATE; mutates req.session)
         → mysql2 pool → rows → res.send({ message })
```

## Target

```text
req.body → validation chain (unchanged behaviour; optional added password check)
         → db_controllers/login.controller.js   (HTTP only: validationResult, session
            assignment, response shape, status codes)
         → services/auth.service.js             (use case: authenticate({ email, password })
            → db.users_accounts.findOne({ where: { email_or_social_media: email } })   ← BOUND VALUE
            → bcrypt.compare
            → db.users_accounts.findOne({ include: [users, users_address] })            ← BOUND VALUE
            → return plain data { uuid, email_or_social_media, type, first_name,
                                  last_name, country, state_or_province }   (NO session, NO req)
            → recordLogin(uuid): user_sessions.create + users_accounts.update
         → controller: encrypt uuid (ecdc.encryptUuid), assign req.session.user, res.send
```

## Before / After concept (adapt to the real models — do not force)

```js
// BEFORE (injection sink)
const usersAccountsQuery = `SELECT password FROM users_accounts WHERE email_or_social_media = "${newModel.email_or_social_media}"`;
sql.query(usersAccountsQuery, (err, res) => { /* … */ });
```

```js
// AFTER — Sequelize: the value is a bound parameter, never SQL text
const account = await this.UsersAccounts.findOne({
    where: { email_or_social_media: email },
    attributes: ['uuid', 'password'],
});
```

```js
// BEFORE (injection sink #2, post-auth exfiltration)
sql.query(`SELECT … FROM users_accounts INNER JOIN users … WHERE users_accounts.email_or_social_media = "${email}"`, cb);
```

```js
// AFTER — association include; the email still lives in a `where`, never in a template
const account = await this.UsersAccounts.findOne({
    where: { email_or_social_media: email },
    attributes: ['uuid', 'email_or_social_media', 'type'],
    include: [
        { model: this.Users, as: 'user', required: true, attributes: ['first_name', 'last_name'] },
        { model: this.UsersAddress, as: 'address', required: false, attributes: ['country', 'state_or_province'] },
    ],
});
```

```js
// ACCEPTED FALLBACK if associations prove awkward (pattern already used in analytics.service.js)
const [rows] = await this.sequelize.query(
    `SELECT users_accounts.uuid, users_accounts.email_or_social_media, users_accounts.type,
            users.first_name, users.last_name, users_addresses.country, users_addresses.state_or_province
     FROM users_accounts
     LEFT JOIN users ON users.uuid = users_accounts.uuid
     LEFT JOIN users_addresses ON users_addresses.uuid = users_accounts.uuid
     WHERE users_accounts.email_or_social_media = :email`,
    { type: this.Sequelize.QueryTypes.SELECT, replacements: { email } },
);
```

> Use these as the intended patterns. Inspect the existing architecture and adapt. The non-negotiable: **the email must leave JavaScript as a bound value, never as characters of a SQL string.**

---

# 9. Detailed Implementation Plan

Keep the change small, in the order below. Each step must be verifiable on its own.

## Step 1 — Inspect (do §5 completely and write down the answers)

Baseline first: `npm run dev`, log in with a known account, note the `user_sessions` row and the session cookie. Record `git status` so the final diff is reviewable.

## Step 2 — Identify all affected inputs

| Input                     | Source                                | Today                                | After                                   |
| ------------------------- | ------------------------------------- | ------------------------------------ | --------------------------------------- |
| `loginEmailAddress`       | `req.body` (after `escape()` mutation) | Interpolated into 2 SQL strings      | Bound value; passed through **unchanged** (keep the escaped value so behavior is identical) |
| `loginPassword`           | `req.body`                            | `bcrypt.compareSync` (safe)          | `bcrypt.compare` (async) or `compareSync` — either is fine; keep the same result semantics |
| `req.session`             | Express                               | Stored on the model, written by it   | Read/written **only** in the controller  |
| `JWT_SECRET`              | env                                   | Read at module load                 | Read the same way (via `ecdc`)          |

Explicitly **not** used today and therefore **not** to be introduced: `type` (the login form does not send it and the query ignores it — do **not** start filtering by tier; that would be a behavior change), `status`, `login_status`, `verification_code`.

## Step 3 — Confirm the existing project pattern

Follow, do not invent:

- `app/services/business-search.service.js` — class, `constructor(dbRef = db)`, methods that build query *data*, `db.Sequelize.Op`, no `req`/`res`.
- `app/db_controllers/search-businesses.controller.js` — `mapXParams(req.body)` mapper (export it so it is unit-testable) + one thin async handler + `try/catch` → `res.status(500)`.
- `app/db_controllers/index.js` — one barrel line per controller.
- `app/routes/sequelize.route.js` — barrel consumption; `app/routes/index.js` — direct requires (login lives in the second file, so a direct require is the consistent choice there; still add the barrel entry for consistency).

## Step 4 — Add `ecdc.encryptUuid` (recommended, additive)

```js
ecdc.encryptUuid = (uuid) => CryptoJS.AES.encrypt(uuid, process.env.JWT_SECRET).toString();
```

**Constraints:** same library (`crypto-js`), same passphrase (`JWT_SECRET`), same output encoding. This is a pure de-duplication of `login.model.js:78` (Finding 25 step 1) and it must be **byte-compatible** with every UUID already sitting in live sessions. Do **not** migrate to `aes-256-gcm` in this task.

## Step 5 — Create `app/services/auth.service.js`

Suggested decomposition (each function one job — CODE_REVIEW §2b / Finding 36):

```js
class AuthService {
    constructor(dbRef = db) { /* capture models, Sequelize, Op, sequelize */ }

    // 1. lookup (parameterized)
    findPasswordHashByEmail(email)

    // 2. lookup (parameterized join, same fields as the legacy SELECT)
    findAccountProfileByEmail(email)

    // 3. business rule, no I/O beyond the two lookups
    verifyPassword(plainPassword, hash)                 // boolean; guard bcrypt against non-hash values

    // 4. audit writes, isolated so failures can be logged without failing the login
    async recordLogin(uuid)                             // user_sessions.create + users_accounts.update

    // 5. the use case the controller calls
    async authenticate({ email, password })
        // → { ok: true, account: { uuid, email_or_social_media, type, first_name, last_name, country, state_or_province } }
        // → { ok: false }   (one failure shape for every reason — see §11)
}
```

Rules for this file:

- No `req`, no `res`, **no `session`** (Finding 40). Return plain data.
- No `console.log` of email, password, hash, uuid, or session.
- The email is only ever a bound value.
- `recordLogin` must use `getPhDateTimeString(new Date())` from `app/utils/date.utils.js` (not a local copy, not `new Date()`).
- Never return `{ ok: false, reason: 'no such user' }` vs `{ ok: false, reason: 'bad password' }` to the caller — the controller must be unable to distinguish them without effort (user enumeration, §11).

## Step 6 — Create `app/db_controllers/login.controller.js`

```js
exports.mapLoginCredentials = (body = {}) => ({ email: body.loginEmailAddress, password: body.loginPassword });

exports.create = async (req, res) => { /* thin */ };
```

Controller responsibilities, in order — and nothing else:

1. `validationResult(req)`; if not empty → **keep** `return res.status(200).send({ message: errors.array() })` (Finding 22 is a separate task that must also update `login.js`; changing it here breaks the UX — §12).
2. If `!req.body.loginEmailAddress || !req.body.loginPassword` → **keep** `res.send({ message: 'Please enter Username and Password!' })` (add the missing `return` — Finding 27 — it is behaviour-preserving because it is the last statement of that branch).
3. `const { ok, account } = await authService.authenticate(mapLoginCredentials(req.body));`
4. On success: build the session payload **exactly** as today, `req.session.user = { uuid: ecdc.encryptUuid(account.uuid), email_or_social_media, type, first_name, last_name, country, state_or_province }`, then `return res.send({ message: 'found' })`.
5. On failure: `return res.send({ message: 'Please check your email address and password' })`.
6. On unexpected error: `console.error` server-side, then `return res.status(500).send({ message: 'Login failed.' })` — a generic message. **Document this single intentional change**: today `err.message` (a raw DB error) is returned to the client. The client only displays `res.message` in a SweetAlert, so a generic string is a strict improvement and does not change the flow.

Decide and document: does the response wait for `recordLogin`? **Recommended:** yes, `await` it, and on failure log the error and still return success (the user *is* authenticated; only the audit row failed). This is a small, safe reliability improvement over today's fire-and-forget. State it in the report.

## Step 7 — Add the barrel entry

`app/db_controllers/index.js`: `controller.login = require('./login.controller.js');`

## Step 8 — Re-point the route, then remove the old path

1. `app/routes/index.js:46` — `const login = require('../db_controllers/login.controller.js');`
2. `app/routes/index.js:94` — **unchanged text**: `app.post(['/api/post/login-process'], middleware.login_process, login.create);`
3. Re-run the §5 step 9 grep. If (and only if) it still shows a single consumer each, `git rm app/models/login.model.js app/controllers/login.controller.js`.
4. If any other consumer exists: keep the old files, and instead make `app/models/login.model.js` delegate to the new service (so the injection sink is gone even though the file remains) — and say so in the report.

## Step 9 — Optional, additive, same-file cleanups (do not skip silently; list them in the report)

- `app/middleware/validations/login_process.validations.js`: add a `check('loginPassword').not().isEmpty().withMessage(...)`. **Additive only** — do not alter `loginEmailAddress` handling (§12).
- Delete the dead `ec()` / commented query / duplicate stub **by deleting the file** (step 8), not by pruning.
- Fix the misleading `const Controller = require('../models/…')` naming in whatever you touch.

## Step 10 — Add tests (see §13)

Create `test/login.test.js` following `test/search-businesses.test.js`: `node --test test/login.test.js`, `require('dotenv').config()` at the top, `node:test` + `node:assert`, pure tests first, integration tests last with a graceful skip when the DB is unavailable.

## Step 11 — Review

Run `npm run lint` (Prettier `--write`, 4 spaces, single quotes, printWidth 120, trailing commas), then verify against §14 before declaring completion.

---

# 10. Architecture and Existing Patterns

- **Layering that matches this repo's own target (CODE_REVIEW Finding 36, §2b):**
  ```text
  route → middleware (validate) → controller (HTTP only) → service (use case) → model (data access)
  ```
- **Service style:** mirror `app/services/business-search.service.js` and `app/services/analytics.service.js` — a small class, `constructor(dbRef = db)` for injection, no `req`/`res`, no HTTP status codes, no `res.json`.
- **Controller style:** mirror `app/db_controllers/search-businesses.controller.js` — exported pure mapper + one async handler + `try/catch`.
- **Route style:** `app/routes/index.js` uses direct requires and `app.post([...paths], middleware, handler)` arrays. Keep that shape; the URL must not change.
- **Timestamp style:** `app/utils/date.utils.js`.
- **Crypto style:** `app/shared/ecdc.js` (extend it; do not create a second crypto helper).
- **Association style:** `app/db_models/index.js` — `constraints: false`, logical joins on `uuid`, documented with a comment.
- **Test style:** `node:test`, no framework dependency (`npm test` is a failing stub; **do not** change `package.json` scripts in this task — invoke the file directly and say so in the report).

> Do not introduce a new dependency, framework, architecture, or design pattern when an appropriate existing project pattern already exists.

Specifically **do not** add: Passport (unused, Finding 41), a rate limiter (Finding 7), an auth middleware (Finding 6), Helmet/CSP (Finding 10), a global error handler (Finding 32), or HTTP-400 validation responses (Finding 22). Those are separate tasks; mixing them in makes this diff unreviewable.

---

# 11. Security Requirements

## Rules for the authentication path

- **Never** build SQL by concatenating, interpolating, or template-literal-expanding any value that came from the request. Not in a `WHERE`, not in a `LIKE`, not in an `ORDER BY`, not in a `LIMIT`, not in a column/table/operator position.
- **Always** bind the email: Sequelize `where: { email_or_social_media: email }` or `replacements: { email }` / `?` placeholders.
- The email must be passed through **exactly as it arrives today** (i.e. the value the validation chain left in `req.body.loginEmailAddress`). Do not add `normalizeEmail()`, `toLowerCase()`, or `trim()` — that is a behavior change (§12) and `normalizeEmail()` was already removed from this chain on purpose.
- Do not use user input as an identifier (table, column, alias, `ORDER BY` direction, `LIMIT` value).
- Keep the same query semantics: `users_accounts` ⋈ `users` (INNER, required) and `users_accountes` (see §12 for the address-row decision).
- Keep bcrypt as the password verifier. Do not add `Math.timingSafeEqual` string comparisons, do not compare hashes directly, do not log the hash, do not return the hash to the client. (The `attributes` list for the profile query must **not** include `password` — today's second query selects it and throws it away; the new one should not fetch it at all. That is a safe, observable-nowhere improvement — call it out in the report.)
- Guard `bcrypt.compare` against a non-bcrypt stored value. Verified: `bcrypt.compareSync('secret', 'secret')`, `('secret','not-a-hash')` and `('secret','')` all return `false` and do not throw, so this is defensive only — but it is cheap and it documents that a plaintext-stored password (Finding 3) must not crash the login path.
- **Uniform failure response.** Unknown email, wrong password, disabled account, missing address row → the *same* message, the *same* status, ideally the *same* amount of work. Today the model already returns one message for the first two cases; preserve that and never branch on the reason in the response. (User enumeration is its own finding; do not fix it here, but do not regress it either.)
- **No credential logging.** No `console.log`/`console.debug`/`console.error` of the request body, email, password, hash, plaintext UUID, or the session object. Log the *outcome* (`Login failed`, `Login succeeded`, `DB error while recording login`) without the values.
- **No internals to the client.** No `err.message`, no SQL text, no stack traces, no table names.
- Fix the `res[0]` dereference: never index an array result before checking it is non-empty. This is a real crash path (§7 item 3).

## What must be tested as an attack

- `loginEmailAddress` = `a" OR "1"="1`
- `loginEmailAddress` = `x" UNION SELECT password, uuid, type, 1,1,1,1 FROM users_accounts -- `
- `loginEmailAddress` = `" OR 1=1 #` (MySQL line comment)
- `loginEmailAddress` = `x"; DROP TABLE users_accounts; -- ` (**assert the table still exists afterwards**)
- `loginEmailAddress` = backticks, `${...}`, `%`, `_`, `\\`, and a 10 000-character string
- `loginEmailAddress` sent as an **array** (`loginEmailAddress[]=a`) and as an **object** (`{"$ne":null}` in JSON) — operator smuggling; the service must drop or reject non-scalars, exactly as `toScalar` does in `business-search.service.js:43-47`
- `loginEmailAddress` with a **Unicode** look-alike / RTL override / null byte
- `__proto__` in the body (prototype pollution) — the mapper must build a fresh object

## Similar-vulnerability sweep (mandatory; report results even if you fix nothing)

Verified list of unparameterized SQL in the frozen mysql2 layer (grep for `= "${`), as of this document:

| File                                        | Lines | Note                                                                                 |
| ------------------------------------------- | ----- | ------------------------------------------------------------------------------------- |
| `app/models/login.model.js`                 | 40, 69 | **This task**                                                                        |
| `app/models/help-and-support-login.model.js` | 13, 26 | **Same bug, route has NO validation middleware** → the genuinely exploitable twin. Fix as a scoped sibling or report prominently |
| `app/models/users-business.model.js`        | 19, 37, 58, 83 | `uuid` / `communicator` interpolation; check whether the value can come from `req.body` |
| `app/models/users-accounts.model.js`        | 15, 32 | `uuid` from the session; lower risk, still an unparameterized sink                     |
| `app/models/users.model.js`                 | 15    | same pattern                                                                           |
| `app/models/users-address.model.js`         | 15    | same pattern                                                                           |
| `app/models/users-business-medias.model.js` | 16, 35, 50 | same pattern                                                                      |
| `app/models/users-business-visibility.model.js` | 15 | same pattern                                                                      |
| `app/models/users-business-characteristics.model.js` | 15 | same pattern                                                                   |
| `app/models/users-business-images.model.js` | 17    | same pattern                                                                           |
| `app/models/users-business-videos.model.js`  | 15    | same pattern                                                                           |
| `app/models/sub-categories.model.js`        | 30    | `id` from a URL param (`:id`) — reachable, no validation middleware on that GET        |
| `app/models/minor-sub-categories.model.js`  | 26, 43, 60 | `id` / `title` from URL params                                                    |
| `app/models/global-region.model.js`         | 30    | `iso` from a URL param                                                                 |
| `app/models/languages.model.js`             | 32    | `code` from a URL param                                                               |
| `app/models/visitors-of-traders.model.js`   | 237   | `SELECT title FROM ${table} WHERE id = "${id}"` — both a table name and a value; `id` originates from a DB row (second-order injection) |

For every row above, record: (a) is the interpolated value attacker-controllable today? (b) is any validation middleware in front? (c) route + method. Include the table in the final report. **Fixing them is out of scope** — except the support-login twin, which is a 2-line change in the same bug class if you choose to include it and can prove no behavior change.

---

# 12. Backward Compatibility

The frontend is not yours to change in this task, so the observable contract is frozen.

| Surface                        | Must remain                                                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| URL + method                   | `POST /api/post/login-process`                                                                                      |
| Middleware chain               | `middleware.login_process` stays first in the handler list, with the same rules                                          |
| Request fields                 | `loginEmailAddress`, `loginPassword` (client uses `formLogin.serialize()`)                                            |
| Validation-failure response    | **HTTP 200** with `{ message: <errors array> }`. `login.js` has no `error:` handler; switching to 400 makes the SweetAlert never fire (Finding 22 — separate task that must also patch `login.js`) |
| Missing-field response         | HTTP 200 with `{ message: 'Please enter Username and Password!' }`                                                    |
| Success response               | HTTP 200 with exactly `{ message: 'found' }` → client redirects to `/selection`                                        |
| Failure response               | HTTP 200 with exactly `{ message: 'Please check your email address and password' }` for **every** failure reason        |
| `{ message: 'not found' }`     | Currently unreachable (both failure branches return the other string). Keep the code path or drop it — either is fine, **say which** |
| DB-error response              | HTTP 500, but generic message (one **approved** change: no more `err.message` to the client)                            |
| Session payload keys           | `uuid` (AES ciphertext), `email_or_social_media`, `type`, `first_name`, `last_name`, `country`, `state_or_province` — same order-independent key set |
| UUID crypto format             | CryptoJS AES with `JWT_SECRET` passphrase, `.toString()` encoding. **Existing live sessions must keep decrypting** — no algorithm change |
| `user_sessions.user_id`        | the **plaintext** UUID (not the ciphertext) — matches today and the logout query                                           |
| `user_sessions.login_at`       | `YYYY-MM-DD HH:mm:ss` string in `Asia/Manila` (i.e. `getPhDateTimeString(new Date())`). Passing a JS `Date` would shift the stored value by the server's UTC offset and corrupt the nightly analytics email |
| `users_accounts.login_status`  | set to `1` on login (note: logout sets it to `null` — preserve that asymmetry; do not "fix" it here)                     |
| Tier filtering                 | **Not** added. The current query ignores `type`; adding it would lock out users who pick the wrong tier on the login form |
| Email normalization            | **Not** added (no `normalizeEmail`, no `toLowerCase`, no `trim`)                                                           |
| Unreachable-code behaviour     | `if (!req.body)` is dead code (body parsers always populate an object). Remove it or leave it — either is fine; say which         |
| The `users_addresses` join     | Today it is an **INNER** join and `res[0]` is dereferenced before the length check. A missing address row therefore **crashes**. Two legitimate options: (a) preserve INNER semantics and return the standard failure message when the profile lookup returns nothing; (b) make it a LEFT join and accept `country: null, state_or_province: null`. **(b) is safer** and matches the schema intent, but it changes what an address-less account sees in the session — pick one, justify it in the report, and add a test for it |

Nothing else in the app may change: no schema change, no new env var, no `package.json` script change, no EJS/JS/CSS change, no `npm run tailwindBuild` / `npm run webpackBuild` needed (no class or bundle changes).

---

# 13. Testing Strategy

> The repo has no test runner configured (`npm test` is a stub that exits 1). Follow the precedent set by `test/search-businesses.test.js`: plain `node:test` + `node:assert`, invoked as `node --test test/login.test.js`. Do not add a framework.

### Pure tests (no database — these are the ones that must always pass)

- `mapLoginCredentials` picks only `loginEmailAddress` / `loginPassword` and drops everything else (mirror `test/search-businesses.test.js:124-146`, including a `__proto__` case).
- `mapLoginCredentials` handles a missing body (`{}`, `undefined`) without throwing.
- The service, with a **stubbed** `db` object, receives the email as a **value** in `where` and never as SQL text: assert with the same `collectValues`-style walker that `"` payloads appear only as leaf values.
- Non-scalar email values (array, `{ $ne: null }` object, number, boolean) are coerced or dropped — no operator smuggling.
- `verifyPassword` returns `false` (never throws) for plaintext / empty / garbage stored values.
- `authenticate()` returns the same failure shape for "no such user", "wrong password", and "no address row" — no reason field.
- The session-payload builder produces exactly the seven expected keys, with `uuid` equal to `ecdc.encryptUuid(plainUuid)` and **not** the plaintext.
- No `console.log` of the password: assert (via a stubbed `console`) that no logged argument contains the test password.

### Integration tests (live DB, skip gracefully when unavailable)

Follow the `t.diagnostic('DB unavailable, skipping: …')` pattern already used in `test/search-businesses.test.js:191-201`.

- **Normal case:** existing account + correct password → `{ message: 'found' }`, session set, `user_sessions` row created with a Manila-time `login_at`, `login_status = 1`.
- **Wrong password** and **unknown email** → identical message, identical status, no `user_sessions` row, no `login_status` change.
- **Boundary cases:** empty strings, whitespace-only, 10 000-char email, email with `'`, `"`, backtick, `;`, `--`, `#`, `%`, `_`, `\`, `<script>`, Unicode/emoji; case-variant emails (MySQL's default collation is case-insensitive — behaviour must be unchanged); leading/trailing spaces (behaviour must be unchanged: no trimming is added).
- **Invalid input:** missing both fields → `'Please enter Username and Password!'`; missing one field → the same message; a malformed body (e.g. `Content-Type: application/json` with a JSON array body) must not crash the process.
- **Security cases:** every payload in §11. For each: no SQL error surfaces to the client, no credentials in the response, the `users_accounts` table still exists afterwards, and the response message is one of the three contract messages.
- **Regression:**
  - `/logout` still clears `login_status` and writes `logout_at` (it reads the same session).
  - A logged-in page render works (e.g. `GET /profile` or `/selection`) — proves the session payload still decrypts.
  - `POST /api/get/users-account` and the visitor/trader endpoints that read `req.session.user.uuid` still work.
  - The nightly cron/analytics still parse `login_at` (run `app/services/analytics.service.js` against a known range, or at minimum assert the stored `login_at` parses as a Manila-local time).

### Manual verification (mandatory — there is no other way to prove this)

1. `npm run dev`.
2. `curl` a real login with real credentials → expect `{"message":"found"}`.
3. `curl` the injection payloads → expect the standard failure message, no SQL error, no 500.
4. Re-login and confirm `users_accounts` and `user_sessions` rows and the `Set-Cookie` session.
5. Load a protected page in the browser to confirm the session still works end to end.
6. Grep the console output of a full login cycle for the password/email → must be absent.

---

# 14. Verification / Evidence

"Fixed" is not an acceptable report. Provide:

- **The sink is gone:** a grep proving no template interpolation of request data remains in the login path, e.g. `grep -rn '\${' app/services/auth.service.js app/db_controllers/login.controller.js app/models/login.model.js` (the file should not exist) and `grep -rn "email_or_social_media" app | grep -v db_models`.
- **The old path is really gone:** `git status --porcelain` showing the two deleted files, and the grep from §5 step 9 proving nothing requires them.
- **The generated SQL:** paste the SQL Sequelize emits for the auth query (enable `logging: (sql) => …` **temporarily** on a throwaway connection, or use `sequelize.dialect.queryGenerator`), and show that the email appears as a **bound placeholder**, e.g. `WHERE email_or_social_media = ?` with the value in a separate bindings list. This is the single most convincing artefact for this task.
- **Runtime evidence:** the curl transcript from §13 for a normal login, a wrong password, and at least three injection payloads; plus the server log showing no credential output.
- **Session compatibility evidence:** log in, then use the session cookie on a protected page; also show `ecdc.decryptUuid(req.session.user.uuid)` returning the plaintext UUID — proving the crypto format did not change.
- **Timestamp evidence:** before/after `user_sessions.login_at` for the same account (Manila local, `YYYY-MM-DD HH:mm:ss`).
- **Test table:** pure + integration results, with skips explicitly reported as skips (not passes).
- **Sweep evidence:** the §11 table, completed, for every file — including the support-login twin, with an explicit statement of whether you fixed it or only reported it.
- **Final diff:** `git diff` (and `git diff --stat`) reviewed line by line. Confirm the only touched files are the ones in §6 with a `MODIFY`/`ADD`/`DELETE` action.
- **Lint:** `npm run lint` output (it rewrites files with Prettier — re-read anything Prettier changed).

---

# 15. Do NOT Do

- Do not change the URL, the request field names, the response messages, or the HTTP status codes of the login endpoint.
- Do not switch validation failures to HTTP 400 (Finding 22) without also updating `public/assets/js/login.js` — that is a separate task.
- Do not add rate limiting (Finding 7), an `isAuthenticated` middleware (Finding 6), Helmet/CSP (Finding 10), or a global error handler (Finding 32).
- Do not add Passport, or any new dependency. `bcrypt`, `crypto-js`, `sequelize`, `express-validator` are already installed — that is all you need.
- Do not change the UUID encryption algorithm or the session payload shape.
- Do not pass a JavaScript `Date` for `login_at`; keep the Manila-local string.
- Do not introduce tier (`type`) filtering into login.
- Do not normalize the email (no `trim`, no `toLowerCase`, no `normalizeEmail`).
- Do not fetch the `password` column in the profile query.
- Do not let the failure reason leak (no "user not found" vs "wrong password" distinction in the response).
- Do not keep the mysql2 model "just in case" while also adding the new path — that leaves the injection sink in the tree. One path, one implementation.
- Do not expand into the support-login, forgot-password, registration, or search code paths beyond the scoped sibling in §11.
- Do not change the database schema, do not run `sequelize.sync({ alter: true })`, do not touch migrations.
- Do not modify `.env`, any secret, or `app/config/*`.
- Do not modify `public/assets/js/login.js`, any `.ejs` view, or any CSS/asset (no `tailwindBuild` / `webpackBuild` needed).
- Do not log credentials, bodies, hashes, plaintext UUIDs, or the session object.
- Do not swallow errors with an empty `catch`; log them server-side and return a generic message.
- Do not change `package.json` scripts to make `npm test` pass; invoke `node --test test/login.test.js`.
- Do not delete a file you have not proven unused with a grep in this session.
- Do not commit, push, or amend unless the task owner explicitly asks.

---

# 16. Acceptance Criteria

## Acceptance Criteria

- [ ] Both injection sites are gone; **no** user-supplied value is ever concatenated into SQL in the login path (verified by grep + by showing the generated SQL uses a bound placeholder).
- [ ] The email reaches the data layer only as a bound value (`where: { email_or_social_media: email }` or `replacements`/`?`), including on the profile/join lookup.
- [ ] Authentication runs on the **Sequelize stack** through a service + thin controller that follow the patterns of `app/services/business-search.service.js` and `app/db_controllers/search-businesses.controller.js`.
- [ ] The service contains no `req`, no `res`, no `session`, and no `console.log` of credentials; it is unit-testable with an injected `db` (Finding 36/40 addressed for this file).
- [ ] The controller owns `req.session.user` and produces the exact session payload (same seven keys, same CryptoJS-AES ciphertext UUID).
- [ ] `POST /api/post/login-process` contract is unchanged: same URL, same fields, same three messages, 200 on validation failure, 200 on bad credentials, 500 (generic message) on unexpected error.
- [ ] `login_status = 1` and the `user_sessions` row are still written on success, with `login_at` as a Manila-local `YYYY-MM-DD HH:mm:ss` string and `user_id` as the plaintext UUID.
- [ ] No password, hash, email, body, or session object is written to the console on any login path.
- [ ] The `res[0]`-before-`length` crash path is fixed, and the address-row-missing case has an explicit, tested, documented decision.
- [ ] `app/models/login.model.js` and `app/controllers/login.controller.js` are deleted (after a grep proved them unused) or, if a consumer was found, converted into thin delegating shims with the injection removed — either way stated in the report.
- [ ] Dead code that lived in the deleted files (`ec()`, the commented query, the duplicate empty export, the unused `check` import) is gone with them.
- [ ] `test/login.test.js` exists, runs with `node --test`, and covers: query-structure (payload stays data), mapper whitelist, uniform failure shape, session-payload keys, plus live integration cases with injection payloads.
- [ ] Regression proven: a real browser/curl login works, a protected page loads with the session, `/logout` still works, analytics still parse `login_at`.
- [ ] The §11 sweep is complete and reported, with the support-login twin explicitly addressed or explicitly escalated.
- [ ] `npm run lint` was run and any reformatting reviewed.
- [ ] No unrelated file was modified; `git diff` was reviewed.
- [ ] Remaining risks and open questions are documented (not silently decided).

---

# 17. Expected Final Report

Finish with this structure:

```markdown
# Implementation Report

## Summary

What was implemented, in 3–6 sentences. State plainly whether the injection sink is closed and
whether an incident response (secret rotation, log scrubbing) is recommended for previously
leaked credentials.

## Files Modified

| File | Changes |
| --- | ------- |
| `...` | ... |

## Files Added

| File | Purpose |
| --- | ------- |
| `...` | ... |

## Files Deleted

| File | Reason |
| --- | ------ |
| `...` | ... |

## Files Referenced Only

| File | Why |
| --- | --- |
| `...` | ... |

## Implementation Details

- The chosen data-access strategy (§5 step 6 option A / B / C) and why.
- The final auth query / generated SQL, with the bound value shown separately.
- Session construction and the crypto compatibility argument.
- `login_at` handling and the Manila-time guarantee.
- The address-row decision (INNER vs LEFT) and the reasoning.
- Anything you chose to do differently from this document, with justification.

## Testing

| Test | Result |
| --- | ------ |
| Pure: mapper + query structure | PASS/FAIL/SKIP |
| Normal login (live DB) | PASS/FAIL/SKIP |
| Wrong password / unknown user | PASS/FAIL/SKIP |
| Boundary inputs | PASS/FAIL/SKIP |
| Security payloads (§11) | PASS/FAIL/SKIP |
| Regression: logout, protected page, analytics | PASS/FAIL/SKIP |

## Verification

The artefacts: greps, generated SQL, curl transcript, before/after `login_at`,
session-cookie round trip, `git diff` review.

## Similar-Vulnerability Sweep

The completed §11 table: file, line, attacker-controllable?, validation in front?, route, action taken.

## Remaining Risks

- Anything unverified, deferred to other findings, or dependent on production data.

## Final Status

PASS / NEEDS REVIEW
```

---

# 18. Important Rules for Applying to This Task

### Rule 1 — Do not hallucinate

Every file path, line number, column name, route, and code sample in this document was read from
the repository. Where a fact could not be verified without a running database (e.g. the physical
table name behind `db.users_address`), it is marked **TO INVESTIGATE** with the exact command to
run. If your investigation contradicts anything here, **trust the repository and say so in the
report** — do not silently "fix" the document's assumptions.

### Rule 2 — Separate facts from recommendations

- `CURRENT IMPLEMENTATION` = the code quoted in §7 (verified in-tree).
- `RECOMMENDED` = the Sequelize service/controller split in §8–§9.
- The CODE_REVIEW finding text is a snapshot; the verified state (including the accidental
  `escape()` mitigation in §3) is what the code actually does today. Present both, and do not
  present the accidental mitigation as a security control.

### Rule 3 — Prefer project consistency

Service + thin controller + `node --test` file + barrel entry + Manila-time util + `ecdc` crypto,
all copied from code that already exists in this repository. No new libraries, no new folders, no
new conventions.

### Rule 4 — Preserve behavior

The client reads `res.message` and nothing else, has no `error:` handler, and depends on a 2xx
response for every failure. Status codes, messages, session shape, and timestamp format are part
of the contract.

### Rule 5 — Think about the entire code path

Input → route → middleware → controller → model/service → database → session → response → client
→ logout → analytics. The fix must hold at every hop, and the regression list must cover both
directions (login writes what logout and the cron read).

### Rule 6 — Make the task executable

WHAT: close the sink and move auth to Sequelize. WHERE: §6. WHY: §3. HOW: §9. WHAT NOT: §15.
TEST: §13. VERIFY: §14. ACCEPT: §16. REPORT: §17.

---

# 19. Authentication Data-Flow Primer (Mentoring Reference)

> **What this section is:** §§1–18 are the *what*. This section is the *why*, and it is different from the §19 primer in `001-fix-sql-injection-search.md`: search is a **read** path, login is a **gate**. The same layers apply, but here the failure modes are authentication bypass, credential theft, user enumeration, and lockout of your own users. Read it once, then keep §19.9 (checklist) and §19.10 (golden rules) as day-to-day references.

---

## 19.0 Why authentication is not just search with a `WHERE` clause

```text
SELECT … WHERE name LIKE ?      // search: reveal the right rows to whoever asked
SELECT … WHERE email = ?        // login:  decide who is allowed in
```

Both are parameterized queries. Only one of them is a **security boundary**. In search, a mistake
returns the wrong rows. In login, a mistake hands over the keys to the building.

Four properties make authentication a different discipline:

1. **It is a decision, not a lookup.** The correct answer is *no* for the overwhelming majority of requests. Most code that handles logins is executed by attackers, not users.
2. **Its inputs are secret.** Passwords and hashes must never be logged, echoed, returned, or stored in the clear. Every other endpoint's inputs are public data.
3. **Its failure modes are asymmetric.** A false *accept* is a breach. A false *reject* is a support ticket. The system is optimized for attackers, so you must optimize for the rare legitimate user.
4. **It is a state machine, not a function.** Login creates a session, flips `login_status`, writes an audit row, and then every later request depends on that state being coherent (including on logout, and on the nightly cron that reads it).

---

## 19.1 Trace one real login byte-by-byte (this repo, end to end)

The user types `user@example.com` / `Pa55word!` and presses **Log In**.

| #   | Step                                  | Where                                                                        | What crosses this hop                                                            |
| --- | ------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | Browser holds the credentials          | `public/view/login/index.ejs:58,73` (desktop) / `:94,105` (mobile variant)    | keystrokes → two inputs named `loginEmailAddress`, `loginPassword`               |
| 2   | jQuery serializes and posts            | `public/assets/js/login.js:7-10`                                            | form → `application/x-www-form-urlencoded` body                                   |
| 3   | Express matches the route             | `app/routes/index.js:94`                                                    | HTTP → `middleware.login_process` → `login.create`                                 |
| 4   | Validation chain mutates the value    | `app/middleware/validations/login_process.validations.js`                   | `escape()` rewrites the email **in place** (`"`→`&quot;`); `isEmail()` judges it   |
| 5   | Controller reads validation results   | `app/controllers/login.controller.js:11-25`                                | `validationResult(req)` → 200 + `{ message: errors.array() }`, or continue         |
| 6   | Controller maps HTTP → app input      | `app/controllers/login.controller.js:37-41`                                | `req.body` → `{ email_or_social_media, password, session }`                         |
| 7   | Model runs Q1 (email → hash)          | `app/models/login.model.js:40`                                             | email spliced into SQL text ← **the injection**                                    |
| 8   | Password verification                  | `app/models/login.model.js:51`                                             | `bcrypt.compareSync(plain, hash)` → boolean                                          |
| 9   | Model runs Q2 (profile join)           | `app/models/login.model.js:54-69`                                          | email spliced again ← **the second injection**                                     |
| 10  | UUID encrypted for the session         | `app/models/login.model.js:78`                                             | plaintext UUID → CryptoJS AES ciphertext keyed with `JWT_SECRET`                    |
| 11  | Audit writes (fire-and-forget)          | `app/models/login.model.js:91-116`                                         | `user_sessions` INSERT, `users_accounts.login_status = 1` UPDATE                    |
| 12  | Session assigned by the *model*         | `app/models/login.model.js:118`                                            | `req.session.user = {…}` (the model owns the web layer's state)                     |
| 13  | Response                               | `login.model.js:119` → `login.controller.js:49` → `login.js:12-19`          | `{ message: 'found' }` → `window.location.replace('/selection')`                     |
| 14  | Every later request                    | `app/src/server.js` page routes, `app.get('/logout')`                       | `ecdc.decryptUuid(req.session.user.uuid)` → plaintext UUID                          |
| 15  | Nightly cron reads what login wrote    | `app/email_controllers/cron-email.controller.js` (registered `server.js:163`) | `user_sessions.login_at` (Manila string) aggregated into the daily report        |

Rows 7 and 9 are the bug. Rows 12, 14 and 15 are why rows 7/9 must be fixed **without** changing
anything about rows 10, 13, 14 or 15.

---

## 19.2 Why each layer exists, and what it must never do here

### 19.2.1 Frontend UI

- **Responsibility:** collect the two credentials; nothing else.
- **Validation:** `type="email"`, `required` — UX only.
- **Must never:** decide whether a credential is correct, or pre-hash the password "to be safe" (that is how a public bcrypt oracle came to exist here — Finding 5 — and it moves a security decision to an attacker-owned runtime).
- **Golden rule:** a login form is a door, not a vault.

### 19.2.2 Client JavaScript

- **Responsibility:** serialize, post, interpret the outcome.
- **Contract it depends on (frozen in this task):** `res.message === 'found'` → redirect; anything else → `Swal.fire('Error', res.message)`. There is **no `error:` callback**, which is why the endpoint must keep answering failures with HTTP 200 (§12).
- **Security value:** zero. `curl` bypasses it entirely — which is how you test this fix.
- **Golden rule:** the client is the intercom, not the bouncer.

### 19.2.3 HTTP / wire

- **First trust boundary.** `express.urlencoded()` produces `req.body`; body-parser caps size (default 100 kb); `Content-Type` determines parsing.
- **Must never:** be believed. `loginEmailAddress` can equally be `" OR 1=1 #`, an array, or an object.
- **Golden rule:** assume hostile until a layer below signs off.

### 19.2.4 Route

- **This one route is the only API route in the app with middleware** (`app/routes/index.js:94`). The role of a route here is to name the handler *and* to be the place where rate limiting (Finding 7) and lockout (Finding 20.4) will eventually attach.
- **Must never:** contain SQL or password logic.
- **Golden rule:** routes direct traffic; they never inspect cargo.

### 19.2.5 Validation middleware

- **Responsibility:** shape and presence. Today: `isEmail()` on the identifier, nothing on the password.
- **The trap in this repo, worth understanding:** `escape()` is an **HTML** sanitizer. It happens to strip the `"` that this SQL needed, which is why the injection looks "not exploitable" today. Reaching for a sanitizer to protect SQL is the same category of mistake as reaching for a WAF to protect authorization: it protects the *shape* of a string, not the *semantics* of a command.
- **Must never:** be relied upon as the injection defence. The defence is at the query boundary.
- **Golden rule:** validation decides what may exist; parameterization decides what is safe.

### 19.2.6 Controller

- **Responsibility:** HTTP only — read the validated request, ask the service, set the session, choose the response.
- **Today it is almost that** — except it constructs a "model" that carries `req.session`, so the HTTP layer leaks into the data layer.
- **Must never:** build SQL, hash, or decide *why* authentication failed.
- **Golden rule:** thin controller, and the session is the controller's job, not the model's.

### 19.2.7 Service (the new `auth.service.js`)

- **Responsibility:** the use case. Find the account, verify the password, fetch the profile, record the login — and return a **single failure shape**.
- **Security decisions that belong here and nowhere else:** which failure reasons are distinguishable internally, and which are collapsed before leaving the process.
- **Must never:** touch `req`/`res`/`session`, log secrets, or accept a raw request object (accept a DTO: `{ email, password }`).
- **Golden rule:** the service speaks domain; it never speaks HTTP, and it never speaks SQL syntax.

### 19.2.8 Model / repository (the Sequelize layer)

- **Responsibility:** the single choke point that owns SQL. `where: { email_or_social_media: email }` — the email becomes a binding, and no parser ever sees it.
- **Why it lives here and not in the service:** because the service could be refactored. The repository is the layer whose *only* job is to turn structured data into a safe query; safety that depends on every caller behaving is not safety.
- **Must never:** accept a pre-formatted SQL fragment, an identifier, or an operator from a caller.
- **Golden rule:** the last line of defence between a string and the engine — never break rank.

### 19.2.9 Database

- **Responsibility:** store the truth, enforce it, and — this is the part people forget — **treat a bound value as data no matter what it contains**.
- **Enforcement available today:** `UNIQUE` on `email_or_social_media`, so the first account to claim an email owns it.
- **Missing (and relevant to auth):** account lockout, failed-attempt counters, password-expiry/strength constraints. Adding them is schema work; out of scope, but this is the layer where they belong eventually.
- **Golden rule:** the database is the judge, not the negotiator.

### 19.2.10 The response

- **Responsibility:** say the same thing for every failure. This repo already does that for "no such user" and "wrong password" (`{ message: 'Please check your email address and password' }`) — **preserve it**; it is user-enumeration defence, and it is easy to lose during a refactor by "improving" the error messages.
- **Must never:** leak `err.message`, SQL, stack traces, or which of the four failure branches fired.
- **Golden rule:** a failed login says "no", and says it the same way every time.

---

## 19.3 The three things that are confused in every login bug

| Concept                            | Question it answers                                    | Where it belongs here                                                                   |
| ---------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| **Validation**                     | "Is this shaped like a credential field should be?"     | Middleware (shape, presence, length)                                                     |
| **Sanitization / escaping**        | "Should this string look different in a *different* context?" (HTML vs SQL vs shell) | Only at a context change. `escape()` here is HTML-flavoured; it is **not** the SQL defence |
| **Injection protection**           | "Can this value escape data into command?"              | The query layer. Always. Parameterization, full stop                                     |

**The canonical mistake:** a developer tests a payload, sees it come back as `&quot;`, concludes
"the input is sanitized", and removes the sanitizer. Between the two commits, nothing looked
broken — the fix was never real, only decorative. The professional test for whether a defence is
real: *can you delete it without breaking anything?* If yes, it was not a defence.

**How to test the real thing:** the value must survive to the driver as a binding, with the SQL
text fixed by your code. Prove it by logging the generated SQL and the bindings list separately
(§14). A string that "looks escaped" proves nothing.

---

## 19.4 The 14 terms every engineer must be able to defend

1. **Client-side validation** — instant feedback only; zero security value.
2. **Server-side validation** — the authority on shape. Here: `loginEmailAddress` is validated; **`loginPassword` is not validated at all** (add a presence/length check; do not invent a complexity rule that would lock out existing users without a migration plan).
3. **Sanitization** — changing a value for a destination context. `escape()` = HTML context. Not a SQL control.
4. **Normalization** — making equivalent values identical (`trim`, lowercase). **Do not add it here:** MySQL's default collation already matches case-insensitively, and `normalizeEmail()` was deliberately removed from this chain.
5. **Authentication** — *who are you?* `req.session.user`, established here, read everywhere else.
6. **Authorization** — *may you do this?* **Absent from the API layer** (Finding 6). Not this task; know that fixing auth does not add authorization.
7. **SQL-injection protection** — preventing data from becoming command. This task's subject.
8. **Parameterized queries** — the mechanism: template fixed by you, values bound by the driver. Sequelize `where`/`Op`, mysql2 `?`, `sequelize.query` `replacements`.
9. **Business-rule validation** — "this account may log in" (`status = 1`), "this user exists". Belongs in the service, after the lookup.
10. **Output encoding** — escaping when data moves into a new render context. The login response is JSON, so a payload stays inert here; the same values are *not* inert when a business name is written into `innerHTML` on the search page (Finding-1 follow-up, §19.2.10 of the 001 primer).
11. **Rate limiting / lockout** — the brake on brute force. **Not present** (Finding 7). Note that fixing the injection does not slow down guessing: an attacker can still try a million passwords a minute against a correct `WHERE email = ?`.
12. **Error handling** — classify, log safely, answer generically. Today's `err.message`-to-client (line 46) is the anti-pattern; §9 step 6 fixes it.
13. **Logging** — record *outcome*, never *secret*. `console.log('model', model)` (line 7) prints the submitted password: treat any log line that ever did this as a credential-leak incident, and scrub/rotate accordingly.
14. **Database constraints** — `UNIQUE(email_or_social_media)`, `NOT NULL password`, `VARCHAR(255)` bounds. The last line of integrity defence; no FKs here, and no lockout counters.

---

## 19.5 Trust boundaries for the login path

```text
Browser form .............. UNTRUSTED  (and the app must behave as if anyone can POST /api/post/login-process)
        │
HTTP body ................. UNTRUSTED  (first boundary; body-parser size cap applies)
        │
Validation chain .......... PARTIALLY TRUSTED  (proves shape; proves nothing about safety)
        │
Controller DTO ............ shape-checked
        │
Service input ............. `{ email, password }` scalars, no objects, no operators
        │
Repository parameters ..... BOUND  (values only; the email cannot become grammar)
        │
Database ................. unique/not-null truth; bound value treated as data
```

Three rules specific to this path:

- **The password is untrusted input, not a secret you may keep.** It must be compared and discarded. Never stored raw, never logged, never returned.
- **The stored hash is trusted data, but the comparison result is a security decision.** `bcrypt.compare` is deliberately slow and constant-work; a fast "compare the strings" path (or an early `length` check that skips the compare) reintroduces timing leakage.
- **The session is the crown jewel.** `req.session.user.uuid` is ciphertext, but the session cookie is signed with `SESSION_SECRET` (Finding 8: currently a weak default). Fixing the injection does not fix a forgeable session — that is a separate rotation task.

---

## 19.6 Layer responsibilities for *this* feature (target)

| Layer                            | Owns                                                                          | Must never contain                    |
| -------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------- |
| `app/routes/index.js`            | path → `middleware.login_process` → `login.create`                            | SQL, password handling                |
| `app/middleware/validations/`    | shape/presence rules for the two fields                                       | SQL, crypto, session                  |
| `app/db_controllers/login.controller.js` | HTTP in/out, `validationResult`, session assignment, response shape   | SQL, bcrypt, raw DB errors to client  |
| `app/services/auth.service.js`   | the login use case; uniform failure; audit writes; `Op`/query construction   | `req`, `res`, `session`, logging secrets |
| `app/db_models/*.model.js`       | table/column mapping, associations (`constraints: false`)                     | request logic, validation             |
| `app/shared/ecdc.js`             | `encryptUuid` / `decryptUuid` (CryptoJS AES + `JWT_SECRET`)                   | anything outside crypto                |
| `app/utils/date.utils.js`        | `getPhDateTimeString` (Asia/Manila) — the login audit timestamp              | DB access                             |

---

## 19.7 Glossary for this path

| Term                        | Meaning here                                                                                       | In THIS repo                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Credential**              | The pair the user presents (`loginEmailAddress` + `loginPassword`)                                   | `req.body`                                            |
| **Identifier**              | The account lookup key — misleadingly named "email", actually `email_or_social_media`                 | `users_accounts.email_or_social_media`                |
| **Hash**                    | bcrypt output stored in `users_accounts.password`                                                   | bcrypt, 12 rounds elsewhere                            |
| **DTO**                     | `{ email, password }` — the only thing the controller hands inward                                  | `mapLoginCredentials(req.body)`                       |
| **Model (Sequelize)**       | Class bound to a table                                                                              | `db.users_accounts`, `db.users`, `db.users_address`   |
| **Entity**                  | One row                                                                                             | the found account                                     |
| **Service**                 | The login use case                                                                                   | `AuthService`                                         |
| **Session**                 | Server-side state keyed by a signed cookie                                                          | `req.session.user`                                    |
| **Audit row**               | The `user_sessions` insert; also read by the nightly report and by logout                           | `user_sessions.login_at` / `logout_at`                |
| **Uniform failure**         | One message for every rejection reason                                                              | `'Please check your email address and password'`      |
| **Lockout / rate limit**    | The brake on repeated attempts — **absent** (Finding 7)                                             | not implemented                                      |

---

## 19.8 What actually happens to tricky inputs (decision exercise)

| Input                                            | Verdict                                                        | Why                                                                                     | Where the control must live                                    |
| ------------------------------------------------ | -------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `user@example.com`                               | Normal data                                                    | Shape already guaranteed by `isEmail()`; nothing else to do                             | none needed; `where: { email_or_social_media: email }`          |
| `User@Example.com`                               | Normal data, **no normalization**                              | MySQL's default collation is case-insensitive; lowercasing would change nothing and risks changing something | none; do not add `toLowerCase()`                              |
| `""` (empty)                                     | Reject at the door                                             | Empty is not a credential                                                              | middleware (exists today)                                       |
| `x" OR "1"="1`                                   | Normal data from the wire; the SQL never changes               | With a bound value the parser cannot see it as syntax                                    | repository — **not** `escape()`                                 |
| `x"; DROP TABLE users_accounts; --`              | Normal data                                                    | Same; and the DB user's privileges are the last line                                     | repository + least-privilege DB user (never granted)             |
| `{"$ne": null}` (JSON body)                      | **Drop or reject**                                             | Operator smuggling: a non-scalar must never reach a `where`                              | service (mirror `toScalar`, `business-search.service.js:43-47`) |
| `loginEmailAddress[]=a` (array)                  | **Reject**                                                     | Wrong shape; `bcrypt.compare` never runs against an array                                | middleware / service coercion                                  |
| 10 000-character email                           | Reject or cap                                                  | No legitimate use; keeps DB work bounded                                                 | middleware (`.isLength({ max: … })`)                            |
| `Pa55word!`                                      | **Never** logged, echoed, or stored raw                        | Secrets are write-once, read-now                                                          | service (no `console.log`), controller (no body logging)         |
| A 10k-character password against a real account  | Normal data — but **rate limited**                             | Injection fixed ≠ brute force fixed                                                       | **Missing** (Finding 7) — document, do not silently add         |

---

## 19.9 Authentication Data-Flow Checklist

Fill the Answer column before you write the query.

| #   | Check                                                       | Where to look                                                       | Answer |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------- | ------ |
| 1   | Where does the identifier come from?                        | `req.body.loginEmailAddress` (post-`escape()`)                        |        |
| 2   | Is the password validated (presence/length)?                | `login_process.validations.js` — today: **no**                      |        |
| 3   | Is the identifier bound, or interpolated?                   | `where: { email_or_social_media: email }` vs `` `… = "${email}"` ``   |        |
| 4   | Can any identifier (table/column/operator) come from input? | repository only                                                     |        |
| 5   | Is the password verified with a slow, constant-work KDF?    | `bcrypt.compare`, not string compare                                 |        |
| 6   | Does a non-bcrypt stored value crash the compare?           | verified today: no (`false`); keep it that way                        |        |
| 7   | Is every failure reason collapsed to one response?          | controller: one message for all branches                              |        |
| 8   | Are errors logged without secrets, and never returned raw?  | `err.message` to client today → fix                                   |        |
| 9   | Is the session payload shape unchanged?                     | 7 keys, `uuid` ciphertext                                            |        |
| 10  | Is the session crypto format unchanged?                     | CryptoJS AES + `JWT_SECRET`, byte-compatible                          |        |
| 11  | Is the audit timestamp written in the same format/timezone? | `getPhDateTimeString` (Asia/Manila) string                            |        |
| 12  | Is `login_status` set the same way?                         | `= 1` on login; logout sets `null` — keep the asymmetry               |        |
| 13  | Is there a rate limit / lockout on this endpoint?           | **No** (Finding 7) — report                                          |        |
| 14  | Can the request be forged with `curl`?                      | Yes — always test with `curl`                                        |        |
| 15  | Does the client still work if the status changes?           | No `error:` handler in `login.js` → status must stay 200 (§12)        |        |
| 16  | What happens when the DB is down?                          | 500 + generic message; session not created                            |        |
| 17  | What happens on an account with no address row?            | Decide INNER vs LEFT; test it (§12)                                   |        |
| 18  | Does anything else read what login wrote?                  | logout, page routes, `user_sessions` analytics, cron                  |        |

---

## 19.10 Golden rule per layer (memorize this table)

| Layer                    | Golden rule                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------ |
| Login form               | A door, not a vault; it collects, it never judges                                     |
| Client JS                | The intercom, not the bouncer; no `error:` handler means status codes are contract    |
| Wire                     | Assume hostile; every login attempt is a potential attack until proven otherwise      |
| Route                    | Directs traffic; the place where lockout/rate limiting will eventually attach         |
| Validation middleware    | Rejects malformed shapes; **never** the injection defence                             |
| Controller               | Thin; owns `req.session`; sends one generic failure                                    |
| Service                  | The brain; one failure shape; no `req`/`res`, no secret logging                       |
| Model / repository       | The last line of defence: every value binds, nothing interpolates, no `password` in `attributes` |
| Database                 | Judge; `UNIQUE`/`NOT NULL`; bound values are data                                     |
| Errors & logs            | Tell the client "no"; tell yourself why — and never the password                      |
| Session                  | Treat it as a key: same shape, same crypto, rotate the signing secret (Finding 8)     |

---

## 19.11 Current repo state vs the ideal (honest gap list for this path)

**Already true / must be preserved:**

- [x] Passwords are stored as bcrypt hashes (12 rounds) for accounts created through the normal flows.
- [x] The failure response is already uniform (`'Please check your email address and password'` for both unknown user and wrong password) — do not regress this.
- [x] `login_status` and `user_sessions` are written on success and cleared on logout.
- [x] Public identifiers are UUIDs, not sequential IDs.
- [x] Session UUIDs are encrypted at rest in the session store.

**Open — do NOT claim "login is secure" after this task:**

- [ ] The injection sink (this task) — being closed at the repository layer.
- [ ] **No rate limiting and no lockout** (Finding 7) — brute force is unmitigated; the `WHERE` clause being safe does nothing about volume.
- [ ] `loginPassword` has no validation (presence/length) — an empty password is only rejected by the controller's `if`, and the semantics deserve an explicit rule.
- [ ] Credentials in logs today (`login.model.js:7`, `:39`, `login.controller.js:34`) — closing the code path does not un-leak the log files already written; scrubbing and a credential-rotation conversation are operational follow-ups.
- [ ] `status` (`0=pending, 1=verified, 2=disabled`) is **not** checked at login — a `status = 2` (disabled) account can still log in with correct credentials. That is a real authorization gap; out of scope here, report it.
- [ ] No CSRF protection on `POST /api/post/login-process` (session cookie is `sameSite: 'strict'`, which mitigates but does not replace it).
- [ ] `SESSION_SECRET` / `JWT_SECRET` are weak defaults (Finding 8) — with a forgeable session secret, an injection fix is necessary but not sufficient.
- [ ] Plaintext password storage on password reset (Finding 3) means some accounts' "hashes" are not hashes; the login path must keep tolerating that (it does — `compare` returns `false`).
- [ ] The public bcrypt oracle still exists (Finding 5) — it hands an attacker an offline cracking service for any hash they can obtain.
- [ ] The support-agent login (`/api/post/help-and-support-login-process`) has the same injection bug **and no validation middleware** — see §11.
