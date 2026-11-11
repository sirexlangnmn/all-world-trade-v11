# Implementation and Test Report — Finding 15

**Task:** Centralize page-route session/view-data construction with a shared helper and middleware without changing production behavior.
**Source task:** `docs/tasks/015-Duplicated-Session-Data-Construction-Pattern.md`
**Branch:** `feature/015-Duplicated-Session-Data-Construction-Pattern.md`
**Review date:** 2026-11-02
**Reviewer role:** Senior Software Engineer / QA / Production Readiness Reviewer

---

## A. Change Summary

### What changed

The duplicated per-route construction of the common session/view-data object (`uuid`, `type`, `first_name`, `last_name`, `email`, `ourGenerateNonce`) has been centralized in a single module, `app/middleware/view-data.middleware.js`. The module exports:

- `buildLoginViewData(nonce)` — guest/login `{ ourGenerateNonce }`.
- `buildAnonymousPageViewData(nonce)` — guest shape with empty-string identity plus location and nonce.
- `buildAuthenticatedViewData(sessionUser, nonce)` — standard authenticated identity plus nonce.
- `buildAuthenticatedViewDataWithLocation(sessionUser, nonce)` — standard identity plus `country` / `state_or_province` plus nonce.
- `buildAuthenticatedViewDataWithoutNonce(sessionUser)` — identity only (preserves routes that historically omitted the nonce).
- `buildOptionalSessionViewData(sessionUser, nonce)` — public legal/pricing shape: `id: null` + null guest fields + nonce for guests; identity only for authenticated users.
- `buildSupportProfileViewData(sessionUser, nonce)` — support-profile shape using `status`, `type: ''`, and `email_address`.
- `viewDataMiddleware(req, res, next)` — attaches `req.viewData` for the common guest/authenticated mapping using `res.locals.cspNonce`.

`app/src/server.js` now imports these builders and mounts `viewDataMiddleware` once, after the session and nonce middleware and before the page routes. `app/routes/pages/public-pages.routes.js` now imports the shared builders instead of keeping its own `buildOptionalSessionData`.

### Why it changed

Finding 15 reports that the same session-data object was copied across 15+ page handlers, causing drift and making new session fields hard to add safely. This change removes the duplication while preserving the exact data shapes that the EJS views and existing tests depend on.

### Affected modules

| Area | Impact |
|---|---|
| Page GET rendering in `app/src/server.js` | Data construction replaced; route checks, view selection, side effects, and render arguments preserved. |
| Public page routes in `app/routes/pages/public-pages.routes.js` | Local helper replaced by shared builder; contracts preserved. |
| Middleware chain | One new `app.use(viewDataMiddleware)` after session/nonce and before page routes. No existing middleware was moved or reordered. |
| APIs, database, uploads, email, Socket.IO, cron | Not changed. |

### Files Modified

| File | Changes |
|---|---|
| `app/src/server.js` | Removed local `buildLoginViewData` / `buildViewData`; imports shared builders and middleware; mounts `viewDataMiddleware`; replaced inline `sessionData` objects in standard, location, no-nonce, support-profile, guest-only, and trader routes; removed the dead authenticated object and shadowed `sessionData` in `/template` and `/traders-page/:companyName`. |
| `app/routes/pages/public-pages.routes.js` | Removed local `buildOptionalSessionData`; imports `buildLoginViewData` and `buildOptionalSessionViewData`. |
| `test/015-session-view-data.test.js` | Added focused builder, middleware, security, boundary, and Express-integration tests. |
| `test/015-Duplicated-Session-Data-Construction-Pattern-Test-Result.md` | This report. |

### Files Added

| File | Purpose |
|---|---|
| `app/middleware/view-data.middleware.js` | Single source of truth for page-route session/view-data construction. |
| `test/015-session-view-data.test.js` | Automated coverage for the shared builders and middleware. |
| `test/015-Duplicated-Session-Data-Construction-Pattern-Test-Result.md` | Test evidence and production-readiness assessment. |

### Files Deleted

None.

### Files Referenced Only

