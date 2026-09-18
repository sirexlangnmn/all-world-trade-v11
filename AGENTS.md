# AGENTS.md

Monolithic Express SSR app (EJS + MySQL). Deep reference: `README.md` — it is accurate; trust it for detail.

## Commands

- `npm run dev` — nodemon on `app/src/server.js` (the real entry; package.json `main` points at a nonexistent root `server.js`). `npm start` = plain node.
- `npm run tailwindBuild` — watch-builds CSS from `public/assets/css/input.css` to `public/assets/css-tailwind/output.css`. After any CSS/class change to `.ejs`/`.js` content, this output must be regenerated.
- `npm run webpackBuild` — bundles ONLY `public/assets/js/home.js` -> `public/assets/js-min/home.js`. All other client JS is used raw.
- `npm run lint` = `npx prettier --write .` (4-space tabs, single quotes, printWidth 120, trailing commas).
- No test suite (`npm test` intentionally fails). Verify work by running the server, not tests.

## Architecture (you will get lost without this)

- **Two parallel stacks exist.** Legacy: `app/controllers/` + `app/models/` (raw SQL via mysql2 pool; SQL strings isolated in `app/query/`). Sequelize: `app/db_controllers/` + `app/db_models/`. Put new code in the Sequelize stack.
- **EJS views live in `public/view/`**, and `public/` is served statically. Access an existing page's template via its folder name; page GET routes are also defined inline in `app/src/server.js` (use `renderPage(res, '<view-folder>', {data})`).
- **Ignore the vestigial Sequelize-CLI artifacts**: root `models/`, `migrations/`, `config/config.json` (all commented out) are unused. Real models are `app/db_models/`; real config comes from `.env`.
- **`db.sequelize.sync()` runs on every boot** (`app/src/server.js:207`): tables are created/updated from model definitions, not migrations.
- **Routes** are modules in `app/routes/*.js` exporting a function of `app`. Prefixes: `/api/` (legacy mysql2), `/api/v2/` + `/api/v3/` (Sequelize). Upload routes in `app/routes/upload-file.js` (multer -> `public/uploads/`).
- **Auth**: `express-session`; `req.session.user` holds `{uuid, type, ...}` where `uuid` is AES-encrypted. Decrypt via `app/shared/ecdc.js` (`decryptUuid`). Every `req.session.user.uuid` must go through `ecdc` before DB lookups.

## Environment & data

- `.env` at repo root is required and gitignored (no committed sample). It supplies DB creds, `PORT` (3000), secrets, and `AWT_HOSTNAME` (used to build absolute URLs in emails/JS).
- DB is MySQL; this checkout points at local `allworldtrade` (`DB_SERVERHOST=localhost`, `DB_USERNAME=dbeaver`). Sequelize pool lives in `app/config/db.config.js` + `sequelize.config.js`.
- All timestamps/logic use Philippine time (`Asia/Manila`); helpers in `app/utils/date.utils.js`.
- Server runs plain HTTP locally (`isHttps = false` at `app/src/server.js:136`); TLS certs under `app/ssl/` exist but are only used when `isHttps` is flipped.

## Frontend

- UIKit + Tailwind (v4 CLI) + Flowbite. Geo dropdown data (countries/states/cities) is fetched client-side from `public/assets/json/`.
- Modernization/UX recommendations live in `UI_UX_MOBILE_RECOMMENDATIONS.md`; review notes in `CODE_REVIEW.md` — read both before touching frontend or refactoring.