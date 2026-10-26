# Test Result — Finding 11: TLS Verification Disabled for Email Transport

**Date:** 2026-10-26
**Branch:** `feature/011-TLS-Verification-Disabled-for-Email-Transport`
**Task:** `docs/tasks/011-TLS-Verification-Disabled-for-Email-Transport.md`
**Scope:** All Nodemailer transports in `app/`
**Environment:** Node.js `v24.19.0`, npm `12.0.2`, Nodemailer `7.0.13`, Prettier `3.8.0`
**Database:** Configured database was reachable; the full suite ran its integration cases (no skips).

---

## A. Change Summary

### What changed

Finding 11 reported `tls: { rejectUnauthorized: false }` on Nodemailer transports. That encrypts SMTP traffic but does not authenticate the SMTP server, allowing a network attacker to intercept SMTP credentials, password-reset tokens, verification codes, and message contents.

The implementation uses **Approach A**: one shared TLS decision in `app/config/email.config.js`.

- `buildEmailTlsOptions(env)` returns `{ rejectUnauthorized: true }` by default.
- Verification can only be disabled by the exact opt-in `EMAIL_TLS_REJECT_UNAUTHORIZED=false` (whitespace trimmed) **and** a non-production `NODE_ENV`.
- Production is detected case-insensitively and trimmed (`production`, `Production`, ` PRODUCTION `), so production always verifies.
- Malformed values (`FALSE`, `0`, `no`, `off`, `null`, empty) keep verification enabled.
- `EMAIL_TLS_OPTIONS` is exported and consumed by all inline transports; `EMAIL_CONFIG.tls` uses the same option for `EmailService` and the midnight report.

### Why it changed

To remove the SMTP man-in-the-middle weakness without changing SMTP credentials, ports, `secure` flags, templates, recipients, routes, or response bodies.

### Files modified

| File                                                | Change                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------- |
| `app/config/email.config.js`                        | Added `buildEmailTlsOptions`, `EMAIL_TLS_OPTIONS`, `isProductionEnvironment`; wired `EMAIL_CONFIG.tls` to the shared option |
| `app/routes/email-marketing.js`                     | 4 transports now use `EMAIL_TLS_OPTIONS`                                  |
| `app/routes/forgot-password.js`                     | Password-reset transport uses `EMAIL_TLS_OPTIONS`                         |
| `app/routes/upload-file.js`                         | Registration, resend, and payment transports use `EMAIL_TLS_OPTIONS`      |
| `app/shared/email-template.js`                      | 4 shared email helpers use `EMAIL_TLS_OPTIONS`                            |
| `app/db_controllers/support_messages.controller.js` | Support/suggestion transport uses `EMAIL_TLS_OPTIONS`                     |
| `.env.example`                                      | Documented the development-only opt-out with safe default `true`          |
| `README.md`                                         | Documented `EMAIL_TLS_REJECT_UNAUTHORIZED` and §14.4 SMTP TLS rules       |

### Files added / updated for verification

| File                                                                    | Purpose                                      |
| ----------------------------------------------------------------------- | -------------------------------------------- |
| `test/011-email-tls-verification.test.js`                               | Automated acceptance and regression tests    |
| `test/011-TLS-Verification-Disabled-for-Email-Transport-Test-Result.md` | This evidence report                         |

### Files intentionally not changed

- `app/services/email.service.js` — consumes `EMAIL_CONFIG`; no edit needed.
- `app/config/email-recipients.config.js` — recipients unchanged.
- SMTP credentials, `secure`, `port`, templates, subjects, routes, response bodies — unchanged.
- `CODE_REVIEW.md` — reference only.
- `.env` — not modified.

### Transport inventory (after change)

| File                                                | `createTransport` calls | Secure configuration                             |
| --------------------------------------------------- | ----------------------- | ------------------------------------------------ |
| `app/config/email.config.js`                        | 0 (feeds service)       | Guarded `rejectUnauthorized` expression          |
| `app/services/email.service.js`                     | 1                       | `createTransport(EMAIL_CONFIG)`                  |
| `app/routes/email-marketing.js`                     | 4                       | 4 × `tls: EMAIL_TLS_OPTIONS`                     |
| `app/routes/forgot-password.js`                     | 1                       | 1 × `tls: EMAIL_TLS_OPTIONS`                     |
| `app/routes/upload-file.js`                         | 3                       | 3 × `tls: EMAIL_TLS_OPTIONS`                     |
| `app/shared/email-template.js`                      | 4                       | 4 × `tls: EMAIL_TLS_OPTIONS`                     |
| `app/db_controllers/support_messages.controller.js` | 1                       | 1 × `tls: EMAIL_TLS_OPTIONS`                     |
| **Total**                                           | **14**                  | **14/14 secure**                                 |

