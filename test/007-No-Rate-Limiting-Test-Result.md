# Test Result — 007 No Rate Limiting

| Field                    | Value                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task under test          | `docs/tasks/007-No-Rate-Limiting.md`                                                                                                                    |
| Source finding           | `CODE_REVIEW.md` → Finding 7 (related: Findings 6, 29, 51)                                                                                              |
| Reviewed scope           | General `/api` limiter, strict login/support-login limiters, middleware wiring, client `429` handling, existing reset limiters, regression behavior     |
| Environment              | Linux, Node.js v24.19.0, Express 5.2.1, `express-rate-limit@8.7.1`, MySQL local non-production instance (`NODE_ENV=nonprod`, `DB_SERVERHOST=localhost`) |
| Focused test file        | `test/007-general-rate-limit.test.js`                                                                                                                   |
| Overall automated result | **155 passed, 0 failed, 0 skipped** (`npm test`)                                                                                                        |
| Manual verification      | Isolated HTTP harnesses **26/26 checks passed**; full-app smoke test **10/10 checks passed**                                                            |
| Production readiness     | **READY WITH CONDITIONS**                                                                                                                               |

---

## A. Change Summary

The missing rate-limiting change from Finding 7 is already present in the working tree and was reviewed as-is before adding any further edits.

### Implemented behavior

| Area                  | Implementation                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| General API limiter   | `app/middleware/rate-limit/api.rate-limit.js` exports `generalApiLimiter` = **100 requests / 15 minutes / IP**                                          |
| Login limiter         | `loginLimiter` = **5 requests / 15 minutes / IP**                                                                                                       |
| Support-login limiter | `supportLoginLimiter` = **5 requests / 15 minutes / IP**, a separate instance and therefore a separate bucket                                           |
| Response              | HTTP `429` with generic JSON `{"status":"error","message":"Too many requests. Please try again later."}`; `Retry-After` and draft-7 `RateLimit` headers |
| Preflight             | `OPTIONS` is skipped                                                                                                                                    |
| Keying                | Default `express-rate-limit` IP key; no custom key generator, no body/email/UUID/session key                                                            |
| Mount point           | `app.use('/api', generalApiLimiter)` before body parsing, session, authentication, and all API route modules                                            |
| Route wiring          | `apiRateLimit.loginLimiter` before `middleware.login_process`; `apiRateLimit.supportLoginLimiter` on support login                                      |
| Client UX             | `public/assets/js/login.js` and `public/assets/js/help-and-support-login.js` show a warning on `429`; success handlers unchanged                        |
| Reset endpoints       | Existing five reset limiters remain unchanged and still applied                                                                                         |

### Source-order evidence

```text
app/src/server.js:50   app.set('trust proxy', 'loopback')
app/src/server.js:80   app.use('/api', generalApiLimiter)
app/src/server.js:82   app.use(express.urlencoded(...))
app/src/server.js:83   app.use(express.json())
app/src/server.js:86   sessionMiddleware(...)
app/src/server.js:171  app.use('/api', isAuthenticated)
app/src/server.js:173  require('../routes/index.js')(app)

app/routes/index.js:96  app.post(['/api/post/login-process'], apiRateLimit.loginLimiter, middleware.login_process, login.create)
app/routes/index.js:98  app.post(['/api/post/help-and-support-login-process'], apiRateLimit.supportLoginLimiter, helpAndSupportLogin.create)
```

The limiter is scoped to `/api`; static files, uploads, page routes, and Socket.IO are outside that mount.

### Files reviewed

