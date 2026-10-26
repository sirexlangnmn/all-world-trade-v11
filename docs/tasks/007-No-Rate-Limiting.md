# AI Task: Add API-Wide and Authentication-Sensitive Rate Limiting

> **Finding:** `CODE_REVIEW.md` — Finding 7: No Rate Limiting
> **Task file:** `docs/tasks/007-No-Rate-Limiting.md`
> **Severity:** Not assigned a numeric severity in `CODE_REVIEW.md`; the roadmap lists it as Low effort / high security value (priority #10).
> **Related tasks already implemented or in progress:**
>
> - Finding 51 / `docs/tasks/051-Missing-Rate-Limiting-on-Reset-Endpoints.md` — password-reset endpoints already have dedicated limiters.
> - Finding 6 / `docs/tasks/006-No-Authentication-Middleware-on-API-Routes.md` — `/api` routes already have deny-by-default authentication.
>
> **This task must not duplicate or replace those fixes.** It adds the missing general API limiter and the strict login limiter, and it verifies the existing reset limiters still work.

## 1. Task Title

**Apply a general `/api` rate limit and a strict limit to login endpoints without breaking existing authenticated, registration, reset, upload, Socket.IO, or static-asset flows.**

## 2. Objective

Add rate limiting at the Express middleware layer so that:

1. Every `/api` request is counted per client IP with a general limit of 100 requests per 15 minutes.
2. Login and support-login requests are additionally limited to 5 attempts per 15 minutes per IP.
3. Rate-limited requests receive HTTP `429` with a generic body and standard rate-limit headers.
4. Blocked requests never reach validation, controllers, models, the database, bcrypt, SMTP, or file handling.
5. Existing password-reset limiters remain in place and keep their current behavior.
6. Normal requests below the limits behave exactly as they do today.
7. Static assets, uploads, Socket.IO, and published registration flows are not accidentally throttled into failure.

The expected outcome is that an attacker can no longer make unlimited login attempts or unlimited API calls, while legitimate users continue to use the marketplace normally.

The implementing agent must first verify the current state of the repository. Do not assume the code snippets in this document are still exact; use the live source as authority.

## 3. Problem / Finding

### Finding as reported

`CODE_REVIEW.md` reports that there is no rate limiting anywhere in `app/src/server.js`. The login endpoint, registration endpoints, and password-reset endpoints are vulnerable to brute-force, credential stuffing, fake-registration flooding, email enumeration, and resource-exhaustion attacks.

The recommended implementation is:

1. Install `express-rate-limit`.
2. Create a general limit of 100 requests per 15 minutes per IP.
3. Create a stricter limit of 5 attempts per 15 minutes per IP for authentication-sensitive endpoints.
4. Apply the strict limit to `/api/post/login-process`, `/api/post/forgot-password-process`, and `/api/post/create-reset-token`.
5. Add the limiter in `server.js`.

### Current repository state — verify before acting

At the time this guide was written:

- `express-rate-limit@8.7.1` is already listed in `package.json` and installed in `node_modules`.
- `app/middleware/rate-limit/password-reset.rate-limit.js` already exists and applies 5 requests per 15 minutes to the reset endpoints.
- `app/routes/index.js` already applies `middleware.passwordResetRateLimit.forgotPasswordProcessLimiter` to `POST /api/post/forgot-password-process`.
- `app/routes/forgot-password.js` already applies limiters to `create-reset-token`, `send-email-for-change-password`, the GET reset page, and the POST reset submission.
- `app/middleware/auth.middleware.js` already exists and is mounted with `app.use('/api', isAuthenticated)` before the API route modules.
- `app/src/server.js` already sets `app.set('trust proxy', 'loopback')`.
- There is still **no general `/api` limiter** and **no strict limiter on login or support login**.
- `POST /api/post/login-process` currently runs validation and bcrypt work without any throttling.
- `POST /api/post/help-and-support-login-process` currently runs without throttling.
- Registration submission routes are only covered by whatever general limiter is added by this task; there is no registration-specific limiter.

Do not claim the finding is “already fixed” because password-reset endpoints are limited. The general API and login attack surface is still open.

### Why this is unsafe

Without a general limiter:

- An attacker can send unlimited requests to expensive endpoints such as search, PDF export, media upload, and registration.
- An attacker can attempt unlimited username/password combinations against login.
- An attacker can flood registration endpoints with fake accounts.
- An attacker can consume database connections and process CPU until legitimate users are denied service.

Without a strict login limiter:

- bcrypt comparisons and database lookups can be driven at high volume.
- Credential-stuffing attempts are effectively unlimited.
- Login failures can be used to probe account existence if response timing or messages differ.

## 4. Affected Functionality

### Primary affected routes

| Route                                                                                                                     | Current protection            | Target protection                                        |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------- |
| `POST /api/post/login-process`                                                                                            | Validation only               | General API limiter + strict login limiter               |
| `POST /api/post/help-and-support-login-process`                                                                           | None                          | General API limiter + strict support-login limiter       |
| `POST /api/post/forgot-password-process`                                                                                  | Reset limiter 5/15 min        | General API limiter + existing reset limiter (unchanged) |
| `POST /api/post/create-reset-token`                                                                                       | Reset limiter 5/15 min        | General API limiter + existing reset limiter (unchanged) |
| `POST /api/post/send-email-for-change-password`                                                                           | Reset limiter 5/15 min        | General API limiter + existing reset limiter (unchanged) |
| `GET /reset-password/:token`                                                                                              | Reset page limiter 30/15 min  | Existing reset page limiter (unchanged)                  |
| `POST /reset-password/:token`                                                                                             | Reset submit limiter 5/15 min | Existing reset submit limiter (unchanged)                |
| Every other `/api/...` route                                                                                              | No general limit              | General API limiter 100/15 min                           |
| Public registration routes under `/api/post/registration-*`, `/api/post/looking-for-*`, and `/api/v2/post/*registration*` | No general limit              | General API limiter 100/15 min                           |
| Authenticated profile/search/upload/export routes                                                                         | No general limit              | General API limiter 100/15 min                           |

### Request flow after the change

```text
Client
   ↓
CORS / compression
   ↓
GENERAL /api LIMITER (new, IP keyed)
   ↓
body parsers
   ↓
express-session
   ↓
isAuthenticated (existing deny-by-default /api guard)
   ↓
route-specific limiter (strict login limiter, or existing reset limiter)
   ↓
validation middleware
   ↓
controller / route handler
   ↓
service / model
   ↓
database / SMTP / filesystem
   ↓
response
```

The order matters. A blocked request must stop at the limiter and never reach the controller or its side effects.

### Explicitly out of scope

- Nginx or other reverse-proxy rate limiting. That may be added separately, but this task is an application-level fix.
- Redis or any shared rate-limit store.
- Account-based or email-based lockout. IP-based limiting is the requested approach.
- Removing the public bcrypt oracle (`app/routes/password.js`) — that is Finding 5.
- Removing debug endpoints in `app/routes/encrypt.route.js` — that is a separate finding.
- File upload validation and limits — that is Finding 12.
- Password-reset token semantics, email templates, and password hashing.
- Socket.IO signaling. Socket.IO does not pass through Express `/api` middleware, and this task must not attempt to rate-limit Socket.IO.
- Static files under `public/`. They are served by `express.static` and must not consume the API budget.

## 5. Investigation Phase

Complete these checks before editing anything.

### 5.1 Read the project context

1. Read `README.md` sections:
    - §3 System Architecture
    - §7 Backend Architecture and middleware stack
    - §12 Authentication & Security
    - §13 Deployment Architecture
    - §19 Testing Strategy
2. Read `AGENTS.md` for repository conventions, especially the boot sequence and test commands.
3. Read `CODE_REVIEW.md` Finding 7, Finding 5, Finding 6, Finding 10, Finding 11, Finding 24, and Finding 51.
4. Read this task file completely before making changes.

### 5.2 Establish a clean baseline

Run:

```bash
git status
git diff --stat
```

The worktree may already contain unrelated changes from earlier findings. Do not revert, overwrite, or reformat them. Preserve every unrelated change.

Run the focused baseline tests:

```bash
node --test test/051-reset-endpoints-rate-limit.test.js
node --test test/006-auth-middleware.test.js
node --test test/login.test.js
node --test test/password-reset.test.js
node --test test/049-reset-token-invalidation-and-expiry.test.js
node --test test/050-forgot-password-response.test.js
```

Record failures that already exist before this task. Do not “fix” unrelated failures as part of this change.

### 5.3 Verify the current rate-limit state

Search for every existing limiter:

```bash
rg -n "express-rate-limit|rateLimit|rate-limit|RateLimit|429" app test package.json
```

Confirm:

- Which routes already have limiters.
- Which limiter instances exist.
- What windows, limits, headers, and messages they use.
- Whether `app.use('/api', ...)` currently exists for rate limiting or only for authentication.
- Whether `trust proxy` is already set safely.

### 5.4 Inspect the live boot sequence

Inspect `app/src/server.js` and record the exact order of:

- `app.set('trust proxy', ...)`
- CORS
- compression
- `express.urlencoded(...)`
- `express.json()`
- `express-session`
- nonce/header middleware
- `app.use('/api', isAuthenticated)`
- every `require('../routes/...')(app)`
- `express.static(...)`
- the trailing-slash/body error middleware
- page GET routes
- Socket.IO setup

Do not rely on the line numbers in this document.

### 5.5 Inspect the route modules

Inspect:

- `app/routes/index.js`
- `app/routes/sequelize.route.js`
- `app/routes/forgot-password.js`
- `app/routes/upload-file.js`
- `app/routes/email-marketing.js`
- `app/routes/password.js`
- `app/routes/encrypt.route.js`
- `app/middleware/index.js`
- `app/middleware/auth.middleware.js`
- `app/middleware/rate-limit/password-reset.rate-limit.js`

Build a route inventory. For every `app.get` and `app.post` registration, record:

- Method and path
- Whether it is public (allowed by `PUBLIC_API_PATHS` / `PUBLIC_API_PATTERNS` in `auth.middleware.js`)
- Whether it already has a limiter
- Whether it performs expensive work (database, bcrypt, SMTP, file processing, PDF generation)

### 5.6 Inspect client behavior

Inspect at least:

- `public/assets/js/login.js`
- `public/assets/js/help-and-support-login.js`
- `public/assets/js/forgot-password.js`
- `public/assets/js/reset-password.js`
- `public/assets/js/header_avatar.js`
- `public/assets/js/selection.js`

Determine how each client handles non-2xx responses. Most use jQuery `success` callbacks only. The implementing agent must add minimal `error` handling for the login screens so a `429` is visible, without changing success behavior.

### 5.7 Verify deployment topology for IP limiting

Confirm from `README.md` §13 and the live server:

- Whether the application is behind Nginx.
- Whether Nginx appends `X-Forwarded-For`.
- Whether `app.set('trust proxy', 'loopback')` is present.
- Whether the app runs as one process or multiple PM2 cluster workers.

Do **not** set `trust proxy` to `true`. Do **not** change `trust proxy` unless the live deployment topology proves the current value wrong. If the topology cannot be verified, report it as a residual risk rather than guessing.

### 5.8 Check the existing test style

Read:

- `test/051-reset-endpoints-rate-limit.test.js`
- `test/006-auth-middleware.test.js`
- `test/login.test.js`
- `test/password-reset.test.js`

Use `node:test` and `node:assert`. Do not add Jest, Mocha, Supertest, or a mocking dependency.

### 5.9 Identify all possible limiter placements

Evaluate these placements and choose the one that satisfies all of the following:

- Covers every `/api` route, including routes registered later in `sequelize.route.js` and `encrypt.route.js`.
- Does not cover static assets or page assets.
- Runs before authentication so unauthenticated floods do not cause database session/account lookups.
- Runs before expensive body parsing where possible.
- Preserves `req.path` expectations inside `isAuthenticated`, which is mounted at `/api`.

Document the chosen placement in the final report.

## 6. File Impact Analysis

| File                                                     | Role                                   | Action                                           | Reason                                                                                                                                                                                                  |
| -------------------------------------------------------- | -------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/middleware/rate-limit/api.rate-limit.js`            | New general and auth rate-limit module | `ADD`                                            | Owns the general 100/15 limiter, strict 5/15 limiter, shared options, and JSON message.                                                                                                                 |
| `app/middleware/index.js`                                | Middleware barrel                      | `MODIFY`                                         | Export the new module consistently with the existing `passwordResetRateLimit` export.                                                                                                                   |
| `app/src/server.js`                                      | Boot sequence and middleware mounts    | `MODIFY`                                         | Mount the general limiter on `/api` before authentication and before the first API route module. Do not change Socket.IO, static files, or page routes.                                                 |
| `app/routes/index.js`                                    | Legacy API registrations               | `MODIFY`                                         | Apply the strict login limiter to `POST /api/post/login-process` and `POST /api/post/help-and-support-login-process`, before validation/handlers.                                                       |
| `app/middleware/rate-limit/password-reset.rate-limit.js` | Existing reset limiters                | `REFERENCE ONLY`                                 | Confirm it remains untouched and still exports the five limiters. Do not duplicate its logic.                                                                                                           |
| `app/routes/forgot-password.js`                          | Reset route registrations              | `REFERENCE ONLY`                                 | Confirm reset limiters are still applied. Do not change reset behavior.                                                                                                                                 |
| `app/middleware/auth.middleware.js`                      | Deny-by-default API auth               | `REFERENCE ONLY`                                 | The general limiter must run before this middleware. Do not change the public allowlist.                                                                                                                |
| `app/routes/sequelize.route.js`                          | v2/v3 API registrations                | `REFERENCE ONLY`                                 | Verify these routes are covered by the `/api` mount. Do not add per-route limiters unless required for login.                                                                                           |
| `app/routes/upload-file.js`                              | Registration and media uploads         | `REFERENCE ONLY`                                 | Verify registration uploads remain public and are covered only by the general `/api` limit.                                                                                                             |
| `app/routes/email-marketing.js`                          | Contact email APIs                     | `REFERENCE ONLY`                                 | Covered by the general `/api` limiter. Do not change email behavior.                                                                                                                                    |
| `app/routes/password.js`                                 | Public bcrypt endpoints                | `REFERENCE ONLY`                                 | Covered by the general limiter. Do not remove here (Finding 5 does that separately).                                                                                                                    |
| `app/routes/encrypt.route.js`                            | Debug AES endpoints                    | `REFERENCE ONLY`                                 | Covered by the general limiter until removed separately.                                                                                                                                                |
| `public/assets/js/login.js`                              | Login client                           | `MODIFY`                                         | Show a visible message for HTTP `429`; preserve success behavior.                                                                                                                                       |
| `public/assets/js/help-and-support-login.js`             | Support login client                   | `MODIFY`                                         | Show a visible message for HTTP `429`; preserve success behavior.                                                                                                                                       |
| `public/assets/js/forgot-password.js`                    | Reset client                           | `REFERENCE ONLY`                                 | Already handles `429` from Finding 51. Verify, do not rewrite.                                                                                                                                          |
| `public/assets/js/reset-password.js`                     | Reset client                           | `REFERENCE ONLY`                                 | Already handles `429` from Finding 51. Verify, do not rewrite.                                                                                                                                          |
| `test/007-general-rate-limit.test.js`                    | New acceptance tests                   | `ADD`                                            | Prove limit behavior, route wiring, generic body, IP isolation, and constants without a database or SMTP.                                                                                               |
| `README.md`                                              | Security and deployment documentation  | `MODIFY` only for stale rate-limiting statements | §3.4 and §12.4 currently say rate limiting “should be added” at the proxy layer. Update those lines to describe the in-app limiter and optional proxy-layer defense. Do not rewrite unrelated sections. |
| `AGENTS.md`                                              | AI repository instructions             | `REFERENCE ONLY`                                 | Do not change unless the user explicitly asks. Preserve all existing instructions.                                                                                                                      |
| `CODE_REVIEW.md`                                         | Finding source                         | `REFERENCE ONLY`                                 | Do not modify the review document.                                                                                                                                                                      |

No database migration is required. No schema change is allowed.

## 7. Current Implementation

### 7.1 Boot sequence

At the time this guide was written, `app/src/server.js` contains, in summary:

```js
app.set('trust proxy', 'loopback');

app.use(
    cors({
        /* whitelist */
    }),
);
app.use(compression());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(sessionMiddleware);
// nonce/header middleware

const { isAuthenticated, isUserLoggedIn } = require('../middleware/auth.middleware.js');

// Deny-by-default for /api; the middleware owns the explicit public allowlist.
app.use('/api', isAuthenticated);

require('../routes/index.js')(app);
require('../routes/password.js')(app);
require('../routes/upload-file.js')(app);
require('../routes/email-marketing.js')(app);
require('../routes/forgot-password.js')(app);
require('../email_controllers/cron-email.controller.js')(app);

app.use(express.static(path.join(__dirname, '../../', 'public')));

require('../routes/sequelize.route.js')(app);
require('../routes/encrypt.route.js')(app);
```

There is no general rate limiter before `isAuthenticated`, and therefore no limiter before the API route modules.

### 7.2 Login routes

`app/routes/index.js` currently has:

```js
app.post(['/api/post/login-process'], middleware.login_process, login.create);

app.post(['/api/post/help-and-support-login-process'], helpAndSupportLogin.create);
```

The login route has validation but no rate limit. The support-login route has neither validation nor a rate limit.

### 7.3 Reset routes

`app/routes/index.js` already has:

```js
app.post(
    ['/api/post/forgot-password-process'],
    middleware.passwordResetRateLimit.forgotPasswordProcessLimiter,
    forgotPassword.create,
);
```

`app/routes/forgot-password.js` already applies:

- `createResetTokenLimiter`
- `sendResetEmailLimiter`
- `resetPasswordPageLimiter`
- `resetPasswordSubmitLimiter`

These are working and must not be duplicated or removed.

### 7.4 Existing limiter pattern

`app/middleware/rate-limit/password-reset.rate-limit.js` uses:

```js
const { rateLimit } = require('express-rate-limit');

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const STRICT_LIMIT = 5;
const RESET_PAGE_LIMIT = 30;

const RATE_LIMIT_JSON_MESSAGE = {
    status: 'error',
    message: 'Too many requests. Please try again later.',
};
const RATE_LIMIT_TEXT_MESSAGE = 'Too many requests. Please try again later.';

function createPasswordResetRateLimiter({
    windowMs = FIFTEEN_MINUTES_MS,
    limit = STRICT_LIMIT,
    message = RATE_LIMIT_JSON_MESSAGE,
} = {}) {
    return rateLimit({
        windowMs,
        limit,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        statusCode: 429,
        message,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
    });
}
```

Follow this established pattern. Do not invent a different response format or a custom counter.

### 7.5 Login client behavior

`public/assets/js/login.js` currently looks similar to:

```js
$.ajax({
    url: '/api/post/login-process',
    type: 'POST',
    data: formLogin.serialize(),
    success: function (res) {
        if (res.message === 'found') {
            window.location.replace('/selection');
        } else if (res.message !== 'found') {
            Swal.fire('Error', res.message, 'error');
        } else {
            Swal.fire('Error', 'Please check your email address and password', 'error');
        }
    },
});
```

There is no `error` callback. A `429` response will currently produce no visible feedback and will leave the user on the form with no explanation. The support-login client has the same issue.

## 8. Current → Target

### Current

```text
Every /api request (except reset endpoints)
   ↓
authentication
   ↓
validation
   ↓
controller
   ↓
database / bcrypt / SMTP / filesystem

No global limit.
No login limit.
An attacker can repeat requests forever.
Password-reset endpoints are already limited, but login and the rest of /api are not.
```

### Target

```text
Every /api request
   ↓
GENERAL /api LIMITER — 100 requests / 15 min / IP
   ↓ (blocked → 429, handler never runs)
body parsing / session / authentication
   ↓
login or support-login?
   ↓ yes
STRICT LOGIN LIMITER — 5 requests / 15 min / IP
   ↓ (blocked → 429, validation and bcrypt never run)
validation / controller / database

Password-reset routes keep their existing dedicated limiters.
Static assets and Socket.IO are not counted by the /api limiter.
```

### Intended code pattern

The exact placement depends on the live `server.js`. Use this as the intended pattern and adapt it to the actual boot order:

```js
const { generalApiLimiter } = require('../middleware/rate-limit/api.rate-limit.js');

// General API protection. Mounted before authentication and before every API
// route module, but after CORS/compression and before body parsing so floods
// are rejected cheaply. This must remain scoped to '/api'; do not mount an
// unscoped app.use(limiter) that would also count static assets and pages.
app.use('/api', generalApiLimiter);

app.use('/api', isAuthenticated);

require('../routes/index.js')(app);
// ...
```

Route-level strict limiter:

```js
const apiRateLimit = middleware.apiRateLimit;

app.post(['/api/post/login-process'], apiRateLimit.loginLimiter, middleware.login_process, login.create);

app.post(['/api/post/help-and-support-login-process'], apiRateLimit.supportLoginLimiter, helpAndSupportLogin.create);
```

Client handling:

```js
// public/assets/js/login.js and public/assets/js/help-and-support-login.js
error: function (xhr) {
    if (xhr && xhr.status === 429) {
        Swal.fire('Too many attempts', 'Please try again later.', 'warning');
    }
},
```

Keep the existing success callbacks unchanged. Do not add a generic error alert for non-429 failures unless the file already had one.

## 9. Detailed Implementation Plan

### Step 1 — Inspect and baseline

Complete §5 first. Record:

- Exact current middleware order in `server.js`.
- Every existing limiter and its route.
- The `trust proxy` value.
- The current `package.json` state for `express-rate-limit`.
- Baseline test results.

Do not edit before this is done.

### Step 2 — Confirm the dependency

Run:

```bash
npm ls express-rate-limit
node -e "const { rateLimit } = require('express-rate-limit'); console.log(typeof rateLimit)"
```

If `express-rate-limit` is already installed, do not reinstall it and do not change the version. If it is missing, install only that package:

```bash
npm install express-rate-limit
```

Review the `package.json` and `package-lock.json` diff. Do not add Redis, a store adapter, a mocking library, or a test framework.

### Step 3 — Create the limiter module

Create `app/middleware/rate-limit/api.rate-limit.js` following the existing reset limiter style.

Required exports:

- `FIFTEEN_MINUTES_MS`
- `GENERAL_API_LIMIT` (100)
- `AUTH_LIMIT` (5)
- `RATE_LIMIT_JSON_MESSAGE`
- `createApiRateLimiter` — factory for tests
- `generalApiLimiter` — 100 requests / 15 minutes
- `loginLimiter` — 5 requests / 15 minutes
- `supportLoginLimiter` — 5 requests / 15 minutes

Suggested implementation:

```js
'use strict';

const { rateLimit } = require('express-rate-limit');

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const GENERAL_API_LIMIT = 100;
const AUTH_LIMIT = 5;

const RATE_LIMIT_JSON_MESSAGE = {
    status: 'error',
    message: 'Too many requests. Please try again later.',
};

function createApiRateLimiter({
    windowMs = FIFTEEN_MINUTES_MS,
    limit = GENERAL_API_LIMIT,
    message = RATE_LIMIT_JSON_MESSAGE,
} = {}) {
    return rateLimit({
        windowMs,
        limit,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        statusCode: 429,
        message,
        skip: (req) => req.method === 'OPTIONS',
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
    });
}

const generalApiLimiter = createApiRateLimiter();
const loginLimiter = createApiRateLimiter({ limit: AUTH_LIMIT });
const supportLoginLimiter = createApiRateLimiter({ limit: AUTH_LIMIT });

module.exports = {
    FIFTEEN_MINUTES_MS,
    GENERAL_API_LIMIT,
    AUTH_LIMIT,
    RATE_LIMIT_JSON_MESSAGE,
    createApiRateLimiter,
    generalApiLimiter,
    loginLimiter,
    supportLoginLimiter,
};
```

Requirements:

- Use the default IP key. Do not write a custom `keyGenerator`.
- Do not use account, email, UUID, or session-based keys.
- Do not skip loopback, private IPs, localhost, health checks, or development mode.
- Skip only `OPTIONS` so CORS preflight is not throttled.
- Keep `skipSuccessfulRequests` and `skipFailedRequests` false.
- Return a generic JSON body with no user-controlled values.
- Do not log request bodies.

If `express-rate-limit@8` emits a validation warning about `X-Forwarded-For`, verify the existing `trust proxy` setting instead of disabling validation.

### Step 4 — Export through the middleware barrel

Modify `app/middleware/index.js`:

```js
middleware.apiRateLimit = require('./rate-limit/api.rate-limit.js');
```

Keep the existing exports and ordering style. Do not remove or rename any existing export.

### Step 5 — Mount the general `/api` limiter

In `app/src/server.js`, mount the general limiter on `/api` before authentication and before the first API route module.

The intended order:

```js
const { generalApiLimiter } = require('../middleware/rate-limit/api.rate-limit.js');

app.use('/api', generalApiLimiter);

const { isAuthenticated, isUserLoggedIn } = require('../middleware/auth.middleware.js');

app.use('/api', isAuthenticated);

require('../routes/index.js')(app);
// ... other route modules
```

Placement rules:

- It must run before `app.use('/api', isAuthenticated)`.
- It must run before `require('../routes/index.js')(app)` and all later API route modules.
- It must be scoped to `/api`. Do not use an unscoped `app.use(limiter)` that counts static files, uploaded media, or page requests.
- Prefer mounting it before `express.urlencoded` / `express.json` so malformed or oversized API bodies are rejected before parsing effort. If the agent chooses to mount after body parsers, explain why in the final report, but keep it before authentication.
- Do not change the CORS whitelist, static file handling, session configuration, Socket.IO setup, page routes, or any existing middleware order beyond inserting this limiter.

### Step 6 — Apply the strict login limiter

In `app/routes/index.js`, apply the strict limiter as the first route-specific middleware on both login endpoints:

```js
const apiRateLimit = middleware.apiRateLimit;

app.post(['/api/post/login-process'], apiRateLimit.loginLimiter, middleware.login_process, login.create);

app.post(['/api/post/help-and-support-login-process'], apiRateLimit.supportLoginLimiter, helpAndSupportLogin.create);
```

Rules:

- Use separate limiter instances for normal login and support login. Do not share one bucket between the two flows.
- Keep the existing validation middleware on `/api/post/login-process`.
- Do not reorder validation before the limiter. The limiter must run first.
- Do not change route path arrays or aliases.
- Do not change controller, model, query, or response behavior.
- Do not add a strict limiter to registration, reset, or other endpoints in this task; the general limiter covers them, and reset endpoints already have their own.

### Step 7 — Verify the reset limiters remain intact

Inspect `app/routes/forgot-password.js` and `app/routes/index.js`.

Requirements:

- `createResetTokenLimiter` is still applied to `POST /api/post/create-reset-token`.
- `sendResetEmailLimiter` is still applied to `POST /api/post/send-email-for-change-password`.
- `resetPasswordPageLimiter` is still applied to `GET /reset-password/:token`.
- `resetPasswordSubmitLimiter` is still applied to `POST /reset-password/:token`.
- `forgotPasswordProcessLimiter` is still applied to `POST /api/post/forgot-password-process`.
- Do not change their limits, windows, messages, or order.
- Do not remove or replace `app/middleware/rate-limit/password-reset.rate-limit.js`.

### Step 8 — Add client `429` handling for login

Modify `public/assets/js/login.js` and `public/assets/js/help-and-support-login.js`.

Add an `error` callback to the login AJAX request. On `xhr.status === 429`, show a warning using the existing SweetAlert2 pattern:

```js
error: function (xhr) {
    if (xhr && xhr.status === 429) {
        Swal.fire('Too many attempts', 'Please try again later.', 'warning');
    }
},
```

Requirements:

- Do not change the success callback.
- Do not change redirects, messages, selectors, or form serialization.
- Do not add a generic “something went wrong” alert for non-429 errors unless one already existed.
- Do not change `public/assets/js/forgot-password.js` or `public/assets/js/reset-password.js`; they already handle the reset limiter.

### Step 9 — Update stale documentation

`README.md` currently says rate limiting should be added at the Nginx layer. Update only the verified stale statements:

- §3.4 Security Considerations
- §12.2 Security Measures table
- §12.4 API Security

State that:

- `/api` requests have an in-app general limit of 100 requests per 15 minutes per IP.
- Login and support login have a stricter in-app limit of 5 requests per 15 minutes per IP.
- Password-reset endpoints retain their dedicated stricter limiters.
- Proxy-layer rate limiting remains optional defense-in-depth.

Do not rewrite unrelated README sections. Do not modify `CODE_REVIEW.md`.

### Step 10 — Add focused tests

Create `test/007-general-rate-limit.test.js` using `node:test` and `node:assert`. Follow the ephemeral-server style of `test/051-reset-endpoints-rate-limit.test.js`.

The tests must prove:

1. The factory allows exactly N requests and rejects N+1 with `429`.
2. The blocked request does not invoke the wrapped handler.
3. The `429` body is generic and does not contain the submitted email, password, or username.
4. The `429` response includes `Retry-After` and a standardized `RateLimit-*` header.
5. Different IPs receive independent buckets when the request goes through a trusted loopback proxy.
6. `OPTIONS` requests are skipped.
7. Production constants are `100` requests / `15` minutes for the general limiter and `5` requests / `15` minutes for the login limiter.
8. `app/src/server.js` mounts `generalApiLimiter` on `/api` before `isAuthenticated` and before the first API route `require`.
9. `app/routes/index.js` applies `loginLimiter` before `middleware.login_process` and applies `supportLoginLimiter` to the support login route.
10. `public/assets/js/login.js` and `public/assets/js/help-and-support-login.js` contain a `429` error handler.

Suggested test skeleton:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const express = require('express');

const {
    createApiRateLimiter,
    FIFTEEN_MINUTES_MS,
    GENERAL_API_LIMIT,
    AUTH_LIMIT,
    RATE_LIMIT_JSON_MESSAGE,
} = require('../app/middleware/rate-limit/api.rate-limit.js');

async function withServer(limiter, handler, run, method = 'post') {
    const app = express();
    app.set('trust proxy', 'loopback');
    app.use(express.urlencoded({ extended: true }));
    app[method]('/probe', limiter, handler);

    const server = app.listen(0);
    await once(server, 'listening');

    try {
        await run(`http://127.0.0.1:${server.address().port}`);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

test('allows N requests and rejects N+1 without invoking the handler', async () => {
    let handlerCalls = 0;
    const limiter = createApiRateLimiter({ windowMs: 60_000, limit: 3 });
    const handler = (req, res) => {
        handlerCalls += 1;
        res.send('ok');
    };

    await withServer(limiter, handler, async (base) => {
        const send = () =>
            fetch(`${base}/probe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Forwarded-For': '203.0.113.10',
                },
                body: 'emailAddress=user%40example.com&password=secret',
            });

        for (let i = 0; i < 3; i += 1) {
            const response = await send();
            assert.strictEqual(response.status, 200);
            await response.text();
        }

        const blocked = await send();
        assert.strictEqual(blocked.status, 429);
        assert.strictEqual(handlerCalls, 3);
        assert.ok(blocked.headers.get('retry-after'));
        assert.ok(blocked.headers.get('ratelimit') || blocked.headers.get('ratelimit-limit'));

        const body = await blocked.text();
        assert.ok(body.includes(RATE_LIMIT_JSON_MESSAGE.message));
        assert.ok(!body.includes('user@example.com'));
        assert.ok(!body.includes('secret'));
    });
});
```

Additional tests must include:

- Independent buckets for two `X-Forwarded-For` values through `trust proxy: 'loopback'`.
- A direct non-loopback connection with rotating `X-Forwarded-For` values cannot evade the limiter. If no non-loopback interface is available, skip that test and report it as a skip.
- `OPTIONS /probe` does not consume the POST bucket.
- Source-order assertions for `server.js` and `routes/index.js`.

Do not hit the database, bcrypt, SMTP, or filesystem in these tests. Do not add a mocking library.

### Step 11 — Run the tests

Run the focused suite:

```bash
node --test test/007-general-rate-limit.test.js
node --test test/051-reset-endpoints-rate-limit.test.js
node --test test/006-auth-middleware.test.js
node --test test/login.test.js
node --test test/password-reset.test.js
node --test test/049-reset-token-invalidation-and-expiry.test.js
node --test test/050-forgot-password-response.test.js
```

Then run the full suite:

```bash
npm test
```

Some tests may skip or fail when the configured database is unavailable. Report skips and pre-existing failures separately from the results of this task. Do not weaken or delete a test to make the new limiter pass.

### Step 12 — Run the formatter

```bash
npm run lint
```

The repository’s `lint` script runs `npx prettier --write .`. Review the diff and revert unrelated formatting churn outside the files listed in §6.

### Step 13 — Manual runtime verification

Use a disposable local environment only. Do not use production data, real user accounts, real SMTP, or real reset tokens.

1. Start the app:

    ```bash
    npm run dev
    ```

2. Confirm the server starts without an `express-rate-limit` validation error or a `trust proxy` warning.

3. Confirm a normal login with valid disposable credentials still succeeds and redirects to `/selection`.

4. Confirm a normal support login with valid disposable credentials still succeeds.

5. Send six invalid login attempts from the same client:

    ```bash
    for i in 1 2 3 4 5 6; do
        curl -s -o /dev/null -w "%{http_code}\n" \
            -X POST http://localhost:3000/api/post/login-process \
            -H "Content-Type: application/x-www-form-urlencoded" \
            --data "emailAddress=nobody%40example.com&password=wrong"
    done
    ```

    Expect five normal responses followed by `429`. Inspect the `429` body and headers.

6. Confirm the sixth request does not reach the controller. Check the application logs and database for any new login/session side effect from the blocked request.

7. Confirm the general limiter is active by exercising a low-cost public endpoint more than 100 times within 15 minutes, or by using a temporary test limiter in a disposable instance. Do not run a 101-request flood against production.

8. Confirm a request to a static asset (for example `/assets/css/input.css` or an uploaded image) does not consume the API limiter budget.

9. Confirm Socket.IO still connects and a communicator call still works. Socket.IO must be unaffected.

10. Confirm the password-reset flow still behaves exactly as before:
    - Lookup returns the existing `found` / `not found` response.
    - Token creation works.
    - Reset email sends in the disposable environment.
    - Reset page renders.
    - Reset submission succeeds.
    - A second use of the same token fails.
    - The sixth reset request still returns `429` from the existing reset limiter.

11. Confirm a normal authenticated dashboard/search page still works. Most pages issue several `/api` calls; use them normally for a few minutes and confirm no false `429` under normal usage.

12. Test with a forged `X-Forwarded-For` on a direct connection that does not come through the trusted proxy. It must not reset or evade the bucket.

### Step 14 — Review the final diff

Run:

```bash
git diff --stat
git diff
git status
```

Confirm the only changes are:

- New limiter module.
- Middleware barrel export.
- `server.js` limiter mount.
- Login route limiters.
- Two login client `error` handlers.
- New test file.
- Narrow README updates.

Revert unrelated formatting churn. Do not commit unless the user explicitly asks.

## 10. Architecture and Existing Patterns

The project already has a middleware layer at `app/middleware/`, a barrel at `app/middleware/index.js`, a rate-limit directory at `app/middleware/rate-limit/`, and route modules of the form `module.exports = (app) => { ... }`.

Follow these existing patterns:

- Put the new limiter factory in `app/middleware/rate-limit/`.
- Use `express-rate-limit` exactly as the existing reset limiter does.
- Export through `app/middleware/index.js`.
- Apply the general limiter with `app.use('/api', ...)` in `server.js`.
- Apply route-specific strict limiters at route registration.
- Use `node:test` and `node:assert` for tests.
- Use CommonJS `require`, single quotes, 4-space indentation, and the repository Prettier configuration.

Before inventing anything, search for similar implementations:

```bash
rg -n "passwordResetRateLimit|createPasswordResetRateLimiter|rateLimit\(" app test
rg -n "app\.use\('/api'" app
rg -n "middleware\." app/routes --glob '*.js'
rg -n "node:test" test --glob '*.js'
```

Do not introduce a new dependency, framework, architecture, or design pattern when an appropriate existing project pattern already exists. `express-rate-limit` is already the project’s chosen library.

Do not create:

- A custom in-memory `Map` counter.
- A database-backed counter.
- A Redis integration.
- An Express Router hierarchy solely for rate limiting.
- A service-layer rate limiter.
- Account/email-based lockout.
- A custom `X-Forwarded-For` parser.

## 11. Security Requirements

### Must never happen

- `trust proxy` must never be set to `true`.
- The limiter must never be skipped for loopback, private IPs, localhost, or development mode.
- A client-supplied `X-Forwarded-For` header must not be trusted when the request did not come through the trusted proxy.
- The `429` body must never include the submitted email, username, password, UUID, reset token, database error, SMTP error, or stack trace.
- The limiter must never log request bodies. Login and reset bodies contain credentials.
- The limiter must never run after the handler, after bcrypt, after database access, after SMTP, or after file handling.
- The general limiter must never be mounted unscoped such that static assets and uploaded files consume the API budget.
- Do not add a query parameter, header, cookie, or secret bypass.
- Do not disable the limiter in production to make tests pass.
- Do not remove or weaken an existing test simply because it fails.
- Do not use a per-email or per-account key that allows an attacker to lock out a victim.

### Must be validated

- `req.ip` resolves to the real client IP through the documented Nginx proxy.
- Direct external requests cannot spoof the key with `X-Forwarded-For`.
- The first 100 `/api` requests from one IP succeed within the window; request 101 is blocked, unless a stricter route-specific limit applies first.
- The first 5 login attempts from one IP succeed within the window; attempt 6 is blocked.
- The first 5 support-login attempts from one IP succeed within the window; attempt 6 is blocked.
- Different IPs receive independent buckets.
- `Retry-After` is present on `429`.
- Standardized `RateLimit-*` headers are present.
- The blocked body contains no user-controlled values.
- The handler is not invoked on a blocked request.
- Existing authentication behavior is unchanged for under-limit requests.
- Existing password-reset limits, token expiry, single-use deletion, hashing, and session behavior are unchanged.
- The login client visibly handles `429` rather than silently failing.
- Static assets and Socket.IO are unaffected.

### Attack cases to test

1. Repeated login attempts for the same email from one IP.
2. Repeated login attempts for different emails from one IP.
3. Repeated support-login attempts from one IP.
4. Repeated requests to a cheap public API endpoint from one IP.
5. Repeated requests to an expensive authenticated endpoint from one IP.
6. Repeated registration submissions from one IP.
7. Forged `X-Forwarded-For` headers from a direct connection that is not the trusted proxy.
8. Rotating `X-Forwarded-For` headers through the trusted proxy if the deployment permits client-supplied left-most values. Verify the trust setting only uses the proxy-appended address.
9. Requests with missing, empty, very long, and SQL-shaped credentials. The limiter must run before validation and must not echo the input.
10. Concurrent bursts from one IP. The default MemoryStore must not allow an unbounded burst past the limit. Do not assume external-store atomicity; the default store is acceptable for this single-process deployment.
11. `OPTIONS` preflight requests. They must not consume the API bucket.
12. Static asset requests. They must not consume the API bucket.

Do not limit security testing to the exact examples above. Inspect the affected code path for other unthrottled authentication or resource-heavy routes after the implementation.

## 12. Backward Compatibility

The following must remain unchanged for requests under the limit:

- `POST /api/post/login-process` request and response behavior, including the `found` / not-found handling and session setup.
- `POST /api/post/help-and-support-login-process` request and response behavior.
- All existing validation middleware and messages.
- All existing password-reset responses and token semantics.
- All registration endpoints, uploads, and response formats.
- All authenticated API responses.
- All page renders.
- Socket.IO behavior.
- Static asset delivery.
- Session cookie behavior.
- The order of existing middleware except for the inserted limiter.

Requests over the limit intentionally change behavior: they receive `429` instead of the normal response. That is the required security change.

Do not change:

- Existing API response envelopes for non-429 requests.
- Existing route paths or aliases.
- Existing controller or model logic.
- Existing session shape or `login_status` semantics.
- Existing authentication allowlist in `auth.middleware.js`.
- Existing password-reset limiter configuration.
- Existing client success handlers, redirects, or message strings.
- The database schema, models, or migrations.
- Environment variables or secrets.
- Nginx configuration.
- Static file paths or upload directories.

A `429` is an expected new response. Only login and support-login clients are required to display it in this task. Other clients may receive `429` under abusive conditions, but their existing behavior must not be broken for normal requests.

## 13. Testing Strategy

### Normal Case

- A valid login under the limit succeeds and redirects exactly as before.
- A valid support login under the limit succeeds and redirects exactly as before.
- A valid password-reset flow still succeeds under both the general and reset limiters.
- A normal authenticated dashboard/search session using several API calls stays below 100 requests per 15 minutes.
- The test limiter allows exactly N requests and calls the handler N times.

### Empty / Missing Input

- Login with missing email or password still follows the existing validation/controller behavior until the limit is reached.
- Support login with missing fields still follows the existing behavior until the limit is reached.
- The limiter itself must not throw on a missing body. It keys on IP only.
- Reset endpoints with missing fields keep their existing behavior until their limit is reached.

### Boundary Cases

- Exactly 100 general API requests are allowed; request 101 is blocked.
- Exactly 5 login requests are allowed; request 6 is blocked.
- Exactly 5 support-login requests are allowed; request 6 is blocked.
- The limit resets after `windowMs`. Do not write a flaky millisecond-level timing test; use a short test window with a small delay if needed, or assert configuration constants instead.
- IPv6 clients are keyed by the library’s default subnet aggregation, not by raw full addresses.
- Very long email/password strings do not affect the key because the default key is the IP.
- Concurrent requests from one IP do not all pass if they exceed the limit. If the MemoryStore shows a race in a burst test, document it rather than switching to an external store.

### Invalid Input

- Malformed form encodings and malformed JSON still produce the existing Express/body-parser behavior. The general limiter must not turn every malformed request into a `500`.
- Invalid login credentials still return the existing login failure behavior until the limit is reached.
- Invalid reset tokens are limited before the token lookup.
- A blocked request must not cause a database error, SMTP error, or unhandled promise rejection.
- A blocked request must not create a session, write `login_status`, or send email.

### Security Cases

- `trust proxy: true` is absent.
- Direct forged `X-Forwarded-For` does not create a new bucket when the connection is not from the trusted proxy.
- Different real IPs get independent buckets.
- The `429` body does not echo email, username, password, UUID, token, or internal errors.
- The route handler, database, bcrypt, SMTP, and filesystem are not reached for blocked requests.
- No loopback/private-IP bypass exists.
- No query parameter/header/cookie bypass exists.
- `OPTIONS` is skipped but does not reset or dilute the POST bucket.
- Static assets do not consume the API bucket.
- The general limiter is applied to all `/api` routes, including those registered later in `sequelize.route.js`.
- The strict limiter is applied to both login endpoints before validation.
- The existing reset limiters are still present and unchanged.

### Regression Testing

Run and report each of these:

```bash
node --test test/007-general-rate-limit.test.js
node --test test/051-reset-endpoints-rate-limit.test.js
node --test test/006-auth-middleware.test.js
node --test test/login.test.js
node --test test/password-reset.test.js
node --test test/049-reset-token-invalidation-and-expiry.test.js
node --test test/050-forgot-password-response.test.js
```

Then run:

```bash
npm test
```

Also verify manually:

- Login still works with valid disposable credentials.
- Support login still works.
- Forgot-password lookup still returns the existing responses.
- Reset-token creation still works.
- Reset email still sends in a disposable environment.
- Reset page still renders.
- Password reset still succeeds and invalidates the token.
- A second use of the same reset token still fails.
- An expired token still fails.
- Static assets still load.
- Socket.IO still connects.

Do not remove or weaken an existing test to make the new limiter pass.

## 14. Verification / Evidence

The implementing agent must provide evidence, not just a claim that the code “looks right”.

Required evidence:

1. `npm ls express-rate-limit` shows the installed version. No unrelated dependency changes.
2. `git diff --stat` and `git diff` show only the intended files.
3. `rg -n "generalApiLimiter|loginLimiter|supportLoginLimiter" app` shows the limiter module, barrel export, server mount, and route usage.
4. Source-order evidence that `app.use('/api', generalApiLimiter)` appears before `app.use('/api', isAuthenticated)` and before the first API route `require` in `app/src/server.js`.
5. Source evidence that `loginLimiter` appears before `middleware.login_process` in the login route registration.
6. Source evidence that `supportLoginLimiter` is applied to the support-login route.
7. `rg -n "trust proxy" app/src/server.js` shows a safe numeric/named setting, never `true`.
8. Test output for `test/007-general-rate-limit.test.js` passes, including:
    - N allowed requests.
    - N+1 returns `429`.
    - handler call count remains N.
    - `Retry-After` is present.
    - `RateLimit-*` header is present.
    - body is generic.
    - different IP buckets are independent.
    - `OPTIONS` is skipped.
    - route wiring assertions pass.
9. The existing rate-limit, auth, login, and password-reset tests pass.
10. A manual sixth login request returns `429` and does not reach the controller or create a session/login side effect.
11. A manual normal login and support login still work under the limit.
12. A manual static asset request does not consume the API bucket.
13. A manual forged `X-Forwarded-For` request from a direct untrusted connection does not bypass the limiter, or the limitation is documented as a residual risk.
14. A final search confirms the existing reset limiters are untouched and still applied.

Search commands for evidence:

```bash
rg -n "generalApiLimiter|loginLimiter|supportLoginLimiter|apiRateLimit" app test
rg -n "passwordResetRateLimit|forgotPasswordProcessLimiter|createResetTokenLimiter|sendResetEmailLimiter|resetPasswordPageLimiter|resetPasswordSubmitLimiter" app/routes app/middleware
rg -n "trust proxy" app/src/server.js
```

Do not report “Fixed” without test output, route evidence, manual verification notes, and the final diff review.

## 15. Do NOT Do

- Do not set `trust proxy` to `true`.
- Do not skip the limiter for loopback, private IPs, localhost, health checks, or development mode.
- Do not add a query-parameter, header, cookie, or secret bypass.
- Do not write a custom rate-limit algorithm or a custom `X-Forwarded-For` parser.
- Do not add Redis, a database-backed counter, PM2 cluster coordination, or an external store.
- Do not apply the general limiter unscoped so that static assets, uploaded media, or page assets consume the API budget.
- Do not apply the strict 5/15 limit to all `/api` routes; that would break normal usage.
- Do not apply a strict limiter to registration, password-reset, upload, or search routes in this task. The general limiter covers them, and reset already has its own.
- Do not remove, replace, or reconfigure the existing password-reset limiters.
- Do not change reset-token generation, expiry, single-use deletion, password hashing, or reset email templates.
- Do not change login validation, bcrypt comparison, session construction, `login_status` writes, or redirects for under-limit requests.
- Do not change `app/middleware/auth.middleware.js` or its public allowlist.
- Do not remove `app/routes/password.js` or `app/routes/encrypt.route.js`; those are separate findings.
- Do not change the database schema, models, or migrations.
- Do not change `.env`, `.env.*`, secrets, SMTP configuration, SSL configuration, or Nginx configuration.
- Do not log request bodies, credentials, email addresses, tokens, or passwords.
- Do not add a new test framework or mocking dependency.
- Do not modify `CODE_REVIEW.md`.
- Do not rewrite unrelated README sections.
- Do not modify `AGENTS.md` unless the user explicitly asks.
- Do not run a 100+ request flood against production.
- Do not use production data, real user accounts, real email addresses, real SMTP, or real reset tokens.
- Do not delete or weaken existing tests because they fail.
- Do not commit unless the user explicitly asks.

## 16. Acceptance Criteria

### Acceptance Criteria

- [ ] `express-rate-limit` is present in `package.json` and installed; no unrelated dependency changes were made.
- [ ] `app/middleware/rate-limit/api.rate-limit.js` exists and exports a factory, constants, and three limiter instances.
- [ ] `app/middleware/index.js` exports the new module using the existing barrel pattern.
- [ ] The general limiter is mounted on `/api` before authentication and before every API route module.
- [ ] The general limiter uses 100 requests per 15 minutes per IP.
- [ ] The general limiter does not count static assets, uploaded files, or page assets.
- [ ] The general limiter skips `OPTIONS` requests.
- [ ] `POST /api/post/login-process` is protected by a strict 5 requests per 15 minutes per IP limiter before validation and controller execution.
- [ ] `POST /api/post/help-and-support-login-process` is protected by its own strict 5 requests per 15 minutes per IP limiter.
- [ ] The login and support-login limiters use separate buckets.
- [ ] Existing password-reset limiters remain unchanged and still protect all five reset endpoints.
- [ ] A request over a limit receives `HTTP 429`.
- [ ] The `429` body is generic and contains no email, username, password, UUID, token, or internal error.
- [ ] The `429` response includes `Retry-After` and standardized `RateLimit-*` headers.
- [ ] Blocked requests do not invoke validation, controllers, models, bcrypt, the database, SMTP, or filesystem handlers.
- [ ] Different IPs receive independent buckets.
- [ ] A forged `X-Forwarded-For` from an untrusted direct connection cannot bypass the limiter.
- [ ] No loopback/private-IP bypass exists.
- [ ] `trust proxy` is not set to `true`.
- [ ] `public/assets/js/login.js` displays a visible warning on `429` and preserves success behavior.
- [ ] `public/assets/js/help-and-support-login.js` displays a visible warning on `429` and preserves success behavior.
- [ ] Existing login, support-login, registration, search, upload, export, reset, Socket.IO, and static-asset behavior is unchanged for under-limit requests.
- [ ] `node --test test/007-general-rate-limit.test.js` passes.
- [ ] `node --test test/051-reset-endpoints-rate-limit.test.js` passes.
- [ ] `node --test test/006-auth-middleware.test.js` passes.
- [ ] `node --test test/login.test.js` passes.
- [ ] `node --test test/password-reset.test.js` passes.
- [ ] `node --test test/049-reset-token-invalidation-and-expiry.test.js` passes.
- [ ] `node --test test/050-forgot-password-response.test.js` passes.
- [ ] `npm test` was run; pre-existing failures and database skips are reported separately.
- [ ] A manual sixth login request returns `429` without controller/session side effects.
- [ ] A manual normal login and support login still work.
- [ ] A manual static asset request does not consume the API bucket.
- [ ] README rate-limiting statements are updated only where they are now stale.
- [ ] `npm run lint` was run and unrelated formatting churn was reviewed/reverted.
- [ ] `git diff` contains only the intended files.
- [ ] Remaining risks are documented.

## 17. Expected Final Report

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

Explain:

- The exact general limit and window.
- The exact strict login limits and windows.
- Where the general limiter is mounted and why.
- Why the limiter was placed before authentication and body parsing.
- How the existing reset limiters were left intact.
- How the login clients handle `429`.

## Testing

| Test                                        | Result         |
| ------------------------------------------- | -------------- |
| Normal login under limit                    | PASS/FAIL      |
| Normal support login under limit            | PASS/FAIL      |
| General limiter: 100 allowed, 101 blocked   | PASS/FAIL      |
| Login limiter: 5 allowed, 6 blocked         | PASS/FAIL      |
| Support-login limiter: 5 allowed, 6 blocked | PASS/FAIL      |
| Handler not invoked on blocked request      | PASS/FAIL      |
| Generic `429` body                          | PASS/FAIL      |
| `Retry-After` and `RateLimit-*` headers     | PASS/FAIL      |
| Different IP buckets                        | PASS/FAIL      |
| Forged `X-Forwarded-For`                    | PASS/FAIL      |
| `OPTIONS` skip                              | PASS/FAIL      |
| Static asset not counted                    | PASS/FAIL      |
| Existing reset limiter regression           | PASS/FAIL      |
| Existing auth middleware regression         | PASS/FAIL      |
| Full test suite / skips                     | PASS/FAIL/SKIP |

## Verification

Explain how the original issue was verified as fixed, including:

- Command output summaries.
- Source-order evidence for the server and route wiring.
- Headers observed on a `429`.
- Manual sixth-login evidence.
- Final diff review.

## Remaining Risks

List anything that could not be verified, including where applicable:

- Single-process MemoryStore limitations.
- PM2 cluster or multi-instance deployments where each process has its own counter.
- Proxy topology assumptions.
- Shared NAT / corporate IP false positives.
- Distributed attacks across many IPs.
- Registration-specific throttling not being tighter than the general API limit.
- Email-based enumeration below the threshold.
- Other unthrottled page routes outside `/api`.
- Any test skipped because a database or non-loopback interface was unavailable.

## Final Status

PASS / NEEDS REVIEW
```

## 18. Important Rules for the Implementing Agent

### Rule 1 — Do not hallucinate

Do not invent file paths, route names, functions, dependencies, environment values, proxy topology, or test results. If the deployment topology or a route classification cannot be verified, mark it `TO INVESTIGATE` and report it.

### Rule 2 — Separate facts from recommendations

The verified current state is described in §7. Everything under “Target”, “Suggested”, and “Recommended” is a recommendation. Do not present an assumption about production as an existing fact.

### Rule 3 — Prefer project consistency

Follow `app/middleware/index.js`, the existing `express-rate-limit` pattern in `password-reset.rate-limit.js`, the route-module pattern, and the existing `node:test` style. Do not create a parallel architecture.

### Rule 4 — Preserve behavior

The marketplace is working in production. The only intended new behavior is that excessive requests receive `429`. Do not change login responses, reset responses, registration flows, session semantics, token semantics, database schema, static files, or Socket.IO.

### Rule 5 — Think about the entire code path

Investigate the full chain:

```text
Client
  ↓
Static / CORS / compression
  ↓
General /api limiter
  ↓
Body parsing
  ↓
Session
  ↓
Authentication
  ↓
Route-specific limiter
  ↓
Validation
  ↓
Controller / route handler
  ↓
Service / model
  ↓
Database / SMTP / filesystem
  ↓
Response
```

Do not focus only on the login route. A misplaced global limiter can break static assets or normal dashboard usage. A limiter placed after the handler provides no protection.

### Rule 6 — Make the task executable

Another AI coding agent should be able to read this document and know exactly:

- What to change.
- Where to change it.
- Why it must change.
- Which existing behavior must not change.
- How to test it.
- How to prove it is fixed.

## 19. Output Requirements for the Implementing Agent

The implementing agent must return the Implementation Report from §17, not a general narrative. The report must include:

- Actual test commands and result summaries.
- The final diff review.
- The chosen limiter placement and its justification.
- Evidence that the reset limiters were not disturbed.
- Evidence that static assets and Socket.IO are unaffected.
- Any database or non-loopback test skips.
- Any residual risks.

If any part of the task cannot be completed safely — especially the proxy trust configuration or the placement of the general limiter — report `NEEDS REVIEW` with the specific blocker instead of guessing.
