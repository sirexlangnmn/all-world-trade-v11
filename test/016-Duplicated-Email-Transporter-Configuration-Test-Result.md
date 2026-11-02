# Test Result — Finding 16: Duplicated Email Transporter Configuration

**Task:** `docs/tasks/016-Duplicated-Email-Transporter-Configuration.md`
**Code review finding:** `CODE_REVIEW.md` Finding 16 (Low — maintainability / reliability)
**Date:** 2026-11-02
**Reviewer role:** Senior Software Engineer / QA / Production Readiness Reviewer
**Environment:** Linux, Node.js `v24.19.0`, npm `12.2.1`, Prettier `3.8.0`, Nodemailer `7.x`
**Test framework:** Node.js built-in `node:test` + `node:assert/strict`
**Database:** Configured database was reachable during `npm test`; database-backed integration cases executed (no skips).

---

## A. Change Summary

The change consolidates all Nodemailer transport creation and Handlebars registration under `app/services/email.service.js`, with named SMTP credential profiles declared in `app/config/email.config.js`.

Before: 13 inline `nodemailer.createTransport(...)` calls across 6 application files, each rebuilding its own Handlebars configuration.

After: 1 `nodemailer.createTransport(...)` call in the shared service, cached once per credential profile (`support`, `registration`, `payment`), with Handlebars configured once per transporter.

### Files modified

