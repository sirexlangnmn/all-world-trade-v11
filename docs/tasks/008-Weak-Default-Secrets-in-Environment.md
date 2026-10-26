# AI Task: Replace Weak/Default Environment Secrets and Enforce Secure Secrets at Startup

> **Finding:** `CODE_REVIEW.md` — Finding 8: Weak/Default Secrets in Environment
> **Task file:** `docs/tasks/008-Weak-Default-Secrets-in-Environment.md`
> **Severity:** Not assigned a numeric severity in `CODE_REVIEW.md`. The roadmap places environment/secrets work in the high-priority security group.
> **Related tasks / boundaries:**
>
> - Finding 9 / `docs/tasks/` (Exposed Credentials in `.env`) covers rotating credentials, removing `.env` from git history, and creating `.env.example`. This task covers the **three application secrets**, the code that consumes them, and a **startup guard** against known-default values.
> - Finding 4 / `docs/tasks/004-Password-Embedded-in-JWT-Reset-Token.md` already removed password data from reset tokens. Do not re-open that work here.
> - Do not duplicate or replace Findings 6 (auth middleware), 7 (rate limiting), 10 (Helmet/CSP), 29 (`saveUninitialized`), or 30 (cookie lifetime). Those are separate tasks.
>
> **Operational warning:** Rotating `SESSION_SECRET` and `JWT_SECRET` intentionally invalidates existing sessions. Rotating `API_KEY_SECRET` may affect the external MiroTalk deployment. Read §12 and §9 Step 5 before changing anything.

## 1. Task Title

**Rotate the weak default `API_KEY_SECRET`, `SESSION_SECRET`, and `JWT_SECRET`, stop logging the API key, and fail fast at startup if any application secret is missing, known-default, placeholder-like, or too short — without changing encryption formats, session cookie behavior, API contracts, or database schema.**

## 2. Objective

Replace the predictable secret values currently used by the application with cryptographically random values managed through the environment, and add a startup guard so the application cannot silently run with the known defaults again.

The expected outcome is:

