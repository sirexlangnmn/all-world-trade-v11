# Code Review: All World Trade v11

**Date:** July 25, 2026  
**Revised:** September 18, 2026 (refactoring playbook: DRY, SOLID, KISS, smaller functions, modern Node patterns)  
**Reviewer:** Senior Software Engineer  
**Scope:** Full codebase review of the All World Trade B2B marketplace platform  
**Status:** Production system is **complete and working**. This document is not a rewrite plan. It is a set of incremental recommendations to optimize, refactor, and modernize the code while keeping behavior stable.

---

## Executive Summary

All World Trade v11 is a server-side rendered B2B trade networking platform built on Express.js, EJS, MySQL, and a mix of raw SQL (mysql2) and Sequelize ORM. The application connects businesses across four tiers (Trader, Large-Scale, Medium-Scale, Small-Scale Company) with features including registration, company profiles, file uploads, video meetings via WebRTC, email marketing, and PDF downloads.

**Overall Quality:** The system works and has been deployed to production. The recommendations below assume current features stay intact. Changes should be small, testable, and shipped incrementally.

The main gaps are: **critical security issues** that should be fixed first, **duplication across four business tiers** that makes every change four times as expensive, **large mixed-responsibility functions** that are hard to test, and **two data-access stacks** (raw mysql2 + Sequelize) without a migration rule.

**Goals of this review (in addition to security):**
- Optimize and refactor toward current Node/Express practices (async/await, parameterized queries, thin routes, a services layer).
- Break large handlers into smaller functions, each doing one job (validate, map input, persist, render, respond).
- Align the code with **DRY**, **SOLID**, and **KISS**.
- Improve **security, readability, performance, reusability, testability, and maintainability**.

**Key Findings:**
- **5 critical security vulnerabilities** including SQL injection, plaintext password storage on reset, and a public bcrypt oracle endpoint
- **No authentication middleware** on the vast majority of API routes
- **Massive code duplication** across file uploads (30+ near-identical route handlers), email transporters (4x repeated configuration), page routes (20+ copy-pasted session data blocks), media queries (35+ INSERT variants), and **four nearly identical registration/upgrade stacks**
- **No test suite** whatsoever (`package.json` `test` script is a stub)
- **~1,587-line `server.js`** monolith containing page routes, business logic, helpers, and middleware configuration
- Helmet/CSP security headers are commented out in production
- Controllers mix HTTP, validation, transactions, and session writes; models mix SQL with session side effects — this blocks unit testing
- Client JS repeats country/dropdown/validation/upload logic per business tier, and Webpack only bundles `home.js`

---

## Detailed Findings

### Finding 1: SQL Injection in Search Function

**Location:** `app/models/selection.model.js:137-227` — `Model.getAllBySearchParameter`

**Current Approach:** User-supplied search parameters are interpolated directly into SQL via string concatenation with zero sanitization:
```js
query += ` AND users_business_characteristics.business_major_category = '${param.trade_categories}'`;
query += ` AND users_businesses.country_of_operation LIKE '%${param.countryCode}%'`;
query += ` AND users_businesses.business_language_of_communication LIKE '%${param.language}%'`;
```

**Why This Is Suboptimal:** This is a critical SQL injection vulnerability. An attacker can inject arbitrary SQL through any search field. The `LIKE` clauses with `%` wrapping are particularly dangerous as they allow multi-statement injection. Every conditional branch (lines 175-211) is vulnerable.

**Recommended Approach:** Migrate this query to Sequelize ORM using parameterized queries and `Op` operators, consistent with the v2/v3 pattern already established in `app/db_controllers/`. If staying with raw SQL temporarily, use mysql2 parameterized placeholders (`?`) exclusively.

**Why Better:** Eliminates SQL injection entirely. Parameterized queries ensure user input is always treated as data, never as SQL syntax.

**Implementation:**
1. Rewrite `getAllBySearchParameter` as a Sequelize `findAll` with dynamic `where` clause building
2. Build the `where` object incrementally: `if (param.trade_categories) conditions.business_major_category = param.trade_categories`
3. Use `Op.like` for partial matches, `Op.eq` for exact matches
4. Add this controller method to `app/db_controllers/` following the existing pattern in `registration_v2.controller.js`
5. Update the route in `app/routes/index.js:140` to point to the new controller

---

### Finding 2: SQL Injection in Login

**Location:** `app/models/login.model.js:40,69`

**Current Approach:** Login queries interpolate user email directly into SQL:
```js
const usersAccountsQuery = `SELECT password FROM users_accounts WHERE email_or_social_media = "${newModel.email_or_social_media}"`;
```

**Why This Is Suboptimal:** Authentication is the highest-value target. SQL injection here allows complete authentication bypass and data exfiltration of all user credentials including password hashes.

**Recommended Approach:** Use parameterized queries: `WHERE email_or_social_media = ?` with the value passed as a query parameter. Better yet, migrate to Sequelize's `findOne({ where: { email_or_social_media: email } })`.

**Why Better:** Prevents authentication bypass. The Sequelize model already exists (`users_accounts.model.js`) — this is a straightforward migration.

**Implementation:**
1. Replace the two raw SQL queries in `Model.create` with Sequelize `Users_accounts.findOne()`
2. Use the existing `db_models.users_accounts` model
3. Move the session setup logic out of the model into the controller

---

### Finding 3: Plaintext Password Storage on Reset

**Location:** `app/routes/forgot-password.js:205-209`

**Current Approach:** The new password from `req.body.password3` is stored directly in the database without hashing:
```js
const inputObject = { password: password3 };
db.query(USERS_ACCOUNTS.UPDATE_PASSWORD, [...Object.values(inputObject), UUID], ...);
```

**Why This Is Suboptimal:** Any user who resets their password will have their plaintext password stored in the database. This completely undermines the bcrypt hashing used elsewhere and means a database breach exposes reset passwords in cleartext.

**Recommended Approach:** Hash the password with bcrypt (12 rounds, matching `app/db_controllers/registration_v2.controller.js:78` which uses `hashedPassword` from the client) before updating the database:
```js
const hashedPassword = await bcrypt.hash(password3, 12);
db.query(USERS_ACCOUNTS.UPDATE_PASSWORD, [hashedPassword, UUID], ...);
```

**Why Better:** Maintains password hashing consistency across all code paths.

**Implementation:**
1. Add `const bcrypt = require('bcrypt');` at the top of `forgot-password.js`
2. Before the `db.query(USERS_ACCOUNTS.UPDATE_PASSWORD, ...)` call, hash the password: `const hashedPassword = await bcrypt.hash(password3, 12);`
3. Pass `hashedPassword` instead of `password3` to the query
4. Fix the registration controller (`registration_v2.controller.js:78`) to hash server-side instead of trusting client-side `hashedPassword`

---

### Finding 4: Password Embedded in JWT Reset Token

**Location:** `app/routes/forgot-password.js:48-53`

**Current Approach:**
```js
const PAYLOAD = { password: password };
const SECRET = JWT_SECRET + password;
const TOKEN = jwt.sign(PAYLOAD, SECRET, { expiresIn: '15m' });
```

The plaintext password is embedded in the JWT payload and also used to derive the signing secret. The token is then encrypted with AES and a UUID is stored as the reset token — making the JWT entirely redundant.

**Why This Is Suboptimal:** The JWT payload is base64-encoded (not encrypted), so anyone who intercepts it can decode the password. Concatenating the password to the secret weakens the signing key. The entire JWT is unused since the actual reset flow uses a UUID stored in the database.

**Recommended Approach:** Remove the JWT creation entirely. The codebase already generates a UUID and stores it in `reset_tokens` — that IS the token. The JWT logic is dead code.

**Why Better:** Eliminates password exposure in transit and at rest. Reduces code complexity.

**Implementation:**
1. Delete lines 48-63 (JWT creation, AES encryption, URL encoding — all unused)
2. The UUID-based reset link (line 64) is the actual mechanism — keep it as-is
3. Remove the `jsonwebtoken` import if no longer needed elsewhere

---

### Finding 5: Public Bcrypt Oracle Endpoint

**Location:** `app/routes/password.js:4-35`

**Current Approach:** Two unauthenticated public endpoints:
- `POST /api/post/password-hashing` — hashes any password and returns the hash
- `POST /api/post/compare-password` — compares any plaintext against any hash and returns the result

**Why This Is Suboptimal:** This is a bcrypt oracle. An attacker can: (1) hash arbitrary passwords for resource exhaustion, (2) verify any plaintext against any bcrypt hash, enabling offline brute-force acceleration, (3) use the compare endpoint to systematically crack any password hash from the database.

**Recommended Approach:** Remove both endpoints entirely. They appear to be debugging/development utilities that should never have been deployed. If client-side password hashing is needed for registration, handle it in the registration flow only, not as a standalone public API.

**Why Better:** Closes a critical attack vector. Password hashing/comparison should only occur server-side during authentication.

**Implementation:**
1. Remove the entire `app/routes/password.js` file
2. Remove `require('../routes/password.js')(app);` from `app/src/server.js:159`
3. If client-side hashing is used in registration, hash the password server-side in `registration_v2.controller.js` instead

---

