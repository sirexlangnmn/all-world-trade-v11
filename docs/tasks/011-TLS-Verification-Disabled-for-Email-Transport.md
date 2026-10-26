# AI Task: Re-enable TLS Certificate Verification for All Nodemailer Email Transports

> **Finding:** `CODE_REVIEW.md` — Finding 11: TLS Verification Disabled for Email Transport
> **Task file:** `docs/tasks/011-TLS-Verification-Disabled-for-Email-Transport.md`
> **Severity:** Low in the `CODE_REVIEW.md` priority table (§ "Medium Priority", item 16), but the impact is credential/content interception on the SMTP path. Treat it as a real transport-security defect, not cosmetic cleanup.
> **Primary location:** `app/config/email.config.js:13-15` (line numbers will drift — verify against the live files)
> **Related findings and tasks:**
>
> - Finding 16 — duplicated email transporter configuration. This task deliberately does **not** perform the full `EmailService` consolidation; it only centralizes the TLS decision so every transport stops disabling verification. Do not expand scope into Finding 16.
> - Finding 8 / `docs/tasks/008-Weak-Default-Secrets-in-Environment.md` — do not read, print, rotate, or change SMTP credentials here.
> - Finding 10 / `docs/tasks/010-Helmet-Security-Headers-Disabled.md` — unrelated HTTP-layer headers; do not touch.
> - Finding 12 — file-upload validation; unrelated.

> **Status warning:** This codebase is running in production and currently works. Removing `rejectUnauthorized: false` can make every outgoing email fail if the production SMTP endpoint presents a certificate that Node cannot validate (self-signed, expired, wrong hostname, or missing intermediate chain). This is a **safe-by-default** change only if the SMTP certificate is validated before rollout. Do not deploy the change until the SMTP endpoint's certificate chain has been checked (see §9, Step 1) and an email has been sent successfully from the environment.

---

## 1. Task Title

**Remove `tls: { rejectUnauthorized: false }` from every Nodemailer transport, make certificate verification the default in all environments, and provide an explicit, production-disabled developer escape hatch for self-signed local SMTP without weakening production.**

---

## 2. Objective

The objective is to:

1. Eliminate every occurrence of `rejectUnauthorized: false` on Nodemailer transports in `app/`.
2. Make `rejectUnauthorized: true` (Nodemailer/Node default) the effective value in production and every non-development environment.
3. Preserve every existing email flow and message payload:
    - password reset (`/api/post/send-email-for-change-password`)
    - registration verification and resend
    - payment account email
    - introduction email
    - contact/trader/client notification emails
    - help-and-support/support message email
    - midnight activity report through `EmailService`
4. Avoid duplicating the TLS decision across six files. Centralize it in the existing email configuration module so future transports cannot silently re-introduce the vulnerability.
5. If (and only if) local development genuinely uses a self-signed SMTP certificate, allow an explicit opt-out that:
    - defaults to secure verification,
    - is ignored in production,
    - requires an explicit environment flag rather than relying on a typo-prone `NODE_ENV` comparison.
6. Prove the fix with:
    - a repository-wide search showing no insecure literal remains in the production path,
    - unit/source tests that fail if the insecure value returns,
    - a real `transporter.verify()` and one real email send in the target environment where credentials are available.

The expected end state is:

- No Nodemailer transport in `app/` disables TLS certificate validation by default.
- Production cannot disable verification via environment variables.
- Email sending still works against the production SMTP server.
- A documented, tested escape hatch exists only for local development if needed.

---

## 3. Problem / Finding

### 3.1 Finding as reported

`CODE_REVIEW.md` Finding 11 says:

- **Location:** `app/config/email.config.js:14`, `app/routes/forgot-password.js:108-110`, `app/routes/email-marketing.js` (multiple functions).
- All Nodemailer transport configurations include:

```js
tls: {
    rejectUnauthorized: false;
}
```

- **Why this is unsafe:** disabling TLS certificate verification allows man-in-the-middle attacks on SMTP connections. An attacker on the network path can intercept email credentials and content.
- **Recommended approach:** remove `rejectUnauthorized: false`; conditionally disable verification only in development if self-signed certificates are used.
- **Suggested implementation snippet:**

```js
tls: {
    rejectUnauthorized: process.env.NODE_ENV !== 'production';
}
```

### 3.2 Current repository state — verified before writing this guide, re-verify before editing

The finding understates the blast radius. The insecure literal appears in **six files and fourteen transport constructions**, not three files. Search the live repository yourself; do not trust these line numbers.

| #   | File                                                | Approx. lines                    | Purpose                                                               |
| --- | --------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------- |
| 1   | `app/config/email.config.js`                        | 13-15                            | Shared `EMAIL_CONFIG` used by `EmailService` (midnight report)        |
| 2   | `app/routes/email-marketing.js`                     | 87-89, 173-175, 226-228, 280-282 | Introduction, notify trader, notify client, notify AWT (4 transports) |
| 3   | `app/routes/forgot-password.js`                     | 110-112                          | Password-reset email                                                  |
| 4   | `app/routes/upload-file.js`                         | 1717-1719, 1780-1782, 1836-1838  | Registration verification, resend verification, payment email (3)     |
| 5   | `app/shared/email-template.js`                      | 17-19, 71-73, 123-125, 179-181   | Client, AWT, trader, midnight-report helpers (4)                      |
| 6   | `app/db_controllers/support_messages.controller.js` | 45-47                            | Help-and-support / suggestion email                                   |

Total: **14 occurrences of `rejectUnauthorized: false`** in application code.

Other observed facts (re-verify, do not treat as permanent):