1. `API_KEY_SECRET`, `SESSION_SECRET`, and `JWT_SECRET` are generated with a cryptographically secure random source and set in the hosting environment (and in the operator's local `.env` for development).
2. The application refuses to start when any of those variables is missing, empty, a known default, placeholder-like, or shorter than the minimum configured length.
3. Startup logs never contain a secret value.
4. Existing functionality still works for legitimate users after the expected one-time session sign-out caused by rotation.
5. No encryption algorithm, cookie attribute, database column, API response shape, or unrelated security control is changed.
6. The implementing agent produces evidence that the weak values are no longer accepted and that unrelated behavior was preserved.

The implementing agent must first verify the current repository state. The line numbers and code snippets below were accurate when this guide was prepared, but the live worktree is authoritative.

## 3. Problem / Finding

### Finding as reported

`CODE_REVIEW.md` Finding 8 reports that `.env` contains predictable, low-entropy defaults:

```env
API_KEY_SECRET=all_world_trade_default_secret
SESSION_SECRET=all_world_trade_secret_random_string
JWT_SECRET=all_world_trade_jwt_super_secret
```

The finding explains:

- `JWT_SECRET` is used as the AES passphrase for user UUIDs stored in sessions. If it is known, session UUIDs can be decrypted or forged, so an attacker could construct an authenticated-looking session payload.
- `SESSION_SECRET` signs session cookies. A weak secret enables cookie forgery/session hijacking.
- `API_KEY_SECRET` is intended for the external MiroTalk meeting API. A known value undermines that integration if it is used outside this repository.

The recommended approach in `CODE_REVIEW.md` is to generate secrets with `crypto.randomBytes`, store them in environment variables managed by the hosting platform, keep `.env` untracked, rotate existing secrets, and reject known defaults at startup.

### Current repository state — verify before acting

At the time this guide was prepared:

- `.env` exists in the working tree at repository root but is **not tracked by git** (`git ls-files .env` returns nothing).
- `.gitignore` contains `.env` (line 18), so the file is already ignored.
- The weak values currently appear on `.env` lines **11 (`API_KEY_SECRET`), 12 (`SESSION_SECRET`), and 14 (`JWT_SECRET`)**. The line numbers in `CODE_REVIEW.md` (“lines 10-12”) are stale; always search by variable name.
- `.env` currently sets `NODE_ENV=nonprod`. Do not rely on `NODE_ENV` to decide whether secret validation is enforced. The defaults are publicly known regardless of environment.
- No `.env.example` exists at repository root.
- No secrets validator currently exists (`grep -R "validateSecrets|secrets.config|KNOWN_INSECURE" app test` returns nothing).
- `dotenv` is loaded at `app/src/server.js:34` before any application route/model module is required.
- `SESSION_SECRET` is consumed by `express-session` at `app/src/server.js:86-95`.
- `JWT_SECRET` is consumed by many legacy models/controllers and `app/shared/ecdc.js` as a **CryptoJS AES passphrase** for session UUIDs. It is **not** used by `jsonwebtoken` in the current application code, despite the dependency being installed and `README.md` §14.2 describing it as a JWT signing secret. Reset tokens are UUID v4 values stored in the `reset_tokens` table, not JWTs.
- `API_KEY_SECRET` is read at `app/src/server.js:165` and only used in the startup debug log at `app/src/server.js:1492-1495`. No outbound HTTP call to MiroTalk was found in `app/` or `public/`.
- `Logger.debug` prints unconditionally by default (`app/src/Logger.js` has `debugOn = true`), so the current startup log writes the API key secret to the console/log stream in every environment.

The agent must re-run these checks on the live worktree. Do not assume the finding is already fixed or that the exact values above are still the only weak values.

### Why this is unsafe

- Anyone with repository access or a leaked `.env` can read the current values. The defaults are also documented in `CODE_REVIEW.md`, so they must be treated as public.
- A known `SESSION_SECRET` lets an attacker sign a cookie that `express-session` will trust, potentially impersonating another user if they can also supply/derive the session payload.
- A known `JWT_SECRET` lets an attacker decrypt session UUID ciphertext produced by `CryptoJS.AES.encrypt(uuid, JWT_SECRET)`, and lets them generate ciphertext for an arbitrary UUID if they can get it into a session. The app decrypts `req.session.user.uuid` with this key in many places.
- Logging `API_KEY_SECRET` at startup defeats the purpose of keeping it secret and may expose it to log aggregation, terminals, screenshots, or support bundles.
- A startup guard is necessary because rotating values once is not enough. Without enforcement, a future deployment, local branch, or container can silently restore the known defaults.

### Scope boundary

This task is about **application secrets** and **startup enforcement**. It does not authorize:

- Editing or deleting the production `.env` file from the coding agent.
- Rotating DB/SMTP/notification credentials (Finding 9).
- Removing `.env` from git history (Finding 9; the file is currently untracked).
- Changing the AES/CryptoJS format, session cookie attributes, `saveUninitialized`, cookie lifetime, auth middleware, rate limiting, CORS, or Helmet.
- Adding a new secrets-management dependency.

## 4. Affected Functionality

### Secrets and their consumers

| Secret           | Current consumers                                                                                                                                                                                                                                                             | Business effect of rotation                                                                                                                                                                                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SESSION_SECRET` | `express-session` in `app/src/server.js`                                                                                                                                                                                                                                      | Existing session cookies become invalid. All users are signed out once. They can log in again normally.                                                                                                                                                                                            |
| `JWT_SECRET`     | `app/shared/ecdc.js`, many `app/models/*.js`, `app/db_controllers/*.js`, `app/routes/upload-file.js`, `app/routes/email-marketing.js`, `app/routes/encrypt.route.js`, `app/db_controllers/registration_v2.controller.js` — all as a CryptoJS AES passphrase for session UUIDs | Existing session UUID ciphertext cannot be decrypted. Users with old sessions must log in again. Database UUID columns store **plaintext** UUIDs (verified in `registration_v2.controller.js`), so no database rows become unreadable. Reset tokens are stored as UUID v4 rows and are unaffected. |
| `API_KEY_SECRET` | `app/src/server.js:165`, logged at `app/src/server.js:1494`; documented in `app/api/swagger.yaml` and `README.md`                                                                                                                                                             | In this repository, removing the log leaves no runtime consumer. The external MiroTalk service may be configured with the same value. Treat rotation as an integration change and investigate before deploying.                                                                                    |

### Request/boot flow

```text
Process start
   ↓
require('dotenv').config()            app/src/server.js:34
   ↓
[ NEW ] validateSecrets()             fail fast here
   ↓
require app modules                   env values are now trusted
   ↓
create express-session                uses SESSION_SECRET
   ↓
create HTTP/HTTPS + Socket.IO server
   ↓
require route modules                 models capture JWT_SECRET at load time
   ↓
listen(port)
   ↓
[ CURRENT ] startup log prints api_key_secret
```

The session/UUID path after boot:

```text
Login / registration
   ↓
CryptoJS.AES.encrypt(uuid, JWT_SECRET)
   ↓
req.session.user.uuid
   ↓
Request handler
   ↓
CryptoJS.AES.decrypt(session uuid, JWT_SECRET) or ecdc.decryptUuid(...)
   ↓
plaintext UUID used in database queries
```

The startup guard must run after `dotenv` and before any module that reads the secrets is required.

## 5. Investigation Phase

Complete every check before editing. Use searches, not just the paths listed here. Current line numbers may have shifted.

1. Read `README.md` §12 (Authentication & Security), §13 (Deployment), §14 (Environment Configuration), and §19 (Testing Strategy); read `AGENTS.md`; read Finding 8 and its neighbors in `CODE_REVIEW.md`.
2. Inspect the worktree and existing diff before touching files. Preserve unrelated local changes.
3. Confirm the `.env` tracking state:
    - `git ls-files .env` must return nothing.
    - `git check-ignore -v .env` should show `.gitignore`.
    - Do **not** print `.env` values in commands, logs, reports, or chat.
4. Search all secret consumers:
    - `grep -rn "process\\.env\\.API_KEY_SECRET" app`
    - `grep -rn "process\\.env\\.SESSION_SECRET" app`
    - `grep -rn "process\\.env\\.JWT_SECRET" app`
    - Also search for `process.env['...']` and destructured `const { JWT_SECRET } = process.env` forms.
5. Verify whether `JWT_SECRET` is used by `jsonwebtoken`:
    - `grep -rn "jsonwebtoken" app --include=*.js`
    - `grep -rn "jwt\\.sign\\|jwt\\.verify" app --include=*.js`
    - If usage exists that this guide did not find, stop and update the impact analysis before changing anything.
6. Verify whether UUIDs are stored encrypted or plaintext:
    - Inspect `app/db_controllers/registration_v2.controller.js` around the `CryptoJS.AES.encrypt(uuid, JWT_SECRET)` call.
    - Inspect `app/models/login.model.js` / `app/db_controllers/login.controller.js` and `app/shared/ecdc.js`.
    - Confirm `reset_tokens` stores a raw generated token, not a JWT (see `app/routes/forgot-password.js` and `app/query/reset_tokens.query.js`).
7. Verify the startup log exposure:
    - Read `app/src/server.js` around the startup log.
    - Read `app/src/Logger.js` to confirm `debug()` prints by default.
8. Inspect the actual `.env` keys (names only) and `README.md` §14 to determine whether documentation is inaccurate. Do not copy secret values into the task result.
9. Search for any existing validation/config pattern to follow:
    - `ls app/config`
    - `grep -rn "throw new Error\\|process.exit" app/src app/config app/middleware --include=*.js`
    - Prefer a small `app/config/*.js` module over new middleware or dependencies.
10. Inspect tests and how they load code:
    - `cat package.json` (`test` is `node --test`).
    - Search for tests that import `app/src/server.js`.
    - Confirm tests use `require('dotenv').config()` and do not boot the HTTP server.
    - Identify any CI job that runs `npm start` or `node app/src/server.js`; if it does, the environment must provide secure secrets or the job will intentionally fail after this change.
11. Inspect deployment docs and any PM2/systemd/container configuration in the repository to determine how environment variables are supplied in production. If no such config is committed, state that production secret rotation is an operator action.
12. Investigate `API_KEY_SECRET` usage outside the repository:
    - Search `README.md`, `app/api/swagger.yaml`, and client files.
    - Ask the human/operator whether the external MiroTalk instance shares this value.
    - Mark unresolved findings as `TO INVESTIGATE`; do not guess.

## 6. File Impact Analysis

| File                                                                                                                                      | Role                                                     | Action                                           | Reason                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/config/secrets.config.js`                                                                                                            | New secret validation module                             | **ADD**                                          | Centralizes required secret names, known weak values, placeholder detection, minimum length, and a testable `validateSecrets(env)` function.                                                                 |
| `app/src/server.js`                                                                                                                       | Application entry / boot sequence                        | **MODIFY**                                       | Call `validateSecrets()` immediately after `dotenv`; remove the startup log field that prints `API_KEY_SECRET`; remove the now-unused `api_key_secret` local if it has no other consumer.                    |
| `test/008-secrets-validation.test.js`                                                                                                     | Unit/static tests                                        | **ADD**                                          | Proves known defaults, missing values, short values, and placeholders are rejected, and proves boot wiring runs after dotenv and before session/routes.                                                      |
| `.env`                                                                                                                                    | Local environment file                                   | **REFERENCE / OPERATIONAL ONLY**                 | Must be rotated by the operator. It is gitignored and untracked. The coding agent must not commit it, print it, or silently rewrite it as part of a code change.                                             |
| `.env.example`                                                                                                                            | Onboarding template                                      | **ADD (recommended, coordinate with Finding 9)** | Provides placeholder-only variable names so a developer can set secure local values. Must never contain real secrets. If Finding 9 already adds it, reuse/extend that file instead of creating a second one. |
| `README.md`                                                                                                                               | Environment and security documentation                   | **MODIFY (documentation)**                       | §14.2 currently calls `JWT_SECRET` a “JWT signing secret” although current code uses it as a CryptoJS AES passphrase; document rotation and startup enforcement. Do not add secret values.                   |
| `app/shared/ecdc.js`                                                                                                                      | UUID encryption helper                                   | **REFERENCE ONLY**                               | Explains current `JWT_SECRET` usage. Do not change the algorithm or format.                                                                                                                                  |
| `app/models/*.js`, `app/db_controllers/*.js`, `app/routes/upload-file.js`, `app/routes/email-marketing.js`, `app/routes/encrypt.route.js` | Secret consumers                                         | **REFERENCE ONLY**                               | They capture/use `JWT_SECRET`. Rotating the env value changes their key without code changes. Do not edit these files for this task.                                                                         |
| `app/middleware/auth.middleware.js`                                                                                                       | Decrypts session UUID via `ecdc`                         | **REFERENCE ONLY**                               | Confirms rotation impact; no code change.                                                                                                                                                                    |
| `app/src/Logger.js`                                                                                                                       | Logging utility                                          | **REFERENCE ONLY**                               | Confirms `debug` is enabled by default. Do not change its global behavior for this task.                                                                                                                     |
| `.gitignore`                                                                                                                              | Ignore rules                                             | **REFERENCE ONLY**                               | Already ignores `.env`. Verify; do not weaken.                                                                                                                                                               |
| `test/login.test.js`                                                                                                                      | Uses `process.env.JWT_SECRET` to build legacy ciphertext | **REFERENCE ONLY**                               | Confirms AES format expectations. Do not change its algorithm assumptions.                                                                                                                                   |
| Production/dev hosting environment                                                                                                        | Secret store                                             | **OPERATIONAL (human/operator)**                 | New secrets must be set before deploying the enforcement code. The coding agent may not have access.                                                                                                         |

Do not modify a file merely because it is listed. Read it first and change only what the evidence supports.

## 7. Current Implementation

### 7.1 Current `.env` values (names and weak defaults only)

`.env` currently contains the three weak values quoted in `CODE_REVIEW.md`. `.env` is untracked and ignored. The file also contains unrelated credentials that belong to Finding 9; do not touch or report them.

### 7.2 Current boot sequence

`app/src/server.js`:

```js
'use strict';

require('dotenv').config();

const { Server } = require('socket.io');
// ...
const session = require('express-session');
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 365 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'strict',
    },
});
app.use(sessionMiddleware);
// ...
const api_key_secret = process.env.API_KEY_SECRET;
// ...
server.listen(port, null, () => {
    log.debug('settings', {
        server: host,
        api_key_secret: api_key_secret,
    });
});
```

There is no check that `SESSION_SECRET` or `JWT_SECRET` is present or secure. `express-session` will throw if `SESSION_SECRET` is undefined, but it will happily accept the known default string. `CryptoJS.AES.encrypt(..., undefined)` behavior is not a safe fallback and must be prevented by validation.

### 7.3 Current secret usage

- `app/shared/ecdc.js`:

    ```js
    const JWT_SECRET = process.env.JWT_SECRET;

    ecdc.encryptUuid = (uuid) => CryptoJS.AES.encrypt(uuid, JWT_SECRET).toString();

    ecdc.decryptUuid = (encryptedUuid) => {
        const bytes = CryptoJS.AES.decrypt(encryptedUuid, JWT_SECRET);
        return bytes.toString(CryptoJS.enc.Utf8);
    };
    ```

    The comment in that file explicitly says the algorithm must never change because existing sessions use it.

- Registration stores the UUID plaintext in the database and only encrypts it for the session:

    ```js
    uuid: uuid, // plaintext in users / users_businesses / etc.
    // ...
    const cipherUuid = CryptoJS.AES.encrypt(uuid, JWT_SECRET).toString();
    let sessionUser = { uuid: cipherUuid, /* ... */ };
    session.user = sessionUser;
    ```

- `app/routes/forgot-password.js` creates a UUID v4 reset token and stores it in `reset_tokens`; it does not sign a JWT with `JWT_SECRET`.

### 7.4 Current startup log exposure

`app/src/Logger.js`:

```js
debug(msg, op = '') {
    if (this.debugOn === false) return;
    console.log('[' + this.getDataTime() + '] [' + this.appName + '] ' + msg, op);
}
```

`app/src/server.js` passes `api_key_secret` in a `log.debug` object, so the value is printed in local, dev, and production logs. This is a direct exposure independent of the weak-value finding.

### 7.5 Current problems

1. Known default secrets are accepted silently.
2. Missing/empty secrets are not validated uniformly; failure behavior depends on which consumer reads them first.
3. A secret is printed to logs.
4. Documentation misstates the purpose of `JWT_SECRET`.
5. There is no test that would catch a regression reintroducing the defaults.

## 8. Current → Target

### Conceptual transformation

```text
CURRENT
.env / hosting env
   ↓
