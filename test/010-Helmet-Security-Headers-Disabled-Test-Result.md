# 010 - Helmet Security Headers Disabled - Test Result and Production Readiness Review

| Item | Value |
| --- | --- |
| Task | `docs/tasks/010-Helmet-Security-Headers-Disabled.md` |
| Source finding | `CODE_REVIEW.md` Finding 10 - Helmet Security Headers Disabled |
| Branch | `feature/010-Helmet-Security-Headers-Disabled` |
| Reviewed commit | `753cffd` plus the uncommitted task implementation in the working tree |
| Test environment | Linux, Node.js `v24.19.0`, local MySQL (`DB_SERVERHOST` verified as localhost), `NODE_ENV=nonprod` |
| Reviewer | Senior Software Engineer / QA / Production Readiness Reviewer |
| Final decision | **READY WITH CONDITIONS** (see Section F) |

> Scope note: this review covers Finding 10 only. The worktree contains unrelated
> changes from earlier findings; they were not modified, reverted, or reformatted
> by this review except where they are part of Finding 10.

---

## A. Change Summary

### A.1 What changed and why

The change activates Helmet globally, replaces the incomplete/stale CSP with a
complete directive set, introduces a real per-response CSP nonce, adds a
`Permissions-Policy` header (Helmet does not set it by default), and gates HSTS
and `upgrade-insecure-requests` to production. The old module-level nonce and the
commented-out CSP/`X-Frame-Options` code in `app/src/server.js` were removed so
there is one CSP source of truth.

CSP is intentionally staged: it is report-only unless `CSP_REPORT_ONLY=false` is
set explicitly. Non-CSP Helmet headers are always active.

### A.2 Task-relevant files

| File | Type | Change |
| --- | --- | --- |
| `app/src/server.js` | Modified | Mounts `nonceMiddleware`, `helmet`, and `permissionsPolicyMiddleware` before static/routes; removes module-level nonce, commented CSP blocks, and manual `X-Frame-Options`/CSP setters; preserves `Cache-Control` and CORS. |
| `app/middleware/helmet/index.js` | Modified | Complete CSP, explicit host allowlists, report-only/enforced switch, production HSTS, `cacheControl: false`, per-request nonce directive. |
| `app/middleware/nonces/index.js` | Modified | Exports `createNonce` and `nonceMiddleware`; generates a fresh cryptographically secure nonce per response and sets `req.cspNonce` and `res.locals.cspNonce`. |
| `app/middleware/permissions-policy/index.js` | Added | Sets `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`. |
| `public/view/**/*.ejs` | Modified | Adds `nonce="<%= cspNonce %>"` to inline `<script>` blocks; removes the nonce `console.log`/`ourGenerateNonce` JavaScript variable from the login view. |
| `.env.example` | Modified | Documents `CSP_REPORT_ONLY=true` as the rollout-stage switch. No secrets added. |
| `README.md` | Modified | Documents Helmet/CSP/permissions behavior and the enforcement switch. |
| `test/010-helmet-security-headers.test.js` | Added | Focused automated acceptance tests for headers, CSP, nonce, report-only/enforced modes, HSTS, static/API behavior. |
| `test/010-Helmet-Security-Headers-Disabled-Test-Result.md` | Added | This evidence report. |

### A.3 Behaviors intentionally preserved

- Existing `Cache-Control` value is unchanged.
- Existing CORS allowlist echo behavior is unchanged.
- Existing API request/response bodies and status codes are unchanged.
- `/api` authentication and rate limiting remain mounted in the same relative
  positions.
- Clickjacking protection remains at least as strong (`X-Frame-Options: SAMEORIGIN`
  plus `frame-ancestors 'self'`).
- Local plain-HTTP development does not send HSTS and does not use
  `upgrade-insecure-requests`.
- Socket.IO still upgrades and serves `/socket.io/socket.io.js`.

---

## B. Implementation Verification (source-level)

### B.1 Middleware order

`app/src/server.js` currently mounts the relevant middleware in this order:

```text
trust proxy
cors()
compression()
/api rate limiter
express.urlencoded / express.json
express-session
nonceMiddleware                // app/src/server.js:107
helmet                         // app/src/server.js:108
permissionsPolicyMiddleware    // app/src/server.js:109
custom CORS echo + Cache-Control // app/src/server.js:111-140
http/https server + Socket.IO
/api authentication
route modules
express.static
error handler
EJS routes
```

This satisfies the task requirement that the nonce exists before Helmet builds
the CSP and that Helmet runs before static files and routes.

### B.2 CSP directives present

`app/middleware/helmet/index.js` defines:

