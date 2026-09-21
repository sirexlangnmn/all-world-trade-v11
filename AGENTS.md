# AGENTS.md

Monolithic Express SSR marketplace (EJS + MySQL) for B2B trade networking: businesses across four tiers (Trader / Large / Medium / Small) register profiles, publish media, search each other, meet via MiroTalk/WebRTC, and exchange contact emails. Deep reference: `README.md` (architecture, ERD, deployment) and `CODE_REVIEW.md` (known issues + refactor playbook) — read both before touching code.

## Commands

- `npm run dev` — `nodemon app/src/server.js` (the real entry; package.json `main` points at a nonexistent root `server.js`).
- `npm start` — plain `node app/src/server.js`.
- `npm run tailwindBuild` — `tailwindcss -i ./public/assets/css/input.css -o ./public/assets/css-tailwind/output.css --watch`. Regenerate after ANY CSS/class change in `.ejs`/`.js`.
- `npm run webpackBuild` — `webpack`. Bundles ONLY `public/assets/js/home.js` -> `public/assets/js-min/home.js`. All other client JS is used raw.
- `npm run lint` — `npx prettier --write .` (Prettier config in `.prettierrc.js`: 4-space tabs, single quotes, printWidth 120, trailing commas all). NOTE: README §15.3 claims `--check`; package.json is authoritative (`--write`).
- `npm test` — intentionally fails (stub). No test suite. Verify work by running the server, not tests.

## Architecture (you will get lost without this)

- **Two parallel data-access stacks exist.**
  - Legacy: `app/controllers/` + `app/models/` (raw SQL via mysql2 pool; SQL strings isolated in `app/query/`). Callback style: `Model.method(params, (err, data) => ...)`.
  - Sequelize: `app/db_controllers/` (async/await) + `app/db_models/`. **Put all new code in the Sequelize stack**; treat mysql2 layer as frozen (see CODE_REVIEW Finding 34).
- **Boot sequence** (`app/src/server.js`): dotenv -> cors (origin whitelist) -> compression -> body-parser -> express-session -> nonce -> custom header middleware -> static `public/` -> express.json/urlencoded -> trailing-slash/body error handler -> `db.sequelize.sync()` (`server.js:207`) -> `/api/` routes -> `/api/v2/v3` routes -> cron. Then page GET routes defined inline (use `renderPage(res, '<view-folder>', {data})`, `server.js:297`).
- `db.sequelize.sync()` runs on **every boot** — tables are created/updated from `app/db_models/` definitions, not migrations. Root `models/`, `migrations/`, `config/config.json` are commented-out Sequelize-CLI artifacts — unused.
- **Route modules** in `app/routes/*.js` export `module.exports = (app) => {...}`:
  - `index.js` — legacy `/api/` controllers (categories/sub-categories/minor, global-region, languages, login-process, selection, visitors-of-traders, get-count, etc.).
  - `sequelize.route.js` — `/api/v2/` + `/api/v3/` (per-tier registrations, registration-v2, communicator/support links+waiting rooms, updates, export-users-businesses).
  - `password.js` — `/api/post/password-hashing`, `/api/post/compare-password` (bcrypt oracle, see debt).
  - `upload-file.js` (1,878 lines) — 30+ near-identical multer POST handlers for media combos; no file filter/size validation.
  - `email-marketing.js` — `/api/v3/post/submit-client-email-to-the-trader`, `/api/post/emails/introduction`, `/api/post/emails/notify-trader-on-client-contact`.
  - `forgot-password.js` — `/forgot-password`, `/reset-password/:token`, `/api/post/create-reset-token`, `/api/post/send-email-for-change-password`.
  - `encrypt.route.js` — `/api/v2/post/ec`, `/api/v2/post/dc` (debug CryptoJS AES endpoints; dead/dev artifact).
- **Cron**: `app/email_controllers/cron-email.controller.js` registers node-cron jobs at `server.js:163` (midnight daily activity report email + auto-logout clearing `users_accounts.login_status`).
- **Socket.io**: `io = new Server().listen(server)` (HTTP). Used for communicator peer signaling with MiroTalk (external `meet.allworldtrade.com`). `app/api/swagger.yaml` documents the MiroTalk room API (`/api/v1`, `authorization: {API_KEY_SECRET}`). `swagger-ui-express`/`yamljs` are deps but no `/api-docs` route is wired in `server.js`.

## Auth & sessions

