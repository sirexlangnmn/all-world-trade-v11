# 051 — Add Strict Rate Limiting to Password Reset and Forgot-Password Endpoints

| Field | Value |
| --- | --- |
| Document ID | `051` |
| Requested filename | `docs/tasks/051-Missing-Rate-Limiting-on-Reset-Endpoints.md` |
| Source finding | `CODE_REVIEW.md` → Detailed Findings → **Finding 51: Missing Rate Limiting on Reset Endpoints** (`app/routes/forgot-password.js`, related forgot-password routes) |
| Related finding | **Finding 7: No Rate Limiting** (`app/src/server.js`). Finding 7 is the project-wide limiter task; it is **not** implemented here, but it recommends the same dependency. |
| Priority | Security hardening — high for password reset abuse. `CODE_REVIEW.md` does not assign a numeric severity to Finding 51; the roadmap lists general rate limiting as a high-priority security item. |
| Task type | Security middleware addition. No schema change. No reset-token lifecycle change. No password/hash behavior change. |
| Repository | All World Trade v11 — production Express/EJS/MySQL SSR application. Production behavior is the contract unless this document explicitly says otherwise. |
| Expected change size | Medium: one new middleware module, two route files, one server setting, two client scripts, one test, plus `package.json` / `package-lock.json` from `npm install`. |
| New dependency | `express-rate-limit` only. `CODE_REVIEW.md` Findings 7 and 51 explicitly recommend it. As of this document, npm reports `express-rate-limit@8.7.1`, with peer dependency `express >= 4.11` and `node >= 16`. |

> **Scope note — related findings that must NOT be fixed here.**
>
> - Finding 3 (plaintext password storage on reset) is handled by `app/services/password-reset.service.js`. Do not touch it.
> - Findings 4, 49, and 50 (JWT/password exposure, token expiry, token invalidation, forgot-password response contents) are already addressed in the working tree. Do not redesign them.
> - Finding 6 (authentication middleware on API routes) is separate.
> - Finding 7 (global rate limiting) is separate. This task adds limiters only to the password-reset flow. Do not apply a global `app.use(limiter)`.
> - Finding 10 (Helmet/CSP) is separate.
> - Finding 19 (null crash in reset-token lookup) is separate.
> - Finding 34 (migrate legacy mysql2 to Sequelize) is separate.
> - Finding 48 (public bcrypt hash/compare endpoints) is separate.
>
> This task must not change reset-token generation, expiry, single-use deletion, bcrypt cost, session handling, email templates, or database schema.

---

# 1. Task Title

**Apply Strict Per-IP Rate Limiting to the Forgot-Password Lookup, Reset-Token Creation, Reset-Email, and Reset-Password GET/POST Endpoints**

---

# 2. Objective

## What must be accomplished

1. Install `express-rate-limit` and record it in `package.json` / `package-lock.json`.
2. Add a reusable rate-limit middleware module under `app/middleware/rate-limit/` that follows the existing `app/middleware/index.js` barrel pattern.
3. Apply strict per-IP limiters to these endpoints:
   - `POST /api/post/forgot-password-process`
   - `POST /api/post/create-reset-token`
   - `POST /api/post/send-email-for-change-password`
   - `GET /reset-password/:token`
   - `POST /reset-password/:token`
4. Configure Express `trust proxy` correctly so that the limiter sees the real client IP behind the documented Nginx reverse proxy instead of `127.0.0.1` for every request.
5. Keep the existing successful response contracts unchanged.
6. Add a generic HTTP `429` response that does not reveal whether an email address exists or whether a token is valid.
7. Update the two client-side scripts that call these endpoints so a `429` is shown to the user instead of failing silently.
8. Add a focused test using the repository's existing `node:test` convention.
9. Verify that one complete legitimate reset flow still fits inside the limits.

## Why this is necessary

The password-reset flow is unauthenticated and currently has no throttling. Any caller can:

1. Repeatedly submit `POST /api/post/forgot-password-process` to enumerate registered email addresses, because the response distinguishes `found` from `not found`.
2. Repeatedly call `POST /api/post/create-reset-token` and `POST /api/post/send-email-for-change-password` to create reset rows and send reset emails. This is an email-spam, harassment, and resource-exhaustion vector.
3. Repeatedly call `GET /reset-password/:token` and `POST /reset-password/:token` to attempt token guessing or to hammer the token lookup and password-update path.
4. Use the endpoints as an inexpensive way to consume database connections, SMTP capacity, and application CPU.

The reset token is a UUID v4 and is now expired/single-use, but the lack of rate limiting still permits enumeration, email flooding, and brute-force attempts at scale. Rate limiting does not replace token entropy or expiry; it reduces the rate at which an attacker can exercise those paths.

## Expected end result

- The first N requests from one IP within the window succeed and behave exactly as they do today.
- Request N+1 from the same IP within the window receives `HTTP 429` with a generic message and a `Retry-After` header.
- Rate-limited requests never reach the route handler, so they do not query the database, create reset tokens, or send email.
- A spoofed `X-Forwarded-For` header cannot be used to rotate buckets when the request did not come through the trusted proxy.
- A legitimate forgot-password flow (three POST requests) remains possible within the limits.
- Existing reset-token tests continue to pass.

---

# 3. Problem / Finding

## Weakness type

- **Improper restriction of excessive authentication attempts** — CWE-307.
- **Allocation of resources without limits or throttling** — CWE-770.
- **Observable response discrepancy used for enumeration** — CWE-204 is already possible through the `found` / `not found` lookup response. This task reduces the rate at which it can be exploited but does not change the response itself.
- **Email/resource abuse through unthrottled endpoints** — CWE-799 class.

## Severity

`CODE_REVIEW.md` does not assign a numeric severity to Finding 51. The realistic assessment is:

- The reset token itself is a UUID v4 and is now expiry-checked and single-use, so token guessing alone is not a practical account-takeover path.
- The more immediate risks are email enumeration, reset-email flooding, SMTP/database resource exhaustion, and repeated brute-force attempts.
- The endpoints are public, unauthenticated, and currently unthrottled.
- Any rate limit must be high enough for a real user to complete the multi-request reset flow and low enough to prevent sustained abuse.

Do not describe this as “just a performance issue”. It is an abuse-prevention and security-control gap on a credential-recovery surface.

## Attack surface

```text
POST /api/post/forgot-password-process
  body: emailAddress=<email>

POST /api/post/create-reset-token
  body: uuid=<uuid>&email_or_social_media=<email>

POST /api/post/send-email-for-change-password
  body: uuid=<uuid>&link=<link>&receiverEmailAddress=<email>

GET /reset-password/:token
POST /reset-password/:token
  body: password=<new-password>&password2=<confirmation>
```

All of these routes are registered without an authentication check and without any request-throttling middleware.

## Current code (verified)

`app/routes/index.js:98`:

```js
app.post(['/api/post/forgot-password-process'], forgotPassword.create);
```