`defaultSrc`, `baseUri`, `objectSrc`, `scriptSrc`, `scriptSrcAttr`, `styleSrc`,
`imgSrc`, `fontSrc`, `connectSrc`, `frameSrc`, `mediaSrc`, `workerSrc`,
`formAction`, `frameAncestors`, `upgradeInsecureRequests`.

Key properties verified:

- `useDefaults: false` (explicit policy, no silent Helmet defaults).
- `object-src 'none'`.
- `base-uri 'self'`.
- `frame-ancestors 'self'` and `X-Frame-Options: SAMEORIGIN`.
- No `'unsafe-eval'`.
- No `'strict-dynamic'`.
- No wildcard `script-src *` or `script-src https:`.
- `script-src-attr 'unsafe-inline'` is present as documented temporary debt for
  existing inline event handlers.
- `style-src 'unsafe-inline'` is present as documented temporary debt for
  existing inline style attributes/blocks.
- `connect-src` includes `'self'`, `ws:`, `wss:` and the external hosts found in
  the inventory.
- Local development omits `upgrade-insecure-requests`; production adds it.
- HSTS is production-only: `maxAge: 15552000`, `includeSubDomains: false`,
  `preload: false`.

### B.3 Nonce behavior

- `createNonce()` uses `crypto.randomBytes(16).toString('base64')`.
- `nonceMiddleware` runs once per request and sets both `req.cspNonce` and
  `res.locals.cspNonce`.
- Helmet reads the nonce through a function-valued directive
  `(req, res) => "'nonce-' + res.locals.cspNonce"`.
- The old `lodashNonce` export and all `ourGenerateNonce` uses in views are gone.
- The login view no longer logs the nonce.

### B.4 Single source of truth

- No manual `Content-Security-Policy` setter remains in `app/`, `public/`, or
  `config/`.
- No manual `X-Frame-Options` setter remains in the application code.
- The only manual security header setter is
  `app/middleware/permissions-policy/index.js` (intentional, because Helmet does
  not set it).
- The existing `Cache-Control` setter remains and Helmet's `cacheControl` is
  disabled to avoid duplicate/conflicting cache headers.

### B.5 Resource inventory used for the allowlist

| Resource type | Example | Required directive | Notes |
| --- | --- | --- | --- |
| Local scripts | `/assets/js/login.js` | `script-src 'self'` | Served from `public/`. |
| Inline scripts | page/bootstrap blocks in EJS | `script-src 'nonce-...'` | All active EJS inline scripts checked. |
| Inline event handlers | `onclick="..."` | `script-src-attr 'unsafe-inline'` | Temporary debt; cannot be nonced. |
| Inline styles | `style="..."`, `<style>` | `style-src 'unsafe-inline'` | Temporary debt. |
| External scripts | jQuery, SweetAlert2, Flowbite, Tailwind CDN, Vimeo player | `script-src <host>` | Explicit host list. |
| External styles | SweetAlert2 CSS, Google Fonts CSS | `style-src <host>` | Explicit host list. |
| Fonts | `fonts.gstatic.com`, cdnjs | `font-src <host>` | Explicit host list. |
| Images | Flowbite S3, icons8, YouTube thumbnails, tuk.dev, AWT hosts | `img-src <host>` | Explicit host list; no `https:` wildcard. |
| Fetch/XHR/WebSocket | `/api/...`, geojs.io, freegeoip, Socket.IO | `connect-src` | Includes `ws:`/`wss:` for Socket.IO. |
| Frames | YouTube, Vimeo | `frame-src <host>` | Profile video iframe. |
| Media | uploaded files, `blob:` previews | `media-src 'self' data: blob:` | Blob previews supported. |
| Uploaded files | `/uploads/...` | `'self'` in relevant directives | Served by `express.static`. |
| Meetings | `https://meet.allworldtrade.com/...` | Not a CSP resource when opened in a new tab | Browser popup behavior not automated here. |

Inventory cross-check: all external origins referenced by active EJS
`<script src>`, `<img src>`, and stylesheet/preconnect `<link>` tags are covered
by the allowlist. Other external URLs found in views are ordinary anchors,
canonical links, documentation links, or social links and are not fetched as
resources.

---

## C. Test Scenarios

Legend:

- **PASS** - executed and matched expectation.
- **FAIL** - executed and did not match expectation (defect raised).
- **NOT EXECUTED** - requires a real browser or infrastructure not available in
  this environment; explicitly not claimed as verified.
- **N/A** - not applicable to this change.