| File                                                | Change                                                                                                                                                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/config/email.config.js`                        | Added `buildEmailProfiles`, `EMAIL_PROFILES` (`support`, `registration`, `payment`), `buildEmailTransportConfig`. Kept `EMAIL_CONFIG`, `EMAIL_TLS_OPTIONS`, `buildEmailTlsOptions`, `isProductionEnvironment` compatible. |
| `app/services/email.service.js`                     | Profile-cached transporters, one Handlebars registration per transporter, generic templated/HTML send methods, one method per existing email flow.                                                                        |
| `app/routes/email-marketing.js`                     | Removed 4 inline transports; delegates to the service; fire-and-forget sends attach rejection handlers.                                                                                                                   |
| `app/routes/forgot-password.js`                     | Removed inline registration transport; delegates to `sendPasswordResetEmail`; success-only response preserved.                                                                                                            |
| `app/routes/upload-file.js`                         | Removed 3 inline transports; verification/resend use `registration`, payment uses `payment`.                                                                                                                              |
| `app/shared/email-template.js`                      | Removed 4 inline transports; same exports and argument shapes now delegate to the service.                                                                                                                                |
| `app/db_controllers/support_messages.controller.js` | Removed inline transport; uses raw-HTML send path; no template property.                                                                                                                                                  |
| `test/011-email-tls-verification.test.js`           | Credential assertion updated to the centralized profiles; all TLS security assertions retained.                                                                                                                           |
| `test/016-email-service-consolidation.test.js`      | Extended with in-memory behaviour tests (30 total) that never open SMTP.                                                                                                                                                  |

### Files added

| File                                                                 | Purpose               |
| -------------------------------------------------------------------- | --------------------- |
| `test/016-Duplicated-Email-Transporter-Configuration-Test-Result.md` | This evidence report. |

No database schema, migration, environment variable, dependency, frontend, template, recipient, subject, or API contract was changed.

---

## B. Test Scenarios

### B.1 Consolidation and static/security tests (`test/016-email-service-consolidation.test.js`)

| ID    | Feature / module                | Objective                                                             | Preconditions / data               | Procedure                                                               | Expected result                                                      | Actual result | Status |
| ----- | ------------------------------- | --------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------- | ------ |
| TC-01 | Transport creation              | Prove only the shared service creates a Nodemailer transport          | Repository source at task commit   | Scan all `app/**/*.js` for `nodemailer.createTransport(`                | Only `app/services/email.service.js` matches                         | As expected   | PASS   |
| TC-02 | Handlebars configuration        | Prove only the shared service registers Handlebars                    | Repository source                  | Scan for `nodemailer-express-handlebars`, `hbs(`, `.use('compile'`      | Only `app/services/email.service.js` matches                         | As expected   | PASS   |
| TC-03 | Templates                       | Prove all 10 production templates still exist                         | Files under `public/view/email/`   | Check each expected `.handlebars` file exists                           | All present                                                          | As expected   | PASS   |
| TC-04 | Credential profiles             | Prove exactly three profiles exist                                    | `EMAIL_PROFILES` imported          | Compare sorted keys                                                     | `payment`, `registration`, `support`                                 | As expected   | PASS   |
| TC-05 | Profile → env mapping           | Prove each profile reads its original environment variables           | Controlled fake env                | Build transport configs for all profiles                                | Support/registration/payment auth match their original env variables | As expected   | PASS   |
| TC-06 | Backward compatibility          | Prove legacy `EMAIL_CONFIG` still equals the support transport        | Imported config                    | Compare `EMAIL_CONFIG` with `buildEmailTransportConfig('support')`      | Same `auth` object, same TLS options, `secure: false`                | As expected   | PASS   |
| TC-07 | Template / subject preservation | Prove every original subject and template remains in the service      | Service source                     | Search source for each expected subject/template string                 | All present                                                          | As expected   | PASS   |
| TC-08 | Compatibility exports           | Prove `email-template.js` exports remain and delegate                 | Helper source                      | Assert four `et.<name> =` exports and service delegation calls          | All preserved                                                        | As expected   | PASS   |
| TC-09 | Route cleanliness               | Prove email routes/controllers no longer import Nodemailer/Handlebars | Five email source files            | Assert no direct `require('nodemailer')` / handlebars imports           | None found                                                           | As expected   | PASS   |
| TC-10 | Raw HTML support message        | Prove support message does not use a Handlebars template              | Controller and service source      | Assert `sendSupportMessage`, `sendHtmlEmail`, and HTML literal          | Raw HTML path present, no template                                   | As expected   | PASS   |
| TC-11 | Fire-and-forget safety          | Prove non-awaited sends attach rejection handlers                     | Three fire-and-forget source files | Assert `.catch(` is present                                             | Present in all three                                                 | As expected   | PASS   |
| TC-12 | Secret logging                  | Prove no email source logs SMTP passwords                             | All `app/**/*.js`                  | Search for `console.*` lines containing password env names              | No matches                                                           | As expected   | PASS   |
| TC-13 | TLS static safety               | Prove no source disables certificate verification                     | All `app/**/*.js`                  | Search for `rejectUnauthorized: false` / `NODE_TLS_REJECT_UNAUTHORIZED` | No insecure literal; only guarded expression in config               | As expected   | PASS   |

### B.2 Behaviour tests through an in-memory transport (no SMTP connection)

The `nodemailer.createTransport` factory is replaced in-process with a fake transporter before the service module is loaded. The real service methods run and the captured `{ config, mailOptions }` is asserted.

| ID    | Feature / module                           | Objective                                                   | Input                                                        | Expected result                                                                                                      | Actual result | Status |
| ----- | ------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------- | ------ |
| TC-14 | `sendIntroductionEmail`                    | Preserve recipient/subject/template/profile and no context  | `prospect@example.test`                                      | support profile; `introduction2`; no `context` key; original subject                                                 | As expected   | PASS   |
| TC-15 | `sendTraderContactNotification`            | Preserve envelope and `{ emailData }`                       | trader address + emailData                                   | support profile; `notifyTraderOnClientContact`; subject `...Client tries to connect.`; context `{ emailData }`       | As expected   | PASS   |
| TC-16 | `sendClientContactNotification`            | Preserve envelope and `{ emailData }`                       | client address + emailData                                   | support profile; `notifyClientOnTraderTheyContact`; original subject; context `{ emailData }`                        | As expected   | PASS   |
| TC-17 | `sendAllWorldTradeContactNotification`     | Preserve hardcoded internal recipient                       | trader + client addresses                                    | `to: allworldtrade.com@gmail.com`; `notifyAWTwhenClientConnectToTrader`; context `{ traderEmail, clientEmail }`      | As expected   | PASS   |
| TC-18 | `sendClientEmailToTrader`                  | Preserve trader recipient and context                       | `emailData.traderEmail`                                      | `to: emailData.traderEmail`; `client-email-the-trader`; original subject; context `{ emailData }`                    | As expected   | PASS   |
| TC-19 | `sendAllWorldTradeClientEmailNotification` | Preserve hardcoded internal recipient                       | emailData                                                    | `to: allworldtrade.com@gmail.com`; `notifyAWTwhenClientSentEmailToTrader`; original subject; context `{ emailData }` | As expected   | PASS   |
| TC-20 | `sendPasswordResetEmail`                   | Preserve registration profile, from, subject, context       | `{ to, uuid, link }`                                         | registration auth; `from: EMAIL_SENDER_ADDRESS`; `request-for-change-password`; context `{ code: uuid, link }`       | As expected   | PASS   |
| TC-21 | `sendRegistrationVerificationEmail`        | Preserve registration profile and code value                | `{ to, code: 123456 }`                                       | registration auth; `from: EMAIL_SENDER_ADDRESS`; `registration-email-verification`; context `{ code: 123456 }`       | As expected   | PASS   |
| TC-22 | `sendPaymentAccountEmail`                  | Preserve payment profile and no context                     | buyer address                                                | payment auth; `from: PAYMENT_EMAIL_ADDRESS`; `payment-account`; no context                                           | As expected   | PASS   |
| TC-23 | `sendSupportMessage`                       | Preserve raw HTML, subject, support to/from, no template    | `{ senderEmail, senderMessage }`                             | support to/from; `HELP AND SUGGESTIONS from: ...`; HTML body; no `template` property                                 | As expected   | PASS   |
| TC-24 | `sendMidnightReport`                       | Preserve daily report subject/template/context              | recipient + reportData                                       | `MIDNIGHT_REPORT_SUBJECT`; `midnight-email-report`; context `{ emailData }`                                          | As expected   | PASS   |
| TC-25 | `sendLegacyMidnightReport`                 | Preserve legacy helper subject                              | recipient + reportData                                       | legacy subject `...Traders you're trying to connect with.`; `midnight-email-report`                                  | As expected   | PASS   |
| TC-26 | Transporter caching                        | Prove one transporter per profile is reused                 | Two consecutive support sends                                | No additional transport created; same cached support transporter                                                     | As expected   | PASS   |
| TC-27 | Missing profile env (boundary)             | Missing variables stay undefined; no cross-mailbox fallback | Fake env with only `EMAIL_SERVERHOST`                        | registration/payment auth user/pass `undefined`; port defaults to `587`; TLS verification on                         | As expected   | PASS   |
| TC-28 | Unknown profile (boundary)                 | Document unknown-profile behaviour                          | Fake env + profile `does-not-exist`                          | Falls back to support auth, matching historical default                                                              | As expected   | PASS   |
| TC-29 | Production TLS (security)                  | Production cannot disable verification for any profile      | `NODE_ENV=production`, `EMAIL_TLS_REJECT_UNAUTHORIZED=false` | `rejectUnauthorized: true` for support/registration/payment                                                          | As expected   | PASS   |
| TC-30 | Send failure (error resilience)            | SMTP failure rejects to caller instead of hanging           | Fake transporter returns `Error('smtp unavailable')`         | Promise rejects with the error; no unhandled rejection                                                               | As expected   | PASS   |

### B.3 Regression — `test/011-email-tls-verification.test.js`

All 15 pre-existing security tests were rerun unchanged after the update. They cover: verification enabled by default (production/empty env), production ignores opt-out, case-insensitive production matching, explicit non-production opt-out, malformed opt-out values, trimming, no insecure literal in source, shared secure config on every transport, centralized profile credential mapping, live child-process configuration, `.env.example` documentation, README documentation, and no credential logging.

**Result: 15 passed, 0 failed, 0 skipped.**

### B.4 Full regression suite

| Command                                      | Actual result                                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `npm test`                                   | **292 tests passed, 0 failed, 0 skipped, 0 cancelled** (≈14.7 s)                             |
| `node --test test/016-...`                   | 30 passed, 0 failed                                                                          |
| `node --test test/011-...`                   | 15 passed, 0 failed                                                                          |
| Combined focused run                         | 45 passed, 0 failed                                                                          |
| `npx prettier --check` (test evidence files) | All matched files use Prettier code style                                                    |
| Application source formatting                | Original line-ending/style preserved; not globally reformatted (avoids unrelated diff noise) |

Database-backed integration tests (e.g. business search) executed real queries during `npm test`; no database-dependent test was skipped.

---

## C. Test Execution Summary

| Metric                               | Count                              |
| ------------------------------------ | ---------------------------------- |
| Executed (focused task 016)          | 30                                 |
| Passed (task 016)                    | 30                                 |
| Failed (task 016)                    | 0                                  |
| Skipped (task 016)                   | 0                                  |
| Executed (regression 011)            | 15                                 |
| Passed (regression 011)              | 15                                 |
| Failed (regression 011)              | 0                                  |
| Full suite executed                  | 292                                |
| Full suite passed                    | 292                                |
| Full suite failed                    | 0                                  |
| Full suite skipped/blocked           | 0                                  |
| Prettier check (test evidence files) | PASS                               |
| Real SMTP send                       | NOT EXECUTED (see Remaining Risks) |

All numbers above are from actual executions in this review. No test results were inferred from code inspection.

---

## D. Defects Found

No release-blocking or non-blocking product defects were introduced by this change.

Observations (not defects introduced by the refactor):

1. **No real SMTP send performed.** Automated tests deliberately never open an SMTP connection. The production/staging credentials were not exercised, so delivery through the real SMTP server is unverified. This is an evidence gap, not a code defect.
2. **Support-message HTML is still unescaped.** This is the pre-existing behaviour, explicitly preserved by the task. Escaping would be a separate security decision.
3. **Some email routes do not respond on send failure.** `forgot-password.js` and `upload-file.js` historically only resend on success and merely log on failure; that contract is preserved. It remains a pre-existing reliability concern, not a regression.
4. **`sendEmailReportEveryMidnight` remains apparently unused.** Preserved as a compatibility wrapper as required; not deleted.

---

## E. Security and Regression Findings

### Security evidence

- `grep -rn "nodemailer.createTransport" app --include=*.js` → **1 match**, only `app/services/email.service.js`.
- `grep -rn "nodemailer-express-handlebars\|hbs(\|.use('compile'" app --include=*.js` → **only** `app/services/email.service.js`.
- `grep -rn "rejectUnauthorized" app --include=*.js` → only the guarded expression in `app/config/email.config.js`; **no `rejectUnauthorized: false`** anywhere.
- No `NODE_TLS_REJECT_UNAUTHORIZED` in application source.
- No email source logs `SUPPORT_RECEIVER_PASSWORD`, `EMAIL_PASSWORD`, or `PAYMENT_EMAIL_ADDRESS_PASSWORD`.
- No SMTP password is written to test output.
- Unknown profile names intentionally fall back to the historical support default; all service methods pass explicit known profiles, and missing env variables remain `undefined` rather than silently authenticating as another mailbox.
- Production `EMAIL_TLS_REJECT_UNAUTHORIZED=false` cannot disable verification for any profile.
- The raw-HTML support message uses `sendHtmlEmail` and omits `template`, so the shared Handlebars plugin cannot attempt to load a nonexistent template.

### Regression findings

- All original recipients (including hardcoded `allworldtrade.com@gmail.com`), subjects, templates, context shapes, `from` addresses, and credential profiles are preserved and asserted by tests.
- Legacy exports in `app/shared/email-template.js` are unchanged in name and argument shape; the contact controller requires no modification.
- Fire-and-forget behaviour is preserved with `.catch(...)` rejection handlers, avoiding unhandled promise rejections.
- The existing `EmailService` public API used by the cron job (`sendMidnightReportToClients`) is unchanged.
- No test was weakened or deleted. `test/011-email-tls-verification.test.js` retains all TLS assertions; its credential assertion now targets the centralized profiles.
- No unrelated application module, template, dependency, schema, or API contract was changed.

---

## F. Production Readiness Decision

**READY WITH CONDITIONS**

Rationale:

- All 292 automated tests passed with 0 failures and 0 skips.
- The task-specific consolidation and TLS regression suites pass (30 + 15).
- Static evidence proves the duplication was removed, TLS verification remains enforced, and no credentials are logged.
- No release-blocking defect was found in the reviewed scope.

Conditions:

1. A controlled staging/internal-mailbox smoke test of at least password-reset and registration-verification email remains to be performed. The automated tests intentionally do not contact SMTP.
2. Real production SMTP acceptance of each profile's `from` address was not re-verified (credentials/hosts not exercised).
3. Repository-wide `npm run lint` was not run because the configured script (`prettier --write .`) rewrites the whole repository and would create unrelated diff noise. Prettier check passed for the modified test artifacts; application source was deliberately left in its original repository style/line endings so the functional diff stays reviewable.

---

## G. Remaining Actions

1. In a safe staging environment, send one password-reset email and one registration-verification email to an internal mailbox, and confirm template rendering and sender/authentication mailbox.
2. Optionally verify the payment-profile `from` address is accepted by the production SMTP provider.
3. Review the final diff once more before commit and keep the suggested commit boundary from the task (config + service + tests, then route replacements, then test documentation).
4. Decide separately (not in this task) whether to escape the support-message HTML and whether to delete the apparently unused `sendEmailReportEveryMidnight` wrapper.
5. If the repository maintains a global formatting gate, run the project lint workflow in a dedicated commit rather than mixing it with this refactor.
