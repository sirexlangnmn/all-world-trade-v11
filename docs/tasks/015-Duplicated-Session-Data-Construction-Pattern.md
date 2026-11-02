# AI Implementation Task: Consolidate Duplicated Session/View-Data Construction

## 1. Task Title

# Centralize Page-Route Session/View-Data Construction with a Shared Helper and Middleware Without Changing Production Behavior

## 2. Objective

Replace the repeated guest/authenticated session-data construction in `app/src/server.js` and `app/routes/pages/public-pages.routes.js` with one shared, testable source of truth.

The intended end result is:

- One documented helper/middleware module produces the common view data from `req.session.user` and the per-response CSP nonce.
- Page routes stop re-declaring the same `uuid`, `type`, `first_name`, `last_name`, `email`, and `ourGenerateNonce` objects.
- Route-specific data differences remain explicit and unchanged where they are required by the rendered EJS view.
- Guest and authenticated behavior, route URLs, view paths, field names/types, nonce handling, and all side effects remain exactly as they are today.

This is a maintainability refactor. All World Trade is running in production, so the change must be incremental and behavior-preserving. Finding 15 is not a request to redesign authentication or the session model.

## 3. Problem / Finding

**Finding:** Finding 15 — Duplicated Session Data Construction Pattern  
**Source:** `CODE_REVIEW.md` (Detailed Findings)  
**Reported location:** `app/src/server.js`, 15+ page handlers (the review says lines 324–1454; treat line numbers as stale)  
**Severity:** Maintainability / consistency issue. No direct production outage or security vulnerability is reported by this finding.

The review describes this repeated pattern:

```js
if (req.session.user === undefined) {
    const sessionData = {
        uuid: '',
        type: '',
        first_name: '',
        last_name: '',
        email: '',
        country: '',
        state_or_province: '',
        ourGenerateNonce: lodashNonce,
    };
    res.render(path.join(...), { data: sessionData });
} else {
    const sessionData = {
        uuid: req.session.user.uuid,
        type: req.session.user.type,
        first_name: req.session.user.first_name,
        last_name: req.session.user.last_name,
        email: req.session.user.email_or_social_media,
        country: req.session.user.country,
        state_or_province: req.session.user.state_or_province,
        ourGenerateNonce: lodashNonce,
    };
    res.render(path.join(...), { data: sessionData });
}
```

The review's concern is valid: the same object-shaping logic is copied across many page routes. However, the current branch is **not an unmodified copy of the review's example**. A partial extraction already exists, and several route-specific variations already exist. The coding agent must not blindly implement the review's illustrative snippet, because doing so would change current behavior.

Known current variations that must be investigated and preserved:

- Guest handlers use at least three different shapes:
  - `{ ourGenerateNonce: nonce }`
  - empty strings for identity/location fields plus `ourGenerateNonce`
  - `{ id: null, uuid: null, type: null, first_name: null, last_name: null, email: null, ourGenerateNonce: nonce }`
- Authenticated handlers sometimes include `ourGenerateNonce`, and sometimes do not.
- Only some handlers include `country` and `state_or_province`.
- `/help-and-support-profile` uses `status: req.session.user.type`, `email: req.session.user.email_address`, and `type: ''`.
- `/traders-page/:companyName` adds `companyName` and has a guest branch that renders `home/index`.
- `/template` currently builds an authenticated data object but renders without passing it.
- `/help-and-support-registration` renders without a `data` object.
- Authenticated `/registration` renders `selection/index`, not the registration view.
- `app/routes/pages/public-pages.routes.js` already has a local `buildOptionalSessionData` helper with its own null-based guest shape.
- The shared `buildViewData` currently in `server.js` does **not** include `country`/`state_or_province`, and only `home` and `selection` use it.

The review's proposed `{ ourGenerateNonce: lodashNonce }` guest fallback is therefore not sufficient on its own. The target must unify the common mapping while preserving per-view contracts.

**Why this matters:** duplicated data construction drifts over time. Adding a new session field requires finding every copy, and inconsistent guest shapes make pages hard to reason about. A careless refactor can break EJS rendering (`data.uuid`, `data.email`, etc.), CSP nonces, or the difference between login/guest and authenticated pages.

## 4. Affected Functionality

Affected functionality is **server-side page rendering and view data only**:

```text
HTTP GET
   ↓
Express session middleware (req.session.user)
   ↓
Per-response nonce middleware (res.locals.cspNonce)
   ↓
Inline page route / public page route module
   ↓
Route-specific auth/session check and view selection
   ↓
Session/view-data object construction
   ↓
EJS template + shared includes (nav/header/etc.)
   ↓
HTML response
```

Affected areas include:

- Guest and authenticated page rendering
- Session-derived display fields: `uuid`, `type`, `first_name`, `last_name`, `email`
- Optional location fields: `country`, `state_or_province`
- Per-response nonce field: `ourGenerateNonce`
- Public-page helper behavior in `app/routes/pages/public-pages.routes.js`
- Support profile fields: `status`, `type`, `email_address`
- Trader profile parameter: `companyName`
- Existing `buildLoginViewData`, `buildViewData`, `renderLogin`, and `renderPage` helpers in `app/src/server.js`

