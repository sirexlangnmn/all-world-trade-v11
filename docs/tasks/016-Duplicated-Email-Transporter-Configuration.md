# AI Task: Consolidate Duplicated Nodemailer Transporter Configuration into the Shared EmailService

> **Finding:** `CODE_REVIEW.md` — Finding 16: Duplicated Email Transporter Configuration
> **Task file:** `docs/tasks/016-Duplicated-Email-Transporter-Configuration.md`
> **Severity:** Low (maintainability / reliability) in the `CODE_REVIEW.md` priority table (§ "Low Priority", item 23). Treat it as a behavior-preserving refactor, not a feature change.
> **Primary locations (verify line numbers against the live files):**
>
> - `app/services/email.service.js` (existing shared service; target of consolidation)
> - `app/config/email.config.js` (existing SMTP configuration module)
> - `app/routes/email-marketing.js` (4 inline transports)
> - `app/routes/forgot-password.js` (1 inline transport)
> - `app/routes/upload-file.js` (3 inline transports)
> - `app/shared/email-template.js` (4 inline transports)
> - `app/db_controllers/support_messages.controller.js` (1 inline transport)
>
> **Related work already completed:**
>
> - Finding 11 / `docs/tasks/011-TLS-Verification-Disabled-for-Email-Transport.md` centralized the TLS decision in `app/config/email.config.js` as `EMAIL_TLS_OPTIONS` and removed insecure `rejectUnauthorized: false`. Do not undo that work. This task must preserve the secure TLS behavior.
> - Finding 6 / `docs/tasks/006-No-Authentication-Middleware-on-API-Routes.md`, Finding 7 / `docs/tasks/007-No-Rate-Limiting.md`, and Finding 3 / `docs/tasks/003.2-plaintext-password-storage-on-reset.md` touch nearby email routes. Do not change authentication, rate limiting, or password-reset semantics while doing this refactor.
>
> **Production warning:** This codebase is running in production and currently works. This task must not change the recipient, sender, SMTP credentials, template name, subject, context shape, or response behavior of any existing email flow. The refactor is only about where the transporter and Handlebars compiler are created.

---

## 1. Task Title

**Consolidate every Nodemailer transporter and Handlebars configuration into one shared `EmailService`, with named SMTP credential profiles, while preserving every existing email's recipients, sender, subject, template, context, TLS settings, and API behavior.**

---

## 2. Objective

The objective is to:

1. Remove the repeated `nodemailer.createTransport(...)` and `transporter.use('compile', hbs(...))` boilerplate from every route/controller that sends email.
2. Route all outbound email through the existing `EmailService` in `app/services/email.service.js` or through thin compatibility wrappers that delegate to it.
3. Support the **three distinct SMTP credential sets** that already exist in the codebase without silently changing which account authenticates which email:
    - support mailbox: `SUPPORT_RECEIVER_EMAIL_ADDRESS` / `SUPPORT_RECEIVER_PASSWORD`
    - registration/password mailbox: `EMAIL_USER` / `EMAIL_PASSWORD`
    - payment mailbox: `PAYMENT_EMAIL_ADDRESS` / `PAYMENT_EMAIL_ADDRESS_PASSWORD`
4. Create each transporter and register the Handlebars compiler once per credential profile, not once per email send.
5. Preserve the existing secure TLS decision from `app/config/email.config.js` (`EMAIL_TLS_OPTIONS` / `EMAIL_CONFIG`).
6. Add regression tests that prove:
    - no email sender other than the shared service creates a Nodemailer transport,
    - every existing template/subject/context/from/auth combination is still produced,
    - the TLS behavior from Finding 11 is unchanged,
    - no SMTP credentials are logged.
7. Keep the existing public exports and route contracts working so callers do not need a large rewrite.

The expected end state is:

- `nodemailer.createTransport(...)` exists in one service module, configured from one config module.
- Handlebars is configured once per transporter profile, not in every function.
- Email behavior is byte-for-byte equivalent at the message-envelope and template level.
- Existing tests pass, including an appropriately updated `test/011-email-tls-verification.test.js`.
- A new focused test file proves the consolidation.

---

## 3. Problem / Finding

### 3.1 Finding as reported

`CODE_REVIEW.md` Finding 16 states:

- **Location:** `app/routes/email-marketing.js` (4 functions: `sendIntroductionEmail`, `sendEmailToTrader`, `sendEmailToClient`, `sendEmailToAllWorldTrade`) and `app/routes/forgot-password.js` (transport block near lines 100–121).
- **Current approach:** every email-sending function creates its own Nodemailer transporter and Handlebars configuration from scratch. The same boilerplate is repeated 5+ times:

```js
let transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVERHOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
        user: process.env.SUPPORT_RECEIVER_EMAIL_ADDRESS,
        pass: process.env.SUPPORT_RECEIVER_PASSWORD,
    },
    tls: { rejectUnauthorized: false },
});
const handlebarOptions = { ... };
transporter.use('compile', hbs(handlebarOptions));
```

- **Why this is suboptimal:** `EmailService` in `app/services/email.service.js` already creates a single transporter and configures Handlebars once. It is currently used only for midnight reports. The rest of the codebase ignores it and duplicates the configuration.
- **Recommended approach:** consolidate all email sending through the existing `EmailService` class. Add methods for each email type (introduction, notify-trader, notify-client, notify-AWT, forgot-password).
- **Why better:** single transporter, single Handlebars config, consistent TLS settings, easier to add email logging/rate limiting.

### 3.2 Verified current state (investigation result — do not treat as assumptions)

The finding under-counts the duplication. A repository search for `nodemailer.createTransport` in `app/` finds **13 inline transports** across **six files**:

| File                                                | Inline transports  | Credentials used                               | Notes                                           |
| --------------------------------------------------- | ------------------ | ---------------------------------------------- | ----------------------------------------------- |
| `app/services/email.service.js`                     | 1 (already shared) | support                                        | Already uses `EMAIL_CONFIG`; target pattern     |
| `app/shared/email-template.js`                      | 4                  | support                                        | Used by the client-contact controller           |
| `app/routes/email-marketing.js`                     | 4                  | support                                        | Introduction, trader, client, AWT notifications |
| `app/routes/forgot-password.js`                     | 1                  | registration (`EMAIL_USER` / `EMAIL_PASSWORD`) | Sends reset link                                |
| `app/routes/upload-file.js`                         | 3                  | registration ×2, payment ×1                    | Verification and payment emails                 |
| `app/db_controllers/support_messages.controller.js` | 1                  | support                                        | Sends raw HTML, not a Handlebars template       |