- `express-session` (NOT cookie-session — `cookie-session` is required at `server.js:47` but unused). Config: `secret: SESSION_SECRET`, `resave: false`, `saveUninitialized: true`, `cookie { httpOnly, sameSite:'strict', maxAge 1yr }`.
- `req.session.user` holds `{uuid, type, first_name, last_name, email_or_social_media, ...}` where **uuid is AES-encrypted**. Every UUID lookup must first call `ecdc.decryptUuid(req.session.user.uuid)` from `app/shared/ecdc.js` (CryptoJS AES keyed on `JWT_SECRET`).
- Login: `POST /api/post/login-process` -> `app/controllers/login.controller.js` -> `app/models/login.model.js` (bcrypt.compare against `users_accounts.password`; sets `login_status=1`, writes `user_sessions`, sets session). Logout handler at `server.js:1510`.
- **There is NO auth middleware on API routes** — page routes check `req.session.user` (see the `isUserLoggedIn`/`checkUserLoginStatus` helpers near `server.js:308`), APIs generally do not. See debt.
- Helmet is commented out (`server.js:96-98`); only `X-Frame-Options: sameorigin` + `Cache-Control: no-store` are set manually. Nonce plumbing (`app/middleware/nonces`, `app/middleware/helmet`) exists but CSP is disabled.

## Database & models

- Config from env: `DB_SERVERHOST, DB_USERNAME, DB_PASSWORD, DB_NAME, DB_DIALECT` -> `app/config/db.config.js` (mysql2 pool, auto-reconnect) and `app/config/sequelize.config.js` (Sequelize pool).
- Schema defined by `app/db_models/index.js` (17 models): `users`, `users_accounts`, `users_address`, `users_businesses` (model registered as `'users_business'` -> Sequelize pluralizes table `users_businesses`), `users_business_characteristics`, `users_business_medias`, `users_business_visibility`, `user_sessions`, `user_download_histories`, `reset_tokens`, `support_accounts`, `support_links`, `support_messages`, `traders_visitors`, `prospects`, `contact_requests`, `waiting_rooms`. See `README.md` §10/§11 for full column lists and ERD.
- Relationships are **logical via `uuid`**, not DB-level FKs.

## Business rules (verified against code/README)

- `users.type` / `users_accounts.type`: **1=Trader, 2=Large, 3=Medium, 4=Small** (tier-gated profile/upgrade pages).
- `users_accounts.status`: 0=pending, 1=verified, 2=disabled. `login_status`: 0=logged out, 1=logged in.
- `users_businesses.status`: 0=draft, 1=published. `isPaid`: 0=free, 1=paid. Search endpoint `getAllBySearchParameter` only returns `isPaid = 1` rows that have logo+banner media.
- Registration controllers (Sequelize) insert `users` + `users_accounts` + `users_address` + `users_business(es)` in one transaction; they **trust a client-supplied `hashedPassword`** (client hashes via `/api/post/password-hashing`). A 6-digit `verificationCode` is sent to the email and stored in session for `/email-verification`.
- Contact emails are capped by `FREE_CONTACT_LIMIT` env (`app/email_controllers/submit-client-email-to-the-trader.controller.js`).
- Support/help: `support_accounts` agents + `support_links` (communicator MiroTalk links) + `waiting_rooms`; legacy path `app/db_controllers/communicator.controller.js` uses `LIKE` wildcard queries.
- All timestamps/logic use **Philippine time** (`Asia/Manila`): helpers in `app/utils/date.utils.js` and `phTime()` in `server.js:239`.

## Backend conventions

- Route files: `module.exports = (app) => {...}` registering `app.get/post([...paths], middleware?, handler)`.
- Page GET handlers: build view data (`{uuid, type, first_name, last_name, email, ourGenerateNonce}`) from `req.session.user`, call `res.render(path.join(VIEW_BASE_PATH, '<folder>', 'index'), {data})` — or `renderPage(res, '<folder>', {data})`.
- Controllers: legacy wrap `app/models/*` callbacks; Sequelize controllers are async, use `sequelize.transaction()`, and typically return `res.status(200).send({message: ...})` even for validation failures.
- SQL strings live in `app/query/*.js` as raw query constants. NOTE: `selection.model.js` has been revised to use `?` parameterized placeholders (plus helpers `addEqual`/`addLike`); `login.model.js` still string-interpolates the email (see debt).
- Email: `app/services/email.service.js` (single nodemailer+handlebars, used for midnight report) is the intended pattern, but most senders instead duplicate transport config inline (see `app/shared/email-template.js`, `email-marketing.js`, `forgot-password.js`). Templates are Handlebars in `public/view/email/`. SMTP config from `EMAIL_SERVERHOST, EMAIL_PORT, SUPPORT_RECEIVER_EMAIL_ADDRESS, SUPPORT_RECEIVER_PASSWORD`; recipient list in `app/config/email-recipients.config.js` (gitignored, hardcoded emails).

