# 041 — Remove Unused or Overlapping Dependencies Safely

| Field                 | Value                                                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document ID           | `041`                                                                                                                                                 |
| Requested filename    | `docs/tasks/041-Unused-or-Overlapping-Dependencies.md`                                                                                                |
| Source finding        | `CODE_REVIEW.md` → Detailed Findings → **Finding 41: Unused or Overlapping Dependencies**                                                             |
| Priority              | Low — dependency hygiene, install footprint, and supply-chain clarity                                                                                 |
| Task type             | Incremental dependency cleanup and parser deduplication                                                                                               |
| Repository            | All World Trade v11 — production Express/EJS/MySQL SSR application                                                                                    |
| Expected change size  | Small and bounded: dependency manifests/lockfile, `app/src/server.js`, and directly affected documentation                                            |
| Production constraint | The application currently works in production. Treat current runtime behavior and deployment as the contract; verify each removal before changing it. |

> **Important:** This finding is about safe dependency cleanup, not a broad dependency upgrade or rewrite. Re-check the current branch before implementing: `CODE_REVIEW.md`, `AGENTS.md`, `README.md`, and package/test state may be stale or have changed since this task was written.

---

# 1. Task Title

**Remove Confirmed Unused Dependencies, Use Express 5 Body Parsers, and Correct Dependency Classification**

---

# 2. Objective

Reduce the production install footprint and make the application's actual runtime dependencies clear without changing its behavior.

The implementation should:

1. Remove packages identified by Finding 41 only after confirming there are no runtime, build, script, or dynamic-loading consumers.
2. Replace `body-parser` middleware with Express 5's built-in parsers while preserving supported request bodies and middleware order.
3. Move development-only command-line tools such as `nodemon` and `npm-check-updates` to `devDependencies`, if they remain development-only after investigation.
4. Make `npm test` invoke the existing test suite if the current test files and their conventions support it; do not add a new test framework for this task.
5. Update `package.json`, `package-lock.json`, and documentation that would otherwise continue to describe removed dependencies or obsolete test behavior.
6. Prove that dependency installation, targeted tests, and a representative application startup/request path still work.

## Expected end state

- Production dependencies contain only packages needed by the running application.
- Development-only tools are not required by production installs.
- Request body parsing continues to support JSON and URL-encoded forms as before.
- The lockfile agrees with the manifest and contains no orphaned direct packages after installation.
- The test command runs tests rather than unconditionally exiting with the old placeholder error.
- No product feature, API contract, authentication flow, session behavior, or deployment command is unintentionally changed.

---

# 3. Problem / Finding

## Finding as described in `CODE_REVIEW.md`

The review identifies these issues:

- `cookie-session` is required in `app/src/server.js`, but the application uses `express-session`.
- `passport` and `passport-local` are listed but are not used by the runtime authentication flow.
- `method-override` is mentioned in the server banner but is not wired as middleware.
- `body-parser` duplicates functionality available from the Express 5 application.
- `nodemon` and `npm-check-updates` are development tools listed under production `dependencies`.
- The `test` script is a placeholder that exits with failure instead of running tests.

## Current-state observations to verify before implementation

At the time this guide was prepared, the checked-in files showed:

- `package.json` and `package-lock.json` list the packages above; `nodemon` and `npm-check-updates` are under `dependencies`.
- `app/src/server.js` imports `body-parser` and `cookie-session`. It uses `body-parser.urlencoded({ extended: true })` and `body-parser.json()` before the session middleware, then also installs `express.json()` and `express.urlencoded({ extended: true })` later.
- A source search found no active application import of `passport`, `passport-local`, or `method-override`; the server banner lists them as dependencies. The README currently describes Passport as the authentication strategy, which must be checked against the actual login/session code and corrected if inaccurate.
- `package.json` has a placeholder `test` script. A `test/` directory with Node.js built-in `node:test` tests exists, despite older documentation claiming there is no test suite.

These are **observations, not permission to delete blindly**. Re-run searches on the branch being changed, inspect all package scripts and deployment/build workflows, and confirm the actual authentication and parsing behavior.

## Why this matters