Each block also repeats the same `handlebarOptions` object and `transporter.use('compile', hbs(handlebarOptions))` call (except the support-message controller, which never registers Handlebars and therefore relies on `html`).

### 3.3 Why the duplication is a problem

- **Drift risk:** the TLS fix from Finding 11 had to be applied to every inline transport. A future security or SMTP change has to be repeated in six files.
- **Resource overhead:** a new transporter and a new Handlebars compiler are created for every send, including the introduction endpoint that sends one email per prospect.
- **Inconsistent behavior:** some senders configure Handlebars, one sends raw HTML, some define the `add` helper, most do not.
- **Harder observability:** logging, retry, and rate limiting cannot be added in one place.
- **Maintainability:** template/subject/context mappings are scattered and easy to break.

### 3.4 Explicit non-goals

This task is **not**:

- a redesign of the email templates,
- a change to SMTP credentials or environment variables,
- a change to the TLS policy,
- a rewrite of the password-reset or contact-request business logic,
- a new queueing system, retry system, or email provider integration,
- a change to any API response.

---

## 4. Affected Functionality

The following user-facing and operational flows send email:

| Flow                                | Entry point                                             | Current sender module                                                                                      | Primary template(s)                                                          |
| ----------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Registration email verification     | `POST /api/post/registration-email-verification`        | `app/routes/upload-file.js`                                                                                | `registration-email-verification`                                            |
| Resend registration verification    | `POST /api/post/resend-email-verification`              | `app/routes/upload-file.js`                                                                                | `registration-email-verification`                                            |
| Payment/trade-show information      | `POST /api/post/email-payment-account`                  | `app/routes/upload-file.js`                                                                                | `payment-account`                                                            |
| Password reset link                 | `POST /api/post/send-email-for-change-password`         | `app/routes/forgot-password.js`                                                                            | `request-for-change-password`                                                |
| Introduction to prospects           | `POST /api/post/emails/introduction`                    | `app/routes/email-marketing.js`                                                                            | `introduction2`                                                              |
| Notify trader of client contact     | `POST /api/post/emails/notify-trader-on-client-contact` | `app/routes/email-marketing.js`                                                                            | `notifyTraderOnClientContact`                                                |
| Notify client about trader          | same route / client-contact controller                  | `app/routes/email-marketing.js`, `app/shared/email-template.js`                                            | `notifyClientOnTraderTheyContact`                                            |
| Notify All World Trade of contact   | same route / client-contact controller                  | `app/routes/email-marketing.js`, `app/shared/email-template.js`                                            | `notifyAWTwhenClientConnectToTrader`, `notifyAWTwhenClientSentEmailToTrader` |
| Client sends direct email to trader | `POST /api/v3/post/submit-client-email-to-the-trader`   | `app/email_controllers/submit-client-email-to-the-trader.controller.js` via `app/shared/email-template.js` | `client-email-the-trader`                                                    |
| Help and suggestions                | support message controller                              | `app/db_controllers/support_messages.controller.js`                                                        | none (raw HTML)                                                              |
| Midnight daily activity report      | cron job                                                | `app/email_controllers/cron-email.controller.js` via `EmailService`                                        | `midnight-email-report`                                                      |

### Current flow

```text
HTTP route / cron job
        ↓
Route handler or controller
        ↓
Inline function creates nodemailer transport  ← duplicated 13 times
        ↓
Inline function registers Handlebars compiler ← duplicated 12 times
        ↓
transporter.sendMail(mailOptions, callback)
        ↓
SMTP server
```

### Target flow

```text
HTTP route / cron job
        ↓
Route handler or controller
        ↓
EmailService method (or compatibility wrapper delegating to EmailService)
        ↓
EmailService reuses a transporter + Handlebars compiler per credential profile
        ↓
EmailService.sendTemplatedEmail(...) / sendHtmlEmail(...)
        ↓
SMTP server
```

The coding agent must verify this flow against the live code before editing. Do not assume the table above is exhaustive; search again after changes.

---

## 5. Investigation Phase

This section is mandatory. Do **not** start editing until every item below has been inspected.

### 5.1 Files the coding agent must read

- `app/services/email.service.js`
- `app/config/email.config.js`
- `app/shared/email-template.js`
- `app/routes/email-marketing.js`
- `app/routes/forgot-password.js`
- `app/routes/upload-file.js` (email sections near lines 150–320)
- `app/db_controllers/support_messages.controller.js`
- `app/email_controllers/submit-client-email-to-the-trader.controller.js`
- `app/email_controllers/cron-email.controller.js`
- `app/config/email-recipients.config.js`
- `public/view/email/` (all `.handlebars` files)
- `test/011-email-tls-verification.test.js`
- `package.json`
- `README.md` sections on email configuration and architecture
- `CODE_REVIEW.md` Findings 11 and 16

### 5.2 Searches the coding agent must run

Run these before and after the implementation:

```bash
grep -rn "nodemailer.createTransport" app --include=*.js
grep -rn "nodemailer-express-handlebars\|hbs(" app --include=*.js
grep -rn "rejectUnauthorized" app --include=*.js
grep -rn "EMAIL_TLS_OPTIONS\|EMAIL_CONFIG" app --include=*.js
grep -rn "process.env.EMAIL_USER\|process.env.EMAIL_PASSWORD\|PAYMENT_EMAIL_ADDRESS\|SUPPORT_RECEIVER" app --include=*.js
grep -rn "sendEmailReportEveryMidnight\|emailTemplate\.\|sendMidnightReport" app --include=*.js
grep -rn "transporter.sendMail" app --include=*.js
```

### 5.3 Questions the investigation must answer

