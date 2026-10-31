# AI Implementation Task: Incrementally Decompose the Monolithic Express Server

## 1. Task Title

# Refactor `app/src/server.js` into Focused Modules Without Changing Production Behavior

## 2. Objective

Reduce the responsibilities and navigational complexity of `app/src/server.js` by extracting cohesive page-route groups, shared utilities, and middleware configuration into focused modules. Keep `server.js` as the application bootstrap/orchestrator.

The application is working in production. This is a staged maintainability refactor, not a rewrite or an opportunity to change business behavior. Every extraction must preserve route URLs, middleware ordering, session and view data, rendered templates, API behavior, Socket.IO behavior, scheduled jobs, startup sequencing, and deployment assumptions.

The end result should make the server easier to navigate and test while preserving its existing runtime behavior. Reduce the monolith incrementally; do not make a large, all-at-once move based only on the proposed file names in the review.

## 3. Problem / Finding

**Finding:** Finding 14 — Monolithic `server.js` (1,587 Lines)  
**Source:** `CODE_REVIEW.md`, Detailed Findings  
**Primary location:** `app/src/server.js`  
**Severity:** Maintainability / testability concern; no production failure is reported by this finding.

The review describes a single entry-point file mixing application setup, middleware, database synchronization, page routes, helper functions, business logic, and Socket.IO setup. Page handlers also contain repeated session/view-data construction.

The review's implementation suggestions are recommendations, not proof that every item remains unextracted. The current source already includes shared view helpers such as `buildLoginViewData`, `buildViewData`, `renderLogin`, and `renderPage`; inspect the current branch before deciding what remains to be moved. The current `server.js` also contains inline page routes, startup wiring, and other responsibilities. Do not copy stale line numbers or counts from the review without verifying them.

**Why this matters:** Mixing bootstrap concerns, route definitions, and reusable logic makes changes harder to locate and test. Repeated route data construction can drift. Moving code carelessly, however, can change middleware precedence, route matching, session handling, or startup behavior.

## 4. Affected Functionality

Potentially affected areas include application startup, page rendering, session-dependent pages, API mounting order, middleware, Socket.IO session/signaling behavior, cron registration, database initialization, and shared formatting/date/authentication logic.

The broad request lifecycle is:

```text
Process startup
   ↓
Environment/configuration and Express application creation
   ↓
Middleware registration (order is significant)
   ↓
HTTP server and Socket.IO setup
   ↓
Session-aware API and page routes
   ↓
Database/services/external integrations as required by a handler
   ↓
EJS page or API response
```

Inspect the actual startup sequence and each route before moving it. Some initialization may be intentionally asynchronous or may depend on modules being mounted in a particular order.

## 5. Investigation Phase

Complete this investigation before editing:

1. Read `README.md`, `AGENTS.md`, and `CODE_REVIEW.md`. Focus on the system architecture, backend conventions, deployment, testing, Finding 14, Finding 15, and the review's incremental-refactoring guidance. The production system must remain functional.
2. Read the current `app/src/server.js` from top to bottom. Record the actual responsibilities, exported values (if any), startup side effects, route registrations, middleware registrations, and execution order. Recheck the file's current line count rather than relying on “1,587”.
3. Inventory all routes currently registered inline. For each, record HTTP method, path/aliases, middleware, session/authentication conditions, rendered view or response, and any route-specific parameters or data.
4. Trace all startup dependencies and side effects, including `dotenv`, secret validation, database initialization and `sequelize.sync()`, API route modules, static files, error handling, cron jobs, HTTP/HTTPS selection, Socket.IO, session middleware sharing, and `server.listen()`. Confirm the actual order in source.
5. Search for every use and import of functions proposed for extraction, including `phTime`, formatting helpers, view-data/render helpers, download-history logic, and authentication/session checks. Check whether equivalent helpers already exist in `app/utils/`, `app/services/`, or middleware modules. Reuse an established implementation where behavior matches; do not create duplicate helpers.
6. Inspect existing route-module conventions in `app/routes/*.js`, middleware exports, service/util exports, and any page-route modules that may already exist. Verify whether `app/routes/pages/`, `app/middleware/setup.js`, `app/utils/session-data.js`, `app/utils/formatting.js`, or an auth service already exists on the current branch.
7. Search all repository references to each route path and rendered view, including EJS links/forms and client JavaScript. Ensure route extraction does not change public URLs or view contracts.
8. Examine `test/`, `package.json`, and current test conventions. Identify tests that can verify extracted pure helpers and route behavior without starting a production-like listener or requiring a live database. `npm test` uses Node's built-in test runner; integration tests may depend on configured services.
9. Inspect git/worktree changes before modifying files. Preserve unrelated work and integrate any existing changes in files that must be touched.
10. Create a written route/startup/middleware inventory for implementation purposes. Mark uncertain behavior `TO INVESTIGATE`; do not infer intended behavior from naming alone.