---

## B. Test Scenarios

Preconditions for automated cases: repository at the branch above, dependencies installed, no real SMTP connection is opened by the test suite, and no real credentials are read by tests.

| ID     | Category                | Feature / Objective                                                                 | Preconditions / Data                                                              | Procedure                                                                                       | Expected                                              | Actual                                                        | Status      |
| ------ | ----------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------- | ----------- |
| TC-001 | Positive                | Default TLS verification in production                                              | `{ NODE_ENV: 'production' }`                                                      | Call `buildEmailTlsOptions`                                                                     | `rejectUnauthorized === true`                         | `true`                                                        | PASS        |
| TC-002 | Positive / Boundary     | Default TLS verification with an empty environment                                  | `{}` and no argument                                                              | Call `buildEmailTlsOptions`                                                                     | `rejectUnauthorized === true`                         | `true`                                                        | PASS        |
| TC-003 | Boundary                | Missing `NODE_ENV` cannot weaken verification                                        | No `NODE_ENV`, no opt-out                                                         | Call `buildEmailTlsOptions`                                                                     | `true`                                                | `true`                                                        | PASS        |
| TC-004 | Boundary / Security     | Mis-cased or padded production cannot opt out                                        | `NODE_ENV` = `Production`, ` PRODUCTION `; opt-out `false`                        | Call `buildEmailTlsOptions`                                                                     | `true`                                                | `true`                                                        | PASS        |
| TC-005 | Negative / Security     | Production ignores `EMAIL_TLS_REJECT_UNAUTHORIZED=false`                             | `NODE_ENV=production`, opt-out `false`                                             | Call `buildEmailTlsOptions` and resolve live config in a child process                          | `true`                                                | `true`                                                        | PASS        |
| TC-006 | Negative / Security     | Malformed opt-out values cannot disable verification                                 | `FALSE`, `False`, `0`, `no`, `off`, `null`, `''`, `'   '`, `true`                 | Call `buildEmailTlsOptions` for each value                                                      | `true`                                                | all `true`                                                    | PASS        |
| TC-007 | Positive                | Explicit development opt-out works outside production                                | `NODE_ENV=development`, opt-out `false`; also `nonprod`                           | Call `buildEmailTlsOptions`                                                                     | `rejectUnauthorized === false`                         | `false`                                                       | PASS        |
| TC-008 | Boundary                | Opt-in value is trimmed                                                              | opt-out `'  false  '`                                                             | Call `buildEmailTlsOptions`                                                                     | `false` outside production                            | `false`                                                       | PASS        |
| TC-009 | Security / Static       | No insecure literal remains in application source                                    | All `app/**/*.js`                                                                 | Scan every file for `rejectUnauthorized: false` and `NODE_TLS_REJECT_UNAUTHORIZED`               | No matches                                            | Only guarded helper line in `email.config.js`                 | PASS        |
| TC-010 | Security / Integration  | Every Nodemailer transport uses the shared secure configuration                      | All `app/**/*.js` containing `createTransport`                                    | Count transports and shared TLS usages; `EmailService` must pass `EMAIL_CONFIG`                  | 14/14 secure                                          | 13 inline + 1 `EMAIL_CONFIG`; all secure                      | PASS        |
| TC-011 | Regression              | Each inline transport keeps its original SMTP credentials                            | Expected env names per flow                                                       | Scan touched files for original `process.env.*` credential references                            | All original credential names retained                | All retained; no credential values printed                    | PASS        |
| TC-012 | Integration             | Live configuration resolves secure in production                                     | Child process with `NODE_ENV=production`                                          | Load `EMAIL_CONFIG` and print only `tls`                                                        | `{ rejectUnauthorized: true }`                        | `{ rejectUnauthorized: true }`                                | PASS        |
| TC-013 | Integration / Security  | Live configuration ignores opt-out in production                                     | Child process with `NODE_ENV=production`, opt-out `false`                         | Load `EMAIL_CONFIG` and print only `tls`                                                        | `{ rejectUnauthorized: true }`                        | `{ rejectUnauthorized: true }`                                | PASS        |
| TC-014 | Configuration           | `.env.example` keeps verification enabled by default                                | `.env.example`                                                                    | Assert `EMAIL_TLS_REJECT_UNAUTHORIZED=true` and production warning text                          | Safe default and warning present                      | Present                                                       | PASS        |
| TC-015 | Documentation           | README documents production cannot disable verification                              | `README.md`                                                                       | Assert variable and production statement                                                        | Documented                                            | Present in §14.4 and variable table                           | PASS        |
| TC-016 | Security                | No SMTP password logging introduced                                                  | Touched files                                                                     | Scan for `console.*` containing password env names                                              | No matches                                            | No matches                                                    | PASS        |
| TC-017 | Integration / Security  | Production SMTP certificate chain validates                                          | Read-only `openssl s_client -starttls smtp` against configured host:587            | Inspect verify code, protocol, chain, dates, SAN                                                | `Verify return code: 0 (ok)`, hostname matches        | `0 (ok)`, TLSv1.3, 4-cert chain, SAN matches (host redacted)  | PASS        |
| TC-018 | Negative / Security     | A self-signed certificate is rejected when verification is on                        | Local TLS server with a temporary self-signed cert; Nodemailer `secure: true`, `rejectUnauthorized: true` | `transporter.verify()`                                                          | Connection fails closed with a certificate error      | Rejected: `self-signed certificate` (`ESOCKET`)               | PASS        |
| TC-019 | Integration / Resilience| Live SMTP `transporter.verify()` succeeds with verification enabled                  | Real configured SMTP host/port, credentials not printed                           | Construct transport from `EMAIL_CONFIG`, call `verify()`                                        | Verification succeeds, `tls.rejectUnauthorized === true` | `SMTP_VERIFY_OK tls.rejectUnauthorized=true`                 | PASS        |
| TC-020 | Integration             | Real email delivery through an affected flow                                         | Controlled/staging recipient and safe SMTP account                                | Trigger one email flow and confirm delivery, no TLS error                                        | Email delivered                                       | Not executed: environment points at the production SMTP account; no controlled mailbox was available | NOT EXECUTED |
| TC-021 | Regression              | Full automated suite continues to pass                                               | Configured database reachable                                                      | `node --test`                                                                                   | All pass, skips reported                              | 215 pass, 0 fail, 0 skipped, 0 cancelled                      | PASS        |
| TC-022 | Regression              | Password-reset and security suites still pass                                        | Existing tests                                                                     | Included in full `node --test`                                                                  | Pass                                                  | Pass                                                          | PASS        |
| TC-023 | Performance             | No extra network calls or startup verification added                                 | Code review of diff                                                               | Check for new `verify()`, retries, or per-request transports                                     | No new network/startup behavior                       | Only the TLS option changed; `EmailService` verify behavior unchanged | PASS |
| TC-024 | Data Integrity          | No database/schema/session changes                                                   | Git diff                                                                          | Review changed files and schema files                                                            | No DB/session/auth changes                            | No DB/session/auth changes                                    | PASS        |
| TC-025 | Error Handling          | Invalid certificate fails closed instead of silently falling back                    | Self-signed endpoint (TC-018)                                                      | Observe failure path                                                                            | Send fails with TLS error; no insecure retry          | Failed closed; no fallback observed                           | PASS        |