| File                                                     | Status                                                                |
| -------------------------------------------------------- | --------------------------------------------------------------------- |
| `app/middleware/rate-limit/api.rate-limit.js`            | Added by implementation; verified                                     |
| `app/middleware/index.js`                                | Barrel export verified                                                |
| `app/src/server.js`                                      | Mount order verified                                                  |
| `app/routes/index.js`                                    | Login route wiring verified                                           |
| `public/assets/js/login.js`                              | `429` handler verified                                                |
| `public/assets/js/help-and-support-login.js`             | `429` handler verified                                                |
| `app/middleware/rate-limit/password-reset.rate-limit.js` | Unchanged; verified                                                   |
| `app/routes/forgot-password.js`                          | Reset limiter registrations unchanged; verified                       |
| `test/007-general-rate-limit.test.js`                    | Added by implementation; executed                                     |
| `README.md`                                              | One remaining stale roadmap line corrected during this review (§20.2) |

### Change made during this review

`README.md` §20.2 still listed “Implement rate limiting on API endpoints” as a future improvement after the limiters were already implemented. It now reads “Add optional reverse-proxy/DDoS throttling in front of the in-app API limiters.” No code was changed during this review.

---

## B. Test Scenarios

### B.1 Focused automated scenarios (`test/007-general-rate-limit.test.js`)

| ID        | Feature / module          | Objective                                                                           | Preconditions / test data                                          | Procedure and input                                                                              | Expected result                                                                    | Actual result                     | Status |
| --------- | ------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | --------------------------------- | ------ |
| TC-007-01 | Limiter factory           | Allow exactly N and reject N+1 without invoking the wrapped handler                 | Ephemeral Express server; fresh limiter; 60-second window; limit 3 | Send four POST requests from one forwarded IP with email/password form data                      | First three `200`; fourth `429`; handler called exactly 3 times                    | Observed as expected              | PASS   |
| TC-007-02 | Generic error body        | Prevent credential echo in the `429` body                                           | Same as TC-007-01                                                  | Inspect fourth response body                                                                     | Generic message; no email, password, or test IP present                            | Observed as expected              | PASS   |
| TC-007-03 | Standard headers          | Confirm clients and proxies receive retry metadata                                  | Same as TC-007-01                                                  | Inspect fourth response headers                                                                  | `Retry-After` and a standardized `RateLimit*` header present                       | Observed as expected              | PASS   |
| TC-007-04 | Per-IP buckets            | One client IP cannot exhaust another client's allowance                             | Fresh limiter; limit 2; loopback-trusted proxy                     | Two requests as `203.0.113.10`, one more as that IP, then one as `203.0.113.11`                  | Third request from first IP is `429`; second IP gets `200`; handler called 3 times | Observed as expected              | PASS   |
| TC-007-05 | Forwarded-header spoofing | A direct untrusted connection cannot rotate buckets with `X-Forwarded-For`          | Non-loopback IPv4 interface available; server trusts loopback only | Send three direct requests with different forwarded IP values                                    | All share the socket-IP bucket; third is `429`; handler called twice               | Observed as expected; not skipped | PASS   |
| TC-007-06 | CORS preflight            | `OPTIONS` must not consume the POST bucket                                          | Fresh limiter; limit 2                                             | Three `OPTIONS` then three `POST` requests                                                       | `OPTIONS` do not count; first two POSTs `200`; third POST `429`                    | Observed as expected              | PASS   |
| TC-007-07 | Production constants      | Verify production values and separate login buckets                                 | Import production limiter module                                   | Assert 15-minute window, limits 100/5, callable instances, and different login/support instances | Configuration matches the task                                                     | Observed as expected              | PASS   |
| TC-007-08 | Server mount order        | General limiter scoped to `/api` before auth and first API route                    | Read `app/src/server.js`                                           | Compare source indexes and assert no unscoped `app.use(generalApiLimiter)`                       | Limiter before `isAuthenticated` and route registration; scoped only               | Observed as expected              | PASS   |
| TC-007-09 | Login route order         | Strict limiter runs before validation/controller; support route has its own limiter | Read `app/routes/index.js`                                         | Regex assertions on both route registrations                                                     | `loginLimiter` before `middleware.login_process`; support limiter present          | Observed as expected              | PASS   |
| TC-007-10 | Reset limiter regression  | Existing five reset limiters remain applied                                         | Read `forgot-password.js` and `routes/index.js`                    | Assert all five registrations                                                                    | All five unchanged and present                                                     | Observed as expected              | PASS   |
| TC-007-11 | Client UX                 | Both login clients visibly handle `429`                                             | Read both browser scripts                                          | Assert `error` callback, `xhr.status === 429`, and warning text                                  | Handlers present; success code untouched                                           | Observed as expected              | PASS   |
| TC-007-12 | Proxy trust               | Never trust arbitrary proxies                                                       | Read `app/src/server.js`                                           | Assert `trust proxy` is `'loopback'` and not `true`                                              | Safe setting present                                                               | Observed as expected              | PASS   |

