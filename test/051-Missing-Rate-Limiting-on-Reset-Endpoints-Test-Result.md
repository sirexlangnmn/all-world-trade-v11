# Test Result — 051 Missing Rate Limiting on Reset Endpoints

| Field | Value |
| --- | --- |
| Task under test | `docs/tasks/051-Missing-Rate-Limiting-on-Reset-Endpoints.md` |
| Source finding | `CODE_REVIEW.md` → Finding 51 |
| Reviewed scope | Password-reset rate-limit middleware, five route registrations, proxy trust setting, client `429` handling, and focused/regression tests |
| Environment | Linux (WSL), Node.js v24.19.0, npm 12.0.2, Express 5, `node:test` |
| Focused test file | `test/051-reset-endpoints-rate-limit.test.js` |
| Overall automated result | **68 tests passed, 0 failed, 0 skipped** across five test files |
| Production readiness | **INCONCLUSIVE** |

## A. Change Summary

The reviewed working tree contains a route-specific rate limiter for each of the five password-reset endpoints. Strict endpoints allow five requests per IP per 15 minutes; the reset-page GET allows 30 per IP per 15 minutes. The middleware responds with a generic `429`, standard rate-limit headers, and `Retry-After`. Client scripts include `429` error handling.

Express trusts loopback proxies, consistent with the topology documented in README §13.2, where Nginx proxies to `127.0.0.1:3000`. This documents the repository's stated topology; the live production host and proxy chain were not inspected.

The dependency `express-rate-limit@8.7.1` is installed. It is declared in `package.json`; `package-lock.json` already contains the dependency and has no pending diff in the reviewed working tree.

### Traceability — implementation to verification

| Change | Verification |
| --- | --- |
| Factory limits and generic `429` response | TC-051-01, TC-051-05 |
| Request blocked before handler execution | TC-051-01 |
| Independent client-IP buckets | TC-051-02 |
| Forwarded-header spoof protection under loopback trust | TC-051-03, TC-051-06 |
| Plain-text reset-page `429` message | TC-051-04 |
| Existing reset contracts and password behavior | Regression runs for tests 049, 050, `password-reset`, and 003.2 |
| Five route registrations and browser warning paths | Source inspection only; no end-to-end route/client test was executed |

## B. Test Scenarios

### B.1 Focused automated scenarios (`test/051-reset-endpoints-rate-limit.test.js`)

| ID | Feature / module | Objective | Preconditions / test data | Procedure and input | Expected result | Actual result | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-051-01 | Rate-limit middleware | Allow N requests and reject N+1 before the handler | Ephemeral Express server; fresh limiter, 60-second test window, limit 3 | Send four POST requests from one forwarded client IP with form data containing email, UUID, and token markers | First three return 200; fourth returns 429; handler runs exactly three times; standard headers and `Retry-After` present; body does not echo markers | Observed as expected | PASS |
| TC-051-02 | Per-IP buckets | Ensure one IP does not consume another IP's allowance | Fresh limiter, limit 2; test app trusts loopback | Send two requests as `203.0.113.10`, a third from that IP, then a request as `203.0.113.11` | First IP's third request is limited; second IP receives its own allowance | Observed as expected | PASS |
| TC-051-03 | Proxy trust | Ensure changing forwarded IP cannot bypass limiting on an untrusted direct connection | Non-loopback host interface available; test server trusts loopback | Make direct requests with three different `X-Forwarded-For` values | Requests share the direct socket-IP bucket; third request is 429 | Observed as expected; test was not skipped | PASS |
| TC-051-04 | Reset-page response | Verify GET limiter uses a generic plain-text response | Fresh limiter, limit 1 | Send two GET requests from the same client IP | First returns 200; second returns 429 with the configured generic text | Observed as expected | PASS |
| TC-051-05 | Production limiter configuration | Verify limiter instances and configured limits | Import production limiter module | Check the 15-minute window, limits 5/30, callable exports, and distinct instances | Configuration matches the documented matrix; one instance per route | Observed as expected | PASS |
| TC-051-06 | Express proxy configuration | Prevent arbitrary proxy trust | Read `app/src/server.js` | Assert trust proxy is `loopback` and is not boolean `true` | Safe documented setting is present | Observed as expected | PASS |

### B.2 Regression scenarios

| ID | Feature / module | Objective | Preconditions / test data | Procedure and input | Expected result | Actual result | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-051-07 | Reset-token lifecycle | Preserve expiration, single-use invalidation, and reset page behavior | Existing offline stubs in test 049 | Run `node --test test/049-reset-token-invalidation-and-expiry.test.js` | Existing token and password update contracts remain intact | 18 tests passed | PASS |
| TC-051-08 | Forgot-password lookup | Preserve response shape and avoid credential exposure | Existing offline stubs in test 050 | Run `node --test test/050-forgot-password-response.test.js` | Existing `found`/`not found` and field contracts remain intact | 16 tests passed | PASS |
| TC-051-09 | Password-reset service | Preserve hashing, validation, and update behavior | Existing service tests | Run `node --test test/password-reset.test.js` | Existing password service behavior remains intact | 17 tests passed | PASS |
| TC-051-10 | Password storage on reset | Preserve server-side hashing and reject unsafe legacy fields | Existing offline stubs in test 003.2 | Run `node --test test/003.2-plaintext-password-storage-on-reset.test.js` | Password reset continues to store hashes, not plaintext | 11 tests passed | PASS |

### B.3 Manual, integration, and other checks