`app/routes/forgot-password.js:47`:

```js
app.post('/api/post/create-reset-token', async function (req, res, next) {
    const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

    const { uuid, email_or_social_media: receiverEmailAddress } = req.body;
    // ...
});
```

`app/routes/forgot-password.js:89`:

```js
app.post('/api/post/send-email-for-change-password', (req, res) => {
    let uuid = req.body.uuid;
    let link = req.body.link;
    let receiverEmailAddress = req.body.receiverEmailAddress;
    // ...
});
```

`app/routes/forgot-password.js:197`:

```js
app.get(['/reset-password/:token'], async function (req, res, next) {
    const result = await findUserAccountByResetToken(req.params.token);
    // ...
});
```

`app/routes/forgot-password.js:213`:

```js
app.post(['/reset-password/:token'], async function (req, res) {
    const token = req.params.token;
    const { password, password2 } = req.body;
    const result = await findUserAccountByResetToken(token);
    // ...
});
```

`app/src/server.js` currently has **no** rate limiting and **no** `trust proxy` setting. `package.json` does **not** list `express-rate-limit`. A repository-wide search for `rateLimit`, `express-rate`, `429`, or `Too Many` found no application-level implementation.

## Why the current implementation is unsafe

1. There is no cost to repeated requests.
2. The lookup endpoint distinguishes valid from invalid email addresses.
3. The token-creation endpoint writes a new row on every request.
4. The email endpoint sends SMTP mail on every request.
5. The reset GET and POST handlers perform database lookups on every request.
6. There is no backpressure against automated enumeration or flooding.
7. The application listens on `process.env.PORT` on all interfaces (`server.listen(port, null, ...)`), so an attacker may reach Node directly if the firewall does not block the application port. Rate limiting must therefore live in the application, not only in Nginx.

---

# 4. Affected Functionality

**Feature:** Forgot-password request, reset-token creation, reset-email delivery, reset-page rendering, and password reset submission.

```text
public/view/forgot-password/index.ejs
   ↓
public/assets/js/forgot-password.js
   ├─ POST /api/post/forgot-password-process
   ├─ POST /api/post/create-reset-token
   └─ POST /api/post/send-email-for-change-password
   ↓
app/routes/index.js:98  ──────────────► app/controllers/forgot-password.controller.js
   │                                      └─ app/models/forgot-password.model.js
   │                                           └─ USERS_ACCOUNTS.GET_BY_EMAIL
   ↓
app/routes/forgot-password.js:47,89
   ├─ insert reset_tokens row
   └─ send SMTP email
   ↓
reset email link
   ↓
public/assets/js/reset-password.js
   ├─ GET  /reset-password/:token  ──► app/routes/forgot-password.js:197
   └─ POST /reset-password/:token  ──► app/routes/forgot-password.js:213
                                           ├─ findUserAccountByResetToken()
                                           ├─ PasswordResetService.setNewPassword()
                                           └─ destroy reset token
```

## Rate-limit matrix for this task

| Method | Path | Suggested limit | Window | Rationale |
| --- | --- | --- | --- | --- |
| POST | `/api/post/forgot-password-process` | 5 | 15 min | Slows email enumeration and repeated lookups. |
| POST | `/api/post/create-reset-token` | 5 | 15 min | Slows reset-row flooding and token generation. |
| POST | `/api/post/send-email-for-change-password` | 5 | 15 min | Slows reset-email flooding and SMTP abuse. |
| GET | `/reset-password/:token` | 30 | 15 min | Allows page refreshes and email-security scanners while still bounding lookup abuse. |
| POST | `/reset-password/:token` | 5 | 15 min | Slows brute-force submission and repeated password updates. |

The exact numbers are recommendations. They must remain strict enough to stop sustained abuse and generous enough for one legitimate flow. The client currently makes up to three POST requests for one reset attempt; because each endpoint has its own limiter instance/store, one flow consumes one count on three separate buckets, not three counts on one bucket.

## What must keep working after this task

- The forgot-password page and its form submission.
- The `found` / `not found` response contract (Finding 50 deliberately preserved it).
- Creation of a reset-token row with a 1-hour expiration.
- Sending the reset email.
- Opening a valid reset link.
- Rendering the reset form with the account email.
- Submitting a matching `password` / `password2`.
- Updating the password through `PasswordResetService`.
- Deleting the token after a successful reset (Finding 49 behavior).
- All existing reset-token tests.

## Not in scope

- Global rate limiting for login, registration, uploads, or every API route (Finding 7).
- Changing `found` / `not found` into a uniform anti-enumeration response.
- Adding CAPTCHA, account lockout, or email-verification ownership checks.
- Changing the reset token from UUID to a signed token.
- Moving reset routes to Sequelize.
- Adding Redis, a shared rate-limit store, or PM2 cluster coordination.
- Modifying Nginx configuration, `.env`, secrets, SMTP settings, or TLS.
- Changing the password hashing cost or the reset service.

---

# 5. Investigation Phase (MANDATORY — do this before editing)

The implementing agent must confirm the current state in the working tree. Do not assume the snippets in this document are all that changed since the review.

## 5.1 Search for every reset-related route and caller

Run:

```bash
grep -rn "forgot-password\|reset-password\|create-reset-token\|send-email-for-change-password" app public test --include=*.js
```

Confirm:

- `POST /api/post/forgot-password-process` is registered in `app/routes/index.js` and handled by `app/controllers/forgot-password.controller.js`.
- `POST /api/post/create-reset-token`, `POST /api/post/send-email-for-change-password`, `GET /reset-password/:token`, and `POST /reset-password/:token` are registered in `app/routes/forgot-password.js`.
- No other server route handles these paths.
- No other client script calls these paths beyond `public/assets/js/forgot-password.js` and `public/assets/js/reset-password.js`.

## 5.2 Search for existing rate limiting

Run:

```bash
grep -rn "rateLimit\|express-rate-limit\|rate-limit\|Too Many Requests\|429" app package.json package-lock.json --include=*.js
npm ls express-rate-limit
```

Expected: no application-level rate limiter and no installed package. The only unrelated in-memory throttle is `app/realtime/call.handler.js`, which is for socket call signaling and must not be reused or modified.

## 5.3 Inspect server bootstrap and proxy behavior

Read `app/src/server.js` around:

- `const app = express();` (line 49)
- CORS and body parsing (lines 58-78)
- session setup (lines 80-91)
- route registration (lines 162-167 and 225-226)
- `server.listen(port, null, ...)` (line 1518)

Confirm:

- There is no `app.set('trust proxy', ...)` call anywhere.
- The documented deployment uses Nginx as a reverse proxy (`README.md` §13.2) and forwards `X-Forwarded-For` / `X-Real-IP`.
- The Node process listens on all interfaces.
- The application has no existing consumer of `req.ip`, `req.ips`, `req.protocol`, `req.secure`, or `req.hostname`, so adding `trust proxy` has no known side effects.