| ID | Area | Objective | Preconditions / input | Procedure | Expected | Actual | Status | Defect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T-01 | Functional | Helmet mounted in the live source after nonce middleware | Working tree | Read `app/src/server.js`; automated test 1 | `nonceMiddleware`, `helmet`, `permissionsPolicyMiddleware` mounted in order; no commented Helmet mount; no `lodashNonce` | Matched | PASS | - |
| T-02 | Functional | Report-only mode emits only `Content-Security-Policy-Report-Only` | `CSP_REPORT_ONLY=true` / unset | Request `/` and `/login` on live app; automated test | Report-only header present; enforced CSP absent | Matched | PASS | - |
| T-03 | Functional | Enforced mode emits `Content-Security-Policy` | `CSP_REPORT_ONLY=false` | Request `/login` on live app; automated test | Enforced header present; report-only absent | Matched | PASS | - |
| T-04 | Functional | Standard security headers present on HTML | Live app, non-production | `curl -D -` on `/`, `/login`, `/registration`, `/selection`, `/pricing` | `nosniff`, `Referrer-Policy`, `X-Frame-Options`, `X-DNS-Prefetch-Control` present | Matched on all tested pages | PASS | - |
| T-05 | Functional | `Permissions-Policy` present and intentional | Live app | Inspect headers; automated test | Exact deny value for camera/microphone/geolocation/payment/usb | Matched | PASS | - |
| T-06 | Functional | CSP contains required directives | Live app | Inspect CSP; automated test | All required directives present | Matched | PASS | - |
| T-07 | Security | No `unsafe-eval`, `strict-dynamic`, or wildcard script source | Live app | Inspect CSP; automated test; source grep | None present | Matched | PASS | - |
| T-08 | Functional | Local HTTP does not request HTTPS upgrade | `NODE_ENV=nonprod` | Inspect CSP | No `upgrade-insecure-requests` | Matched | PASS | - |
| T-09 | Functional | HSTS absent outside production | `NODE_ENV=nonprod` | Inspect headers | No `Strict-Transport-Security` | Matched | PASS | - |
| T-10 | Functional | HSTS present in production configuration | Harness with `isProduction: true` | Automated test | `max-age=15552000`, no `preload` | Matched | PASS | - |
| T-11 | Security | Nonce is generated per request | Live app | Two requests; compare CSP nonces | Different nonce per response | Matched | PASS | - |
| T-12 | Security | CSP nonce matches rendered inline script | Live app | Fetch `/login`; compare header nonce to HTML | Header nonce appears in rendered script tags | Matched (28 inline scripts checked, 0 missing nonce) | PASS | - |
| T-13 | Security | Every active EJS inline script has a nonce | Working tree | Automated EJS scan | No inline script without `nonce=` | Matched | PASS | - |
| T-14 | Security | External resources are allowlisted | Working tree | Automated EJS resource scan | No unallowlisted script/img/stylesheet host | Matched | PASS | - |
| T-15 | Security | Normal page emits exactly one CSP header | Live app | Fetch `/login` | One CSP header | Matched | PASS | - |
| T-16 | Regression | `Cache-Control` value preserved | Live app vs `HEAD` baseline | Compare headers on `/login`, static, API | Exact legacy value unchanged | Matched | PASS | - |
| T-17 | Integration | Static assets still served with correct type | Live app | Request `/assets/css/style.css` | 200, `text/css`, headers present | Matched | PASS | - |
| T-18 | Integration | API JSON semantics unchanged | Live app | Request `/api/get/categories` | 200 JSON with same shape; headers additive | Matched | PASS | - |
| T-19 | Regression | CORS allowed origin still echoed | Live app | Request with `Origin: https://allworldtrade.com` | `Access-Control-Allow-Origin` echoed | Matched | PASS | - |
| T-20 | Regression | CORS disallowed origin not echoed | Live app | Request with `Origin: https://evil.example` | No `Access-Control-Allow-Origin` | Matched | PASS | - |
| T-21 | Integration | Socket.IO HTTP handshake still works | Live app | `GET /socket.io/?EIO=4&transport=polling` | 200 handshake payload | Matched | PASS | - |
| T-22 | Integration | Socket.IO client script still loads | Live app | `GET /socket.io/socket.io.js` | 200 JavaScript | Matched | PASS | - |
| T-23 | Integration | Representative page routes still render | Live app | Enforced-mode route matrix (25 paths) | 200 (expected 404/500 excluded) | 22 of 25 returned 200; `/pricing2` 500 (pre-existing missing view); `/reset-password/test-token` and `/definitely-not-a-route` 404 (expected) | PASS (with observations) | DEF-06 observation |
| T-24 | Regression | Full automated suite | Local DB available | `npm test` | No failures or unexplained skips | 200 pass, 0 fail, 0 skip | PASS | - |
| T-25 | Regression | Focused prior-finding suite | Local DB available | `node --test` on 006/007/008/login/password-reset/049/050/051 plus 010 | No failures | 164 pass, 0 fail, 0 skip | PASS | - |
| T-26 | Boundary | Missing `CSP_REPORT_ONLY` defaults safely | Harness | `isCspReportOnly({})` | Returns `true` (report-only) | Matched | PASS | - |
| T-27 | Boundary | Explicit `false` enforces CSP | Harness | `isCspReportOnly({ CSP_REPORT_ONLY: 'false' })` | Returns `false` | Matched | PASS | - |
| T-28 | Boundary | Unexpected value does not accidentally enforce | Harness | `isCspReportOnly({ CSP_REPORT_ONLY: 'FALSE' })` | Returns `true` (safe report-only) | Matched | PASS | - |
| T-29 | Negative | Unknown route keeps a single app CSP | Live app | `GET /definitely-not-a-route` in report-only and enforced modes | Single CSP header; app policy retained | Report-only: both report-only header and `Content-Security-Policy: default-src 'none'`; enforced: `default-src 'none'` replaces app policy | FAIL | DEF-01 |
| T-30 | Negative | Malformed JSON error keeps security headers | Live app | `POST /api/get/categories` with `{bad` and JSON content type | 400 with `nosniff`/referrer/CSP | 400 body returned but no security headers (body parser rejects before Helmet) | FAIL | DEF-02 |
| T-31 | Security | Injected `<script>` does not execute under enforced CSP | Browser + enforced CSP | Inject script into rendered field; open page | Script blocked/reported; no execution | Not executed: no browser automation available | NOT EXECUTED | - |
| T-32 | Security | Injected event handler behavior is understood | Browser + enforced CSP | Inject `onmouseover=` into rendered field | Allowed by documented `script-src-attr 'unsafe-inline'` debt or blocked if debt removed | Not executed; policy intentionally allows inline handlers | NOT EXECUTED | DEF-04 |
| T-33 | Security | `javascript:` URL behavior | Browser + enforced CSP | Inject `javascript:` URL into link/image | Blocked by CSP or documented behavior | Not executed: browser required | NOT EXECUTED | - |
| T-34 | Security | Clickjacking from another origin is blocked | Browser | Frame the app from another origin | Blocked by `frame-ancestors 'self'` / `X-Frame-Options` | Headers verified, framing behavior not browser-tested | NOT EXECUTED | - |
| T-35 | Security | MIME sniffing protection on static files | Live app | Request CSS/JS/API with misleading extension | `X-Content-Type-Options: nosniff` present | Matched | PASS | - |
| T-36 | Security | Referrer leakage on reset/UUID pages | Browser | Navigate from reset page to external link | Referrer reduced per policy | Header verified; actual navigation not browser-tested | NOT EXECUTED | - |
| T-37 | Security | Disallowed external script/style/image is blocked | Browser + enforced CSP | Load a non-allowlisted resource | Blocked and reported | Not executed: browser required | NOT EXECUTED | - |
| T-38 | Security | Nonce cannot be reused across responses | Live app | Reuse first response nonce on second response | Second response has different nonce; reused nonce not authorized | Matched | PASS | - |
| T-39 | Security | CSP report endpoint abuse | N/A | N/A | No unauthenticated/unbounded report endpoint | No CSP report endpoint was added | N/A | - |
| T-40 | Error handling | Header middleware survives DB/network failure | N/A | Header path performs no DB/network I/O | No dependency on DB/network | No DB/network access in nonce/Helmet/permissions middleware | N/A | - |
| T-41 | Performance | No new database queries or N+1 from header work | Working tree | Inspect middleware | No DB calls | No DB calls in header middleware | PASS | - |
| T-42 | Data integrity | No schema/data changes in scope | Working tree | Inspect diff | No migrations/schema/data writes | No DB schema changes in the Finding 10 diff | N/A | - |
| T-43 | UI | Representative pages render correctly in a browser | Browser | Open home/login/registration/selection/profile | No CSP violations, layout/functions intact | Not executed: no browser available | NOT EXECUTED | DEF-05 |
| T-44 | UI | MiroTalk `window.open` works with COOP | Browser | Click meeting link | New tab opens | Not executed: browser/meeting environment required | NOT EXECUTED | DEF-05 |
| T-45 | UI | Uploads and `blob:` previews render | Browser | Upload image/video; preview | Preview works | Not executed: browser required | NOT EXECUTED | DEF-05 |
| T-46 | UI | External fonts/scripts/frames render | Browser | Open pages using Google Fonts, SweetAlert2, YouTube/Vimeo | Resources load | Not executed: browser required; allowlist verified statically | NOT EXECUTED | DEF-05 |