### B.2 Manual isolated scenarios (real limiter modules, stub controller)

These were executed from `/tmp/opencode/manual-007.js` and companion harnesses. No database, SMTP, bcrypt, or filesystem write was used.

| ID        | Feature / module             | Objective                                               | Procedure and input                                                                          | Expected result                                                                | Actual result                             | Status |
| --------- | ---------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------- | ------ |
| TC-007-13 | Login limit boundary         | Prove 5 allowed, 6th blocked, handler not called        | Six POSTs to a route using the real `loginLimiter` + real login validation + stub controller | Five reach controller; sixth `429`; controller count stays 5                   | `statuses 200×5, 429`; controller calls 5 | PASS   |
| TC-007-14 | `429` headers/body           | Observe real login-limiter response contract            | Inspect sixth response                                                                       | `Retry-After: 900`; `RateLimit: limit=5, remaining=0, reset=900`; generic body | Exactly observed                          | PASS   |
| TC-007-15 | Separate auth buckets        | Exhausting normal login must not block support login    | Exhaust normal login bucket, then call support route from same IP                            | Support route still `200`; its controller called                               | Observed as expected                      | PASS   |
| TC-007-16 | General limit boundary       | Prove general limiter is 100/15 min                     | 101 GETs to a late-mounted `/api` route from one IP                                          | 100 allowed; 101st `429`                                                       | `allowed=100`, 101st `429`                | PASS   |
| TC-007-17 | Static asset isolation       | Static files must not consume API budget                | 120 static CSS fetches, then fresh-IP `/api` call                                            | Static all `200`; API call still allowed (`200`)                               | Observed as expected                      | PASS   |
| TC-007-18 | Missing/empty/SQL/long input | Limiter is IP-keyed and input cannot break or poison it | Limit 2: empty body, SQL-shaped credentials, then 10,000-byte email on the N+1 request       | First two `200`; third `429`; handler twice; no input echoed                   | Observed as expected                      | PASS   |
| TC-007-19 | Concurrent burst             | MemoryStore must not allow an unbounded burst           | 20 concurrent requests; limit 5                                                              | 5 allowed, 15 blocked, handler called 5 times                                  | Exactly observed                          | PASS   |

### B.3 Full-application smoke test (local non-production instance)

Executed with `PORT=3101 node app/src/server.js` against the local non-production database. The server was stopped immediately after the checks. No production system, SMTP, or real account was used.

| ID        | Feature / module    | Objective                                                                                | Procedure and input                                                                             | Expected result                           | Actual result                                           | Status |
| --------- | ------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------- | ------ |
| TC-007-20 | Startup             | No `express-rate-limit` validation or trust-proxy warning                                | Boot the real server and inspect the log                                                        | Clean startup with no rate-limit warnings | Startup succeeded; no `ERR_ERL_*` or rate-limit warning | PASS   |
| TC-007-21 | Real login limit    | Prove real route wiring returns 429 on attempt 6                                         | Six `POST /api/post/login-process` requests with invalid credentials and one fixed forwarded IP | First five normal, sixth `429`            | `200,200,200,200,200,429`                               | PASS   |
| TC-007-22 | Unknown `/api` path | Prove general limiter covers every `/api` path, including unknown paths                  | 101 requests to `/api/does-not-exist-007` from one IP                                           | 100 reach auth (`401`), 101st `429`       | 100×`401`, then `429`                                   | PASS   |
| TC-007-23 | Static asset        | Verify the real app serves static assets and they do not consume another IP's API budget | `GET /assets/css/input.css`; then fresh-IP `/api` call                                          | Static `200`; API `401` (auth), not `429` | Observed as expected                                    | PASS   |
| TC-007-24 | Page and Socket.IO  | Confirm page rendering and Socket.IO handshake are unaffected                            | `GET /`; `GET /socket.io/?EIO=4&transport=polling`                                              | Both `200`                                | Both `200`                                              | PASS   |

