# Implementation Report — Finding 16: Duplicated Email Transporter Configuration

> **Note:** This is the earlier implementation report. The authoritative, re-executed test evidence (including the expanded 30-case consolidation suite and the full 292-test run) is in `test/016-Duplicated-Email-Transporter-Configuration-Test-Result.md`.

**Date:** 2026-11-02
**Branch:** `feature/016-Duplicated-Email-Transporter-Configuration`
**Task:** `docs/tasks/016-Duplicated-Email-Transporter-Configuration.md`
**Environment:** Node.js `v24.19.0`, npm `12.2.1`, Nodemailer `7.x`, Prettier `3.8.0`
**Database:** Configured database was reachable; the full suite ran its integration cases (no skips).

---

## Summary

All inline Nodemailer transports and Handlebars registrations under `app/` were consolidated into `app/services/email.service.js`. The service now caches one transporter per credential profile (`support`, `registration`, `payment`) and configures Handlebars once per transporter. Every existing email flow keeps its original recipient, sender, subject, template, context shape, credentials, and response behavior.

`app/shared/email-template.js` keeps its exported function names and argument shapes as compatibility wrappers that delegate to the service. The raw-HTML support message continues to use HTML (not a Handlebars template). Fire-and-forget sends attach rejection handlers so they cannot produce unhandled promise rejections.

No templates, environment variables, dependencies, database schema, routes, or API response contracts were changed.

---

## Files Modified