| ID | Feature / module | Objective | Preconditions / test data | Procedure and input | Expected result | Actual result | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-051-11 | Full reset flow | Verify lookup → token → email → reset page → password update through a running application | Disposable database account and safe SMTP test configuration | Complete a real local reset flow | All existing contracts remain functional under their respective limits | Not run; no disposable database/SMTP flow was performed | NOT EXECUTED |
| TC-051-12 | Endpoint-level limiting | Verify each registered route returns 429 without invoking DB/SMTP after N requests | Running application with disposable configuration | Send six same-IP requests to a strict endpoint and inspect response headers and side effects | Five under-limit responses; sixth is 429; no sixth handler side effect | Not run against the configured application; middleware behavior was verified using isolated HTTP probes | NOT EXECUTED |
| TC-051-13 | Client UX | Verify both browser flows display a warning for 429 and preserve success behavior | Browser, local server, and rate-limited request | Trigger 429 through both client pages | Friendly warning shown; existing success callbacks remain intact | Source inspected; browser interaction not executed | NOT EXECUTED |
| TC-051-14 | Formatting | Check changed task files without repository-wide formatting writes | Existing worktree contains numerous unrelated changes | Run targeted `npx prettier --check` | Changed files meet repository formatting expectations | New limiter and focused test pass; some pre-existing source files report style warnings | NEEDS REVIEW |

## C. Test Execution Summary

### Commands executed

```text
node --test test/051-reset-endpoints-rate-limit.test.js
node --test test/049-reset-token-invalidation-and-expiry.test.js
node --test test/050-forgot-password-response.test.js
node --test test/password-reset.test.js
node --test test/003.2-plaintext-password-storage-on-reset.test.js
```

The five commands were also run together:

```text
node --test test/051-reset-endpoints-rate-limit.test.js \
  test/049-reset-token-invalidation-and-expiry.test.js \
  test/050-forgot-password-response.test.js \
  test/password-reset.test.js \
  test/003.2-plaintext-password-storage-on-reset.test.js
```

| Result category | Count |
| --- | ---: |
| Passed automated test cases | 68 |
| Failed | 0 |
| Skipped | 0 |
| Blocked | 0 |
| Not executed manual/integration scenarios | 3 |

Additional evidence:

- `npm ls express-rate-limit` reported `express-rate-limit@8.7.1`.
- `node --check` succeeded for the limiter, affected routes/bootstrap, browser scripts, and focused test.
- Prettier check succeeded for the new limiter and focused test. The targeted check over all affected source files reported warnings for six files; the repository's lint script runs write-mode formatting, so the broad lint command was not run to avoid unrelated churn.
- The test runner emitted an existing Sequelize `operatorsAliases` deprecation warning. No test failed because of it.
- `npm test` was not run; it is documented as an intentional stub in this repository.

## D. Defects Found

No functional defect was demonstrated by the executed automated tests.

| ID | Severity | Finding | Root cause / recommendation |
| --- | --- | --- | --- |
| D-051-01 | Follow-up / not release-blocking based on this evidence | Endpoint registration and browser `429` behavior are verified by source inspection, but are not directly exercised by the focused HTTP test. | Add route-level integration tests that assert each named limiter precedes its handler, and a test for client error handling if the repository adds a browser-JS test harness. |
| D-051-02 | Deployment verification required | The `loopback` proxy trust decision is based on the committed README example, not inspection of live production networking/firewall configuration. | Deployment owner should verify that the only trusted reverse proxy is loopback Nginx and that direct Node exposure is controlled. Adjust trust configuration if the actual topology differs. |

## E. Security and Regression Findings

### Security evidence

- Automated HTTP tests observed `429`, `Retry-After`, and standardized `RateLimit-*` headers.
- The handler was called only for allowed requests in the limit-boundary test.
- The response body did not echo the submitted email, UUID, token, or test IP marker.
- Separate test IPs used separate buckets.
- A direct untrusted connection could not rotate the limiter bucket by changing `X-Forwarded-For`.
- No production database, account, token, or SMTP service was used.

### Regression evidence

The existing reset-token expiry/single-use, forgot-password response, password reset, and plaintext-storage regression suites all passed. These are offline tests and do not prove the full configured Express/database/email path.

### Remaining risks

- The default in-memory store is per process and does not coordinate limits across multiple Node processes.
- Shared NAT users share an IP bucket; distributed sources can still spread requests.
- The existing `found`/`not found` difference still permits limited email enumeration below the threshold.
- Live proxy topology and firewall behavior have not been independently verified.
- Manual full-flow, live endpoint N+1 side-effect, and browser interaction checks remain outstanding.

## F. Production Readiness Decision

**INCONCLUSIVE**

The focused limiter behavior and the requested regression suites passed: 68 automated test cases, no failures or skips. However, release readiness cannot be determined from this evidence alone: the running application's full reset flow and route-level side-effect blocking were not exercised, browser behavior was not run, and the production proxy topology remains an assumption based on repository documentation.

## G. Remaining Actions

1. Verify production Nginx/Node reachability and trusted proxy hops before deployment; ensure direct external requests cannot reach Node while presenting trusted proxy credentials or addresses.
2. In a disposable environment, execute one complete reset flow with test database data and safe SMTP capture.
3. Exercise a strict endpoint with six requests from one client and verify `Retry-After`, rate-limit headers, generic response content, and absence of the sixth request's database/SMTP side effects.
4. Trigger 429s in both browser flows and verify the warning while confirming normal success flow remains unchanged.
5. Consider adding route registration/client behavior assertions to automated tests so the handler middleware ordering and UI response are guarded against future regressions.
6. Review the targeted Prettier warnings separately; do not run repository-wide write-mode lint until unrelated worktree changes are accounted for.

