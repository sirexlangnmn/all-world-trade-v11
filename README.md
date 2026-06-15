# All World Trade (v10)

B2B trade and networking platform connecting businesses across four tiers: traders, small-scale, medium-scale, and large-scale companies.

## Tech Stack

- **Backend:** Node.js, Express.js 5, Sequelize 6 (MySQL)
- **Frontend:** EJS templates, Tailwind CSS 4, Webpack 5
- **Real-time:** Socket.io (WebRTC video meetings via MiroTalk)
- **Auth:** Passport.js (local), JWT, bcrypt
- **Other:** PDFKit, Nodemailer, node-cron, Multer

## Directory Structure

| Directory | Purpose |
|-----------|---------|
| `app/` | Core backend — controllers, models, routes, middleware, services, queries |
| `public/` | Frontend assets — EJS views, CSS, JS, images, uploads |
| `migrations/` | Sequelize database migrations |
| `models/` | Legacy Sequelize models |
| `config/` | Sequelize CLI configuration |

## Business Tiers

- **Type 1:** Traders (individual)
- **Type 2:** Large-scale companies
- **Type 3:** Medium-scale companies
- **Type 4:** Small-scale companies

## Setup

1. Copy `.env` and configure database and SMTP credentials
2. Run `npm install`
3. Run migrations: `npx sequelize-cli db:migrate`
4. Start dev server: `npm run dev`
5. Build Tailwind: `npm run tailwindBuild`
6. Build JS: `npm run build`

## Key Scripts

- `npm run dev` — Start with nodemon
- `npm run start` — Start production server
- `npm run build` — Webpack JS minification
- `npm run tailwindBuild` — Build Tailwind CSS
# all-world-trade-v11
