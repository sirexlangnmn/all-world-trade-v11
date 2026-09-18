# UI/UX Mobile Recommendations — All World Trade v11

**Date:** September 17, 2026  
**Revised:** September 18, 2026 (expanded specs: tokens, chrome, selection, auth, media, platform quirks, QA)  
**Scope:** Read-only UI/UX audit of the All World Trade web application with recommendations to make it feel like a modern mobile app while preserving the existing desktop experience.
**Method:** Full codebase analysis — templates (EJS), global includes, shared navigation, client JavaScript, CSS, build/tooling config, and server route inventory. No source code was modified.
**Priorities:** P0 = critical (must fix for basic mobile usability), P1 = high (major UX gain), P2 = medium (quality polish), P3 = nice-to-have / future.

---

## 1. Executive Summary

All World Trade v11 is a server-side rendered B2B trade networking platform (Express 5 + EJS + Tailwind CSS 3.4.3 + UIkit 3 + jQuery 3.6.3, MySQL/Sequelize). The desktop experience is well established: a sticky top header, a 7-item desktop navigation, card-based content grids, and modal-driven interactions (UIkit `uk-modal`). The design system is intentionally card-based with **no HTML tables anywhere** (`public/view` contains zero `<table>`/`uk-table` tags), which is already a strong foundation for small screens.

However, the mobile experience currently reuses the desktop patterns with only minor adaptations:

- Navigation on mobile is an **icons-only 7-cell grid** (`grid-cols-7`) that sits under the logo row — each cell is roughly 45px wide on a 320px screen, relies on hover tooltips that cannot fire on touch devices, and has no text labels.
- Breakpoints are **inconsistent**: Tailwind defaults (`md` 768px, `lg` 1024px, `xl` 1280px) are mixed with a hard-coded 1015px JS switch in `primary-navigation.ejs` and custom CSS that only defines `@media (min|max-width: 1200px)` in `public/assets/css/custom.css`.
- There is **no PWA layer**: no `manifest.json`, no `apple-touch-icon`, no `theme-color` / `apple-mobile-web-app-capable` meta, no viewport `viewport-fit=cover` or safe-area handling.
- **Loading, empty, and error states are largely absent** — client JS (e.g., `public/assets/js/home.js`) writes plain text via `innerHTML` with no spinners, skeletons, or empty-state components.
- Forms and modals are functional on mobile (single-column, full-width inputs) but have small touch targets (`h-9` = 36px buttons) and no mobile-first input ergonomics (no `inputmode`/`autocomplete`/`enterkeyhint` attributes detected on key fields).

**Bottom line:** The app is *usable* but not *native-feeling* on phones at widths of 320 / 375 / 390 / 414 / 430px. The highest-impact work is: (1) introduce a mobile bottom tab bar + labeled grid fallback, (2) unify breakpoints into one responsive contract, (3) add a PWA/media meta layer, (4) standardize loading/empty/error states, and (5) raise touch-target and typography ergonomics. The existing card-based layout, dark-mode classes, and modal patterns should be preserved.

---

## 2. Codebase Understanding

### 2.1 Tech stack & tooling
- **Runtime:** Node.js, Express 5 (`app/src/server.js`, 1,577 lines — hosts all page routes, middleware, helpers).
- **Views:** EJS templates under `public/view/.../index.ejs`, assembled via shared includes.
- **Data:** Sequelize ORM + raw `mysql2` SQL (mixed in `app/models/`, `app/db_controllers/`).
- **CSS:** Tailwind CSS v3.4.3 JIT (`tailwind.config.js` content = `./public/**/*.{ejs,html,js}`, **empty `theme.extend`**), plus handwritten `public/assets/css/style.css`, `custom.css`, `form.css`, `icons.min.css`, and UIkit (`uikit.min.css`). Build output is `public/assets/css-tailwind/output.css`.
- **JS:** jQuery 3.6.3, UIkit 3, SweetAlert2 (CDN), Flowbite (CDN, one modal only), Socket.IO, plus bespoke page scripts.
- **Bundler:** Webpack configured for a single entry — `public/assets/js/home.js` → `public/assets/js-min/home.js`. All other page scripts load individually.
- **Build commands:** `npm run dev`/`start` (node `app/src/server.js`), `npm run tailwindBuild`, `npm run webpackBuild`.

### 2.2 Global layout contract
Most pages follow this shell:

```
<%- include('../includes/head/index.ejs') %>   →  head incl. viewport meta + CSS/JS
<body class="...">
  <%- include('../includes/header/index.ejs') %>   → legacy/outer header
  <%- include('../includes/nav/primary-navigation.ejs') %>  → sticky nav (all pages)
  <div id="wrapper" class="is-collapse is-active">
    ...sidebar...
    <div class="main_content_custom">   → margin-left 320px desktop / 1px collapsed
      <div class="mcontainer">          → page padding gutter
        ...page content...
      </div>
    </div>
  </div>
  <%- include('../includes/footer/index.ejs') %>
  <%- include('../includes/scripts/index.ejs') %>  → jQuery, UIkit, custom.min.js
```

References: `public/view/includes/head/index.ejs`, `public/view/includes/nav/primary-navigation.ejs`, `public/view/includes/scripts/index.ejs`, `public/view/home/index.ejs`, `public/view/selection/index.ejs`.

### 2.3 Mobile viewport & theme meta (as-is)
`public/view/includes/head/index.ejs` includes only:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```
No `viewport-fit=cover`, no `theme-color`, no `apple-mobile-web-app-*`, no `format-detection`, no PWA `manifest`.

### 2.4 Navigation model (as-is)
`public/view/includes/nav/primary-navigation.ejs`:

- **Desktop nav** (`#primaryNav`, `hidden md:flex`): 6 visible links — Home, Traders Videos, Traders Webinars, Pricing, Selections, Help (7-column grid reserved).
- **Mobile nav** (`.mobile-menu`, always in DOM): a single `grid grid-cols-7` row of **icons only** — Home, Event Calendar (`/all-about-events`), Traders Videos, Traders Webinars, Pricing, Selections, Help. Label text exists only as `uk-tooltip` (top-bottom), which does not fire on touch.
- **Toggle logic** (`toggleNav()`): switches at **1015px** via JS on `load` and `resize` — not aligned with any Tailwind token.
- **Header row**: always renders logo (`w-16 h-16` circle PNG) + "All World Trade" `<h3>` + right-side avatar/login widget — even on small screens.
- **Navigation helpers** (`goToHomePage`, `goToSelectionPage`, `goToLoginPage`) use `location.replace(...)`.

`public/view/includes/header_avatar/index.ejs` provides the signed-in avatar dropdown; `header_cart/index.ejs` is a placeholder ("Under development") included in some pages.

### 2.5 Route inventory (server pages)
Registered in `app/routes/index.js` and served from `app/src/server.js`. Relevant page routes:

- `/` — home (products, videos, webinars, sections via anchors `#tradersVideos`, `#tradersWebinars`, `#selections`)
- `/login`, `/register` (login + registration entry)
- `/registration-v2` — primary multi-part registration
- `/selection` — trader/business listing + engagement
- `/profile/traders`, `/profile/small-scale-company`, `/profile/medium-scale-company`, `/profile/large-scale-company`, `/profile/customer-service`, `/profile/help-and-support`
- `/pricing`, `/upgrade`
- `/all-about-events`
- `/forgot-password`, `/reset-password`
- Session/logout: `GET /logout` (`app/src/server.js:1510`), `POST /session-checker/:random`
- Modals: `selectionQuestion`, `client-email-the-trader`, `awt_introduction` (Flowbite)

---

## 3. Current Mobile UX Assessment

Table summarizing the state at 320–430px widths. Rating: Poor / Fair / Good / N/A (unable to determine marked explicitly).