## 6. File Impact Analysis

| File | Role | Action | Reason |
|---|---|---|---|
| `app/src/server.js` | Application entry point, initialization, route registration, and server startup | MODIFY | Retain it as the thin orchestrator while extracting verified responsibilities in small, reviewable steps. |
| `app/routes/pages/` | Proposed location for page-route modules | INVESTIGATE / ADD only if needed | The review suggests grouped page modules; verify existing folders, route conventions, and grouping before creating modules. |
| `app/middleware/setup.js` | Proposed middleware setup module | INVESTIGATE / ADD only if needed | Extract middleware configuration only if it can preserve exact registration order and access to required app/server state. |
| `app/utils/session-data.js` | Proposed session/view-data helper | INVESTIGATE / ADD only if needed | Shared view helpers already exist in the current entry point; check for duplication and preserve per-view data differences. |
| `app/utils/formatting.js` | Proposed formatting helper module | INVESTIGATE / ADD only if needed | Move only verified pure helpers and check existing utilities first. |
| `app/services/auth.service.js` | Proposed home for authentication-related business logic | INVESTIGATE / REFERENCE ONLY by default | Current code imports authentication helpers from `app/middleware/auth.middleware.js`; distinguish middleware from business logic and avoid duplicate or misleading abstractions. |
| Existing `app/routes/*.js` | Established API route registration pattern | REFERENCE ONLY | Follow the project's route-module convention where appropriate; do not move API routes as part of a page-route refactor without explicit scope. |
| Existing `app/utils/`, `app/services/`, and `app/middleware/` modules | Existing shared logic and middleware patterns | REFERENCE ONLY | Reuse existing helpers and conventions; avoid parallel implementations. |
| `test/` relevant files | Node.js built-in tests | MODIFY / ADD only as necessary | Cover extracted behavior and regression-sensitive route/startup contracts using established test patterns. |
| `README.md` | Architecture and operational documentation | MODIFY only if behavior or documented structure changes | Update only directly affected architecture/file-structure details after implementation. |
| `.env`, secrets, deployment configuration | Runtime configuration and secrets | REFERENCE ONLY | No configuration or secret changes are required for this refactor. |

Do not treat every proposed path as mandatory. Reclassify actions based on current repository evidence before implementation.

## 7. Current Implementation

### Verified architectural context

- The application is an Express server-rendered marketplace using EJS, MySQL, and both mysql2 and Sequelize data-access code.
- The production entry point is `app/src/server.js`; `package.json` scripts use `node app/src/server.js` and `nodemon app/src/server.js`.
- Route modules in `app/routes/*.js` generally export a function receiving the Express app and register routes on it.
- The server configures middleware, mounts API routes, serves `public/`, defines page routes inline, and creates the HTTP server and Socket.IO integration.
- Express session state is used by page handlers, and the session middleware is also shared with Socket.IO.
- Middleware, route-registration, database-sync, cron, and listener ordering can affect runtime behavior.
- `server.js` currently contains shared view helpers, including `buildLoginViewData`, `buildViewData`, `renderLogin`, and `renderPage`. Their existence does not establish that all page routes use them consistently.
- The review reports that the file contains many inline page routes, helper functions, business logic, middleware setup, database sync, and Socket.IO setup. Verify which of those responsibilities remain in the current branch.

### Current implementation details to verify

Before moving code, document the exact current route mappings and the exact behavior of each candidate helper. In particular, verify differences among guest and authenticated views, nonce inclusion, optional country/location fields, login redirects/renders, authentication checks, logging, error fallbacks, and route-specific values. Do not normalize these differences unless the change is explicitly intended and approved.