weak or missing values accepted
   ↓
express-session / CryptoJS use whatever is present
   ↓
startup log prints API_KEY_SECRET
   ↓
application runs


TARGET
operator generates random values
   ↓
hosting env / local .env receives them
   ↓
startup: validateSecrets() checks presence, known defaults,
         placeholder patterns, and minimum length
   ↓
invalid → throw a clear error (no secret values in the message)
valid   → boot continues
   ↓
startup log contains no secret value
   ↓
express-session / CryptoJS use the rotated values
```

### Target validator pattern

Use this as the intended pattern and adapt it to the repository's style. Do not introduce a dependency.

```js
'use strict';

const crypto = require('crypto');

const REQUIRED_SECRETS = Object.freeze(['API_KEY_SECRET', 'SESSION_SECRET', 'JWT_SECRET']);

const KNOWN_INSECURE_SECRETS = Object.freeze(
    new Set([
        'all_world_trade_default_secret',
        'all_world_trade_secret_random_string',
        'all_world_trade_jwt_super_secret',
    ]),
);

const PLACEHOLDER_PATTERN =
    /(default|changeme|change_me|placeholder|example|random_string|super_secret|your[_-]?secret)/i;

const MIN_SECRET_LENGTH = 32;

function validateSecrets(env = process.env) {
    const problems = [];

    for (const name of REQUIRED_SECRETS) {
        const rawValue = env[name];

        if (typeof rawValue !== 'string' || rawValue.trim() === '') {
            problems.push(`${name} is missing`);
            continue;
        }

        const value = rawValue.trim();

        if (KNOWN_INSECURE_SECRETS.has(value) || PLACEHOLDER_PATTERN.test(value)) {
            problems.push(`${name} uses a known default or placeholder value`);
        }

        if (value.length < MIN_SECRET_LENGTH) {
            problems.push(`${name} is shorter than ${MIN_SECRET_LENGTH} characters`);
        }
    }

    if (problems.length > 0) {
        throw new Error(
            `Insecure secret configuration: ${problems.join('; ')}. ` +
                "Generate each secret with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"",
        );
    }
}