| Area | Current state (mobile) | Rating |
|---|---|---|
| Viewport & meta | `width=device-width, initial-scale=1.0` only; no safe-area, no theme-color, no PWA tags | Fair |
| Primary navigation | Icons-only 7-cell grid under logo; tooltip labels don't work on touch; ~45px cells on 320px | Poor |
| Header | Always-on logo text + avatar/login; not compressed on small screens; no `view-viewport-fit` | Fair |
| Bottom/native navigation | None — no bottom tab bar, no swipe-back from navigation | Poor |
| Page structure | Card-based grids, no tables — responsive container (`mcontainer`) present | Good |
| Breakpoint consistency | Tailwind defaults + 1015px JS switch + 1200px custom media queries — mixed | Poor |
| Touch targets | Buttons `h-9`(36px)/`px-4 py-3`(≈40px) rows; several below 44px guideline | Fair |
| Typography | Tailwind base sizes; no explicit mobile type ramp detected; large desktop-scale headings | Fair |
| Forms | Single-column on mobile, full-width inputs, `with-border` padding 16px | Fair |
| Form ergonomics | No `inputmode`/`autocomplete`/`enterkeyhint` detected on key fields | Poor |
| Modals | UIkit `uk-modal` full/mostly-width on mobile; body scroll/content sizing OK | Good |
| Loading states | Plain `innerHTML` text; no spinners/skeletons in home/selection JS | Poor |
| Empty states | Missing | Poor |
| Error states | Mostly SweetAlert2 floats; no inline field-error styling detected on core forms | Fair |
| Dark mode | Toggle exists (`#night-mode` in `header_avatar/index.ejs` + `toggle-dark-light.js`); mix of `dark` class and `night-mode` class; unsigned users never see the toggle | Fair |
| Images/performance | Large `fetch` + `innerHTML` rendering, banner slideshow 1,495-line `landing-signage.js`; Flowbite CDN in one modal | Fair |
| Accessibility | Icon-only links without `aria-label`, tooltip-only labels, `href="#"` buttons | Poor |
| PWA/install | None | Poor |
| Pull-to-refresh / gesture UX | None detected | N/A |

---

## 4. Recommended Mobile Design Direction

Preserve the existing design system (cards, UIkit modals, `bg-blue-600/700` buttons, `dark:` variants, `.with-border` inputs) and add a **mobile-first layer** rather than a parallel design.

**Guiding principles:**
1. **Native-feel navigation** — add a sticky bottom tab bar (the most recognizable mobile-app pattern) and convert the top nav to a compact, labeled, horizontal-scrollable row (or a hamburger sheet) instead of the icons-only 7-cell grid.
2. **One responsive contract** — replace the ad-hoc 1015px/1200px switches with a single token set (recommend `sm=640, md=768, lg=1024, xl=1280`) used identically in Tailwind, CSS, and JS.
3. **Content over chrome** — keep the header minimal on small screens: small logo, page title, one primary action. Move secondary actions to the bottom bar / swipe-away sheet.
4. **State everywhere** — standard loading (skeleton), empty, and error components reused across home, selection, and profile lists.
5. **Thumb-first interactions** — 44px minimum targets, bottom-anchored primary CTAs, bottom sheet action lists (already partially present in `selectionQuestion` style: list rows with icon + title + subtitle).
6. **Mobile app cues** — `viewport-fit=cover`, `theme-color`, safe-area padding, app-like header compression on scroll, and (P3) PWA installability.

**What stays exactly the same:** desktop layouts, `.mcontainer`/`.main_content_custom` shell, modal patterns, card styling, brand colors, dark mode.

---

## 5. Recommended Mobile Navigation (wireframe)

### 5.1 Sticky bottom tab bar (new, mobile only — replaces reliance on the icons-only grid)

```
┌─────────────────────────────────────────────────────────┐
│  HEADER (compressed on scroll): [logo] All World Trade   │   ← h-14, page title
│  (contextual action · profile avatar)                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                     PAGE CONTENT                        │   ← .mcontainer
│                                                         │
├─────────────────────────────────────────────────────────┤
│  ◂ back   (contextual, non-home pages)                  │
│  ┌──────┬──────┬──────┬──────┬──────┐   ← 5 tabs, 44px+  │
│  │ Home │ Selections │ Videos │ Events │ More │  │
│  └──────┴──────┴──────┴──────┴──────┘                  │
│         safe-area-inset-bottom padding                 │
└─────────────────────────────────────────────────────────┘
```

Mapping to existing routes (all currently reachable from `primary-navigation.ejs`):
- Home → `goToHomePage()` (`/`)
- Selections → `/selection`
- Traders Videos → `/#tradersVideos`
- Events → `/all-about-events`
- More → sheet with: Traders Webinars (`/#tradersWebinars`), Pricing (`/pricing`), Help/Suggestion (`goToHelpSuggestionPage`), Login/Logout, Dark-mode toggle.

### 5.2 Compact top row (small screens)
When a bottom bar exists, the mini-grid can be replaced by either:
- A labeled **horizontal-scrollable pill row** (`overflow-x-auto`) directly under the header, or
- A hamburger that opens a UIkit `uk-offcanvas` sheet (already available since UIkit is loaded).

Recommendation: keep the 7 existing destinations but give them **text labels + active-color state**, so the touch affordance is unambiguous.

