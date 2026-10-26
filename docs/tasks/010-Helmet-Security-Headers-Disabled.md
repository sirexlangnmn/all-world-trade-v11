# AI Task: Enable Helmet Security Headers and a Safe, Comprehensive CSP

> **Finding:** `CODE_REVIEW.md` — Finding 10: Helmet Security Headers Disabled
> **Task file:** `docs/tasks/010-Helmet-Security-Headers-Disabled.md`
> **Severity:** Not assigned a numeric severity in `CODE_REVIEW.md`; security hardening with high defensive value. The finding is listed under the critical security section of the executive summary.
> **Primary location:** `app/src/server.js:97-98` (line numbers will drift — verify against the live file)
> **Related findings and tasks:**
>
> - Finding 6 / `docs/tasks/006-No-Authentication-Middleware-on-API-Routes.md` — already implemented; Helmet must not interfere with `/api` authorization or CORS preflight.
> - Finding 7 / `docs/tasks/007-No-Rate-Limiting.md` — already implemented; the security-header middleware must run without consuming or bypassing rate limits.
> - Finding 8 / `docs/tasks/008-Weak-Default-Secrets-in-Environment.md` — nonce generation must use a cryptographically secure source, not a secret.
> - Finding 24 (dead/debug endpoints) and Finding 31 (`/session-checker/:random`) — separate tasks; do not remove unrelated routes here.

> **Status warning:** The codebase is in production and currently works. This is an incremental hardening task, not a rewrite. A badly configured CSP can break every page while still returning HTTP 200, so the implementation must be rolled out and verified in stages. Do not blindly enable strict enforcement without first inventorying every inline script, inline style, external resource, frame, WebSocket, and media source used by the application.

---

## 1. Task Title

**Enable Helmet with complete HTTP security headers and a non-breaking, report-first Content Security Policy, without breaking existing pages, scripts, styles, uploads, Socket.IO, MiroTalk links, or password-reset/login flows.**

---

## 2. Objective

The objective is to:

1. Mount Helmet globally so every HTML response and static response receives the standard defensive headers.
2. Replace the incomplete/commented-out CSP with a complete, maintained CSP configuration.
3. Add missing security headers that Helmet does not provide by default, notably `Permissions-Policy`.
4. Use the existing nonce infrastructure only if it is made genuinely per-response and is actually applied to script tags; otherwise do not pretend a static module-level value is a CSP nonce.
5. Roll out CSP safely:
    - First in `Content-Security-Policy-Report-Only` mode (or an environment-controlled equivalent).
    - Inventory and fix all legitimate violations.
    - Then enforce `Content-Security-Policy` only after representative pages and integrations are verified.
6. Preserve current behavior:
    - Existing `X-Frame-Options: sameorigin` behavior must remain at least as strong.
    - Existing CORS behavior must remain unchanged.
    - Existing `Cache-Control` behavior must remain unchanged.
    - Existing API JSON responses must not gain a CSP that blocks anything or changes API behavior.
    - Socket.IO and external MiroTalk links must keep working.
7. Prove the fix with automated header tests and runtime/manual page checks.

The expected end state is:

- Helmet is active on every response.
- Security headers are present and intentionally configured.
- CSP is enforced or explicitly staged as report-only with documented remaining violations.
- No legitimate page functionality is broken.
- The agent can show before/after response headers and test evidence.

---

## 3. Problem / Finding

### 3.1 Finding as reported

`CODE_REVIEW.md` Finding 10 states that Helmet is imported and configured but commented out in `app/src/server.js`:

```js
// const helmet = require("../middleware/helmet")
// app.use(helmet);
```

It also states that the only manually set security header is:

```js
res.setHeader('X-Frame-Options', 'sameorigin');
```

The finding says the application is therefore missing:

- `X-Content-Type-Options`
- `Strict-Transport-Security`
- `X-DNS-Prefetch-Control`
- `X-XSS-Protection` (legacy)
- `Referrer-Policy`
- `Permissions-Policy`
- A complete Content-Security-Policy

It notes that `app/middleware/helmet/index.js` is incomplete: it is missing `defaultSrc`, `imgSrc`, `fontSrc`, and `connectSrc`, among others.

The recommended approach in `CODE_REVIEW.md` is:

1. Update `app/middleware/helmet/index.js` with complete CSP directives.
2. Uncomment `app.use(helmet)` in `server.js`.
3. Add missing directives: `defaultSrc`, `imgSrc`, `fontSrc`, `connectSrc`, `frameSrc`.
4. Test all pages so legitimate resources are not blocked.
5. Start with `Content-Security-Policy-Report-Only` to identify violations before enforcing.

### 3.2 Current repository state — verify before acting

The following facts were true when this guide was written. **Re-verify each one against the live repository before changing code.** Do not assume line numbers or file contents are unchanged.

| Fact                                                   | Evidence                                                                                                                                                                                                                                                           | Implication                                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Helmet is already a dependency                         | `package.json` contains `"helmet": "^8.1.0"`                                                                                                                                                                                                                       | Do not add a new dependency unless the installed version is missing/broken.                                                       |
| A Helmet wrapper already exists                        | `app/middleware/helmet/index.js` exports `helmet({...})`                                                                                                                                                                                                           | Modify it; do not create a second unrelated Helmet wrapper.                                                                       |
| Helmet is not mounted                                  | `app/src/server.js` has the `require` and `app.use(helmet)` lines commented out around the nonce setup                                                                                                                                                             | The primary change is mounting/activating it.                                                                                     |
| A manual `X-Frame-Options` header exists               | `app/src/server.js` custom middleware calls `res.setHeader('X-Frame-Options', 'sameorigin')`                                                                                                                                                                       | Keep equivalent clickjacking protection; avoid duplicate/conflicting configuration.                                               |
| Old CSP code remains commented out                     | `app/src/server.js` has commented `Content-Security-Policy` and `Content-Security-Policy-Report-Only` blocks                                                                                                                                                       | Remove or retire them once Helmet owns CSP so there is one source of truth.                                                       |
| The nonce is module-level, not per-request             | `app/middleware/nonces/index.js` generates `lodashNonce` once at module load                                                                                                                                                                                       | This is not a safe per-response nonce. See §7.3.                                                                                  |
| The nonce is not applied to script tags                | `public/view/login/index.ejs` reads `data.ourGenerateNonce` into a JavaScript variable, but the repository inventory found no `nonce="<%= ... %>"` attributes on `<script>` tags                                                                                   | A CSP containing `'nonce-...'` or `'strict-dynamic'` will block inline scripts unless nonce wiring is implemented.                |
| Server data passes a static nonce to many page renders | `app/src/server.js` contains many `ourGenerateNonce: lodashNonce` entries                                                                                                                                                                                          | If per-request nonces are introduced, every page-data construction path must be updated or centralized.                           |
| The app has extensive inline script/style usage        | Inventory found roughly 36 literal `<script>` blocks, 16 `<style>` blocks, 500 inline `style="..."` attributes, and 175 inline event handlers (`onclick=`, etc.) across non-backup EJS views                                                                       | Strict CSP will break the UI unless these are handled, nonce'd, or temporarily allowed. Re-run the inventory; counts will change. |
| The app loads resources from many external origins     | Inventory found scripts/styles/fonts/images from `code.jquery.com`, `cdnjs.cloudflare.com`, `unpkg.com`, `cdn.jsdelivr.net`, `fonts.googleapis.com`, `fonts.gstatic.com`, `get.geojs.io`, `flowbite.s3.amazonaws.com`, `img.icons8.com`, YouTube/Vimeo, and others | `script-src`, `style-src`, `font-src`, `img-src`, `connect-src`, and `frame-src` must be based on a real inventory.               |
| Socket.IO is served same-origin                        | `public/view/includes/scripts/index.ejs` loads `/socket.io/socket.io.js`; `app/src/server.js` creates Socket.IO on the same HTTP server                                                                                                                            | `connect-src 'self'` plus `ws:`/`wss:` as needed must be tested.                                                                  |
| External meetings open in a new tab                    | Multiple client files use `window.open('https://meet.allworldtrade.com/join/...')`                                                                                                                                                                                 | This is not an iframe/fetch requirement, but `window.open` behavior and `Cross-Origin-Opener-Policy` must be tested.              |
| The app currently runs plain HTTP locally              | `app/src/server.js` sets `const isHttps = false;`                                                                                                                                                                                                                  | HSTS must be production/HTTPS-only. Do not assume local HTTP testing exercises HSTS.                                              |
| Deployment terminates TLS at Nginx                     | `README.md` §13.2 documents Nginx on 443 proxying to `127.0.0.1:3000`                                                                                                                                                                                              | HSTS or CSP `upgrade-insecure-requests` must be configured with this topology in mind.                                            |
| Tests use Node's built-in test runner                  | `package.json` has `"test": "node --test"` and `test/` contains `node:test` files                                                                                                                                                                                  | Add a focused test file following the existing pattern.                                                                           |