| File | Why |
|---|---|
| `README.md` | Project architecture, routes, auth/session behavior, testing and deployment context. |
| `AGENTS.md` | Repository conventions, two-stack architecture, auth/session rules, and mandatory commands. |
| `CODE_REVIEW.md` | Finding 14/15 context and refactor playbook. |
| `docs/tasks/015-Duplicated-Session-Data-Construction-Pattern.md` | Scope, mandatory investigation, acceptance criteria, and report format. |
| `app/middleware/nonces/index.js` | Confirms the per-response nonce source (`res.locals.cspNonce`). |
| `app/middleware/helmet/index.js` | Confirms Helmet reads the nonce; no CSP change was made. |
| `public/view/**/*.ejs` | Consumers of `data.*`; not modified. |
| `docs/tasks/014-Monolithic-server-js-1587-Lines.md` | Related route-extraction task; no route extraction was performed here. |

---

## Implementation Details

### Middleware registration order (verified in source)

```text
line 99   app.use(sessionMiddleware)
line 107  app.use(nonceMiddleware)
line 108  app.use(helmet)
line 109  app.use(permissionsPolicyMiddleware)
line 294  app.use(viewDataMiddleware)
line 301+ page GET routes
line 983  require(public-pages.routes.js)(app)
```

The middleware is after the session and nonce middleware and before every affected page route. No existing middleware was reordered. It only assigns `req.viewData`; it does not read/write the database, mutate `req.session`, log, or generate a nonce.

### Preserved route-specific variants

- Empty-string guest identity + location: `buildAnonymousPageViewData`.
- Routes that historically omitted `ourGenerateNonce`: `buildAuthenticatedViewDataWithoutNonce`.
- `country` / `state_or_province`: `buildAuthenticatedViewDataWithLocation`.
- `/traders-page/:companyName`: location builder + explicit `companyName` merge.
- `/help-and-support-profile`: `status`, `type: ''`, `email_address`.
- Public legal/pricing: `id: null` + null guest fields + nonce; authenticated identity without nonce.
- `/template` guest and authenticated branches still render without `data`.
- `/help-and-support-registration` still renders without `data`.
- `/email-verification` still passes `registration_email_address`.
- `/registration` guest still renders `registration-v2/index`; authenticated still renders `selection/index`.

### Compatibility Matrix (baseline → final)

| Route(s) | Guest predicate | Guest view / data | Authenticated view / data | Result |
|---|---|---|---|---|
| `/` | `!sessionUser` | login `{ ourGenerateNonce }` | home `{ uuid,type,first_name,last_name,email,ourGenerateNonce }` after DB login-status check | Preserved |
| `/all-about-events` | `=== undefined` | `all-about-events` with `''` identity, `country:''`, `state_or_province:''`, nonce | `all-about-events` with identity, country/state, nonce | Preserved |
| `/job-fair` | `=== undefined` | login `{ ourGenerateNonce }` | `wizard-job-fair` with identity, country/state, nonce | Preserved |
| `/template` | `=== undefined` | `login/index` **without data** | `home/template` **without data** (dead object removed) | Preserved |
| `/selection` | `!sessionUser` | login `{ ourGenerateNonce }` | `selection` standard identity + nonce after DB login-status check | Preserved |
| `/profile` | `=== undefined` | login `{ ourGenerateNonce }` | profile view by `type` 1–5 with standard identity + nonce | Preserved |
| `/profile2` | `=== undefined` | login `{ ourGenerateNonce }` | `profile/edit` identity **without nonce** | Preserved |
| `/help-and-support-profile` | `=== undefined` | `login/help-and-support-login` `{ ourGenerateNonce }` | when `status == 1`: `{ uuid, type:'', status:user.type, first_name, last_name, email:user.email_address, ourGenerateNonce }` | Preserved |
| `/edit-traders-profile`, `/edit-small-scale-profile`, `/edit-medium-scale-profile`, `/edit-large-scale-profile` | `=== undefined` | login `{ ourGenerateNonce }` | tier edit view identity **without nonce** | Preserved |
| `/registration` | `=== undefined` | `registration-v2` `{ ourGenerateNonce }` | `selection` standard identity + nonce | Preserved for normal sessions (see OBS-01) |
| `/registration-for-small-scale-company`, `/registration-for-medium-scale-company`, `/registration-for-large-scale-company`, `/traders-registration` | none | registration view `{ ourGenerateNonce }` | n/a | Preserved |
| `/help-and-support-registration` | none | registration view **without data** | n/a | Preserved |
| `/upgrade-plan`, `/upgrade-to-medium-scale`, `/upgrade-to-large-scale`, `/upgrade-to-traders` | `=== undefined` | login `{ ourGenerateNonce }` | upgrade view identity **without nonce** | Preserved |
| `/traders-page/:companyName` | `=== undefined` | `home/index` anonymous identity + location + nonce | `traders-page` identity + location + `companyName` + nonce | Preserved |
| `/login` (public module) | n/a | `{ ourGenerateNonce }` | n/a | Preserved |
| `/help-and-support-login` | n/a | login view **without data** | n/a | Preserved |
| `/terms-and-conditions`, `/data-privacy-notice`, `/cookie-policy`, `/pricing`, `/pricing2` | `=== undefined` | `{ id:null, uuid:null, type:null, first_name:null, last_name:null, email:null, ourGenerateNonce }` | identity **without nonce** | Preserved |
| `/email-verification` | n/a | `{ registration_email_address }` | n/a | Preserved |