module.exports = {
    REQUIRED_SECRETS,
    KNOWN_INSECURE_SECRETS,
    MIN_SECRET_LENGTH,
    validateSecrets,
};
```

Notes:

- Read `env` at call time. Do not capture `process.env` values at module load if that makes testing harder.
- Never include the secret value in the thrown error. Names and rule violations only.
- `crypto` is built into Node; do not add a package.
- If the repository's Node version does not support a pattern used here, adapt minimally. The project requires Node >= 18 per `README.md`.
- The exact minimum can be adjusted only with a documented reason. 32 characters is a floor; the recommended generation command produces a 128-character hex string (64 random bytes / 512 bits).

### Target boot wiring

```js
require('dotenv').config();

const { validateSecrets } = require('../config/secrets.config.js');
validateSecrets();

const { Server } = require('socket.io');
// ...
```

Placement is mandatory: after `dotenv`, before any secret-consuming module is required and before `express-session` is constructed.

### Target startup log

```js
// CURRENT
log.debug('settings', {
    server: host,
    api_key_secret: api_key_secret,
});

// TARGET
log.debug('settings', {
    server: host,
});
```

If `const api_key_secret = process.env.API_KEY_SECRET;` becomes unused after this change and no integration consumes it, remove the local variable. Verify with a repository-wide search first. Keep the environment variable required by the validator unless the human explicitly decides the integration is dead.

## 9. Detailed Implementation Plan

### Step 1 — Inspect the live implementation

1. Read the current `app/src/server.js` boot sequence, especially the `dotenv` call, session setup, startup log, and module requires.
2. Read `app/shared/ecdc.js`, `app/src/Logger.js`, `README.md` §14, and `.gitignore`.
3. Run the search commands in §5. Record the exact consumers and whether `jsonwebtoken` is actually used.
4. Confirm `.env` is untracked and ignored. Do not print its values.
5. Confirm no existing validator or `.env.example` already exists. If they exist, adapt instead of duplicating.

### Step 2 — Add the validator module

Create `app/config/secrets.config.js` following §8.

Requirements:

- Export `validateSecrets(env = process.env)`.
- Require all three names: `API_KEY_SECRET`, `SESSION_SECRET`, `JWT_SECRET`.
- Reject known weak defaults discovered by the current search, not just the three quoted in `CODE_REVIEW.md`. If the live `.env` contains additional weak variants, add them to the set.
- Reject empty/whitespace-only strings.
- Reject obvious placeholder text.
- Enforce a minimum length (32 characters as the intended floor).
- Throw one `Error` listing all failing variable names and reasons so the operator can fix everything in one pass.
- Never include a secret value, prefix, suffix, length-specific value, or hash in the message.
- Do not call `process.exit()` inside the module. Let the throw fail startup; this is easier to test and preserves stack traces for operators.
- Do not read `.env` itself or use `dotenv` inside the module. `server.js` already loads `.env`.

### Step 3 — Wire the validator into boot

1. Add the require and call immediately after `require('dotenv').config();` in `app/src/server.js`.
2. Ensure it runs before:
    - `express-session` is constructed,
    - `app/shared/ecdc.js` or any model/controller that captures `JWT_SECRET` is required,
    - `app.src/server.js` reads `process.env.API_KEY_SECRET`.
3. Do not move the existing `dotenv` call.
4. Do not add conditional enforcement based on `NODE_ENV`. Known defaults are public in every environment.
5. If the app is started from a different working directory in some deployment, verify how `dotenv` finds `.env`. Do not change that mechanism in this task.

### Step 4 — Remove the secret from startup logging

1. Delete the `api_key_secret` field from the `log.debug('settings', ...)` call.
2. Search for any other log/console statement that prints a secret value:
    - `grep -rn "api_key_secret\\|SESSION_SECRET\\|JWT_SECRET" app --include=*.js`
    - inspect every match that is not a declaration or use.
3. Remove the now-unused local `api_key_secret` only if a repository-wide search shows no consumer. Do not remove the `API_KEY_SECRET` requirement from the validator.
4. Do not change the logger's global `debugOn` behavior; that is out of scope.

### Step 5 — Operational secret rotation (human/operator gate)

This step is not a code edit. The implementing agent must not invent or commit secrets and must not silently rewrite `.env`.

1. Generate three independent values. Run the command once per secret, preferably directly into the secret store, not into shell history or a chat:

    ```bash
    node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
    ```

    `openssl rand -hex 64` is an acceptable equivalent.

2. Set the values in the hosting platform's environment configuration for each environment (production, dev/staging, local). Follow the deployment mechanism actually used by the project. `README.md` §13.2 exports only `NODE_ENV`; if no committed env file exists, the operator must document where these values live.
3. Update the operator's local `.env` for development. This is the one expected local file change, and it must remain untracked. Do not commit it.
4. Coordinate MiroTalk/external integration:
    - If `API_KEY_SECRET` is shared with the external MiroTalk instance, update both sides during the same change window.
    - If the agent cannot establish whether it is used externally, report `TO INVESTIGATE` and do not claim the rotation is complete.
5. Rotation side effects to communicate:
    - `SESSION_SECRET` rotation invalidates all existing session cookies. Users are signed out once.
    - `JWT_SECRET` rotation invalidates the encrypted UUIDs inside existing sessions. Users are signed out once. Plaintext database UUIDs and password-reset tokens are unaffected.
    - Plan a low-traffic deployment window or accept a one-time sign-out.
6. Deployment sequencing to avoid an outage:
    - Set the new environment values first.
    - Deploy the code containing `validateSecrets()`.
    - Restart the process and confirm it starts.
    - If the environment cannot be updated first, do not deploy the enforcement code until it can be. The guard is intentionally fail-closed.
7. Have a rollback plan: redeploy the previous release and restore its environment values if the new deployment cannot boot for an unrelated reason. Do not weaken validation as a "temporary fix."

### Step 6 — Update documentation and onboarding

1. Update `README.md` §14.2 so the secret descriptions match reality:
    - `SESSION_SECRET` — signs session cookies.
    - `JWT_SECRET` — AES passphrase used by the legacy CryptoJS/ECDC session-UUID format (not currently a JWT signing key; re-verify before writing).
    - `API_KEY_SECRET` — MiroTalk integration key (external usage to be confirmed).
    - Add a short note that secrets must be at least 32 characters, generated with `crypto.randomBytes`, rotated when exposed, and never committed.
    - Add a note that startup rejects known defaults/placeholders.
2. If `.env.example` does not exist and Finding 9 has not added it, add a placeholder-only template:

    ```env
    API_KEY_SECRET=replace-with-crypto-random-value
    SESSION_SECRET=replace-with-crypto-random-value
    JWT_SECRET=replace-with-crypto-random-value
    ```

    The placeholder values must fail validation. Do not include real credentials or working secrets.

3. Do not paste generated production secrets into README, docs, tests, task reports, or commit messages.

### Step 7 — Add tests

Create `test/008-secrets-validation.test.js` using the existing `node:test` + `node:assert/strict` style.

The validator must be imported only after any test-specific env setup is complete, and the test must pass explicit env objects so it does not depend on the developer's `.env`. Do not mutate `process.env` permanently; restore it if a test must do so.

Required test cases are listed in §13. Also add static assertions that:

- `app/src/server.js` requires and calls `validateSecrets` after `require('dotenv').config()`.
- The call appears before the `express-session` construction and before the first `require('../routes/...')`.
- The startup log no longer contains `api_key_secret`.
- The known weak values are present in the validator's reject list (the values are already public in `CODE_REVIEW.md`).

Avoid tests that require a database or an HTTP listener unless necessary. The project notes that DB-dependent integration tests may skip; this task should not add a DB dependency.

### Step 8 — Review and verify

1. Re-read the final diff for every modified/added file.
2. Verify no secret value appears in source, tests, docs, or logs.
3. Verify `.env` remains untracked and unchanged in git status.
4. Run the focused test file, then the full suite, then lint.
5. Perform the manual checks in §14 if the environment allows.
6. Record any deployment steps that could not be performed by the agent.

## 10. Architecture and Existing Patterns

Follow the existing project conventions:

- Configuration modules live in `app/config/` and export plain objects/functions (`db.config.js`, `sequelize.config.js`, `email.config.js`).
- The boot sequence is centralized in `app/src/server.js`.
- `dotenv` is already loaded once at the top of `server.js`; do not introduce a second `.env` loader.
- Tests use Node's built-in `node:test` and `node:assert/strict` (see `test/006-auth-middleware.test.js`, `test/007-general-rate-limit.test.js`, `test/041-*.test.js`).
- Static source assertions are an accepted pattern in this repository for boot-order and wiring checks (see `test/007-general-rate-limit.test.js` and `test/051-reset-endpoints-rate-limit.test.js`).
- Use 4-space indentation, single quotes, 120-column print width, and trailing commas per `.prettierrc.js`.
- Use `require`/`module.exports`; do not convert files to ESM.

Do not introduce a new dependency, framework, secrets-manager SDK, dotenv alternative, Joi/Zod schema, or middleware layer when a small config module and `crypto` are sufficient. Do not refactor `Logger`, session setup, or the model layer as part of this task.

## 11. Security Requirements

- Never log, print, echo, commit, or report a secret value. This includes prefixes, suffixes, lengths, hashes, and “masked” values that still reveal the secret.
- Never add a code fallback that supplies a default secret when an environment variable is missing.
- Never add an `ALLOW_INSECURE_SECRETS`/`SKIP_SECRET_VALIDATION` bypass that can be enabled in production. If a testing escape hatch is unavoidable, it must be impossible to activate in production and must be documented; prefer passing an explicit env object to `validateSecrets()` instead.
- Never weaken `.gitignore` or add `.env` to git.
- Never change the CryptoJS AES algorithm, key derivation, encoding, or IV behavior. Rotating the value is safe; changing the format is not.
- Never change `express-session` cookie attributes (`httpOnly`, `sameSite`, `maxAge`), `saveUninitialized`, or `resave` in this task.
- Never remove `JWT_SECRET` from consumers as a “cleanup” while this task is only about rotating its value.
- Never place generated secrets in `README.md`, `AGENTS.md`, `CODE_REVIEW.md`, test fixtures, or task reports.
- Never disable or weaken the guard to make a smoke test pass. Fix the environment or document the blocked verification.
- The guard must fail closed on missing/empty secrets, known defaults, placeholder strings, and short values.
- Error messages must be actionable (variable name + reason + generation command) but must not include secret material.
- Search for similar logging leaks in the affected boot path after removing the API key log. Do not limit the check to the single line named in the finding.
- Treat `API_KEY_SECRET` rotation as an external integration change until proven otherwise.

## 12. Backward Compatibility

Preserve these behaviors unless the task explicitly says otherwise:

- **API response format and status codes** — unchanged. This task does not touch routes or controllers.
- **Authentication flow** — login, registration, logout, and session payload shape remain the same.
- **Session cookie attributes** — unchanged. Do not “improve” them here.
- **Encryption format** — `CryptoJS.AES.encrypt(uuid, JWT_SECRET).toString()` and the matching decrypt path remain byte-compatible with the existing code. Only the key value changes.
- **Database schema and data** — no migrations. UUID columns remain plaintext as they are today.
- **Password reset flow** — reset tokens are UUID v4 rows, not JWTs; rotation does not invalidate them. Do not change token generation, expiry, or invalidation.
- **Static assets, Socket.IO, uploads, search, and emails** — unchanged.
- **Testing behavior** — tests that read `process.env.JWT_SECRET` (for example, legacy ciphertext helpers in `test/login.test.js`) must continue to work when the operator's environment is secure. Do not hardcode a secret into tests. Use a test-only value that satisfies the validator, or pass explicit values.
- **Local development** — after this change, an unchanged local `.env` containing the known defaults will intentionally fail startup. This is expected; the operator must rotate local secrets. Document this clearly so it is not mistaken for a regression.
- **Production availability** — the guard is fail-closed. Rotate production secrets before deploying the guard. This is the only intended operational behavior change.

Expected one-time behavior change: existing users are signed out when `SESSION_SECRET` and `JWT_SECRET` rotate. They can immediately log in again. Do not attempt to preserve old sessions by keeping the old secrets; that defeats the rotation.

## 13. Testing Strategy

### Unit tests — `test/008-secrets-validation.test.js`

Use `validateSecrets(customEnv)` with complete, explicit env objects. Example shape:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateSecrets, MIN_SECRET_LENGTH } = require('../app/config/secrets.config.js');

const STRONG = 'a'.repeat(MIN_SECRET_LENGTH); // test-only; not a real secret

function validEnv(overrides = {}) {
    return {
        API_KEY_SECRET: STRONG,
        SESSION_SECRET: STRONG,
        JWT_SECRET: STRONG,
        ...overrides,
    };
}
```