1. Which functions currently create a transporter, and with which credentials?
2. Which functions register Handlebars, and with which options/helpers?
3. Which templates are used by each function, and with which context shape?
4. Which `from` address is used by each function?
5. Which functions return a response to the caller, and on which success/failure branch?
6. Which calls are fire-and-forget, and which are awaited or callback-driven?
7. Which functions are actually used, and which appear dead (`sendEmailReportEveryMidnight` appears unused — confirm before deleting or keeping)?
8. Are there hidden recipients such as `allworldtrade.com@gmail.com` that must be preserved?
9. Does any caller depend on `EmailService`'s current constructor behavior (`transporter.verify()` at module load)?
10. Does any test assert that specific `process.env.*` names remain in specific files? (Yes: `test/011-email-tls-verification.test.js` does.)

### 5.4 Important discovered constraints

- **Three credential profiles exist.** Consolidation must not force all emails through the support mailbox. Doing so would break registration/password-reset and payment email authentication in production.
- **`app/shared/email-template.js` is not dead code.** It is imported by `app/email_controllers/submit-client-email-to-the-trader.controller.js`.
- **`sendEmailReportEveryMidnight` appears unused.** Do not delete it in this task without separate approval; keep it as a compatibility wrapper or mark it `TO INVESTIGATE`.
- **`app/db_controllers/support_messages.controller.js` sends raw HTML.** It sets a `template` property but never registers the Handlebars plugin, so the template property is ignored and `html` is sent. Do not accidentally turn this into a Handlebars send that requires a nonexistent `public/view/email/HELP AND SUGGESTIONS from: ...` file.
- **`app/routes/email-marketing.js` has fire-and-forget sends.** Converting them to awaited promises changes latency and error semantics. Preserve the existing non-blocking behavior, but attach rejection handlers to prevent unhandled promise rejections.
- **`app/routes/forgot-password.js` only responds on successful send.** Preserve the current response contract unless the task explicitly changes it.
- **`app/routes/upload-file.js` and `app/routes/forgot-password.js` use `EMAIL_USER` / `EMAIL_PASSWORD` but `from: process.env.EMAIL_SENDER_ADDRESS`.** Preserve that split.
- **`test/011-email-tls-verification.test.js` asserts `process.env.EMAIL_USER`, `process.env.PAYMENT_EMAIL_ADDRESS`, etc. still appear in the inline-transport files.** After consolidation those names move to `app/config/email.config.js`, so this test must be updated to assert the same security intent against the new location. Do not simply delete the test or its assertions.

---

## 6. File Impact Analysis