## Frontend

- UIKit + Tailwind (v4 CLI) + Flowbite; jQuery (3.6.x). Geolocation dropdown data (countries/states/cities) fetched client-side from `public/assets/json/`.
- EJS views under `public/view/<page-folder>/index.ejs`; shared partials in `public/view/includes/` (head, header*, nav/primary-navigation, footer, scripts, profile, modal). Email templates share `public/view/email/`.
- `public/assets/css/input.css` -> Tailwind output `public/assets/css-tailwind/output.css`; handwritten CSS in `public/assets/css/`.
- Client JS per page in `public/assets/js/` (many near-duplicate per-tier registration/upgrade/countries/upload scripts, some `* copy.js` leftovers; webpack bundles only `home.js`).
- Uploads via multer -> `public/uploads/users_upload_files/` (served statically). `public/uploads/` also holds site media (banners, logos, signage).
- Read `UI_UX_MOBILE_RECOMMENDATIONS.md` (mobile UX audit with P0-P3 priorities) and `CODE_REVIEW.md` (esp. Finding 39) before frontend/refactor work.

## Environment (names only — never commit/get values)

Keys referenced by code (see `README.md` §14 for roles): `DB_SERVERHOST, DB_USERNAME, DB_PASSWORD, DB_NAME, DB_DIALECT, PORT, NODE_ENV, AWT_HOSTNAME, API_KEY_SECRET, SESSION_SECRET, JWT_SECRET, EMAIL_SERVERHOST, EMAIL_PORT, EMAIL_SECURE, EMAIL_USER, EMAIL_PASSWORD, EMAIL_SENDER_ADDRESS, PAYMENT_EMAIL_ADDRESS, PAYMENT_EMAIL_ADDRESS_PASSWORD, SUPPORT_RECEIVER_EMAIL_ADDRESS, SUPPORT_RECEIVER_PASSWORD, FREE_CONTACT_LIMIT`. `.env` is gitignored; there is **no committed `.env.example`**.

## Deployment / HTTPS

- Server runs plain HTTP locally: `isHttps = false` at `server.js:136` (must match client expectations). TLS certs under `app/ssl/` (`cert.pem`/`key.pem`) used only when `isHttps` is flipped.
- Recommended prod: PM2 `pm2 start app/src/server.js --name allworldtrade`, Nginx reverse proxy on 443 (WebSocket upgrade for `/socket.io/`), MySQL `awt_prod_db_02_01`. See README §13.

## Known technical debt & risks (from `CODE_REVIEW.md` — some fixed, verify current state before acting)

- **Critical, likely STILL present**: SQL injection in `app/models/login.model.js` (email interpolated into raw SQL); plaintext password stored on reset (`forgot-password.js` stores `req.body.password3` directly); public bcrypt oracle (`app/routes/password.js`); no auth middleware on most API routes; no rate limiting; Helmet/CSP disabled; multer with no file filters or size limits; `tls: { rejectUnauthorized: false }` on all nodemailer transports; weak default env secrets; `encrypt.route.js` + `/session-checker/:random` debug endpoints; `reset_tokens` never invalidated after use.
- **Correctness**: missing null check in reset-token lookup (can 500/crash); `ORDER BY RAND()` on search; race-condition `setTimeout(1500)` in `visitors-of-traders.model.js`; validation errors return HTTP 200; legacy OR-without-parens SQL patched in selection model but audit similar patterns before touching.
- **Architecture**: 4 near-identical registration/upgrade stacks (controller + validation + client JS each, `type` 1-4 only difference); 35+ hand-maintained media INSERT variants (`app/query/users_business_medias.query.js`); monolithic 1,577-line `server.js`; two DALs; dead/` copy` files (e.g. `registration_v2.controller copy.js`, `selection.model copy.js`); unused deps (`passport`, `passport-local`, `cookie-session`, `body-parser`, `method-override`).
- Routinely run `npm run lint` after edits; test manually via `npm run dev`.

> Recommendation: When fixing code in `login.model.js`, `forgot-password.js`, `password.js`, `upload-file.js`, or the four `*-registration*.controller.js` files, follow the extraction playbook in CODE_REVIEW.md §2b (pure mappers first, then I/O, leave `res.json` in controllers) and prefer Sequelize over raw SQL for new work.