### Finding 6: No Authentication Middleware on API Routes

**Location:** `app/routes/index.js` — most routes, `app/routes/sequelize.route.js` — most routes

**Current Approach:** Only the login endpoint (`/api/post/login-process`) has validation middleware. All other API endpoints — including user data retrieval, company updates, profile modifications, and PDF downloads — have no authentication checks:
```js
app.post(['/api/get/users-account'], usersAccounts.find);        // no auth
app.post(['/api/post/update-company-details'], companyDetails.update); // no auth
app.post(['/api/get/user'], users.find);                          // no auth
```

**Why This Is Suboptimal:** Any anonymous user can query, modify, or delete any user's data by calling the API directly. The server-side page routes check `req.session.user`, but the API routes do not.

**Recommended Approach:** Create an `isAuthenticated` middleware that checks `req.session.user` and the database `login_status`, then apply it to all protected routes. The logic already exists in `server.js:308-319` (`isUserLoggedIn`) — extract it into a reusable middleware.

**Why Better:** Ensures consistent access control across all endpoints, not just page renders.

**Implementation:**
1. Create `app/middleware/auth.middleware.js` with an `isAuthenticated` function
2. The function should: (a) check `req.session.user` exists, (b) decrypt the UUID, (c) query `users_accounts.login_status`
3. Apply it to all routes in `index.js` and `sequelize.route.js` except login, registration, and public endpoints
4. Use `app.use('/api', isAuthenticated)` for grouped protection, with explicit exceptions for public routes

---

### Finding 7: No Rate Limiting

**Location:** `app/src/server.js` — no rate limiting configured anywhere

**Current Approach:** No rate limiting on any endpoint. The login endpoint, registration endpoints, and password reset endpoints are all vulnerable to brute-force and credential-stuffing attacks.

**Why This Is Suboptimal:** Without rate limiting, attackers can: (1) brute-force passwords via the login endpoint, (2) flood registration with fake accounts, (3) enumerate valid email addresses via the forgot-password flow, (4) perform denial-of-service via resource-intensive operations.

**Recommended Approach:** Add `express-rate-limit` middleware, with stricter limits on authentication-sensitive endpoints.

**Why Better:** Prevents brute-force attacks, credential stuffing, and abuse.

**Implementation:**
1. Install `express-rate-limit`
2. Create a general rate limit: 100 requests per 15 minutes per IP
3. Create a strict rate limit for auth endpoints: 5 attempts per 15 minutes per IP
4. Apply the strict limit to `/api/post/login-process`, `/api/post/forgot-password-process`, `/api/post/create-reset-token`
5. Add `app.use(limiter)` in `server.js` after body parser setup

---

### Finding 8: Weak/Default Secrets in Environment

**Location:** `.env` file (lines 10-12)

**Current Approach:**
```
API_KEY_SECRET=all_world_trade_default_secret
SESSION_SECRET=all_world_trade_secret_random_string
JWT_SECRET=all_world_trade_jwt_super_secret
```

**Why This Is Suboptimal:** These are predictable, low-entropy default values. The JWT secret is used for AES encryption of user UUIDs stored in sessions — if compromised, all user sessions can be forged. The session secret signs session cookies — a weak secret enables session hijacking.

**Recommended Approach:** Generate cryptographically random secrets (minimum 256-bit) and store them in environment variables managed by the hosting platform, not in a committed `.env` file.

**Why Better:** Prevents session forgery, token signing bypass, and UUID decryption.

**Implementation:**
1. Generate new secrets: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
2. Set the generated values in the production environment (e.g., via hosting platform environment config)
3. Ensure `.env` is in `.gitignore` (it already is) and rotate all existing secrets
4. Add a startup check that rejects known default values:
```js
if (process.env.JWT_SECRET === 'all_world_trade_jwt_super_secret') {
    throw new Error('Default JWT_SECRET detected. Set a secure secret in production.');
}
```

---

### Finding 9: Exposed Credentials in `.env` File

**Location:** `.env` file — all lines containing passwords

**Current Approach:** SMTP passwords for three email accounts are stored in plaintext in `.env` and committed to the repository (even though `.env` is in `.gitignore`, the file was read, meaning it exists in the working tree). The `.env` also contains commented-out database passwords.

**Why This Is Suboptimal:** If the repository is ever shared, leaked, or accessed by a new developer, all credentials are immediately exposed. Git history may contain previous versions of `.env` even after the file was added to `.gitignore`.

**Recommended Approach:** Rotate all credentials immediately. Move secrets to a proper secrets manager or at minimum to environment variables set at the hosting platform level. Remove the `.env` file from the repository and its git history.

**Why Better:** Limits credential exposure. Secrets management is a fundamental security practice.

**Implementation:**
1. **Immediately:** Rotate all email account passwords (verification@, payment@, care@)
2. **Immediately:** Rotate database password
3. Remove `.env` from git tracking: `git rm --cached .env`
4. Clean git history: `git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch .env' HEAD`
5. Use hosting platform environment variables for production, keep `.env` only for local development
6. Create a `.env.example` with placeholder values for developer onboarding

---

### Finding 10: Helmet Security Headers Disabled

**Location:** `app/src/server.js:97-98`

**Current Approach:** Helmet is imported and configured but commented out:
```js
// const helmet = require("../middleware/helmet")
// app.use(helmet);
```

The only security header being set manually is `X-Frame-Options: sameorigin` (line 131).

**Why This Is Suboptimal:** Without Helmet, the application is missing: `X-Content-Type-Options`, `Strict-Transport-Security`, `X-DNS-Prefetch-Control`, `X-XSS-Protection` (legacy but still useful), `Referrer-Policy`, `Permissions-Policy`, and a proper Content-Security-Policy. The custom CSP in `app/middleware/helmet/index.js` is incomplete (missing `defaultSrc`, `imgSrc`, `fontSrc`, `connectSrc`).

**Recommended Approach:** Enable Helmet with a comprehensive CSP configuration. Use nonce-based CSP (the nonce generation already exists in `app/middleware/nonces/index.js`).

**Why Better:** Defense-in-depth against XSS, clickjacking, MIME sniffing, and other client-side attacks.

**Implementation:**
1. Update `app/middleware/helmet/index.js` with complete CSP directives
2. Uncomment the `app.use(helmet)` line in `server.js`
3. Add missing directives: `defaultSrc`, `imgSrc`, `fontSrc`, `connectSrc`, `frameSrc`
4. Test all pages to ensure no legitimate resources are blocked
5. Start with `Content-Security-Policy-Report-Only` to identify violations without breaking functionality

---

### Finding 11: TLS Verification Disabled for Email Transport

**Location:** `app/config/email.config.js:14`, `app/routes/forgot-password.js:108-110`, `app/routes/email-marketing.js` (multiple functions)

**Current Approach:** All Nodemailer transport configurations include:
```js
tls: { rejectUnauthorized: false }
```

**Why This Is Suboptimal:** Disabling TLS certificate verification allows man-in-the-middle attacks on SMTP connections. An attacker on the network path can intercept email credentials and content.

**Recommended Approach:** Remove `rejectUnauthorized: false`. If self-signed certificates are used in development, conditionally disable verification only when `NODE_ENV === 'development'`.

**Why Better:** Protects email credentials and content in transit.

**Implementation:**
1. Remove `rejectUnauthorized: false` from `app/config/email.config.js:14`
2. Remove it from `app/routes/forgot-password.js:109`
3. Remove it from all four functions in `app/routes/email-marketing.js`
4. If needed for development, use: `tls: { rejectUnauthorized: process.env.NODE_ENV !== 'production' }`

---

### Finding 12: File Upload Without Validation

**Location:** `app/routes/upload-file.js:35-46`

**Current Approach:** Multer is configured with disk storage but no file type filtering, no size limits, and no MIME type verification:
```js
var storage = multer.diskStorage({
    destination: (req, file, callBack) => {
        callBack(null, './public/uploads/users_upload_files/');
    },
    filename: (req, file, callBack) => {
        callBack(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    },
});
var upload = multer({ storage: storage });
```

Uploads go to a web-accessible directory (`express.static` serves `public/`).

**Why This Is Suboptimal:** An attacker can upload `.php`, `.sh`, `.html` (for XSS), or arbitrarily large files. Combined with the web-accessible upload directory, this allows uploading webshells or phishing pages.

**Recommended Approach:** Add `fileFilter` for allowed MIME types, `limits.fileSize` for size constraints, and generate unique filenames that can't be predicted.

**Why Better:** Prevents malicious file uploads, storage exhaustion, and code execution.

**Implementation:**
1. Add a `fileFilter` to multer configuration:
```js
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'application/pdf'];
    cb(null, allowedTypes.includes(file.mimetype));
};
```
2. Add size limits: `limits: { fileSize: 50 * 1024 * 1024 }` (50MB)
3. Use `uuid` for filenames instead of `file.fieldname + Date.now()`
4. Serve uploads from a non-public directory and use a dedicated route to serve them after authorization checks

---

### Finding 13: Massive Code Duplication in File Upload Routes

**Location:** `app/routes/upload-file.js` (1,878 lines), `app/query/users_business_medias.query.js` (460 lines)