### C.1 Scenario totals

| Status | Count |
| --- | --- |
| PASS | 31 |
| FAIL | 2 |
| NOT EXECUTED | 10 |
| N/A | 3 |
| **Total** | **46** |

The two FAIL results are low-severity edge cases documented in Section D. They do
not indicate that normal page/static/API responses are missing the intended
headers.

---

## D. Test Execution Summary

### D.1 Automated tests (actual results)

| Command | Result | Evidence |
| --- | --- | --- |
| `node --test test/010-helmet-security-headers.test.js` | **13 passed, 0 failed, 0 skipped** | 13 top-level tests |
| `node --test test/010 ... test/051` (focused prior-finding regression set) | **164 passed, 0 failed, 0 skipped** | Combined focused run |
| `npm test` | **200 passed, 0 failed, 0 skipped** | Full repository suite |

Focused files executed:

```text
test/010-helmet-security-headers.test.js
test/006-auth-middleware.test.js
test/007-general-rate-limit.test.js
test/008-secrets-validation.test.js
test/login.test.js
test/password-reset.test.js
test/049-reset-token-invalidation-and-expiry.test.js
test/050-forgot-password-response.test.js
test/051-reset-endpoints-rate-limit.test.js
```

No test was deleted, skipped, weakened, or hidden.