### B.4 Regression scenarios

| ID        | Feature / module         | Command                                                            | Expected result                                                 | Actual result                   | Status |
| --------- | ------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------- | ------ |
| TC-007-R1 | Reset rate limits        | `node --test test/051-reset-endpoints-rate-limit.test.js`          | Existing reset limiter behavior intact                          | 6 passed, 0 failed, 0 skipped   | PASS   |
| TC-007-R2 | API authentication       | `node --test test/006-auth-middleware.test.js`                     | Deny-by-default auth intact                                     | 16 passed, 0 failed, 0 skipped  | PASS   |
| TC-007-R3 | Login integration        | `node --test test/login.test.js`                                   | Login validation, SQL-injection safety, session behavior intact | 34 passed, 0 failed, 0 skipped  | PASS   |
| TC-007-R4 | Password reset service   | `node --test test/password-reset.test.js`                          | Hashing/update behavior intact                                  | 17 passed, 0 failed, 0 skipped  | PASS   |
| TC-007-R5 | Reset token lifecycle    | `node --test test/049-reset-token-invalidation-and-expiry.test.js` | Expiry and single-use behavior intact                           | 20 passed, 0 failed, 0 skipped  | PASS   |
| TC-007-R6 | Forgot-password response | `node --test test/050-forgot-password-response.test.js`            | Response contract and no hash leakage intact                    | 16 passed, 0 failed, 0 skipped  | PASS   |
| TC-007-R7 | Full suite               | `npm test`                                                         | No regressions                                                  | 155 passed, 0 failed, 0 skipped | PASS   |

### B.5 Scenarios not executed

| ID        | Scenario                                                 | Reason                                                                     | Status                         |
| --------- | -------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------ |
| TC-007-N1 | Valid-credential login and support login                 | No disposable valid accounts were available in scope                       | NOT EXECUTED                   |
| TC-007-N2 | Complete reset flow with real email delivery             | No disposable SMTP capture environment was authorized                      | NOT EXECUTED                   |
| TC-007-N3 | Browser interaction showing the SweetAlert `429` warning | No browser automation harness is present                                   | NOT EXECUTED (source verified) |
| TC-007-N4 | Live production Nginx/proxy topology                     | Production networking was not inspected; repository documentation was used | NOT EXECUTED                   |

---

## C. Test Execution Summary

### Commands executed

```bash
node --test test/007-general-rate-limit.test.js
node --test test/051-reset-endpoints-rate-limit.test.js
node --test test/006-auth-middleware.test.js
node --test test/login.test.js
node --test test/password-reset.test.js
node --test test/049-reset-token-invalidation-and-expiry.test.js
node --test test/050-forgot-password-response.test.js
npm test
npm ls express-rate-limit
node --check app/middleware/rate-limit/api.rate-limit.js
node --check app/middleware/index.js
node --check app/src/server.js
node --check app/routes/index.js
node --check public/assets/js/login.js
node --check public/assets/js/help-and-support-login.js
node --check test/007-general-rate-limit.test.js
npx prettier --check app/middleware/rate-limit/api.rate-limit.js app/middleware/index.js app/src/server.js app/routes/index.js public/assets/js/login.js public/assets/js/help-and-support-login.js test/007-general-rate-limit.test.js
```

### Automated results