The coding agent must inspect the current implementation before proceeding. The review's code examples and line ranges may be stale.

## 8. Current → Target

### Current

`app/src/server.js` combines application initialization and multiple runtime responsibilities. Some reusable view helpers are already present, but routes and other concerns remain in the entry point. The exact current boundaries must be verified.

### Target

`app/src/server.js` remains the real executable entry point and coordinates initialization in the same order. Cohesive, verified responsibilities are registered/imported from focused modules. Route and helper extraction preserves observable behavior and avoids introducing unnecessary architecture.

An illustrative target shape is:

```text
app/src/server.js
   ├── load and validate configuration
   ├── create/configure Express and HTTP(S) server
   ├── register middleware in the existing order
   ├── initialize session-aware Socket.IO and integrations
   ├── mount existing API routes and extracted page routes
   ├── initialize existing database/cron behavior
   └── listen on the configured port

app/routes/pages/<verified-group>.routes.js
   └── register a cohesive group of existing page routes

app/utils/<verified-helper>.js
   └── export pure shared helpers where an existing equivalent is absent
```

This is a conceptual target, not a mandate to create every listed file. Match established module conventions and keep responsibilities that are tightly coupled to server creation or startup orchestration in the entry point.

## 9. Detailed Implementation Plan

### Step 1 — Establish a behavior baseline

Record the startup order and route inventory. Capture existing route paths, methods, redirects, view paths, response shapes/statuses, session-dependent fields, and error behavior. Identify important deployment/runtime assumptions, including the configured port, proxy setup, session middleware sharing, and Socket.IO signaling.

### Step 2 — Identify safe extraction boundaries

Classify candidate code as:

- Pure helper logic with no Express or startup side effects.
- Page route registration that can move as a cohesive group.
- Middleware setup whose order and dependencies must remain explicit.
- Server/bootstrap operations that should remain in `server.js`.
- Business logic with database or session side effects that may need a separate service boundary.

Prioritize small extractions whose input/output contracts can be tested independently. Do not combine the refactor with unrelated security fixes, API redesign, dependency changes, or a data-access migration.

### Step 3 — Reuse or extract helpers

Check for an existing helper before creating one. If a helper is extracted, preserve its arguments, return values, timezone behavior, formatting, nonce source, session UUID representation, logging, and error behavior. Keep pure functions pure where practical. Do not move session/database side effects into a utility module just to reduce line count.

### Step 4 — Extract page routes incrementally

Group routes by a verified functional boundary (for example, home/profile/legal only if that grouping reflects the existing application). Keep each route's current method, path, aliases, middleware, session checks, handler behavior, view path, and response contract. Register modules in an order that preserves current route precedence and avoids shadowing existing API or static-file behavior.

Use the existing `module.exports = (app) => { ... }` convention unless the current repository demonstrates a better established pattern. Do not add a router abstraction solely for this task.

### Step 5 — Extract middleware configuration only when safe

If middleware setup is moved, preserve exact order and mount paths. Specifically verify parser/session/nonce/Helmet/permissions-policy/custom headers/static serving/error-handler/API routes/page routes sequencing from the current source. Avoid circular imports and avoid hiding important ordering in side-effect-only modules.

### Step 6 — Keep startup and integrations stable

Do not inadvertently change when secrets are validated, when database sync starts or completes, when cron jobs register, when API route modules mount, when Socket.IO attaches to the HTTP server, when the session middleware is attached to Socket.IO, or when the server begins listening. Do not create a second listener or second cron registration. Preserve current HTTP/HTTPS behavior and exported interfaces if any.

### Step 7 — Add or update tests

Test extracted pure helpers directly with Node's built-in test runner. For route changes, add focused tests using existing test utilities; avoid making tests depend on production credentials or a live database unless the existing suite already defines that integration boundary. If the entry point's side effects prevent safe direct testing, report this limitation and use the smallest testability change that fits existing architecture—do not turn this refactor into a broad application-factory rewrite.

### Step 8 — Update documentation and verify the refactor