Unused runtime packages increase the install and maintenance surface, add avoidable dependency audit noise, and mislead maintainers about the architecture. Redundant body parsers create duplicate work and obscure which middleware handles request bodies. Incorrect dependency classification can also make development commands unavailable after a production-only install.

This finding does **not** establish that every package absent from a simple `require()` search is unused. Static assets, CLI scripts, build tools, dynamic imports, configuration, or external deployment scripts may depend on a package.

---

# 4. Affected Functionality

This is an application bootstrap and package-management task. The affected runtime path is:

```text
Incoming HTTP request
   ↓
Express middleware in app/src/server.js
   ↓
JSON / URL-encoded body parsing
   ↓
express-session and other middleware
   ↓
API routes, page routes, and controllers
```

The current authentication implementation is session-based (`express-session`), not Passport-based according to the project instructions and server code. Verify this before removing Passport packages or editing the README.

The deployment uses `npm install --production` in the documented production procedure. Keep all packages required by `npm start` in `dependencies`; development-only packages must not be imported by production runtime code.

---

# 5. Investigation Phase

Do not edit manifests or `server.js` until this investigation is complete.

## 5.1 Read the project references

Read:

- `README.md` — especially System Architecture, Authentication & Security, Deployment Architecture, Installation & Setup, Technology Stack, and Testing Strategy.
- `AGENTS.md` — commands, boot sequence, session/auth behavior, and dependency notes. Treat its test-status and dependency statements as claims to verify, not guaranteed current facts.
- `CODE_REVIEW.md` — Finding 41, General Recommendation 8 (Dependency Management), and the project's production-stability guidance.

## 5.2 Inventory dependency references

For each candidate package, search all tracked source, scripts, and configuration, not only `app/src/server.js`:

- `cookie-session`
- `passport`
- `passport-local`
- `method-override`
- `body-parser`
- `nodemon`
- `npm-check-updates`

Search for:

- `require()` and `import` calls, including computed/dynamic loading patterns.
- Package names in `package.json` scripts, shell scripts, CI configuration, deployment files, Docker files, and documentation.
- Passport initialization, strategies, serialize/deserialize handlers, and middleware.
- Method-override configuration and `req.method` override usage.
- Body-parser options, parser limits, custom content types, and error-handling order.
- Development commands or automation that invokes the local `nodemon` or `npm-check-updates` executables.

Search all repository-owned files while excluding `node_modules` and generated bundles. A package-lock entry or a comment alone is not proof of a runtime consumer.

## 5.3 Trace the actual runtime behavior

Inspect `app/src/server.js` from the start of middleware setup through route mounting and listen/startup code. Record:

- The order of CORS, compression, body parsing, session setup, static serving, error handling, and route registration.
- Whether both early and later parser middleware are currently active.
- The effective parser settings for JSON and `application/x-www-form-urlencoded`.
- Whether malformed request bodies reach the same error handler and return the same observable status/body.
- Whether any routes depend on parsed bodies before session middleware or static handling.

Do not infer behavior from README diagrams if the implementation differs.

## 5.4 Verify package-management and test conventions

Inspect:

- `package.json` scripts and both dependency sections.
- `package-lock.json` lockfile version and root package entries.
- Existing files under `test/` and their documented invocation. Determine whether tests use Node's built-in `node:test`, require a database, or intentionally skip integration tests when the database is unavailable.
- Any CI/workflow commands or deployment scripts that use `npm install --production`, `npm ci`, `npm test`, or direct tool commands.

Do not add Jest, Mocha, Supertest, or another framework for this dependency cleanup. Reuse the existing test runner if the repository supports it.

## 5.5 Distinguish scoped work from adjacent opportunities

`swagger-ui-express` and `yamljs` are present in the manifest and are mentioned in project documentation alongside `app/api/swagger.yaml`. They are not explicitly listed in Finding 41's recommended removals. Investigate their actual consumers, but do not remove or alter API specification/documentation support as opportunistic cleanup. Expand scope only if the current task's direct evidence establishes they are unused and the change is necessary; otherwise report them separately.

Do not perform a general dependency upgrade, audit remediation, version pinning campaign, or unrelated package purge.