### D.2 Runtime verification

The real application was started from the working tree on temporary ports with
the local database and ephemeral random secrets supplied through environment
variables (the local `.env` still contains placeholders that intentionally fail
Finding 8 validation). Secret values were not printed, stored, or included in
this report.

| Server | Port | Mode | Purpose |
| --- | --- | --- | --- |
| Baseline (`git archive HEAD`) | 3212 | No Helmet (HEAD state) | Before/after comparison |
| Working tree | 3210 | `CSP_REPORT_ONLY=true` | Report-only runtime checks |
| Working tree | 3211 | `CSP_REPORT_ONLY=false` | Enforced runtime checks |

All temporary servers were stopped after testing.

### D.3 Before/after header evidence

Baseline (`HEAD`, `/login`, `/assets/css/style.css`, `/api/get/categories`) only
had:

```http
HTTP/1.1 200 OK
Cache-Control: no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0
X-Frame-Options: sameorigin
Content-Type: text/html; charset=utf-8
```

After (report-only mode, representative excerpt; nonce redacted):

```http
HTTP/1.1 200 OK
Content-Security-Policy-Report-Only: default-src 'self';base-uri 'self';object-src 'none';script-src 'self' 'nonce-<redacted>' https://code.jquery.com https://cdnjs.cloudflare.com https://unpkg.com https://cdn.jsdelivr.net https://cdn.tailwindcss.com https://player.vimeo.com https://www.google-analytics.com;script-src-attr 'unsafe-inline';style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com ...;img-src 'self' data: blob: ...;font-src 'self' data: ...;connect-src 'self' ws: wss: ...;frame-src 'self' https://www.youtube.com https://youtube.com https://player.vimeo.com https://vimeo.com;media-src 'self' data: blob:;worker-src 'self' blob:;form-action 'self';frame-ancestors 'self'
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
X-DNS-Prefetch-Control: off
X-Frame-Options: SAMEORIGIN
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
Cache-Control: no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0
Content-Type: text/html; charset=utf-8
```

After (enforced mode, representative excerpt; nonce redacted):

```http
HTTP/1.1 200 OK
Content-Security-Policy: default-src 'self';base-uri 'self';object-src 'none';script-src 'self' 'nonce-<redacted>' ...;frame-ancestors 'self'
X-Content-Type-Options: nosniff
...
```

Confirmed:

- `Cache-Control` is byte-for-byte the legacy value.
- CORS echo still works for the allowlist and is absent for a disallowed origin.
- Static CSS still returns `200` and `text/css`.
- API still returns `200` JSON.
- HSTS is absent in non-production runtime.
- No nonce is reused between responses; the nonce in the header matches the
  rendered script tags.
- Normal pages emit exactly one CSP header.

### D.4 Enforced-mode route matrix

| Route | Status | App CSP present |
| --- | --- | --- |
| `/` | 200 | Yes |
| `/all-about-events` | 200 | Yes |
| `/job-fair` | 200 | Yes |
| `/template` | 200 | Yes |
| `/selection` | 200 | Yes |
| `/registration` | 200 | Yes |
| `/registration-for-small-scale-company` | 200 | Yes |
| `/registration-for-medium-scale-company` | 200 | Yes |
| `/registration-for-large-scale-company` | 200 | Yes |
| `/traders-registration` | 200 | Yes |
| `/help-and-support-registration` | 200 | Yes |
| `/upgrade-plan` | 200 | Yes |
| `/upgrade-to-medium-scale` | 200 | Yes |
| `/upgrade-to-large-scale` | 200 | Yes |
| `/upgrade-to-traders` | 200 | Yes |
| `/email-verification` | 200 | Yes |
| `/login` | 200 | Yes |
| `/help-and-support-login` | 200 | Yes |
| `/terms-and-conditions` | 200 | Yes |
| `/data-privacy-notice` | 200 | Yes |
| `/cookie-policy` | 200 | Yes |
| `/pricing` | 200 | Yes |
| `/pricing2` | 500 | No - `finalhandler` `default-src 'none'`; pre-existing missing view |
| `/reset-password/test-token` | 404 | Yes - route handler returns the 404 after Helmet; expected for an invalid token |
| `/definitely-not-a-route` | 404 | No - `finalhandler` `default-src 'none'` (DEF-01) |