If any of these facts are false in the live repository, adjust the plan and document the discrepancy. Do not force an implementation based on stale evidence.

### 3.3 Why the current state is unsafe

Without Helmet (or equivalent manually maintained headers), the application is exposed to:

- **MIME-sniffing attacks** because `X-Content-Type-Options: nosniff` is absent.
- **Clickjacking** beyond the single manual `X-Frame-Options` header; there is no `frame-ancestors` CSP defense-in-depth.
- **Referrer leakage** because `Referrer-Policy` is absent. Reset tokens, UUIDs, and search parameters can leak to external origins through the `Referer` header.
- **Protocol downgrade / first-request interception** because `Strict-Transport-Security` is absent at the application layer (Nginx may or may not set it).
- **Browser feature abuse** because `Permissions-Policy` is absent; the browser may allow powerful APIs by default if code or injected content requests them.
- **DNS prefetch leakage** because `X-DNS-Prefetch-Control` is absent.
- **Reduced XSS defense-in-depth** because there is no enforced CSP. The application reflects or templates user/business data in many pages, and a single injection bug becomes much more damaging without CSP.

The incomplete Helmet wrapper is also unsafe to enable as-is because it contains `'strict-dynamic'` and a nonce that is not actually attached to script tags. Enabling it unchanged would likely break the UI and produce a false sense of security.

### 3.4 Attack cases to consider

Do not test only the happy path. The implementing agent must consider:

1. **Stored/reflected XSS**: a malicious business name, tagline, product description, email, or search parameter attempts to inject `<script>`, an event handler, or a `javascript:` URL.
2. **Clickjacking**: a third-party page frames the marketplace and overlays UI.
3. **MIME confusion**: an uploaded file or static asset is served with a misleading content type.
4. **Referrer leakage**: a reset-password URL or UUID-bearing page links to an external site and leaks the path/query in `Referer`.
5. **Report-only bypass**: the deployment is left permanently in report-only mode and the team believes CSP is enforced.
6. **Nonce reuse**: a static nonce is reused across all users/responses, allowing injected markup to reuse a known nonce.
7. **Overly broad allowlists**: `script-src https:` or `script-src *` defeats most of the CSP value.
8. **CSP report abuse**: an unauthenticated CSP report endpoint can be flooded or used to store attacker-controlled data/logs.

---

## 4. Affected Functionality

### 4.1 Global middleware — every response

The change affects the global Express middleware chain in `app/src/server.js`. The intended order is conceptually:

```text
Request
   ↓
trust proxy / CORS / compression
   ↓
rate limiting for /api (existing)
   ↓
body parsers
   ↓
express-session
   ↓
nonce generation (new per-request nonce, if used)
   ↓
HELMET (new/activated — sets CSP and security headers)
   ↓
existing custom headers (CORS echo, Cache-Control, X-Frame-Options)
   ↓
static files
   ↓
API routes
   ↓
page routes / EJS render
   ↓
response
```

Helmet must run **after** the per-request nonce is available and **before** responses are sent. It does not need to run after session unless the nonce is stored in session (it should not be). If Helmet is mounted before the nonce middleware, a function-valued `scriptSrc` directive that reads `res.locals.cspNonce` will see `undefined`.

### 4.2 Affected feature areas

All server-rendered pages and their resources are in scope for verification:

- Home, all-about-events, job-fair, template pages
- Login, help-and-support login, registration, registration-v2, verification
- Profile pages for all tiers, edit-profile pages, upgrade pages
- Selection/search pages
- Pricing, legal pages, forgot-password/reset-password
- Support/customer-service pages and communicator modals
- API responses under `/api/`, `/api/v2/`, `/api/v3/`
- Static assets under `public/` (CSS, JS, images, fonts, uploads)
- Socket.IO handshake and same-origin Socket.IO script
- External integrations referenced by pages:
    - jQuery from `code.jquery.com`
    - SweetAlert2 from `cdnjs.cloudflare.com`
    - Flowbite from `unpkg.com`/`cdnjs.cloudflare.com`
    - Google Fonts from `fonts.googleapis.com` / `fonts.gstatic.com`
    - Geo IP lookup from `get.geojs.io` (and possibly `freegeoip.app`)
    - YouTube/Vimeo frames/links
    - MiroTalk meeting links opened via `window.open`
    - Images from `flowbite.s3.amazonaws.com`, `img.icons8.com`, and similar
- File-preview flows that use `URL.createObjectURL(file)` and therefore `blob:` URLs
- Uploaded media served from `public/uploads/`

### 4.3 Explicitly out of scope

Do not expand this task into unrelated security findings unless a change is strictly required to make the header rollout safe:

- Removing the public bcrypt oracle (`app/routes/password.js`) — Finding 5.
- Adding authentication middleware — Finding 6, already implemented.
- Adding rate limiting — Finding 7, already implemented.
- Rotating secrets — Finding 8, separate.
- File-upload MIME/size validation — Finding 12.
- Removing `encrypt.route.js`, `/session-checker/:random`, or other debug endpoints — Finding 24/31.
- Rewriting all inline event handlers or inline styles as a general refactor. Only handle the subset required for CSP enforcement; record the rest.
- Migrating the frontend to a bundler or replacing jQuery/UIKit/Flowbite.
- Changing session cookie settings, login behavior, database schema, or API contracts.
- Modifying `.env` or committing secrets.

---

## 5. Investigation Phase

Complete this phase before editing any code. The agent must be able to explain the current state and the intended rollout mode.

### 5.1 Read project context

Read:

1. `README.md` sections:
    - §3 System Architecture
    - §6 Frontend Architecture
    - §7 Backend Architecture (middleware stack)
    - §12 Authentication & Security
    - §13 Deployment Architecture (Nginx/TLS)
    - §14 Environment Configuration
    - §19 Testing Strategy
2. `AGENTS.md` — boot sequence, middleware order, commands, and the “do not break production” rule.
3. `CODE_REVIEW.md` Finding 10 and the surrounding security findings (6, 7, 8, 24, 31).
4. This task file completely.

### 5.2 Establish a clean baseline

Run:

```bash
git status
git diff --stat
git log --oneline -10
```

The worktree may already contain changes from earlier findings. Do not revert, overwrite, reformat, or “clean up” unrelated changes. Preserve them.

Record the current response headers before changing anything:

```bash
PORT=3000 npm start
# in another terminal:
curl -sI http://localhost:3000/ | sort
```

If the database or environment prevents the server from starting, document that and use a minimal Express harness for header tests. Do not fabricate runtime evidence.

Run the relevant existing tests to establish a baseline:

```bash
node --test test/006-auth-middleware.test.js
node --test test/007-general-rate-limit.test.js
node --test test/login.test.js
node --test test/password-reset.test.js
node --test test/008-secrets-validation.test.js
```

Some integration tests may skip when the database is unavailable. Report skips separately; do not hide them.

### 5.3 Inspect the live middleware boot order

Open `app/src/server.js` and identify the exact order of:

1. `trust proxy`
2. CORS
3. compression
4. general `/api` rate limiter
5. `express.urlencoded` / `express.json`
6. `express-session`
7. nonce setup
8. commented Helmet block
9. custom header middleware (CORS echo, `Cache-Control`, `X-Frame-Options`)
10. HTTPS/HTTP server creation
11. Socket.IO setup
12. `/api` authentication middleware
13. route modules
14. `express.static`
15. error handlers
16. `view engine`
17. Sequelize sync and v3 routes

Confirm where Helmet can be mounted so it applies to page routes and static files but does not interfere with Socket.IO upgrade handling. Socket.IO attaches to the HTTP server, not Express, so Helmet does not automatically apply to WebSocket frames. Document this; do not claim Helmet secures Socket.IO traffic beyond the HTTP handshake.

### 5.4 Inspect the existing Helmet and nonce code

Read:

- `app/middleware/helmet/index.js`
- `app/middleware/nonces/index.js`
- `app/middleware/index.js`
- Every `require('../middleware/helmet')`, `require('../middleware/nonces')`, `lodashNonce`, and `ourGenerateNonce` usage.

Questions to answer:

- Is Helmet v8 installed? Check `node_modules/helmet/package.json`.
- Does the current wrapper use `useDefaults`?
- Does it use `'strict-dynamic'`?
- Is the nonce passed as a static string or a function of `req`/`res`?
- Is the nonce attached to any `<script>` tag in EJS?
- Is `ourGenerateNonce` used for anything other than the login page's unused JavaScript variable?
- Are there multiple CSP headers being set (commented code, Nginx config, or another middleware)?

### 5.5 Inventory every resource that CSP must allow

Do not guess. Search the actual EJS/JS/CSS in the live repository. Useful commands:

```bash
# Script and style blocks in EJS
grep -RIn "<script\|<style" public/view --include='*.ejs' | grep -vE 'copy|backup'

# External origins referenced by views
grep -RohE "https?://[a-zA-Z0-9._:-]+" public/view --include='*.ejs' \
  | sed -E 's#https?://([^/:]+).*#\1#' | sort | uniq -c | sort -rn

# External origins referenced by client JS/CSS
grep -RohE "https?://[a-zA-Z0-9._:-]+" public/assets/js public/assets/css \
  --include='*.js' --include='*.css' | sed -E 's#https?://([^/:]+).*#\1#' \
  | sort | uniq -c | sort -rn

# Inline event handlers and style attributes
grep -RInE "on(click|change|load|error|submit|input|keyup|keydown|mouseover|blur|focus)=\"" \
  public/view --include='*.ejs' | grep -vE 'copy|backup'
grep -RIn "style=\"" public/view --include='*.ejs' | grep -vE 'copy|backup'

# Dynamic URLs and special schemes
grep -RInE "URL\.createObjectURL|blob:|data:|getUserMedia|RTCPeerConnection|WebSocket|wss?:|eval\(|new Function" \
  public/view public/assets/js app --include='*.ejs' --include='*.js' | grep -vE 'copy|backup'
```

Build an inventory table in the final report:

| Resource type         | Example                                       | Required CSP directive                                  | Notes                                                                       |
| --------------------- | --------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| Local scripts         | `/assets/js-min/uikit.min.js`                 | `script-src 'self'`                                     | Served from `public/`                                                       |
| Inline scripts        | `<script>...</script>` in EJS partials        | `script-src 'nonce-...'` or temporary `'unsafe-inline'` | Nonce only works if added to every inline script                            |
| Inline event handlers | `onclick="goToLoginPage()"`                   | `script-src-attr`                                       | Cannot be nonce'd; must be converted or allowed                             |
| Inline styles         | `style="..."`                                 | `style-src` / `style-src-attr`                          | 500+ occurrences as of writing; `'unsafe-inline'` may be required initially |
| External scripts      | jQuery, SweetAlert2, Flowbite                 | `script-src <host>`                                     | Ignored if `'strict-dynamic'` is used without nonces                        |
| External styles       | SweetAlert2 CSS, Google Fonts CSS             | `style-src <host>`                                      | Test fonts too                                                              |
| Fonts                 | `fonts.gstatic.com`                           | `font-src <host>`                                       | Preconnect is not a CSP source                                              |
| Images                | `flowbite.s3.amazonaws.com`, `img.icons8.com` | `img-src <host>` or `https:` during rollout             | Tighten after inventory                                                     |
| Fetch/XHR             | `/api/...`, `get.geojs.io`                    | `connect-src`                                           | Include `ws:`/`wss:` if Socket.IO uses them                                 |
| Frames                | YouTube/Vimeo iframes                         | `frame-src`                                             | `frame-ancestors` is for who may embed us                                   |
| Media                 | uploaded videos, `blob:` previews             | `media-src` / `img-src`                                 | `blob:` is common for previews                                              |
| Uploaded files        | `/uploads/...`                                | appropriate `img-src`/`media-src` `'self'`              | Served by `express.static`                                                  |
| Meeting links         | `https://meet.allworldtrade.com/...`          | Usually not CSP-controlled if opened in a new tab       | Test `window.open`, not just CSP                                            |

Re-run the inventory after changes. Counts and hosts will drift.

### 5.6 Inspect deployment and TLS assumptions

Read `README.md` §13 and the Nginx configuration guidance. Determine:

- Does Nginx already set HSTS, `X-Content-Type-Options`, `Referrer-Policy`, or CSP?
- Is the Node app directly reachable on port 3000 from outside the host? If yes, application-level headers matter even if Nginx sets them.
- Is production always HTTPS at the browser? HSTS must only be sent in that case.
- Are there subdomains (`meet.allworldtrade.com`, `meet2.allworldtrade.com`) that would be affected by `includeSubDomains`?
- Does the app trust `X-Forwarded-Proto` / is `trust proxy` configured? It is set to `'loopback'`, which is relevant for secure cookies and HSTS decisions.

Do not change Nginx in this task unless explicitly requested. If Nginx already sets a conflicting CSP, coordinate or remove the duplicate at one layer only.

### 5.7 Inspect existing test patterns

Read `test/006-auth-middleware.test.js`, `test/007-general-rate-limit.test.js`, `test/008-secrets-validation.test.js`, and `test/051-reset-endpoints-rate-limit.test.js` to follow the project's test conventions:

- `node:test`
- `node:assert` / `node:assert/strict`
- Minimal Express app with middleware mounted
- Start an HTTP server on an ephemeral port
- Use `fetch` or `node:http` and close the server in `after`

Do not introduce Jest, Mocha, Supertest, Playwright, or another framework unless the repository already uses it. It does not.

---

## 6. File Impact Analysis

| File                                                   | Role                                           | Action                                  | Reason                                                                                                                       |
| ------------------------------------------------------ | ---------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `app/middleware/helmet/index.js`                       | Current Helmet configuration                   | MODIFY                                  | Contains incomplete CSP and a non-functional nonce reference                                                                 |
| `app/src/server.js`                                    | Express bootstrap and middleware order         | MODIFY                                  | Helmet is commented out; nonce must be per-request and available before Helmet; remove obsolete commented CSP                |
| `app/middleware/nonces/index.js`                       | Current nonce generator                        | MODIFY                                  | Module-level singleton is not a per-response nonce; add per-request middleware while preserving compatibility if needed      |
| `app/middleware/index.js`                              | Middleware barrel exports                      | MODIFY (optional)                       | Use only if the project convention is to expose middleware through the barrel; otherwise require directly like existing code |
| `app/src/server.js` (page data)                        | `ourGenerateNonce: lodashNonce` in many routes | MODIFY (if nonce is used)               | Static nonce must be replaced with per-request value, or centralized to avoid touching ~35 places                            |
| `public/view/includes/head/index.ejs`                  | Shared `<head>` and script/style tags          | INVESTIGATE / MODIFY (if nonce is used) | External and local script tags may need nonce attributes if `'strict-dynamic'` is used                                       |
| `public/view/includes/scripts/index.ejs`               | Shared bottom scripts                          | INVESTIGATE / MODIFY (if nonce is used) | jQuery and Socket.IO script tags may need nonce attributes                                                                   |
| Inline `<script>` blocks in EJS                        | Multiple partials/pages                        | INVESTIGATE / MODIFY (only as required) | Strict CSP blocks them unless nonce'd or allowed                                                                             |
| Inline event handlers / `style` attributes             | Multiple EJS files                             | INVESTIGATE / DOCUMENT                  | Cannot all be safely converted in this task; decide temporary allowances and record follow-ups                               |
| `test/010-helmet-security-headers.test.js`             | New focused test                               | ADD                                     | Assert headers, CSP directives, report-only/enforced behavior, and no `unsafe-eval`                                          |
| `test/010-Helmet-Security-Headers-Test-Result.md`      | Evidence report                                | ADD (optional but consistent with repo) | Record commands, headers, page checks, and residual risks                                                                    |
| `README.md`                                            | Security documentation                         | MODIFY (optional)                       | Update §3.4/§12.2 only after the code is verified; do not claim headers are enabled before they are                          |
| `AGENTS.md`                                            | Agent conventions                              | REFERENCE ONLY                          | Follow boot order and commands; do not rewrite                                                                               |
| `CODE_REVIEW.md`                                       | Finding source                                 | REFERENCE ONLY                          | Do not edit the review document                                                                                              |
| `public/view/legal/origin.ejs` and other one-off pages | External resources                             | INVESTIGATE                             | May contain malformed or unusual external URLs; do not “fix” unrelated issues unless they block CSP                          |
| `app/routes/*.js`                                      | Route modules                                  | REFERENCE ONLY                          | No route logic should need to change for headers                                                                             |
| `app/middleware/auth.middleware.js`                    | `/api` auth                                    | REFERENCE ONLY                          | Helmet must not bypass or alter auth                                                                                         |
| `app/middleware/rate-limit/*.js`                       | Rate limiting                                  | REFERENCE ONLY                          | Do not duplicate or bypass limiters                                                                                          |

Do not modify a file just because it appears in this table. Confirm the need with evidence.

---

## 7. Current Implementation

### 7.1 Server bootstrap

At the time of writing, `app/src/server.js` contains a pattern equivalent to:

```js
// Set CSP with helmet
// const helmet = require("../middleware/helmet")
// app.use(helmet);
```

The custom header middleware then sets:

```js
res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
// res.setHeader('Content-Security-Policy', "frame-ancestors 'self'; frame-src 'self'");
// res.setHeader(
//     'Content-Security-Policy-Report-Only', "default-src 'self'; ...",
// );
res.setHeader('X-Frame-Options', 'sameorigin');
```