| File                                                                    | Role                                              | Action                                                              | Reason                                                                                                                                                                                           |
| ----------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/config/email.config.js`                                            | Central SMTP/TLS configuration                    | MODIFY                                                              | Add named credential profiles and reusable transport-config builder while keeping `EMAIL_CONFIG`, `EMAIL_TLS_OPTIONS`, `buildEmailTlsOptions`, and `isProductionEnvironment` backward compatible |
| `app/services/email.service.js`                                         | Existing shared email service                     | MODIFY                                                              | Add profile-aware transporter caching, Handlebars configuration per transporter, and methods for each existing email type                                                                        |
| `app/routes/email-marketing.js`                                         | Email marketing routes                            | MODIFY                                                              | Replace 4 inline transports with calls to the shared service; preserve subjects/templates/contexts/recipients                                                                                    |
| `app/routes/forgot-password.js`                                         | Password reset email                              | MODIFY                                                              | Replace inline transport with shared service; preserve registration credentials and `EMAIL_SENDER_ADDRESS`                                                                                       |
| `app/routes/upload-file.js`                                             | Verification and payment emails                   | MODIFY                                                              | Replace 3 inline transports with shared service; preserve the two profiles and `from` addresses                                                                                                  |
| `app/shared/email-template.js`                                          | Email helper functions                            | MODIFY                                                              | Replace 4 inline transports with compatibility wrappers that delegate to `EmailService`; preserve exported function names and argument shapes                                                    |
| `app/db_controllers/support_messages.controller.js`                     | Support/help email                                | MODIFY                                                              | Replace inline transport with shared service's HTML send; preserve raw HTML, subject, and response behavior                                                                                      |
| `app/email_controllers/submit-client-email-to-the-trader.controller.js` | Contact-email controller                          | REFERENCE ONLY                                                      | Confirms which `email-template.js` exports must keep working; do not change its behavior                                                                                                         |
| `app/email_controllers/cron-email.controller.js`                        | Midnight report cron                              | REFERENCE ONLY                                                      | Confirms the existing `EmailService` public API that must remain compatible                                                                                                                      |
| `app/config/email-recipients.config.js`                                 | Report recipient list                             | REFERENCE ONLY                                                      | Do not modify recipients                                                                                                                                                                         |
| `public/view/email/*.handlebars`                                        | Templates                                         | REFERENCE ONLY                                                      | Do not rename or edit templates                                                                                                                                                                  |
| `test/011-email-tls-verification.test.js`                               | Existing TLS acceptance tests                     | MODIFY                                                              | Update the "inline transport credentials" assertion to verify the new centralized profiles while preserving the security checks                                                                  |
| `test/016-email-service-consolidation.test.js`                          | New focused regression test                       | ADD                                                                 | Prove no duplicate transports remain and all template mappings are preserved                                                                                                                     |
| `test/016-Email-Service-Consolidation-Test-Result.md`                   | Test evidence (optional but consistent with repo) | ADD                                                                 | Record what was run and the results                                                                                                                                                              |
| `README.md`                                                             | Project documentation                             | MODIFY only if the email architecture description is now inaccurate | Do not change configuration semantics or reveal secrets                                                                                                                                          |

No database schema, migration, environment variable, dependency, or frontend change is required.

---

## 7. Current Implementation

### 7.1 Existing shared service

`app/services/email.service.js` currently:

- reads a single `EMAIL_CONFIG` from `app/config/email.config.js`,
- creates one transporter in the constructor,
- configures Handlebars once with the `add` helper,
- calls `transporter.verify()` at module load (non-blocking promise stored as `this.ready`),
- exposes `sendMidnightReport`, `sendMidnightReportToClients`, and `sendMail`.

It does not expose generic template sending or profile selection.

### 7.2 Current transport inventory (verified)

#### `app/shared/email-template.js` (support credentials)

| Export                                                          | Recipient                               | Template                               | Subject                                                    | Context         | `from`  |
| --------------------------------------------------------------- | --------------------------------------- | -------------------------------------- | ---------------------------------------------------------- | --------------- | ------- |
| `sendEmailToClient(receiverEmailAddress, emailData)`            | `receiverEmailAddress`                  | `notifyClientOnTraderTheyContact`      | `All World Trade - Traders you're trying to connect with.` | `{ emailData }` | support |
| `notifyAWTwhenClientSentEmailToTrader(emailData)`               | hardcoded `allworldtrade.com@gmail.com` | `notifyAWTwhenClientSentEmailToTrader` | `All World Trade - Client sent a message to a Trader`      | `{ emailData }` | support |
| `clientEmailTheTrader(emailData)`                               | `emailData.traderEmail`                 | `client-email-the-trader`              | `All World Trade - Client message you.`                    | `{ emailData }` | support |
| `sendEmailReportEveryMidnight(receiverEmailAddress, emailData)` | `receiverEmailAddress`                  | `midnight-email-report`                | `All World Trade - Traders you're trying to connect with.` | `{ emailData }` | support |

#### `app/routes/email-marketing.js` (support credentials)

| Function                                             | Recipient                               | Template                             | Subject                                                                                  | Context                        | `from`  |
| ---------------------------------------------------- | --------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------ | ------- |
| `sendIntroductionEmail(receiverEmailAddress, index)` | `receiverEmailAddress`                  | `introduction2`                      | `All World Trade - Introduction to AllWorldTrade platform for boosting market and sales` | none                           | support |
| `sendEmailToTrader(receiverEmailAddress, emailData)` | `receiverEmailAddress`                  | `notifyTraderOnClientContact`        | `All World Trade - Client tries to connect.`                                             | `{ emailData }`                | support |
| `sendEmailToClient(receiverEmailAddress, emailData)` | `receiverEmailAddress`                  | `notifyClientOnTraderTheyContact`    | `All World Trade - Traders you're trying to connect with.`                               | `{ emailData }`                | support |
| `sendEmailToAllWorldTrade(traderEmail, clientEmail)` | hardcoded `allworldtrade.com@gmail.com` | `notifyAWTwhenClientConnectToTrader` | `All World Trade - Client trying to connect to a Trader`                                 | `{ traderEmail, clientEmail }` | support |

#### `app/routes/forgot-password.js` (registration credentials)

| Handler                                         | Recipient                       | Template                      | Subject                       | Context                                        | `from`                 |
| ----------------------------------------------- | ------------------------------- | ----------------------------- | ----------------------------- | ---------------------------------------------- | ---------------------- |
| `POST /api/post/send-email-for-change-password` | `req.body.receiverEmailAddress` | `request-for-change-password` | `Request For Change Password` | `{ code: req.body.uuid, link: req.body.link }` | `EMAIL_SENDER_ADDRESS` |

Authentication uses `EMAIL_USER` / `EMAIL_PASSWORD`.

#### `app/routes/upload-file.js` (registration and payment credentials)

| Handler                                          | Recipient                                | Template                          | Subject                                            | Context                                           | Auth                                                       | `from`                  |
| ------------------------------------------------ | ---------------------------------------- | --------------------------------- | -------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------- | ----------------------- |
| `POST /api/post/registration-email-verification` | `req.body.email_or_social_media`         | `registration-email-verification` | `verification subject`                             | `{ code: Number(req.body.verification_code) }`    | `EMAIL_USER` / `EMAIL_PASSWORD`                            | `EMAIL_SENDER_ADDRESS`  |
| `POST /api/post/resend-email-verification`       | `req.session.registration_email_address` | `registration-email-verification` | `verification subject`                             | `{ code: Number(req.session.verification_code) }` | `EMAIL_USER` / `EMAIL_PASSWORD`                            | `EMAIL_SENDER_ADDRESS`  |
| `POST /api/post/email-payment-account`           | `req.body.email`                         | `payment-account`                 | `All World Trade - Trade Show Payment Information` | none                                              | `PAYMENT_EMAIL_ADDRESS` / `PAYMENT_EMAIL_ADDRESS_PASSWORD` | `PAYMENT_EMAIL_ADDRESS` |

#### `app/db_controllers/support_messages.controller.js` (support credentials)

| Sends                | Recipient                        | Subject                                     | Body                                    | `from`  |
| -------------------- | -------------------------------- | ------------------------------------------- | --------------------------------------- | ------- |
| Support/help message | `SUPPORT_RECEIVER_EMAIL_ADDRESS` | `HELP AND SUGGESTIONS from: <sender_email>` | raw HTML: sender email + sender message | support |

This sender does **not** register Handlebars. It must keep sending raw HTML, not a template.

### 7.3 Existing template files

The following files exist under `public/view/email/` and must be referenced with exactly these names:

`client-email-the-trader.handlebars`, `introduction.handlebars`, `introduction2.handlebars`, `midnight-email-report.handlebars`, `notifyAWTwhenClientConnectToTrader.handlebars`, `notifyAWTwhenClientSentEmailToTrader.handlebars`, `notifyClientOnTraderTheyContact.handlebars`, `notifyTraderOnClientContact.handlebars`, `payment-account.handlebars`, `registration-email-verification.handlebars`, `request-for-change-password.handlebars`.

### 7.4 Current problems in the code path

- `nodemailer.createTransport` and `hbs(...)` are repeated per send.
- The same template (`notifyClientOnTraderTheyContact`) and subject are duplicated in `email-marketing.js` and `email-template.js`.
- `sendEmailReportEveryMidnight` duplicates `EmailService.sendMidnightReport` and appears unused.
- There is no single place to add logging, retry, or rate limiting.
- `EMAIL_TLS_OPTIONS` is correctly shared, but the rest of the transport config is not.

---

## 8. Current → Target

## Current

```text
Every email function
  → nodemailer.createTransport({ host, port, secure, auth, tls })
  → hbs(handlebarOptions)
  → transporter.sendMail({ from, to, subject, template, context }, callback)
```

## Target

```text
Email function
  → emailService.send<SpecificEmail>(...)
      → getTransporter(profile)              // cached, created once per profile
      → Handlebars configured once per profile
      → sendTemplatedEmail({ from, to, subject, template, context })
```

### Preferred configuration shape (adapt to the existing code; do not copy blindly)

```js
// app/config/email.config.js
const EMAIL_PROFILES = {
    support: {
        auth: {
            user: process.env.SUPPORT_RECEIVER_EMAIL_ADDRESS,
            pass: process.env.SUPPORT_RECEIVER_PASSWORD,
        },
        from: process.env.SUPPORT_RECEIVER_EMAIL_ADDRESS,
    },
    registration: {
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,
        },
        from: process.env.EMAIL_SENDER_ADDRESS,
    },
    payment: {
        auth: {
            user: process.env.PAYMENT_EMAIL_ADDRESS,
            pass: process.env.PAYMENT_EMAIL_ADDRESS_PASSWORD,
        },
        from: process.env.PAYMENT_EMAIL_ADDRESS,
    },
};

function buildEmailTransportConfig(profileName = 'support', env = process.env) {
    const profile = EMAIL_PROFILES[profileName] ?? EMAIL_PROFILES.support;

    return {
        host: env.EMAIL_SERVERHOST,
        port: parseInt(env.EMAIL_PORT, 10) || 587,
        secure: false,
        auth: profile.auth,
        tls: buildEmailTlsOptions(env),
    };
}

const EMAIL_CONFIG = buildEmailTransportConfig('support');
```

**Compatibility note:** keep `EMAIL_CONFIG` exported and equal to the support profile so `test/011-email-tls-verification.test.js` and any existing `nodemailer.createTransport(EMAIL_CONFIG)` usage continue to work.

**Important:** do not silently fall back to support credentials when a profile's environment variables are missing. The current code would pass `undefined` credentials for that sender; preserve that behavior rather than sending mail from the wrong mailbox. If you add validation, it must be non-breaking and must not throw during module load in environments where a profile is unused.

### Preferred service shape (adapt to the existing code; do not copy blindly)

```js
class EmailService {
    constructor() {
        this.transporters = new Map();
        this.handlebarsConfigured = new Set();
    }

    getTransporter(profileName = 'support') {
        if (!this.transporters.has(profileName)) {
            const transporter = nodemailer.createTransport(buildEmailTransportConfig(profileName));
            this.configureHandlebars(transporter);
            this.transporters.set(profileName, transporter);
        }

        return this.transporters.get(profileName);
    }

    async sendTemplatedEmail({ profile = 'support', from, to, subject, template, context }) {
        return this._send(this.getTransporter(profile), { from, to, subject, template, context });
    }

    async sendHtmlEmail({ profile = 'support', from, to, subject, html }) {
        return this._send(this.getTransporter(profile), { from, to, subject, html });
    }
}
```

**Critical:** the raw-HTML support message must use `sendHtmlEmail` (no `template` property) because a `template` property is interpreted by the Handlebars plugin installed on the shared transporter.

**Do not** force one transporter for all profiles. That would break authentication. Use a cached transporter per profile.

---

## 9. Detailed Implementation Plan

### Step 1 — Inspect existing implementation and record the baseline

Read every file listed in §5 and produce a short written inventory (in the implementation report) of:

- every `nodemailer.createTransport` call,
- every template/subject/context/from/auth combination,
- every caller and response branch.

Do this before changing any file.

### Step 2 — Establish the behavioral contract

For each email flow, record the exact values that must remain unchanged:

- transport profile (auth credentials),
- `from`,
- `to` or recipient rule (including hardcoded recipients),
- `subject`,
- `template` name,
- `context` object shape,
- whether the send is awaited, callback-based, or fire-and-forget,
- what the HTTP handler sends on success and failure.

This contract is the acceptance baseline.

### Step 3 — Extend `app/config/email.config.js` with named profiles

Add:

- `EMAIL_PROFILES` for `support`, `registration`, and `payment`,
- `buildEmailTransportConfig(profileName, env)` that reuses `buildEmailTlsOptions(env)`,
- keep `EMAIL_CONFIG`, `EMAIL_TLS_OPTIONS`, `buildEmailTlsOptions`, `isProductionEnvironment`, `CLIENT_EMAIL_RECIPIENTS`, and `MIDNIGHT_REPORT_SUBJECT` exported,
- keep `EMAIL_CONFIG` equivalent to the support profile for backward compatibility.

Do not read, print, or change any secret value. Do not rename environment variables. Do not change the TLS policy.

### Step 4 — Extend `app/services/email.service.js`

Implement:

- cached transporter per profile (Map or equivalent),
- Handlebars configured once per transporter,
- generic `sendTemplatedEmail({ profile, from, to, subject, template, context })`,
- generic `sendHtmlEmail({ profile, from, to, subject, html })` for the support message,
- existing `sendMidnightReport` / `sendMidnightReportToClients` behavior preserved,
- a single `sendMail` implementation that logs success/failure without logging credentials.

Then add explicit methods for each flow. A safe mapping is:

| Method                                                           | Profile      | Template                               | Recipient/context rule                                                  |
| ---------------------------------------------------------------- | ------------ | -------------------------------------- | ----------------------------------------------------------------------- |
| `sendIntroductionEmail(to)`                                      | support      | `introduction2`                        | exact current subject; no context                                       |
| `sendTraderContactNotification(to, emailData)`                   | support      | `notifyTraderOnClientContact`          | `{ emailData }`                                                         |
| `sendClientContactNotification(to, emailData)`                   | support      | `notifyClientOnTraderTheyContact`      | `{ emailData }`                                                         |
| `sendAllWorldTradeContactNotification(traderEmail, clientEmail)` | support      | `notifyAWTwhenClientConnectToTrader`   | hardcoded `allworldtrade.com@gmail.com`; `{ traderEmail, clientEmail }` |
| `sendClientEmailToTrader(emailData)`                             | support      | `client-email-the-trader`              | `to: emailData.traderEmail`; `{ emailData }`                            |
| `sendAllWorldTradeClientEmailNotification(emailData)`            | support      | `notifyAWTwhenClientSentEmailToTrader` | hardcoded `allworldtrade.com@gmail.com`; `{ emailData }`                |
| `sendPasswordResetEmail({ to, uuid, link })`                     | registration | `request-for-change-password`          | `from: EMAIL_SENDER_ADDRESS`; `{ code: uuid, link }`                    |
| `sendRegistrationVerificationEmail({ to, code })`                | registration | `registration-email-verification`      | `from: EMAIL_SENDER_ADDRESS`; `{ code }`                                |
| `sendPaymentAccountEmail(to)`                                    | payment      | `payment-account`                      | `from: PAYMENT_EMAIL_ADDRESS`; no context                               |
| `sendSupportMessage({ senderEmail, senderMessage })`             | support      | none                                   | raw HTML; `to`/`from` = support address                                 |
| `sendMidnightReport(to, reportData)`                             | support      | `midnight-email-report`                | existing behavior                                                       |

Method names are suggestions. The important constraint is that every current template/subject/context/recipient combination has exactly one implementation.

Do not change `module.exports = emailService` (or its current shape) without checking every caller. `cron-email.controller.js` expects the instance methods directly.

### Step 5 — Replace inline transports in `app/routes/email-marketing.js`

- Remove `nodemailer` and `nodemailer-express-handlebars` imports if no longer used.
- Replace each inline transport/Handlebars block with the corresponding service call.
- Preserve the existing recipients, subjects, templates, and context shapes.
- Preserve fire-and-forget behavior for routes that do not await email. Attach `.catch(...)` and log the error so Node does not emit an unhandled rejection.
- Do not change the route response behavior.
- Do not invoke this endpoint against real prospects during testing (it sends to every prospect with a 2-second stagger).

### Step 6 — Replace the inline transport in `app/routes/forgot-password.js`

- Remove the inline transport and Handlebars setup.
- Call the registration-profile password-reset method.
- Preserve `from: EMAIL_SENDER_ADDRESS`, authentication with `EMAIL_USER` / `EMAIL_PASSWORD`, subject, template, and context.
- Preserve the current response behavior (send `'email sent'` only on success; keep logging on failure) unless a separate task changes it.
- Do not change rate limiting, token creation, token expiry, or token invalidation.

### Step 7 — Replace the three inline transports in `app/routes/upload-file.js`

- Verification and resend use the registration profile and `EMAIL_SENDER_ADDRESS`.
- Payment uses the payment profile and `PAYMENT_EMAIL_ADDRESS`.
- Preserve `Number(...)` conversion of verification codes if that is the current behavior.
- Preserve the `'email sent'` response on success.
- Do not change upload/multer behavior or any other route in this file.

### Step 8 — Replace the four inline transports in `app/shared/email-template.js`

- Keep the same exported function names and argument shapes:
    - `et.sendEmailToClient(receiverEmailAddress, emailData)`
    - `et.notifyAWTwhenClientSentEmailToTrader(emailData)`
    - `et.clientEmailTheTrader(emailData)`
    - `et.sendEmailReportEveryMidnight(receiverEmailAddress, emailData)`
- Each export should delegate to `EmailService`.
- Preserve the existing hardcoded recipient and template names.
- `sendEmailReportEveryMidnight` appears unused; keep it as a compatibility wrapper unless the user explicitly approves deletion.
- The contact controller must continue to work without edits.

### Step 9 — Replace the inline transport in `app/db_controllers/support_messages.controller.js`

- Use the shared service's raw-HTML send path.
- Keep `to` and `from` as the support address.
- Keep the subject exactly `'HELP AND SUGGESTIONS from: ' + sender_email`.
- Keep the existing HTML body construction and the existing database/response behavior.
- Do not add a `template` property; the message has no Handlebars file.
- Remove the now-unused `nodemailer` import.

### Step 10 — Update tests

1. Update `test/011-email-tls-verification.test.js`:
    - Keep all TLS assertions.
    - Replace the "each inline transport keeps its original SMTP credentials" assertion with an assertion that the centralized profiles in `app/config/email.config.js` reference the correct environment variables.
    - Update the "no application source disables certificate verification" expectations only if the file list changes; do not weaken the check.
    - Ensure the test still fails if someone reintroduces `rejectUnauthorized: false`.

2. Add `test/016-email-service-consolidation.test.js` covering:
    - only `app/services/email.service.js` contains `nodemailer.createTransport` in `app/`,
    - only `app/services/email.service.js` calls `hbs(` / `transporter.use('compile'`,
    - all expected templates still exist under `public/view/email/`,
    - the email config has exactly the three profiles and maps the expected environment variables,
    - no email source file logs a password variable,
    - static mapping assertions for each existing subject/template/context combination (read source or use a lightweight stub),
    - no behavior is tested by opening a real SMTP connection.

3. Add a test-result markdown file consistent with the repository convention if desired.

### Step 11 — Run the test suite and review the diff

- Run the focused tests first.
- Run `npm test` and report skips separately.
- Run `npm run lint`.
- Review the final diff for accidental template/recipient/subject/credential changes.
- Re-run the searches from §5.2 and confirm the expected counts.

### Step 12 — Manual smoke test (only if safe credentials/hosts are available)

- Send one password-reset email to an internal test mailbox through the existing route.
- Send one registration verification email to an internal test mailbox.
- Verify the template renders and the sender address matches the original.
- Do **not** call `/api/post/emails/introduction` against production prospects.
- If a real send is not possible, state that explicitly in the final report and rely on static/unit tests.

---

## 10. Architecture and Existing Patterns

The coding agent must prefer existing project patterns:

- **Service layer:** `app/services/email.service.js`, `app/services/analytics.service.js`, `app/services/password-reset.service.js`.
- **Central config:** `app/config/email.config.js`, `app/config/db.config.js`, `app/config/sequelize.config.js`.
- **Existing compatibility wrapper pattern:** keep the public shape of `app/shared/email-template.js` so callers do not need to change.
- **Existing TLS pattern:** `buildEmailTlsOptions` and `EMAIL_TLS_OPTIONS` from Finding 11.
- **Existing test style:** Node's built-in `node:test` + `node:assert/strict`, source-level assertions in `test/011-email-tls-verification.test.js`.

Do not introduce a new dependency, framework, architecture, queue, or design pattern when an appropriate existing project pattern already exists. Do not add `nodemailer` wrappers that duplicate the service. Do not create a second "email service" module.

### Reference-only examples

- `app/email_controllers/cron-email.controller.js` demonstrates the intended consumer style for `EmailService`.
- `app/email_controllers/submit-client-email-to-the-trader.controller.js` demonstrates the compatibility contract of `app/shared/email-template.js`.
- `test/011-email-tls-verification.test.js` demonstrates the expected level of static security assertions.

---

## 11. Security Requirements

Even though this is a maintainability task, the email path is security-sensitive.

### Must never happen

- Never hardcode, print, or commit SMTP passwords or API secrets.
- Never read, print, change, or rotate values from `.env`.
- Never disable TLS certificate verification.
- Never reintroduce `tls: { rejectUnauthorized: false }`.
- Never set `NODE_TLS_REJECT_UNAUTHORIZED`.
- Never send production email to real prospects/customers during automated tests.
- Never log `req.body` for password-reset or support endpoints if it can contain credentials or personal data.
- Never turn the raw-HTML support message into a Handlebars template that renders unescaped user input without review.
- Never change the recipient of a hardcoded internal notification.
- Never route a registration/payment email through the support credentials as a fallback.

### Must be validated

- Each service method uses the correct credential profile.
- Each service method uses the original `from` address.
- Each service method uses the original template and context shape.
- Each fire-and-forget promise has a rejection handler.
- Error logs contain no passwords or full message bodies with personal data.
- `EMAIL_TLS_OPTIONS` remains the source of TLS options in every transport.

### Attack cases to consider during review

- A malicious or malformed `to`/`receiverEmailAddress` should not change the SMTP connection or headers beyond what the current code does.
- A support-message sender email containing HTML should not become a new injection vector through the shared service. Preserve the current escaping/behavior; if you improve it, document it as a separate decision.
- A password-reset `link`/`uuid` content must be passed as Handlebars context, not concatenated into the template path or transport config.
- Do not expose SMTP errors containing credentials to HTTP clients.

---

## 12. Backward Compatibility

Preserve all of the following unless the task explicitly says otherwise:

- Existing API routes and HTTP methods.
- Existing response body strings and status codes (`'email sent'`, `'email sent'` for reset success, support-message response object, etc.).
- Existing request body/session field names.
- Existing rate limiters and middleware order.
- Existing SMTP hosts, ports, `secure: false`, auth credentials, and `from` addresses.
- Existing template names, subjects, and context object keys.
- Existing hardcoded internal recipients (`allworldtrade.com@gmail.com`).
- Existing `EmailService` public API used by the cron job.
- Existing `app/shared/email-template.js` exported function names and argument shapes.
- Existing `EMAIL_CONFIG`, `EMAIL_TLS_OPTIONS`, `buildEmailTlsOptions`, `isProductionEnvironment` exports.
- Existing `.env` and `.env.example` variable names.
- Existing behavior where some sends are fire-and-forget.
- Existing behavior where the support message uses raw HTML.

If any of these must change, stop and ask for approval rather than silently changing production behavior.

---

## 13. Testing Strategy

### Normal case

- Each email method produces the expected `{ from, to, subject, template, context }` object.
- Each method selects the expected credential profile.
- Midnight report methods still work through `sendMidnightReportToClients`.
- Password-reset and registration methods use `EMAIL_SENDER_ADDRESS`.

### Empty / missing input

- Missing recipient: behavior should match the current code (do not introduce a new crash).
- Missing template context keys: behavior should match the current code.
- Missing optional profile env vars: confirm no module-load crash; document the effective behavior.

### Boundary cases

- Empty string, very long email address, Unicode display name, special characters in the support message.
- Verification code as string vs number (preserve `Number(...)` conversion).
- `EMAIL_PORT` missing or non-numeric (the existing config defaults to 587; preserve).
- Both `introduction.handlebars` and `introduction2.handlebars` exist; ensure only `introduction2` is used by the introduction flow.

### Invalid input

- SMTP send failure: promise rejects; the caller logs it; no unhandled rejection; HTTP behavior matches the baseline.
- Template compile failure: logged, not exposed with secrets.
- Unknown profile name: decide and document; do not silently authenticate as support if that would change behavior.

### Security cases

- Static search proves no `rejectUnauthorized: false` and no inline `NODE_TLS_REJECT_UNAUTHORIZED`.
- Static search proves no password env var is logged.
- Static search proves no inline transporter remains.
- Confirm the support HTML sender does not accidentally require a template file.
- Confirm no real email is sent by the automated tests.

### Regression testing

- `node --test test/011-email-tls-verification.test.js`
- `node --test test/016-email-service-consolidation.test.js`
- `npm test` (report DB-dependent skips separately)
- `npm run lint`
- Manual smoke test for one real template if safe.
- Re-run all searches in §5.2.

---

## 14. Verification / Evidence

The coding agent must provide concrete evidence, not just "fixed".

Required evidence:

1. **Before/after searches**
    - Before: list of all 13 inline transports.
    - After: `grep -rn "nodemailer.createTransport" app --include=*.js` returns only the service (and any explicit config/test file if justified).
    - After: `grep -rn "hbs(" app --include=*.js` returns only the service.
    - After: `grep -rn "rejectUnauthorized" app --include=*.js` shows no insecure literal.

2. **Mapping table proof**
    - Show that each template/subject/context/from/auth combination from §7 is still produced by exactly one method.

3. **Test output**
    - Focused test results.
    - Full `npm test` result with skips called out.

4. **Diff review**
    - List every modified file and confirm no template, recipient, subject, credential, or route contract changed.

5. **Runtime evidence**
    - If a real SMTP send was possible, state which flow was used, which internal mailbox received it, and that the template rendered.
    - If not possible, state that explicitly and explain which static/unit evidence substitutes for it.

6. **Security evidence**
    - Search for similar inline transporter patterns in `app/` and confirm none remain.
    - Confirm no credentials are logged.

Do not claim success based only on the code compiling.

---

## 15. Do NOT Do

- Do not modify unrelated functionality.
- Do not rewrite the entire application.
- Do not introduce unnecessary dependencies.
- Do not add a new email library.
- Do not change the database schema.
- Do not change API contracts.
- Do not change email templates, subjects, recipients, or context keys.
- Do not change SMTP credentials, hosts, ports, `secure`, or TLS policy.
- Do not modify `.env` or `.env.example`.
- Do not disable or weaken security checks.
- Do not remove `test/011-email-tls-verification.test.js` or weaken its security assertions.
- Do not remove tests simply because they fail.
- Do not hide or suppress errors.
- Do not turn fire-and-forget sends into blocking awaits without approval.
- Do not call `/api/post/emails/introduction` against production prospects.
- Do not send test email to real customers.
- Do not delete `app/shared/email-template.js`; it has live callers.
- Do not delete `sendEmailReportEveryMidnight` in this task without separate approval.
- Do not convert the raw-HTML support message into a Handlebars template.
- Do not change the hardcoded `allworldtrade.com@gmail.com` recipient.
- Do not change password-reset token, rate-limit, or authentication logic.

---

## 16. Acceptance Criteria

## Acceptance Criteria

- [ ] All existing inline Nodemailer transports in `app/` were identified and removed, except the one inside the shared service.
- [ ] `app/config/email.config.js` exposes named `support`, `registration`, and `payment` profiles using the original environment variables.
- [ ] `EMAIL_CONFIG`, `EMAIL_TLS_OPTIONS`, `buildEmailTlsOptions`, and `isProductionEnvironment` remain exported and compatible.
- [ ] `app/services/email.service.js` caches one transporter per profile and configures Handlebars once per transporter.
- [ ] Every existing email flow has a single method or compatibility wrapper that preserves its recipient, `from`, subject, template, context, and credentials.
- [ ] `app/shared/email-template.js` keeps its exported function names and argument shapes and delegates to the shared service.
- [ ] `app/email_controllers/submit-client-email-to-the-trader.controller.js` works without modification.
- [ ] `app/email_controllers/cron-email.controller.js` works without modification.
- [ ] The support message still sends raw HTML to and from the support address with the same subject.
- [ ] Fire-and-forget sends have rejection handlers and do not cause unhandled promise rejections.
- [ ] No SMTP password or secret is logged.
- [ ] No `rejectUnauthorized: false` or `NODE_TLS_REJECT_UNAUTHORIZED` exists in application source.
- [ ] `test/011-email-tls-verification.test.js` still passes after being updated for the new centralized location.
- [ ] A new regression test proves no duplicate transporters remain and template mappings are preserved.
- [ ] Full `npm test` results are reported, including skips.
- [ ] `npm run lint` passes (or only formatting changes are applied).
- [ ] No unrelated files were modified.
- [ ] Final diff was reviewed.
- [ ] Remaining risks are documented.

---

## 17. Expected Final Report

The coding agent must finish with this structure:

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

Explain the important changes, including:

- the named SMTP profiles and which flows use each,
- the transporter caching strategy,
- how the raw-HTML support message is handled,
- how fire-and-forget sends avoid unhandled rejections,
- how `app/shared/email-template.js` compatibility was preserved.

## Email Behavior Mapping

| Flow | Profile | From | To  | Subject | Template | Context | Preserved |
| ---- | ------- | ---- | --- | ------- | -------- | ------- | --------- |
| ...  | ...     | ...  | ... | ...     | ...      | ...     | YES/NO    |

## Testing

| Test                                   | Result                 |
| -------------------------------------- | ---------------------- |
| Normal case                            | PASS/FAIL              |
| Edge case                              | PASS/FAIL              |
| Security case                          | PASS/FAIL              |
| Regression test (`test/011...`)        | PASS/FAIL              |
| New consolidation test (`test/016...`) | PASS/FAIL              |
| `npm test`                             | PASS/FAIL (skips: ...) |
| `npm run lint`                         | PASS/FAIL              |

## Verification

Explain how the original duplication was verified as removed:

- before/after transporter counts,
- before/after `hbs` counts,
- no insecure TLS literal,
- no credential logging,
- template existence/mapping checks,
- real send evidence or why it was not possible.

## Remaining Risks

List anything that could not be verified, including:

- whether real SMTP credentials were available,
- whether all production templates rendered,
- any unused/dead email function that was preserved but not exercised,
- any behavior that depends on the production SMTP server.

## Final Status

PASS / NEEDS REVIEW
```

---

## 18. Open Questions / TO INVESTIGATE

The coding agent must resolve or explicitly document these before finishing:

- `TO INVESTIGATE`: Confirm whether `app/shared/email-template.js`'s `sendEmailReportEveryMidnight` is truly unused. It appears unused in `grep`, but keep it as a compatibility wrapper unless the user approves deletion.
- `TO INVESTIGATE`: Confirm whether `introduction.handlebars` is used anywhere. The current introduction flow uses `introduction2.handlebars`; do not switch templates.
- `TO INVESTIGATE`: Confirm whether any external script or manual process calls the exported `email-template.js` functions directly. Preserve all exports regardless.
- `TO INVESTIGATE`: Confirm whether the production SMTP account accepts the `from` address currently used for each profile. Do not change it; only verify.
- `TO INVESTIGATE`: Confirm whether `EmailService`'s constructor-time `transporter.verify()` should remain as-is. For behavior preservation, keep the existing support-profile verification unless there is a compelling, separately approved reason to change it. Additional profile transporters should be created lazily to avoid opening unnecessary SMTP connections at boot.
- `TO INVESTIGATE`: Confirm whether the support-message HTML body should be escaped. This task preserves current behavior; any change is a separate security fix.

---

## 19. Suggested Commit Boundary

Keep the change reviewable:

1. Config profiles + service methods + tests.
2. Route/controller replacements.
3. Test updates and test result documentation.

Do not mix unrelated formatting, dependency upgrades, template edits, or password-reset behavior changes into this work.