| Fact                                                                                                   | Implication                                                                                                       |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `EMAIL_CONFIG` in `app/config/email.config.js` already exists                                          | Centralize the TLS option there; do not invent a new config module.                                               |
| `app/services/email.service.js` consumes `EMAIL_CONFIG`                                                | Fixing `EMAIL_CONFIG` fixes the shared service without editing `email.service.js`.                                |
| Most route-level transports do **not** use `EMAIL_CONFIG`                                              | They build their own transport object; each must be updated or made to use a shared TLS option.                   |
| Transport credentials differ by flow                                                                   | Preserve `SUPPORT_RECEIVER_*`, `EMAIL_USER`/`EMAIL_PASSWORD`, and `PAYMENT_EMAIL_ADDRESS*` exactly.               |
| Inline transports hardcode `secure: false`                                                             | Do not change `secure` in this task unless a separate, explicit decision is documented.                           |
| `EMAIL_SECURE` is documented in `README.md`/`.env.example`                                             | It is currently not read by the email code. Do not start using it here; that is an adjacent behavior change.      |
| Nodemailer is `^7.0.12`                                                                                | Node's TLS defaults apply. `rejectUnauthorized` defaults to `true`.                                               |
| `NODE_ENV` is `nonprod` in `.env.example` and `production` is the production value described in README | A literal `NODE_ENV !== 'production'` check can fail open if an environment is misconfigured. Prefer fail-closed. |
| Tests use `node:test` and source-reading assertions                                                    | A focused test can scan `app/` for the insecure literal and test the config builder directly.                     |

### 3.3 Why the current implementation is unsafe

TLS without certificate verification provides encryption but **no authentication of the peer**. An attacker who can intercept or redirect traffic to the SMTP host can present any certificate, complete the TLS handshake, and then:

- capture SMTP username and password,
- read email contents (password-reset tokens, verification codes, contact messages, payment details),
- relay or modify messages.

This is especially serious for this application because email flows carry:

- password-reset links and reset tokens,
- registration verification codes,
- prospect/client/trader contact data,
- payment account information.

Disabling verification globally also masks real certificate problems (expired certificate, wrong hostname, missing intermediate certificate) that should be fixed at the server or configuration level.

---

## 4. Affected Functionality

### 4.1 Functional flow

All affected code follows the same shape:

```text
HTTP request or cron trigger
   ↓
Route handler / controller / shared helper
   ↓
nodemailer.createTransport({ host, port, secure, auth, tls })
   ↓
TLS handshake with SMTP server (STARTTLS or SMTPS)
   ↓
SMTP authentication
   ↓
sendMail(template, context)
   ↓
Recipient inbox
```

The change is at the transport construction step only. Routes, templates, database queries, session handling, rate limiters, and response bodies must remain unchanged.

### 4.2 In-scope email flows

- `/api/post/send-email-for-change-password` — `app/routes/forgot-password.js`
- `/api/post/registration-email-verification` — `app/routes/upload-file.js`
- `/api/post/resend-email-verification` — `app/routes/upload-file.js`
- `/api/post/email-payment-account` — `app/routes/upload-file.js`
- `/api/post/emails/introduction` — `app/routes/email-marketing.js`
- `/api/post/emails/notify-trader-on-client-contact` — `app/routes/email-marketing.js` (three sends)
- `/api/v3/post/submit-client-email-to-the-trader` — controller delegates to `app/shared/email-template.js`
- Support/help form email — `app/db_controllers/support_messages.controller.js`
- Midnight activity report cron — `app/services/email.service.js` via `EMAIL_CONFIG`

### 4.3 Explicitly out of scope

Do not expand this task into unrelated findings unless a change is strictly required to make TLS verification safe:

- Consolidating all transports into `EmailService` (Finding 16).
- Changing SMTP credentials, auth users, recipients, subjects, templates, or HTML content.
- Changing `secure: false` to `true`, or introducing `requireTLS`, as part of this task. Record these as follow-ups.
- Rotating secrets (Finding 8).
- Adding rate limiting or authentication (Findings 6/7).
- File-upload validation (Finding 12).
- Global email retry/logging architecture.
- Changing `.env`, committing secrets, or printing credentials.
- Rewriting `CODE_REVIEW.md`.

---

## 5. Investigation Phase

Complete this phase before editing any code.

### 5.1 Read project context

Read:

1. `README.md` §12 Authentication & Security, §13 Deployment Architecture, §14 Environment Configuration, §19 Testing Strategy.
2. `AGENTS.md` — especially the email conventions, two data-access stacks, environment variable rules, and "do not break production" instruction.
3. `CODE_REVIEW.md` Finding 11 and Finding 16 (to understand the boundary).
4. This task file completely.

### 5.2 Establish a clean baseline

Run:

```bash
git status
git diff --stat
git log --oneline -10
```

The worktree may already contain changes from earlier findings (Helmet, auth middleware, rate limiting, etc.). **Do not revert, overwrite, reformat, or "clean up" unrelated work.** Preserve it and keep your diff scoped to this task.

### 5.3 Inventory every transport

Run from the repository root:

```bash
grep -RIn "createTransport\|rejectUnauthorized\|requireTLS\|secure:" app --include='*.js'
```

Confirm each hit against §3.2. Search for all of the following, not only the files named in the finding:

- `nodemailer.createTransport`
- `rejectUnauthorized`
- `tls:`
- `EMAIL_CONFIG`
- `SUPPORT_RECEIVER_EMAIL_ADDRESS`
- `EMAIL_USER`
- `PAYMENT_EMAIL_ADDRESS`
- `EmailService`
- `shared/email-template`

Also check whether any transport is constructed indirectly (for example, a helper that returns options) and whether any test or script constructs a transport.

### 5.4 Inspect the existing configuration pattern

Read:

- `app/config/email.config.js`
- `app/config/email-recipients.config.js`
- `app/services/email.service.js`
- every file listed in §3.2

Answer these questions before editing:

1. Is `EMAIL_CONFIG` imported anywhere besides `email.service.js`?
2. Do any inline transports already share options with `EMAIL_CONFIG`?
3. Which transports use `SUPPORT_RECEIVER_*` vs `EMAIL_USER`/`EMAIL_PASSWORD` vs payment credentials?
4. Do any transports set `secure`, `port`, `requireTLS`, `servername`, or `connectionTimeout` that must be preserved?
5. Is the SMTP port 465 (implicit TLS) or 587 (STARTTLS)? Check the environment documentation, not the secret values.
6. Are there any other mail libraries or direct SMTP clients in the repository? Search for `smtp`, `mailgun`, `sendgrid`, `ses`, etc.

### 5.5 Inspect the deployment and SMTP assumptions

Determine, without printing secrets:

- Which environment(s) the app runs in (`NODE_ENV` semantics).
- Whether the SMTP endpoint uses a publicly trusted certificate or a self-signed/internal CA certificate.
- Whether the SMTP hostname used by the app matches the certificate SAN.
- Whether the server sends the full intermediate chain.
- Whether the SMTP provider requires TLS on port 587 (`STARTTLS`) or uses implicit TLS on 465.

Use read-only commands and redact hostnames in the final report if they are sensitive. Example shape (replace with the real SMTP host only in a local terminal):

```bash
openssl s_client -starttls smtp -connect <smtp-host>:587 -servername <smtp-host> -showcerts </dev/null
```

For implicit TLS/465:

```bash
openssl s_client -connect <smtp-host>:465 -servername <smtp-host> -showcerts </dev/null
```

Look for:

- `Verify return code: 0 (ok)` — certificate chain validates.
- Expiry date.
- Subject/SAN contains the SMTP hostname.
- The chain includes the intermediate certificate.

If the chain does not validate, **stop** and report it. The correct fix is to correct the SMTP TLS configuration (trusted CA, correct hostname, full chain) or provide a controlled custom CA in the environment. Do not permanently disable verification in production to work around it.

### 5.6 Inspect existing test patterns

Read:

- `test/008-secrets-validation.test.js` — shows `node:test`, source reading, pure exported functions, and child-environment isolation.
- `test/010-helmet-security-headers.test.js` — shows source assertions and runtime middleware checks.
- `test/051-reset-endpoints-rate-limit.test.js` — shows how routes/config are exercised without a real external service where possible.

Follow the existing conventions:

- `node:test`
- `node:assert` or `node:assert/strict`
- no new test framework
- no real SMTP connection in the default test suite
- no real secrets or `.env` values in tests

---

## 6. File Impact Analysis

| File                                                                    | Role                                         | Action                                  | Reason                                                                                        |
| ----------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------- |
| `app/config/email.config.js`                                            | Shared email config used by `EmailService`   | MODIFY                                  | Remove `rejectUnauthorized: false`; export the single source of truth for TLS verification    |
| `app/routes/email-marketing.js`                                         | Four inline Nodemailer transports            | MODIFY                                  | Replace the insecure literal with the shared secure TLS option                                |
| `app/routes/forgot-password.js`                                         | Password-reset transport                     | MODIFY                                  | Same; preserve `EMAIL_USER`/`EMAIL_PASSWORD` and reset email behavior                         |
| `app/routes/upload-file.js`                                             | Registration, resend, and payment transports | MODIFY                                  | Three occurrences; preserve each flow's credentials/templates                                 |
| `app/shared/email-template.js`                                          | Four shared email helpers                    | MODIFY                                  | Four occurrences; used by the contact-email controller                                        |
| `app/db_controllers/support_messages.controller.js`                     | Support/suggestion transport                 | MODIFY                                  | One occurrence                                                                                |
| `app/services/email.service.js`                                         | Consumes `EMAIL_CONFIG`                      | REFERENCE ONLY                          | Should need no edit if `EMAIL_CONFIG` is fixed; verify                                        |
| `app/config/email-recipients.config.js`                                 | Recipient list                               | REFERENCE ONLY                          | Do not change recipients                                                                      |
| `app/email_controllers/submit-client-email-to-the-trader.controller.js` | Calls `app/shared/email-template.js`         | REFERENCE ONLY                          | Verify no separate transport exists there                                                     |
| `app/email_controllers/cron-email.controller.js`                        | Cron caller for `EmailService`               | REFERENCE ONLY                          | Verify it still works through the shared config                                               |
| `test/011-email-tls-verification.test.js`                               | New focused acceptance test                  | ADD                                     | Prevent regression and prove the secure default                                               |
| `test/011-TLS-Verification-Disabled-for-Email-Transport-Test-Result.md` | Evidence report                              | ADD (recommended, consistent with repo) | Record commands, test output, SMTP certificate check summary, and manual send result          |
| `README.md` §14                                                         | Environment documentation                    | MODIFY (only if a new flag is added)    | Document the dev-only escape hatch if implemented; do not document it as a production option  |
| `.env.example`                                                          | Placeholder environment template             | MODIFY (only if a new flag is added)    | Add a safe default (`true` / omit) if the escape hatch is introduced; never add a real secret |
| `CODE_REVIEW.md`                                                        | Finding source                               | REFERENCE ONLY                          | Do not edit the review document                                                               |
| `AGENTS.md`                                                             | Agent conventions                            | REFERENCE ONLY                          | Follow commands and stack rules                                                               |
| `package.json`                                                          | Dependencies                                 | REFERENCE ONLY                          | Nodemailer already exists; do not add dependencies                                            |

Do not modify a file just because it appears here. Confirm the need with evidence.

---

## 7. Current Implementation

### 7.1 Shared config (`app/config/email.config.js`)

```js
const EMAIL_CONFIG = {
    host: process.env.EMAIL_SERVERHOST,
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    secure: false,
    auth: {
        user: process.env.SUPPORT_RECEIVER_EMAIL_ADDRESS,
        pass: process.env.SUPPORT_RECEIVER_PASSWORD,
    },
    tls: {
        rejectUnauthorized: false,
    },
};
```