Ideally use a clearly fake high-entropy test value or `crypto.randomBytes(64).toString('hex')` generated inside the test. Do not use a value that looks like production material.

#### Normal case

- All three secrets are strong → `validateSecrets()` does not throw.
- A 128-character hex value generated with `crypto.randomBytes(64)` passes.

#### Empty / missing input

- Each secret missing → throws; error names that secret.
- Each secret `''` → throws.
- Each secret whitespace-only (`'   '`) → throws.
- Multiple problems → one error lists all of them.

#### Boundary cases

- Value exactly `MIN_SECRET_LENGTH - 1` → throws.
- Value exactly `MIN_SECRET_LENGTH` with no placeholder/known-default content → passes.
- Very long value (for example 10,000 characters) → passes without crashing.
- Values with surrounding whitespace → either trimmed and accepted or rejected consistently; assert the chosen behavior.
- Non-string values (`undefined`, `null`, number, object) → throw, not coerce.

#### Invalid / insecure input

- Each known default from `CODE_REVIEW.md` and any additional live variants → throws.
- Placeholder-like values (`changeme`, `change_me`, `placeholder`, `example`, `your_secret`, `random_string`, `super_secret`) → throw.
- Mixed case of a known default → throw if the implementation is intended to be case-insensitive; otherwise document and test the actual behavior.
- A default with surrounding whitespace → throw after trim.