### D.5 Socket.IO

- `GET /socket.io/?EIO=4&transport=polling` returned `200` with a valid handshake
  payload.
- `GET /socket.io/socket.io.js` returned `200` with `application/javascript`.
- Socket.IO serves these responses itself, so Helmet headers are not applied to
  them. This is expected: Express middleware does not run for the Socket.IO
  handshake/client-script path. CSP `connect-src` still allows the same-origin
  WebSocket connection.

### D.6 Lint / formatting

- `npx prettier --check` passes for all newly added/modified middleware and test
  files.
- `app/src/server.js` is stored with CRLF line endings in `HEAD` and in the
  worktree; Prettier's configured/default LF output therefore reports the whole
  file. This is pre-existing repository formatting debt, not a formatting
  regression from this change. `npm run lint` (`prettier --write .`) was
  intentionally not run because it would rewrite unrelated files across the
  repository.

---

## E. Defects Found

| ID | Severity | Defect | Root cause | Impact | Recommended remediation |
| --- | --- | --- | --- | --- | --- |
| DEF-01 | Low | Unknown-route/default 404 responses do not keep the application CSP. In report-only mode the response contains both `Content-Security-Policy-Report-Only` (Helmet) and `Content-Security-Policy: default-src 'none'` (Express `finalhandler`). In enforced mode `finalhandler` replaces the app CSP with `default-src 'none'`. | Express `finalhandler` unconditionally sets `Content-Security-Policy: default-src 'none'` on its built-in error page. | Not a security weakening: the 404 page is plain text and the enforced policy is stricter. It does violate the "single CSP header" consistency goal and bypasses the configured policy on that response. | Add a custom 404/error page before `finalhandler`, or explicitly document the Express behavior as accepted. Add a regression test for 404 headers. Do not weaken the app policy to work around it. |
| DEF-02 | Low | Responses generated before Helmet runs lack security headers. Confirmed for malformed JSON (`400`) because `express.json()` is mounted before Helmet. The same order implies `429` rate-limit responses may also lack them (not directly executed). | Helmet is mounted after body parsers and after the `/api` rate limiter. | Low: these are small JSON/error responses; the normal page/static/API paths are covered. But `nosniff`/referrer defense-in-depth is absent on those errors. | Mount nonce + Helmet + `Permissions-Policy` earlier (after CORS/compression, before body parsers and the rate limiter), or add a small header middleware/error handler that covers pre-route failures. Re-run the full suite and add tests for 400/429 responses. |
| DEF-03 | Condition | CSP is report-only by default until an operator sets `CSP_REPORT_ONLY=false`. | Intentional staged rollout and fail-safe default. | The finding is not fully "enforced CSP" in production until the operator flips the environment variable. Report-only still protects nothing at runtime; it only reports. | During release, set `CSP_REPORT_ONLY=false` after browser verification (or run report-only for a defined observation window, then enforce). This is a release condition, not an implementation defect. |
| DEF-04 | Info / accepted debt | `script-src-attr 'unsafe-inline'`, `style-src 'unsafe-inline'`, and broad `ws:`/`wss:` schemes remain. | Existing 175+ inline event handlers, 500+ inline style attributes/blocks, and same-origin Socket.IO. | Inline event-handler injection is not stopped by CSP while `script-src-attr 'unsafe-inline'` remains. `ws:`/`wss:` allow any WebSocket host rather than only the app's. | Track as follow-up: convert inline handlers to event listeners, move inline styles to CSS, then remove `unsafe-inline`. If Socket.IO is strictly same-origin, consider narrowing `ws:`/`wss:`. |
| DEF-05 | Info / verification gap | Browser-level UI and integration behavior was not executed. | No browser automation or interactive browser is available in this environment. | Cannot claim UI/console verification for CSP violations, MiroTalk popups under COOP, blob previews, or external font/script/frame rendering. | Perform the manual/browser matrix in Section G before enforcing CSP in production. |
| DEF-06 | Observation (out of scope) | `/pricing2` returns `500`. | `public/view/pricing/pricing2.ejs` does not exist. | Pre-existing route bug, unrelated to Helmet/CSP. | Track separately; do not fix under Finding 10. |