This feeds `EmailService`, which is used by the midnight report cron. It is the cleanest place to introduce a shared TLS option.

### 7.2 Inline transports

`app/routes/email-marketing.js`, `app/routes/forgot-password.js`, `app/routes/upload-file.js`, `app/shared/email-template.js`, and `app/db_controllers/support_messages.controller.js` repeat this pattern:

```js
let transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVERHOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
        user: process.env.SUPPORT_RECEIVER_EMAIL_ADDRESS, // or EMAIL_USER / payment creds
        pass: process.env.SUPPORT_RECEIVER_PASSWORD,
    },
    tls: {
        rejectUnauthorized: false,
    },
});
```

Differences that must be preserved:

| File                                                | Auth user/password                                             |
| --------------------------------------------------- | -------------------------------------------------------------- |
| `app/config/email.config.js`                        | `SUPPORT_RECEIVER_EMAIL_ADDRESS` / `SUPPORT_RECEIVER_PASSWORD` |
| `app/routes/email-marketing.js`                     | `SUPPORT_RECEIVER_EMAIL_ADDRESS` / `SUPPORT_RECEIVER_PASSWORD` |
| `app/shared/email-template.js`                      | `SUPPORT_RECEIVER_EMAIL_ADDRESS` / `SUPPORT_RECEIVER_PASSWORD` |
| `app/db_controllers/support_messages.controller.js` | `SUPPORT_RECEIVER_EMAIL_ADDRESS` / `SUPPORT_RECEIVER_PASSWORD` |
| `app/routes/forgot-password.js`                     | `EMAIL_USER` / `EMAIL_PASSWORD`                                |
| `app/routes/upload-file.js` (verification/resend)   | `EMAIL_USER` / `EMAIL_PASSWORD`                                |
| `app/routes/upload-file.js` (payment)               | `PAYMENT_EMAIL_ADDRESS` / `PAYMENT_EMAIL_ADDRESS_PASSWORD`     |

### 7.3 Current behavior

- Every transport encrypts traffic but accepts any certificate.
- A network attacker can impersonate the SMTP server without detection.
- No test asserts the TLS policy.
- The insecure literal is copied in six files, so a partial fix would leave gaps.

---

## 8. Current → Target

### 8.1 Conceptual change

## Current

```text
Transport construction
   ↓
tls: { rejectUnauthorized: false }
   ↓
TLS handshake succeeds even with an untrusted / wrong / expired certificate
   ↓
SMTP auth credentials and message content are exposed to a MITM
```

## Target

```text
Transport construction
   ↓
shared TLS option (rejectUnauthorized: true by default)
   ↓
TLS handshake validates certificate chain + hostname
   ↓
valid certificate  → SMTP auth + send proceeds
invalid certificate → send fails closed with a TLS error
   ↓
production: verification can never be disabled
local development: explicit opt-out only, if the team truly needs self-signed SMTP
```

### 8.2 Target configuration pattern

Use this as the intended pattern. Inspect the existing architecture and adapt it. Do not blindly paste if the live config has changed.

**Preferred: one shared TLS option in `app/config/email.config.js`.**

```js
// app/config/email.config.js

// Verification is ON by default.
// It may only be disabled for local development, and only with an explicit opt-in.
function buildEmailTlsOptions(env = process.env) {
    const isProduction = env.NODE_ENV === 'production';
    const explicitlyAllowed = env.EMAIL_TLS_REJECT_UNAUTHORIZED === 'false';

    return {
        rejectUnauthorized: !(explicitlyAllowed && !isProduction),
    };
}

const EMAIL_TLS_OPTIONS = buildEmailTlsOptions();

const EMAIL_CONFIG = {
    host: process.env.EMAIL_SERVERHOST,
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    secure: false,
    auth: {
        user: process.env.SUPPORT_RECEIVER_EMAIL_ADDRESS,
        pass: process.env.SUPPORT_RECEIVER_PASSWORD,
    },
    tls: EMAIL_TLS_OPTIONS,
};

module.exports = {
    CLIENT_EMAIL_RECIPIENTS,
    MIDNIGHT_REPORT_SUBJECT,
    EMAIL_CONFIG,
    EMAIL_TLS_OPTIONS,
    buildEmailTlsOptions,
};
```

Then in every inline transport:

```js
const { EMAIL_TLS_OPTIONS } = require('../config/email.config');

let transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVERHOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
        /* unchanged */
    },
    tls: EMAIL_TLS_OPTIONS,
});
```

**Acceptable minimal alternative (no new environment flag):**

```js
// Remove the tls block entirely; Nodemailer/Node defaults to rejectUnauthorized: true.
let transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVERHOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
        /* unchanged */
    },
});
```

If a dev escape hatch is needed, prefer the explicit `EMAIL_TLS_REJECT_UNAUTHORIZED=false` opt-in above over `rejectUnauthorized: process.env.NODE_ENV !== 'production'`, because the latter fails open when `NODE_ENV` is missing or misspelled.

### 8.3 Before / after (representative)

```js
// CURRENT — app/routes/email-marketing.js
let transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVERHOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
        user: process.env.SUPPORT_RECEIVER_EMAIL_ADDRESS,
        pass: process.env.SUPPORT_RECEIVER_PASSWORD,
    },
    tls: {
        rejectUnauthorized: false,
    },
});
```

```js
// TARGET — same transport, secure TLS, credentials unchanged
const { EMAIL_TLS_OPTIONS } = require('../config/email.config');

let transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVERHOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
        user: process.env.SUPPORT_RECEIVER_EMAIL_ADDRESS,
        pass: process.env.SUPPORT_RECEIVER_PASSWORD,
    },
    tls: EMAIL_TLS_OPTIONS,
});
```