**Current Approach:** 30+ near-identical route handlers in `upload-file.js` — one for each permutation of media fields (logo, banner, video, brochure, webinar). Each handler: (1) creates a multer middleware for its specific field combination, (2) parses the uploaded files, (3) constructs a query key based on which fields are present, (4) executes the matching INSERT query. The query file contains 35+ INSERT variants, one for every possible subset of fields.

**Why This Is Suboptimal:** Adding a new media type or field requires creating 2^n new route handlers and query strings. The current 5 media types produce 35+ query variants. This is unmaintainable and error-prone.

**Recommended Approach:** Replace with a single dynamic route that: (1) uses a single multer middleware accepting all fields, (2) dynamically constructs an INSERT/UPDATE from the fields actually present in the request.

**Why Better:** Reduces 30+ handlers to 1. Reduces 35+ queries to 2 (INSERT and UPDATE). Adding a new field requires zero new routes.

**Implementation:**
1. Create a single multer middleware: `upload.fields([{ name: 'companyLogo', maxCount: 1 }, { name: 'companyBanner', maxCount: 1 }, ...])` for all possible fields
2. In the route handler, iterate over `req.files` keys to determine which fields were uploaded
3. Dynamically build the INSERT query: construct column names and values arrays from the present fields
4. Use parameterized queries with the dynamically built placeholders
5. Replace all 30+ route handlers with this single dynamic route
6. Delete all 35+ query variants from `users_business_medias.query.js`

---

### Finding 14: Monolithic server.js (1,587 Lines)

**Location:** `app/src/server.js`

**Current Approach:** A single file contains: all middleware configuration, database sync, 20+ page route handlers (each with duplicated session data construction), helper functions (`phTime`, `formattedCountryOfOperation`, `formattingBusinessTags`, `formattingBusinessScale`, `displayBusinessSocialMediaContactType`), utility business logic (`userDownloadHistory`, `checkUserLoginStatus`, `isUserLoggedIn`), and Socket.io setup.

**Why This Is Suboptimal:** Difficult to navigate, test, and maintain. Every page route duplicates the session-check and sessionData construction pattern. Helper functions are mixed with route handlers. The file grows linearly with each new page.

**Recommended Approach:** Extract into modules following the existing pattern:
- Page routes -> `app/routes/pages/` (one file per logical group)
- Helpers -> `app/utils/` (extend existing directory)
- Middleware configuration -> `app/middleware/setup.js`
- Business logic -> `app/services/`

**Why Better:** Improves navigability, testability, and separation of concerns.

**Implementation:**
1. Extract the session data construction into a shared helper: `app/utils/session-data.js`
2. Extract helper functions to `app/utils/formatting.js`
3. Move page routes to `app/routes/pages/home.routes.js`, `profile.routes.js`, `legal.routes.js`, etc.
4. Keep `server.js` as a thin orchestrator that imports and mounts the route modules
5. Move `checkUserLoginStatus` and `isUserLoggedIn` to `app/services/auth.service.js`

---

### Finding 15: Duplicated Session Data Construction Pattern

**Location:** `app/src/server.js` — 15+ route handlers (lines 324-1454)

**Current Approach:** Every page route contains this pattern:
```js
if (req.session.user === undefined) {
    const sessionData = { uuid: '', type: '', first_name: '', last_name: '', email: '', country: '', state_or_province: '', ourGenerateNonce: lodashNonce };
    res.render(path.join(...), { data: sessionData });
} else {
    const sessionData = { uuid: req.session.user.uuid, type: req.session.user.type, ... };
    res.render(path.join(...), { data: sessionData });
}
```

This block is repeated (with minor variations) across `home`, `all-about-events`, `job-fair`, `template`, `profile`, `profile2`, `help-and-support-profile`, `edit-traders-profile`, `edit-small-scale-profile`, `edit-medium-scale-profile`, `edit-large-scale-profile`, `upgrade-plan`, `upgrade-to-medium-scale`, `upgrade-to-large-scale`, `upgrade-to-traders`, `terms-and-conditions`, `data-privacy-notice`, `cookie-policy`, `pricing`, `pricing2`, `traders-page`, and `registration`.