---

# 6. File Impact Analysis

| File                                                  | Role                                                                             | Action                                              | Reason                                                                                                                                            |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                                        | Direct dependency manifest and npm scripts                                       | `MODIFY`                                            | Remove only confirmed unused packages; classify development tools correctly; replace the placeholder test command if supported by existing tests. |
| `package-lock.json`                                   | Reproducible npm dependency graph                                                | `MODIFY`                                            | Regenerate using npm after manifest changes; do not hand-edit lock data.                                                                          |
| `app/src/server.js`                                   | Express bootstrap and middleware stack                                           | `MODIFY`                                            | Remove confirmed unused imports and use Express's built-in body parsers with equivalent configuration and ordering.                               |
| `README.md`                                           | Human-facing architecture, setup, deployment, technology, and test documentation | `MODIFY` if affected                                | Remove inaccurate Passport/body-parser claims and update test/dependency descriptions only where implementation changes make them inaccurate.     |
| `AGENTS.md`                                           | Repository-specific coding-agent instructions                                    | `MODIFY` if affected                                | Keep boot sequence, dependency classification, and testing instructions accurate after the cleanup.                                               |
| `test/041-unused-or-overlapping-dependencies.test.js` | Dependency classification and parser regression checks                           | `ADD`                                               | Verify removed direct dependencies, development-tool placement, parser registration order, JSON/forms parsing, and malformed JSON handling.       |
| Other existing files under `test/`                    | Node.js built-in test suite                                                      | `REFERENCE ONLY` unless a test exposes a regression | Reuse existing tests; do not add a new test framework.                                                                                            |
| `app/api/swagger.yaml` and API docs                   | MiroTalk API specification                                                       | `REFERENCE ONLY`                                    | Preserve the spec. Do not remove it as part of this finding.                                                                                      |
| Other application source/configuration                | Runtime/build consumers                                                          | `INVESTIGATE`                                       | Modify only if a verified package reference or script requires a coordinated change.                                                              |

`DELETE` should not be necessary for source files in the expected scope. Remove a package from the manifest only after verifying its use; npm should update the lockfile accordingly.

---

# 7. Current Implementation

## Confirmed patterns at the time this guide was prepared

The project is a monolithic Express 5 SSR application with EJS, MySQL, and both legacy mysql2 and Sequelize data access. `app/src/server.js` is the application entry point. Project docs say production runs with `npm start` and may install only production dependencies.

The server currently has a direct `body-parser` import and installs both `body-parser` and Express body parsers. The package manifest also lists `cookie-session`, although session handling is implemented with `express-session`. The server banner includes links to some packages without configuring them.

The current `test` script is a placeholder, while Node built-in test files exist under `test/`. Confirm whether all such tests run successfully before changing the script.

## Required verification

Line numbers and exact content can change. The coding agent must inspect the current implementations and manifests before modifying anything. In particular, do not assume:

- A package is unused because `rg` found no literal import.
- A documentation mention is an active runtime dependency.
- Removing one parser is behavior-neutral if parser options or middleware order differ.
- The test suite has no tests because an older `AGENTS.md` or README says so.

---

# 8. Current → Target

## Current

The manifest includes packages with no verified runtime consumer, development command-line tools are classified as production dependencies, body parsing is performed more than once, and `npm test` may still be a no-tests placeholder.

## Target

After confirming there are no consumers:

- Remove only genuinely unused runtime dependencies.
- Keep `express-session` as the session implementation; do not replace it with `cookie-session` or Passport.
- Use one appropriately placed pair of Express 5 parsers:

```js
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
```

- Keep parsing before routes that consume `req.body`, preserve the existing URL-encoded `extended: true` behavior, and preserve current malformed-body handling.
- Keep development-only tools available to contributors while excluding them from production-only installation.
- Point the test script at the existing Node test runner if the repository's tests are compatible with a complete `node --test` run.

This is the intended direction, not a demand to copy this exact snippet into the server. Inspect current middleware order, parser configuration, and error handling, then adapt without changing route behavior.

---

# 9. Detailed Implementation Plan

## Step 1 — Record the baseline