There are also commented CSP variants in this block. These are stale and must not remain as a second source of truth once Helmet is active.

### 7.2 Current Helmet wrapper

`app/middleware/helmet/index.js` is currently equivalent to:

```js
const helmet = require('helmet');
let { lodashNonce } = require('../nonces');

module.exports = helmet({
    contentSecurityPolicy: {
        directives: {
            scriptSrc: [
                "'strict-dynamic'", // For nonces to work
                `'nonce-${lodashNonce}'`,
            ],
            scriptSrcAttr: null, // Remove Firefox warning
            styleSrc: ["'self'", 'https:'], // Remove 'unsafe-inline'
        },
    },
});
```

Problems with this configuration if enabled unchanged:

1. `lodashNonce` is generated once at module load, not per response.
2. The nonce is not attached to any script tag in the templates.
3. `'strict-dynamic'` causes host allowlists to be ignored; external scripts without a nonce would be blocked.
4. `scriptSrcAttr: null` omits the directive; inline event handlers then fall back to `script-src`, which would block the 175+ `onclick`/`onchange` handlers.
5. `styleSrc: ["'self'", 'https:']` does not allow the 500+ inline `style="..."` attributes or the 16 inline `<style>` blocks.
6. `defaultSrc`, `imgSrc`, `fontSrc`, `connectSrc`, `frameSrc`, `mediaSrc`, `objectSrc`, `baseUri`, `formAction`, `frameAncestors`, and `workerSrc` are not explicitly defined.
7. There is no HSTS/production gating, no `Permissions-Policy` (Helmet does not set it by default), and no handling for `blob:` previews or Socket.IO WebSocket connections.

### 7.3 Current nonce implementation

`app/middleware/nonces/index.js` is currently equivalent to:

```js
let crypto;
try {
    crypto = require('crypto');
} catch (err) {
    console.log('crypto support is disabled!');
}

let lodashNonce = crypto.randomBytes(16).toString('hex');

module.exports = { lodashNonce };
```

This produces one nonce for the lifetime of the process. It is then used in two places:

- In the Helmet CSP string (currently inactive).
- As `ourGenerateNonce` in many `res.render(..., { data })` payloads in `server.js`.

`public/view/login/index.ejs` reads it into a client-side variable:

```ejs
let ourGenerateNonce = `<%= data.ourGenerateNonce %>`;
console.log('ourGenerateNonce: ', ourGenerateNonce);
```

But repository search found no `nonce="<%= ... %>"` attribute on actual `<script>` tags. Therefore, adding `'nonce-...'` to `script-src` today would not authorize any inline or external script. It would only make the policy stricter and break pages.

### 7.4 Current resource profile

Inventory at the time of writing (re-verify):

- 36 literal `<script>` blocks in non-backup EJS files.
- 16 `<style>` blocks.
- 500 inline `style="..."` attributes.
- 175 inline event handlers such as `onclick=`, `onchange=`, `onload=`.
- External scripts/styles/fonts/images from:
    - `code.jquery.com`
    - `cdnjs.cloudflare.com`
    - `unpkg.com`
    - `cdn.jsdelivr.net`
    - `fonts.googleapis.com`
    - `fonts.gstatic.com`
    - `flowbite.s3.amazonaws.com`
    - `img.icons8.com`
    - `get.geojs.io`
    - `freegeoip.app`
    - `www.youtube.com`, `youtu.be`, `player.vimeo.com`
    - `www.google-analytics.com` (verify whether actually loaded)
    - `cdn.tailwindcss.com` (verify whether active or only commented)
- Same-origin Socket.IO at `/socket.io/socket.io.js`.
- `blob:` URLs from `URL.createObjectURL(file)` in media preview scripts.
- Uploaded media under `/uploads/...`.
- External meeting links opened with `window.open` to `https://meet.allworldtrade.com/join/...`.

These facts drive the CSP allowlist. Do not copy a generic Helmet example without reconciling this inventory.

---

## 8. Current → Target

### 8.1 Conceptual change

## Current

```text
Browser request
   ↓
Express middleware
   ↓
(no Helmet; no CSP; no Referrer-Policy; no Permissions-Policy)
   ↓
manual Cache-Control + X-Frame-Options
   ↓
page or API response
```

## Target

```text
Browser request
   ↓
Express middleware
   ↓
per-request nonce (if nonce-based CSP is used)
   ↓
Helmet:
  - Content-Security-Policy (report-only first, then enforced)
  - X-Content-Type-Options
  - Referrer-Policy
  - Strict-Transport-Security (production/HTTPS only)
  - X-DNS-Prefetch-Control
  - X-Frame-Options / frame-ancestors
  - Cross-Origin-* headers as appropriate
   ↓
Permissions-Policy (manual header; Helmet does not set it by default)
   ↓
existing Cache-Control + CORS echo
   ↓
page or API response
```

### 8.2 Header behavior target

| Header                                                             | Target source                       | Expected behavior                                                                                                                              |
| ------------------------------------------------------------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy` or `Content-Security-Policy-Report-Only` | Helmet                              | Complete directive set; report-only during rollout, enforced after verification                                                                |
| `X-Content-Type-Options`                                           | Helmet                              | `nosniff`                                                                                                                                      |
| `Referrer-Policy`                                                  | Helmet                              | Choose and document one policy; `no-referrer` is strictest, `strict-origin-when-cross-origin` is common. Test external links and reset flows.  |
| `Strict-Transport-Security`                                        | Helmet                              | Only in production/HTTPS; start with a modest `max-age`, no `preload` unless deliberate                                                        |
| `X-DNS-Prefetch-Control`                                           | Helmet                              | `off` or intentionally configured                                                                                                              |
| `X-Frame-Options`                                                  | Helmet (plus CSP `frame-ancestors`) | `SAMEORIGIN` equivalent; remove the duplicate manual header or keep it intentionally                                                           |
| `Permissions-Policy`                                               | Manual middleware                   | Explicitly allow/deny camera, microphone, geolocation, payment, USB, etc. based on actual features                                             |
| `Cross-Origin-Opener-Policy`                                       | Helmet                              | Default `same-origin`; test `window.open` to MiroTalk and any popup flows                                                                      |
| `Cross-Origin-Resource-Policy`                                     | Helmet                              | Default `same-origin`; test whether any external origin embeds our assets                                                                      |
| `Cross-Origin-Embedder-Policy`                                     | Helmet                              | Keep disabled unless there is a documented need; enabling it requires all cross-origin resources to opt in                                     |
| `Cache-Control`                                                    | Existing manual middleware          | Preserve the existing value; avoid duplicate/conflicting Helmet cache headers                                                                  |
| `X-XSS-Protection`                                                 | Helmet                              | Modern Helmet sets `0`; do not blindly set `1; mode=block` because legacy XSS auditors can introduce vulnerabilities. CSP is the real defense. |

### 8.3 Code pattern — current vs target

The following is an illustrative target. **Adapt it to the actual codebase and verify Helmet v8 behavior before using it verbatim.**

Current:

```js
// app/src/server.js
// const helmet = require("../middleware/helmet")
// app.use(helmet);
```

Target (conceptual):

```js
// app/src/server.js
const { nonceMiddleware } = require('../middleware/nonces');
app.use(nonceMiddleware);

const helmet = require('../middleware/helmet');
app.use(helmet);
```

Current nonce:

```js
let lodashNonce = crypto.randomBytes(16).toString('hex');
module.exports = { lodashNonce };
```

Target (conceptual, per request):

```js
const crypto = require('crypto');

function nonceMiddleware(req, res, next) {
    const nonce = crypto.randomBytes(16).toString('base64');
    req.cspNonce = nonce;
    res.locals.cspNonce = nonce;
    next();
}

module.exports = { nonceMiddleware };
```

If compatibility is required during migration, you may temporarily keep a named export for old call sites, but **do not use a static nonce in an enforced CSP**. Update all call sites.

Current CSP:

```js
scriptSrc: ["'strict-dynamic'", `'nonce-${lodashNonce}'`],
scriptSrcAttr: null,
styleSrc: ["'self'", 'https:'],
```

Target (conceptual; report-first, then tighten):

```js
const isProduction = process.env.NODE_ENV === 'production';
const cspReportOnly = process.env.CSP_REPORT_ONLY !== 'false';