Do not move the `require` into a hot loop if the existing file puts requires at the top of the module factory. Match the file's current structure.

---

## 9. Detailed Implementation Plan

### Step 0 — Establish baseline and verify scope

1. Run `git status`, `git diff --stat`, and `git log --oneline -10`.
2. Run the inventory command from §5.3 and save the output in the final report.
3. Confirm the exact count and locations of `rejectUnauthorized: false`. If the count differs from 14, update the report with the real count; do not force the number.
4. Run the focused existing tests as a baseline:

```bash
node --test test/008-secrets-validation.test.js
node --test test/010-helmet-security-headers.test.js
node --test test/password-reset.test.js
```

Some integration tests may skip when the database is unavailable. Report skips separately; do not hide them.

### Step 1 — Validate the SMTP certificate before changing code

This step is mandatory for production safety.

1. Determine the SMTP host/port from the environment configuration (do not print the password or any secret).
2. Run the appropriate `openssl s_client` command from §5.5.
3. Record in the test-result document:
    - verification result code,
    - certificate expiry date,
    - whether the hostname matches,
    - whether the intermediate chain is present.
4. If verification fails:
    - **Stop and report it.** Do not deploy this change yet.
    - Recommend the correct fix: install the proper CA chain, correct the SMTP hostname, or configure a controlled trust store. Do not keep `rejectUnauthorized: false` in production as the workaround.
5. Optionally, run a one-off Nodemailer `transporter.verify()` in a local script or Node REPL **without printing credentials**. A successful verify after the code change is stronger evidence than `openssl` alone.

### Step 2 — Add the shared TLS option

1. Open `app/config/email.config.js`.
2. Add `buildEmailTlsOptions(env = process.env)` as a pure function (see §8.2) or the simpler removal approach.
3. Export `EMAIL_TLS_OPTIONS` and `buildEmailTlsOptions` so tests and all transports can use one decision.
4. Replace `EMAIL_CONFIG.tls` with `EMAIL_TLS_OPTIONS`.
5. Keep all other fields (`host`, `port`, `secure`, `auth`) unchanged.
6. Do not export credentials.

**Decision point — record which approach you chose:**

- **Approach A (recommended):** shared `EMAIL_TLS_OPTIONS` + explicit dev-only opt-in flag.
- **Approach B (minimal):** remove the `tls` block entirely; no escape hatch.
- **Approach C (not recommended):** `rejectUnauthorized: process.env.NODE_ENV !== 'production'`. It fails open on a missing/misspelled `NODE_ENV`. Only use it if the team explicitly rejects the safer options, and document the risk.

### Step 3 — Update every transport

For each file in §6 marked MODIFY:

1. Import `EMAIL_TLS_OPTIONS` using the path style already used by that file:
    - route modules commonly use `require('../config/email.config')`
    - the shared helper uses `require('../config/email.config')`
    - controller uses `require('../config/email.config')`
2. Replace:
    ```js
    tls: { rejectUnauthorized: false },
    ```
    with:
    ```js
    tls: EMAIL_TLS_OPTIONS,
    ```
3. Do not alter:
    - `auth`
    - `host`
    - `port`
    - `secure`
    - mail options, templates, contexts, subjects, recipients
    - callback/error behavior and `res.send(...)` responses
4. Confirm every one of the 14 occurrences is replaced. Re-run the inventory.
5. If a file cannot import the shared option for a legitimate reason (for example, circular dependency), remove the `tls` block entirely rather than leaving it insecure, and document why.

### Step 4 — Handle the development escape hatch (only if needed)

If local development uses a self-signed SMTP certificate:

1. Use `EMAIL_TLS_REJECT_UNAUTHORIZED=false` **only** with a non-production `NODE_ENV`.
2. Ensure production ignores it. The `buildEmailTlsOptions` function above does this by requiring `!isProduction`.
3. Add the variable to `.env.example` with a safe default, for example:
    ```env
    # Local development only. Ignored when NODE_ENV=production.
    # Leave unset/true to verify SMTP TLS certificates (required in production).
    EMAIL_TLS_REJECT_UNAUTHORIZED=true
    ```
4. Document it in `README.md` §14.3 only as a development-only escape hatch. Explicitly state that production always verifies.
5. Never set `EMAIL_TLS_REJECT_UNAUTHORIZED=false` in a production environment file, hosting dashboard, or committed file.
6. Do not modify the real `.env`.

If no self-signed SMTP is used anywhere, **do not add the flag**. Simpler is better.

### Step 5 — Update or add tests

Add `test/011-email-tls-verification.test.js` following the project's `node:test` style.

Minimum coverage:

1. **Default is secure**
    - `buildEmailTlsOptions({ NODE_ENV: 'production' }).rejectUnauthorized === true`
    - `buildEmailTlsOptions({}).rejectUnauthorized === true`
2. **Production cannot opt out**
    - `buildEmailTlsOptions({ NODE_ENV: 'production', EMAIL_TLS_REJECT_UNAUTHORIZED: 'false' }).rejectUnauthorized === true`
3. **Explicit dev opt-out works only outside production**
    - `buildEmailTlsOptions({ NODE_ENV: 'development', EMAIL_TLS_REJECT_UNAUTHORIZED: 'false' }).rejectUnauthorized === false`
    - If Approach B is chosen, omit this test and assert the option does not exist.
4. **No insecure literal remains in application source**
    - Recursively read `app/**/*.js` (follow the helper style in `test/010-helmet-security-headers.test.js`).
    - Assert no file contains `rejectUnauthorized: false` except a narrowly scoped dev-only helper line, if Approach A is chosen. Prefer asserting that the only occurrence is inside `buildEmailTlsOptions`, not in transport definitions.