### 5.3 Back-stack behavior
Non-home pages (profile/*, pricing, upgrade, events, forgot/reset password) should show a leading back affordance that uses `history.back()` when referrer is internal, else falls back to the mapped destination.

---

## 6. Page-by-Page Recommendations

> Files referenced are the analyzed templates. Numbers are P0–P3.

### 6.1 Home — `public/view/home/index.ejs`
- **P1** Add skeleton loaders for the `fetch`-populated sections (instead of blank/gray regions) before data arrives; `public/assets/js/home.js` currently writes via `innerHTML` with no loading state.
- **P2** Convert section anchors into full-width tappable cards with clear secondary text; ensure anchor scroll targets (`#tradersVideos`, `#tradersWebinars`, `#selections`) account for the sticky header (scroll-margin-top).
- **P1** Ensure the auto-playing/featured content and banner slideshows have tap-anywhere affordances (mirror the "Click Me" onboarding idea from `QUESTION 7` for first-time users) and pause-freezing on mobile scroll.
- **P2** Add an empty/error retry UI when a `fetch` fails on slow networks.

### 6.2 Login — `public/view/login/index.ejs`
- **P1** Add `autocomplete="email"` (or `username`) + `type="email"` + `inputmode="email"` + `enterkeyhint="go"` on the email field; `autocomplete="current-password"` on password.
- **P2** Increase primary submit button to at least 48px height full-width; show inline validation error text (not only SweetAlert2).
- **P2** Preserve password visibility toggle (mobile pattern) rather than plain text field.
- **P3** Add "Sign in with Google" style primary/social rows if social login exists (`login_status` fields + `/session-checker` suggest session-driven social flow).

### 6.3 Registration — `public/view/registration-v2/index.ejs` (+ `/register`)
- **P1** Treat each form section as a full-screen "step" on mobile with a progress indicator (step x of n); keep desktop as single long form.
- **P1** Validate per-step on "Continue" and show inline field errors; scroll to first invalid field.
- **P1** Add `inputmode` (`tel`, `numeric`, `email`), `autocomplete` attributes, and `enterkeyhint="next"`/`"done"`.
- **P2** Make the file-upload/image-picker areas thumb-friendly (min 44px, clear "retake/remove" affordance) since `multer`/`sharp` uploads are central to profile setup.

### 6.4 Selection (trader list) — `public/view/selection/index.ejs`
- **P1** Use a two-row tap target (logo + name + key badges) with the chevron on the right; ensure the whole row is clickable (the engagement modal pattern already implies row-tap).
- **P2** Add skeleton states for the slideshow/`companiesProfilePicture` rendering and pull-to-refresh-style reload for the list.
- **P2** Render the "offline trader" state within the row (badge) instead of only in the modal (`selectionQuestion.ejs`).
- **P3** Add infinite scroll or "Load more" pagination instead of full list re-render.

### 6.5 Traders page — `public/view/traders-page/index.ejs`
- **P2** On mobile, stack the two-column information layout into a single column with a "top summary" (logo/banner, name, primary CTA) pinned under the header; secondary details below.
- **P2** Provide bottom-sheet actions (Contact / Download / Message) consistent with `modal/selectionQuestion.ejs`.

### 6.6 Profiles — `public/view/profile/traders.ejs` (+ small/medium/large-scale-company.ejs, customer-service, help-and-support)
- **P1** `traders.ejs` (1,323 lines) uses `lg:flex lg:space-x-10` two-column layouts; on mobile ensure first column (main profile/company content) with obvious CTA is above any utility panel, and both columns stack fully (already the case via `lg:` breakpoints — verify all inner grids collapse at 640–430px).
- **P2** Add a mobile "action bar" (sticky bottom, above the new tab bar if present) with primary CTA when viewing profiles: Contact/Message.
- **P2** Skeletons for edit forms and avatar/banner upload previews; `traders-profile.js` / small/medium/large-scale-profile.js should show uploading indicator.

### 6.7 Pricing — `public/view/pricing/index.ejs` & Upgrade — `public/view/upgrade/index.ejs`
- **P2** Price cards stack vertically (likely already via grid); keep feature lists flush and ensure long plan names don't truncate at 320px.
- **P1** On both pages, make the primary "Choose plan / Upgrade" button full-width at the card bottom with a 44px+ height.
- **P3** Sticky price summary on upgrade during payment steps.

### 6.8 Events — `public/view/all-about-events/index.ejs`
- **P2** Convert any calendar/table-like grids to mobile card list (already no tables — confirm calendar grid compresses under 430px).
- **P2** Large tap targets on event cards with "Register/Interested" actions.

### 6.9 Auth/password — `public/view/forgot-password/index.ejs`, `public/view/reset-password/index.ejs`
- **P1** These are single-purpose pages — make them full-height centered layouts with a single full-width 48px CTA and keyboard-friendliness (`enterkeyhint="done"`).
- **P1** (Code note: `app/routes/forgot-password.js` stores the new password — this is a **security finding already documented in `CODE_REVIEW.md`**, out of UX scope but flag for follow-up since users also reset on mobile.)

### 6.10 Modals — `public/view/modal/*.ejs`
- **selectionQuestion.ejs (P2)** — already an excellent mobile pattern (icon + title + subtitle list rows). Standardize `downloadTraderDetails`, `contactTheTrader`, `goToClientEmailTheTrader` rows at ≥56px height; add `role="dialog"`/`aria-modal`/labels via UIkit defaults if not automatic.
- **client-email-the-trader.ejs (P1)** — the textarea is 12 rows tall and body is `space-x-6` with `g:w-8/12` (typo for `lg:w-8/12`) — on mobile drop the horizontal spacing, reduce initial textarea rows to ~6 with auto-grow, and make the footer action full-width. The Send button is `h-9` (36px) — raise to 44px.
- **awt_introduction.ejs (P2)** — Flowbite is loaded via **unpkg CDN** (`flowbite.min.css` + `flowbite.js`); on slow mobile this adds render-blocking and a third-party failure point. Consider bundling or moving this tutorial behind a small inline component. The `data-modal-show`/localStorage flow is fine.

---

## 7. Component-Level Recommendations

| Component | Current | Recommendation | Priority |
|---|---|---|---|
| Primary button | `bg-blue-600 h-9 px-5 text-white rounded-md font-medium` | Min 44px height (48px preferred), full-width on mobile for primary flows, active/`focus-visible` ring | P1 |
| Row action (modal rows) | `px-4 py-4` + `hover:bg-gray-100` | ≥56px rows with `active:bg-gray-100` (press feedback), chevron hint | P1 |
| Inputs | `.with-border w-full p-4` | Keep 16px padding (≈ 48px effective with `p-4`), add `autocomplete`/`inputmode`/`enterkeyhint`; raise labels above fields on mobile | P1 |
| Nav cells | `grid-cols-7 px-4 py-3` icon-only | Move to labeled elements in bottom bar / scroll-pills; min 44px | P0 |
| Cards | Existing card grid | Unchanged; ensure borders/padding collapse gracefully at 320px | P0 |
| Modals | `uk-modal-dialog uk-modal-body uk-margin-auto-vertical` | Keep; set `max-width: 100%` dialog on ≤430px so they become bottom sheets with rounded top corners | P2 |
| Avatar/banner display | Fixed-height image containers | Add `aspect-ratio`, `object-cover`, `loading="lazy"` | P2 |
| Toast/alert | SweetAlert2 CDN | Keep; add haptic-safe confirmations and non-blocking inline toasts for success | P2 |

---

## 8. Mobile Interaction Recommendations

- **P0 — Touch labels:** Remove reliance on `uk-tooltip` for navigation on mobile; labels must be visible text.
- **P1 — Press feedback:** Introduce `active:` Tailwind states (e.g., `active:bg-blue-700`, `active:scale-[.98]`) on tap targets.
- **P1 — Safe areas:** CSS `env(safe-area-inset-bottom)` padding for bottom bars and `env(safe-area-inset-top)` for the header; add `viewport-fit=cover`.
- **P2 — Gestures:** Support swipe-left on chat/message rows for quick actions; keep taps primary (do not add conflicting swipe navigation without a swipe-back affordance).
- **P2 — Pull-to-refresh:** Add for home/selection data lists (custom or lightweight lib; avoid heavy frameworks).
- **P2 — Keyboard ergonomics:** `enterkeyhint`, `inputmode`, `autocapitalize="off"` for emails/URLs, `spellcheck=false` where appropriate.
- **P3 — Haptics/vibration:** Optional `navigator.vibrate` on key confirmations.
- **P3 — Dynamic viewport:** Consider `dvh` units for full-screen auth pages to handle mobile URL-bar resizing.

---

## 9. Responsive Breakpoints

Current inconsistency:
- Tailwind defaults in `output.css` (from standard `tailwind.config.js`, no custom screens).
- JS switch at **1015px** (`primary-navigation.ejs` `toggleNav()`).
- CSS media queries only at **1200px** in `public/assets/css/custom.css`.
- UIkit's own breakpoints (600px, 960px) also active — mixed behavior.

Recommendation (P0/P1): **define and enforce one contract** in `tailwind.config.js`:
- `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`, `2xl: 1536px` (keep Tailwind defaults).
- Replace the 1015px JS constant with `matchMedia('(min-width: 1024px)')` (or the `lg` token).
- Add the same 640/768/1024/1280 tokens as `:root` CSS variables and mirror in `custom.css`.
- Provide **explicit test widths:** 320 / 375 / 390 / 414 / 430px (mobile) and 768 / 1024 (tablet). Currently the only hand-rolled responsive rules (1200px) treat "not desktop" as one bucket — insufficient for phones vs tablets.

---

## 10. Typography

- Base font stack is inherited from Tailwind preflight + `style.css`; the `Orbitron` web font and `.orbitron` class are **commented out** in head/css — do not reintroduce on mobile (extra font weight on slow networks).
- Recommendations:
  - **P1** Define a mobile type ramp: page title `text-xl` (20px), section `text-lg` (18px), body 16px minimum, captions 13–14px. Avoid desktop-scale headings (e.g., `text-3xl/4xl`) at ≤430px.
  - **P2** Set `line-height` relaxed on form labels and card subtitles (existing `text-gray-500 text-sm` blocks are fine).
  - **P2** Add `font-feature-settings`/`text-rendering` only if needed; keep system font for latency (already system-based since no webfont loads).

---

## 11. Touch Target Recommendations

- **Minimum 44×44px** for all interactive elements (Apple HIG / WCAG 2.5.5). Current offenders: nav icons (`≈40px`), `h-9` (36px) buttons, icon-only close buttons (`p-2.5` ≈ 28px+).
- Rows (list items in `selectionQuestion.ejs`, selection/trader cards, profile nav lists): ≥56px with internal vertical padding.
- Spacing between adjacent targets ≥8px; avoid adjacent 40px icons with no gap.
- Bottom tab bar: 5 tabs, each ≥56px tall, active tab with filled/colored state + label.
- Back/close top-left or top-right: place ≥48px tap with safe-area offset.

---

## 12. Loading / Empty / Error States

Current: `home.js` writes plain text lists via `innerHTML`; `landing-signage.js` renders banner slideshow via `insertAdjacentHTML`; no skeletons; failures mostly surface via SweetAlert2 or `console.log` (e.g., `selection.js`).

Recommendations (shared mobile "state kit"):
- **P1 Loading:** Skeleton blocks matching card/banner dimensions (CSS shimmer or Tailwind `animate-pulse`) wherever content is `fetch`-driven (home sections, selection list, profile data, upgrade plan details).
- **P1 Empty:** Consistent `.empty-state` — centered icon, short title, one action (e.g., "No traders yet — continue as a trader", "No items in cart" since cart is "Under development").
- **P1 Error:** Inline retry block (icon + message + Retry button) for fetch failures; keep SweetAlert2 for server-reported business errors but stop relying on `console.log` for user-visible failures.

---

## 13. Performance

- **P2** Flowbite CSS+JS from unpkg (`awt_introduction.ejs`) is render-blocking on mobile and a availability risk — inline or vendor, and lazy-load the modal's scripts only when shown.
- **P2** Multiple stylesheets load in head (`icons.min.css`, `uikit.min.css`, `style.css`, `custom.css`, `output.css`) — on mobile, consider combining into one cached bundle. Note: minified variants exist under `public/assets/css-min/` but are **commented out** in head.
- **P2** SweetAlert2 + jQuery + UIkit all from CDN — review caching policy / offline resilience.
- **P3** `landing-signage.js` (1,495 lines) drives the hero slideshow with inline HTML template strings; on low-end phones, debounce resize handlers (`handleSelectionPageResize`) and use `requestAnimationFrame`.
- **P1** Add `loading="lazy"` + explicit dimensions (`width`/`height` or `aspect-ratio`) to all remote images (`/uploads/...`, `/uploads/users_upload_files/...`) to prevent layout shift (`cls`).
- **P2** Confirm no layout shift on banner/logo images during network load (assign fixed aspect boxes).
- **P3** Time-to-interactive on home: JSON fetches + full re-render — consider pagination/partial rendering.

---

## 14. Accessibility

- **P0** Icon-only nav cells currently undetectable by screen readers (no `aria-label`, no visible text). Add labels + `aria-label`.
- **P1** Replace `href="#"` anchors used as buttons with real `<button>` or add `role="button"` + `aria-label` + keyboard handler.
- **P1** Focus management: UIkit modals handle focus; ensure custom modals (Flowbite `awt_introduction`) restore focus on close.
- **P1** Color contrast: `bg-blue-500 text-white` and `text-gray-500 text-sm` on white — verify ≥4.5:1; `text-gray-500` on `hover:bg-gray-100` in rows.
- **P2** Tap target size + spacing per Section 11; `:focus-visible` rings on all controls.
- **P2** Dark mode: ensure `dark:` variants cover inputs and modals (present in views; verify contrast pairs).
- **P2** `aria-live="polite"` on char counters (`cettCharCount`) and dynamic content regions.
- **P2** Reduced motion: respect `prefers-reduced-motion` for slideshow auto-advance and modal animations.
- **P3** Language/dir attributes and page `<title>` uniqueness across all pages.

---

## 15. Component Architecture

Current: everything is server-rendered EJS; client behaviors are bespoke per-page JS files loaded individually (only `home.js` is webpack-bundled). Reusable visual patterns live as EJS includes (`includes/header`, `header_avatar`, `nav/*`, shared modals, `footer`).

Recommendations (mutually compatible with the stack — no new framework required):
- **P1** Extract reusable EJS partials: `btns/primary.ejs`, `cards/business-card.ejs`, `state/loading.ejs`, `state/empty.ejs`, `state/error-retry.ejs`, `nav/bottom-tabs.ejs`. Reuse across home/selection/traders/profile/upgrade.
- **P1** Create one shared mobile utility JS (e.g., `public/assets/js/mobile-utils.js`): breakpoint token, `isTouch()`, safe-area helper, skeleton/error renderer, history-back helper. Load before page scripts in `includes/scripts/index.ejs`.
- **P2** Centralize fetch wrappers with `AbortController` timeout + error handling instead of per-file `fetch().then/console.log`.
- **P3** Consider a tiny frontend runtime (still EJS-first) built with webpack for the interactions that repeat most (tabs, sheets, skeletons).

---

## 16. Implementation Roadmap

### Phase 1 — Foundations (P0)
1. Meta/PWA layer in `includes/head/index.ejs`: `viewport-fit=cover`, `theme-color` (= brand `#2563eb` blue or white), `apple-mobile-web-app-capable`, `format-detection`; safe-area CSS variables in `custom.css`.
2. Unify breakpoints (Section 9): fix the 1015px JS switch → `lg`; audit custom.css 1200px rules.
3. Convert mobile nav to labeled elements (bottom bar or labeled pills) with min 44px targets; add `aria-label`s.
4. Touch-target pass on nav/buttons (`h-9`→≥44px, icon-only closes `p-2.5`→`p-3` min 44px).
5. Accessibility basics: `href="#"` button semantics, `:focus-visible`, contrast audit on blue/gray pairs.

### Phase 2 — UX depth (P1)
1. Loading skeletons + empty + error-retry components; wire into home/selection/profile JS.
2. Form ergonomics: `autocomplete`/`inputmode`/`enterkeyhint` on login/registration/reset.
3. Mobile action bar (sticky bottom CTA) on profile/traders/upgrade pages.
4. Modal mobile pass: full-width bottom-sheet styling, 56px rows, textarea auto-grow.
5. Image `loading="lazy"` + aspect-ratio to kill CLS.

### Phase 3 — Polish (P2)
1. Pull-to-refresh on home/selection; active/press states on tap targets.
2. Remove or vendor Flowbite CDN; review stylesheet bundling; image optimization.
3. Typography ramp for ≤430px; reduced-motion support.
4. Tablet tuning (768/1024) for nav and grids.

### Phase 4 — Native-feel extensions (P3)
1. PWA: `manifest.json`, service worker for route caching, install prompt.
2. Haptics, dynamic viewport height (`dvh`), bottom-sheet gestures, infinite scroll pagination.

---

## 17. Quick Wins (small effort, immediate impact)

1. Add `viewport-fit=cover` + `theme-color` to `includes/head/index.ejs` (a few lines).
2. Add visible labels (or `aria-label` + labeled pill conversion) to the 7-icon mobile grid (~20-line change in `primary-navigation.ejs`).
3. Raise nav cell / button hit-sizes to ≥44px (`px-4 py-3` → `py-4`, `h-9` → `h-12`).
4. Add `scroll-margin-top` to anchored sections (`#tradersVideos`, `#tradersWebinars`, `#selections`).
5. Add `loading="lazy"` + fixed aspect boxes to banner/logo `<img>`s.
6. Add `autocomplete`/`inputmode`/`enterkeyhint` to login & registration email/password fields.
7. Add `animate-pulse` skeleton placeholders for `fetch` regions in `home.js`.
8. Replace the 1015px constant in `primary-navigation.ejs` with a `lg` matchMedia.
9. Wrap `client-email-the-trader` Send button to full-width ≥44px.
10. Add `active:` press feedback to primary buttons and modal rows.

---

## 18. Larger Improvements (higher effort, bigger payoff)

1. **Bottom tab bar + app shell** — persistent navigation that gives the native feel this audit's premise wants (est. a shared `nav/bottom-tabs.ejs` + CSS in `custom.css`).
2. **Shared state kit** (loading/empty/error) factored into EJS partials and one `mobile-utils.js`, replacing per-file inline `innerHTML` states.
3. **Breakpoint governance** — a documented tokens file (`tailwind.config.js` + `:root` CSS variables) eliminating the 3-system drift (Tailwind / 1015px / 1200px).
4. **Performance pass** — bundle/vendor third-party CSS+JS (Flowbite/SweetAlert2), consolidate stylesheets, debounce slideshow resize handlers.
5. **PWA installability** — manifest + light service worker; app icon set, enabling "Add to Home Screen".
6. **Form wizard refactor** for registration on mobile (step-by-step with progress) while preserving the desktop long-form.

---

## 19. Before vs After Concept

| Aspect | Before (today) | After (target) |
|---|---|---|
| Mobile nav | Icons-only 7-grid, tooltips dead on touch, ~45px cells | Bottom tab bar (5 labeled tabs) + header with back/avatar; 44px+ targets |
| Header | Logo + full "All World Trade" title always | Compact app header, compresses on scroll, safe-area aware |
| Breakpoints | Tailwind + 1015px JS + 1200px CSS | Single token set (sm/md/lg/xl) across CSS+JS |
| Data loading | Blank regions then plain text `innerHTML` | Skeleton cards → content; empty & error-retry states |
| Forms | Long forms, no input hints | Step wizard mobile, `autocomplete`/`inputmode`, inline errors |
| Buttons | `h-9` 36px | ≥48px full-width primary CTAs with press feedback |
| Modals | Desktop-width dialogs | Full-width bottom sheets on mobile, 56px rows |
| Meta/PWA | Viewport meta only | `viewport-fit=cover`, `theme-color`, safe areas, install-ready (P3) |
| Performance | Heavy multi-stylesheet + CDN deps | Bundled/vendored assets, lazy images, debounced resize |

---

## 20. Final Priority Checklist

### P0 (must fix)
- [ ] Replace icons-only mobile nav with labeled, accessible navigation (bottom bar or pills) — `public/view/includes/nav/primary-navigation.ejs`
- [ ] `viewport-fit=cover`, `theme-color`, safe-area CSS — `public/view/includes/head/index.ejs` + `public/assets/css/custom.css`
- [ ] Unify breakpoints (remove 1015px hard-code; reconcile 1200px custom rules)
- [ ] Min 44px touch targets on nav/buttons/closes; add `aria-label`s
- [ ] Proper button semantics for `href="#"` controls
- [ ] On ≤767px, disable `.selection-left-scroll` 810px / 400px fixed panes and `handleSelectionPageResize` desktop heights
- [ ] Stop using `location.replace` for Home / Selection / Login so the device Back button works

### P1 (high impact)
- [ ] Loading skeletons + empty + error-retry states across home/selection/profiles — `public/assets/js/*.js`
- [ ] Form ergonomics: `autocomplete`, `inputmode`, `enterkeyhint`, inline errors — login, registration-v2, reset-password
- [ ] Mobile sticky action bar on profiles/traders/upgrade
- [ ] Mobile modal bottom-sheet treatment + 56px rows — `public/view/modal/*.ejs`
- [ ] Image `lazy` + `aspect-ratio` (CLS) — all `/uploads/...` imgs
- [ ] Sticky-header anchor scroll offsets

### P2 (polish)
- [ ] Pull-to-refresh on home/selection
- [ ] Vendor or remove unpkg Flowbite; consolidate stylesheets; debounce slideshow resize (`landing-signage.js`, `selection.js`)
- [ ] Mobile type ramp + reduced-motion support
- [ ] Press feedback (`active:`) on taps
- [ ] Tablet tuning at 768/1024

### P3 (future / native-feel)
- [ ] PWA manifest + service worker + install prompt
- [ ] Haptics, `dvh` handling, infinite scroll pagination, swipe actions

---

---

## 21. Mobile Visual Language (design tokens)

Keep brand colors already in use (`bg-blue-600` / `bg-blue-700` / `bg-blue-500`). Encode them once so mobile chrome, tabs, and CTAs match.

| Token | Recommended value | Use |
|---|---|---|
| `--awt-brand` | `#2563eb` (Tailwind blue-600) | Primary CTA, active tab, `theme-color` |
| `--awt-brand-pressed` | `#1d4ed8` (blue-700) | `active:` / `:active` |
| `--awt-surface` | `#ffffff` / `#111827` dark | App chrome (header, tab bar) |
| `--awt-text` | `#111827` / `#f9fafb` dark | Body |
| `--awt-muted` | `#6b7280` | Captions; verify ≥4.5:1 on white |
| `--awt-hairline` | `1px solid #e5e7eb` | Tab bar top border, list separators |
| `--awt-radius-sheet` | `16px 16px 0 0` | Bottom sheets / mobile modals |
| `--awt-radius-card` | `0.6rem` (existing `.rounded-custom`) | Cards |
| `--awt-header-h` | `56px` + `env(safe-area-inset-top)` | Compact mobile header |
| `--awt-tabbar-h` | `56px` + `env(safe-area-inset-bottom)` | Bottom tabs |
| `--awt-touch` | `44px` min, `48px` preferred | Buttons, tab cells, icon closes |
| `--awt-row` | `56px` min | List/action rows |
| `--awt-gutter` | `16px` (320–430px), `24px` (tablet) | `.mcontainer` padding |
| `--awt-z-header` | `40` | Sticky header |
| `--awt-z-tabbar` | `50` | Above content, below modal |
| `--awt-z-sheet` | `60` | UIkit modal / More sheet |
| `--awt-z-toast` | `70` | SweetAlert2 |

**Type ramp (≤430px)** — apply via a `.awt-mobile` wrapper or `@media (max-width: 767px)` in `custom.css`, not by shrinking desktop headings globally:

| Role | Size / line-height | Example |
|---|---|---|
| App header title | 17–18px / 24px, semibold | “Selections”, “Login” |
| Page title | 20px / 28px (`text-xl`) | “Create Account” |
| Section | 18px / 24px | Home “Traders Videos” |
| Body | 16px / 24px | Cards, legal, messages |
| Tab label | 10–11px / 14px | Bottom bar |
| Caption | 13–14px / 18px | `text-gray-500` subtitles |
| CTA | 16px / 24px, medium | Primary buttons |

Do **not** re-enable Orbitron on mobile (`orbitron` is still applied on login CTA, legal pages, footer). Extra webfont + display type hurts small-screen reading and payload.

---

## 22. App chrome specification

### 22.1 Compact header (mobile, `max-width: 767px`)

Today: logo `w-16 h-16` (64px) + `<h3>All World Trade</h3>` at `text-2xl` + Login/`header_avatar` (`primary-navigation.ejs` lines 24–27). On 320px this consumes ~80–96px before the 7-icon grid.

Target:

```
[ 40px logo ]  [ page title, 1 line, truncate ]     [ back? ] [ avatar 36px | Login ]
height = 56px + safe-area-inset-top
```

- Hide the full wordmark on ≤375px; keep logo + current **page** title (not always “All World Trade”).
- Logo tap → Home (`goToHomePage`), but use `location.assign` / `<a href="/">` instead of `location.replace` so Back still works (P1). `location.replace` currently wipes history on Home / Selection / Login.
- Unsigned: Login is already a real CTA (`px-6 py-3`) — keep it, make it `h-11` min, do not hide it in overflow.
- Signed: avatar 36×36, dropdown becomes a **full-width bottom sheet** on mobile (UIkit drop `uk-drop` is desktop-oriented and clips on small screens). Sheet items: My Account, Night mode, Log Out. Each row ≥56px.
- On scroll down: header can shrink logo 40→32px (optional P2). Never hide the header entirely while a bottom tab bar exists — users need identity + back.

### 22.2 Bottom tab bar (new, `md:hidden` / `<1024px` after breakpoint unification)

Persist on: `/`, `/selection`, `/all-about-events`, `/pricing`, `/#tradersVideos`, `/#tradersWebinars`.

Hide on: login, register, registration-v2, forgot/reset password, email verification, legal pages, in-call / communicator overlay. Those flows need maximum keyboard and focus.

| Tab | Route | Icon (existing feather) | Active rule |
|---|---|---|---|
| Home | `/` | `icon-feather-home` | `pathname === '/'` and hash not videos/webinars |
| Selections | `/selection` | `icon-feather-users` | `/selection` |
| Videos | `/#tradersVideos` | `icon-feather-video` | hash `tradersVideos` |
| Events | `/all-about-events` | `icon-feather-calendar` | `/all-about-events` |
| More | sheet | `icon-feather-more-horizontal` (or message-square) | sheet open |

**More sheet contents (signed vs unsigned):**

- Traders Webinars → `/#tradersWebinars`
- Pricing → `/pricing`
- Help → `goToHelpSuggestionPage()` (`public/assets/js/help-and-support.js`)
- Night mode (if signed; also expose if unsigned — today toggle is **only** in the avatar dropdown, so guests cannot switch theme)
- Login / Logout
- Legal: Terms, Privacy, Cookie (currently buried in footer — footer is easy to miss behind a tab bar)

**Behavior:**

- `position: fixed; bottom: 0; left: 0; right: 0;`
- Top hairline + `padding-bottom: env(safe-area-inset-bottom)`
- Each tab: column icon 22px + label; **visible text**, never tooltip
- Active: brand color icon + medium label; inactive: gray-500
- `aria-current="page"` on active tab
- Content padding-bottom = tab bar height so lists are not covered
- When the virtual keyboard is open (Visual Viewport API): hide or translate the tab bar down so it does not sit on the keyboard (P1). `selection.js` already ignores height-only `resize` for layout — reuse that idea for chrome.

### 22.3 Do not stack two navs

Once the tab bar ships, **remove** the icons-only `grid-cols-7` `.mobile-menu` (or convert it to the tab bar). Running both eats ~120px of vertical space.

Desktop `#primaryNav` (`hidden md:flex` plus the 1015px JS override) stays as-is above `lg`.

### 22.4 Sticky primary CTA (contextual, above tab bar)

Use on profile, traders-page, pricing/upgrade, and the email-trader modal footer:

```
[ full-width primary, 48px ]   ← Contact / Choose plan / Send
[ tab bar ]
```

If both exist, CTA is `bottom: var(--awt-tabbar-h)`. On pages with no tab bar (auth), CTA sits on the safe area only.

---

## 23. Navigation & history (implementation notes)

**Files:** `public/view/includes/nav/primary-navigation.ejs`, `selection-navigation.ejs` (near-duplicate — keep them in sync or extract one partial).

| Issue | Detail | Recommendation |
|---|---|---|
| Dual breakpoint | Tailwind `md:flex` (768px) **and** `toggleNav()` at 1015px | Single `matchMedia('(min-width: 1024px)')`; CSS `lg:` only |
| `w < 1015` / `w > 1015` | Width **exactly** 1015px matches neither branch | Use `>= 1024` / `< 1024` |
| `location.replace` | Home, Selection, Login | Prefer `href` or `location.assign` so Android/iOS Back works |
| Logo `href="#"` + onclick | Same anti-pattern as nav cells | Real `href="/"` |
| Duplicate nav templates | `primary-navigation.ejs` vs `selection-navigation.ejs` vs `includes/nav/index.ejs` | One include; selection page should not fork chrome |
| Help destination | `goToHelpSuggestionPage` lives in `help-and-support.js`, not in the nav script | Keep a single global helper in `mobile-utils.js` / `global.min.js` |
| Commented hamburger | Lines 160–169 already sketched a `mobile-menu-button` | Do not revive hamburger **and** tab bar; pick tab bar |

**Back affordance (non-home):**

1. If `document.referrer` is same-origin → `history.back()`
2. Else map: profile → `/selection`; upgrade → `/pricing`; reset-password → `/login`; events → `/`
3. Visible 44px chevron, `aria-label="Back"`

---

## 24. Selection / discovery (highest-traffic mobile surface)

**Files:** `public/view/selection/index.ejs`, `public/assets/js/selection.js`, `public/assets/css/custom.css` (`.selection-left-scroll` **810px** fixed, `.company-details-scroll` / `.selection-result-scroll` **400px**).

### 24.1 Layout today vs target

Desktop is a multi-column “command center”: left list, mid banner/slideshow, company details. JS sets column heights from `window.innerHeight - HEADER_OFFSET` (`handleSelectionPageResize`). There is already a **keyboard-safe resize guard** (skip height-only resizes) — keep it.

On phones this should become a **single-column app**:

1. **Search / filters** — sticky under header, one line: query + Filter chip. Opening Filter is a bottom sheet (country, category, scale), not a side column.
2. **Result list** — full-width rows: 56–72px logo, name, city/scale badges, chevron. Entire row opens `selectionQuestion` modal (already the engagement pattern).
3. **Tap-through detail** — optional second screen or expanding card for banner + bio; do not keep a 810px independently scrolling pane on a 667px-tall phone.
4. **Hero slideshow** — if kept, one card at a time, `aspect-ratio` box, swipe (touch is already assumed via `detectDeviceType()`). Mobile already swaps landing art to `AWT-Landing-Page-2026-Aug-27-mobile.webp`.

### 24.2 Click-Me onboarding

`.click-me-guide` in `selection/index.ejs` is a centered pulse badge — good mobile pedagogy. Recommendations:

- Show once (`localStorage`, same idea as `awt_introduction`)
- Respect `prefers-reduced-motion` (disable pulse/bounce)
- Dismiss on first tap **or** after 8s
- Do not cover the first result row on 320px; place above the list or as a coach-mark attached to the first card

### 24.3 Offline trader

`selectionQuestion.ejs` already swaps in `#offlineTraderMessageDiv`. Also show a small “Offline” badge on the **list row** so users do not tap expecting an immediate call.

### 24.4 Filters & Choices.js / selectpicker

Country/city/category selects use `selectpicker` / Choices in registration and upgrade. On iOS, native `<select>` is usually better than custom dropdowns that ignore the visual viewport. Recommendation: native selects on mobile; keep Choices on desktop if needed. Search fields: `inputmode="search"`, `enterkeyhint="search"`.

---

## 25. Home, media, and motion

**Files:** `public/view/home/index.ejs`, `public/assets/js/home.js`, `public/assets/js/landing-signage.js` (~1,495 lines).

- Hero: prefer `<picture>` / the existing mobile webp path used in `selection.js` `swapHomepageBackgroundImage()`. Home still comments several srcset experiments — pick **one** mobile + one desktop asset, `width`/`height` or `aspect-ratio`, `fetchpriority="high"` on the LCP image only.
- Section blocks (`#tradersVideos`, `#tradersWebinars`, `#selections`): `scroll-margin-top: calc(var(--awt-header-h) + 8px)` so sticky header does not cover titles.
- Video / webinar cards: 16:9 thumbnail, play affordance ≥44px, do not autoplay sound. On cellular, show poster + tap-to-play (P1).
- Pause slideshow when `document.hidden` or when the slide is off-screen (`IntersectionObserver`). Honor `prefers-reduced-motion: reduce` (no auto-advance).
- Footer (`includes/footer/index.ejs`) is a 2–3 column legal/social grid. With a tab bar, collapse to a short “Legal · About” line or move links into More; a tall footer plus tab bar double-scrolls.

---

## 26. Auth, registration, and keyboard forms

### 26.1 Login — `public/view/login/index.ejs`

- Logo + “All World Trade” at `text-2xl` + `w-16` repeats the cramped header; compress as in §22.1.
- Header **Register** button (`lookingForSmallScaleCompany()`) vs form **Login** — keep both; make Register `variant=secondary` so the primary intent is sign-in.
- Email field: `type="email"` is present; add `autocomplete="username"`, `inputmode="email"`, `enterkeyhint="next"`, `autocapitalize="none"`, `spellcheck="false"`.
- Password: `autocomplete="current-password"`, `enterkeyhint="go"`; add show/hide control (44px).
- Commented blocks apply inset box-shadow `#323332` and white text fill (autofill dark hack). If re-enabled, they fight light theme and look broken on iOS autofill. Prefer `:-webkit-autofill` tokens that match current theme.
- `h-screen` wrapper + `mt-32` wastes space below the sticky nav; use `min-h-dvh` and padding-top = header height.
- Forgot-password link: large tap target, not text-only 12px.

### 26.2 Registration v2 — `public/view/registration-v2/index.ejs`

Current single card: Fullname, account type, contact number, email, password, confirm, terms checkboxes, submit. Parent uses `h-screen` / `md:h-auto` — iOS URL bar makes `100vh` overflow and clip the CTA.

Suggested **mobile steps** (desktop stays one page):

| Step | Fields | Keyboard |
|---|---|---|
| 1 Identity | Fullname, I am (account type) | `text`, `autocomplete="name"` |
| 2 Contact | Phone (`inputmode="numeric"`, `autocomplete="tel"`), Email | `enterkeyhint="next"` |
| 3 Security | Password + confirm (`autocomplete="new-password"`), show/hide | |
| 4 Legal | Terms + Privacy checkboxes — **44px** hit area (today `w-4 h-4` is 16px) | |
| 5 Submit | Full-width 48px Create account | |

Inline `#firstNameValidation` etc. already exist — keep them; on Continue, focus first invalid field and `scrollIntoView({ block: 'center' })`.

Account type copy is long (“Visitor looking for Large Scale Company”). On mobile use short labels + helper text under the select, or a 2×2 choice grid of large tiles (Trader / Large / Medium / Small) — more native than a long `<select>`.

### 26.3 Password reset / verification

Forgot + reset: one field, one 48px button, `autocomplete="email"` / `new-password`. Email verification (`verification/email-verification.ejs` + `email-verification.css`) already has 320 / 375 / 414 media queries — **reuse that pattern** as the project’s phone buckets instead of inventing another set.

### 26.4 `selectpicker` / file upload on profile & upgrade

Profile edit and upgrade forms (`edit-*.ejs`, `upgrade/*.ejs`) are long desktop documents with `uk-tooltip` Lorem placeholders on info icons (tooltips fail on touch). Replace tooltips with tappable “?” opening a short sheet or `<details>`.

Media upload (logo, banner, video, brochure, webinar thumbnail):

- Visible 44px “Choose file” + filename
- `accept` + `capture="environment"` only where a camera photo is intended (logo/banner); do not force camera for PDFs
- Uploading: disable CTA, progress text (files: `*-upload-medias.js`, `traders-profile.js`)
- Preview in a fixed aspect box to avoid layout jump

---

## 27. Engagement modals & communicator

### 27.1 `selectionQuestion.ejs`

Already the right pattern (icon 56px + title + subtitle). Mobile treatment:

- Dialog as **bottom sheet**: `width: 100%`, top radius 16px, drag handle optional
- Close button: 44px (today `p-2.5` + tooltip “Close”)
- Rows: `role="button"`, `tabindex="0"`, `active:bg-gray-100`, whole row clickable (not only inner text)
- `aria-labelledby` = engagement heading (`#selectionEngagementMessage`)
- Long trader names: wrap, do not overflow the sheet

### 27.2 `client-email-the-trader.ejs`

- Fix `g:w-8/12` → `lg:w-8/12`; `space-x-6` → `space-y-4` on small screens
- Textarea `rows="4"` initial + auto-grow to ~40vh; 12 rows + Simplebar + keyboard covers Send
- Send: full-width, `h-12`, real `<button type="submit">`
- `enterkeyhint="send"`; keep 250 counter with `aria-live="polite"`
- When keyboard opens, scroll the Send bar into the visual viewport

### 27.3 Video call / waiting room

Waiting rooms: `POST /api/v2/post/generate-waiting-room`, `waiting_rooms` model, `customer-service.js`. Communicator UI (`modal/communicator_link.ejs`) is a high-stakes mobile flow.

Recommendations (do not require a native app):

- Permission copy **before** `getUserMedia`: “Camera and microphone are used to meet this trader”
- Fallback UI if permission denied (Message / Email rows)
- Landscape lock optional during call; portrait-first waiting room
- Large hang-up (red, 56px) in thumb zone; do not place hang-up in the status bar
- Prevent tab-bar overlap during call (hide chrome, §22.2)
- `playsInline` + `webkit-playsinline` on `<video>` so iOS does not force fullscreen unexpectedly
- Network drop: inline reconnect, not only `console.log`

---

## 28. Platform, viewport, and CSS pitfalls

### 28.1 iOS Safari

- Replace `h-screen` / `100vh` with `min-h-dvh` or `100dvh` on login, registration-v2, help login
- `viewport-fit=cover` + `env(safe-area-inset-*)` for notched iPhones (14/15/16 class, 390×844, 393×852, 430×932)
- Rubber-band overscroll: `overscroll-behavior-y: contain` on sheets and the tab-bar parent
- `-webkit-tap-highlight-color` aligned with press feedback; 300ms delay is gone if viewport is set (already is)
- Autofill and 16px inputs: keep control font-size ≥16px to **prevent focus zoom** (several fields use `p-2.5` / `md:text-md` — verify computed size is not 14px)

### 28.2 Android Chrome

- Visual Viewport for keyboard vs tab bar
- Back button should close sheets/modals first (UIkit `uk-modal` + `history.pushState` optional P2)
- `theme-color` matching header (and a dark `theme-color` when `.dark` is on)

### 28.3 Fixed heights in CSS (P0 on selection/profile)

`custom.css`:

- `.selection-left-scroll { height: 810px; }`
- `.company-details-scroll { height: 400px; }`
- `.selection-result-scroll { height: 400px; }`
- `.fixed-top-mid { width: 1083px; ... }` — desktop leftover, overflows phones

On ≤767px these must become `height: auto` / `max-height: none` / `overflow: visible` and let the page scroll. JS height assignment in `handleSelectionPageResize` should no-op on mobile (or only run `>= lg`).

### 28.4 1200px CSS vs 1015px JS vs Tailwind

Document one contract in `tailwind.config.js` `theme.screens` (defaults are fine) and duplicate as CSS variables:

```css
:root {
  --bp-sm: 640px;
  --bp-md: 768px;
  --bp-lg: 1024px;
  --bp-xl: 1280px;
}
```

`public/assets/js/responsive-module.js` currently **exports several conflicting screen maps** (576/960/1440, 992, 475xs, etc.) and is not the live Tailwind config (`tailwind.config.js` has **empty** `theme.extend`). Treat `responsive-module.js` as notes, not source of truth — delete or replace with the single contract.

---

## 29. Dark mode (confirmed wiring)

**Exists.** `#night-mode` in `header_avatar/index.ejs` (and selection variant). `toggle-dark-light.js`:

- Click toggles `document.documentElement` class `dark` and `localStorage.gmtNightMode`
- On load, if `gmtNightMode` is set, adds class **`night-mode`** (not `dark`) — **class name mismatch** means first paint after reload may not match Tailwind `dark:` variants until the next click
- `prefers-color-scheme: dark` only swaps footer logo, it does not set `dark` on `<html>`
- Guests never see the toggle

Recommendations (P1):

1. On load, apply **`dark`** consistently (and map old `night-mode` → `dark`)
2. Put a theme control in the More sheet for signed-out users
3. `color-scheme: dark` on `html.dark` so scrollbars/form controls match
4. Login autofill hack (#323332) must follow theme
5. Verify modal/sheet backgrounds (`bg-gray-50` in `selectionQuestion` header) have `dark:` pairs

---

## 30. Images, share, and metadata

`includes/head/index.ejs`:

- Viewport: add `viewport-fit=cover`
- `theme-color` + `apple-mobile-web-app-capable` / `mobile-web-app-capable` + `apple-mobile-web-app-title="All World Trade"`
- Favicon is 32×32 `.ico` only — add `apple-touch-icon` 180×180 for Add to Home Screen
- `og:title` is hardcoded **“Home Page”** on every view that shares this include — set per-page titles (Selections, Login, Pricing) for iMessage/WhatsApp previews
- Two `og:image` tags (webp + jpeg map) — keep one primary 1200×630
- `format-detection` telephone=no on pages that are not contact cards, to avoid iOS linking random numbers; enable on trader contact views

Lazy-load: all `/uploads/users_upload_files/` and logos below the fold. LCP hero: **not** lazy.

---

## 31. Copy, density, and B2B mobile patterns

- Nav labels: “Traders Webinars” / “Event Calendar” overflow a 5-tab bar — use **Webinars** / **Events** in the tab, full name in More / page title.
- Engagement verbs stay concrete: Contact, Download, Message (already good).
- Empty states should use trade language: “No businesses match these filters” + Clear filters, not generic “No data”.
- Error retry: “Couldn’t load traders. Check your connection.” + Retry.
- Tooltips with Lorem ipsum on upgrade/edit (`uk-tooltip="title: Company Details Lorem ipsum..."`) — replace with real help or remove before a mobile pass; they are unusable on touch and unprofessional if they appear.

---

## 32. Accessibility extras (mobile)

- `aria-label` on every icon-only control (nav, close, play, night mode)
- Avatar dropdown / More sheet: `role="menu"` or dialog, focus trap, Esc / Android Back to close
- Night mode switch: `role="switch"` + `aria-checked`
- Terms checkbox + adjacent links: do not make the whole sentence one hit target that accidentally toggles
- Color: `bg-blue-500` Login vs `bg-blue-600` elsewhere — pick one primary; check contrast on `blue-500`/`white`
- Dynamic lists (`home.js` innerHTML): container `aria-busy="true"` while loading; `aria-live="polite"` when count updates
- Skip link to `#main` for keyboard / TalkBack (P2)

---

## 33. Performance budget (phones)

Aim for a usable home on mid-range Android (≈4G):

| Metric | Budget |
|---|---|
| LCP (hero / first selection card) | < 2.5s |
| CLS | < 0.1 (explicit image boxes) |
| TBT | avoid extra CDN (Flowbite unpkg on `awt_introduction.ejs`) |
| CSS | one pipeline: prefer `css-min` **or** `output.css` + `custom.css`, not both unminified `style.css` + Tailwind + UIkit + icons on first paint |
| JS | defer page scripts; keep `global.min.js` small |

`detectDeviceType()` logs userAgent/screen on every selection load — remove `console.log` in production (noise + work on low-end devices).

Webpack only bundles `home.js`. Other pages each request many scripts — on mobile, combine at least `mobile-utils.js` + nav helpers.

---

## 34. Suggested file-level change list (when implementation starts)

| File | Change |
|---|---|
| `public/view/includes/head/index.ejs` | Viewport, theme-color, apple-touch-icon, per-page title hook |
| `public/view/includes/nav/primary-navigation.ejs` | Labeled tabs / pills; `matchMedia` 1024; real hrefs |
| `public/view/includes/nav/selection-navigation.ejs` | Deduplicate with primary |
| `public/view/includes/nav/bottom-tabs.ejs` | **New** partial |
| `public/view/includes/state/loading.ejs` etc. | **New** skeletons/empty/error |
| `public/assets/css/custom.css` | Safe-area, tab bar, kill 810px heights under `max-width: 767px`, tokens |
| `tailwind.config.js` | Optional `extend.screens` comment documenting the contract; `darkMode: 'class'` explicit |
| `public/assets/js/mobile-utils.js` | **New** breakpoint, back helper, visualViewport keyboard, state renderers |
| `public/assets/js/selection.js` | Skip desktop height layout on mobile; row template; empty/error |
| `public/assets/js/home.js` | Skeletons; lazy sections |
| `public/assets/js/toggle-dark-light.js` | Unify `dark` vs `night-mode` |
| `public/view/login/index.ejs` + registration-v2 | autocomplete / inputmode / dvh / 48px CTA |
| `public/view/modal/*.ejs` | Bottom sheet, 44px close, full-width Send |
| `public/manifest.json` | P3 PWA |

Do not implement a second CSS framework. UIkit + Tailwind is enough; add utilities in `custom.css`.

---

## 35. Anti-patterns to avoid

- A hamburger **plus** 7-icon grid **plus** bottom tabs
- Horizontal swipe between main app sections (conflicts with slider, back gesture, and accidental tab switches)
- `position: fixed` CTA that covers the last list row without padding-bottom
- Disabling pinch-zoom (`user-scalable=no`) — accessibility regression; not recommended
- Relying on hover (`hover:bg-gray-100` without `active:`) as the only press feedback
- `location.replace` for in-app navigation
- Custom selects that render off-screen above the keyboard
- Autoplaying hero video with sound
- Teaching via `uk-tooltip` on touch devices

---

## 36. Device & QA matrix

Test **portrait** unless noted. Chrome DevTools is not sufficient for iOS `dvh`, safe areas, or autofill.

| Device class | CSS width | Must-pass screens |
|---|---|---|
| Small Android | 360×800 | Home, Selection, Login, Registration, engagement sheet |
| iPhone SE | 375×667 | Tab bar + keyboard on login; selection list not 810px |
| iPhone 14/15 | 390×844 | Notch safe-area; sticky header |
| iPhone 14/15 Plus / Pro Max | 430×932 | Same |
| Android tablet / iPad | 768 / 1024 | `lg` nav vs tabs; 2-column selection allowed at 1024 |
| Landscape phone | 667–932 wide | No trapped horizontal scroll; tab bar still usable |

**Per-build smoke (P0):**

- [ ] Every tab has a visible label and ≥44px height
- [ ] Back from Selection returns to Home (history not replaced)
- [ ] Keyboard does not cover Login submit or Email Send
- [ ] Selection page scrolls as one document on 375px (no inner 810px pane)
- [ ] Modal close and engagement rows are tappable with a thumb
- [ ] Dark mode survives reload (`dark` class present)
- [ ] Autofill email/password does not zoom the page (font ≥16px)
- [ ] Legal links open and return without losing the session
- [ ] Reduced-motion: no Click-Me pulse / slideshow autoplay

---

## 37. Acceptance criteria by phase (additions)

**Phase 1 done when:** a 375px-wide phone can identify all destinations without guessing icons, the layout does not use 1015px or 810px traps, and safe areas are padded.

**Phase 2 done when:** home and selection show skeleton → content or retry; login/registration use platform keyboards correctly; profile/trader have a thumb-reachable primary action.

**Phase 3 done when:** Flowbite is not a render-blocker, images do not shift, and 768px tablet is intentional (not “small desktop”).

**Phase 4 done when:** Add to Home Screen works with icon + theme-color, and offline shell does not claim data is available when fetches fail.

---

## 38. Open questions (need product confirmation)

These cannot be decided from source alone:

1. Should **Videos** and **Webinars** stay as home hashes, or become dedicated routes for deeper linking / tab state?
2. Is **Help** in-app chat, email, or an external communicator link? That changes whether it belongs on the tab bar or only in More.
3. Should guests be able to **Contact the trader** (video) or only Message/Download? Affects permission UX and Login gating on mobile.
4. Cart / notifications / messages blocks in the header are commented “under development” — do not reserve tab-bar slots for them until they ship.
5. Social login: `session-checker` exists; no visible Google/Apple buttons in `login/index.ejs`. If Apple Sign In is required for a future App Store wrapper, design the button now (P3).

---

*Notes:* This document is analysis and recommendation only — no source files were modified. Dark mode **is** globally wired for signed-in users (`#night-mode` + `toggle-dark-light.js`), with the `night-mode` vs `dark` class bug noted in §29. Social-login UI is still not present on the login template. Confirm §38 with product before building the tab information architecture.