If the actual production proxy topology differs from the README, stop and document the correct hop count before setting `trust proxy`. Do not guess.

## 5.4 Inspect client behavior and expected responses

Read:

- `public/assets/js/forgot-password.js`
- `public/assets/js/reset-password.js`
- `public/view/forgot-password/index.ejs`
- `public/view/reset-password/index.ejs`

Confirm:

- The forgot-password client performs three sequential POSTs.
- The reset-password client uses the current page URL for POST and only has a `success` handler.
- On a `429`, jQuery calls `error`, not `success`; without an `error` handler the user sees nothing.
- Success responses currently depend on these exact values:
  - `res.message === 'found'`
  - `data.message == 'reset tokens saved'`
  - `data == 'email sent'`
  - `res === 'reset password successfully'`
- Do not change those strings.

## 5.5 Inspect current reset-token behavior so it is preserved

Read:

- `app/routes/forgot-password.js:144-243`
- `app/services/password-reset.service.js`
- `app/db_models/reset_tokens.model.js`
- `test/049-reset-token-invalidation-and-expiry.test.js`
- `test/password-reset.test.js`
- `test/050-forgot-password-response.test.js`

Confirm:

- The token is checked for non-empty string, existence, expiration, and account mapping before use.
- The token is deleted only after a successful password update.
- The rate limiter must be placed **before** `findUserAccountByResetToken` so blocked requests do not touch these models.

## 5.6 Inspect dependency compatibility

Run:

```bash
node --version
npm view express-rate-limit version peerDependencies engines
```

Current repository facts:

- `express` is `^5.2.1`.
- `express-rate-limit` latest (verified at authoring time) is `8.7.1`.
- Peer dependency: `express >= 4.11`.
- Engines: `node >= 16`.
- The project requires Node >= 18 per `README.md`.

Use the current stable 8.x release. Do not add any other rate-limiting, mocking, or test dependency.

## 5.7 Inspect existing middleware conventions

Read:

- `app/middleware/index.js`
- `app/middleware/validations/login_process.validations.js`
- `app/routes/index.js` (the `middleware.login_process` usage)
- `app/routes/forgot-password.js`

Follow the existing barrel-export pattern. Do not create a second middleware system or mount a global limiter.

## 5.8 Record findings before editing

The implementing agent must write down:

- Exact current paths and handlers for all five endpoints.
- The current `trust proxy` value.
- The verified proxy hop count / topology.
- Whether `express-rate-limit` is already installed.
- Whether any other client or server code calls these endpoints.
- Which tests currently pass before the change (run the reset tests first).

Do not proceed until these are known.

---

# 6. File Impact Analysis

| File | Role | Action | Reason |
| --- | --- | --- | --- |
| `package.json` | Dependency manifest | MODIFY | Add `express-rate-limit`. |
| `package-lock.json` | Locked dependency graph | MODIFY | Produced by `npm install`; do not hand-edit. |
| `app/middleware/rate-limit/password-reset.rate-limit.js` | New shared limiter module | ADD | Defines the limiter factory and one limiter instance per reset endpoint. |
| `app/middleware/index.js` | Middleware barrel | MODIFY | Export the rate-limit module following the existing pattern. |
| `app/src/server.js` | Express bootstrap | MODIFY | Set `trust proxy` correctly so `req.ip` is the client IP behind Nginx. |
| `app/routes/index.js` | Legacy API routes | MODIFY | Apply the lookup limiter to `POST /api/post/forgot-password-process`. |
| `app/routes/forgot-password.js` | Reset routes | MODIFY | Apply limiters to token creation, email sending, reset GET, and reset POST. |
| `public/assets/js/forgot-password.js` | Client reset flow | MODIFY | Handle `429` so users see a friendly message instead of silence. |
| `public/assets/js/reset-password.js` | Client reset submission | MODIFY | Handle `429` on the reset form. |
| `test/051-reset-endpoints-rate-limit.test.js` | New acceptance test | ADD | Prove throttling, generic response, headers, bucket isolation, and handler bypass. |
| `app/controllers/forgot-password.controller.js` | Lookup controller | REFERENCE ONLY | The limiter wraps it; no controller change is required. |
| `app/models/forgot-password.model.js` | Lookup model | REFERENCE ONLY | Do not change the query or response. |
| `app/services/password-reset.service.js` | Password update service | REFERENCE ONLY | Do not change hashing or validation. |
| `app/db_models/reset_tokens.model.js` | Token model | REFERENCE ONLY | The limiter runs before model access. |
| `test/049-reset-token-invalidation-and-expiry.test.js` | Existing reset test | REFERENCE ONLY | Must continue to pass. |
| `test/050-forgot-password-response.test.js` | Existing lookup test | REFERENCE ONLY | Must continue to pass. |
| `test/password-reset.test.js` | Existing reset test | REFERENCE ONLY | Must continue to pass. |
| `test/003.2-plaintext-password-storage-on-reset.test.js` | Existing hashing test | REFERENCE ONLY | Must continue to pass. |
| `README.md` | Deployment documentation | REFERENCE ONLY | Use §13.2 to verify the proxy topology. Do not rewrite it for this task. |
| `CODE_REVIEW.md` | Finding source | REFERENCE ONLY | Do not modify. |
| `.env` / `.env.*` | Secrets/configuration | DO NOT MODIFY | No secret or environment change is needed. |
| Nginx configuration | External deployment | INVESTIGATE ONLY | Verify trusted hops and whether reset routes are already limited. Do not modify unless the task owner explicitly asks. |

No database schema change is required.

---

# 7. Current Implementation (verified)

## 7.1 `app/routes/index.js` — forgot-password lookup route

`app/routes/index.js:13` already imports the middleware barrel:

```js
const middleware = require('../middleware');
```

`app/routes/index.js:47` imports the controller:

```js
const forgotPassword = require('../controllers/forgot-password.controller.js');
```

`app/routes/index.js:98` registers the route with no limiter:

```js
app.post(['/api/post/forgot-password-process'], forgotPassword.create);
```

The controller and model are unchanged by this task. The controller sends whatever the model returns; the model returns `{ message, email_or_social_media, uuid }` after Finding 50.

## 7.2 `app/routes/forgot-password.js` — reset routes

The route module is a function that receives `app`:

```js
module.exports = (app) => {
    const db = require('../models/db.js');
    const db_models = require('../db_models');
    const USERS_ACCOUNTS = require('../query/users_accounts.query.js');
    const RESET_TOKENS = require('../query/reset_tokens.query.js');
    const { PasswordResetService } = require('../services/password-reset.service.js');

    const passwordResetService = new PasswordResetService();
    // ...
};
```

It registers `POST /api/post/create-reset-token` at line 47, `POST /api/post/send-email-for-change-password` at line 89, `GET /reset-password/:token` at line 197, and `POST /reset-password/:token` at line 213. None has a limiter.

The current GET/POST handlers perform the token lookup in `findUserAccountByResetToken` before responding. A limiter must run before that function.