---

## B. Test Scenarios

Legend for status: **PASS** = executed and passed; **PASS (static)** = verified by source/diff inspection, no executable harness; **NOT RUN** = not executed.

| Test Case ID | Feature / module | Objective | Preconditions and required data | Procedure | Input data | Expected result | Actual result | Status | Defect / remediation |
|---|---|---|---|---|---|---|---|---|---|
| 015-POS-01 | `buildLoginViewData` | Guest login shape contains only nonce | Module loaded | Call builder with nonce | `'nonce-1'` | `{ ourGenerateNonce: 'nonce-1' }` | Exact match | PASS | — |
| 015-POS-02 | `buildAnonymousPageViewData` | Guest page keeps empty-string identity and location | Module loaded | Call builder | `'nonce-1'` | `''` for uuid/type/names/email/country/state + nonce | Exact match | PASS | — |
| 015-POS-03 | `buildAuthenticatedViewData` | Map `email_or_social_media` → `email` | User object with encrypted UUID and type 3 | Call builder | Full session user | Identity + `email` + nonce, no location | Exact match | PASS | — |
| 015-POS-04 | `buildAuthenticatedViewDataWithLocation` | Preserve country/state | User with country/state | Call builder | `PH`, `Metro Manila` | Identity + country/state + nonce | Exact match | PASS | — |
| 015-POS-05 | `buildAuthenticatedViewDataWithoutNonce` | Preserve nonce omission | User object | Call builder | Full session user | Identity only; `ourGenerateNonce` absent | `'ourGenerateNonce' in data === false` | PASS | — |
| 015-POS-06 | `buildOptionalSessionViewData` | Preserve public guest null shape and auth nonce omission | `undefined` and authenticated user | Call builder twice | `undefined` then user | Guest: `id:null` + nulls + nonce; auth: identity only | Exact match both | PASS | — |
| 015-POS-07 | `buildSupportProfileViewData` | Preserve support status/type/email mapping | Support user with `type:5`, `email_address` | Call builder | Support user + `email_or_social_media` decoy | `type:''`, `status:5`, `email` from `email_address` | Exact match | PASS | — |
| 015-POS-08 | `viewDataMiddleware` | Attach guest/auth data per request | Fake `req`/`res` | Call middleware | Empty session; user session | `req.viewData` matches builder output; `next()` called | Both cases passed | PASS | — |
| 015-POS-09 | Express integration | Middleware works under real Express dispatch and `res.locals` | In-memory Express app, no DB | Start HTTP server on ephemeral port; GET `/page` as guest and authenticated | Header toggle | Guest `{ ourGenerateNonce }`; auth identity + nonce | Both responses matched | PASS | — |
| 015-NEG-01 | Middleware | Missing session / missing `user` follows guest path | `req.session` undefined | Call middleware | `undefined` | Guest data, no throw, `next()` called | Passed | PASS | — |
| 015-NEG-02 | Middleware | `session.user === null` is handled safely | Session with `user: null` | Call middleware | `{ user: null }` | Guest data, no throw | Passed | PASS | OBS-01 notes a non-reachable route-level difference |
| 015-NEG-03 | Middleware | No nonce is generated when locals lacks one | `res.locals = {}` | Call middleware | Auth session | `ourGenerateNonce` key exists but is `undefined`; no second nonce created | Passed | PASS | — |
| 015-BND-01 | Guest builder | Empty strings stay empty strings | Module loaded | Call builder | Nonce | All identity/location keys are `''` (not `null`/`undefined`) | Passed | PASS | — |
| 015-BND-02 | Identity builder | Encrypted UUID passes through unchanged | User with ciphertext-like UUID | Call builder | `'encrypted-uuid'` | Output uuid equals input; no decryption | Passed | PASS | — |
| 015-BND-03 | Support builder | Non-standard `type:5` preserved as `status` and view selection unchanged | Static review of `/profile` and support route | Inspect code | `type` 5 branch | Customer-service/support view selection not altered | Confirmed by diff review | PASS (static) | — |
| 015-REG-01 | Public page routes | Registered paths unchanged | Register module against stub `app` | Compare route keys | n/a | Exactly the 8 existing GET paths | Exact match | PASS | — |
| 015-REG-02 | Public page routes | Verification/login/legal/pricing data contracts unchanged | Handler invocation with render capture | Compare render args | Guest and auth sessions | Same views and data shapes as baseline | Exact match | PASS | — |
| 015-REG-03 | Full test suite | No regressions across repository | Configured test environment (DB available) | `npm test` | Repository suite | No failures; report skips | 262 passed, 0 failed, 0 skipped, 0 todo | PASS | — |
| 015-REG-04 | Duplication removal | No uncommented standard `sessionData` construction remains | Worktree | `grep` for `const sessionData = {`, `buildViewData`, `buildOptionalSessionData` | Source | Only commented legacy selection block remains; no `buildViewData`/`buildOptionalSessionData` references | Confirmed | PASS | — |
| 015-INT-01 | Middleware order | Runs after session/nonce and before page routes | Source inspection | Check mount lines | Source | Session 99, nonce 107, view-data 294, page routes 301+/983 | Confirmed | PASS (static) | — |
| 015-SEC-01 | View-data whitelist | Only whitelisted fields are exposed | User object containing `password`, `reset_token`, `login_status` | Call builders; inspect keys | Sensitive extra fields | No sensitive keys in output | Passed; keys matched whitelist | PASS | — |
| 015-SEC-02 | Fresh objects / no mutation | No cross-request contamination | Repeated calls | Compare object identity; mutate first result | Same user | Distinct objects; session unchanged; mutation isolated | Passed | PASS | — |
| 015-SEC-03 | Nonce lifecycle | Nonce is consumed from `res.locals`, never generated | No locals or set locals | Call middleware | `'express-nonce'` / none | Uses provided nonce; no generation | Passed | PASS | — |
| 015-SEC-04 | UUID handling | No decryption in helper | Source inspection | Search module for `ecdc`/`decrypt` | Source | No decryption or UUID transformation | Confirmed | PASS (static) | — |
| 015-ERR-01 | Middleware resilience | Middleware never throws for missing optional state | Unit calls | Call with undefined session/locals | Missing values | `next()` always called | Passed | PASS | — |
| 015-PERF-01 | Helper cost | No DB/network/N+1 work added per request | Source inspection | Inspect module | Source | Pure in-memory object creation only | Confirmed | PASS (static) | — |
| 015-DATA-01 | Session integrity | Session object is read-only in helper | Unit calls | Compare session before/after | Full user | Deep-equal; no mutation | Passed | PASS | — |
| 015-CHK-01 | Syntax | Changed JavaScript parses | Node.js 24.19.0 | `node --check` on 4 files | Files | Exit 0 | All four OK | PASS | — |
| 015-CHK-02 | Formatting | New files match Prettier | Prettier 3.8.0 | `npx prettier --check` | New middleware, routes module, test | No issues | All matched | PASS | — |
| 015-CHK-03 | Whitespace | No new trailing whitespace beyond CRLF line endings | Git worktree | `git -c core.whitespace=cr-at-eol diff --check` | Changed files | Exit 0 | Exit 0 | PASS | — |
| 015-CHK-04 | Entry-point Prettier | Baseline formatting condition | HEAD vs worktree | `prettier --check app/src/server.js` | Server file | Same pre-existing result | Both fail because of CRLF; no regression | PASS (pre-existing limitation) | OBS-02 |
| 015-SMOKE-01 | Runtime smoke | Start production entry point and request pages | Safe staging env required | `npm start` + HTTP checks | n/a | Guest/auth pages render | Not run — boot runs `db.sequelize.sync()` and requires production-like services; no isolated environment was authorized | NOT RUN | Remaining risk |