5. **All `createTransport` calls are secure**
    - Scan for `nodemailer.createTransport(` in `app/`.
    - For each block, assert it does not contain the insecure literal and either uses `EMAIL_TLS_OPTIONS`, imports from `email.config`, or omits `tls` (defaults secure).
    - Keep this test evidence-based and tolerant of formatting changes; do not build a brittle full-JS parser.
6. **Runtime transport options**
    - `require('../app/config/email.config.js').EMAIL_CONFIG.tls.rejectUnauthorized === true` with a production-like env.
    - Optionally construct a transport with the same options and assert `transporter.options.tls.rejectUnauthorized === true`. Do not call `sendMail` or connect.
7. **Regression: no credential or secret logging is introduced**
    - Assert the test and modified files do not print `process.env.SUPPORT_RECEIVER_PASSWORD`, `EMAIL_PASSWORD`, or `PAYMENT_EMAIL_ADDRESS_PASSWORD`.

If `app/config/email.config.js` requires `email-recipients.config.js` with side effects, confirm the test can load it without a database. If not, test `buildEmailTlsOptions` in isolation by exporting it from a dependency-free module, or use a child process with controlled env. Do not copy secrets into tests.

### Step 6 — Run the tests and lint

```bash
node --test test/011-email-tls-verification.test.js
node --test
npm run lint
```

Report any skipped tests separately. `npm run lint` runs Prettier in write mode; review the diff afterward to ensure it did not reformat unrelated files. If it does, revert only the unrelated formatting (do not revert prior finding work).

### Step 7 — Review the diff

Before declaring completion, run:

```bash
git diff --stat
git diff -- app/config/email.config.js \
  app/routes/email-marketing.js \
  app/routes/forgot-password.js \
  app/routes/upload-file.js \
  app/shared/email-template.js \
  app/db_controllers/support_messages.controller.js \
  test/011-email-tls-verification.test.js
```

Confirm:

- Only TLS options and the new test/documentation changed.
- No credentials, recipients, subjects, templates, routes, or response behavior changed.
- All 14 occurrences are handled.
- No unrelated file was touched.
- The working tree still contains prior-finding changes untouched.

### Step 8 — Runtime verification (where possible)

If a staging/local SMTP account is available:

1. Start the app with the configured environment (`npm run dev` or `npm start`).
2. Trigger one safe email flow (password reset to a controlled mailbox, or registration verification to a test address).
3. Confirm the email arrives and the server log does not show a TLS error.
4. Confirm `EmailService` verifies successfully:
    ```bash
    node -e "const s=require('./app/services/email.service'); setTimeout(()=>process.exit(0), 3000)"
    ```
    This uses the real config. Do not print credentials.

If no SMTP account is available, do not fabricate a send result. Report that runtime delivery was not verified and why.

---

## 10. Architecture and Existing Patterns

The implementing agent must prefer existing project patterns:

- Use the existing `app/config/email.config.js` as the configuration home.
- Follow the existing CommonJS `require` style and 4-space indentation.
- Follow the existing `node:test` test style.
- Do not introduce a new dependency, email library, configuration framework, or dependency-injection pattern.
- Do not create a second TLS helper in parallel with `email.config.js`.
- Do not refactor the email senders into `EmailService` in this task; that is Finding 16.
- Do not change the `nodemailer-express-handlebars` setup.
- Do not alter the module factory pattern in route files (`module.exports = (app) => { ... }`).

Search for any existing helpers before adding new ones:

```bash
grep -RIn "rejectUnauthorized\|EMAIL_CONFIG\|createTransport" app test
```

---

## 11. Security Requirements

This is a transport-security task. The following rules are mandatory:

- **Never** ship `rejectUnauthorized: false` in production code paths.
- **Never** make verification conditional on a value that can be missing or misspelled (`NODE_ENV !== 'production'` fails open). Prefer an explicit opt-in restricted to non-production, or no opt-out at all.
- **Never** allow an environment variable to disable certificate verification when `NODE_ENV === 'production'`.
- **Never** log SMTP credentials, reset tokens, verification codes, or full transport options containing `auth`.
- **Never** disable verification to silence a certificate error without investigating the underlying cause.
- **Preserve** SMTP authentication behavior; this task must not change which account sends which email.
- **Preserve** STARTTLS/implicit-TLS behavior (`secure` and `port`) unless a separate task explicitly changes it.
- **Test malicious/failure cases:**
    - invalid certificate chain → transport connection fails,
    - hostname mismatch → fails,
    - expired certificate → fails,
    - production with `EMAIL_TLS_REJECT_UNAUTHORIZED=false` → still verifies.
- **Search for similar patterns** outside the listed files: any `tls:` option, any `rejectUnauthorized`, any direct `https.request`/SMTP client, any `NODE_TLS_REJECT_UNAUTHORIZED=0` environment setting, any `--insecure` flag, and any custom CA loading that silently disables checks.

Do not add `NODE_TLS_REJECT_UNAUTHORIZED=0` anywhere. If it already exists in deployment tooling outside this repository, report it; do not edit external systems.

---

## 12. Backward Compatibility

Preserve existing behavior unless explicitly required:

- API response strings and status codes for email endpoints (for example `res.send('email sent')`) must not change.
- Email templates, template names, contexts, subjects, senders, and recipients must not change.
- SMTP auth users/passwords per flow must not change.
- `secure` and `port` behavior must not change.
- Cron scheduling and midnight report behavior must not change.
- Error logging behavior may remain as-is; do not add logging that exposes secrets.
- The application must still start without SMTP connectivity. Transport construction is lazy in Nodemailer; do not add a blocking startup `verify()` call for every transport.
- `EmailService` currently verifies at construction time and logs the result. Do not duplicate that verification across all transports.
- No database schema, session, auth, or API contract changes.

If the production SMTP certificate cannot be validated, the correct outcome is a **documented blocker**, not a silent fallback to insecure TLS.

---

## 13. Testing Strategy

### Normal Case