1. Check the working tree and avoid overwriting unrelated edits.
2. Read the current manifest, lockfile root metadata, server middleware setup, and relevant docs.
3. Run focused searches for each candidate package and inspect every match.
4. Record the current dependency tree and test command behavior.

## Step 2 — Confirm package roles

Classify each package based on actual usage:

| Package             | Finding's claim                                            | Required decision                                                                                          |
| ------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `cookie-session`    | Imported but not used; `express-session` is active         | Remove the import and dependency only if no other consumer exists.                                         |
| `passport`          | Listed but no authentication integration found             | Remove only after checking strategies, middleware, config, and scripts.                                    |
| `passport-local`    | Listed but no local strategy found                         | Remove only if `passport`/local-strategy usage is absent throughout the repo.                              |
| `method-override`   | Mentioned in a server banner but not wired                 | Remove only after checking middleware setup and any method-override request convention.                    |
| `body-parser`       | Redundant with Express 5 built-in parsers                  | Replace its usage with equivalent Express middleware, then remove the package if no other consumer exists. |
| `nodemon`           | Development server runner listed as production dependency  | Move to `devDependencies` if production startup does not use it. Keep `npm run dev` working.               |
| `npm-check-updates` | Dependency maintenance CLI listed as production dependency | Move to `devDependencies` if it is used only for development/maintenance.                                  |

If evidence shows any package is still required, retain it and document the consumer. Never remove a dependency solely to make `npm ls` output smaller.

## Step 3 — Replace body-parser carefully

1. Preserve JSON and URL-encoded parsing, including `extended: true`.
2. Ensure parsing still occurs before every route/controller that reads `req.body`.
3. Consolidate duplicate parsers only after checking ordering and error propagation.
4. Preserve any explicitly configured parser limits, type predicates, or verification hooks if found. Do not introduce new limits or change error response semantics as part of this task.
5. Remove `body-parser` from the manifest only after no active import remains.
6. Confirm malformed JSON and normal form submissions retain the established behavior.

## Step 4 — Update dependency sections with npm

Use npm operations rather than hand-editing lockfile internals:

1. Remove the verified unused packages.
2. Move retained development tools into `devDependencies`.
3. Keep runtime dependencies required by `npm start` under `dependencies`.
4. Ensure the lockfile root dependency lists match `package.json`.
5. Do not change package versions except as required to move or remove dependencies.

If npm reports peer/dependency issues, inspect and resolve only those caused by this change; do not perform broad upgrades.

## Step 5 — Make the test command useful

If the current `test/` files consistently use Node's built-in test runner and the repository supports the installed Node version:

1. Change the placeholder `test` script to invoke `node --test`.
2. Run the suite and distinguish existing unrelated failures from failures introduced by this task.
3. Do not silently remove, skip, or rewrite failing tests to make the command pass.

If a full suite cannot safely run as one command, keep the change bounded and use the explicit existing `node --test test/<file>.test.js` pattern. Document the reason rather than adding a new test framework.

## Step 6 — Correct directly affected documentation

Update only claims made inaccurate by the implementation:

- In `README.md`, remove Passport.js as the active authentication mechanism if confirmed unused; describe the actual session-based flow.
- Update dependency/technology or testing descriptions that no longer match.
- In `AGENTS.md`, revise stale claims about imports, duplicate parsers, and the absence of tests if the corresponding state changed.
- Preserve deployment commands and explain that production-only installs omit development tools.

Do not rewrite the README architecture or use this task to update unrelated stale documentation.

## Step 7 — Validate and review

1. Run the test suite or targeted existing Node tests.
2. Run an install/lockfile consistency check without changing unrelated dependency versions.
3. Run the server or a focused HTTP smoke test when required environment/database services are available.
4. Verify JSON and URL-encoded requests reach a representative handler with parsed bodies.
5. Review the complete diff and package-lock changes. Confirm no unrelated source, generated asset, secret, or environment file was modified.

---

# 10. Architecture and Existing Patterns