#### Security cases

- Assert the thrown error message does not contain the submitted secret value.
- Assert the error message names the offending variable and includes an actionable generation hint.
- Assert no secret is written via `console.log` during validation.
- Static test: startup log block does not contain `api_key_secret`.
- Static test: `validateSecrets` is called after `dotenv` and before session/router setup.

#### Regression tests

- Existing full suite still passes: `npm test`.
- Existing login/session behavior still works after operator rotation (manual).
- Password reset flow still works (manual, or existing DB-dependent tests if the environment is available).
- Static asset and Socket.IO startup are unaffected (manual boot check).

### Manual runtime checks (when environment allows)

1. **Fail-closed boot with known defaults:**

    ```bash
    API_KEY_SECRET=all_world_trade_default_secret \
    SESSION_SECRET=all_world_trade_secret_random_string \
    JWT_SECRET=all_world_trade_jwt_super_secret \
    node app/src/server.js
    ```

    Expected: exits non-zero before `listen`, with a clear message naming the variables; no secret values printed. Do not use real production secrets here.

2. **Fail-closed boot with a missing secret:**

    ```bash
    API_KEY_SECRET="$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")" \
    SESSION_SECRET="$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")" \
    node app/src/server.js
    ```

    Expected: exits non-zero because `JWT_SECRET` is missing. Ensure `.env` does not override it (dotenv does not override already-set shell variables, but verify).