**Why This Is Suboptimal:** 20+ copies of essentially identical logic. A change to session data structure requires updating every copy. Inconsistencies already exist (some routes include `country`/`state_or_province`, some include `ourGenerateNonce`, some don't).

**Recommended Approach:** Create middleware that attaches formatted session data to `req.viewData`, then each route simply calls `res.render(..., { data: req.viewData })`.

**Why Better:** Single source of truth for session data formatting. Changes propagate automatically.

**Implementation:**
1. Create `app/middleware/view-data.middleware.js`:
```js
const buildViewData = (req, res, next) => {
    const sessionUser = req.session.user;
    req.viewData = sessionUser
        ? { uuid: sessionUser.uuid, type: sessionUser.type, first_name: sessionUser.first_name, last_name: sessionUser.last_name, email: sessionUser.email_or_social_media, country: sessionUser.country, state_or_province: sessionUser.state_or_province, ourGenerateNonce: lodashNonce }
        : { ourGenerateNonce: lodashNonce };
    next();
};
```
2. Apply before page routes: `app.use(buildViewData)`
3. Simplify each route to: `res.render(viewPath, { data: req.viewData })`

---

### Finding 16: Duplicated Email Transporter Configuration

**Location:** `app/routes/email-marketing.js` (4 functions: `sendIntroductionEmail`, `sendEmailToTrader`, `sendEmailToClient`, `sendEmailToAllWorldTrade`), `app/routes/forgot-password.js:100-121`

**Current Approach:** Every email-sending function creates its own Nodemailer transporter and Handlebars configuration from scratch — identical boilerplate repeated 5+ times:
```js
let transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVERHOST, port: process.env.EMAIL_PORT, secure: false,
    auth: { user: process.env.SUPPORT_RECEIVER_EMAIL_ADDRESS, pass: process.env.SUPPORT_RECEIVER_PASSWORD },
    tls: { rejectUnauthorized: false },
});
const handlebarOptions = { ... };
transporter.use('compile', hbs(handlebarOptions));
```

**Why This Is Suboptimal:** The `EmailService` class in `app/services/email.service.js` already solves this — it creates a single transporter and configures Handlebars once. But it's only used for midnight reports. The rest of the codebase ignores it and duplicates the configuration.

**Recommended Approach:** Consolidate all email sending through the existing `EmailService` class. Add methods for each email type (introduction, notify-trader, notify-client, notify-AWT, forgot-password).

**Why Better:** Single transporter, single Handlebars config, consistent TLS settings, easier to add email logging/rate limiting.

**Implementation:**
1. Extend `app/services/email.service.js` with new methods for each email template
2. Replace the 4+ transporter creation blocks in `email-marketing.js` with calls to `emailService.sendIntroductionEmail(...)`, etc.
3. Replace the transporter in `forgot-password.js:100-121` with the shared service
4. Remove all inline `nodemailer.createTransport` calls

---

### Finding 17: SQL Query String Explosion in Media Queries

**Location:** `app/query/users_business_medias.query.js` (460 lines)

**Current Approach:** 35+ hardcoded INSERT query strings, one for every possible subset of 5 media fields (logo, banner, video, brochure, webinar). Examples: `CREATE_ALL`, `CREATE_ALL_BUT_NO_LOGO`, `CREATE_ALL_BUT_NO_BANNER`, `CREATE_LOGO_BANNER`, `CREATE_LOGO_VIDEO`, etc.

**Why This Is Suboptimal:** This is a combinatorial explosion. 5 fields produce 31 non-empty subsets (2^5 - 1). Currently 35+ variants are hand-maintained. Adding a 6th field would double this to 63+ variants.

**Recommended Approach:** Use a single dynamic INSERT query that accepts an object of field-value pairs and constructs the SQL at runtime using parameterized queries.

**Why Better:** Reduces 35+ queries to 1. Adding/removing fields requires zero query changes.

**Implementation:**
1. Create a utility function:
```js
function buildInsertQuery(tableName, fields) {
    const columns = Object.keys(fields).join(', ');
    const placeholders = Object.keys(fields).map(() => '?').join(', ');
    return `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`;
}
```
2. In the route handlers, construct the fields object from present files: `const fields = { uuid, date_created }; if (files.logo) fields.logo = path; ...`
3. Call `db.query(buildInsertQuery('users_business_medias', fields), Object.values(fields), callback)`

---

### Finding 18: Race Condition in getCurrentTrader

**Location:** `app/models/visitors-of-traders.model.js:224-267`

**Current Approach:** Uses `setTimeout` to wait for parallel SQL queries to complete:
```js
sql.query(USERS_BUSINESS_CHARACTERISTICS.BUSINESS_CHARACTERISTIC, [trader_uuid], (err, res) => {
    fetchTitle('trade_categories', business_major_category, 'current_trader_major_category');
    fetchTitle('sub_categories', business_sub_category, 'current_trader_sub_category');
    fetchTitle('minor_sub_categories', business_minor_sub_category, 'current_trader_minor_sub_category');
    setTimeout(() => {
        sql.query(USERS_BUSINESS.DETAILS, [trader_uuid], (err, res) => { ... });
    }, 1500);
});
```

**Why This Is Suboptimal:** The `setTimeout(1500)` is a race condition workaround. If the three `fetchTitle` queries take longer than 1.5 seconds, data will be missing from `session.items`. If they complete faster, the response is unnecessarily delayed by the full timeout. This is unreliable and adds latency.

**Recommended Approach:** Use `Promise.all` (or `Promise.allSettled`) to wait for all queries to complete, then proceed. This eliminates the arbitrary timeout and ensures all data is present.

**Why Better:** Eliminates race condition, reduces unnecessary latency, ensures data completeness.

**Implementation:**
1. Wrap each `fetchTitle` call in a Promise
2. Use `await Promise.all([fetchTitle(...), fetchTitle(...), fetchTitle(...)])`
3. Replace the `setTimeout` callback with sequential execution after the promises resolve
4. Consider migrating this entire function to Sequelize for cleaner async/await patterns

---

### Finding 19: Missing Null Check Causing Crash in Password Reset

**Location:** `app/routes/forgot-password.js:169-174`

**Current Approach:**
```js
const resetToken = await Reset_tokens.findOne({ where: { token: token } });
const userAccount = await Users_accounts.findOne({ where: { uuid: resetToken.uuid } });
```

If the token doesn't exist (expired, invalid, or already used), `resetToken` is `null` and `resetToken.uuid` throws `TypeError: Cannot read property 'uuid' of null`. This crashes the server process.

**Why This Is Suboptimal:** An attacker can crash the server by requesting a reset page with an invalid token. This is a denial-of-service vulnerability.

**Recommended Approach:** Add null checks after each database query and return appropriate error responses.

**Why Better:** Prevents server crashes and provides user-friendly error messages.

**Implementation:**
```js
const resetToken = await Reset_tokens.findOne({ where: { token: token } });
if (!resetToken) {
    return res.status(404).send('Invalid or expired reset token');
}
const userAccount = await Users_accounts.findOne({ where: { uuid: resetToken.uuid } });
if (!userAccount) {
    return res.status(404).send('User not found');
}
```

---

### Finding 20: SQL Logic Bug in Search Filter

**Location:** `app/models/selection.model.js:122-123, 192, 207, 210`

**Current Approach:**
```sql
AND users_business_medias.banner != ''
OR users_business_medias.banner != null
```

And in the dynamic search:
```js
if (param.product_service_input) {
    query += ` OR users_business_characteristics.business_industry_belong_to LIKE '%${param.product_service_input}%'`;
}
```

**Why This Is Suboptimal:** (1) `!= null` should be `IS NOT NULL` — SQL NULL comparison requires `IS`/`IS NOT`, not `=`/`!=`. (2) The `OR` in lines 122-123 is outside any parentheses, so it breaks the entire AND chain — every row will be returned because `banner != null` is always true (in SQL semantics). (3) The `OR` in lines 207 and 210 similarly breaks the WHERE clause — the entire query becomes: `WHERE ... AND ... OR (product_service_input match)`, returning all rows when those optional parameters are present.

**Recommended Approach:** Use parenthesized grouping for OR conditions and `IS NOT NULL` for null checks.

**Why Better:** Correct query results. The current code returns incorrect/unexpected data.

**Implementation:**
1. Replace `banner != '' OR banner != null` with `AND (banner != '' OR banner IS NOT NULL)`
2. Wrap OR conditions in parentheses: `AND (users_business_characteristics.business_industry_belong_to LIKE ? OR users_businesses.business_name LIKE ?)`
3. This is best fixed during the Sequelize migration (Finding 1)

---

### Finding 21: `ORDER BY RAND()` Performance

**Location:** `app/models/selection.model.js:124, 216, 317`

**Current Approach:** `ORDER BY RAND() LIMIT 5` — MySQL generates a random value for every row in the result set, sorts by it, then takes the top 5.

**Why This Is Suboptimal:** On a table with 10,000 businesses, this generates 10,000 random numbers, sorts them, and discards 9,995. This is O(n log n) instead of O(n). As the table grows, this becomes a performance bottleneck.

**Recommended Approach:** For "random" samples, use `WHERE id >= (SELECT FLOOR(RAND() * (SELECT MAX(id) FROM table))) ORDER BY id LIMIT 5` (approximate), or fetch IDs first and sample in application code. For small result sets (< 1000), the current approach is acceptable.

**Why Better:** Constant-time operation regardless of table size.

**Implementation:**
1. Add pagination support (offset/limit) to replace the random sample approach
2. If random sampling is truly needed, use the `WHERE id >= FLOOR(RAND() * MAX(id))` pattern
3. Better yet, fetch the total count and use `OFFSET FLOOR(RAND() * count) LIMIT 5`

---

### Finding 22: Validation Errors Return HTTP 200

**Location:** `app/controllers/login.controller.js:15`, `app/db_controllers/registration_v2.controller.js:30`

**Current Approach:**
```js
return res.status(200).send({ message: errors.array() });
```

**Why This Is Suboptimal:** Validation failures should return 400 (Bad Request). Returning 200 confuses monitoring tools, API clients, and security scanners. It makes it impossible to distinguish successful responses from errors in logs and analytics.

**Recommended Approach:** Return `res.status(400)` for validation errors.

**Why Better:** Correct HTTP semantics. Enables proper monitoring and error tracking.

**Implementation:**
1. Change `res.status(200)` to `res.status(400)` in `login.controller.js:15`
2. Change `res.status(200)` to `res.status(400)` in `registration_v2.controller.js:30`
3. Audit all other controllers for similar issues

---

### Finding 23: Reset Token Not Invalidated After Use

**Location:** `app/routes/forgot-password.js:186-221`

**Current Approach:** After successfully resetting the password, the token is never deleted from the `reset_tokens` table. The token remains valid for its full 1-hour expiration window.

**Why This Is Suboptimal:** If a password reset link is intercepted (e.g., via email), the attacker can use it repeatedly for up to 1 hour to keep resetting the password.

**Recommended Approach:** Delete the token from the database immediately after a successful password reset.

**Why Better:** Limits the window of token reuse to a single use.

**Implementation:**
1. After the successful `UPDATE_PASSWORD` query, add: `Reset_tokens.destroy({ where: { token: token } })`
2. In the `GET /reset-password/:token` handler, also validate the token hasn't expired: check `resetToken.expiration > new Date()`

---

### Finding 24: Dead Code and Development Artifacts

**Locations:** Multiple files

| File | Lines | Issue |
|------|-------|-------|
| `app/routes/encrypt.route.js` | All | Debug encrypt/decrypt endpoints with hardcoded ciphertext — should not be in production |
| `app/models/login.model.js` | 137-141 | `ec()` function ignores its parameter, always encrypts `31` |
| `app/routes/forgot-password.js` | 149 | `User = (req, res) =>` — global variable assignment (no `const`/`let`), function never called |
| `app/routes/forgot-password.js` | 48-63 | JWT creation code that is never used in the reset flow |
| `app/email_controllers/cron-email.controller.js` | 86-88 | Cron jobs commented out — `scheduleJobs()` and `scheduleTestJobs()` are dead |
| `app/src/server.js` | 666-715 | `/rewirte-json` route (typo in name) that modifies production JSON files |
| `app/src/server.js` | 1556-1559 | `/session-checker/:random` that dumps entire session to client |
| `app/db_controllers/registration_v2.controller copy.js` | All | Copy of a file left in production |
| `app/models/login.model.js` | 7 | `console.log('model', model)` logs email and password objects |

**Recommended Approach:** Remove all dead code and development artifacts. Use environment checks for debug endpoints.

**Why Better:** Reduces attack surface, improves code clarity, prevents credential leakage through logs.

**Implementation:**
1. Delete `app/routes/encrypt.route.js` and remove its `require` from `server.js:222`
2. Delete the `ec()` function in `login.model.js`
3. Remove the global `User` assignment in `forgot-password.js`
4. Remove JWT creation code in `forgot-password.js:48-63`
5. Delete `registration_v2.controller copy.js`
6. Remove `/rewirte-json` route
7. Remove `/session-checker/:random` route or protect it behind admin auth
8. Remove all `console.log` calls that output sensitive data (email, password, UUID)
9. Implement proper logging with a logging framework (winston, pino) that respects log levels

---

### Finding 25: Inconsistent Cryptographic Approach

**Location:** `app/shared/ecdc.js`, `app/models/login.model.js:78`, `app/routes/email-marketing.js:130-137`, `app/models/visitors-of-traders.model.js:155-158`

**Current Approach:** UUID encryption/decryption using `CryptoJS.AES` with the JWT secret is implemented in 4+ different places:
- `ecdc.js` has `decryptUuid` only (no `encryptUuid`)
- `login.model.js:78` has inline encryption
- `email-marketing.js:130-137` has its own `decryptUuid` function
- `visitors-of-traders.model.js:155-158` has yet another `decryptUuid` function

**Why This Is Suboptimal:** CryptoJS AES uses MD5-based key derivation (EvpKDF), which is not recommended. The same encryption logic is duplicated in multiple files with slight variations. The `ecdc.js` utility only provides decryption, so encryption is scattered inline.

**Recommended Approach:** Centralize all UUID encryption/decryption in `ecdc.js`. Consider migrating to Node.js built-in `crypto` module with `aes-256-gcm` for authenticated encryption.

**Why Better:** Single source of truth for cryptographic operations. Authenticated encryption prevents tampering.

**Implementation:**
1. Add `encryptUuid` to `app/shared/ecdc.js`
2. Replace all inline `CryptoJS.AES.encrypt(uuid, JWT_SECRET)` calls with `ecdc.encryptUuid(uuid)`
3. Replace all inline `CryptoJS.AES.decrypt(...)` calls with `ecdc.decryptUuid(...)`
4. Optionally migrate to `crypto.createCipheriv('aes-256-gcm', ...)` for stronger encryption

---

### Finding 26: Global Variable Pollution

**Location:** `app/routes/forgot-password.js:149`

**Current Approach:**
```js
User = (req, res) => {
    let email = req.where.email;
    ...
};
```

No `const`, `let`, or `var` declaration — this creates a global variable.

**Why This Is Suboptimal:** Global variables can collide with other modules, are accessible from anywhere, and persist for the lifetime of the process. In strict mode, this would throw a ReferenceError.

**Recommended Approach:** Add `const` declaration. Since this function is never called, it should be removed entirely.

**Why Better:** Prevents global scope pollution and potential naming collisions.

---

### Finding 27: Missing `return` After Response

**Location:** `app/controllers/login.controller.js:27-31`

**Current Approach:**
```js
if (!req.body) {
    res.status(400).send({ message: 'Content can not be empty!' });
}
// execution continues to the next block
```

**Why This Is Suboptimal:** Without `return`, execution continues past the error response, potentially causing "headers already sent" errors or unintended behavior in subsequent code.

**Recommended Approach:** Add `return` before `res.status(400)` to halt execution.

**Why Better:** Prevents double-response errors and ensures proper control flow.

---

### Finding 28: Duplicate `exports.create` Definition

**Location:** `app/controllers/login.controller.js:5,10`

**Current Approach:**
```js
exports.create = (req, res) => {};  // empty first definition
exports.create = (req, res) => { ... };  // actual implementation
```

**Why This Is Suboptimal:** The first definition is immediately overwritten. This is confusing and suggests the file was not properly reviewed.

**Recommended Approach:** Remove the empty first definition (line 5).

---

### Finding 29: `saveUninitialized: true` in Session Config

**Location:** `app/src/server.js:85`

**Current Approach:**
```js
session({ ..., saveUninitialized: true, ... })
```

**Why This Is Suboptimal:** Creates a session for every visitor, even unauthenticated ones. This bloats the session store and can be flagged by GDPR compliance tools (creating session IDs without consent).

**Recommended Approach:** Set `saveUninitialized: false`. Only save sessions that have been modified (i.e., after login).

**Why Better:** Reduces session store bloat and improves GDPR compliance.

---

### Finding 30: Long Session Cookie Lifetime

**Location:** `app/src/server.js:87`

**Current Approach:**
```js
cookie: { maxAge: 365 * 24 * 60 * 60 * 1000 }  // 1 year
```

**Why This Is Suboptimal:** Session cookies that persist for a year increase the window for session hijacking. If a session is compromised, the attacker has a year to exploit it.

**Recommended Approach:** Reduce session lifetime to a reasonable period (e.g., 7-30 days). Implement session rotation on login. Consider sliding expiration.

**Why Better:** Limits the window of session compromise.

---

### Finding 31: Session Data Exposed via Endpoint

**Location:** `app/src/server.js:1556-1559`

**Current Approach:**
```js
app.post('/session-checker/:random', function (req, res, next) {
    res.send(req.session);
});
```

**Why This Is Suboptimal:** Dumps the entire session object to the client, including encrypted UUIDs, internal state, and potentially sensitive data. The `:random` parameter provides no actual security.

**Recommended Approach:** Remove this endpoint entirely or protect it behind admin authentication with rate limiting.

---

### Finding 32: No Error Handling Middleware

**Location:** `app/src/server.js` — no global error handler

**Current Approach:** The error handler at line 181 only catches `SyntaxError` and trailing slash issues. There is no Express error-handling middleware (`(err, req, res, next)`) for catching unhandled errors in route handlers.

**Why This Is Suboptimal:** Unhandled errors in async route handlers can crash the server or return unhelpful error messages to clients.

**Recommended Approach:** Add a global error handler as the last middleware:
```js
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({ message: 'Internal server error' });
});
```

**Why Better:** Prevents server crashes and provides consistent error responses.

---

### Finding 33: `db.sequelize.sync()` on Every Startup

**Location:** `app/src/server.js:207-214`

**Current Approach:**
```js
db.sequelize.sync().then(() => { console.log('Synced db.'); });
```

**Why This Is Suboptimal:** `sync()` attempts to create/alter tables on every server start. In production with an existing schema, this is unnecessary overhead and can cause unexpected schema changes.

**Recommended Approach:** Use Sequelize migrations exclusively for schema changes. Remove `sync()` from production, or use `sync({ alter: false })` to only add missing tables.

**Why Better:** Prevents accidental schema modifications in production.

---

## Refactoring Principles (How to Change a Working System)

Do not big-bang rewrite. The app is live. Treat every change as:

1. **Extract** a function or module without changing behavior.
2. **Reuse** it in one call site, then in the copies.
3. **Delete** the old copy only after the new path is verified.
4. **Add a test** around the extracted unit before the next extraction.

### DRY (Don't Repeat Yourself)

Duplication in this codebase is mostly **copy-paste across business tiers** (trader / large / medium / small) and **copy-paste of the same HTTP/SQL shape**. Prefer one parameterized implementation plus a small config object per tier (`type`, field map, validation schema) over four parallel files.

### SOLID

| Principle | What it means here |
|-----------|-------------------|
| **S**ingle Responsibility | A route handler should not also hash passwords, build SQL, send email, and mutate `req.session`. Split into middleware, services, and repositories. |
| **O**pen/Closed | Adding a fifth account type should not require cloning `*-registration.controller.js`, validation, and four client JS files. Extend via config/strategy, not file copies. |
| **L**iskov Substitution | All registration services should share the same contract (`register(input) → { uuid, type }`) so callers do not special-case each tier. |
| **I**nterface Segregation | Do not share one 80-field `req.body` blob. Map to small DTOs (`PersonalIdentity`, `AccountCredentials`, `BusinessProfile`, `MediaUpload`). |
| **D**ependency Inversion | Controllers should depend on a `UserRepository` / `EmailService` interface, not on `db.query` and inline Nodemailer. `analytics.service.js` and `email.service.js` already point in the right direction. |

### KISS (Keep It Simple, Stupid)

Simplify before adding layers. Examples already in this review: drop unused JWT in password reset (Finding 4), delete public hash/compare endpoints (Finding 5), delete encrypt debug routes (Finding 24), stop maintaining 35 INSERT variants (Finding 17). A services layer is useful **after** duplication is collapsed, not as a new parallel architecture.

### Function size

Target: each function does one of **validate**, **map**, **query**, **mutate session**, **send email**, or **write HTTP response**. If a function needs “and” in its name (`createUserAndSendEmailAndSetSession`), split it.

---

### Finding 34: Two Parallel Architectures (Controllers vs db_controllers)

**Location:** `app/controllers/` + `app/models/` + `app/query/` versus `app/db_controllers/` + `app/db_models/`

**Current Approach:** Legacy mysql2 callback models sit beside newer Sequelize controllers. Routes mix both (`app/routes/index.js` vs `app/routes/sequelize.route.js`). Some features exist in both styles (users-accounts, registration, company updates).

**Why This Is Suboptimal:** Violates Single Responsibility at the *system* level: every feature has two places to change. New developers cannot tell which stack is canonical. Bugs get fixed in one path and left in the other (login SQL injection vs registration_v2 Sequelize).

**Recommended Approach:** Freeze the mysql2 layer. All new work goes through Sequelize services. Migrate one domain at a time (auth → registration → profile update → search → media). Keep `app/query/` as a SQL reference until that domain is gone.

**Why Better:** One way to talk to the database. Easier testing (mock models), consistent transactions, fewer injection footguns.

**Implementation:**
1. Document the rule in this file and in an `ARCHITECTURE.md` (optional, short): “Sequelize is the target DAL.”
2. Do not add new files under `app/models/` or `app/query/` except bugfixes.
3. For each migrated endpoint, keep the URL and response shape identical so the frontend does not change.
4. Delete the mysql2 controller only after the Sequelize path is live.

---

### Finding 35: Four-Tier Registration and Upgrade Duplication (DRY / OCP)

**Location:**
- `app/db_controllers/*-registration.controller.js` (trader, large, medium, small) plus `registration_v2.controller.js`
- Matching files in `app/middleware/validations/`
- Matching client scripts: `public/assets/js/*-registration*.js`, `*-validation.js`, `*-countries.js`, `*-upload-medias.js`, plus `upgrade-to-*` copies

**Current Approach:** Each business scale is a near-clone. Controllers share the same skeleton: `validationResult` → email uniqueness `findAll` → UUID + verification code → `sequelize.transaction()` → insert into users / accounts / address / business / characteristics. Differences are mostly `type` (`1–4`) and `req.body` field names (`firstName` vs `traderGivenNameOfRepresentative`).

**Why This Is Suboptimal:** A hashing, transaction, or uniqueness fix must be applied five times. Field-name drift already exists (`email already in use` vs `Email already in use`). Open/Closed is broken: a new tier means another file clone. Client-side the same country/state/city and media-upload flows are copied per page.

**Recommended Approach:** One `RegistrationService` with a per-tier **profile**:
```js
const TIERS = {
  trader: { type: 1, mapBody: mapTraderFields },
  large:  { type: 2, mapBody: mapLargeFields },
  medium: { type: 3, mapBody: mapMediumFields },
  small:  { type: 4, mapBody: mapSmallFields },
};
```
Shared steps: `assertValid(req)`, `assertEmailFree(email)`, `hashPassword(plain)`, `createAccountGraph(dto, transaction)`, `commit`, `setSession`. HTTP controllers become ~15 lines: pick tier, call service, send JSON.

On the client, extract shared modules: `countries-select.js`, `media-upload.js`, `form-validation.js`, parameterized by form field IDs.

**Why Better:** One transaction implementation, one uniqueness check, one password policy. New tiers are data, not new files.

**Implementation:**
1. Extract `assertValidation(req)` and `findAccountByEmail(email)` from `registration_v2.controller.js` first (smallest surface).
2. Extract `runInTransaction(work)` wrapping `sequelize.transaction()`.
3. Introduce `mapRegistrationDto(tier, body)` and switch **one** route (`small-scale`) onto the shared service.
4. Repeat for medium, large, trader, then upgrades (`update-*-company.controller.js`).
5. Collapse client country scripts the same way: one module, four thin page entry files.

---

### Finding 36: Fat Controllers — Split Into Focused Functions (SRP / Testability)

**Location:** Typical `exports.create` in `app/db_controllers/*-registration.controller.js` (~150 lines); `app/src/server.js` page handlers; `app/models/login.model.js`; `app/routes/forgot-password.js`; `app/routes/upload-file.js`

**Current Approach:** A single function often: reads `req.body`, checks express-validator, queries uniqueness, builds 5–7 insert objects, opens a transaction, writes session, and sends the HTTP response. Login models also encrypt UUIDs and mutate `req.session`.

**Why This Is Suboptimal:** Cannot unit-test “email already used” without spinning Express. Cannot reuse “create user graph” from an admin import or upgrade flow. Errors are handled inconsistently (`res.status(200)` vs `res.send`). Readability suffers because persistence is buried in HTTP.

**Recommended Approach:** Layering that matches existing `app/services/`:

```
route → middleware (auth, validate) → controller (HTTP only)
     → service (use-case: register, login, resetPassword)
     → repository (Sequelize / mysql2)
```

Example decomposition of registration `create`:
- `getValidationErrors(req)` — return errors or `null`
- `isEmailTaken(email)` — boolean
- `buildRegistrationRecords(dto, uuid)` — pure mapping, easy to test
- `persistRegistration(records, transaction)` — DB only
- `toRegistrationResponse(result)` — HTTP DTO

Controllers stay async and small:
```js
exports.create = async (req, res, next) => {
    const errors = getValidationErrors(req);
    if (errors) return res.status(400).json({ status: 'error', errors });
    try {
        const result = await registrationService.register('small', req.body);
        return res.json({ status: 'success', data: result });
    } catch (err) {
        next(err);
    }
};
```

**Why Better:** Pure mappers are unit-testable. Services are reusable from cron, admin, and HTTP. Controllers become boring (good).

**Implementation:**
1. Start with functions **in the same file** (no new folders yet) — KISS.
2. Move proven helpers to `app/services/` and `app/utils/` once two call sites exist.
3. Never put `res.send` inside a service.

---

### Finding 37: Callback-Style Models vs Modern async/await

**Location:** `app/models/*.js` (mysql2 callbacks); `app/controllers/*.js` wrapping `Model.create(input, (err, data) => ...)`; newer `app/db_controllers/` already using `async/await`

**Current Approach:** Legacy controllers construct a “Model” from `req.body` and pass a Node error-first callback. Newer code uses `async` functions but often still chains `.then/.catch` on already-awaited promises (see Finding 45).

**Why This Is Suboptimal:** Two async styles in one app. Callbacks make `try/catch` and `Promise.all` awkward (this is why `setTimeout(1500)` exists in Finding 18). Harder to compose and test.

**Recommended Approach:** Wrap remaining `db.query` calls once:
```js
function query(sql, params) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });
}
```
Then migrate models to `async function findByEmail(email)` using `?` placeholders. Prefer Sequelize where a model already exists.

**Why Better:** One control-flow model. Enables `Promise.all` instead of timeouts. Matches Express 5 async error handling.

**Implementation:**
1. Add `app/utils/mysql.js` promisify helper.
2. Convert `login.model.js` first (security-critical, Finding 2).
3. Leave other models until that domain is migrated (Finding 34).

---

### Finding 38: Repeated Validation / Error-Response Boilerplate

**Location:** Almost every `app/db_controllers/*.js` and several `app/controllers/*.js`

**Current Approach:** Copied block:
```js
const errors = validationResult(req);
try {
    if (!errors.isEmpty()) {
        return res.status(200).send({ message: errors.array() });
    }
} catch (error) {
    return res.status(400).json({ error: { message: error } });
}
```
Empty stub `exports.create = (req, res) => {};` then a second real `exports.create` appears in many controllers (login, forgot-password, small/medium/upgrade, visitors, users, …).

**Why This Is Suboptimal:** The `try/catch` around a synchronous `validationResult` never catches validator failures usefully. HTTP 200 on validation failure (Finding 22) is copy-pasted everywhere. Empty first exports are noise (Finding 28 is not unique to login).

**Recommended Approach:** One middleware:
```js
// app/middleware/handle-validation.js
module.exports = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ status: 'error', errors: errors.array() });
    }
    next();
};
```
Mount after field validators: `app.post('/api/...', schema, handleValidation, controller.create)`. Delete empty `exports.*` stubs.

**Why Better:** One status code policy. Controllers lose 15 repeated lines. Matches KISS.

---

### Finding 39: Client JavaScript Duplication and Weak Bundling

**Location:** `public/assets/js/` (~100 files); `webpack.config.js` (single entry `home.js` → `public/assets/js-min/home.js`)

**Current Approach:** Per-page scripts for registration, edit profile, upgrade, countries, media, and validation. Copies exist (`selection copy.js`, `landing-signage copy.js`, `region-of-operation-toogle copy.js`). jQuery 3.3.1 is vendored alongside 3.6.x from templates. Webpack does not bundle the rest of the app.

**Why This Is Suboptimal:** DRY violation on the frontend matches the backend tier clones. Duplicate libraries increase payload. Unbundled scripts mean no shared modules, no tree-shaking, and harder CSP (inline/nonce already strained — Finding 10).

**Recommended Approach:**
- Extract shared ES modules: `geo-select`, `media-fields`, `password-rules`, `api-client`.
- Webpack (or a later Vite step) with multiple entries: `home`, `registration`, `profile`, `selection`.
- Delete `* copy.js` and unused `test.js`.
- Keep jQuery only where UIkit still requires it; do not add a second jQuery file.

**Why Better:** Smaller pages, one geo-dropdown bugfix, clearer CSP surface.

**Implementation:**
1. Do not rewrite all client JS at once. Start by concatenating country-select helpers used by four registration pages.
2. Add a second Webpack entry only when a module is imported from two pages.
3. Leave UIkit/jQuery in `includes/scripts` until a dedicated UI modernization (see `UI_UX_MOBILE_RECOMMENDATIONS.md`).

---

### Finding 40: Session and HTTP Coupled to Domain Models (Testability / DIP)

**Location:** `app/models/login.model.js` (receives `session` on the model instance); page routes in `server.js`; visitor models writing `session.items`

**Current Approach:** Domain objects accept `req.session` and write to it during SQL callbacks. Controllers named `Controller` wrap `models/*.model.js`.

**Why This Is Suboptimal:** Unit tests would need a fake Express session to test password compare. Violates Dependency Inversion: the model depends on the web layer. Naming (`const Controller = require('../models/login.model.js')`) hides the real dependency.

**Recommended Approach:** Models/repositories return plain data `{ uuid, type, passwordHash }`. `auth.service.js` compares passwords and returns a user. Controller or `session.service.js` assigns `req.session.user`. Rename imports to match layer (`LoginModel`, `UsersAccountsRepo`).

**Why Better:** Auth can be tested with a stub repository. Session policy (lifetime, rotation) lives in one place (Findings 29–30).

---

### Finding 41: Unused or Overlapping Dependencies

**Location:** `package.json`; `app/src/server.js`

**Current Approach:** `cookie-session` is required in `server.js` but Express `express-session` is what is used. `passport` and `passport-local` are listed but unused. `method-override` is documented in the server banner but not wired. `body-parser` is redundant with Express 5 (`express.json()`, `express.urlencoded()`). `nodemon` and `npm-check-updates` sit in `dependencies` instead of `devDependencies`. `test` script does not run tests.

**Why This Is Suboptimal:** Larger install surface, audit noise, confusion about which session library is active.

**Recommended Approach:** Remove unused packages after confirming no dynamic `require`. Move dev tools to `devDependencies`. Replace `body-parser` with built-in Express parsers when touching `server.js`.

**Why Better:** Smaller attack surface (`npm audit`), faster CI installs, honest architecture.

---

### Finding 42: Mixed Promise Anti-Patterns

**Location:** Registration controllers (`emailExist = await Users_accounts.findAll(...).then(...).catch(...)`)

**Current Approach:** `await` plus `.then/.catch` that **returns an error string** instead of throwing. Callers then check `emailExist.length`, which throws if `emailExist` is a string.

**Why This Is Suboptimal:** Errors look like success data. Unreadable. Breaks SRP of error handling. Can crash on DB failure (similar class of bug as Finding 19).

**Recommended Approach:**
```js
let accounts;
try {
    accounts = await Users_accounts.findAll({ where: { email_or_social_media: email } });
} catch (err) {
    throw err; // let global handler (Finding 32) respond 500
}
if (accounts.length > 0) return res.status(409).json({ status: 'error', message: 'Email already in use' });
```
Use `findOne` instead of `findAll` for uniqueness checks.

**Why Better:** Correct control flow, cheaper query, consistent API errors.

---

### Finding 43: No Shared HTTP Client or Response Mapper on the Server

**Location:** Controllers send `res.send(data)`, `res.send('success')`, `res.send({ message })`, `res.status(500).send({ message })` interchangeably (`small-scale-company.controller.js` returns the string `'success'`).

**Current Approach:** Each controller invents a payload. Frontend must special-case strings vs objects.

**Why This Is Suboptimal:** Reusability and testability suffer; contract tests cannot assert one shape. Monitoring cannot count errors by `status`.

**Recommended Approach:** Tiny helpers (KISS — not a framework):
```js
const ok = (res, data) => res.status(200).json({ status: 'success', data });
const fail = (res, code, message) => res.status(code).json({ status: 'error', message });
```
Migrate one API family (login/registration) then the rest.

**Why Better:** Matches General Recommendation 5. Frontend can rely on `status`.

---

### Finding 44: Performance — N+1 Title Lookups and Unindexed Random Sort

**Location:** `app/models/visitors-of-traders.model.js` `fetchTitle` per category; `selection.model.js` `ORDER BY RAND()` (Finding 21); large JSON country/state files loaded in the browser per page

**Current Approach:** Sequential lookups for major/sub/minor category titles; full table random sort for home/selection cards; geo JSON fetched or embedded repeatedly.

**Why This Is Suboptimal:** Extra round-trips per profile view. `ORDER BY RAND()` scales with table size. Repeated geo JSON hurts TTFB on registration/edit pages.

**Recommended Approach:** Join category titles in one query (or Sequelize `include`). Cache lookup tables in memory (they change rarely). For geo, load `countries.json` once as a static asset with long cache headers (HTML stays `no-cache` as today). Replace RAND as in Finding 21.

**Why Better:** Faster pages without changing UX.

---

### Finding 45: Readability — Dead Copies, Typos, Misleading Names

**Location:** `registration_v2.controller copy.js`; `selection.model copy.js`; `selection.model copy 2.js`; route `/rewirte-json`; `getRegionOfOpertaionByIso`; `Controller` imported from a model file; leftover “tutorials” error strings copied from a boilerplate (`Some error occurred while retrieving tutorials.`)

**Current Approach:** Duplicate files and tutorial leftovers remain in the tree.

**Why This Is Suboptimal:** Search and reviews waste time. Wrong file can be edited. Looks unmaintained.

**Recommended Approach:** Delete copies. Fix typos when touching those routes. Replace boilerplate strings. Name layers accurately.

**Why Better:** Maintainability with almost no runtime risk if files are truly unused (grep first).

---

## Suggested Target Layout (Incremental)

Move toward this only as files are touched — do not create empty folders “for later”:

```
app/
  src/server.js              # bootstrap only
  routes/                    # HTTP wiring
    pages/
    api/
  middleware/                # auth, validation, view-data, rate-limit
  services/                  # use-cases (already started: email, analytics)
  repositories/              # Sequelize + remaining mysql2
  db_models/                 # Sequelize models
  utils/                     # formatting, mysql promisify, crypto (ecdc)
  config/
public/
  assets/js/
    shared/                  # geo-select, media-upload, api-client
    pages/                   # thin page entrypoints
```

Keep EJS views as they are unless a UI task requires a change (`UI_UX_MOBILE_RECOMMENDATIONS.md`).

---

## Prioritized Improvement Roadmap

### High Priority (Immediate — Security Risks / Data Loss)

| # | Finding | Effort | Impact |
|---|---------|--------|--------|
| 1 | **SQL Injection in search** (Finding 1) | Medium | Prevents data breach |
| 2 | **SQL Injection in login** (Finding 2) | Low | Prevents auth bypass |
| 3 | **Plaintext password on reset** (Finding 3) | Low | Prevents credential exposure |
| 4 | **Remove public bcrypt oracle** (Finding 5) | Low | Closes brute-force vector |
| 5 | **Rotate all secrets/credentials** (Findings 8, 9) | Medium | Limits exposure window |
| 6 | **Add auth middleware to API routes** (Finding 6) | Medium | Prevents unauthorized access |
| 7 | **Fix null crash in password reset** (Finding 19) | Low | Prevents DoS |
| 8 | **Remove JWT from reset token** (Finding 4) | Low | Eliminates password exposure |
| 9 | **Enable Helmet/CSP** (Finding 10) | Medium | XSS/clickjacking protection |
| 10 | **Add rate limiting** (Finding 7) | Low | Brute-force protection |
| 11 | **Add file upload validation** (Finding 12) | Low | Prevents malicious uploads |
| 12 | **Invalidate reset tokens after use** (Finding 23) | Low | Single-use token security |

### Medium Priority (Within 2-4 Weeks — Correctness / Reliability)

| # | Finding | Effort | Impact |
|---|---------|--------|--------|
| 13 | **Fix SQL logic bug** (Finding 20) | Low | Correct search results |
| 14 | **Fix race condition** (Finding 18) | Medium | Reliable data loading |
| 15 | **HTTP status codes** (Finding 22) | Low | Correct API semantics |
| 16 | **TLS verification** (Finding 11) | Low | Email transport security |
| 17 | **Enable cron jobs** (Finding 24 cron) | Low | Features actually run |
| 18 | **Add global error handler** (Finding 32) | Low | Prevents crashes |
| 19 | **Fix missing returns** (Finding 27) | Low | Prevents double-response |
| 20 | **Reduce session lifetime** (Finding 30) | Low | Session security |
| 21 | **Fix saveUninitialized** (Finding 29) | Low | GDPR compliance |

### Low Priority (Within 1-3 Months — Maintainability / Code Quality)

| # | Finding | Effort | Impact |
|---|---------|--------|--------|
| 22 | **Consolidate email service** (Finding 16) | Medium | DRY, maintainability |
| 23 | **Dynamic media queries** (Finding 13, 17) | High | Massive duplication reduction |
| 24 | **Extract server.js modules** (Finding 14, 15) | High | Code organization |
| 25 | **Centralize UUID encryption** (Finding 25) | Low | Consistency |
| 26 | **Replace ORDER BY RAND** (Finding 21) | Low | Performance |
| 27 | **Remove dead code** (Finding 24, 45) | Medium | Code hygiene |
| 28 | **Remove global variable** (Finding 26) | Low | Code quality |
| 29 | **Remove session-checker** (Finding 31) | Low | Security hygiene |
| 30 | **Remove duplicate empty exports** (Finding 28, 38) | Low | Code quality |
| 31 | **Shared validation middleware** (Finding 38) | Low | DRY, correct HTTP codes |
| 32 | **Fix await+.then uniqueness checks** (Finding 42) | Low | Correctness, readability |
| 33 | **Trim unused npm packages** (Finding 41) | Low | Supply-chain / clarity |

### Refactor Track (Parallel After High-Priority Security — Do Not Block Production Fixes)

| # | Finding | Effort | Impact |
|---|---------|--------|--------|
| 34 | **Freeze mysql2; migrate by domain** (Finding 34) | High | One architecture |
| 35 | **Single RegistrationService + tier config** (Finding 35) | High | DRY, Open/Closed |
| 36 | **Split fat controllers into functions/services** (Finding 36) | Medium | SRP, testability |
| 37 | **Promisify leftover mysql2** (Finding 37) | Medium | Modern async |
| 38 | **Decouple session from models** (Finding 40) | Medium | Testability |
| 39 | **Shared client modules + Webpack entries** (Finding 39) | High | Frontend DRY, performance |
| 40 | **Uniform JSON helpers** (Finding 43) | Low | API consistency |
| 41 | **Join/cache category titles; cache geo JSON** (Finding 44) | Medium | Performance |

**Rule:** Security High Priority items ship first. Refactor track may proceed **file-by-file** on any module you already touch for a security fix (e.g. while fixing login SQL injection, also extract `findAccountByEmail` and stop stuffing `session` into the model).

---

## General Recommendations

### 1. Testing Strategy (testability)

The codebase has zero tests (`npm test` exits 1). That is the largest quality risk for refactoring a working production app: without tests, every extraction is a guess.

**Immediate actions:**
- Install Jest and Supertest (or Node’s built-in test runner + Supertest).
- Write integration tests for critical paths: login, registration, password reset, search.
- Add tests for auth middleware before deploying it.
- Unit-test **pure** helpers first (field mappers, `buildInsertQuery`, session view-data). Those need no database.
- Target: at minimum, cover every API endpoint in `app/routes/index.js` and `app/routes/sequelize.route.js`.

**How to make code testable (do this while extracting functions):**
- Do not pass `req`/`res` into services — pass DTOs.
- Do not write `req.session` inside models — return data, let the controller set session.
- Inject `Users_accounts` (or a repository) so tests can stub `findOne`.
- Prefer `throw` + global error middleware over returning error strings.

**Long-term:** Test pyramid — many unit tests for services/mappers, fewer integration tests for routes, a small set of E2E flows (register → login → edit profile).

### 2. Architectural Migration Strategy

The codebase has two data access layers (raw mysql2 + Sequelize ORM). The recommended migration path is:
1. **Stop writing new code in the raw SQL layer.** All new features should use Sequelize.
2. **Migrate controllers one at a time** to Sequelize, starting with the highest-risk ones (login, search, forgot-password).
3. **Keep the `app/query/` files** as a reference for the SQL semantics during migration.
4. **Do not attempt a big-bang rewrite.** Migrate one controller at a time, verify, deploy.

### 2b. Function Decomposition Playbook (KISS then SRP)

When a file is already open for a bugfix:

1. Identify the mixed concerns (HTTP, validation, DB, email, session).
2. Extract the **pure** part first (object mapping). No I/O — easiest tests.
3. Extract I/O next (`findAccountByEmail`, `insertUserGraph`).
4. Leave `res.json` in the controller.
5. If the same helper appears twice, move it to `app/utils/` or `app/services/`. If it appears once, keep it local.

Avoid creating a deep class hierarchy. Functions plus a thin service object are enough for this Express app.

### 2c. First week of refactor (safe, visible wins)

These do not change product behavior if done carefully:

1. Delete unused copies (`* copy.js`, empty `exports.create` stubs) after `rg` confirms no requires.
2. Add `handleValidation` middleware and switch login + registration_v2 to HTTP 400.
3. Extract `buildViewData` from `server.js` (Finding 15).
4. Point forgot-password and one marketing email at `EmailService`.
5. Promisify login queries and use `?` placeholders (Findings 2 + 37).
6. Add Jest + 5 tests: validation 400, login unknown user, email taken, reset missing token, search parameterized.

### 3. Environment and Secrets Management

- Use a `.env.example` file with placeholder values for developer onboarding
- Never commit `.env` to git — verify it's in `.gitignore` and remove from git history
- Use platform environment variables (e.g., PM2, Docker, hosting platform) for production secrets
- Add a startup validation script that checks all required environment variables are set and not default values

### 4. Logging

Replace `console.log` with a structured logging library (e.g., `pino` or `winston`):
- Remove all `console.log` calls that output sensitive data (passwords, UUIDs, session objects)
- Add log levels (debug, info, warn, error)
- Add request ID tracking for correlating logs across a single request
- The existing `app/src/Logger.js` is a start but only provides timestamps

### 5. API Response Consistency

Standardize API responses across all controllers:
- Success: `{ status: 'success', data: ... }`
- Error: `{ status: 'error', message: '...' }`
- Validation: `{ status: 'error', errors: [...] }`
- Use correct HTTP status codes consistently (200 for success, 400 for validation, 401 for unauthenticated, 404 for not found, 500 for server errors)

### 6. Input Validation

The validation middleware (`app/middleware/validations/`) covers registration endpoints but not most API routes. Add `express-validator` middleware to:
- All POST endpoints that accept user input
- Search/filter parameters
- File upload metadata
- URL parameters (`:id`, `:token`)

### 7. Database Indexes

Verify the following indexes exist for frequently queried columns:
- `users_accounts.email_or_social_media` (used in login, registration checks)
- `users_accounts.uuid` (used in joins and lookups)
- `users_businesses.uuid` (used in all business queries)
- `users_business_characteristics.uuid` (used in joins)
- `users_business_medias.uuid` (used in joins)
- `traders_visitors.date_created` (used in analytics)
- `user_sessions.user_id` (used in session lookups)

### 8. Dependency Management

- Review `package.json` for unused dependencies (e.g., `mysql` is listed but `mysql2` is actually used)
- Run `npm audit` regularly to identify known vulnerabilities
- Pin dependency versions to avoid unexpected breaking changes
- `helmet` is already a dependency — enable it (Finding 10). Add `express-rate-limit` and consider `hpp`.
- Move `nodemon` and `npm-check-updates` to `devDependencies`.
- Remove unused `passport`, `passport-local`, and `cookie-session` after confirming they are not required dynamically (Finding 41).
- Express 5 already parses JSON/urlencoded; `body-parser` can be dropped when `server.js` is next edited.

### 9. Git Hygiene

- Remove `registration_v2.controller copy.js`, `selection.model copy.js`, `selection.model copy 2.js`, and client `* copy.js` files
- Clean `.env` from git history using `git filter-branch` or BFG Repo-Cleaner
- Remove commented-out code blocks (the codebase has extensive commented-out code in `selection.model.js`, `visitors-of-traders.model.js`, `server.js`, and many other files)
- Use meaningful commit messages following conventional commits

### 10. Reusability Checklist

Before adding a new `*-registration*.js` or `upgrade-to-*` file, ask:
- Can this be a **parameter** on an existing service (account `type`, field map, multer field list)?
- Can the EJS page reuse an include instead of a new script?
- Can validation share `express-validator` chains (email, password, UUID, country code)?

If the answer is yes, extend the shared module. Cloning a tier is how the current duplication grew.

### 11. Performance (beyond RAND)

- Replace per-request category title lookups with joins or a process-level Map cache.
- Cache-Control is globally `no-store` in `server.js` — keep that for HTML/session pages, but serve `/assets/` and `/assets/json-original/` with hashed filenames or long `max-age`.
- Bundle repeated page JS (Finding 39) so registration pages do not download four copies of country logic.
- Prefer `findOne` over `findAll` for uniqueness and login.
- Use transactions already present in registration; apply the same pattern to upgrades and media inserts.

### 12. Related document

Mobile/UI work is out of scope here; see `UI_UX_MOBILE_RECOMMENDATIONS.md`. Do not mix large CSS/nav changes into security or registration-service PRs.

---

## Appendix: File-by-File Quick Reference

| File | Key Issues |
|------|-----------|
| `app/src/server.js` | Monolithic (1587 lines), duplicated session data, dead routes, no error handler |
| `app/routes/index.js` | No auth middleware on most routes |
| `app/routes/upload-file.js` | 30+ duplicate handlers (1878 lines), no file validation |
| `app/routes/forgot-password.js` | Plaintext password storage, JWT with password, null crash, global variable, TLS disabled |
| `app/routes/password.js` | Public bcrypt oracle — DELETE THIS FILE |
| `app/routes/encrypt.route.js` | Debug endpoints with hardcoded data — DELETE THIS FILE |
| `app/routes/email-marketing.js` | 4x duplicated email transport, TLS disabled |
| `app/models/selection.model.js` | SQL injection, logic bugs, ORDER BY RAND |
| `app/models/login.model.js` | SQL injection, password in SELECT, console.log of credentials, dead code |
| `app/models/visitors-of-traders.model.js` | Race condition with setTimeout, duplicated decrypt |
| `app/controllers/login.controller.js` | Status 200 on validation, duplicate exports, missing return |
| `app/db_controllers/registration_v2.controller.js` | Client-side password hashing trust, status 200 on validation |
| `app/config/email.config.js` | Hardcoded personal email addresses, TLS disabled |
| `app/middleware/helmet/index.js` | Incomplete CSP, commented out in server.js |
| `app/shared/ecdc.js` | Only decrypt, no encrypt — incomplete utility |
| `app/query/users_business_medias.query.js` | 35+ INSERT variants — combinatorial explosion |
| `app/db_models/index.js` | `sync()` on every startup |
| `app/services/email.service.js` | Well-structured but underutilized — **extend this pattern** |
| `app/services/analytics.service.js` | Well-structured, good use of Sequelize — **reference implementation** |
| `app/db_controllers/*-registration.controller.js` | Four cloned create-flows; extract `RegistrationService` (Finding 35) |
| `app/controllers/*.js` (legacy) | Empty export stubs; callback models; HTTP mixed with persistence |
| `app/src/Logger.js` | Timestamp wrapper only — replace with pino/winston |
| `webpack.config.js` | Single entry (`home.js`); expand when shared client modules exist |
| `public/assets/js/*-registration*.js` | Per-tier clones of validation, countries, uploads (Finding 39) |
| `package.json` | Unused passport/cookie-session; no real test script |
| `.env` | Default secrets, exposed credentials |