## 7.3 `app/src/server.js` — no proxy trust and no limiter

`app/src/server.js:49`:

```js
const app = express();
```

There is no `app.set('trust proxy', ...)` call. The documented Nginx configuration in `README.md` §13.2 forwards:

```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

Without a correct `trust proxy` setting, Express treats `req.ip` as the socket address. Behind Nginx that is normally `127.0.0.1`, so every user would share one bucket. With `trust proxy` set to `true`, Express trusts arbitrary client-supplied `X-Forwarded-For` values and the limiter can be bypassed by rotating a header. Neither extreme is acceptable.

## 7.4 Client behavior

`public/assets/js/forgot-password.js` performs three AJAX calls. The `createResetToken` and `sendEmailForChangePasswordRequest` functions have empty or no-op `error` handlers. `public/assets/js/reset-password.js` has no `error` handler at all. A `429` therefore fails silently from the user's perspective.

## 7.5 Dependency state

`package.json` does not include `express-rate-limit`. The dependency is explicitly recommended by `CODE_REVIEW.md` Findings 7 and 51, so adding it is in scope. No other new dependency is acceptable.

---

# 8. Current → Target

## Current

```text
Request
  ↓
Express body parsers
  ↓
Route handler
  ├─ forgot-password lookup → database
  ├─ create-reset-token → database INSERT
  ├─ send-email → SMTP send
  ├─ GET reset → database token/account lookup
  └─ POST reset → token lookup + password update + token delete
```

Every request is processed. There is no per-IP counter, no `429`, and no `Retry-After`.

## Target

```text
Request
  ↓
Express body parsers
  ↓
Route-specific rate limiter (per IP, per limiter instance)
  ├─ under limit → existing handler → existing behavior
  └─ over limit  → HTTP 429 + generic message + Retry-After
                   (handler, database, and SMTP are NOT reached)
```

## Before/after — lookup route

**Current** (`app/routes/index.js:98`):

```js
app.post(['/api/post/forgot-password-process'], forgotPassword.create);
```

**Target:**

```js
app.post(
    ['/api/post/forgot-password-process'],
    middleware.passwordResetRateLimit.forgotPasswordProcessLimiter,
    forgotPassword.create,
);
```

## Before/after — reset routes

**Current** (`app/routes/forgot-password.js`):

```js
app.post('/api/post/create-reset-token', async function (req, res, next) {
    // ...
});

app.post('/api/post/send-email-for-change-password', (req, res) => {
    // ...
});

app.get(['/reset-password/:token'], async function (req, res, next) {
    // ...
});

app.post(['/reset-password/:token'], async function (req, res) {
    // ...
});
```

**Target:**

```js
app.post(
    '/api/post/create-reset-token',
    middleware.passwordResetRateLimit.createResetTokenLimiter,
    async function (req, res, next) {
        // unchanged handler body
    },
);

app.post(
    '/api/post/send-email-for-change-password',
    middleware.passwordResetRateLimit.sendResetEmailLimiter,
    (req, res) => {
        // unchanged handler body
    },
);

app.get(
    ['/reset-password/:token'],
    middleware.passwordResetRateLimit.resetPasswordPageLimiter,
    async function (req, res, next) {
        // unchanged handler body
    },
);

app.post(
    ['/reset-password/:token'],
    middleware.passwordResetRateLimit.resetPasswordSubmitLimiter,
    async function (req, res) {
        // unchanged handler body
    },
);
```

## Before/after — proxy trust

**Current:**

```js
const app = express();
```

**Target (only after verifying the proxy topology):**

```js
const app = express();

// Nginx is the single trusted proxy on this host (verify before deploy).
// Do NOT use `true`: that trusts client-supplied X-Forwarded-For values.
app.set('trust proxy', 'loopback');
```

The exact value must match the deployment:

| Verified topology | Suggested value | Notes |
| --- | --- | --- |
| Nginx on the same host, Node not directly reachable | `'loopback'` | Nginx connects from `127.0.0.1`; direct external clients are not trusted. |
| Exactly one remote proxy hop | `1` | Numeric hop count. Ensure Node is firewalled from direct access. |
| Two trusted hops (for example CDN + Nginx) | `2` or explicit proxy CIDRs | Verify the number; do not guess. |
| No proxy, direct Node exposure | `false` | `req.ip` is the socket address. Not the documented production topology. |
| Unknown | `TO INVESTIGATE` | Do not deploy a limiter with the wrong trust setting. |

`express-rate-limit` deliberately rejects `trust proxy: true` because it allows header spoofing. Do not use it.

## Before/after — middleware module shape

The target module follows the existing `app/middleware` barrel:

```js
'use strict';

const { rateLimit } = require('express-rate-limit');

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const RATE_LIMIT_JSON_MESSAGE = {
    status: 'error',
    message: 'Too many requests. Please try again later.',
};
const RATE_LIMIT_TEXT_MESSAGE = 'Too many requests. Please try again later.';