- The real application entry is `app/src/server.js`; do not modify the nonexistent root `server.js`.
- The app uses Express 5, EJS, `express-session`, Sequelize and legacy mysql2. Preserve these architectural choices.
- `express.json()` and `express.urlencoded()` are the Express-native request parsers. Keep options explicit where the current app depends on them.
- Use npm to maintain the manifest and lockfile together.
- Reuse the existing Node.js built-in test convention found under `test/`; do not introduce a framework or test dependency.
- Production `npm start` must not depend on development-only executables.

Do not introduce a new dependency, framework, authentication system, or architecture when the current project already provides the appropriate mechanism.

---

# 11. Security and Supply-Chain Requirements

- Remove a package only after checking direct imports, dynamic loading, scripts, build tooling, and deployment consumers.
- Do not print, copy, or commit `.env` values or other credentials while investigating.
- Do not replace `express-session` with `cookie-session`; these are not interchangeable configuration-only changes.
- Do not remove or weaken session, CSRF, CORS, authentication, or request validation behavior.
- Avoid a dependency upgrade as a side effect. Keep versions unchanged for packages that remain.
- Confirm a production-only install has all runtime packages and does not require `nodemon` or `npm-check-updates`.
- Do not claim a smaller dependency tree is a security fix by itself; report what was removed and why.

---

# 12. Backward Compatibility

Preserve:

- JSON and URL-encoded API request parsing.
- `extended: true` URL-encoded parsing behavior.
- Existing `req.body` shape and availability for route handlers.
- Current parser error responses and middleware ordering where observable.
- The active `express-session` configuration, session cookies, login flow, and logout flow.
- Existing development commands, particularly `npm run dev`.
- Production startup through `npm start` and documented production-only installation.
- Existing tests and their integration/database skip behavior.

Do not change endpoint paths, payloads, response status codes, authentication behavior, database access, or front-end code.

---

# 13. Testing Strategy

## Dependency and lockfile checks

- Confirm each removed package has no remaining direct source, script, build, or deployment consumer.
- Run `npm ls --depth=0` and inspect any invalid or missing direct dependency output.
- Verify `package-lock.json` root dependency entries match `package.json`.
- Run `npm ci` in an appropriate clean environment or CI job to prove the lockfile is reproducible. Do not use a production database or alter production state.
- Where practical, verify `npm install --omit=dev` can support `npm start` without development tools.

## Request parsing regression checks

Use a test or focused local smoke request to verify:

| Case                                  | Expected result                                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Valid JSON request                    | Route receives the same parsed object in `req.body`.                                                          |
| Valid URL-encoded form request        | Route receives the same fields as before, including nested fields if currently supported by `extended: true`. |
| Empty body / unsupported content type | Behavior matches the established implementation.                                                              |
| Malformed JSON                        | Same existing error handling/status behavior; no uncaught exception or server crash.                          |

Do not test only that the server starts; verify the parsers are still active before the relevant route handlers.

## Test runner checks

- Run `npm test` after wiring it to the existing test runner.
- Run representative tests individually if the suite includes database-dependent integration cases.
- Report pre-existing failures as such; do not hide them or claim a full pass when only a subset ran.

## Runtime smoke check

When the required environment and database are available:

- Start through the documented `npm start` command.
- Confirm startup and at least one harmless page/API request.
- Confirm `npm run dev` still invokes nodemon in a development install.

Do not create or modify production data for these checks.

---

# 14. Verification / Evidence

The implementation report must provide evidence for each changed category:

1. **Package removal:** name each removed package and cite the searches/configuration checks that confirmed no consumer.
2. **Development classification:** show `nodemon` and `npm-check-updates` are in `devDependencies` if retained, and verify production startup does not need them.
3. **Parser behavior:** identify the final parser middleware and settings; report JSON, URL-encoded, and malformed-body validation results.
4. **Lockfile:** show `npm ci` or the repository's equivalent lockfile consistency validation succeeded.
5. **Tests:** state the exact command and whether the full suite or only targeted tests ran.
6. **Diff:** confirm only relevant files changed and no API/session behavior was altered.

Do not report “fixed” based only on deleting dependencies from `package.json`.

---

# 15. Do NOT Do