---

## C. Test Execution Summary

| Check | Command | Result |
|---|---|---|
| Focused Finding 15 tests | `node --test test/015-session-view-data.test.js` | **17 passed, 0 failed, 0 skipped** |
| Public page route regression tests | `node --test test/public-pages-routes.test.js` | **3 passed, 0 failed, 0 skipped** |
| Full repository suite | `npm test` | **262 passed, 0 failed, 0 skipped, 0 todo** |
| Syntax checks | `node --check` on middleware, server, public routes, test | **All passed** |
| Prettier (new/changed non-server files) | `npx prettier --check app/middleware/view-data.middleware.js app/routes/pages/public-pages.routes.js test/015-session-view-data.test.js` | **All passed** |
| Prettier (`app/src/server.js`) | `npx prettier --check app/src/server.js` | **Fails — pre-existing CRLF condition; HEAD baseline fails identically** |
| CRLF-aware whitespace | `git -c core.whitespace=cr-at-eol diff --check -- app/src/server.js app/routes/pages/public-pages.routes.js` | **Passed (exit 0)** |
| Runtime smoke test | `npm start` + HTTP checks | **NOT RUN** (see remaining risks) |

Counts: **262 passed, 0 failed, 0 skipped, 0 todo** in the full suite. One non-executed check (runtime smoke) is reported separately and is **not** counted as a pass.