3. **Successful boot with throwaway secure values:** set all three as shell-only variables and start the app. Expected: starts normally, startup log shows `server` but not the key. This requires the configured database; if unavailable, record the skip.

4. **Rotation side effect:** log in with an existing cookie after rotation. Expected: the old cookie no longer resolves a user; a fresh login works. Document this as expected, not a defect.

### Commands

```bash
node --test test/008-secrets-validation.test.js
npm test
npm run lint
```

`npm run lint` is `npx prettier --write .` in this repository. Review the diff afterward because it writes files.

## 14. Verification / Evidence

The implementing agent must provide concrete evidence:

1. **Diff review** — list every modified/added file and explain why.
2. **Search evidence** — show that:
    - No source file contains `api_key_secret: api_key_secret` or another secret log.
    - `app/src/server.js` calls `validateSecrets()` immediately after `dotenv` and before session/routes.
    - `.env` is still untracked and not staged.
3. **Test evidence** — actual command output for:
    - focused validator tests,
    - full `npm test` (report skipped DB-dependent tests separately),
    - `npm run lint` (or a documented reason it was not run).
4. **Runtime evidence** — if possible, show the failure output for known defaults and the successful startup with throwaway secure values. Redact all secret values from the captured output.
5. **Similar-pattern search** — show the commands used to search for other secret logging/consumption, and summarize results.
6. **Integration evidence** — state whether `API_KEY_SECRET` is used by an external MiroTalk instance, or mark it `TO INVESTIGATE`.
7. **Operational evidence** — explicitly state which rotation steps were completed by a human/operator and which remain pending. The coding agent cannot claim production rotation is done based only on code changes.
8. **No-secret assertion** — state that no generated or real secret was added to the repository, task document, test output, or final report.

Do not accept “fixed” without this evidence. A code-only change that adds a validator but leaves production on the old defaults is only partially complete; report it as `NEEDS REVIEW` with the operational blocker.

## 15. Do NOT Do

- Do not modify, delete, or commit `.env`.
- Do not print `.env` contents or any secret value in commands, logs, tests, docs, or reports.
- Do not hardcode generated secrets in source, tests, `.env.example`, or documentation.
- Do not rotate production secrets from code or a migration.
- Do not add a bypass flag that allows insecure secrets in production.
- Do not add a default/fallback secret when an env var is missing.
- Do not change the CryptoJS AES algorithm, key derivation, session UUID format, or encryption call sites.
- Do not change session cookie attributes, `saveUninitialized`, `resave`, cookie lifetime, or store configuration.
- Do not change API routes, response bodies, status codes, auth middleware, rate limiting, CORS, Helmet, or database schema.
- Do not edit the many models/controllers that consume `JWT_SECRET`; they should work unchanged with the rotated value.
- Do not remove `JWT_SECRET` usage or replace CryptoJS with another library.
- Do not remove the `jsonwebtoken` dependency as part of this task.
- Do not weaken `.gitignore` or add `.env` to version control.
- Do not rewrite the entire `server.js` or move unrelated boot code.
- Do not introduce Express middleware for secret validation when a boot-time config function is sufficient.
- Do not disable or delete failing tests; fix the implementation or report the blocker.
- Do not hide or suppress validation errors.
- Do not handle Finding 9 credentials or git-history cleanup in this task.
- Do not claim the finding is fully fixed if the operator has not rotated the deployed environment values.

## 16. Acceptance Criteria

### Code

- [ ] `app/config/secrets.config.js` exists and exports a testable `validateSecrets(env)`.
- [ ] The validator requires `API_KEY_SECRET`, `SESSION_SECRET`, and `JWT_SECRET`.
- [ ] The validator rejects missing, empty, whitespace-only, known-default, placeholder-like, and too-short values.
- [ ] The validator throws one clear error listing all failing variable names and reasons.
- [ ] The error never includes a secret value.
- [ ] `app/src/server.js` calls `validateSecrets()` after `dotenv` and before session/model/route setup.
- [ ] The startup log no longer prints `API_KEY_SECRET`.
- [ ] The now-unused `api_key_secret` local is removed only if a repository-wide search confirms no other consumer.
- [ ] No new dependency is added.
- [ ] No encryption, session-cookie, auth, rate-limit, API, or database behavior is changed.

### Tests