| File                                                | Changes                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/config/email.config.js`                        | Added `buildEmailProfiles`, named `EMAIL_PROFILES` (`support`, `registration`, `payment`), and `buildEmailTransportConfig`. Kept `EMAIL_CONFIG`, `EMAIL_TLS_OPTIONS`, `buildEmailTlsOptions`, and `isProductionEnvironment` compatible. `EMAIL_CONFIG` remains the support-profile transport. |
| `app/services/email.service.js`                     | Added cached transporters per profile, one Handlebars registration per transporter, generic `sendTemplatedEmail` / `sendHtmlEmail`, and one method per existing email flow. Existing midnight-report methods remain.                                                                          |
| `app/routes/email-marketing.js`                     | Removed 4 inline transports; calls the shared service. Preserved recipients, subjects, templates, contexts, fire-and-forget behavior, and logging.                                                                                                                                            |
| `app/routes/forgot-password.js`                     | Removed inline registration-profile transport; calls `sendPasswordResetEmail`. Preserved `from`, subject, template, context, and the success-only response.                                                                                                                                   |
| `app/routes/upload-file.js`                         | Removed 3 inline transports; verification/resend use the registration profile, payment uses the payment profile. Preserved `Number(...)` code conversion and responses.                                                                                                                       |
| `app/shared/email-template.js`                      | Replaced 4 inline transports with compatibility wrappers that delegate to the service. All four exports and argument shapes preserved.                                                                                                                                                        |
| `app/db_controllers/support_messages.controller.js` | Removed inline transport; calls `sendSupportMessage`. Raw HTML, subject, support `to`/`from`, non-blocking behavior, and database response preserved.                                                                                                                                         |
| `test/011-email-tls-verification.test.js`           | Updated the credential assertion to verify the centralized profiles and kept all TLS security assertions.                                                                                                                                                                                     |

## Files Added

| File                                                  | Purpose                                                                             |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `test/016-email-service-consolidation.test.js`        | Regression tests proving no duplicate transports remain and mappings are preserved. |
| `test/016-Email-Service-Consolidation-Test-Result.md` | This implementation and test evidence report.                                       |

## Files Deleted

| File | Reason                                |
| ---- | ------------------------------------- |
| None | No live module or export was deleted. |

## Files Referenced Only

| File                                                                    | Why                                                                    |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `app/email_controllers/submit-client-email-to-the-trader.controller.js` | Confirms the `email-template.js` compatibility contract; not modified. |
| `app/email_controllers/cron-email.controller.js`                        | Confirms the existing `EmailService` public API; not modified.         |
| `app/config/email-recipients.config.js`                                 | Recipient list unchanged.                                              |
| `public/view/email/*.handlebars`                                        | Template names and contents unchanged.                                 |

---

## Implementation Details

### Credential profiles

| Profile        | Auth environment variables                                    | From address                     |
| -------------- | ------------------------------------------------------------- | -------------------------------- |
| `support`      | `SUPPORT_RECEIVER_EMAIL_ADDRESS`, `SUPPORT_RECEIVER_PASSWORD` | `SUPPORT_RECEIVER_EMAIL_ADDRESS` |
| `registration` | `EMAIL_USER`, `EMAIL_PASSWORD`                                | `EMAIL_SENDER_ADDRESS`           |
| `payment`      | `PAYMENT_EMAIL_ADDRESS`, `PAYMENT_EMAIL_ADDRESS_PASSWORD`     | `PAYMENT_EMAIL_ADDRESS`          |

A missing environment variable stays `undefined` for that profile; it does not fall back to another mailbox. Unknown profile names resolve to the historical support default and are documented in the config.

### Transporter caching

`EmailService` keeps a `Map` of transporters keyed by profile and a `Set` of profiles whose Handlebars compiler is already registered. `getTransporter(profile)` creates and configures a transporter lazily, once per profile. The constructor still verifies the support transporter at startup, preserving the previous `this.ready` behavior.

### Raw-HTML support message

`sendSupportMessage` uses `sendHtmlEmail`, which never sets a `template` property. This prevents the Handlebars plugin from trying to load a nonexistent template named after the sender.

### Fire-and-forget sends

Routes and wrappers that historically did not await email keep the same non-blocking behavior and attach `.catch(...)` so SMTP failures are logged without becoming unhandled rejections.

### Compatibility

`app/shared/email-template.js` still exports `sendEmailToClient`, `notifyAWTwhenClientSentEmailToTrader`, `clientEmailTheTrader`, and `sendEmailReportEveryMidnight` with the original argument shapes. The contact controller works without modification.

---

## Email Behavior Mapping

| Flow                              | Profile      | From                    | To                            | Subject                                                                                | Template                               | Context                        | Preserved |
| --------------------------------- | ------------ | ----------------------- | ----------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------ | --------- |
| Introduction                      | support      | support address         | recipient                     | All World Trade - Introduction to AllWorldTrade platform for boosting market and sales | `introduction2`                        | none                           | YES       |
| Notify trader of client contact   | support      | support address         | trader email                  | All World Trade - Client tries to connect.                                             | `notifyTraderOnClientContact`          | `{ emailData }`                | YES       |
| Notify client about trader        | support      | support address         | client email                  | All World Trade - Traders you're trying to connect with.                               | `notifyClientOnTraderTheyContact`      | `{ emailData }`                | YES       |
| Notify All World Trade of contact | support      | support address         | `allworldtrade.com@gmail.com` | All World Trade - Client trying to connect to a Trader                                 | `notifyAWTwhenClientConnectToTrader`   | `{ traderEmail, clientEmail }` | YES       |
| Client sends direct email         | support      | support address         | `emailData.traderEmail`       | All World Trade - Client message you.                                                  | `client-email-the-trader`              | `{ emailData }`                | YES       |
| Notify All World Trade of email   | support      | support address         | `allworldtrade.com@gmail.com` | All World Trade - Client sent a message to a Trader                                    | `notifyAWTwhenClientSentEmailToTrader` | `{ emailData }`                | YES       |
| Password reset link               | registration | `EMAIL_SENDER_ADDRESS`  | `receiverEmailAddress`        | Request For Change Password                                                            | `request-for-change-password`          | `{ code: uuid, link }`         | YES       |
| Registration verification         | registration | `EMAIL_SENDER_ADDRESS`  | `email_or_social_media`       | verification subject                                                                   | `registration-email-verification`      | `{ code }`                     | YES       |
| Resend verification               | registration | `EMAIL_SENDER_ADDRESS`  | session registration email    | verification subject                                                                   | `registration-email-verification`      | `{ code }`                     | YES       |
| Payment/trade-show information    | payment      | `PAYMENT_EMAIL_ADDRESS` | `req.body.email`              | All World Trade - Trade Show Payment Information                                       | `payment-account`                      | none                           | YES       |
| Support/help message              | support      | support address         | support address               | `HELP AND SUGGESTIONS from: <sender_email>`                                            | none (raw HTML)                        | n/a                            | YES       |
| Midnight report                   | support      | support address         | configured client recipients  | All World Trade - Daily Activity Report                                                | `midnight-email-report`                | `{ emailData }`                | YES       |
| Legacy midnight helper            | support      | support address         | caller-provided recipient     | All World Trade - Traders you're trying to connect with.                               | `midnight-email-report`                | `{ emailData }`                | YES       |

---

## Testing

| Test                                                                    | Result                                                    |
| ----------------------------------------------------------------------- | --------------------------------------------------------- |
| Normal case — template/subject/context mapping                          | PASS                                                      |
| Edge case — missing optional profile variables                          | PASS (no module-load crash; credentials remain undefined) |
| Security case — TLS verification / no password logging                  | PASS                                                      |
| Regression test (`test/011-email-tls-verification.test.js`)             | PASS (15/15)                                              |
| New consolidation test (`test/016-email-service-consolidation.test.js`) | PASS (13/13)                                              |
| `npm test`                                                              | PASS (275 passed, 0 failed, 0 skipped)                    |
| `npm run lint` equivalents (`npx prettier --check` on changed files)    | PASS after applying Prettier to the changed files only    |

---

## Verification

- Before: `grep -rn "nodemailer.createTransport" app --include=*.js` found **13 inline transports across 6 files** (1 already in the service).
- After: only `app/services/email.service.js` contains `nodemailer.createTransport`.
- Before: `hbs(...)` / `transporter.use('compile', ...)` existed in 6 files.
- After: only `app/services/email.service.js` registers Handlebars.
- `grep -rn "transporter.sendMail" app --include=*.js` returns no inline direct sends; all sends go through `EmailService`.
- `grep -rn "rejectUnauthorized" app --include=*.js` returns only the guarded expression in `app/config/email.config.js`; there is no `rejectUnauthorized: false`.
- No email source logs `SUPPORT_RECEIVER_PASSWORD`, `EMAIL_PASSWORD`, or `PAYMENT_EMAIL_ADDRESS_PASSWORD`.
- All expected templates exist under `public/view/email/`.
- No real SMTP connection is opened by the automated tests.

---

## Remaining Risks

1. **No real email send was performed.** The production SMTP account was not used for a test send; verification relies on static assertions and the existing full suite. A controlled staging send remains the final runtime check.
2. **`sendEmailReportEveryMidnight` is preserved as a compatibility wrapper but remains apparently unused.** It was not deleted per the task constraints.
3. **Unknown profile names fall back to the support profile**, matching the historical default transport. Service methods always pass a known profile.
4. **SMTP provider acceptance of each `from` address was not re-verified** because production credentials/hosts were not exercised.
5. **Support-message HTML escaping is unchanged** (still the pre-existing raw interpolation). Any escaping change is a separate security decision.
6. **Repository-wide `npm run lint` was not run** because the existing script reformats the entire repository in write mode and would create unrelated diff noise. Prettier was applied only to files changed by this task.

---

## Final Status

**PASS WITH CONDITIONS** — consolidation and regression evidence are complete; a controlled staging email send remains to be confirmed.