---

## D. Defects Found

No release-blocking defect was found in the reviewed change.

| ID | Severity | Description | Root cause | Recommended action |
|---|---|---|---|---|
| OBS-01 | Low / observation | `viewDataMiddleware` uses a loose `sessionUser == null` guest check. For a hypothetical `req.session.user === null`, `/registration` would render `selection` with guest data instead of raising the baseline `TypeError`. Normal login/logout flows store an object or `undefined`, so this state is not reachable through the application. | Loose null guard chosen to keep middleware exception-safe for all routes. | No change required. If strict baseline emulation for impossible states is mandatory, document and add a targeted route guard; do not change to `=== undefined` in the middleware because that would throw earlier for routes that currently handle null guests. |
| OBS-02 | Low / pre-existing | `app/src/server.js` does not pass `prettier --check` because the file uses CRLF line endings. The committed baseline fails the same check. | Repository CRLF line endings vs Prettier LF preference. | Not introduced by this change. Do not reformat the whole entry point in this task. |
| OBS-03 | Low / pre-existing | `/` and `/selection` still `console.log` `req.session.user` (including identity fields) despite the helper never logging. | Pre-existing debug logging in `app/src/server.js` (lines 305 and 401). | Out of scope for Finding 15; track separately for the logging/security cleanup finding. |
| OBS-04 | Coverage limitation | The inline page handlers in `app/src/server.js` are not importable without booting the server, DB sync, cron, and Socket.IO, so they are not directly exercised as HTTP routes in automation. | Monolithic entry point (Finding 14). | Keep this as a documented limitation. When Finding 14 extracts page routes, add route-level handler tests using the public-pages pattern. |

---

## E. Security and Regression Findings

### Security

- The helper exposes only the currently used whitelisted fields (`uuid`, `type`, `first_name`, `last_name`, `email`, and optionally `country`, `state_or_province`, `companyName`, `status`). It does not forward the raw session object.
- A test with additional sensitive fields (`password`, `reset_token`, `login_status`) confirmed none of them appear in builder output.
- The helper does not decrypt UUIDs and does not transform the encrypted UUID.
- The helper never generates a nonce; it consumes `res.locals.cspNonce` produced by the existing nonce middleware. Helmet/nonce ordering was not changed.
- Each call returns a fresh object, and tests confirm the session object is not mutated and results are isolated between calls.
- No new logging, persistence, environment, or dependency changes were introduced.
- Pre-existing issues (session logging, report-only CSP, etc.) were not touched and remain tracked by the broader review.