- [ ] `test/008-secrets-validation.test.js` covers normal, missing/empty, boundary, invalid, security, and wiring cases from §13.
- [ ] Focused tests pass.
- [ ] Full `npm test` passes, with DB-dependent skips reported separately.
- [ ] `npm run lint` was run and its changes were reviewed (or a blocker is documented).

### Security

- [ ] Known defaults from `CODE_REVIEW.md` and any additional live weak variants are rejected.
- [ ] No secret value appears in source, tests, docs, logs, `.env.example`, or the final report.
- [ ] `.env` remains untracked and unstaged.
- [ ] A search for other secret logging/usage in the boot path was performed and summarized.
- [ ] `API_KEY_SECRET` external integration status is confirmed or reported as `TO INVESTIGATE`.

### Operational / documentation

- [ ] The human/operator has generated new random secrets and set them in each environment.
- [ ] Local `.env` was updated by the operator and remains untracked.
- [ ] The expected one-time sign-out from session/JWT rotation is communicated.
- [ ] Production secret rotation completed before the enforcement code was deployed, or the deployment is explicitly blocked.
- [ ] `README.md` §14.2 accurately describes each secret and the startup guard.
- [ ] `.env.example` (if added) contains placeholders only and those placeholders fail validation.

### Hygiene

- [ ] Only files justified in §6 were changed.
- [ ] The final diff was reviewed.
- [ ] Remaining risks and unverified items are reported.
- [ ] Final status is `PASS` or `NEEDS REVIEW` with reasons.

## 17. Expected Final Report

The implementing agent must finish with this structure:

```markdown
# Implementation Report

## Summary

Brief explanation of what was implemented and what remains operational.

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

Explain the validator rules, boot placement, log change, and documentation update.
Do not include secret values.

## Testing

| Test                                     | Result         |
| ---------------------------------------- | -------------- |
| Valid strong secrets                     | PASS/FAIL/SKIP |
| Missing/empty secret                     | PASS/FAIL/SKIP |
| Known default secret                     | PASS/FAIL/SKIP |
| Short/placeholder secret                 | PASS/FAIL/SKIP |
| Error message contains no secret         | PASS/FAIL/SKIP |
| Boot-order static test                   | PASS/FAIL/SKIP |
| Full `npm test`                          | PASS/FAIL/SKIP |
| `npm run lint`                           | PASS/FAIL/SKIP |
| Manual boot with secure throwaway values | PASS/FAIL/SKIP |

## Verification

Explain how the original problem was verified as fixed:

- the guard rejects defaults,
- the log no longer exposes the key,
- `.env` is still untracked,
- no secret values leaked,
- unrelated flows were not changed.

## Operational Status

| Item                                        | Status                              |
| ------------------------------------------- | ----------------------------------- |
| Production secrets rotated                  | DONE/PENDING/TO INVESTIGATE         |
| Dev/staging secrets rotated                 | DONE/PENDING/TO INVESTIGATE         |
| Local `.env` rotated                        | DONE/PENDING/NOT PERFORMED BY AGENT |
| MiroTalk/API_KEY_SECRET integration updated | DONE/PENDING/TO INVESTIGATE         |
| One-time sign-out communicated              | DONE/PENDING                        |

## Remaining Risks

List anything that could not be verified, including missing hosting access,
DB-dependent test skips, and external MiroTalk coordination.

## Final Status

PASS / NEEDS REVIEW
```

## 18. Important Rules for the Implementing Agent

### Rule 1 — Do not hallucinate

Do not invent secret consumers, deployment mechanisms, environment-variable values, file paths, or external integration behavior. If something cannot be established from the repository, mark it `TO INVESTIGATE`. Do not guess whether MiroTalk uses `API_KEY_SECRET`.

### Rule 2 — Separate facts from recommendations

Clearly distinguish:

```text
CURRENT IMPLEMENTATION
```

from:

```text
RECOMMENDED IMPLEMENTATION
```

The code snippets in §8 are an intended pattern, not a claim about the current file contents. Inspect the live files before editing.

### Rule 3 — Prefer project consistency

Use the existing `app/config/*.js` module style, `node:test`, and the current `server.js` boot sequence. Do not introduce a dependency or a new architecture.

### Rule 4 — Preserve behavior

The marketplace is working in production. The only intended behavior changes are:

1. the app refuses to boot with insecure secrets,
2. startup no longer prints the API key,
3. existing sessions are invalidated once when secrets rotate.

Everything else must remain unchanged.

### Rule 5 — Think about the entire code path

Do not focus only on `.env` or the startup log. Trace:

```text
.env / hosting env
   ↓
dotenv
   ↓
validateSecrets
   ↓
express-session / CryptoJS consumers
   ↓
session cookie / encrypted session UUID
   ↓
request handlers / database lookups
```

A validator placed after `express-session` is constructed, or a rotation that assumes UUIDs are encrypted in the database, would be wrong. Verify the actual usage before acting.

### Rule 6 — Make the task executable

Another AI coding agent should be able to read this document and know:

- What to change.
- Where to change it.
- Why it must change.
- Which existing behavior must not change.
- How to test it.
- How to prove it is fixed.
- Which parts require a human/operator.

## 19. Output Requirements for the Implementing Agent

The implementing agent must return the Implementation Report from §17, not a general narrative. The report must include:

- Actual test commands and result summaries.
- The final diff review.
- The validator rule set and boot placement.
- Evidence that no secret value was logged, printed, or committed.
- Evidence that `.env` remains untracked.
- Evidence that encryption formats, session behavior (apart from the expected one-time rotation sign-out), API contracts, and database schema were preserved.
- The status of production/dev/local secret rotation and external MiroTalk coordination.
- Any database or runtime checks that could not be performed.
- Any remaining risks.

If any part of the task cannot be completed safely — especially production rotation, external MiroTalk coordination, or a deployment that cannot update environment variables before restarting — report `NEEDS REVIEW` with the specific blocker instead of guessing or weakening the guard.