No critical or high-severity defect was found in the Finding 10 implementation.

---

## F. Security and Regression Findings

### F.1 Security posture

- The original finding is resolved for normal responses: Helmet is mounted and
  active, and the standard defensive headers are present.
- CSP is complete enough to be meaningful and does not use `'unsafe-eval'`,
  `'strict-dynamic'`, or a wildcard script source.
- The nonce is genuinely per-response and actually applied to all active inline
  script blocks; the old static nonce is gone.
- `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, and
  `frame-ancestors 'self'` are present.
- HSTS is production-only and does not include unsafe subdomains/preload.
- `Permissions-Policy` denies camera, microphone, geolocation, payment, and USB
  on the app origin. Source search found no `getUserMedia`,
  `navigator.geolocation`, `RTCPeerConnection`, payment, or USB usage in the app
  origin; MiroTalk is opened externally.
- No manual CSP or `X-Frame-Options` setter remains in the application.
- No CSP report endpoint was added, so report-flooding/abuse is not introduced.
- Residual XSS mitigation gaps are explicitly documented (inline event handlers
  and inline styles).

### F.2 Regression posture

- Full suite: 200/200 pass.
- Focused security/regression suite: 164/164 pass.
- CORS allowlist echo unchanged.
- Cache-Control unchanged.
- Static assets and API JSON unchanged.
- `/api` authentication and rate limiting test suites pass.
- Socket.IO handshake and client script still work.
- No database schema, migration, controller, model, or API contract change was
  made for this finding (apart from the view nonce attributes).

### F.3 Limitations of this evidence

- No real browser or browser automation was used. CSP enforcement, console
  violation collection, clickjacking, `javascript:` URLs, MiroTalk popup/COOP,
  blob previews, and external resource rendering remain manually unverified.
- The local `.env` contains placeholders and cannot start the app because of
  Finding 8 validation; runtime evidence used ephemeral environment overrides.
  This is an environment limitation, not a Finding 10 failure.
- The `npm test` run used the local development database. The DB host was
  verified as localhost before execution; no production database was contacted.
- Report-only behavior was verified by header name and absence of the enforced
  header. It was not possible to prove in a browser that report-only does not
  block resources.

---

## G. Production Readiness Decision

### Decision: READY WITH CONDITIONS

Evidence supporting the decision:

- All automated tests pass: **200 pass, 0 fail, 0 skip**.
- Focused acceptance tests pass: **13 pass**.
- Focused regression suite passes: **164 pass**.
- Real runtime responses from the working tree carry the intended headers in
  both report-only and enforced modes.
- Baseline vs after confirms the original gap (only `X-Frame-Options` and
  `Cache-Control`) is closed for normal pages, static assets, and APIs.
- Nonce uniqueness, CSP completeness, CORS, cache behavior, Socket.IO, and API
  semantics were verified.
- The two failed negative edge cases are low severity and do not block release:
  Express's default 404 page uses a stricter CSP, and pre-Helmet error responses
  are JSON without security headers.

Release conditions:

1. Production must explicitly set `CSP_REPORT_ONLY=false` to enforce CSP, or
   deliberately run a documented report-only observation window and then flip
   it. Do not leave it report-only permanently and call the finding closed.
2. Manual browser verification must be completed in a staging environment before
   or immediately after deployment (pages and integrations listed in Section H).
3. HSTS requires production HTTPS (`NODE_ENV=production`) and should be confirmed
   at the Nginx edge; local HTTP must not send it.
4. The low-severity 404/pre-Helmet error gaps should be fixed or formally
   accepted by the release owner.

This is not a declaration that the entire application is production-ready; it is
a declaration that the Finding 10 scope is implementation-complete and ready to
release under the conditions above.

---

## H. Remaining Actions

1. **CSP rollout**
   - Deploy with `CSP_REPORT_ONLY=true` if an observation window is required.
   - Open representative pages with browser devtools and collect CSP violations.
   - Fix or explicitly allow legitimate resources, then set
     `CSP_REPORT_ONLY=false` and redeploy.
2. **Browser verification matrix**
   - Home, all-about-events, job-fair, login, help/support login, registration
     (all tiers), registration-v2, email verification, profile pages, edit
     profile, upgrade pages, selection/search, pricing, legal pages,
     forgot/reset password.
   - jQuery/plugins, SweetAlert2 dialogs, Flowbite/UIKit dropdowns/modals,
     country/state/city JSON lookups.
   - Uploads, image/video previews (`blob:`), uploaded media display.
   - Socket.IO connection and call-notification UI.
   - MiroTalk `window.open` behavior under COOP.
   - YouTube/Vimeo frames, Google Fonts, external icon/background images.
   - Login, logout, password reset, email verification.
3. **Edge cases**
   - Decide whether to add a custom 404 handler so the app CSP is retained and
     only one CSP header is emitted (DEF-01).
   - Decide whether to move Helmet earlier or add error-path headers so
     malformed-body/rate-limit responses also receive `nosniff` and related
     headers (DEF-02).
4. **Debt reduction**
   - Convert inline `onclick`/`onchange` handlers to event listeners and remove
     `script-src-attr 'unsafe-inline'`.
   - Move inline styles to CSS and remove `style-src 'unsafe-inline'`.
   - Narrow `ws:`/`wss:` if Socket.IO remains strictly same-origin.
5. **Deployment checks**
   - Confirm Nginx does not set a second, conflicting CSP/HSTS header.
   - Confirm production `NODE_ENV=production` so HSTS is emitted.
   - Confirm `CSP_REPORT_ONLY` is set explicitly in production environment
     management (not only in `.env.example`).
6. **Separate ticket**
   - Fix the pre-existing `/pricing2` 500 (missing
     `public/view/pricing/pricing2.ejs`) outside Finding 10.

---

## Appendix A - Commands Executed

```bash
# Source / behavior checks
grep -RIn "Content-Security-Policy|X-Frame-Options|Strict-Transport-Security|Permissions-Policy|Referrer-Policy" app public config test --exclude-dir=node_modules
grep -RIn "lodashNonce|ourGenerateNonce" app public test --exclude-dir=node_modules
grep -RInE "eval\(|new Function\(" public/view public/assets/js app --include='*.ejs' --include='*.js'