Update directly related README structure/architecture notes if module organization or documented startup ownership changed. Run targeted tests and the relevant syntax/format validation. Review the complete diff and compare the route/startup inventory against the final implementation before declaring completion.

## 10. Architecture and Existing Patterns

- Follow the existing CommonJS and route-module conventions used by the application.
- Keep `app/src/server.js` as the real entry point; do not move startup to a new executable unless explicitly approved.
- Use the current `app/utils/`, `app/services/`, `app/middleware/`, and `app/routes/` structures after checking for existing equivalents.
- Keep new database-facing work in the Sequelize stack as required by `AGENTS.md`; this task should not need new database logic or a legacy mysql2 migration.
- Respect the existing Express 5 middleware and error-handling conventions.
- Reuse existing session, nonce, authentication, logging, date, and rendering helpers where their semantics match.
- Do not introduce a new dependency, framework, application architecture, or design pattern when an appropriate project pattern already exists.

## 11. Security and Runtime-Safety Requirements

This finding is not itself a security vulnerability, but the refactor touches security-sensitive middleware and session-dependent routes. Preserve the existing controls and ordering:

- Do not remove, disable, bypass, or weaken secret validation, CORS restrictions, API rate limiting, session configuration, nonce generation, Helmet, Permissions-Policy, authentication middleware, or error handling.
- Do not expose session contents, secrets, or private user data through logs or rendered responses.
- Preserve the current distinction between public and authenticated pages and the current behavior of API route guards.
- Preserve the session middleware instance shared with Socket.IO.
- Do not move middleware after routes that rely on it or mount it on a broader/narrower path.
- Do not use this refactor to “fix” unrelated security findings; report any newly discovered issue separately and keep the behavior-preserving scope clear.

## 12. Backward Compatibility

The refactor must preserve:

- Every existing HTTP method, URL, alias, redirect, and route precedence.
- Existing page-to-view mappings and EJS data shape, including view-specific optional fields and nonce values.
- Existing session checks and login/guest behavior.
- Existing API paths, response formats, middleware, and authentication behavior.
- Existing static-file and trailing-slash/error behavior.
- Database sync and readiness/startup behavior.
- Cron registration frequency and schedule.
- Socket.IO endpoint, event behavior, HTTP(S) server attachment, and shared session state.
- Logging and error propagation behavior unless an explicitly approved change is required.
- Existing deployment assumptions, including the `app/src/server.js` start command and reverse proxy behavior.

Do not treat identical-looking route bodies as equivalent until their inputs, rendered view data, and side effects have been compared.

## 13. Testing Strategy

Use the existing test setup and keep validation proportionate to the changed modules.

### Normal cases

- Extracted helpers return the same values for representative existing inputs.
- Each moved route still matches the same method/path and renders the same view with equivalent data.
- Existing route aliases and route-specific parameters continue to work.

### Session and view-data cases

- Guest and logged-in sessions retain their respective existing behavior.
- Optional fields and nonce values remain present or absent exactly as required by each current view.
- Authentication/session status checks retain their current outcomes.

### Middleware and startup cases

- Middleware order and mount paths are unchanged.
- The database initialization, cron, API modules, static middleware, page routes, Socket.IO, and listener are each initialized exactly once and in the required order.
- Socket.IO continues to share the same session middleware as HTTP routes.

### Regression testing

- Run focused tests for modified modules, then `npm test` where feasible.
- Report integration-test skips separately; do not present skipped database-dependent tests as passing.
- If runtime verification is available, start the app only with a configured non-production environment and verify representative page/API behavior without mutating production data.
- Do not require `tailwindBuild` or `webpackBuild` unless frontend assets were changed; this task should not change them.

### Formatting and syntax

- Use the repository's existing formatting conventions.
- `npm run lint` runs Prettier with `--write .`; inspect the diff first and avoid formatting unrelated files. Prefer targeted formatting for changed files if available.
- Run a syntax check for changed JavaScript modules or the project's relevant test command.

## 14. Verification / Evidence

The implementation report must demonstrate that:

1. The final route inventory matches the baseline: no route, method, alias, view, or response contract was unintentionally lost or changed.
2. The final middleware/startup sequence preserves the baseline order and each critical initializer runs once.
3. Session-aware page rendering and Socket.IO session sharing remain intact.
4. Relevant tests and syntax/format checks were run, with failures and skips reported accurately.
5. The final diff contains only changes necessary for this refactor and any directly related tests/documentation.
6. The current `server.js` and extracted modules have a clear division of responsibilities; line-count reduction alone is not proof of success.
7. Any behavior that could not be exercised without production services is listed as a remaining risk rather than claimed as verified.

## 15. Do NOT Do

- Do not rewrite the application or replace Express/EJS.
- Do not move every function or route in a single unreviewable change.
- Do not change business rules, route contracts, page content, auth policy, or view-data semantics.
- Do not assume the review's line numbers, route count, or proposed file paths match the current branch.
- Do not duplicate helpers that already exist or move code merely to satisfy a target line count.
- Do not combine this task with the separate Finding 15 session-data redesign; coordinate overlapping work and preserve existing view-specific data differences.
- Do not change API routes or database access architecture as incidental cleanup.
- Do not alter session/security middleware order or disable any middleware.
- Do not change environment variables, secrets, production data, or deployment configuration.
- Do not add dependencies or broad test infrastructure.
- Do not suppress errors, replace explicit failures with success-shaped fallbacks, or silently change logging.
- Do not modify unrelated files or revert pre-existing work.

## 16. Acceptance Criteria

- [ ] Current source and all affected route/startup dependencies were inspected before edits.
- [ ] A baseline inventory of routes, middleware order, and startup side effects was made.
- [ ] Only verified responsibilities were extracted into focused modules.
- [ ] `app/src/server.js` remains the application entry point and coordinates startup.
- [ ] Existing route paths, methods, aliases, route precedence, view mappings, and response behavior are preserved.
- [ ] Session data, authentication checks, nonce behavior, and Socket.IO session integration are preserved.
- [ ] Middleware, database sync, cron, route mounting, and listener initialization retain their required order and occur once.
- [ ] Existing project module conventions are followed and duplicate helpers are avoided.
- [ ] Relevant tests pass; database/service-dependent skips and any unavailable checks are documented.
- [ ] Directly related documentation is updated if the documented structure changed.
- [ ] Final diff is reviewed and contains no unrelated changes.
- [ ] Remaining risks and unverified production-only behavior are reported.

## 17. Expected Final Report

Finish implementation with:

```markdown
# Implementation Report

## Summary

Briefly describe the incremental extraction and how production behavior was preserved.

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

Describe the module boundaries and any deviations from the recommendations in Finding 14.

## Testing

| Test / check | Result |
|---|---|
| Focused helper/route tests | PASS / FAIL / NOT RUN |
| `npm test` | PASS / FAIL / SKIPPED (explain) |
| Syntax / formatting | PASS / FAIL / NOT RUN |
| Runtime smoke check | PASS / FAIL / NOT RUN (explain) |

## Behavior-Preservation Verification

Summarize route, middleware-order, startup, session, and Socket.IO checks against the baseline.

## Remaining Risks

List production-only behavior or integrations that could not be verified.

## Final Status

PASS / NEEDS REVIEW
```

## 18. Important Rules for the Coding Agent

### Rule 1 — Verify the current branch

`CODE_REVIEW.md` and `README.md` can become stale. Treat them as context; confirm all findings and proposed files against the code currently checked out.

### Rule 2 — Separate facts from recommendations

Label observed current behavior separately from suggested module boundaries. Mark unknowns `TO INVESTIGATE`; do not turn assumptions into requirements.

### Rule 3 — Preserve the production baseline

Prefer small extractions that can be reviewed and rolled out independently. Preserve observable behavior unless the user explicitly approves a behavior change.

### Rule 4 — Track the whole initialization path

Follow configuration, middleware, routes, database, integrations, cron, and listening from process start through request handling. Do not validate only the moved function in isolation.

### Rule 5 — Keep scopes distinct

Finding 15 separately addresses duplicated session-data construction. This work may extract existing shared helpers as part of moving related routes, but must not silently impose one global view-data contract or duplicate Finding 15's proposed design.

## 19. Output Requirements

Implement only this behavior-preserving decomposition task. Keep the final changes small, testable, and consistent with the production system. Report the exact files changed, checks performed, verification evidence, and any remaining uncertainty.
