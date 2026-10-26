# AI Task: Add Authentication Middleware to API Routes

> **Finding:** `CODE_REVIEW.md` — Finding 6: No Authentication Middleware on API Routes
> **Task file:** `docs/tasks/006-No-Authentication-Middleware-on-API-Routes.md`
> **Severity:** Medium (roadmap priority #6)
> **Related tasks:** Finding 5 (public bcrypt oracle in `app/routes/password.js`), Finding 24 (debug `encrypt.route.js` endpoints), Finding 51 (rate limiting on reset endpoints). Those are separate changes; this task must not absorb them.

## 1. Task Title

**Require an authenticated, active session for every non-public `/api` route**

## 2. Objective

Add a reusable `isAuthenticated` Express middleware that:

1. Allows an explicit, documented allowlist of public API routes.
2. Rejects every other `/api` request unless the request has a valid session whose account is still active.
3. Verifies the decrypted session UUID against the database on each protected request rather than trusting the cookie payload.
4. Preserves the existing support-agent session flow and all public registration, login, password-reset, help/support, reference-data, and MiroTalk callback flows.
5. Returns a JSON `401` instead of redirecting, because API clients expect JSON and many call these endpoints with `fetch`/jQuery.

The expected outcome is that an anonymous caller can no longer read or mutate user/company data by calling `/api/...` directly, while every currently working browser flow continues to work.

The coding agent must first verify the finding is still present. At the time this guide was written, no route module registers authentication middleware and `server.js` has no `app.use('/api', ...)` guard.

## 3. Problem / Finding

### Finding as reported

`CODE_REVIEW.md` reports that only `/api/post/login-process` has validation middleware. The other endpoints in `app/routes/index.js` and `app/routes/sequelize.route.js` — user reads, company updates, profile modifications, uploads, PDF/export paths, and so on — have no authentication check. Page routes check `req.session.user`, but API routes do not, so any anonymous client can call them.

The finding text itself does not assign a numeric severity; the roadmap table labels it Medium. Do not invent a different severity or use severity to broaden the work.

### Current source observation — verify before acting

At the time this guide was written:

- `app/src/server.js` has no `app.use('/api', ...)` authentication middleware.
- The only API middleware in use is validation (`middleware.login_process`), rate limiting on password-reset endpoints, and route-specific validation in `sequelize.route.js`.
- A page-only helper exists in `app/src/server.js`:

    ```js
    const getUserUuidFromSession = (sessionUser) => {
        if (!sessionUser || !sessionUser.uuid) return null;
        return ecdc.decryptUuid(sessionUser.uuid);
    };

    const isUserLoggedIn = async (sessionUser) => {
        const userUuid = getUserUuidFromSession(sessionUser);
        if (!userUuid) return false;
        const loginStatus = await checkUserLoginStatus(userUuid);
        return !!loginStatus;
    };
    ```

    `checkUserLoginStatus` queries `users_accounts.login_status` by UUID and catches database errors by returning `null` (fail closed). The helper also logs the UUID, which the new middleware must not copy into logs.

- `users_accounts.login_status` is set to `1` by `app/services/auth.service.js` on login and set to `null` by `GET /logout` and the auto-logout cron in `app/email_controllers/cron-email.controller.js`.
- Support agents use the same `req.session.user` object shape but different keys: `app/models/help-and-support-login.model.js` stores `{ uuid, email_address, status, first_name, last_name }`, while normal users store `{ uuid, email_or_social_media, type, ... }`. A normal `users_accounts.login_status` lookup must not be applied to a support session.
- Many legacy controllers read `req.session.user.uuid` without a null check (for example `app/controllers/selection.controller.js`, `app/controllers/users-business.controller.js`, and `app/controllers/users-account.controller.js`). Today an anonymous call can crash or return a database error instead of a clean `401`.
- `app/shared/ecdc.js` provides `encryptUuid`/`decryptUuid` using CryptoJS AES keyed from `JWT_SECRET`. Do not change the algorithm or the session shape; existing cookies must keep working.

Therefore, do not assume the exact line numbers or helper names above are still current. Inspect the live branch and tests first.

## 4. Affected Functionality

### Protected API areas

- Profile reads: `/api/get/user`, `/api/get/users-account`, `/api/get/users-address`, `/api/get/company-details`, `/api/get/users-business`, `/api/get/user-business-characteristics`, `/api/get/users-business-visibility`, `/api/get/users-logo-and-banners`, `/api/get/users-business-videos`, `/api/get/users-business-brochures`.
- Profile/company writes and upgrades: `/api/post/update-company-details`, `/api/post/update-large-scale-company`, `/api/post/update-medium-scale-company`, `/api/post/update-small-scale-company`, `/api/post/upgrade-*`, `/api/v2/post/update-*`, `/api/v2/update/region-of-operation`, `/api/v2/update/update-company-details`.
- Selection/search: `/api/get/companies`, `/api/get/companies-profile-picture`, `/api/get/get-companies-related-to-current-user`, `/api/get/get-next-five-companies`, `/api/get/get-prev-five-companies`, `/api/get/get-random-companies`, `/api/post/selection-search-parameter`.
- Communicator and visitor actions: `/api/get/create-communicator-link`, `/api/v2/post/generate-waiting-room`, `/api/v2/post/check-if-trader-is-active`, `/api/post/get-current-trader`, `/api/post/get-current-visitor`, `/api/post/record-the-meeting-of-visitor-and-trader`.
- Media/update uploads: `/api/post/update-trader-company-*`, `/api/post/update-upload-brochure`, `/api/post/upload-brochure`, `/api/post/upgrade-upload-*`, and any non-registration media upload route.
- Email/contact actions: `/api/post/emails/introduction`, `/api/post/emails/notify-trader-on-client-contact`, `/api/v3/post/submit-client-email-to-the-trader`.
- Internal/export/debug paths: `/api/v2/get/traders-data`, `/api/v2/get/latest-users`, `/api/v2/export/users-businesses`, `/api/v2/post/ec`, `/api/v2/post/dc`.

### Public API areas that must remain public

- Login, support login, password-reset requests, password hashing/comparison (until Finding 5 removes the public oracle), email verification, and registration endpoints.
- Registration media upload handlers under `/api/post/registration-*`.
- Legacy registration handlers under `/api/post/looking-for-*`.
- Reference data used by public registration/login/country scripts (`/api/get/categories`, languages, regions, categories/sub-categories).
- Public member counts used by `/all-about-events`.
- Public help/support v2/v3 waiting-room endpoints and `update-as-occupied`.
- External MiroTalk callbacks: `/api/get/communicator-link/:link` and `/api/post/communicator-participants/:peers_count/:strippedRoomId`.

### Not affected

- Page routes in `app/src/server.js` continue to use their existing page-level checks. Do not move page authorization into this middleware.
- Socket.IO connections (`app/realtime/call.handler.js`) keep their own handshake/session handling. A global `/api` middleware does not touch Socket.IO.
- Cron jobs, logout, email transport, database schema, and client-side templates are out of scope except where a test must confirm unchanged behavior.

### Known benign compatibility issue

`public/view/includes/nav/primary-navigation.ejs` includes `public/view/includes/header_avatar/index.ejs`, whose `public/assets/js/header_avatar.js` calls `/api/get/users-logo-and-banners` on every page load. Public pages such as `/pricing`, the legal pages, `/traders-page`, and `/all-about-events` therefore make that call without a session. Today the endpoint crashes on `req.session.user.uuid`; after this change it returns `401` and the page still renders with placeholder avatars. This is a benign improvement, not a reason to whitelist the endpoint. Record it in the final report. A separate change should guard the script by session or move avatar loading to authenticated pages only.

## 5. Investigation Phase

Complete these checks before editing:

1. Read `README.md` (architecture, authentication, API, testing sections), `AGENTS.md`, and Finding 6 in `CODE_REVIEW.md`.
2. Run `git status` and inspect the current diff for every file you may touch. Preserve unrelated changes already in the worktree.
3. Confirm no authentication middleware exists:
    - `rg "isAuthenticated|auth.middleware|app\\.use\\('/api'" app`
    - `rg "req\\.session\\.user" app/routes app/controllers app/db_controllers`
4. Read the live implementations of:
    - `app/src/server.js` (session setup, route registration order, page auth helpers, logout, cron registration)
    - `app/middleware/index.js`
    - `app/middleware/rate-limit/password-reset.rate-limit.js` (existing middleware factory/style)
    - `app/shared/ecdc.js`
    - `app/db_models/users_accounts.model.js`
    - `app/db_models/support_accounts.model.js`
    - `app/services/auth.service.js`
    - `app/db_controllers/login.controller.js`
    - `app/models/help-and-support-login.model.js`
    - `app/routes/index.js`
    - `app/routes/sequelize.route.js`
    - `app/routes/upload-file.js`
    - `app/routes/email-marketing.js`
    - `app/routes/password.js`
    - `app/routes/forgot-password.js`
    - `app/routes/encrypt.route.js`
5. Build a route inventory. Grep all `app.get`/`app.post` registrations and all client callers under `public/assets/js` and `public/view`. Classify each route as public or protected. Do not guess: a route is public only when a caller exists on a public page/flow or it is an external callback.
6. Verify the support-session shape and all support-only routes. At minimum, inspect `app/db_controllers/support-links.controller.js`, `app/db_controllers/support_messages.controller.js`, `app/db_controllers/waiting_rooms.controller.js`, and `public/assets/js/help-and-support*.js`.
7. Verify `login_status` semantics in `auth.service.js`, `/logout`, and the auto-logout cron. Confirm the values are `1` (logged in), `0`/`null` (logged out), and that no other code writes a different truthy value.
8. Check the registration flow. `registration_v2.controller.js` sets a session immediately but does not set `login_status = 1`; the client redirects to `/selection`, whose page check sends the user to login. Confirm no protected API is called after registration with that not-yet-logged-in session.
9. Search for any other page helper or caller that assumes unauthenticated API access. In particular, inspect `public/assets/js/header_avatar.js` and pages that include `primary-navigation.ejs`.
10. Check the existing test conventions under `test/`, especially `test/051-reset-endpoints-rate-limit.test.js` (ephemeral Express plus `fetch`) and `test/login.test.js` (stubbed services). There is no Supertest dependency.
11. Baseline the current behavior with `npm test`. Some tests may skip or fail without a database; record the baseline separately from the change.
12. Use the current source, not this document's line numbers, as authority.

## 6. File Impact Analysis

| File                                         | Role                                | Action                                        | Reason                                                                                                                                                       |
| -------------------------------------------- | ----------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/middleware/auth.middleware.js`          | New authentication middleware       | `ADD`                                         | Own the public allowlist, session decryption, active-account lookup, support-session branch, and `401` response.                                             |
| `app/middleware/index.js`                    | Middleware barrel                   | `MODIFY`                                      | Export the new middleware consistently with existing middleware modules.                                                                                     |
| `app/src/server.js`                          | Boot sequence and page auth helpers | `MODIFY`                                      | Register `app.use('/api', isAuthenticated)` before any API route module; optionally reuse the extracted regular-session helper. Do not change page behavior. |
| `app/routes/index.js`                        | Legacy API registrations            | `REFERENCE ONLY`                              | The global middleware protects all non-public routes; no per-route edits are needed.                                                                         |
| `app/routes/sequelize.route.js`              | v2/v3 API registrations             | `REFERENCE ONLY`                              | Same reason. Use it to verify the protected/public classification.                                                                                           |
| `app/routes/upload-file.js`                  | Registration and update uploads     | `REFERENCE ONLY`                              | Confirm `registration-*` routes stay public and update/upgrade uploads become protected.                                                                     |
| `app/routes/email-marketing.js`              | Contact emails                      | `REFERENCE ONLY`                              | All three routes are user-initiated and must be protected.                                                                                                   |
| `app/routes/password.js`                     | Public bcrypt endpoints             | `REFERENCE ONLY`                              | Keep public for registration/login until Finding 5 removes the oracle. Do not fix Finding 5 here.                                                            |
| `app/routes/forgot-password.js`              | Password-reset APIs                 | `REFERENCE ONLY`                              | Public by design; do not add auth or change reset behavior.                                                                                                  |
| `app/routes/encrypt.route.js`                | Debug AES endpoints                 | `REFERENCE ONLY`                              | Protected by the global guard until Finding 24 removes them.                                                                                                 |
| `app/shared/ecdc.js`                         | UUID encryption/decryption          | `REFERENCE ONLY`                              | Reuse the existing algorithm; never change keys, format, or session shape.                                                                                   |
| `app/db_models/users_accounts.model.js`      | `login_status` field                | `REFERENCE ONLY`                              | Query only `uuid`/`login_status`; no schema change.                                                                                                          |
| `app/db_models/support_accounts.model.js`    | Support account status              | `REFERENCE ONLY`                              | Used for the support-session branch.                                                                                                                         |
| `app/services/auth.service.js`               | Login/logout status writes          | `REFERENCE ONLY`                              | Confirms `login_status` semantics.                                                                                                                           |
| `app/db_controllers/login.controller.js`     | Normal session construction         | `REFERENCE ONLY`                              | Confirms session keys (`email_or_social_media`, no `email_address`).                                                                                         |
| `app/models/help-and-support-login.model.js` | Support session construction        | `REFERENCE ONLY`                              | Confirms support session keys (`email_address`, `status`).                                                                                                   |
| `test/006-auth-middleware.test.js`           | Focused acceptance tests            | `ADD`                                         | Unit-test the classifier and HTTP-test the middleware with stubbed models.                                                                                   |
| `README.md`                                  | Architecture/security documentation | `MODIFY` only if behavior is documented there | Add a short note that API routes are deny-by-default with an explicit public allowlist. Do not rewrite unrelated sections.                                   |
| Existing unrelated worktree files            | Prior findings                      | `DO NOT TOUCH`                                | Preserve all user changes.                                                                                                                                   |

No database migration is required. Do not add columns, tables, indexes, or Sequelize associations for this task. If `users_accounts.uuid` lacks an index in production, note it as a separate performance follow-up after verifying `SHOW INDEX FROM users_accounts`; do not add a migration here.

## 7. Current Implementation

### 7.1 Boot order

`app/src/server.js` currently:

1. Loads dotenv, CORS, compression, body parsers, session middleware, nonce/header middleware, and static files.
2. Registers API modules with no auth guard:

    ```js
    require('../routes/index.js')(app);
    require('../routes/password.js')(app);
    require('../routes/upload-file.js')(app);
    require('../routes/email-marketing.js')(app);
    require('../routes/forgot-password.js')(app);
    require('../email_controllers/cron-email.controller.js')(app);
    ```

3. Later registers `sequelize.route.js` and `encrypt.route.js`.

Because Express runs middleware in registration order, any auth guard added after those `require(...)(app)` calls will never run for the already-registered routes. The guard must be inserted after session middleware and before the first API route registration.

### 7.2 Page-only authentication

`server.js` checks `req.session.user` and then calls `isUserLoggedIn` on pages such as `/`, `/selection`, and profile pages. The helper decrypts the UUID and checks `users_accounts.login_status`. It is not reusable from route modules and it treats a support session as not logged in.

### 7.3 API routes trust the caller

Examples from `app/routes/index.js`:

```js
app.post(['/api/get/users-account'], usersAccounts.find);
app.post(['/api/get/user'], users.find);
app.post(['/api/post/update-company-details'], companyDetails.update);
app.post(['/api/get/selection-search-parameter'], searchBusinesses.findAllBySearchParameter);
```

These handlers assume `req.session.user` exists. They are not protected by a route-level middleware. Some legacy controllers throw `TypeError: Cannot read properties of undefined (reading 'uuid')` for anonymous callers.

### 7.4 Two authenticated session shapes

Normal login (`app/db_controllers/login.controller.js`):

```js
{
    uuid: ecdc.encryptUuid(account.uuid),
    email_or_social_media: account.email_or_social_media,
    type: account.type,
    first_name: account.first_name,
    last_name: account.last_name,
    country: account.country,
    state_or_province: account.state_or_province,
}
```

Support login (`app/models/help-and-support-login.model.js`):

```js
{
    uuid: CryptoJS.AES.encrypt(account.uuid, JWT_SECRET).toString(),
    email_address: account.email_address,
    status: account.status,
    first_name: account.first_name,
    last_name: account.last_name,
}
```

Both use encrypted UUIDs in the same format. They must not be validated against the same table.

### 7.5 Public flows that are easy to break

- New-user registration calls `/api/post/password-hashing` before submitting the registration form.
- Email verification calls `/api/post/email-verification` and `/api/post/resend-email-verification` without a logged-in session.
- Registration media uploads use body UUIDs and run before a normal login.
- The public help page calls `/api/v3/post/go-to-help-and-suggestion-page` and `/api/v2/post/update-as-occupied` without a session.
- MiroTalk calls the communicator link/count endpoints without a browser session.
- `/all-about-events` calls the public member-count endpoints and also includes the avatar script described in section 4.

## 8. Current Implementation vs Target Implementation

| Concern                | Current                            | Target                                                     |
| ---------------------- | ---------------------------------- | ---------------------------------------------------------- |
| API authorization      | None                               | Deny by default for `/api`, with explicit public allowlist |
| Session validation     | Page-only                          | Shared middleware validates normal and support sessions    |
| Database check         | `login_status` only on page routes | `login_status` checked on every protected API request      |
| Session UUID           | Trusted by controllers             | Decrypted and checked against the account table            |
| Anonymous API response | Crash, 500, or data leak           | JSON `401 Unauthorized`, handler not called                |
| Public routes          | Implicit by omission               | Named, tested, documented allowlist                        |
| Support sessions       | Work because no auth exists        | Continue to work through an explicit support branch        |
| Logging                | Page helper logs UUIDs             | No UUID, email, cookie, or session contents in logs        |
| Middleware placement   | N/A                                | Before the first `require('../routes/...')(app)` call      |
| Error behavior         | Varies by handler                  | Fail closed; database/decrypt errors never call `next()`   |

## 9. Detailed Implementation Plan

### Step 1 — Create `app/middleware/auth.middleware.js`

Use the existing middleware style (small module, dependency-injectable factory, named exports). The module should export:

- `UNAUTHORIZED_BODY`
- `PUBLIC_API_PATHS`
- `PUBLIC_API_PATTERNS`
- `normalizeApiPath`
- `isPublicApiPath`
- `getUserUuidFromSession`
- `isUserLoggedIn` (normal session only)
- `isSupportSession`
- `isSupportLoggedIn`
- `createIsAuthenticated`
- `isAuthenticated` (default instance backed by `db`)

Suggested implementation shape:

```js
'use strict';

const ecdc = require('../shared/ecdc');
const db = require('../db_models');

const UNAUTHORIZED_BODY = Object.freeze({ status: 'error', message: 'Unauthorized' });

// Mounted with app.use('/api', isAuthenticated), so req.path is relative
// (for example '/get/user'). Keep this list free of the '/api' prefix.
const PUBLIC_API_PATHS = new Set([
    '/post/login-process',
    '/post/help-and-support-login-process',
    '/post/forgot-password-process',
    '/post/create-reset-token',
    '/post/send-email-for-change-password',
    '/post/password-hashing',
    '/post/compare-password',
    '/post/email-verification',
    '/post/resend-email-verification',
    '/post/looking-for-small-scale-company-registration',
    '/post/looking-for-medium-scale-company-registration',
    '/post/looking-for-large-scale-company-registration',
    '/get/categories',
    '/get/region-of-operations',
    '/get/languages',
    '/get/trade-categories-for-today',
    '/v2/get/number-of-trader-members',
    '/v2/get/number-of-visitor-members',
    '/v2/post/registration-v2',
    '/v2/post/large-scale-company-registration',
    '/v2/post/medium-scale-company-registration',
    '/v2/post/small-scale-company-registration',
    '/v2/post/trader-scale-company-registration',
    '/v2/post/help-and-support-registration-process',
    '/v2/post/go-to-help-and-suggestion-page',
    '/v3/post/go-to-help-and-suggestion-page',
    '/v2/post/submit-email-if-help-and-suggest-link-not-available',
    '/v2/post/update-as-occupied',
]);

const PUBLIC_API_PATTERNS = Object.freeze([
    /^\/post\/registration(?:-|$)/, // legacy registration-no-upload, registration-upload-*, registration-email-verification
    /^\/get\/sub-categories-by-trade-category-id\/[^/]+$/,
    /^\/get\/language-name-by-code\/[^/]+$/,
    /^\/get\/trade-category-title-by-id\/[^/]+$/,
    /^\/get\/sub-category-title-by-id\/[^/]+$/,
    /^\/get\/minor-sub-category-title-by-id\/[^/]+$/,
    /^\/get\/region-of-opertaion-by-iso\/[^/]+$/, // route spelling is intentionally 'opertaion'
    /^\/get\/minor-sub-categories-by-sub-category-id\/[^/]+$/,
    /^\/get\/minor-sub-categories-by-id\/[^/]+$/,
    /^\/get\/minor-sub-category-by-title\/[^/]+$/,
    /^\/get\/communicator-link\/[^/]+$/,
    /^\/post\/communicator-participants\/[^/]+\/[^/]+$/,
]);

function normalizeApiPath(apiPath) {
    if (typeof apiPath !== 'string' || apiPath.length === 0) return '';
    const withoutTrailingSlash = apiPath.length > 1 ? apiPath.replace(/\/+$/, '') : apiPath;
    return withoutTrailingSlash.toLowerCase();
}

function isPublicApiPath(apiPath) {
    const normalized = normalizeApiPath(apiPath);
    if (!normalized) return false;
    return PUBLIC_API_PATHS.has(normalized) || PUBLIC_API_PATTERNS.some((pattern) => pattern.test(normalized));
}

function getUserUuidFromSession(sessionUser, decryptUuid = ecdc.decryptUuid) {
    if (!sessionUser || typeof sessionUser.uuid !== 'string' || sessionUser.uuid.length === 0) return null;

    try {
        const uuid = decryptUuid(sessionUser.uuid);
        return typeof uuid === 'string' && uuid.length > 0 ? uuid : null;
    } catch (error) {
        return null;
    }
}

async function isUserLoggedIn(sessionUser, { usersAccounts = db.users_accounts, decryptUuid = ecdc.decryptUuid } = {}) {
    const uuid = getUserUuidFromSession(sessionUser, decryptUuid);
    if (!uuid) return false;

    try {
        const account = await usersAccounts.findOne({
            where: { uuid },
            attributes: ['login_status'],
            raw: true,
        });

        return Boolean(account) && Number(account.login_status) === 1;
    } catch (error) {
        console.error('User session lookup failed:', error.message);
        return false;
    }
}

function isSupportSession(sessionUser) {
    return Boolean(
        sessionUser &&
        Object.prototype.hasOwnProperty.call(sessionUser, 'email_address') &&
        !Object.prototype.hasOwnProperty.call(sessionUser, 'email_or_social_media'),
    );
}

async function isSupportLoggedIn(
    sessionUser,
    { supportAccounts = db.support_accounts, decryptUuid = ecdc.decryptUuid } = {},
) {
    if (!isSupportSession(sessionUser)) return false;

    const uuid = getUserUuidFromSession(sessionUser, decryptUuid);
    if (!uuid) return false;

    try {
        const account = await supportAccounts.findOne({
            where: { uuid },
            attributes: ['status'],
            raw: true,
        });

        return Boolean(account) && Number(account.status) === 1;
    } catch (error) {
        console.error('Support session lookup failed:', error.message);
        return false;
    }
}

function createIsAuthenticated({
    usersAccounts = db.users_accounts,
    supportAccounts = db.support_accounts,
    decryptUuid = ecdc.decryptUuid,
} = {}) {
    return async function isAuthenticated(req, res, next) {
        // CORS preflight must not require a session.
        if (req.method === 'OPTIONS') return next();

        // With app.use('/api', ...), req.path is mount-relative.
        if (isPublicApiPath(req.path)) return next();

        const sessionUser = req.session && req.session.user;
        const active = isSupportSession(sessionUser)
            ? await isSupportLoggedIn(sessionUser, { supportAccounts, decryptUuid })
            : await isUserLoggedIn(sessionUser, { usersAccounts, decryptUuid });

        if (!active) return res.status(401).json(UNAUTHORIZED_BODY);
        return next();
    };
}

const isAuthenticated = createIsAuthenticated();

module.exports = {
    UNAUTHORIZED_BODY,
    PUBLIC_API_PATHS,
    PUBLIC_API_PATTERNS,
    normalizeApiPath,
    isPublicApiPath,
    getUserUuidFromSession,
    isUserLoggedIn,
    isSupportSession,
    isSupportLoggedIn,
    createIsAuthenticated,
    isAuthenticated,
};
```

Notes:

- `Number(account.login_status) === 1` is intentional. The documented values are `0`, `1`, and `null`; strict numeric comparison prevents `'0'` or accidental truthy values from authenticating.
- `isUserLoggedIn` catches database errors and returns `false`, matching the existing fail-closed page helper. The middleware therefore returns `401` on a lookup failure rather than calling the handler. Log only `error.message`, never the UUID or session.
- Do not use `req.originalUrl` without normalization when mounted under `/api`; use the mount-relative `req.path` and test the actual mount.
- Do not query support accounts for a normal session or users accounts for a support session.

### Step 2 — Export the middleware from the barrel

Modify `app/middleware/index.js`:

```js
middleware.isAuthenticated = require('./auth.middleware.js').isAuthenticated;
```

If the implementation also needs the factory in tests or other code, export it explicitly:

```js
middleware.createIsAuthenticated = require('./auth.middleware.js').createIsAuthenticated;
```

Do not replace existing middleware exports.

### Step 3 — Register the guard before API route modules

In `app/src/server.js`, after the session middleware is registered and before the first `require('../routes/...')(app)` call:

```js
const { isAuthenticated } = require('../middleware/auth.middleware.js');

// Must be registered before the API route modules below.
app.use('/api', isAuthenticated);

require('../routes/index.js')(app);
require('../routes/password.js')(app);
require('../routes/upload-file.js')(app);
require('../routes/email-marketing.js')(app);
require('../routes/forgot-password.js')(app);
require('../email_controllers/cron-email.controller.js')(app);
```

Ordering requirements:

1. After `app.use(sessionMiddleware)`.
2. Before `require('../routes/index.js')(app)`.
3. Before `require('../routes/sequelize.route.js')(app)`.
4. Before `require('../routes/encrypt.route.js')(app)`.
5. The import must run after `require('dotenv').config()` so the database config sees environment values.

Do not place the guard after the route registrations; Express would already have matched the handlers.

### Step 4 — Reuse or leave the page helper

The safest minimal change is to leave the page route logic in `server.js` untouched except for any extraction needed to avoid duplicate definitions. If you extract `getUserUuidFromSession` and `isUserLoggedIn` into `auth.middleware.js`, update `server.js` to import them and delete the local copies. Preserve existing page behavior:

- A support session must still be treated as "not logged in" by page routes unless the page already handles it separately (`/help-and-support-profile` inspects `status` directly).
- Page routes must still render the login page on failure, not return JSON.

If extraction risks changing page behavior, keep the page helper local and accept the small duplication. The critical requirement is that API and page logic agree on `login_status` semantics.

### Step 5 — Add focused tests

Create `test/006-auth-middleware.test.js` using `node:test`, `node:assert`, `express`, and `fetch`, following `test/051-reset-endpoints-rate-limit.test.js`.

Test the classifier directly and the middleware over HTTP with stubbed models. Do not require a real database.

Suggested test harness:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { once } = require('node:events');

require('dotenv').config();

const { createIsAuthenticated, isPublicApiPath } = require('../app/middleware/auth.middleware.js');

function makeSession(sessionUser) {
    return (req, res, next) => {
        if (sessionUser) req.session = { user: sessionUser };
        next();
    };
}

async function withServer(middleware, sessionUser, run) {
    const app = express();
    app.use(makeSession(sessionUser));
    app.use('/api', middleware);
    app.use('/api', (req, res) => res.status(200).json({ reached: true }));

    const server = app.listen(0);
    await once(server, 'listening');

    try {
        await run(`http://127.0.0.1:${server.address().port}`);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}
```

Test cases:

1. `isPublicApiPath` returns true for login, `/v2/post/registration-v2`, `/post/registration-upload-company-logo`, `/get/categories`, member counts, help/support v2/v3, communicator link, and communicator participants.
2. `isPublicApiPath` returns false for `/get/user`, `/get/users-account`, `/post/update-company-details`, `/post/emails/notify-trader-on-client-contact`, `/v2/export/users-businesses`, `/v2/post/ec`.
3. Public path with no session reaches the handler and never calls the database stubs.
4. Protected path with no session returns `401`, JSON body matches `UNAUTHORIZED_BODY`, and the handler is not reached.
5. Protected path with a session whose UUID decrypts to a UUID and whose `login_status` is `1` returns `200` and reaches the handler.
6. `login_status` values `0`, `null`, `undefined`, and `'0'` are rejected.
7. A malformed/missing/undecryptable UUID is rejected without throwing.
8. A users-account stub that throws causes `401`, not `200`, and does not reach the handler.
9. A support session (`email_address` + `status`) queries `support_accounts`, not `users_accounts`; active support reaches a protected support route; inactive/missing support returns `401`.
10. A normal session never queries `support_accounts`; a support session never queries `users_accounts`.
11. `OPTIONS` requests pass through without a session so CORS preflight is not broken.
12. Trailing slash and case variants normalize consistently (for example `/GET/CATEGORIES/` is public; `/GET/USER/` is protected).
13. The response body does not include the session UUID, email, cookie, or database error text.

Use stub models shaped like Sequelize:

```js
const usersAccounts = {
    findOne: async ({ where, attributes, raw }) => {
        // assert where.uuid, attributes, raw
        return { login_status: 1 };
    },
};
```

If the implementation changes the expected error status from `401` to another fail-closed status, update the tests and this document together. The default decision in this guide is `401` for all authentication failures.

### Step 6 — Verify route classification against real callers

Before finalizing, re-run the inventory search and compare the public list with client callers. At minimum verify:

- `public/assets/js/registration-v2.js` → `/api/v2/post/registration-v2`, `/api/post/password-hashing`.
- All `*-registration*.js`, `*-registration-upload-medias.js`, `upgrade-*-upload-medias.js` → registration vs upgrade classification.
- `public/assets/js/email-verification.js` → `/api/post/email-verification`, `/api/post/resend-email-verification`.
- `public/assets/js/login.js` and `help-and-support-login.js` → login endpoints and `/api/post/compare-password`.
- `public/assets/js/help-and-support.js` → v3 waiting room, update-as-occupied, submit-email-if-help.
- `public/assets/js/help-and-support-profile.js` → create/drop support communicator link and introduction email.
- `public/assets/js/selection.js` → selection, notify, current trader, record meeting, check-if-trader-is-active.
- `public/assets/js/traders-profile*.js`, `customer-service.js` → company/profile reads/writes, avatar, payment email, waiting room.
- `public/assets/js/home.js` and `public/view/all-about-events/index.ejs` → public counts.
- `public/assets/js/client-email-the-trader.js` → submit client email.
- `public/assets/js/header_avatar.js` and pages including `primary-navigation.ejs` → benign unauthenticated avatar call.

If a route has no caller and is not clearly public, default to protected. Mark truly uncertain routes `TO INVESTIGATE` in the work log rather than guessing.

### Step 7 — Run focused tests, then the suite

```bash
node --test test/006-auth-middleware.test.js
npm test
npx prettier --check app/middleware/auth.middleware.js app/middleware/index.js app/src/server.js test/006-auth-middleware.test.js
git diff --check
```

`npm test` may skip integration tests when the database is unavailable. Report skips separately. Do not run `npm run lint` across the whole worktree if it would rewrite unrelated user changes; prefer Prettier on the touched files, then confirm the repository's required formatting command.

### Step 8 — Manual smoke test with the real server

With a configured database and `npm run dev`:

1. Anonymous protected route:

    ```bash
    curl -i -X POST http://localhost:3000/api/get/user
    ```

    Expect `401` and a JSON `Unauthorized` body.

2. Public route:

    ```bash
    curl -i http://localhost:3000/api/get/categories
    ```

    Expect the existing `200` response.

3. Login and reuse the cookie:

    ```bash
    curl -i -c /tmp/awt-cookie.txt -X POST http://localhost:3000/api/post/login-process \
      -H 'Content-Type: application/x-www-form-urlencoded' \
      --data 'loginEmailAddress=...&loginPassword=...'

    curl -i -b /tmp/awt-cookie.txt -X POST http://localhost:3000/api/get/user
    ```

    Expect `200` after a successful login.

4. Logout and retry:

    ```bash
    curl -i -b /tmp/awt-cookie.txt http://localhost:3000/logout
    curl -i -b /tmp/awt-cookie.txt -X POST http://localhost:3000/api/get/user
    ```

    Expect `401` after logout.

5. Support login and a support-only route: log in through `/api/post/help-and-support-login-process`, then call `/api/v2/get/create-help-and-support-communicator-link`. Expect the existing support response, not `401`.

6. Registration and help public flows: load `/registration`, `/login`, `/forgot-password`, `/pricing`, and `/all-about-events`; confirm no primary flow is blocked. The anonymous avatar call may log a `401`; confirm the page renders with placeholders.

7. Verify a normal logged-in user still sees their avatar, and a support agent can reach `/help-and-support-profile` and the support communicator controls.

## 10. Architecture / Existing Patterns

- **Middleware modules:** `app/middleware/` holds single-purpose modules. `password-reset.rate-limit.js` uses a factory plus named default instances; the auth module should follow that style.
- **Barrel export:** `app/middleware/index.js` exposes middleware for route modules. Add auth there rather than requiring the file directly from every route.
- **Sequelize stack:** New code must use `app/db_models` and parameterized `where` objects. Do not add raw SQL or mysql2 calls.
- **Session contract:** `req.session.user.uuid` is AES ciphertext produced by `app/shared/ecdc.js`. Every lookup must decrypt first.
- **Dual session shapes:** Normal users and support agents share `req.session.user` but have different keys and different account tables. The middleware must branch before querying.
- **Route modules:** `module.exports = (app) => {}` registers routes. Global middleware must be registered before those modules.
- **Page authorization:** Page handlers use rendering and redirects. API authorization uses JSON status codes. Do not merge those behaviors.
- **Test pattern:** `node --test` with an ephemeral Express server and `fetch`; no Supertest. Use dependency injection instead of a live database.

## 11. Security Requirements

1. **Deny by default.** Every `/api` route is protected unless explicitly listed as public. New routes are protected automatically.
2. **Server-side validation only.** Never trust `req.body.uuid`, `req.body.email`, `req.session.user.status`, or any client-provided identity.
3. **Database authority.** A normal session is valid only when the decrypted UUID maps to a `users_accounts` row whose `login_status` is `1`. A support session is valid only when the decrypted UUID maps to a `support_accounts` row whose `status` is `1`.
4. **Fail closed.** Missing session, missing/invalid UUID, decryption failure, missing account, inactive account, and database failure must all prevent `next()`. Do not fall back to trusting the cookie.
5. **JSON denial.** Return `401` with a small JSON body. Do not redirect to `/login` and do not return HTML to API clients.
6. **No secret leakage.** Logs and responses must not contain UUIDs, emails, passwords, cookies, session contents, SQL, or stack traces. Log only generic messages and `error.message`.
7. **No auth bypass through path tricks.** Normalize trailing slashes and casing. The mount is `/api`; verify that `/API`, `/api/`, and `//api` behavior matches Express's route matching. Do not combine a case-sensitive check with Express's default case-insensitive routing.
8. **Support isolation.** Validate support sessions against `support_accounts`; never silently accept a support session because it has a UUID. Never accept a normal session against `support_accounts`.
9. **Preflight safety.** Skip auth for `OPTIONS` so CORS preflight continues to work.
10. **No scope creep.** Do not implement role-based authorization, CSRF protection, rate limiting, session rotation, password changes, or IDOR fixes here. Note them as follow-ups.
11. **Keep existing crypto.** Do not change `ecdc`, `JWT_SECRET` usage, session keys, or cookie settings.
12. **Least data.** Query only `login_status` or `status` with `attributes`; do not fetch the password or profile.
13. **Performance.** One indexed lookup per protected request is expected. Do not cache login status, because logout/cron must take effect immediately. If `uuid` is not indexed in production, report it as a separate follow-up.

## 12. Backward Compatibility

Preserve:

- Existing normal-user cookies and support-agent cookies (same encrypted UUID format).
- `/api/post/login-process` response contract (`message: 'found'` and HTTP `200` failures).
- Password-reset response contracts and status codes.
- Registration clients that call `/api/post/password-hashing` and `/api/post/registration-*` before login.
- `/all-about-events` and other public pages; the avatar request may become a benign `401`.
- External MiroTalk callers of `/api/get/communicator-link/:link` and `/api/post/communicator-participants/...`.
- Socket.IO session handling and ring-call behavior.
- Cron auto-logout: after the cron sets `login_status = null`, protected APIs must return `401`.
- Page routes: keep rendering login pages on failure, not JSON.

Intentional behavior changes:

- Anonymous protected API calls now return `401` instead of leaking data, crashing, or returning a `500`.
- Debug endpoints `/api/v2/post/ec` and `/api/v2/post/dc` now require a session until Finding 24 removes them.
- Anonymous public-page avatar calls return `401` instead of crashing with a `500`.

Risks to investigate before shipping:

- Any route currently called without a session that is not in the public allowlist will break. Re-run the caller inventory.
- Any client that assumes a `200` with an HTML login page for an expired session will now see `401`. This is the intended API behavior; verify there is no such caller.
- Newly registered sessions have no `login_status = 1` until login. Confirm no post-registration API call depends on that session.
- `users_accounts.status` (0 pending, 1 verified, 2 disabled) is not enforced by this task. Login itself does not consistently enforce it. Do not add a status check here without a separate decision, because it could lock out pending accounts. Record it as a follow-up.
- Support sessions must not be validated against `users_accounts`; test this explicitly.
- Legacy route aliases may exist under different casing or with trailing slashes; the classifier must normalize consistently.

## 13. Testing Strategy

### Unit tests (no database)

- Public path classifier matrix.
- Normalization of case/trailing slash.
- `isSupportSession` detection for both session shapes.
- UUID decryption success/failure using an injected decrypt function.
- `login_status` numeric semantics.

### HTTP integration tests (stubbed models)

- Public route without session → handler reached, no DB call.
- Protected route without session → `401`, handler not reached.
- Protected route with active normal session → handler reached.
- Protected route with `login_status` `0`/`null`/undefined → `401`.
- Malformed cookie → `401`, no throw.
- DB throw → `401`, no handler.
- Support session active → handler reached through support branch.
- Support session inactive/missing → `401`.
- `OPTIONS` → handler/preflight path, no DB.
- Response body contains no sensitive values.

### Manual regression tests

- Normal login → profile/selection endpoints work.
- Logout → protected endpoints return `401`.
- Cron/auto-logout → protected endpoints return `401`.
- Support login → support communicator link endpoints work.
- Registration → password hashing, registration post, media upload, email verification work.
- Help page → waiting room and submit-email work.
- Public reference data → categories/languages/regions still load.
- `/all-about-events` member counts still load.
- External MiroTalk communicator callbacks still work.
- No changes to page route rendering.

### Commands

```bash
node --test test/006-auth-middleware.test.js
npm test
npx prettier --check app/middleware/auth.middleware.js app/middleware/index.js app/src/server.js test/006-auth-middleware.test.js
git diff --check
```

If the database is unavailable, report integration skips separately from failures. Do not claim a live-database test passed when it skipped.

## 14. Verification / Evidence

Collect and report:

- `git diff --stat` and the exact files changed.
- The route inventory used for the public allowlist, including the caller that justifies each public entry.
- Test command output for `test/006-auth-middleware.test.js`.
- `npm test` summary with pass/fail/skip counts.
- Manual curl evidence for anonymous `401`, public `200`, logged-in `200`, and post-logout `401`.
- Evidence that a support session still reaches support-only routes.
- Evidence that registration, email verification, help/support, and member-count endpoints still work.
- A statement that no secrets/UUIDs/emails were added to logs or responses.
- Any route still marked `TO INVESTIGATE` and why it was left protected/public.
- Confirmation that no unrelated worktree changes were modified.

Suggested evidence snippets:

```text
POST /api/get/user (no cookie)            -> 401 {"status":"error","message":"Unauthorized"}
GET  /api/get/categories (no cookie)      -> 200 [...]
POST /api/get/user (logged-in cookie)     -> 200 {...}
POST /api/get/user (after logout)         -> 401 {"status":"error","message":"Unauthorized"}
POST /api/v2/get/create-help-and-support-communicator-link (support cookie) -> 200/201 (existing contract)
GET  /api/v2/get/number-of-trader-members -> 200 [...]
```

## 15. Do NOT Do

- Do not rely on `req.session.user` mere existence as authentication.
- Do not trust a client-supplied UUID, email, `status`, or `type`.
- Do not apply the `users_accounts.login_status` check to support sessions.
- Do not query `support_accounts` for normal user sessions.
- Do not change the UUID encryption algorithm, key, cookie settings, or session shape.
- Do not redirect API requests to `/login` or return HTML.
- Do not add auth to page routes, static assets, Socket.IO, cron, or the logout route.
- Do not protect the public registration/login/password-reset/verification/reference-data/help/MiroTalk routes listed in this guide.
- Do not remove `/api/post/password-hashing` or `/api/post/compare-password`; that is Finding 5.
- Do not remove the debug AES routes; that is Finding 24.
- Do not add rate limiting; that is Finding 51.
- Do not add migrations, schema changes, indexes, or model associations.
- Do not modify unrelated upload/registration/email controllers unless a verified route classification requires it.
- Do not log UUIDs, emails, cookies, sessions, passwords, or raw database errors.
- Do not run repository-wide Prettier if it would rewrite unrelated uncommitted changes.
- Do not commit unless explicitly asked.
- Do not claim a browser or database test passed without running it.

## 16. Acceptance Criteria

- [ ] `app/middleware/auth.middleware.js` exists and exports `isAuthenticated`, `createIsAuthenticated`, and `isPublicApiPath`.
- [ ] `app/middleware/index.js` exposes the middleware without breaking existing exports.
- [ ] `app/src/server.js` registers `app.use('/api', isAuthenticated)` before the first API route module.
- [ ] An anonymous request to a protected route returns `401` JSON and does not invoke the route handler.
- [ ] An active normal session (`login_status = 1`) can call protected routes.
- [ ] A normal session with `login_status` `0`/`null`/undefined is rejected.
- [ ] A missing, malformed, or undecryptable UUID is rejected without throwing.
- [ ] A database lookup failure fails closed and does not invoke the handler.
- [ ] Support sessions validate against `support_accounts.status = 1` and continue to reach support-only routes.
- [ ] Normal sessions are not validated against `support_accounts`; support sessions are not validated against `users_accounts`.
- [ ] Public login, registration, email verification, password hashing, reference-data, member-count, help/support, and MiroTalk callback routes still work without a session.
- [ ] Registration upload routes under `/api/post/registration-*` remain public.
- [ ] Update/upgrade/upload/email/export/debug routes are protected.
- [ ] Logout and cron auto-logout cause subsequent protected API calls to return `401`.
- [ ] No page route behavior changes.
- [ ] Socket.IO ring-call behavior is unchanged.
- [ ] Focused tests pass and `npm test` results are reported (including skips).
- [ ] No sensitive values appear in logs or response bodies.
- [ ] No unrelated files are modified; no secrets are added; no commit is created.

## 17. Expected Final Report Template

```markdown
## Summary

Implemented/verified API authentication middleware for Finding 6.

## Files changed

- `app/middleware/auth.middleware.js` (added)
- `app/middleware/index.js` (modified)
- `app/src/server.js` (modified)
- `test/006-auth-middleware.test.js` (added)
- `docs/tasks/006-No-Authentication-Middleware-on-API-Routes.md` (if updated)
- ...

## Behavior

- Public allowlist: ...
- Normal session validation: ...
- Support session validation: ...
- Protected response: `401 {"status":"error","message":"Unauthorized"}`

## Route classification notes

- Public: ...
- Protected: ...
- `TO INVESTIGATE`: ...

## Verification

- `node --test test/006-auth-middleware.test.js`: pass/fail/skip
- `npm test`: pass/fail/skip (database skips noted)
- Manual: anonymous 401, public 200, logged-in 200, post-logout 401, support flow 200
- Formatting: ...
- `git diff --check`: ...

## Risks / follow-ups

- Finding 5 (bcrypt oracle) still needs its own change.
- Finding 24 (debug AES endpoints) still needs removal.
- Finding 51 (rate limiting) separate.
- Anonymous `header_avatar.js` calls now receive `401`; consider guarding that script separately.
- UUID index verification/performance follow-up if needed.

## Not done

- No commit.
- No schema changes.
- No unrelated files touched.
```

## 18. Important Rules

1. Read the current code and tests before editing; line numbers in this guide may have drifted.
2. Use the Sequelize data layer for new code. Do not add mysql2/raw SQL.
3. Follow existing middleware/style conventions and Prettier settings.
4. Preserve all unrelated worktree changes; never revert or reformat them.
5. Prefer the smallest change that closes the finding. Do not refactor unrelated controllers.
6. Verify every public route against a real caller; when in doubt, protect it and report the uncertainty.
7. Keep page and API failure behavior separate: pages render/redirect, APIs return JSON.
8. Never weaken cryptography, session settings, or cookie flags.
9. Never log credentials or PII.
10. Run focused tests, the repository suite, formatting checks, and manual smoke tests appropriate to the environment.
11. Report skips and untested paths honestly.
12. Do not commit unless explicitly requested.

## 19. Output Requirements

- Produce a Markdown implementation task/result document with all sections above.
- If asked to implement: make only the files listed in the impact table, run the verification commands, and report actual results.
- If asked to review: do not edit production code; report whether the finding is still present and what the next safe step is.
- Include exact commands and observed status codes/messages in the final report.
- Do not include secrets, `.env` values, UUIDs, emails, cookies, or database connection details.
- Do not claim tests passed if they were skipped or not run.
- Keep the public allowlist and route inventory in the final report so future changes can be audited.