- `buildEmailTlsOptions` returns `{ rejectUnauthorized: true }` for production and for an empty environment.
- A transport constructed from `EMAIL_CONFIG` has `transporter.options.tls.rejectUnauthorized === true`.
- Existing email route tests (password reset, etc.) still pass.
- If staging SMTP is available, a real email is delivered.

### Empty / Missing Input

- Missing `NODE_ENV` → verification stays `true`.
- Missing `EMAIL_TLS_REJECT_UNAUTHORIZED` → verification stays `true`.
- Empty string for `EMAIL_TLS_REJECT_UNAUTHORIZED` → verification stays `true`.
- Existing behavior when `EMAIL_SERVERHOST`/credentials are missing is unchanged (transport construction should not crash the process).

### Boundary Cases

- `NODE_ENV=Production` (wrong case) must not be treated as production by the helper if case-sensitivity matters. Either document that exact lowercase `production` is required or normalize case consistently. Do not weaken verification for the wrong-case value.
- `NODE_ENV=staging`, `NODE_ENV=nonprod`, `NODE_ENV=localhost` → production-safe default (`true`).
- `EMAIL_TLS_REJECT_UNAUTHORIZED='FALSE'` → do not treat as the literal `'false'`; stay secure unless the exact opt-in is documented.
- Whitespace around the env value → trim or stay secure; do not accidentally enable the insecure path.

### Invalid Input

- `EMAIL_TLS_REJECT_UNAUTHORIZED=false` with `NODE_ENV=production` → `true`.
- Malformed values (`0`, `no`, `off`, `null`) → `true` unless explicitly supported and documented.

### Security Cases

- Source scan proves no producible `rejectUnauthorized: false`.
- Search proves no `NODE_TLS_REJECT_UNAUTHORIZED=0` was introduced.
- Verify that a self-signed endpoint is rejected when verification is on (can be simulated with a local TLS server or asserted at the options level if a real handshake is infeasible).
- Verify that production ignores the dev opt-out.
- Verify no credentials are printed in test output or logs.

### Regression Testing

- `node --test` full suite.
- Existing password-reset tests.
- Helmet/security tests (ensure no accidental interaction).
- Application boot / `npm run dev` smoke test if the environment allows.
- One real email flow if SMTP credentials are available.

---

## 14. Verification / Evidence

The implementing agent must provide evidence; "fixed" is not acceptable.

Required evidence:

1. **Inventory before and after**

    ```bash
    grep -RIn "rejectUnauthorized" app --include='*.js'
    ```

    Before: 14 occurrences, all `false`.
    After: only the single guarded helper line (Approach A) or zero occurrences (Approach B).

2. **Test output**

    ```bash
    node --test test/011-email-tls-verification.test.js
    node --test
    ```

3. **Resolved runtime config** (no secrets printed)

    ```bash
    NODE_ENV=production node -e "const { EMAIL_CONFIG } = require('./app/config/email.config'); console.log(EMAIL_CONFIG.tls)"
    ```

    Expected: `{ rejectUnauthorized: true }`.

4. **Production opt-out is ignored**

    ```bash
    NODE_ENV=production EMAIL_TLS_REJECT_UNAUTHORIZED=false node -e "const { EMAIL_CONFIG } = require('./app/config/email.config'); console.log(EMAIL_CONFIG.tls)"
    ```

    Expected: `{ rejectUnauthorized: true }`.

5. **SMTP certificate check**

    Paste the `openssl s_client` verification result (redact host if needed). State clearly whether the certificate validates.

6. **Real send result** (if available)

    State which flow was triggered, that delivery succeeded, and that no TLS error appeared. If not available, state that it could not be tested and why.

7. **Final diff review** — list changed files and confirm no unrelated changes.

For security fixes, explicitly search for similar vulnerable patterns in the affected functionality:

```bash
grep -RIn "rejectUnauthorized\|NODE_TLS_REJECT_UNAUTHORIZED\|strictSSL\|insecure" app test .env.example README.md --include='*.js' --include='*.md' --include='*.example'
```

---

## 15. Do NOT Do

- Do not modify unrelated functionality, routes, templates, or response bodies.
- Do not rewrite the email architecture or consolidate into `EmailService` (Finding 16).
- Do not change SMTP credentials, senders, recipients, subjects, or templates.
- Do not change `secure`, `port`, `requireTLS`, `servername`, or timeouts unless a separate, explicit decision is documented in this task.
- Do not add or upgrade npm dependencies.
- Do not introduce Jest, Mocha, Supertest, Playwright, or another framework.
- Do not modify the real `.env` or commit secrets.
- Do not log, print, or echo any secret, token, verification code, or password.
- Do not add `NODE_TLS_REJECT_UNAUTHORIZED=0`, `strictSSL: false`, `--insecure`, or any equivalent.
- Do not disable security checks to make tests pass.
- Do not remove or skip tests because they fail.
- Do not hide TLS errors or swallow them in a way that makes failures invisible.
- Do not leave an insecure fallback that silently retries without verification.
- Do not "fix" the issue by setting `NODE_ENV=development` in production.
- Do not change database schema, sessions, auth middleware, rate limits, or Helmet/CSP.
- Do not revert or reformat unrelated work already present in the worktree.
- Do not edit `CODE_REVIEW.md` to mark the finding fixed.

---

## 16. Acceptance Criteria