Affected routes to inventory (verify against current source; do not trust this list as complete):

- `/`
- `/all-about-events`
- `/job-fair`
- `/template`
- `/selection`
- `/profile`
- `/profile2`
- `/help-and-support-profile`
- `/edit-traders-profile`
- `/edit-small-scale-profile`
- `/edit-medium-scale-profile`
- `/edit-large-scale-profile`
- `/registration`
- `/registration-for-small-scale-company`
- `/registration-for-medium-scale-company`
- `/registration-for-large-scale-company`
- `/traders-registration`
- `/help-and-support-registration`
- `/upgrade-plan`
- `/upgrade-to-medium-scale`
- `/upgrade-to-large-scale`
- `/upgrade-to-traders`
- `/traders-page/:companyName`
- `/login`
- `/help-and-support-login`
- `/terms-and-conditions`
- `/data-privacy-notice`
- `/cookie-policy`
- `/pricing`
- `/pricing2`
- `/email-verification` (different data shape; likely reference only)

Not in scope:

- API route request/response behavior
- Login authentication logic
- Database access and Sequelize/mysql2 stacks
- Socket.IO / real-time call handling
- Cron jobs
- Upload handling
- Email sending

## 5. Investigation Phase

This section is mandatory. Do not edit code until all investigation items are complete.

1. Read `README.md`, `AGENTS.md`, and `CODE_REVIEW.md`. Focus on:
   - README §6 Frontend Architecture, §7 Backend Architecture, §12 Authentication & Security
   - AGENTS.md architecture, auth/session, backend conventions, and finding references
   - CODE_REVIEW.md Finding 14, Finding 15, and §2b/§2c refactor guidance
2. Read the current `app/src/server.js` from top to bottom. Confirm its actual line count and current structure. The review's `1,587 lines` and `324–1454` references may be stale.
3. Inventory every page route and record:
   - HTTP method and path(s)
   - Guest condition (`req.session.user === undefined`, `!sessionUser`, or another check)
   - Guest view path and guest `data` shape
   - Authenticated view path and authenticated `data` shape
   - Whether `ourGenerateNonce` is present in `data`
   - Whether `country` / `state_or_province` are present
   - Route-specific fields such as `companyName`, `status`, `email_address`, or `id`
   - Any side effects such as DB login-status checks, logging, redirects, or rendering without `data`
4. Search the repository for every construction site. At minimum:

   ```bash
   rg "sessionData|buildViewData|buildLoginViewData|buildOptionalSessionData|ourGenerateNonce|res\.render" app test
   rg "req\.session\.user" app/src app/routes app/controllers app/db_controllers
   ```

   Search for other names the route may use (`viewData`, `data:`, etc.) and inspect the complete current code path, not only the snippet in `CODE_REVIEW.md`.
5. Inspect `app/routes/pages/public-pages.routes.js`. Record the existing `buildOptionalSessionData`, `renderOptionalSessionPage`, and each route's exact data shape. Note that its guest shape uses `null` values and includes `id: null`, while its authenticated shape omits `ourGenerateNonce`. Determine whether those shapes are intentional by checking the views and tests.
6. Inspect every EJS view and shared include that consumes `data`:
   - `public/view/includes/nav/*`
   - `public/view/includes/header*/*`
   - `public/view/legal/*`
   - `public/view/pricing/*`
   - `public/view/home/*`
   - `public/view/all-about-events/*`
   - `public/view/wizard-job-fair/*`
   - `public/view/profile/*`
   - `public/view/upgrade/*`
   - `public/view/registration*/*`
   - `public/view/traders-page/*`
   - `public/view/selection/*`
   - `public/view/login/*`

   Search for `data.` usage and note which fields are actually read. Distinguish live code from commented-out code. Pay special attention to equality checks against `''`, `null`, or `undefined`, and to any template that expects a field to be absent versus empty.
7. Inspect the nonce/Helmet ordering:
   - `app/middleware/nonces/index.js` generates `req.cspNonce` and `res.locals.cspNonce`.
   - `app/middleware/helmet/index.js` reads the nonce.
   - EJS templates use `nonce="<%= cspNonce %>"` from `res.locals`, not necessarily `data.ourGenerateNonce`.
   - Determine whether `data.ourGenerateNonce` is consumed anywhere. Preserve it where it currently exists unless evidence shows it is safe to remove. Never generate a second nonce in the new helper.