| Result category                                                     |   Count |
| ------------------------------------------------------------------- | ------: |
| Focused 007 tests passed                                            |      10 |
| Focused 007 failed                                                  |       0 |
| Focused 007 skipped                                                 |       0 |
| Focused 007 not executed                                            |       0 |
| Regression tests passed (051, 006, login, password-reset, 049, 050) |     109 |
| Regression tests failed                                             |       0 |
| Regression tests skipped                                            |       0 |
| **Full `npm test` passed**                                          | **155** |
| **Full `npm test` failed**                                          |   **0** |
| **Full `npm test` skipped**                                         |   **0** |

### Manual results

| Category                                                                | Checks | Passed | Failed |
| ----------------------------------------------------------------------- | -----: | -----: | -----: |
| Isolated harness (limits, headers, buckets, input, static, concurrency) |     26 |     26 |      0 |
| Full-application smoke test                                             |     10 |     10 |      0 |
| **Total manual checks**                                                 | **36** | **36** |  **0** |

### Static checks

- `npm ls express-rate-limit` → `express-rate-limit@8.7.1`.
- `node --check` passed for every changed JavaScript file.
- `npx prettier --check` passed for the new limiter module and new test file.
- The same prettier check reports five pre-existing source files (`app/middleware/index.js`, `app/src/server.js`, `app/routes/index.js`, both login clients). The same files also fail the check at `HEAD`, so the warnings are pre-existing, not introduced by this change. Repository-wide `npm run lint` is write-mode and was not run to avoid unrelated formatting churn across the dirty worktree.

### Additional evidence

- The full-app sixth login response contained `RateLimit-Policy: 5;w=900`, `RateLimit: limit=5, remaining=0, reset=900`, and `Retry-After: 900`.
- The sixth login body was exactly `{"status":"error","message":"Too many requests. Please try again later."}` and did not reach the login controller in the isolated harness.
- A 20-request concurrent burst against a limit of 5 produced exactly 5 allowed and 15 blocked requests; handler calls were exactly 5.
- The non-loopback direct-connection spoof test executed and was **not skipped**; changing `X-Forwarded-For` did not create new buckets.

---

## D. Defects Found

| ID       | Severity                    | Finding                                                                                                        | Root cause                                                                                                                                                           | Recommended remediation                                                                                                                             | Status              |
| -------- | --------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| D-007-01 | Low — documentation         | `README.md` §20.2 still listed rate limiting as an unimplemented future improvement                            | Documentation lag after Finding 7                                                                                                                                    | Corrected during this review to describe optional proxy-layer throttling                                                                            | FIXED               |
| D-007-02 | Low — residual/verification | The real sixth login response still sets `connect.sid` before the route-level login limiter blocks the request | `saveUninitialized: true` in `server.js` and the strict limiter being route-level (after session). No database, bcrypt, controller, SMTP, or login-state work occurs | Address the pre-existing session behavior separately (Finding 29: `saveUninitialized: false`). Do not change session configuration inside this task | OPEN — non-blocking |
| D-007-03 | Informational               | Targeted Prettier check reports five touched files as unformatted                                              | Pre-existing formatting state; the same files fail at `HEAD`                                                                                                         | Do not run repository-wide write-mode lint while the worktree contains unrelated changes; format in a dedicated cleanup change                      | OPEN — non-blocking |

No functional defect was demonstrated in the rate-limiting implementation itself.

---

## E. Security and Regression Findings

### Security evidence

- The general limiter is mounted at `/api` before body parsing, session creation, authentication, and every API route module. Blocked general requests therefore cannot reach parsing, DB lookups, or controllers.
- The strict login limiter runs before login validation, bcrypt, the controller, and database access.
- The `429` body is generic and was proven not to echo the submitted email, password, long input, SQL-shaped input, or client IP.
- Header spoofing through `X-Forwarded-For` did not evade the limiter on a direct non-loopback connection.
- `trust proxy` is `'loopback'`, not `true`.
- `OPTIONS` is skipped without diluting the POST bucket.
- Static assets and Socket.IO are outside the `/api` limiter and remain functional.
- The five existing reset limiters remain intact and were regression-tested.
- No Redis, custom counter, mocking library, or new dependency was introduced.