---

## C. Test Execution Summary

| Execution                                  | Command / Method                                                                 | Result                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------- |
| Focused acceptance tests                   | `node --test test/011-email-tls-verification.test.js`                            | **15 pass, 0 fail, 0 skipped**              |
| Full automated regression suite            | `node --test`                                                                    | **215 pass, 0 fail, 0 skipped, 0 cancelled** |
| Live TLS resolution (production)           | Child process loading `EMAIL_CONFIG`                                             | `{ "rejectUnauthorized": true }`            |
| Live TLS resolution (production + opt-out) | Child process with `NODE_ENV=production EMAIL_TLS_REJECT_UNAUTHORIZED=false`     | `{ "rejectUnauthorized": true }`            |
| Live SMTP verify                           | `transporter.verify()` against the configured SMTP server                        | `SMTP_VERIFY_OK tls.rejectUnauthorized=true` |
| SMTP certificate check                     | `openssl s_client -starttls smtp`                                                | `Verify return code: 0 (ok)`, TLSv1.3        |
| Negative TLS check                         | Local self-signed TLS endpoint + Nodemailer `rejectUnauthorized: true`            | Rejected with `self-signed certificate`     |
| Real email send                            | Manual flow                                                                      | **Not executed** (no controlled mailbox)    |
| Lint / format                              | `npx prettier --check --end-of-line crlf` on changed JS                          | Config, test, and all changed JS pass except a pre-existing unrelated formatting difference in `forgot-password.js`; see caveat |