- Do not remove a package until all source, scripts, build, CI, and deployment consumers have been checked.
- Do not delete `swagger-ui-express`, `yamljs`, or the Swagger API specification as opportunistic cleanup; they are outside the explicit removal list unless separate evidence justifies expanding scope.
- Do not remove `express-session` or change session storage/authentication.
- Do not replace body parsing with a parser configuration that changes field decoding, accepted content types, or malformed-body handling.
- Do not leave duplicate parsers active without a documented reason.
- Do not move runtime libraries into `devDependencies`.
- Do not upgrade unrelated packages or regenerate unrelated lockfile versions.
- Do not add a test framework or an unnecessary dependency.
- Do not modify `.env`, secrets, or production data.
- Do not rewrite `app/src/server.js` or unrelated documentation.
- Do not suppress npm, install, test, or runtime errors.
- Do not declare the test suite healthy if only selected tests passed.

---

# 16. Acceptance Criteria

- [ ] The current package consumers were investigated before removal.
- [ ] `cookie-session`, `passport`, `passport-local`, and `method-override` are removed only if no active consumer exists; any retained package has its consumer documented.
- [ ] `body-parser` usage is replaced with equivalent Express 5 parser behavior, or retained with a documented reason.
- [ ] JSON and URL-encoded body parsing remain available before consuming routes, with `extended: true` preserved.
- [ ] Duplicate parser middleware is removed only after confirming error handling and route behavior are preserved.
- [ ] `nodemon` and `npm-check-updates` are classified as development dependencies if they are development-only.
- [ ] `npm test` runs the existing Node test suite if the current test conventions support it; no new framework was added.
- [ ] `package.json` and `package-lock.json` are consistent and reproducible.
- [ ] `npm run dev` and production `npm start` remain usable in their respective install environments.
- [ ] Directly affected README/AGENTS statements are accurate.
- [ ] No unrelated dependency versions, application behavior, API contracts, sessions, or data were changed.
- [ ] Tests, installation checks, smoke checks, and limitations are reported accurately.
- [ ] The final diff was reviewed for unrelated changes.

---

# 17. Expected Final Report

Finish with:

```markdown
# Implementation Report

## Summary

Briefly describe the verified dependency cleanup and parser/test-command changes.

## Files Modified

| File                | Changes |
| ------------------- | ------- |
| `package.json`      | ...     |
| `package-lock.json` | ...     |
| `app/src/server.js` | ...     |

## Files Added

| File | Purpose                                           |
| ---- | ------------------------------------------------- |
| None | No new files unless a focused test was necessary. |

## Files Deleted

| File | Reason                            |
| ---- | --------------------------------- |
| None | No source-file deletion expected. |

## Files Referenced Only

| File  | Why |
| ----- | --- |
| `...` | ... |

## Implementation Details

List packages removed/retained, dependency classification, parser changes, and any documentation updates.

## Testing

| Check               | Command / Result      |
| ------------------- | --------------------- |
| Existing tests      | ...                   |
| JSON parsing        | PASS / FAIL / NOT RUN |
| URL-encoded parsing | PASS / FAIL / NOT RUN |
| Malformed body      | PASS / FAIL / NOT RUN |
| Lockfile/install    | PASS / FAIL / NOT RUN |
| Runtime smoke check | PASS / FAIL / NOT RUN |

## Verification

Explain how each package's consumer status was checked and how production startup was preserved.

## Remaining Risks

List unavailable environment checks, uncertain external scripts, or pre-existing test failures.

## Final Status

PASS / NEEDS REVIEW
```

---

# 18. Important Rules for the Coding Agent

1. **Verify current state.** The review and repository instructions can become stale; inspect the current source and package graph.
2. **Separate evidence from recommendations.** A matching package name in a comment or documentation is not equivalent to an active runtime import.
3. **Preserve production behavior.** This marketplace is running in production; make the smallest reversible change.
4. **Use npm for manifest/lockfile changes.** Do not hand-edit transitive lockfile records.
5. **Use the existing test runner.** The repository now contains `node:test` tests even if older docs say there are none.
6. **Report uncertainty.** If an external deployment or maintenance script could use a package and cannot be inspected, retain the package and identify the question for maintainers.