module.exports = helmet({
    contentSecurityPolicy: {
        reportOnly: cspReportOnly,
        useDefaults: false,
        directives: {
            defaultSrc: ["'self'"],
            baseUri: ["'self'"],
            objectSrc: ["'none'"],
            scriptSrc: [
                "'self'",
                (req, res) => `'nonce-${res.locals.cspNonce}'`,
                'https://code.jquery.com',
                'https://cdnjs.cloudflare.com',
                'https://unpkg.com',
                'https://cdn.jsdelivr.net',
            ],
            // Temporary only if inline handlers remain. Remove after conversion.
            scriptSrcAttr: ["'unsafe-inline'"],
            // 'unsafe-inline' is needed for existing style attributes/blocks.
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                'https://cdnjs.cloudflare.com',
                'https://fonts.googleapis.com',
                'https://unpkg.com',
            ],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
            fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
            connectSrc: ["'self'", 'ws:', 'wss:', 'https://get.geojs.io', 'https://freegeoip.app'],
            frameSrc: ["'self'", 'https://www.youtube.com', 'https://player.vimeo.com'],
            mediaSrc: ["'self'", 'blob:', 'https:'],
            workerSrc: ["'self'", 'blob:'],
            formAction: ["'self'"],
            frameAncestors: ["'self'"],
            upgradeInsecureRequests: isProduction ? [] : null,
        },
    },
    crossOriginEmbedderPolicy: false,
    hsts: isProduction ? { maxAge: 15552000, includeSubDomains: false, preload: false } : false,
    cacheControl: false,
});
```

Important cautions for this pattern:

- Do **not** include `'strict-dynamic'` until every external and inline script that must run has a nonce. `'strict-dynamic'` causes host allowlists to be ignored.
- A function-valued directive is supported by Helmet, but verify it in the installed version. The function must read a per-request value, not a module-level constant.
- `scriptSrcAttr: ["'unsafe-inline'"]` is a temporary compatibility concession for the existing inline event handlers. It weakens CSP. Treat its removal as a follow-up task and document it.
- `styleSrc` with `'unsafe-inline'` is also a temporary concession for 500+ inline style attributes and inline `<style>` blocks.
- `imgSrc 'https:'` is broad. Use it only during rollout, then narrow to the actual hosts from the inventory.
- `connectSrc 'ws:'` may be needed for local development; production should prefer `'self'` and `wss:` and be tested.
- `upgradeInsecureRequests` must be disabled in local HTTP development or browsers will rewrite requests to HTTPS and break the app.
- `hsts` must be disabled outside production/HTTPS.
- `cacheControl: false` avoids conflicting with the app's existing `Cache-Control` middleware. If you prefer Helmet's cache control, remove the custom header instead — do not set both to different values.
- Do not enable `crossOriginEmbedderPolicy` without a full audit; it requires opt-in from every cross-origin resource.

---

## 9. Detailed Implementation Plan

### Step 0 — Establish baseline and record current headers

1. Run `git status`, `git diff --stat`, and the focused baseline tests from §5.2.
2. Capture current response headers with `curl -sI` for:
    - `/`
    - `/login` (or the actual login route)
    - `/registration-v2` (or actual route)
    - `/selection` (or actual route)
    - `/api/get/categories` or another lightweight API endpoint
    - a static asset such as `/assets/css/style.css`
3. Save the output in the final report so the before/after is auditable.
4. If the server cannot start due to environment/database issues, say so and use a minimal Express harness for header tests. Do not invent production evidence.

### Step 1 — Choose the rollout mode

Choose explicitly and document it:

**Option A — Recommended for production safety:**

1. Ship Helmet with CSP in **report-only** mode first.
2. Keep all non-CSP Helmet headers enabled (with HSTS production-gated).
3. Collect/inspect browser console CSP violations on every representative page.
4. Fix or explicitly allow legitimate resources.
5. Flip to enforced CSP in a second change after verification.

**Option B — Offline/local-only initial enforcement:**

1. Enable report-only locally.
2. Crawl every page manually with browser devtools open.
3. Fix violations.
4. Enable enforcement only when the console is clean on representative pages.

Do not leave the system permanently in report-only mode and call the finding fixed. Report-only is a rollout stage, not the final state, unless the final report explicitly documents why enforcement is blocked and what remains.

Suggested environment control:

```text
CSP_REPORT_ONLY=true   # initial rollout
CSP_REPORT_ONLY=false  # final enforced state
```

Add the variable to `.env.example` with a safe placeholder/default if the project's environment pattern allows it. Never modify `.env` or commit real secrets. If adding an environment variable is undesirable, use an existing `NODE_ENV`-based default, but document the tradeoff.

### Step 2 — Implement a per-request nonce (only if using nonce-based CSP)

If the final CSP uses `'nonce-...'` for scripts:

1. Modify `app/middleware/nonces/index.js` to export a middleware that generates a fresh cryptographically secure nonce per request.
2. Store it on `req.cspNonce` and `res.locals.cspNonce`.
3. Mount the nonce middleware before Helmet.
4. Update `app/src/server.js` page-data construction from `ourGenerateNonce: lodashNonce` to a per-request value. Search for **all** occurrences; do not update only the first one.
5. Update EJS script tags to include the nonce:
    ```ejs
    <script nonce="<%= data.ourGenerateNonce %>">...</script>
    <script nonce="<%= data.ourGenerateNonce %>" src="..."></script>
    ```
    If using `res.locals`, use `<%= cspNonce %>` or the project's established locals pattern.
6. Remove or deprecate the old `lodashNonce` export once no call site depends on it.

If the task remains in report-only mode, the nonce wiring can be staged, but the CSP must not claim to use a nonce that is not present on script tags. Either wire it correctly or omit the nonce directive during the report-only phase.

Do not log the nonce in production. Remove the existing `console.log('ourGenerateNonce: ', ...)` from `public/view/login/index.ejs` if it is still present; it is unnecessary and leaks a CSP token to the console.

### Step 3 — Rewrite the Helmet configuration

In `app/middleware/helmet/index.js`:

1. Define an explicit directive set. Use `useDefaults: false` if you are providing a complete set, so Helmet does not silently merge unexpected defaults.
2. Include at minimum:
    - `defaultSrc`
    - `baseUri`
    - `objectSrc`
    - `scriptSrc`
    - `scriptSrcAttr` (only if intentionally allowing inline handlers)
    - `styleSrc`
    - `imgSrc`
    - `fontSrc`
    - `connectSrc`
    - `frameSrc`
    - `mediaSrc`
    - `workerSrc`
    - `formAction`
    - `frameAncestors`
    - `upgradeInsecureRequests` (disabled for local HTTP)
3. Make report-only mode environment-controlled.
4. Make HSTS production-only.
5. Keep `crossOriginEmbedderPolicy` disabled unless there is a documented requirement.
6. Configure `cacheControl: false` or remove the custom `Cache-Control` header; do not stack conflicting values.
7. Do not use `'unsafe-eval'` unless a real dependency requires it and the need is documented. Search for `eval(`, `new Function`, and template compilers before considering it. The expected answer is no.
8. Avoid `script-src https:` / `*` as a final state. Use it only in report-only mode if necessary to discover resources, then replace with the actual hosts.

### Step 4 — Mount Helmet in the correct order

Modify `app/src/server.js`:

1. Require the nonce middleware and Helmet wrapper.
2. Mount the nonce middleware before Helmet.
3. Mount Helmet before the custom header middleware and before `express.static`, routes, and EJS rendering.
4. Decide what to do with the manual `res.setHeader('X-Frame-Options', 'sameorigin')`:
    - Preferred: remove it and rely on Helmet + `frame-ancestors 'self'`, after confirming the header is still present.
    - Acceptable: keep it, but confirm it does not create a conflicting/duplicate header and document why.
5. Remove the commented-out CSP blocks so there is exactly one CSP source.
6. Add `Permissions-Policy` via a small middleware (Helmet does not set it by default), for example:
    ```js
    app.use((req, res, next) => {
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
        next();
    });
    ```
    Verify actual feature needs before denying. The marketplace opens MiroTalk in a separate tab, so camera/microphone are not expected on this origin; confirm this before shipping.
7. Confirm Helmet does not break Socket.IO. Socket.IO upgrades bypass Express middleware; test the handshake and the same-origin `/socket.io/socket.io.js` load.

Do not mount Helmet after routes; headers must be set before the response is written.

### Step 5 — Wire nonce attributes into templates (if nonce-based)

If enforcing nonce-based CSP:

1. Add the nonce to every `<script>` tag that must run, including external script tags:
    - jQuery
    - SweetAlert2
    - Flowbite
    - UIKit/local bundles
    - page-specific scripts
    - inline script blocks
2. Add the nonce to any `<style>` block that must run if using nonce-based styles. Prefer allowing `'unsafe-inline'` for styles initially because there are 500+ inline `style` attributes that cannot be nonce'd.
3. If using `'strict-dynamic'`, remember that host allowlists are ignored. Every script that should run must either have a nonce or be dynamically loaded by an already-trusted script.
4. Do not add the nonce to user-controlled content or expose it in a way that makes it easy to reuse. It is visible in HTML by design, but it must be unpredictable per response.

This step can be large. If it cannot be completed safely in one change, keep CSP report-only, document the remaining work, and do not claim full nonce enforcement.

### Step 6 — Handle inline event handlers and inline styles

There are three practical options:

**Option 1 — Temporary compatibility (recommended for this task):**

- Allow `script-src-attr 'unsafe-inline'` for existing event handlers.
- Allow `style-src 'unsafe-inline'` for existing style attributes/blocks.
- Document both as technical debt with counts and file examples.
- Keep script loading (`script-src`) nonce/host restricted.

**Option 2 — Partial conversion:**

- Convert the highest-risk inline handlers (especially ones that build URLs or use user data) to event listeners in existing JS files.
- Leave the rest allowed temporarily.
- Re-inventory after conversion.

**Option 3 — Full strict CSP:**

- Remove/convert all 175+ inline handlers and all 500+ style attributes.
- This is a large frontend refactor and should be a separate task. Do not attempt it here unless the user explicitly expands scope.

Choose one option explicitly in the final report. Do not silently enable a policy that breaks the UI.

### Step 7 — Configure HSTS and secure transport correctly

1. HSTS must only be sent when the browser is actually using HTTPS.
2. Since the Node app runs plain HTTP locally and TLS terminates at Nginx in production, gate HSTS on production/HTTPS:
    ```js
    hsts: isProduction
        ? { maxAge: 15552000, includeSubDomains: false, preload: false }
        : false,
    ```
3. Start with a shorter `max-age` if the deployment is not certain, then increase.
4. Do not enable `preload` unless the domain owner has deliberately submitted and can support it.
5. Decide whether `includeSubDomains` is safe for `meet.allworldtrade.com` / `meet2.allworldtrade.com`; if those subdomains are not always HTTPS, leave it off.
6. Verify Nginx does not also set a conflicting HSTS header. Duplicate identical headers are usually harmless; conflicting values are not.

### Step 8 — Add CSP reporting only if it is safe (optional)

A report endpoint is useful but not required for the core fix. If added:

1. Accept `application/csp-report` and/or `application/reports+json`.
2. Apply a dedicated rate limit and a small body-size limit.
3. Do not log sensitive URLs, query strings, tokens, session IDs, or user data.
4. Do not store unbounded attacker-controlled data.
5. Do not create an unauthenticated endpoint that can be used to exhaust disk or memory.

If no safe reporting endpoint is added, rely on browser console reports during local/manual verification and document that limitation.

### Step 9 — Add automated tests

Create `test/010-helmet-security-headers.test.js` using `node:test` and the existing project pattern. Do not require a database for header-only tests if possible.

Recommended test cases:

1. **Helmet is mounted in the live source**
    - Read `app/src/server.js`.
    - Assert it requires the Helmet wrapper and calls `app.use(helmet)`.
    - Assert the old commented `app.use(helmet)` is no longer the only occurrence.
2. **Headers are present on an HTML response**
    - Mount the real Helmet wrapper (with a test nonce if needed) on a minimal Express app.
    - Request `/`.
    - Assert `x-content-type-options: nosniff`.
    - Assert `referrer-policy` is set.
    - Assert `x-frame-options` is set (or `frame-ancestors` is present).
    - Assert `permissions-policy` is set by the manual middleware if that middleware is mounted in the harness.
3. **CSP header exists and has expected directives**
    - Assert `content-security-policy` or `content-security-policy-report-only` is present.
    - Assert it contains `default-src`, `script-src`, `style-src`, `img-src`, `font-src`, `connect-src`, `frame-src`, `object-src`, `base-uri`, `frame-ancestors`.
    - Assert no `unsafe-eval`.
    - Assert no wildcard `script-src *` unless explicitly documented for report-only.
4. **Report-only vs enforced mode**
    - Set the controlling environment variable to each value and assert the correct header name.
    - Ensure the test restores `process.env` afterward.
5. **HSTS is production-only**
    - Assert absent/disabled in non-production mode.
    - Assert present in production-mode configuration.
6. **Nonce behavior (if implemented)**
    - Two requests produce different nonces.
    - The nonce appears in the CSP and can appear in a rendered script tag.
    - The nonce is not a module-level constant.
7. **No duplicate conflicting CSP headers**
    - Assert only one CSP header is emitted by the app (Helmet) and no stale manual CSP is set.
8. **Static/API response behavior**
    - Assert static assets still return their expected content type and are not blocked by Helmet.
    - Assert API JSON responses still have the expected status/body shape. Headers are additive and must not change API semantics.

Run:

```bash
node --test test/010-helmet-security-headers.test.js
```

Then run the focused regression tests from §5.2 and finally the full suite:

```bash
npm test
```

Report skips separately if the database is unavailable.

### Step 10 — Runtime and manual verification

Header presence is not enough. Verify the UI still works with a browser (or the best available equivalent):

1. Start the app:
    ```bash
    npm run dev
    ```
2. Open devtools → Console and Network on every representative page.
3. Look for CSP violations (`Refused to load...`, `Refused to execute inline script...`, `Refused to apply inline style...`).
4. Verify:
    - CSS loads and layout is intact.
    - jQuery and plugins load.
    - SweetAlert2 dialogs work.
    - Dropdowns, modals, navigation, and form validation work.
    - Country/state/city JSON lookups work.
    - Registration and profile uploads work, including image previews (`blob:` URLs).
    - Login, logout, password reset, and email verification work.
    - Search/selection pages load and submit.
    - Help/support pages and communicator modals work.
    - Socket.IO connects and the call-notification modal works.
    - MiroTalk `window.open` links still open.
    - YouTube/Vimeo frames (if used) still load.
    - Google Fonts and icon fonts still render.
    - Uploaded images/videos/PDFs still display.
    - Static assets and API responses are unaffected.
5. Check response headers with `curl -sI` again.
6. If using report-only, record the violation reports. If enforcing, confirm the console is clean.

### Step 11 — Enforce and clean up

After report-only verification:

1. Set the CSP mode to enforced (`Content-Security-Policy`) in production.
2. Remove temporary broad allowances that are no longer needed (`https:` in `img-src`, `ws:` if unused in production, etc.).
3. Remove stale commented CSP blocks from `server.js`.
4. Remove the unused nonce `console.log` from the login view.
5. Update `README.md` §3.4/§12.2 only if the code is actually verified. Do not update the README to claim enforcement while still in report-only mode.
6. Record any remaining `'unsafe-inline'` concessions and follow-up work.

### Step 12 — Review the final diff

Before declaring completion:

```bash
git diff -- app/src/server.js app/middleware/helmet/index.js app/middleware/nonces/index.js
git diff --stat
git status
```

Confirm:

- Only intended files changed.
- No unrelated reformatting from Prettier.
- No `.env`, secrets, certificates, or generated assets changed.
- No API route behavior changed.
- No test was deleted or skipped to make the suite pass.
- The final CSP source is single and documented.

---

## 10. Architecture and Existing Patterns

Follow the existing repository patterns:

1. **Middleware location:** Put cross-cutting Express middleware under `app/middleware/`, as the project already does for `auth`, `rate-limit`, `helmet`, and `nonces`.
2. **No new dependency:** Helmet is already installed. Do not add another security-header library.
3. **Boot sequence:** Mount middleware in `app/src/server.js` in the existing order. Do not create a parallel bootstrap.
4. **Nonce generation:** Use Node's built-in `crypto.randomBytes`, as the existing nonce module does. Do not add a UUID dependency or use `Math.random()`.
5. **Configuration:** Follow the existing environment-variable style (`process.env.*`) and document any new variable in `.env.example`/README. Do not hardcode production hostnames beyond the resource allowlist.
6. **Tests:** Use `node:test` and the existing minimal-Express harness pattern from `test/006-auth-middleware.test.js` / `test/007-general-rate-limit.test.js`.
7. **Logging:** Use the existing `Logger` utility or a controlled `console` call for startup diagnostics. Do not log nonces, sessions, tokens, or full CSP report payloads.
8. **Page data:** If a per-request nonce is introduced, update the existing `ourGenerateNonce` data path rather than creating a second nonce concept. Consider extracting the repeated session-data construction (Finding 15) only if it is necessary and safe; do not turn this task into that refactor.
9. **Documentation:** Keep `README.md` accurate after verification. Do not leave contradictory statements (“Helmet is commented out”) once it is enabled.

Do not introduce:

- A new CSP framework or template helper library.
- A client-side build change.
- A new session store.
- A new authentication mechanism.
- A new frontend framework.
- A database schema change.

---

## 11. Security Requirements

This is a security task. The following requirements are mandatory.

### 11.1 Never do these things

- Never disable Helmet globally or per-route to “make a page work.”
- Never use `script-src *` or `script-src https:` in the final enforced policy.
- Never add `'unsafe-eval'` without a documented dependency requirement and a separate review.
- Never use a static, module-level nonce in an enforced CSP.
- Never log the nonce, full session, reset tokens, or CSP report bodies containing sensitive URLs.
- Never put a CSP report endpoint behind no rate limit and no body-size limit.
- Never set HSTS in local HTTP development or on a domain that cannot serve HTTPS.
- Never remove `frame-ancestors` / `X-Frame-Options` clickjacking protection.
- Never trust user-supplied content as CSP source values.
- Never expose `.env` values or secrets while debugging headers.

### 11.2 What must be validated

- Every resource loaded by a page is either same-origin, explicitly allowlisted, or loaded dynamically by a trusted script.
- Every inline script either has a valid nonce/hash or is intentionally allowed by the chosen temporary policy.
- Every inline event handler either works under the chosen `script-src-attr` policy or is converted.
- Inline styles and `<style>` blocks are accounted for in `style-src`.
- `connect-src` covers same-origin API calls, Socket.IO WebSocket traffic, and any external fetch/XHR (for example `get.geojs.io`).
- `frame-src` covers legitimate embedded video/meeting frames, and no unnecessary origins are allowed.
- `object-src 'none'` and `base-uri 'self'` are present.
- `form-action 'self'` does not break legitimate forms.
- `frame-ancestors 'self'` matches the intended clickjacking protection.
- HSTS is only sent over HTTPS and does not include unsafe subdomains/preload.
- `Permissions-Policy` denies features the app does not use and does not accidentally deny a feature it does use.
- Response headers are present on page responses, static responses, and API responses as appropriate.
- No duplicate/conflicting `Content-Security-Policy` headers are emitted.

### 11.3 Attack cases to test

- Inject `<script>alert(1)</script>` into a field that is rendered on a page; confirm CSP blocks execution when enforced.
- Inject an event handler such as `" onmouseover="alert(1)`; confirm the chosen policy behavior is documented (blocked or temporarily allowed).
- Inject a `javascript:` URL into a link/image; confirm behavior.
- Frame the app from another origin; confirm it is blocked by `frame-ancestors`/`X-Frame-Options`.
- Request a static file with a misleading extension; confirm `nosniff` is present.
- Navigate from a reset-password or UUID page to an external link; inspect the `Referer` behavior.
- Attempt to load a disallowed external script/style/image; confirm it is blocked in enforced mode.
- Attempt to reuse the nonce across two responses; confirm nonces differ.
- Send a malformed/huge CSP report (if an endpoint exists); confirm it is rate-limited and size-limited.
- Verify report-only mode does **not** block resources (it should only report), so production remains functional during rollout.

### 11.4 Security review of similar patterns

Search the repository for other places where security headers are set or CSP is referenced:

```bash
grep -RIn "Content-Security-Policy\|X-Frame-Options\|Helmet\|helmet\|Permissions-Policy\|Referrer-Policy\|Strict-Transport-Security" \
  app public test README.md --exclude-dir=node_modules
```

If another middleware, Nginx config, or route sets the same header, consolidate or document the precedence. Do not leave two conflicting CSP policies.

---

## 12. Backward Compatibility

The fix must preserve existing behavior unless a behavior change is explicitly required by the finding.

Verify and preserve:

- **Page rendering:** EJS templates still render with the same data shape. Helmet must not alter `res.render` inputs.
- **Session behavior:** No change to `express-session`, cookies, login, logout, or `req.session.user`.
- **API behavior:** No change to route paths, request bodies, response bodies, status codes, or JSON shapes. Headers are additive.
- **CORS:** The existing `Access-Control-Allow-Origin` echo and whitelist behavior must remain. CSP is not a replacement for CORS.
- **Rate limiting:** Existing `/api` and password-reset limiters must remain mounted and effective.
- **Authentication:** `/api` deny-by-default auth must remain before API routes. Helmet must not accidentally make an unauthenticated route reachable.
- **Static assets:** `express.static` must still serve CSS/JS/images/uploads with correct content types.
- **External resources:** jQuery, SweetAlert2, Flowbite, UIKit, Google Fonts, geo IP lookup, YouTube/Vimeo, and icon fonts must still load.
- **Socket.IO:** The same-origin `/socket.io/socket.io.js` script and the WebSocket handshake must still work.
- **MiroTalk:** `window.open` to `https://meet.allworldtrade.com/join/...` must still open.
- **Uploads and previews:** `blob:` image/video previews and `/uploads/...` media must still display.
- **Reset-password flow:** Reset links, forms, and email flows must still work; `Referrer-Policy` must not break them.
- **Email links:** Do not change email templates or URLs as part of this task.
- **Cache headers:** Preserve the existing `Cache-Control` value; do not let Helmet override it unintentionally.
- **Clickjacking:** `X-Frame-Options: sameorigin` behavior must remain at least as strong.
- **Local development:** Plain HTTP local usage must still work; disable `upgrade-insecure-requests` and HSTS outside production/HTTPS.
- **Deployment:** No change to `isHttps`, ports, SSL files, Nginx, PM2, or process management.

If a compatibility issue is found, prefer narrowing the CSP or adding a specific allowlist entry over disabling Helmet or weakening the entire policy.

---

## 13. Testing Strategy

### 13.1 Normal case

- Start the app with the default local configuration.
- Request `/`, `/login`, `/registration-v2`, `/selection`, `/pricing`, a legal page, and a static asset.
- Assert all expected security headers are present.
- Assert the page renders and CSS/JS load.
- Assert API endpoints still return the expected JSON.

### 13.2 Empty / missing input

- Request a route with no session and confirm it still renders the public version.
- Request an unknown route and confirm the 404/error behavior is unchanged.
- Request a static file that does not exist and confirm the response is unchanged.
- Request an API endpoint with an empty body and confirm the existing validation response is unchanged.

### 13.3 Boundary cases

- Very long URLs, query strings, and search parameters.
- Special characters and Unicode in business/profile data.
- `null`/missing optional fields in rendered views.
- Requests with and without `Origin` headers.
- Requests with `X-Forwarded-For` / `X-Forwarded-Proto` from loopback and from non-loopback.
- HTTP vs HTTPS simulation for HSTS behavior.
- Report-only vs enforced CSP modes via environment configuration.

### 13.4 Invalid input

- Malformed CSP report payloads (if an endpoint is added).
- Malformed JSON/urlencoded bodies on API routes.
- Unsupported HTTP methods.
- Invalid/expired reset tokens (regression only; do not change behavior).
- Invalid uploads (regression only; this task does not add file validation).

### 13.5 Security cases

- XSS payloads in rendered fields.
- Inline event handler injection.
- `javascript:` URL injection.
- Clickjacking from a different origin.
- MIME sniffing / content-type confusion.
- Referrer leakage from reset/UUID pages.
- Disallowed external script/style/frame loads in enforced mode.
- Nonce uniqueness across responses.
- HSTS absent in development, present only in production/HTTPS configuration.
- No `unsafe-eval` in the final CSP.
- No wildcard script source in the final enforced CSP.

### 13.6 Regression testing

Run the focused tests from §5.2 plus the full suite:

```bash
node --test test/006-auth-middleware.test.js
node --test test/007-general-rate-limit.test.js
node --test test/login.test.js
node --test test/password-reset.test.js
node --test test/049-reset-token-invalidation-and-expiry.test.js
node --test test/050-forgot-password-response.test.js
node --test test/051-reset-endpoints-rate-limit.test.js
npm test
```

Report failures that existed before this task separately. Do not “fix” unrelated failures by weakening tests or changing unrelated code.

### 13.7 Lint / formatting

The project's `npm run lint` runs `prettier --write .`, which rewrites files across the repository. To avoid unrelated churn:

1. Prefer formatting only the files you changed:
    ```bash
    npx prettier --write app/src/server.js app/middleware/helmet/index.js app/middleware/nonces/index.js test/010-helmet-security-headers.test.js
    ```
2. If you run `npm run lint`, inspect `git diff` afterward and revert unrelated formatting changes if they are not intentional. Do not commit a repository-wide reformat as part of this task.

---

## 14. Verification / Evidence

The agent must provide evidence, not a claim of “fixed.”

### 14.1 Source verification

- Show the live `app/src/server.js` middleware order with Helmet mounted.
- Show the live `app/middleware/helmet/index.js` directive list.
- Show the live nonce implementation and prove it is per-request (if used).
- Show that stale commented CSP blocks are removed or clearly retired.
- Show that no second CSP is set elsewhere.

### 14.2 Header verification

Run and capture:

```bash
curl -sI http://localhost:3000/ | sort
curl -sI http://localhost:3000/login | sort
curl -sI http://localhost:3000/assets/css/style.css | sort
curl -sI http://localhost:3000/api/get/categories | sort
```

Expected evidence:

- `content-security-policy` or `content-security-policy-report-only` present.
- `x-content-type-options: nosniff`.
- `referrer-policy` present.
- `permissions-policy` present.
- `x-frame-options` present or `frame-ancestors` present.
- HSTS absent in local HTTP mode; present only when configured for production/HTTPS.
- No duplicate/conflicting CSP header.

### 14.3 Browser/runtime verification

- Capture console output from representative pages in report-only and enforced modes.
- List any CSP violations, the blocked resource, and the directive that needs adjustment.
- Confirm the UI is functional after enforcement (layout, navigation, modals, forms, uploads, previews, Socket.IO, meeting links).
- If a browser is not available, state that limitation and provide the strongest available evidence (header tests, template inventory, static analysis). Do not claim manual UI verification you did not perform.

### 14.4 Test verification

Paste the commands and summarized results:

| Test                       | Command                                                | Result                    |
| -------------------------- | ------------------------------------------------------ | ------------------------- |
| Focused Helmet test        | `node --test test/010-helmet-security-headers.test.js` | PASS/FAIL                 |
| Auth middleware regression | `node --test test/006-auth-middleware.test.js`         | PASS/FAIL/SKIP            |
| Rate limit regression      | `node --test test/007-general-rate-limit.test.js`      | PASS/FAIL/SKIP            |
| Login regression           | `node --test test/login.test.js`                       | PASS/FAIL/SKIP            |
| Password reset regression  | `node --test test/password-reset.test.js`              | PASS/FAIL/SKIP            |
| Full suite                 | `npm test`                                             | PASS/FAIL with skip count |

### 14.5 Similar-pattern verification

Search for any other CSP/security-header configuration that could conflict:

```bash
grep -RIn "Content-Security-Policy\|X-Frame-Options\|Strict-Transport-Security\|Permissions-Policy\|Referrer-Policy" \
  app public config test --exclude-dir=node_modules
```

Report any remaining manual header setting and whether it is intentional.

### 14.6 Final diff verification

- `git diff --stat` shows only intended files.
- No `.env`, secrets, certificates, or generated assets changed.
- No unrelated routes/controllers/models changed.
- No tests deleted or weakened.
- No report-only mode left enabled unintentionally.

---

## 15. Do NOT Do

- Do not rewrite the entire application.
- Do not change business behavior, API contracts, database schema, or session semantics.
- Do not add a new dependency; Helmet is already installed.
- Do not enable Helmet with the existing incomplete/strict-dynamic configuration and assume it works.
- Do not use a module-level static nonce in an enforced CSP.
- Do not add `'unsafe-eval'`.
- Do not use `script-src *`, `script-src https:`, or an equivalent wildcard in the final enforced policy.
- Do not permanently leave CSP in report-only mode and claim the finding is fixed.
- Do not disable Helmet on a route to make one page work.
- Do not remove `X-Frame-Options`/`frame-ancestors` clickjacking protection.
- Do not set HSTS in development or on an HTTP-only environment.
- Do not enable `crossOriginEmbedderPolicy` without a full cross-origin resource audit.
- Do not modify `.env`, commit secrets, or log sensitive values.
- Do not change Nginx, PM2, ports, SSL files, or deployment scripts unless explicitly asked.
- Do not remove or bypass existing authentication or rate limiting.
- Do not modify unrelated files to fix Prettier churn.
- Do not delete failing tests or hide test skips.
- Do not claim manual browser verification if it was not performed.
- Do not update README/AGENTS/CODE_REVIEW to claim completion before the code and tests actually verify it.

---

## 16. Acceptance Criteria

### Core implementation

- [ ] The original finding is resolved: Helmet is mounted and active in `app/src/server.js`.
- [ ] `app/middleware/helmet/index.js` contains a complete, intentional CSP directive set.
- [ ] `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors`, and `X-DNS-Prefetch-Control` are present on page responses.
- [ ] `Permissions-Policy` is set by an appropriate middleware because Helmet does not set it by default.
- [ ] HSTS is production/HTTPS-gated and is not sent in local HTTP development.
- [ ] Stale commented CSP/manual header code is removed or consolidated so there is a single source of truth.
- [ ] No duplicate/conflicting CSP headers are emitted.

### CSP safety

- [ ] CSP was rolled out in report-only mode first, or an equivalent safe verification was performed before enforcement.
- [ ] Every external script/style/font/image/frame/connect source in the final allowlist is backed by the repository inventory.
- [ ] `object-src 'none'` and `base-uri 'self'` are present (or an equivalent explicit safe value is documented).
- [ ] No `'unsafe-eval'` is present unless explicitly justified and documented.
- [ ] No wildcard script source is present in the final enforced policy.
- [ ] If nonces are used, the nonce is generated per request and is actually attached to the script tags that need it.
- [ ] Any temporary `'unsafe-inline'` for scripts/styles or event handlers is documented as remaining debt, with counts/examples.
- [ ] CSP enforcement was verified on representative pages, or the task remains explicitly report-only with documented blocking issues.

### Compatibility

- [ ] Login, logout, password reset, and email verification flows still work.
- [ ] Registration/profile pages, uploads, image previews, and uploaded media still work.
- [ ] Search/selection and API responses are unchanged.
- [ ] Static assets, fonts, icons, and external libraries still load.
- [ ] Socket.IO and MiroTalk links still work.
- [ ] Existing CORS, rate limiting, and `/api` authentication behavior are unchanged.
- [ ] Existing `Cache-Control` behavior is unchanged.

### Tests and evidence

- [ ] A focused `test/010-helmet-security-headers.test.js` exists and passes (or a documented equivalent).
- [ ] Relevant regression tests pass; skips are reported separately.
- [ ] Before/after `curl -sI` header evidence is included.
- [ ] The final diff was reviewed and contains no unrelated changes.
- [ ] Remaining risks and follow-up work are documented.

### Documentation

- [ ] `README.md` is updated only if the implementation is verified; it must not claim headers are enabled while they are report-only or disabled.
- [ ] Any new environment variable is documented in `.env.example` and README without real secrets.

---

## 17. Expected Final Report

The implementing agent must finish with this structure:

```markdown
# Implementation Report

## Summary

Brief explanation of what was implemented, the rollout mode chosen, and whether CSP is
report-only or enforced.

## Files Modified

| File                             | Changes |
| -------------------------------- | ------- |
| `app/src/server.js`              | ...     |
| `app/middleware/helmet/index.js` | ...     |
| `app/middleware/nonces/index.js` | ...     |
| `public/view/...`                | ...     |

## Files Added

| File                                              | Purpose                    |
| ------------------------------------------------- | -------------------------- |
| `test/010-helmet-security-headers.test.js`        | ...                        |
| `test/010-Helmet-Security-Headers-Test-Result.md` | Evidence report (optional) |

## Files Deleted

| File | Reason |
| ---- | ------ |
| ...  | ...    |

## Files Referenced Only

| File                                     | Why                              |
| ---------------------------------------- | -------------------------------- |
| `app/src/server.js`                      | Middleware order                 |
| `app/middleware/auth.middleware.js`      | Ensure auth is unchanged         |
| `app/middleware/rate-limit/*.js`         | Ensure rate limits are unchanged |
| `public/view/includes/head/index.ejs`    | Resource inventory               |
| `public/view/includes/scripts/index.ejs` | Resource inventory               |

## Implementation Details

Explain:

- Where Helmet is mounted and why.
- The exact CSP directives and why each is needed.
- Whether the nonce is per-request and how it reaches templates.
- How inline scripts, event handlers, and inline styles are handled.
- How HSTS and production/HTTPS gating work.
- How `Permissions-Policy` is set.
- What was deliberately left as temporary debt.

## Testing

| Test                       | Result         |
| -------------------------- | -------------- |
| Normal page headers        | PASS/FAIL      |
| Report-only CSP header     | PASS/FAIL      |
| Enforced CSP header        | PASS/FAIL      |
| HSTS production-only       | PASS/FAIL      |
| Nonce uniqueness (if used) | PASS/FAIL      |
| XSS/security cases         | PASS/FAIL      |
| Regression tests           | PASS/FAIL/SKIP |
| Full suite                 | PASS/FAIL/SKIP |

## Verification

Explain how the original issue was verified as fixed:

- Paste the before/after header excerpts.
- List representative pages checked and their CSP console status.
- State whether the UI was manually verified and on which pages.
- State which integrations were tested (login, uploads, previews, Socket.IO, MiroTalk,
  external fonts/scripts/frames).
- Confirm no conflicting CSP/security headers remain.

## Remaining Risks

List anything that could not be verified, including:

- Pages not manually tested.
- Remaining `'unsafe-inline'` allowances and their reason.
- External origins that may be missing from the allowlist.
- Production-only behaviors (HSTS, report collection) not tested locally.
- Any report-only mode still active and what blocks enforcement.

## Final Status

PASS / NEEDS REVIEW

State explicitly:

- `PASS` only if Helmet is active, the CSP is intentionally configured and verified,
  and the required tests pass.
- `NEEDS REVIEW` if CSP is still report-only, broad allowances remain, pages could not
  be verified, or any required test is failing/skipped for an unexplained reason.
```