### Counts

- Passed: **24 test scenarios** (including 15 automated focused tests and the full 215-test suite).
- Failed: **0**.
- Skipped: **0** in the automated suite.
- Blocked: **0**.
- Not executed: **1** (TC-020, real email delivery).
- Unverified assumptions: none stated as passing. TC-020 is explicitly unverified.

---

## D. Defects Found

### Product defects

**None.** No defect was found in the TLS verification change.

### Test-coverage gap found and corrected during this review

- **Severity:** Low (test quality, not runtime behavior).
- **Root cause:** The original transport test required `EMAIL_TLS_OPTIONS` or `EMAIL_CONFIG` to appear somewhere in a file, not once per `createTransport`. A future partial edit could replace only one transport and still pass the file-level check.
- **Remediation applied:** The test now compares the number of `createTransport` calls with the number of `tls: EMAIL_TLS_OPTIONS` usages, except for `EmailService`, which must pass `EMAIL_CONFIG`. A second test asserts the original credential env names remain.
- **Verification:** Focused suite re-run: 15/15 pass; full suite re-run: 215/215 pass.

### Operational note (not caused by this change)

- The repository `.env` uses CRLF line endings. One exploratory shell command that sourced `.env` failed and echoed one credential line to the local terminal before the work switched to `dotenv`. The value is not included in this report. If terminal/session transcripts are retained, rotate the affected SMTP credential as a precaution and keep using `dotenv`-based checks (or `openssl` with shell variables populated by `dotenv`) instead of `source .env`.

---

## E. Security and Regression Findings

### Security result

- The original vulnerability is closed: no application transport disables certificate verification by default.
- Production cannot disable verification through `EMAIL_TLS_REJECT_UNAUTHORIZED`.
- Fail-closed behavior was demonstrated against a local self-signed endpoint.
- The live production SMTP certificate chain validates (`Let's Encrypt` issuer, SAN matches the configured host, chain includes intermediates, expiry `2026-12-31`).
- No SMTP credentials, reset tokens, or verification codes are printed by the new tests or modified source files.
- No `NODE_TLS_REJECT_UNAUTHORIZED=0`, `strictSSL: false`, or `--insecure` was introduced.
- No SQL, auth, session, database, upload, or API-response behavior was changed.

### Remaining risks

1. **No real send was performed.** `transporter.verify()` and the certificate check passed, but delivery was not proven end-to-end in this environment. A controlled staging/recipient send remains the final runtime check.
2. **`requireTLS` is not set.** With `secure: false`, STARTTLS is negotiated opportunistically. If the SMTP server does not advertise STARTTLS, the connection can fall back to plaintext. This is an explicit out-of-scope follow-up.
3. **`EMAIL_SECURE` is documented but unused.** The transports still hardcode `secure: false`. Also out of scope for Finding 11.
4. **Non-production opt-out applies to any `NODE_ENV` other than production** (for example `staging`). This matches Approach A in the task, but a staging environment that explicitly sets `EMAIL_TLS_REJECT_UNAUTHORIZED=false` will not verify certificates. Production is protected.
5. **Certificate expiry.** The certificate expires on `2026-12-31`; normal SMTP certificate renewal monitoring remains necessary.
6. **Lint caveat.** `npm run lint` runs Prettier in write mode and would reformat the entire repository (including unrelated files and markdown tables). It was not run repo-wide. Targeted `--check --end-of-line crlf` passed for the changed TLS files and the test. `app/routes/forgot-password.js` has a pre-existing unrelated formatting difference in its rate-limiter destructuring, and `README.md` is not repository-wide Prettier-clean; neither was reformatted to keep the diff scoped.

---

## F. Production Readiness Decision

### READY WITH CONDITIONS

**Evidence supporting the decision:**

- All 14 transports are secure; no insecure literal remains in `app/`.
- Production always resolves to `rejectUnauthorized: true`, including with the opt-out set to `false`.
- The live SMTP certificate validates and `transporter.verify()` succeeds with verification enabled.
- Invalid/self-signed certificates fail closed.
- The full suite passes (215/215) and the focused suite passes (15/15).
- Credentials, ports, `secure`, templates, recipients, routes, and response behavior are unchanged.

**Why it is not unconditional:**