### Regression evidence

- Full suite: 155/155 passing.
- Login integration tests including SQL-injection-shaped credentials: 34/34 passing.
- Password-reset response, hashing, token expiry, and single-use behavior: all passing.
- API authentication middleware: 16/16 passing.

### Remaining risks (accepted for this scope)

1. **In-memory, per-process store.** Each Node/PM2 process has its own counters. A multi-process or multi-instance deployment multiplies the effective limit. Single-process deployment is assumed by the current topology documentation.
2. **Shared NAT / corporate IP.** Legitimate users behind one public IP share a 100-request and 5-login budget. A 100/15-minute general limit is the task’s explicit requirement but may be tight for heavy search/dashboard users.
3. **Proxy topology is documentation-based.** `trust proxy: 'loopback'` matches README §13 (`proxy_pass http://127.0.0.1:3000`), but live production Nginx/firewall behavior was not inspected. If Nginx is not on loopback, every client would share the proxy IP bucket; if Node is directly exposed, forwarded headers are ignored (safe) but the proxy assumption is wrong.
4. **Distributed attacks.** IP-based limiting does not stop attacks distributed across many source IPs.
5. **Registration throttling is only the general limit.** There is no separate tighter registration limiter in this task.
6. **Email enumeration below the threshold.** The forgot-password flow still distinguishes `found` / `not found` within the allowed five attempts; that pre-existing behavior is outside this task.
7. **Session creation before the strict login limiter.** See D-007-02. Blocked logins do not reach credentials, bcrypt, DB, or controllers, but an empty in-memory session cookie is still issued because of the pre-existing `saveUninitialized: true` setting.
8. **Non-API page routes remain unlimited.** Only `/api` is covered, as specified.
9. **No external store atomicity guarantee.** The default MemoryStore behaved correctly in a 20-request concurrency probe, but distributed atomicity is not provided.

---

## F. Production Readiness Decision

### **READY WITH CONDITIONS**

The reviewed change is functionally correct and does not introduce a demonstrated regression:

- All 155 automated tests pass with no failures or skips.
- All 12 focused rate-limit assertions pass, including boundary, bucket isolation, spoof resistance, `OPTIONS`, generic body, headers, mount order, route order, client handling, reset-limiter preservation, and trust-proxy safety.
- 36 manual checks passed, including a full-application smoke test that observed 5 normal login attempts followed by a real `429`, a 100-allowed/101st-blocked general limiter, static-asset isolation, page rendering, and a Socket.IO handshake.
- No release-blocking defect was found.

The decision is conditional because the following could not be verified in this environment: a valid-credential login, a complete reset flow with real email delivery, browser-rendered `429` UX, and the live production proxy topology. The residual MemoryStore, shared-NAT, and pre-existing session-cookie limitations also require acceptance.

---

## G. Remaining Actions

1. **Verify the production proxy chain.** Confirm Nginx is the only hop and connects from loopback to Node, and that Node is not directly reachable from untrusted networks while presenting forwarded headers.
2. **Accept or adjust the 100/15-minute general limit.** Monitor realistic authenticated dashboard/search usage for false `429`s; move to a shared Redis store before scaling beyond one Node process.
3. **Run a disposable valid-credential smoke test.** Confirm normal login and support login still redirect correctly under the limit.
4. **Run one complete reset flow** with a disposable account and safe SMTP capture to confirm the existing reset limiters still integrate with the general limiter.
5. **Trigger a `429` in a browser** for both login screens and confirm the SweetAlert warning appears without changing success behavior.
6. **Track D-007-02 separately** under Finding 29 (`saveUninitialized: false`) so blocked login requests do not allocate sessions.
7. **Keep `npm run lint` out of the current mixed worktree.** Format the five pre-existing unformatted files in a dedicated cleanup change to avoid unrelated churn.
8. **Do not commit this working tree until the unrelated findings and documentation reformatting are separated.**