function createPasswordResetRateLimiter({
    windowMs = FIFTEEN_MINUTES_MS,
    limit = 5,
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

const forgotPasswordProcessLimiter = createPasswordResetRateLimiter();
const createResetTokenLimiter = createPasswordResetRateLimiter();
const sendResetEmailLimiter = createPasswordResetRateLimiter();
const resetPasswordPageLimiter = createPasswordResetRateLimiter({
    limit: 30,
    message: RATE_LIMIT_TEXT_MESSAGE,
});
const resetPasswordSubmitLimiter = createPasswordResetRateLimiter();

module.exports = {
    FIFTEEN_MINUTES_MS,
    RATE_LIMIT_JSON_MESSAGE,
    RATE_LIMIT_TEXT_MESSAGE,
    createPasswordResetRateLimiter,
    forgotPasswordProcessLimiter,
    createResetTokenLimiter,
    sendResetEmailLimiter,
    resetPasswordPageLimiter,
    resetPasswordSubmitLimiter,
};
```

Use this as the intended pattern. Inspect the existing architecture and adapt names/formatting if the repository has evolved.

Important details:

- Do **not** provide a custom `keyGenerator` for IP-only limits. The default key generator uses `req.ip` and handles IPv6 aggregation. A custom key generator that returns raw `req.ip` can make IPv6 limiting ineffective.
- `standardHeaders: 'draft-7'` and `legacyHeaders: false` produce standardized `RateLimit-*` headers without the older `X-RateLimit-*` duplicates.
- `statusCode: 429` is the default, but state it explicitly.
- Each limiter is a separate instance with its own memory store. This is why one legitimate flow can consume one count on three separate endpoints.
- The JSON message is for API POST endpoints. The plain-text message is for the browser GET reset page.
- Do not add `skip: () => true`, `skip: (req) => req.ip === '127.0.0.1'`, or any bypass. Behind a proxy, skipping loopback would disable the limiter for every user.

## Before/after — client error handling

**Current:** no `429` handling; the request fails silently.

**Target:** add a small helper that only reacts to `429` and leaves every other failure path as it is today. Example for `public/assets/js/forgot-password.js`:

```js
function showRateLimitMessage(xhr) {
    if (xhr && xhr.status === 429) {
        Swal.fire('Please wait', 'Too many requests. Please try again later.', 'warning');
        return true;
    }
    return false;
}
```

Then update each AJAX object with an `error` handler that calls the helper:

```js
error: function (xhr) {
    showRateLimitMessage(xhr);
},
```

For `public/assets/js/reset-password.js`, use the existing `showWarning` helper:

```js
error: function (xhr) {
    if (xhr && xhr.status === 429) {
        showWarning('Too many requests. Please try again later.');
    }
},
```

Do not change the existing success callbacks, strings, redirects, or warnings.

---

# 9. Detailed Implementation Plan

## Step 1 — Inspect the current working tree

Complete §5 first. Record the exact route registrations, the `trust proxy` state, the dependency state, and the baseline test results.

Run the existing reset tests before editing:

```bash
node --test test/049-reset-token-invalidation-and-expiry.test.js
node --test test/050-forgot-password-response.test.js
node --test test/password-reset.test.js
node --test test/003.2-plaintext-password-storage-on-reset.test.js
```

If any of these already fail for an unrelated reason, record it as a pre-existing failure. Do not “fix” it in this task.

## Step 2 — Install the dependency

```bash
npm install express-rate-limit
```

This is the only dependency allowed for this task. Confirm:

```bash
npm ls express-rate-limit
node -e "const { rateLimit, ipKeyGenerator } = require('express-rate-limit'); console.log(typeof rateLimit, typeof ipKeyGenerator)"
```

Do not run `npm update` or install unrelated packages. Review the `package-lock.json` diff and confirm it only reflects the new dependency tree. Do not add a custom limiter implementation, Redis store, or test-mocking package. Do not hand-edit `package-lock.json`.

## Step 3 — Add the rate-limit module

Create `app/middleware/rate-limit/password-reset.rate-limit.js` using the pattern in §8.

Verify:

- The module exports the factory for tests.
- The module exports all five limiter instances.
- `windowMs` is 15 minutes for the API endpoints.
- `limit` is 5 for the strict endpoints and 30 for the GET page.
- `standardHeaders` and `legacyHeaders` are set.
- The message is generic and contains no email address or token.
- No custom `keyGenerator` is used.

## Step 4 — Export the module from the middleware barrel

Modify `app/middleware/index.js`:

```js
const middleware = {};

middleware.passwordResetRateLimit = require('./rate-limit/password-reset.rate-limit.js');

middleware.smallScaleCompanyRegistrationValidation = require('./validations/small-scale-company-registration.validation.js');
// ... existing exports unchanged ...
```

Keep the existing exports and ordering style. Do not remove or rename existing middleware.

## Step 5 — Configure trusted proxy handling

In `app/src/server.js`, immediately after `const app = express();` and after confirming the production topology, add the appropriate `trust proxy` setting from §8.

Requirements:

- Do not set it to `true`.
- Do not set it to a value based only on a guess.
- Do not skip the limiter for loopback clients.
- If the topology cannot be verified, stop and report it as a blocker instead of shipping a limiter that either lumps all users together or can be bypassed.

Verify the setting is present before the route modules are registered. The exact line location is not important for Express at request time, but keeping it near app creation makes the trust model obvious.

## Step 6 — Apply the lookup limiter

In `app/routes/index.js`, use the existing `middleware` import:

```js
app.post(
    ['/api/post/forgot-password-process'],
    middleware.passwordResetRateLimit.forgotPasswordProcessLimiter,
    forgotPassword.create,
);
```

Do not change the controller, model, query, or response.

## Step 7 — Apply the reset-route limiters

In `app/routes/forgot-password.js`:

1. Keep all existing requires and service construction.
2. Require the middleware barrel near the top of the exported function:
   ```js
   const middleware = require('../middleware');
   ```
3. Insert the appropriate limiter as the middleware argument for each of the four routes:
   - `createResetTokenLimiter` for `POST /api/post/create-reset-token`
   - `sendResetEmailLimiter` for `POST /api/post/send-email-for-change-password`
   - `resetPasswordPageLimiter` for `GET /reset-password/:token`
   - `resetPasswordSubmitLimiter` for `POST /reset-password/:token`
4. Do not change the handler bodies.
5. Do not change route path arrays or add/remove aliases.
6. Do not move route registration before the body parsers in `server.js`.

The limiter must run before `findUserAccountByResetToken`, before the raw `db.query(RESET_TOKENS.CREATE, ...)`, and before `passwordResetService.setNewPassword`.

## Step 8 — Update client error handling

Update `public/assets/js/forgot-password.js`:

- Add the `showRateLimitMessage` helper.
- Add an `error` callback to the `POST /api/post/forgot-password-process` request.
- Add an `error` callback to the `POST /api/post/create-reset-token` request.
- Add an `error` callback to the `POST /api/post/send-email-for-change-password` request.
- Keep all success callbacks and message strings unchanged.

Update `public/assets/js/reset-password.js`:

- Add an `error` callback to the reset form AJAX request.
- On `429`, call `showWarning('Too many requests. Please try again later.')`.
- Keep the success callback and redirect unchanged.

Do not add a generic “something went wrong” alert for non-429 errors unless it already existed. The goal is specifically to make throttling visible without changing other error UX.

## Step 9 — Add the focused test

Add `test/051-reset-endpoints-rate-limit.test.js` using `node:test` and `node:assert`. Follow the offline test style used by `test/049-reset-token-invalidation-and-expiry.test.js` and `test/050-forgot-password-response.test.js`.

The test must prove:

1. A limiter allows exactly N requests in the window and rejects N+1 with `429`.
2. The blocked request does **not** invoke the wrapped route handler.
3. The blocked response body is generic and does not contain an email address or token.
4. The blocked response has a `Retry-After` header and standardized `RateLimit-*` headers.
5. Different IPs get independent buckets when `trust proxy` is configured.
6. The limiter factory can be used with a small window/limit for tests without affecting production instances.

Suggested approach: mount a tiny Express app on an ephemeral port with a fresh limiter from the factory, and use Node's global `fetch` (Node >= 18) to send requests. Example:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { once } = require('node:events');

const {
    createPasswordResetRateLimiter,
    RATE_LIMIT_JSON_MESSAGE,
} = require('../app/middleware/rate-limit/password-reset.rate-limit.js');

async function withServer(limiter, handler, run) {
    const app = express();
    app.set('trust proxy', 'loopback');
    app.use(express.urlencoded({ extended: true }));
    app.post('/probe', limiter, handler);
    const server = app.listen(0);
    await once(server, 'listening');

    try {
        await run(`http://127.0.0.1:${server.address().port}`);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

test('allows N requests and rejects N+1 without calling the handler', async () => {
    let handlerCalls = 0;
    const limiter = createPasswordResetRateLimiter({ windowMs: 60_000, limit: 3 });
    const handler = (req, res) => {
        handlerCalls += 1;
        res.send('ok');
    };

    await withServer(
        limiter,
        handler,
        async (base) => {
            const send = () =>
                fetch(`${base}/probe`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: 'emailAddress=user%40example.com',
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
        },
    );
});
```

The actual mounted handler in the test should increment `handlerCalls` and return `200`. The limiter is the only middleware under test; do not hit a database or SMTP server.

For the bucket-isolation test, send `X-Forwarded-For: 203.0.113.10` and `X-Forwarded-For: 203.0.113.11` through the local `loopback` trust setting and assert each IP gets its own allowance. Do not use a permissive `trust proxy: true` in the test.

If the test environment cannot start an ephemeral Express server, fall back to invoking the limiter middleware with synthetic `req`/`res` mocks and mark that part **NEEDS REVIEW**. Do not add a mocking dependency.

## Step 10 — Run the tests

```bash
node --test test/051-reset-endpoints-rate-limit.test.js
node --test test/049-reset-token-invalidation-and-expiry.test.js
node --test test/050-forgot-password-response.test.js
node --test test/password-reset.test.js
node --test test/003.2-plaintext-password-storage-on-reset.test.js
```

`npm test` is an intentionally failing stub in this repository. Do not change it and do not treat its failure as a regression.

## Step 11 — Run the formatter

```bash
npm run lint
```

This repository's `lint` script runs `npx prettier --write .`. Review the diff and revert unrelated formatting churn outside the files listed in §6. Do not commit.

## Step 12 — Manual runtime verification

Start the app with `npm run dev` on a local or disposable environment.

1. Confirm the server starts without an `express-rate-limit` validation error.
2. Submit the forgot-password form for a known disposable account.
3. Confirm the full flow still works: lookup → token creation → email send → link open → password reset → login with the new password.
4. Send six requests to `POST /api/post/create-reset-token` from the same client:
   ```bash
   for i in 1 2 3 4 5 6; do
       curl -s -o /dev/null -w "%{http_code}\n" \
           -X POST http://localhost:3000/api/post/create-reset-token \
           -H "Content-Type: application/x-www-form-urlencoded" \
           --data "uuid=test-uuid&email_or_social_media=test%40example.com"
   done
   ```
   Expect five normal responses followed by `429`. The sixth request must not create a reset row or send an email.
5. Inspect the `429` response headers for `Retry-After` and `RateLimit-*`.
6. Confirm the response body is generic and does not echo the submitted email or UUID.
7. Confirm a different IP (or a different forwarded client IP through the trusted proxy) is not blocked by the first IP's counter.
8. Confirm a direct request with a forged `X-Forwarded-For` header cannot reset the bucket when the request did not come through the trusted proxy.
9. Confirm the reset page still renders for a valid token under the GET limit.
10. Confirm the client shows the rate-limit warning on a `429` instead of failing silently.

Use disposable data only. Do not send real user email or use production SMTP.

## Step 13 — Review the final diff

Before declaring completion:

- `git diff --stat`
- `git diff` for every changed file
- `git status` to confirm no generated or unrelated files were added

Confirm the only changes are the intended dependency, middleware, routes, server trust setting, client error handlers, and the new test.

---

# 10. Architecture and Existing Patterns

The project already has a middleware layer at `app/middleware/` with a barrel at `app/middleware/index.js`. Route modules are functions of the form `module.exports = (app) => { ... }`. The legacy API route file already imports the barrel and applies middleware such as `middleware.login_process` to a route.

Follow those patterns:

- Put shared limiter configuration in `app/middleware/rate-limit/`.
- Export through `app/middleware/index.js`.
- Apply limiters at route registration, not with a global `app.use(...)` in this task.
- Keep the reset handlers and services unchanged.
- Use `node:test` and `node:assert` for tests, matching the existing `test/*.test.js` files.
- Use CommonJS `require`, single quotes, 4-space indentation, and the repository's Prettier configuration.

Search for similar examples before inventing anything:

```bash
grep -rn "middleware\." app/routes --include=*.js
grep -rn "node:test" test --include=*.js | head
```

Do not introduce a new dependency, framework, architecture, or design pattern when an appropriate existing project pattern already exists. `express-rate-limit` is the explicit exception because `CODE_REVIEW.md` recommends it.

Do not create a custom in-memory Map limiter, an Express Router hierarchy, a services-layer rate limiter, a database-backed counter, or a Redis integration for this task.

---

# 11. Security Requirements

## Must never happen

- `trust proxy` must never be set to `true`. That lets clients forge `X-Forwarded-For` and evade the limiter.
- The limiter must never be skipped for loopback or private addresses. Behind Nginx, every request appears to come from loopback/private space; skipping it disables protection.
- The limiter must never trust an arbitrary client `X-Forwarded-For` value when the request did not traverse the trusted proxy.
- The `429` body must never include the submitted email address, UUID, token, password, database error, or SMTP error.
- The limiter must never log request bodies. Reset bodies contain emails and passwords.
- The limiter must never run after the handler. It must wrap the handler so blocked requests do not reach the database or SMTP.
- The rate-limit store must not be disabled in production merely to make tests pass.
- Do not add a bypass query parameter, header, cookie, or secret that unlocks the limiter.

## Must be validated

- `req.ip` resolves to the real client IP through the documented Nginx proxy.
- Direct external requests cannot spoof the key with `X-Forwarded-For`.
- The first N requests from one IP succeed and N+1 fails with `429`.
- A different IP is not blocked by another IP's bucket.
- `Retry-After` is present on `429`.
- The generic body contains no user-controlled values.
- The handler is not invoked on a blocked request.
- The existing reset-token expiry, single-use deletion, password hashing, and session behavior are unchanged.
- The client displays a rate-limit message on `429` rather than silently doing nothing.

## Attack cases to test

1. Repeated lookup requests for the same email from one IP.
2. Repeated lookup requests for different emails from one IP.
3. Repeated token-creation requests from one IP.
4. Repeated email-send requests from one IP.
5. Repeated GET reset-page requests with random tokens.
6. Repeated POST reset-submit requests with random tokens.
7. Forged `X-Forwarded-For` headers from a direct connection that is not the trusted proxy.
8. Rotating `X-Forwarded-For` headers through the trusted proxy if the deployment permits client-supplied left-most values. Verify the trust setting only uses the proxy-appended address.
9. Requests with no email, empty email, very long email, SQL-shaped email, and malformed JSON/form bodies. Rate limiting should occur before validation/handler work, but the request must still receive the existing validation behavior until the limit is reached.
10. Concurrent bursts from one IP. The MemoryStore must not allow a large burst past the limit. Do not assume atomicity of an external store; the default store is acceptable for this single-process deployment.

Do not limit security testing to the exact examples above. Inspect the affected code path for other unthrottled reset-related routes.

---

# 12. Backward Compatibility

The following must remain unchanged for requests under the limit:

- `POST /api/post/forgot-password-process` response shape: `{ message: 'found', email_or_social_media, uuid }` or `{ message: 'not found' }`.
- `POST /api/post/create-reset-token` response shape: `{ message: 'reset tokens saved', uuid, link, receiverEmailAddress }`.
- `POST /api/post/send-email-for-change-password` response body: `'email sent'`.
- `GET /reset-password/:token` HTML render with `{ email }`.
- `GET /reset-password/:token` invalid/expired behavior: `404` with `'Invalid or expired reset token'`.
- `POST /reset-password/:token` success body: `'reset password successfully'`.
- `POST /reset-password/:token` failure body: `'reset password failed'`.
- The reset token's 1-hour expiration and single-use deletion.
- Password hashing and validation in `PasswordResetService`.
- All existing tests in `test/`.

Requests over the limit intentionally change behavior: they receive `429` instead of `200`. That is the required security change.

Do not change:

- Existing API response envelopes for non-429 requests.
- Existing route paths or aliases.
- Existing session behavior.
- Existing client success handlers, redirects, or message strings.
- Existing validation middleware.
- The database schema or `reset_tokens` model.
- Environment variables or secrets.

A `429` is an expected new response. Client scripts must handle it for a good UX, but no server-side success contract changes.

---

# 13. Testing Strategy

## Normal Case

- First request to each endpoint from a fresh IP succeeds with the existing response.
- A complete legitimate flow (lookup → create token → send email) succeeds because it consumes one count on each of three separate buckets.
- A valid reset link renders the reset form.
- A valid reset submission updates the password and returns the existing success string.
- The new test's handler is called exactly N times for N allowed requests.

## Empty / Missing Input

- `POST /api/post/forgot-password-process` with no body, empty email, or missing `emailAddress` still follows the existing controller behavior until the limit is reached.
- `POST /api/post/create-reset-token` with missing `uuid` or `email_or_social_media` still follows existing behavior until the limit is reached.
- `POST /api/post/send-email-for-change-password` with missing fields still follows existing behavior until the limit is reached.
- `POST /reset-password/:token` with missing `password` / `password2` still follows existing behavior until the limit is reached.
- Rate limiting itself must not throw on a missing body. The limiter only uses `req.ip` by default.

## Boundary Cases

- Exactly N requests allowed; request N+1 blocked.
- Limit resets after `windowMs` (manual or real-time test; do not make a flaky millisecond-level CI test).
- IPv6 clients are keyed by the library's default subnet aggregation, not by raw full addresses.
- Very long email strings and very long tokens do not affect the key because the default key is the IP.
- Concurrent requests from one IP do not all pass if they arrive at the same time. If the MemoryStore shows a race in a burst test, document it rather than switching to an external store.

## Invalid Input

- Invalid form encodings and malformed JSON still produce the existing Express/body-parser behavior. Rate limiting must not turn every malformed request into a `500`.
- Invalid reset token values are limited before the token lookup.
- A blocked request must not cause a database error, SMTP error, or unhandled promise rejection.

## Security Cases

- `trust proxy: true` is absent.
- Direct forged `X-Forwarded-For` does not create a new bucket when the connection is not from the trusted proxy.
- Different real IPs get independent buckets.
- The `429` body does not echo the email, UUID, token, or any credentials.
- The route handler, database, and SMTP are not reached for blocked requests.
- No loopback/private-IP bypass exists.
- No query parameter/header/cookie bypass exists.
- The limiter is applied to all five endpoints, including the GET reset page and the POST reset submission.
- No unrelated unthrottled reset route exists after the search in §5.1.

## Regression Testing

Run and report each of these:

```bash
node --test test/051-reset-endpoints-rate-limit.test.js
node --test test/049-reset-token-invalidation-and-expiry.test.js
node --test test/050-forgot-password-response.test.js
node --test test/password-reset.test.js
node --test test/003.2-plaintext-password-storage-on-reset.test.js
```

Also verify manually:

- Forgot-password lookup still returns `found` / `not found` exactly as before.
- Reset-token row creation still works.
- Reset email still sends.
- Reset page still renders.
- Password reset still succeeds and invalidates the token.
- A second use of the same reset token still fails.
- An expired token still fails.

Do not remove or weaken an existing test to make the new limiter pass.

---

# 14. Verification / Evidence

The implementing agent must provide evidence, not just a claim that the code “looks right”.

Required evidence:

1. `npm ls express-rate-limit` shows the installed version and it satisfies Express 5.
2. `git diff --stat` and `git diff` show only the intended files.
3. `grep -rn "passwordResetRateLimit" app/routes` shows the limiter applied to all five routes.
4. `grep -rn "trust proxy" app/src/server.js` shows a safe numeric/named setting, never `true`.
5. The test output for `test/051-reset-endpoints-rate-limit.test.js` passes, including:
   - N allowed requests.
   - N+1 returns `429`.
   - handler call count remains N.
   - `Retry-After` is present.
   - body is generic.
   - different IP buckets are independent.
6. The existing reset tests pass.
7. A manual happy-path reset works end to end.
8. A manual sixth request to a strict endpoint returns `429` and does not create a row or send email.
9. A manual direct request with a forged `X-Forwarded-For` does not bypass the limiter (or, if the test environment cannot simulate direct external access, the trust setting and reasoning are documented as a residual risk).
10. A final search confirms there is no other unthrottled reset-related route.

For security fixes, explicitly require a search for similar vulnerable patterns in the affected functionality:

```bash
grep -rn "create-reset-token\|reset-password\|forgot-password-process\|send-email-for-change-password" app --include=*.js
```

Every match that registers a route must either have a limiter or be documented as an intentional non-reset route.

Do not report “Fixed” without the test output, the route evidence, and the final diff review.

---

# 15. Do NOT Do

- Do not apply a global `app.use(limiter)` or implement Finding 7 here.
- Do not add rate limiting to login, registration, uploads, search, or unrelated APIs in this task.
- Do not set `trust proxy` to `true`.
- Do not skip the limiter for loopback, private IPs, `localhost`, or development mode.
- Do not add a query-parameter, header, cookie, or secret bypass.
- Do not write a custom rate-limit algorithm or a custom `X-Forwarded-For` parser.
- Do not add Redis, a database-backed counter, PM2 cluster coordination, or an external store.
- Do not add account-based limiting unless it is explicitly requested and separately documented; it can be abused to lock out a victim. If added, it must not replace IP limiting.
- Do not change reset-token generation, expiry, single-use deletion, or the reset email template.
- Do not change `PasswordResetService`, bcrypt cost, password validation, or session handling.
- Do not change the existing success response strings or response envelopes.
- Do not change `found` / `not found` into a different anti-enumeration response in this task.
- Do not change the database schema, `reset_tokens` model, or migrations.
- Do not change `.env`, `.env.*`, secrets, SMTP configuration, SSL configuration, or Nginx configuration.
- Do not log request bodies, email addresses, tokens, or passwords.
- Do not add a new test framework or mocking dependency.
- Do not modify `CODE_REVIEW.md`.
- Do not rewrite `README.md` unless a verified documentation statement is actually wrong.
- Do not run `npm test` expecting it to pass; it is an intentional stub.
- Do not let `npm run lint` introduce unrelated formatting churn. Review and revert unrelated changes.
- Do not use production data, real email addresses, real SMTP, or real user tokens.
- Do not commit unless the user explicitly asks.

---

# 16. Acceptance Criteria

## Acceptance Criteria

- [ ] `express-rate-limit` is installed and recorded in `package.json` and `package-lock.json`.
- [ ] `app/middleware/rate-limit/password-reset.rate-limit.js` exists and exports a factory plus one limiter per reset endpoint.
- [ ] `app/middleware/index.js` exports the rate-limit module using the existing barrel pattern.
- [ ] `POST /api/post/forgot-password-process` is protected by the lookup limiter.
- [ ] `POST /api/post/create-reset-token` is protected by the token limiter.
- [ ] `POST /api/post/send-email-for-change-password` is protected by the email limiter.
- [ ] `GET /reset-password/:token` is protected by the page limiter.
- [ ] `POST /reset-password/:token` is protected by the submit limiter.
- [ ] `trust proxy` is configured to a safe, verified value and is not `true`.
- [ ] The strict endpoints use a 15-minute window and a limit of 5 requests per IP.
- [ ] The GET reset page uses a reasonable limit (30 requests per 15 minutes) that allows normal refreshes and email scanners.
- [ ] A request over the limit receives `HTTP 429`.
- [ ] The `429` body is generic and contains no email, UUID, token, password, or internal error.
- [ ] The `429` response includes `Retry-After` and standardized `RateLimit-*` headers.
- [ ] Blocked requests do not invoke the route handler, query the database, create tokens, or send email.
- [ ] Different IPs receive independent buckets.
- [ ] A forged `X-Forwarded-For` from an untrusted direct connection cannot bypass the limiter.
- [ ] No loopback/private-IP bypass exists.
- [ ] The forgotten-password lookup response, reset-token response, email response, reset page, reset success, and reset failure behavior are unchanged for under-limit requests.
- [ ] Existing token expiry and single-use behavior are unchanged.
- [ ] `public/assets/js/forgot-password.js` handles `429` for all three calls and preserves success behavior.
- [ ] `public/assets/js/reset-password.js` handles `429` and preserves success behavior.
- [ ] `node --test test/051-reset-endpoints-rate-limit.test.js` passes.
- [ ] `node --test test/049-reset-token-invalidation-and-expiry.test.js` passes.
- [ ] `node --test test/050-forgot-password-response.test.js` passes.
- [ ] `node --test test/password-reset.test.js` passes.
- [ ] `node --test test/003.2-plaintext-password-storage-on-reset.test.js` passes.
- [ ] A manual complete reset flow succeeds within the limits.
- [ ] A manual sixth strict request returns `429` without side effects.
- [ ] `npm run lint` was run and unrelated formatting churn was reviewed/reverted.
- [ ] `git diff` contains only the files listed in §6 plus the new test and dependency files.
- [ ] Remaining risks (memory store per process, shared NAT IPs, proxy topology, distributed attacks) are documented.

---

# 17. Expected Final Report

Finish with this structure:

```markdown
# Implementation Report

## Summary

Brief explanation of what was implemented.

## Files Modified

| File | Changes |
|---|---|
| `...` | ... |

## Files Added

| File | Purpose |
|---|---|
| `...` | ... |

## Files Deleted

| File | Reason |
|---|---|
| `...` | ... |

## Files Referenced Only

| File | Why |
|---|---|
| `...` | ... |

## Implementation Details

Explain the important changes, including the exact rate limits, the trust-proxy decision, and why each limiter was placed at that route.

## Testing

| Test | Result |
|---|---|
| Normal case | PASS/FAIL |
| Empty / missing input | PASS/FAIL |
| Boundary / N+1 request | PASS/FAIL |
| Invalid input | PASS/FAIL |
| Security case: forged X-Forwarded-For | PASS/FAIL |
| Security case: handler bypass | PASS/FAIL |
| Regression test: Finding 49 token expiry/single-use | PASS/FAIL |
| Regression test: Finding 50 response contents | PASS/FAIL |
| Regression test: password reset service | PASS/FAIL |
| Manual happy-path reset | PASS/FAIL |
| Manual sixth-request 429 | PASS/FAIL |

## Verification

Explain how the original issue was verified as fixed, including command output summaries, route registration evidence, headers observed, and final diff review.

## Remaining Risks

List anything that could not be verified, including:
- single-process MemoryStore limitations,
- proxy topology assumptions,
- shared NAT / campus IP false positives,
- distributed attacks across many IPs,
- residual email enumeration below the threshold.

## Final Status

PASS / NEEDS REVIEW
```

---

# 18. Important Rules for the Implementing Agent

### Rule 1 — Do not hallucinate

Do not invent file paths, route names, functions, dependencies, environment values, proxy topology, or test results. If the deployment topology cannot be verified, mark it `TO INVESTIGATE` and stop before choosing a `trust proxy` value.

### Rule 2 — Separate facts from recommendations

The verified current implementation is described in §7. Everything under “Target”, “Suggested”, and “Recommended” is a recommendation. Do not present an assumption about production as an existing fact.

### Rule 3 — Prefer project consistency

Follow `app/middleware/index.js`, the route-module pattern, the legacy/Sequelize split described in `AGENTS.md`, and the existing `node:test` test style. Do not create a parallel architecture.

### Rule 4 — Preserve behavior

The reset flow is already working in production. The only intended behavior change is that excessive requests receive `429`. Do not change success responses, token semantics, hashing, sessions, email templates, or database schema.

### Rule 5 — Think about the entire code path

Investigate the full chain:

```text
Client
  ↓
Route registration
  ↓
Rate limiter
  ↓
Controller / route handler
  ↓
Service / model
  ↓
Database / SMTP
  ↓
Response
```

Do not focus only on `app/routes/forgot-password.js`. The lookup endpoint lives in `app/routes/index.js`, and the client behavior lives in `public/assets/js/`.

### Rule 6 — Make the task executable

Another AI coding agent should be able to read this document and know exactly:

- what to change,
- where to change it,
- why it must change,
- which existing behavior must not change,
- how to test it,
- how to prove it is fixed.

---

# 19. Output Requirements for the Implementing Agent

The implementing agent must return the Implementation Report from §17, not a general narrative. The report must include the actual test commands and results, the final diff review, the trust-proxy decision and its justification, and any residual risks.

If any part of the task cannot be completed safely — especially the proxy trust configuration or the automated test — report `NEEDS REVIEW` with the specific blocker instead of guessing.