- TC-020 (real email delivery) was not executed because no controlled mailbox/staging SMTP account was available and the configured account is the production account.
- The pre-existing `requireTLS`/plaintext-fallback gap remains outside this task.
- The credential-echo incident during local verification warrants a precautionary rotation if transcripts are retained.

No known release-blocking defect remains in the reviewed change. The conditions below must be completed or explicitly accepted before/at release.

---

## G. Remaining Actions

1. **Controlled send:** Trigger one safe email flow (password reset or verification) to a controlled mailbox using a staging or test SMTP account, or with explicit authorization for a test recipient. Confirm delivery and absence of TLS errors.
2. **Post-deploy monitoring:** Watch for `unable to verify the first certificate`, `self-signed certificate`, `certificate has expired`, and hostname-mismatch errors immediately after rollout.
3. **Credential hygiene:** If local terminal/session transcripts retaining the earlier `.env` output are stored, rotate the affected SMTP credential; continue using `dotenv`-based checks.
4. **Certificate renewal:** Track the SMTP certificate expiry (`2026-12-31`) and ensure renewal does not break the chain.
5. **Follow-ups (separate tasks):** Consider `requireTLS: true` to prevent plaintext fallback; honor the documented `EMAIL_SECURE` value; consolidate duplicated transporters into `EmailService` (Finding 16).
6. **Repository formatting:** Keep `npm run lint` scoped or handle the repository-wide Prettier/CRLF reformat separately to avoid unrelated diff noise.

---

## Verification Commands and Outputs

### Inventory after change

```text
$ grep -RIn "rejectUnauthorized" app --include='*.js'
app/config/email.config.js:20:        rejectUnauthorized: !(optOutRequested && !isProductionEnvironment(env)),
```

The only occurrence is the guarded helper expression. Before the change there were 14 insecure occurrences across six files.

### Production resolution

```text
$ NODE_ENV=production node -e "const { EMAIL_CONFIG } = require('./app/config/email.config'); console.log(JSON.stringify(EMAIL_CONFIG.tls))"
{"rejectUnauthorized":true}

$ NODE_ENV=production EMAIL_TLS_REJECT_UNAUTHORIZED=false node -e "..."
{"rejectUnauthorized":true}

$ NODE_ENV=development EMAIL_TLS_REJECT_UNAUTHORIZED=false node -e "..."
{"rejectUnauthorized":false}
```

### SMTP certificate summary (host redacted)

| Check                      | Result                                                |
| -------------------------- | ----------------------------------------------------- |
| Verify return code         | `0 (ok)`                                              |
| Protocol / cipher          | TLSv1.3 / `TLS_AES_256_GCM_SHA384`                    |
| Chain                      | 4 certificates (leaf, Let's Encrypt intermediate, ISRG roots) |
| Hostname / SAN             | Matches the configured SMTP host (redacted)           |
| Validity                   | `notBefore=Oct 2 22:20:43 2026 GMT`, `notAfter=Dec 31 22:20:42 2026 GMT` |
| Issuer                     | `C=US, O=Let's Encrypt, CN=YR2`                        |
| Nodemailer `verify()`      | Success with `tls.rejectUnauthorized=true`            |

### Focused test output

```text
$ node --test test/011-email-tls-verification.test.js
tests 15
pass 15
fail 0
skipped 0
```

### Full suite output

```text
$ node --test
tests 215
pass 215
fail 0
skipped 0
cancelled 0
```

---

## Acceptance Criteria Check

| Criterion                                                                 | Result |
| ------------------------------------------------------------------------- | ------ |
| All original insecure occurrences removed or replaced by one guarded helper | PASS   |
| Production always verifies, even with opt-out `false`                      | PASS   |
| Dev opt-out is explicit, non-production-only, documented, and tested       | PASS   |
| Email flows keep original credentials, ports, `secure`, templates          | PASS   |
| `EmailService` / midnight report uses secure `EMAIL_CONFIG`                | PASS   |
| Focused `node:test` tests exist and pass                                   | PASS   |
| Source scan proves no insecure literal remains                             | PASS   |
| SMTP certificate chain checked and documented                              | PASS   |
| Real email send verified where safe access exists                          | NOT EXECUTED (documented) |
| Existing suite passes; skips reported separately                           | PASS (0 skipped) |
| Lint/format checked without unrelated reformatting                         | PASS WITH CAVEAT |
| Final diff limited to this finding                                         | PASS   |
| Remaining risks documented                                                 | PASS   |

---

## Final Status

**PASS WITH CONDITIONS** — implementation verified; controlled email delivery remains to be confirmed in a safe staging environment.