# Automated tests
node --test test/010-helmet-security-headers.test.js
node --test test/010-helmet-security-headers.test.js \
  test/006-auth-middleware.test.js \
  test/007-general-rate-limit.test.js \
  test/008-secrets-validation.test.js \
  test/login.test.js \
  test/password-reset.test.js \
  test/049-reset-token-invalidation-and-expiry.test.js \
  test/050-forgot-password-response.test.js \
  test/051-reset-endpoints-rate-limit.test.js
npm test

# Runtime (temporary ports, local DB, ephemeral secrets)
PORT=3210 CSP_REPORT_ONLY=true  node app/src/server.js
PORT=3211 CSP_REPORT_ONLY=false node app/src/server.js
curl -s -o /dev/null -D - http://127.0.0.1:3210/login
curl -s -o /dev/null -D - http://127.0.0.1:3211/login
curl -s -o /dev/null -D - http://127.0.0.1:3211/assets/css/style.css
curl -s -o /dev/null -D - http://127.0.0.1:3211/api/get/categories
curl -s -o /dev/null -D - "http://127.0.0.1:3211/socket.io/?EIO=4&transport=polling"

# Baseline from HEAD (git archive into /tmp, local DB, ephemeral secrets)
PORT=3212 node app/src/server.js
curl -s -o /dev/null -D - http://127.0.0.1:3212/login

# Formatting
npx prettier --check app/middleware/helmet/index.js \
  app/middleware/nonces/index.js \
  app/middleware/permissions-policy/index.js \
  test/010-helmet-security-headers.test.js
```

## Appendix B - Focused test names (010)

All 13 focused tests passed:

1. Helmet is mounted in the live source after the nonce middleware
2. Every inline script in an active EJS view has a per-request nonce
3. External resources in active views are covered by the CSP allowlist
4. Report-only mode emits only the report-only CSP header
5. Standard security headers are present and intentionally set
6. CSP contains the required directives and no unsafe-eval or wildcard script
   source
7. The nonce is unique per request and matches the rendered script tag
8. Enforced mode emits `Content-Security-Policy` instead of report-only
9. HSTS and `upgrade-insecure-requests` are production-only
10. API and static responses keep their behavior while gaining headers
11. Only one CSP header is emitted
12. Nonce middleware sets both request and response-local values
13. CSP mode and environment helpers are explicit

## Appendix C - Evidence classification

| Evidence type | Used |
| --- | --- |
| Automated test execution | Yes - 200/200 full suite, 164/164 focused, 13/13 task |
| Real runtime HTTP requests | Yes - baseline, report-only, enforced, static, API, Socket.IO, CORS |
| Source/static analysis | Yes - middleware order, CSP directives, inventory, secret/manual-header grep |
| Lint/format check | Yes - Prettier check on changed middleware/test files |
| Browser/manual UI verification | No - not available; explicitly marked NOT EXECUTED |
| Production deployment verification | No - not performed; conditions documented |