### Regression

- Public page route paths and their guest/authenticated data contracts still pass the existing tests unchanged.
- The repository test suite passes in full (262 tests) against the configured environment.
- The source diff confirms every converted route keeps its view path, guest predicate, nonce presence/absence, and route-specific extras.
- No API, database, upload, email, Socket.IO, cron, static-file, or middleware-order behavior was altered.

---

## F. Production Readiness Decision

**READY WITH CONDITIONS**

Evidence supporting the decision:

- The shared builder/middleware is covered by 17 focused tests, including a real Express dispatch integration test.
- The existing public-page route contract tests pass unchanged (3 tests).
- The full repository suite passes: 262 passed, 0 failed, 0 skipped.
- `node --check` passes on all changed files; new/changed files pass Prettier; CRLF-aware whitespace check passes.
- Source diff review confirms behavior preservation for all affected routes, including nonce omission, `id: null`, location fields, support-profile mapping, `companyName`, and no-data renders.
- No release-blocking defect was identified.

Conditions:

1. Perform a staging (non-production) smoke test of representative guest and authenticated pages before deployment. The entry point was intentionally not started in this environment because boot runs `db.sequelize.sync()` and requires production-like services.
2. Accept the documented low-severity observation (`null` session-user edge case) and the pre-existing issues (CRLF formatting, session logging) as out of scope for this change.
3. This decision covers Finding 15 only; it is not a release certification for the entire application.

---

## G. Remaining Actions

| Priority | Action | Owner | Notes |
|---|---|---|---|
| Required before release | Smoke-test representative guest and authenticated pages in staging: `/`, `/all-about-events`, `/job-fair`, `/profile`, `/profile2`, `/help-and-support-profile`, `/registration`, `/upgrade-plan`, `/traders-page/:companyName`, `/terms-and-conditions`, `/pricing`, `/login`, `/help-and-support-login`, `/email-verification` | QA/DevOps | Verify HTTP 200, correct view selection, no EJS errors, CSP nonce present, and guest/auth differences. |
| Required before release | Confirm `db.sequelize.sync()` does not perform unexpected schema changes in the target environment | DevOps | Pre-existing startup behavior; not modified by this task. |
| Follow-up (non-blocking) | Add route-level handler tests once Finding 14 extracts page routes | Backend | OBS-04. |
| Follow-up (non-blocking) | Remove or gate `console.log(req.session.user)` in `/` and `/selection` | Security cleanup | OBS-03, pre-existing. |
| Follow-up (non-blocking) | Normalize `app/src/server.js` line endings/formatting in a dedicated change | Maintainer | OBS-02, pre-existing; avoid broad reformat in this task. |

---

## Verification Evidence

### Duplicate construction removed

```text
$ grep -rn "buildViewData|buildOptionalSessionData" app test --include=*.js
none

$ grep -n "const sessionData = {" app/src/server.js app/routes/pages/public-pages.routes.js
only the pre-existing commented-out /selection block (lines 360, 374, 387)
```

### Middleware ordering

```text
99:  app.use(sessionMiddleware);
107: app.use(nonceMiddleware);
294: app.use(viewDataMiddleware);
301: app.get(['/'], ...)
983: require('../routes/pages/public-pages.routes.js')(app);
```

### Diff scope

The behavior-relevant diff for this finding is limited to:

- `app/middleware/view-data.middleware.js` (new)
- `app/src/server.js`
- `app/routes/pages/public-pages.routes.js`
- `test/015-session-view-data.test.js` (new)
- `test/015-Duplicated-Session-Data-Construction-Pattern-Test-Result.md` (new)

The worktree contains many other pre-existing modified files from other findings. They were not reverted or reformatted and are not part of this review's behavioral conclusions.

### Final Status

**PASS** — implementation preserves the observed route/data contracts, focused and full test suites pass, and no release-blocking defect was found. Runtime staging smoke testing remains the required pre-deployment condition.