8. Inspect `app/middleware/index.js` and existing middleware conventions. Determine whether the shared helper belongs in:
   - `app/middleware/view-data.middleware.js` (Finding 15's recommendation), or
   - an existing `app/utils/session-data.js` if Finding 14's work has already created it.

   Do not create both. If both already exist, consolidate carefully and report the conflict. The pure builder logic may live in `app/utils/session-data.js` with a thin middleware wrapper if that matches the current branch; otherwise one middleware module is sufficient.
9. Inspect the existing tests and test style:
   - `test/public-pages-routes.test.js` shows how route modules are registered against a fake `app` and how `res.render` calls are asserted.
   - `test/login.test.js` and other tests may assert session-dependent behavior.
   - `package.json` uses `node --test` for `npm test`.
10. Inspect `git status` and the current diff. The worktree may contain uncommitted changes from other findings. Do not revert, overwrite, or reformat unrelated work. Coordinate with any existing `buildViewData` / `buildOptionalSessionData` changes.
11. Create a written compatibility matrix before editing. For every affected route, list the exact field set and value type for both guest and authenticated requests. Mark anything uncertain as `TO INVESTIGATE`. Do not infer behavior from names alone.

## 6. File Impact Analysis

| File                                             | Role                                                                 | Action                       | Reason                                                                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/middleware/view-data.middleware.js`         | Proposed shared builder/middleware                                  | ADD                          | Finding 15's preferred home for one session-data source of truth. Confirm no equivalent already exists before creating it.                                   |
| `app/utils/session-data.js`                      | Possible existing/alternative helper location from Finding 14        | INVESTIGATE                  | If it already exists, reuse or consolidate instead of creating a duplicate helper.                                                                            |
| `app/src/server.js`                              | Inline page routes and current helpers                               | MODIFY                       | Register shared middleware before page routes and replace duplicated `sessionData` construction. Preserve route logic, views, side effects, and data shapes.   |
| `app/routes/pages/public-pages.routes.js`        | Already-extracted public page routes with local helper               | MODIFY / REFERENCE           | Reuse the shared helper if behavior-preserving. Preserve `id: null`, null guest fields, authenticated nonce omission, `/login`, and `/email-verification` behavior. |
| `test/015-session-view-data.test.js`             | New focused test file                                                | ADD                          | Test the shared builder/middleware and route-specific variants without starting the production server.                                                        |
| `test/public-pages-routes.test.js`               | Existing route tests                                                 | MODIFY only if needed        | It asserts exact data shapes. Do not change assertions merely to make a new implementation pass; the implementation must preserve current behavior.           |
| `app/middleware/nonces/index.js`                 | Per-response nonce source                                            | REFERENCE ONLY               | The shared builder must consume `res.locals.cspNonce`; it must not create a nonce or change nonce lifecycle.                                                 |
| `app/middleware/helmet/index.js`                 | CSP integration                                                      | REFERENCE ONLY               | No CSP behavior should change.                                                                                                                                |
| `public/view/**/*.ejs`                           | Consumers of `data.*`                                                | REFERENCE ONLY               | Investigate field usage; do not change templates unless a bug is explicitly proven and approved.                                                              |
| `app/routes/pages/*`                             | Existing route-module convention                                     | REFERENCE ONLY               | Follow the `module.exports = (app) => { ... }` pattern if moving any route data construction.                                                                  |
| `docs/tasks/014-Monolithic-server-js-1587-Lines.md` | Related server decomposition task                                 | REFERENCE ONLY               | Finding 14 may extract routes/helpers concurrently. Avoid duplicate helpers and coordinate module ownership.                                                 |
| `README.md` / `AGENTS.md` / `CODE_REVIEW.md`      | Project documentation                                                | REFERENCE ONLY / UPDATE only if structure changes | Update only if the documented module layout changes. Do not rewrite documentation as part of this task.                                                       |
| `.env`, secrets, deployment config                | Runtime configuration                                               | REFERENCE ONLY               | No configuration changes are needed.                                                                                                                          |

Reclassify these actions based on repository evidence. `ADD` is not a mandate if an equivalent module already exists.

## 7. Current Implementation

### Verified current state (verify again before editing)

- `app/src/server.js` is the production entry point via `npm run dev` / `npm start`.
- The file now has shared helpers near its helper section:

  ```js
  const buildLoginViewData = (nonce) => ({
      ourGenerateNonce: nonce,
  });

  const buildViewData = (sessionUser, nonce) => ({
      uuid: sessionUser.uuid,
      type: sessionUser.type,
      first_name: sessionUser.first_name,
      last_name: sessionUser.last_name,
      email: sessionUser.email_or_social_media,
      ourGenerateNonce: nonce,
  });

  const renderLogin = (res) => {
      return res.render(path.join(__dirname, '../../', 'public/view/login/index'), {
          data: buildLoginViewData(res.locals.cspNonce),
      });
  };

  const VIEW_BASE_PATH = path.join(__dirname, '../../', 'public/view');

  const renderPage = (res, page, data = {}) => {
      const viewPath = path.join(VIEW_BASE_PATH, page, 'index');
      return res.render(viewPath, { data });
  };
  ```

- Only `/` (`home`) and `/selection` currently call `buildViewData`.
- Most other page routes still inline guest/authenticated `sessionData` objects.
- `app/routes/pages/public-pages.routes.js` has a separate local helper:

  ```js
  function buildOptionalSessionData(sessionUser, nonce) {
      if (sessionUser === undefined) {
          return {
              id: null,
              uuid: null,
              type: null,
              first_name: null,
              last_name: null,
              email: null,
              ourGenerateNonce: nonce,
          };
      }

      return {
          uuid: sessionUser.uuid,
          type: sessionUser.type,
          first_name: sessionUser.first_name,
          last_name: sessionUser.last_name,
          email: sessionUser.email_or_social_media,
      };
  }
  ```

- The per-response nonce is produced by `nonceMiddleware` and exposed as `res.locals.cspNonce`. `server.js` reads `res.locals.cspNonce` when building data. EJS scripts commonly use `<%= cspNonce %>` from locals.

### Current route data variants discovered during initial inspection

Treat this table as a starting point, not a complete specification. Rebuild it from source before editing.

| Route(s)                                                                  | Guest data                                                                                     | Authenticated data                                                                                 | Notes                                                                 |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `/`                                                                       | login render via `renderLogin` (`{ nonce }`)                                                    | `buildViewData` (`uuid,type,first,last,email,nonce`)                                                | Also performs DB login-status check via `isUserLoggedIn`.             |
| `/all-about-events`                                                       | empty strings for identity + country/state + nonce                                             | identity + country/state + nonce                                                                    | Renders `all-about-events/index`.                                     |
| `/job-fair`                                                               | `{ nonce }` → `login/index`                                                                    | identity + country/state + nonce → `wizard-job-fair/index`                                          |                                                                       |
| `/template`                                                               | render `login/index` with no `data`                                                            | builds an identity object but renders `home/template` without `data`                                | The authenticated object is currently dead code; verify before removal. |
| `/selection`                                                              | login render via `renderLogin`                                                                 | `buildViewData`                                                                                     | Async DB login-status check.                                          |
| `/profile`                                                                | `{ nonce }` → login                                                                             | identity + nonce, view selected by `type` 1–5                                                       |                                                                       |
| `/profile2`                                                               | `{ nonce }` → login                                                                             | identity only (no nonce) → `profile/edit`                                                           |                                                                       |
| `/help-and-support-profile`                                               | `{ nonce }` → support login                                                                     | `uuid, type:'', status:user.type, first,last,email:user.email_address,nonce` → support profile       | Special shape.                                                        |
| `/edit-traders-profile`, `/edit-small-scale-profile`, `/edit-medium-scale-profile`, `/edit-large-scale-profile` | `{ nonce }` → login                        | identity only (no nonce) → tier edit view                                                           |                                                                       |
| `/registration`                                                           | `{ nonce }` → `registration-v2/index`                                                           | identity + nonce → `selection/index`                                                                | Guest/auth render different views.                                    |
| `/registration-for-small-scale-company`, `/registration-for-medium-scale-company`, `/registration-for-large-scale-company`, `/traders-registration` | `{ nonce }` only | n/a (no session branch)                                                                             | Old registration pages.                                               |
| `/help-and-support-registration`                                          | no `data`                                                                                       | n/a                                                                                                 | Preserve no-data render.                                              |
| `/upgrade-plan`, `/upgrade-to-medium-scale`, `/upgrade-to-large-scale`, `/upgrade-to-traders` | `{ nonce }` → login                                                        | identity only (no nonce) → upgrade view                                                             |                                                                       |
| `/traders-page/:companyName`                                              | empty identity + country/state + nonce → `home/index`                                           | identity + country/state + `companyName` + nonce → `traders-page/index`                            | Guest renders a different view. There is also a shadowed `let sessionData`. |
| `/login`                                                                  | `{ nonce }`                                                                                     | n/a                                                                                                 | Public route module.                                                  |
| `/help-and-support-login`                                                 | no `data`                                                                                       | n/a                                                                                                 | Public route module.                                                  |
| `/terms-and-conditions`, `/data-privacy-notice`, `/cookie-policy`, `/pricing`, `/pricing2` | `{ id:null, uuid:null, type:null, first:null, last:null, email:null, nonce }` | `{ uuid,type,first,last,email }` (no nonce)                                                          | Public route module.                                                  |
| `/email-verification`                                                     | `{ registration_email_address }`                                                                | n/a                                                                                                 | Different purpose; do not force into the session-data contract.       |

### Why a blind middleware replacement is unsafe

The review's illustrative middleware returns only a standard identity object and `ourGenerateNonce`. If applied unchanged:

- `/all-about-events` guest values change from empty strings to `undefined`.
- Public legal/pricing guest values change from `null` to `undefined` and the `id` key disappears.
- `/help-and-support-profile` loses `status` and the `email_address` mapping.
- `/traders-page/:companyName` loses `companyName`.
- Routes that currently omit `ourGenerateNonce` gain an extra key.
- Routes that render without `data` may accidentally receive data.
- `/template` and `/traders-page` guest/auth view selection may be disturbed.

The coding agent must inspect the actual implementation and preserve these differences unless the user explicitly approves a behavior change.

## 8. Current → Target

### Current

Each page route owns its own session check and data object construction. Common identity mapping is copied, but guest fallbacks and extras drift per route. Two partial helper implementations exist (`buildViewData` in `server.js`, `buildOptionalSessionData` in the public page module).

```js
// CURRENT (illustrative, from the existing code)
app.get(['/profile2'], (req, res) => {
    if (req.session.user === undefined) {
        const sessionData = { ourGenerateNonce: res.locals.cspNonce };
        res.render(path.join(__dirname, '../../', 'public/view/login/index'), { data: sessionData });
    } else {
        const sessionData = {
            uuid: req.session.user.uuid,
            type: req.session.user.type,
            first_name: req.session.user.first_name,
            last_name: req.session.user.last_name,
            email: req.session.user.email_or_social_media,
        };
        res.render(path.join(__dirname, '../../', 'public/view/profile/edit'), { data: sessionData });
    }
});
```

### Target

A shared module owns the common mapping and the per-request `req.viewData` object. Routes still own their authentication/session checks and view selection because those are route behavior, not data shaping. Route-specific fields remain explicit.

```text
app/middleware/view-data.middleware.js  (or existing app/utils/session-data.js)
   ├── buildGuestViewData(nonce)                      // common guest mapping
   ├── buildAuthenticatedViewData(sessionUser, nonce) // common auth mapping
   ├── viewDataMiddleware(req, res, next)             // attaches req.viewData per request
   └── (optional) small named variant builders for genuinely unique shapes

app/src/server.js
   ├── registers viewDataMiddleware after session + nonce middleware
   ├── keeps route-specific checks/view selection
   ├── merges route-specific extras only where current code has them
   └── renders with req.viewData (or a named builder for unique routes)
```

Illustrative target only. Adapt it to the actual repository; do not copy it blindly.

```js
// TARGET SHAPE — inspect and adapt
const buildGuestViewData = (nonce) => ({
    uuid: '',
    type: '',
    first_name: '',
    last_name: '',
    email: '',
    ourGenerateNonce: nonce,
});

const buildAuthenticatedViewData = (sessionUser, nonce) => ({
    uuid: sessionUser.uuid,
    type: sessionUser.type,
    first_name: sessionUser.first_name,
    last_name: sessionUser.last_name,
    email: sessionUser.email_or_social_media,
    ourGenerateNonce: nonce,
});

const viewDataMiddleware = (req, res, next) => {
    const sessionUser = req.session ? req.session.user : undefined;
    req.viewData =
        sessionUser === undefined
            ? buildGuestViewData(res.locals.cspNonce)
            : buildAuthenticatedViewData(sessionUser, res.locals.cspNonce);
    next();
};
```

Then each route should only do what is specific to that route:

```js
// TARGET SHAPE — behavior must match the current route exactly
app.get(['/profile2'], (req, res) => {
    if (req.session.user === undefined) {
        return res.render(path.join(__dirname, '../../', 'public/view/login/index'), {
            data: req.viewData,
        });
    }

    // If current behavior intentionally omits ourGenerateNonce, preserve that.
    const data = buildAuthenticatedViewDataWithoutNonce(req.session.user);

    return res.render(path.join(__dirname, '../../', 'public/view/profile/edit'), {
        data,
    });
});
```

The exact helper API is intentionally not fixed here. Choose the smallest API that preserves all observed shapes. Options include:

- A common builder plus route-level merge for extras.
- A common builder with a narrow options object (`includeLocation`, `includeNonce`) only if the variants are regular.
- A separate named builder for a genuinely unique route (for example support profile or public optional-session pages).

Do not build a broad options framework for one-off shapes. Prefer readable named builders.

## 9. Detailed Implementation Plan

### Step 1 — Build the compatibility matrix

Before editing, produce a table for every affected route:

```text
route | method | guest predicate | guest view | guest data keys/types | auth view | auth data keys/types | nonce in data | extras | side effects
```

Include whether `data` is passed at all. Verify `id`, `null`, `''`, and `undefined` distinctions. Use actual EJS usage to determine whether a difference is observable.

### Step 2 — Confirm the helper ownership and location

Check whether `app/utils/session-data.js`, `app/middleware/view-data.middleware.js`, or another helper already exists on the current branch.

- If an equivalent exists, extend/reuse it.
- If Finding 14 is concurrently extracting view helpers, coordinate and do not create a duplicate.
- Otherwise, add one module using the existing CommonJS/style conventions.
- Export pure builders separately from the middleware so they are unit-testable without Express.

### Step 3 — Implement the shared builders and middleware

Requirements:

- Read `req.session.user` and `res.locals.cspNonce`.
- Produce a fresh object per request.
- Map `email_or_social_media` to `email` for standard routes.
- Preserve `uuid` as stored (AES-encrypted); never decrypt in this helper.
- Never generate a second nonce.
- Never mutate `req.session.user`.
- Never attach the raw session object to view data.
- Keep route-specific field mapping explicit.
- Guard `req.session` if it can be null.

Register the middleware only where it is needed:

- It must run after `sessionMiddleware` and `nonceMiddleware`.
- It must run before page routes that use `req.viewData`.
- It should not be mounted in a way that changes API route behavior.
- Do not reorder existing middleware, static serving, error handling, or route modules.

If the middleware is registered immediately before the page-route section in `server.js`, verify the API modules and static/error middleware are already registered above it and remain unaffected.

### Step 4 — Replace route data construction incrementally

Work in small groups so each change is reviewable. Suggested groups:

1. Standard authenticated routes with nonce: `/all-about-events`, `/job-fair`, `/profile`, `/registration`.
2. Standard authenticated routes without nonce: `/profile2`, four `/edit-*-profile`, four `/upgrade-*`.
3. Guest-only routes: registration-for-* and traders-registration, `/login`.
4. Special routes: `/help-and-support-profile`, `/traders-page/:companyName`, `/template`, `/help-and-support-registration`, `/email-verification`.
5. Public optional-session routes: legal/pricing module.

For each route:

- Keep the same method(s) and path aliases.
- Keep the same guest predicate unless the investigation proves it is safe to normalize. `=== undefined` and `!sessionUser` are not equivalent for `null`.
- Keep the same view path(s) and view-selection conditions.
- Keep all side effects (DB checks, logging, redirects, error handling).
- Replace only the data object construction and pass the equivalent object to `res.render`.
- Preserve `data` vs no `data` exactly.
- Do not remove route-specific fields without evidence they are unused and a separate approval.

### Step 5 — Consolidate the public page helper

`app/routes/pages/public-pages.routes.js` already has `buildOptionalSessionData`. Either:

- move its logic to the shared module and re-export/import it, preserving exact null-based guest shape and nonce omission for authenticated users; or
- keep the local helper if its shape is genuinely unique and document why.

Do not force public pages into a shared standard shape if that changes their tested contract. Update `test/public-pages-routes.test.js` only if the extraction preserves behavior and only to reflect a genuinely equivalent implementation, not to mask a behavior change.

### Step 6 — Remove genuine dead code carefully

There are known unused constructions:

- `/template` builds an authenticated `sessionData` but does not pass it.
- `/traders-page/:companyName` creates a shadowed `let sessionData = { companyName }` that is never used by the branches.

Remove these only after confirming they have no runtime effect and no tests depend on them. Do not remove route logic or comments as part of cleanup unless directly related.

### Step 7 — Add focused tests

Add `test/015-session-view-data.test.js` using `node:test` and `node:assert/strict`. Test:

- Guest builder output for a set nonce.
- Authenticated builder mapping, including `email_or_social_media` → `email`.
- Middleware attaches `req.viewData` for guest and authenticated requests.
- Middleware uses `res.locals.cspNonce` and creates a fresh object per call.
- Middleware does not mutate the session user.
- Route-specific variants preserve `country`/`state_or_province`, `companyName`, support `status`/`email_address`, `id: null`, and authenticated nonce omission as applicable.
- Public page helper contract remains unchanged (or update the existing test only for a behavior-preserving extraction).

Use the existing `test/public-pages-routes.test.js` pattern for route-level rendering assertions. Avoid starting the production listener or requiring a live database for pure helper tests.

### Step 8 — Verify and review

- Rebuild the route matrix from the final code and compare it to the baseline.
- Run the focused tests.
- Run `npm test` and report skips separately.
- Run `node --check` on changed JavaScript files.
- Inspect the final diff for unrelated changes.
- Confirm the original duplication is reduced and no route behavior changed.

## 10. Architecture and Existing Patterns

Follow existing project conventions:

- CommonJS modules and `'use strict'` where the file already uses it.
- Route modules use `module.exports = (app) => { ... }`.
- Middleware modules export named functions/objects, as in `app/middleware/nonces/index.js` and `app/middleware/helmet/index.js`.
- EJS rendering passes `{ data }` to `res.render`.
- Session user fields are consumed directly; UUIDs remain encrypted.
- Tests use Node's built-in `node:test` and `node:assert/strict`.
- Pure mapping helpers are preferred over I/O in tests, consistent with `CODE_REVIEW.md` §2b.
- New business/database logic belongs in the Sequelize stack, but this task should not touch databases at all.

Search for and reuse existing helpers before writing new ones:

- `buildLoginViewData`, `buildViewData`, `renderLogin`, `renderPage`
- `buildOptionalSessionData`, `renderOptionalSessionPage`
- any existing `app/utils/session-data.js` or view-data equivalent
- existing nonce middleware

Do not introduce a new dependency, framework, architecture, or design pattern when an appropriate project pattern already exists.

## 11. Security Requirements

This finding is not itself a security vulnerability, but the view-data helper touches session data and CSP nonces.

- Never expose the raw `req.session` or `req.session.user` object to EJS.
- Only include whitelisted fields in view data.
- Do not add fields such as passwords, hashes, reset tokens, encrypted secrets, or internal IDs beyond what is currently passed.
- Do not decrypt UUIDs in the view-data helper. Existing routes pass the encrypted UUID; preserve that.
- Never generate a second CSP nonce. Use `res.locals.cspNonce` from the existing `nonceMiddleware`.
- Never cache or reuse view data/nonces across requests. Create a fresh object per request.
- Do not change the order of nonce middleware, Helmet, session middleware, or page routes.
- Do not weaken or bypass authentication/session checks while removing duplication.
- Do not log session data or view data.
- Do not change login-status (`isUserLoggedIn`) behavior.
- Do not let route-specific extras leak into other routes. Avoid mutating a shared object.
- Do not change guest handling in a way that could expose authenticated-only fields.

## 12. Backward Compatibility

The refactor must preserve:

- Every route method, path, alias, and route order.
- Every view path and guest/authenticated view selection.
- Exact data key names and value types where observable:
  - `''` vs `null` vs `undefined`
  - presence vs absence of `ourGenerateNonce`
  - presence vs absence of `country` / `state_or_province`
  - `id: null` on public optional-session pages
  - `companyName` on the trader page
  - support `status`, `type: ''`, and `email_address` mapping
- Rendering without `data` where currently done.
- Existing side effects, logging, redirects, and DB checks.
- Existing tests and their asserted contracts.
- CSP nonce propagation and Helmet behavior.
- API routes, static files, error handling, Socket.IO, cron, and startup order.

Adding extra keys to a data object is not automatically safe just because EJS usually ignores them. Exact-shape tests and template equality checks may observe the difference. Preserve first; normalize only with explicit approval and proof.

## 13. Testing Strategy

### Normal case

- Guest request to a standard route yields the same `data` shape as before.
- Authenticated request yields the same identity mapping as before.
- A route that currently omits `ourGenerateNonce` still omits it.
- A route that currently includes location or `companyName` still includes it.

### Empty / missing input

- Missing `req.session` or `req.session.user` follows the same guest path as the current route.
- Missing optional fields (`country`, `state_or_province`, support fields) do not throw.
- Authenticated objects with only the existing required fields still render.

### Boundary cases

- Empty-string values remain empty strings where currently expected.
- `null` guest fields remain `null` on public optional-session pages.
- Encrypted UUID strings pass through unchanged.
- Non-standard `type` values (for example 5/customer service) preserve existing view selection.
- Support `email_address` is mapped correctly and is not confused with `email_or_social_media`.

### Invalid input

- A `req.session` value that is empty or lacks `user` does not crash the middleware.
- A route-specific extra that is undefined does not introduce `undefined` keys where the current route omitted them.
- Do not invent validation that changes current behavior.

### Security cases

- Verify no raw session object reaches `res.render`.
- Verify no new sensitive fields appear in view data.
- Verify the nonce comes from `res.locals.cspNonce` and remains per-response.
- Verify middleware ordering has not moved nonce generation after Helmet or page routes.
- Verify guest data cannot contain authenticated identity values.

### Regression testing

- Run `test/public-pages-routes.test.js`.
- Run the new `test/015-session-view-data.test.js`.
- Run `npm test`; report database-dependent skips separately and do not present them as passes.
- Run `node --check` on changed JavaScript files.
- If runtime smoke testing is available, start the app only with a configured non-local-production environment and check representative guest/authenticated pages without mutating production data.
- Do not run `tailwindBuild` or `webpackBuild`; no frontend assets should change.

### Formatting

- Follow the repository's Prettier config.
- `npm run lint` runs `prettier --write .` and can touch unrelated files. Prefer formatting only changed files if possible, and inspect the diff before/after. Do not reformat unrelated work already present in the worktree.

## 14. Verification / Evidence

Provide evidence, not just a claim of completion:

1. Show the baseline route/data matrix and the final matrix side by side.
2. Show that every affected route was converted or explicitly retained with a reason.
3. Show the shared helper/middleware unit tests and their results.
4. Show `test/public-pages-routes.test.js` still passing with unchanged contracts (or explain any deliberate, approved change).
5. Show `npm test` results, listing skipped integration tests.
6. Show `node --check` results for changed files.
7. Grep the final code to demonstrate that duplicate standard session-data construction was removed and no stray copies remain.
8. Confirm no new nonce generation, no session logging, no raw session exposure, and no middleware-order changes.
9. Review the final diff and list any unrelated files that were already modified before this task.
10. Report any behavior that could not be exercised without production services as a remaining risk rather than claiming it was verified.

## 15. Do NOT Do

- Do not rewrite the application or replace Express/EJS.
- Do not change route URLs, methods, aliases, middleware order, or startup sequence.
- Do not change view paths or guest/authenticated view selection.
- Do not normalize all routes to one data shape without proof that every view and test tolerates it.
- Do not remove `id: null` from public legal/pricing guest data.
- Do not change the support profile `status`, `type: ''`, or `email_address` mapping.
- Do not remove `companyName` from the trader page.
- Do not add `ourGenerateNonce` to routes that currently omit it unless proven behavior-neutral and approved.
- Do not add `data` to routes that currently render without it.
- Do not change `req.session.user === undefined` to `!req.session.user` (or vice versa) without investigating null behavior.
- Do not generate a new nonce or change nonce middleware/Helmet ordering.
- Do not expose, log, or persist session data.
- Do not modify API routes, database code, upload code, email code, Socket.IO, or cron behavior.
- Do not add dependencies, change package scripts, or change environment/secrets.
- Do not modify `.env` or production configuration.
- Do not remove tests because they fail; fix the implementation or report the conflict.
- Do not suppress errors or replace explicit failures with success-shaped fallbacks.
- Do not reformat or revert unrelated worktree changes from other findings.
- Do not combine this task with Finding 14's route extraction. Coordinate if that work is already in progress.

## 16. Acceptance Criteria

- [ ] README, AGENTS.md, CODE_REVIEW.md, and the current source were inspected before edits.
- [ ] A complete baseline route/data compatibility matrix was produced.
- [ ] The existing `buildViewData` and `buildOptionalSessionData` implementations were investigated and reused/consolidated without duplication.
- [ ] A single shared session/view-data source of truth exists for the common mapping.
- [ ] The shared helper consumes `res.locals.cspNonce` and never generates a nonce.
- [ ] Middleware is registered after session/nonce middleware and before affected page routes without changing other middleware order.
- [ ] Standard duplicated `sessionData` construction is removed from affected routes.
- [ ] Route-specific data (`country`, `state_or_province`, `companyName`, support `status`/`email_address`, `id: null`, nonce omission) is preserved.
- [ ] Guest and authenticated view selection and side effects are unchanged.
- [ ] Routes that render without `data` still render without `data`.
- [ ] Existing public-page route tests pass with their contracts intact.
- [ ] New focused tests cover the shared builders/middleware and route variants.
- [ ] `npm test` was run; skips are reported separately.
- [ ] `node --check` was run on changed JavaScript files.
- [ ] No unrelated files were modified, and pre-existing worktree changes were not reverted.
- [ ] Final diff was reviewed and remaining risks are documented.

## 17. Expected Final Report

Finish with this structure:

```markdown
# Implementation Report

## Summary

Briefly explain what was centralized and how behavior was preserved.

## Files Modified

| File | Changes |
|---|---|
| `...` | ... |

## Files Added

| File | Purpose |
|---|---|
| `...` | ... |

## Files Deleted

| File | Reason |
|---|---|
| `...` | ... |

## Files Referenced Only

| File | Why |
|---|---|
| `...` | ... |

## Implementation Details

Describe the helper/middleware API, the route groups converted, and any route-specific variants retained.

## Compatibility Matrix

Show the final guest/authenticated data shapes per affected route and note any intentional differences from the baseline.

## Testing

| Test / check | Result |
|---|---|
| Shared builder/middleware tests | PASS / FAIL / NOT RUN |
| Public page route tests | PASS / FAIL / NOT RUN |
| `npm test` | PASS / FAIL / SKIPPED (explain) |
| `node --check` | PASS / FAIL / NOT RUN |
| Runtime smoke check | PASS / FAIL / NOT RUN (explain) |

## Verification

Explain how the original duplication was reduced and how route/data behavior was verified as unchanged. Include grep/diff evidence.

## Remaining Risks

List anything that could not be verified without production services, plus any unresolved route/data-shape ambiguities.

## Final Status

PASS / NEEDS REVIEW
```

## 18. Important Rules for the Coding Agent

### Rule 1 — Verify the current branch

`CODE_REVIEW.md`, `README.md`, and the review's line numbers/counts may be stale. The current source already contains partial extraction and route-specific variations. Confirm everything against the checked-out code.

### Rule 2 — Separate facts from recommendations

Label observed current behavior separately from suggested helpers/module boundaries. Mark unknowns `TO INVESTIGATE`. Do not turn an assumption into a requirement.

### Rule 3 — Preserve behavior first

The production system must remain functional. Prefer small, reviewable conversions. Do not normalize data shapes, route behavior, or view paths unless the task explicitly requires it and the evidence proves it is safe.

### Rule 4 — Follow the entire request path

Inspect session middleware → nonce middleware → route → data construction → `res.render` → EJS template/includes. Do not test only the helper in isolation.

### Rule 5 — Reuse existing patterns

Use the existing route-module, middleware, render, nonce, and test conventions. Do not create a duplicate helper if `buildViewData`, `buildOptionalSessionData`, or another equivalent already exists.

### Rule 6 — Keep the scope narrow

This task is about duplicated view-data construction. It is not a route extraction (Finding 14), an authentication redesign, a template rewrite, or a security-fix task. Report unrelated issues separately.

## 19. Output Requirements

Implement only the session/view-data consolidation described here. Keep the changes small, testable, and behavior-preserving. Report the exact files changed, the compatibility matrix, tests and checks performed, verification evidence, and any remaining uncertainty.