- [ ] All 14 `rejectUnauthorized: false` occurrences in `app/` are removed or replaced by a single guarded helper.
- [ ] Production (`NODE_ENV=production`) always uses `rejectUnauthorized: true`, even if `EMAIL_TLS_REJECT_UNAUTHORIZED=false`.
- [ ] If an escape hatch exists, it is explicit, non-production-only, documented, and tested.
- [ ] If no escape hatch is needed, no new environment variable was added.
- [ ] All email flows still construct transports with their original credentials, ports, `secure` values, templates, and recipients.
- [ ] `EmailService` / midnight report uses the secure `EMAIL_CONFIG`.
- [ ] New focused tests exist under `test/` using `node:test`.
- [ ] Source scan proves no insecure literal remains in the production path.
- [ ] SMTP certificate chain was checked and the result is documented (or the lack of access is documented as a blocker).
- [ ] A real email send was verified where SMTP access exists; otherwise this is explicitly reported as unverified.
- [ ] Existing test suite passes; skips are reported separately.
- [ ] `npm run lint` was run and the diff was reviewed for unrelated formatting changes.
- [ ] Final diff contains only files required for this finding.
- [ ] Remaining risks are documented.

---

## 17. Expected Final Report

The implementing agent must finish with this structure:

```markdown
# Implementation Report

## Summary

Brief explanation of what was implemented, which approach (A/B/C) was chosen, and whether SMTP delivery was verified.

## Files Modified

| File                                                | Changes |
| --------------------------------------------------- | ------- |
| `app/config/email.config.js`                        | ...     |
| `app/routes/email-marketing.js`                     | ...     |
| `app/routes/forgot-password.js`                     | ...     |
| `app/routes/upload-file.js`                         | ...     |
| `app/shared/email-template.js`                      | ...     |
| `app/db_controllers/support_messages.controller.js` | ...     |

## Files Added

| File                                                                    | Purpose               |
| ----------------------------------------------------------------------- | --------------------- |
| `test/011-email-tls-verification.test.js`                               | ...                   |
| `test/011-TLS-Verification-Disabled-for-Email-Transport-Test-Result.md` | Evidence (if created) |

## Files Deleted

| File | Reason |
| ---- | ------ |
| None | ...    |

## Files Referenced Only

| File                                    | Why                                   |
| --------------------------------------- | ------------------------------------- |
| `app/services/email.service.js`         | Consumes EMAIL_CONFIG; no edit needed |
| `app/config/email-recipients.config.js` | Recipients unchanged                  |
| `CODE_REVIEW.md`                        | Finding source                        |

## Implementation Details

Explain the shared TLS option, how production is protected, whether the dev escape hatch exists, and how all 14 transports were updated.

## Inventory

Before: <count> occurrences in <files>.
After: <count> occurrences, only in <guarded helper> / zero.

## SMTP Certificate Check

| Check                                 | Result |
| ------------------------------------- | ------ |
| `openssl s_client` verify return code | ...    |
| Hostname matches certificate          | ...    |
| Expiry                                | ...    |
| Intermediate chain present            | ...    |

## Testing

| Test                              | Result                         |
| --------------------------------- | ------------------------------ |
| Secure default                    | PASS/FAIL                      |
| Production ignores opt-out        | PASS/FAIL                      |
| Dev opt-out (if applicable)       | PASS/FAIL                      |
| No insecure literal in app source | PASS/FAIL                      |
| Existing password-reset tests     | PASS/FAIL                      |
| Full `node --test`                | PASS/FAIL/SKIPPED (list skips) |
| Real email send                   | PASS/FAIL/NOT TESTED           |

## Verification

Show the before/after grep output, the resolved `EMAIL_CONFIG.tls` output, and how the original vulnerability was verified as fixed.

## Remaining Risks

List anything that could not be verified, any SMTP certificate issues, any environment where delivery was not tested, and any follow-ups (for example `requireTLS: true` or Finding 16 consolidation).

## Final Status

PASS / NEEDS REVIEW
```

---

## 18. Important Rules for Executing This Task

### Rule 1 — Do not hallucinate

Do not invent file paths, functions, APIs, SMTP providers, environment values, or test results. If information is missing, mark it `TO INVESTIGATE` or `NOT VERIFIED`.

### Rule 2 — Separate facts from recommendations

`CURRENT IMPLEMENTATION` is what the live files contain. `RECOMMENDED IMPLEMENTATION` is the target pattern in §8. Do not present an assumption as a verified fact.

### Rule 3 — Prefer project consistency

Use the existing `app/config/email.config.js`, CommonJS style, and `node:test` patterns. Do not add a parallel architecture.

### Rule 4 — Preserve behavior

This is a security fix, not an email refactor. Only the TLS verification decision should change.

### Rule 5 — Think about the entire code path

Check every transport construction and every caller, including cron jobs and shared helpers, not only the three files named in the finding. The real surface is six files / fourteen transports.

### Rule 6 — Make the task executable and auditable

The final report must let a reviewer confirm:

```text
WHAT changed
WHERE it changed
WHY it changed
WHAT did not change
HOW it was tested
HOW completion was verified
WHAT remains risky
```

---

## 19. Operational Rollout Notes

Use these notes to avoid a production email outage:

1. **Validate the certificate first.** If the production SMTP certificate fails validation, do not deploy.
2. **Deploy during a low-volume window.** Password resets and registrations depend on email.
3. **Watch the logs immediately after deployment** for TLS errors such as:
    - `unable to verify the first certificate`
    - `self-signed certificate`
    - `certificate has expired`
    - `Hostname/IP does not match certificate's altnames`
4. **Have a rollback plan.** Reverting the code restores the previous behavior. Do not "roll back" by adding a permanent insecure environment flag.
5. **Fix certificate problems at the source.** Add the missing intermediate chain, use the correct hostname, renew the certificate, or configure a controlled CA. Never permanently disable verification in production.
6. **Document the outcome** in the test-result file, including the certificate check and whether a real send was verified.
7. **Record follow-ups** without implementing them here:
    - consider `requireTLS: true` to prevent opportunistic plaintext if the SMTP server does not advertise STARTTLS;
    - consider honoring `EMAIL_SECURE` instead of hardcoding `secure: false`;
    - consider Finding 16 consolidation into `EmailService` to eliminate the remaining transporter duplication.
