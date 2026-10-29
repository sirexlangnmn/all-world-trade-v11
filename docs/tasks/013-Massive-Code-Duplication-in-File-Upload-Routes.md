# AI Implementation Task: Reduce Duplication in Business Media Upload Routes

## 1. Task Title

# Refactor Duplicated Business Media Upload Routes and Queries

## 2. Objective

Reduce the repeated route-handler and SQL-variant code used to upload business media, while preserving the production behavior of registration, profile edits, upgrades, and existing clients.

The target is shared, configuration-driven upload handling and a small set of safe persistence operations instead of a separate implementation for every combination of logo, banner, video thumbnail, brochure, and webinar media. Do not equate fewer route definitions with a safe refactor: all existing public endpoint paths, accepted multipart field combinations, validation rules, data mappings, update semantics, success responses, media filenames, and URLs must continue to work unless an intentional contract change is separately approved.

## 3. Problem / Finding

**Finding:** Finding 13 — Massive Code Duplication in File Upload Routes  
**Source:** `CODE_REVIEW.md`, Detailed Findings  
**Related finding:** Finding 17 — SQL Query String Explosion in Media Queries

The review describes many near-identical handlers in `app/routes/upload-file.js` and many hard-coded INSERT variants in `app/query/users_business_medias.query.js`. Each route generally handles a particular combination of media fields, maps request fields to media-table columns, runs a corresponding query, and sends a response. Similar combinations are repeated for registration and upgrade/profile operations.

This duplication makes routine changes error-prone: field mappings, upload policies, persistence behavior, and error handling can drift between endpoints. The query variants also grow combinatorially as fields are added.

**Current-code status must be rechecked:** The upload route now uses shared upload middleware and a shared persistence helper. `app/middleware/business-media-upload.middleware.js` applies field-aware content checks, finite limits, generated filenames, temporary staging, and image re-encoding. `app/utils/business-media-persistence.js` handles persistence failures and request-scoped cleanup. These protections are related and must remain intact; they are not part of the duplication to remove.

The review's proposed “single dynamic route” and “two queries” are conceptual targets, not permission to remove existing URLs or collapse semantically different INSERT/UPDATE operations without tracing their callers and behavior. Dynamic SQL must never use request-controlled column names.

## 4. Affected Functionality

The affected workflows include business media upload during registration, standalone logo/banner/video/brochure operations, profile edits, and upgrades. Current implementation uses the legacy mysql2 route stack, shared upload middleware, and a collection of media query constants.

The general flow is:

```text
Browser multipart request
   ↓
Existing upload URL and route-specific upload-field policy
   ↓
app/middleware/business-media-upload.middleware.js
   ↓
Route maps request fields and generated filenames to media columns
   ↓
app/utils/business-media-persistence.js
   ↓
mysql2 query and users_business_medias persistence
   ↓
Existing response consumed by the browser
```

Inspect the implementation before relying on this summary. Some route handlers may have distinct read-before-write behavior or data mappings.

## 5. Investigation Phase

Complete this investigation before changing implementation:

1. Read `README.md`, `AGENTS.md`, and `CODE_REVIEW.md`, especially Findings 12, 13, 17, 34, 52, and 53 and the incremental-refactoring guidance. If the documents conflict, verify the current source and preserve the behavior currently relied upon in production.
2. Read all of `app/routes/upload-file.js`. Inventory each registered endpoint, HTTP method, middleware field list, accepted/missing-file behavior, database operation, response, and caller. Do not use a count from the review as a substitute for examining the current file.
3. Read `app/query/users_business_medias.query.js`. Inventory every CREATE and UPDATE constant and identify which route uses it, which columns it writes, the value order, and whether it writes metadata as well as file references.
4. Inspect `app/middleware/business-media-upload.middleware.js` and preserve its field allowlist, per-field type and size policies, file-count/request limits, content checks, staging/publishing sequence, generated filenames, and failure cleanup. Confirm which field names it accepts and how route-specific `.fields(...)` definitions enforce allowed combinations.
5. Inspect `app/utils/business-media-persistence.js` and its tests. The route refactor must retain its logging, sanitized failure response, request-owned file cleanup, path containment, and exactly-once response behavior on persistence errors.
6. Search all repository callers of upload URLs and multipart fields, especially `public/assets/js/`, EJS forms, registration/upgrade flows, and client-side success/error handling. Keep existing URLs working as aliases if clients still call them; do not change callers merely to make the server code look simpler.
7. Inspect existing Sequelize models and patterns, including `app/db_models/users_business_medias.model.js` and relevant `app/db_controllers/` code. `AGENTS.md` directs new database work toward Sequelize and treats mysql2 as frozen. Establish whether the existing route behavior can move to an existing Sequelize model safely. Do not introduce new raw-SQL architecture or mix two persistence stacks casually; if a narrow legacy-compatible query helper is necessary to complete the refactor, document why it is the least risky choice and keep it parameterized.
8. Inspect the tests under `test/`, especially upload-validation and persistence-failure tests. `test/052-business-media-db-failure.test.js` includes a source-level assertion on the current query-helper call count; replace architecture-count assertions with meaningful coverage assertions if the refactor changes that count.
9. Inspect version history/current worktree state as needed to identify already-landed protections or local changes. Preserve unrelated work and do not modify production uploads or data.
10. Resolve any ambiguity about required fields, null/default values, field precedence, update-versus-insert behavior, response contracts, or route retirement as `TO INVESTIGATE`. Do not guess.

Before editing, produce a route-to-operation mapping for your own implementation work. Include old route paths and their client callers, not just the shared implementation you intend to create.

## 6. File Impact Analysis

| File | Role | Action | Reason |
|---|---|---|---|
| `app/routes/upload-file.js` | Upload endpoint registration, field combinations, request-to-column mapping, persistence calls | MODIFY | Replace repeated handler bodies with shared/config-driven handling while preserving endpoint behavior and policy. |
| `app/query/users_business_medias.query.js` | Existing parameterized media INSERT/UPDATE query variants | MODIFY only if the chosen migration requires it | Retire redundant variants only after all route references are replaced and equivalent persistence behavior is tested. |
| `app/db_models/users_business_medias.model.js` | Sequelize representation of media columns | REFERENCE ONLY / INVESTIGATE | Determine whether existing Sequelize persistence can safely replace the legacy media query usage; do not assume model defaults exactly match SQL behavior. |
| `app/db_controllers/` relevant media/profile controllers | Existing Sequelize persistence patterns | REFERENCE ONLY | Follow established project conventions if the upload persistence is moved to Sequelize. |
| `app/middleware/business-media-upload.middleware.js` | Content validation, limits, staging, publishing, and upload errors | REFERENCE ONLY by default | Preserve the current upload security and storage contract. Modify only for a verified requirement directly coupled to shared route registration. |
| `app/utils/business-media-persistence.js` | Request-scoped media persistence error handling and cleanup | REFERENCE ONLY by default | Preserve the behavior established for Finding 52. Change only when the refactored call shape requires a compatible, tested adjustment. |
| `public/assets/js/` and `public/view/` | Upload clients, field names, endpoint consumers | REFERENCE ONLY / INVESTIGATE | Confirm endpoint and response compatibility. Modify only for an explicitly planned migration with backwards compatibility. |
| `test/` | Node.js automated tests | MODIFY / ADD | Cover route mapping, field combinations, SQL/model mapping, response compatibility, and existing validation/cleanup guarantees. |
| `README.md` | Project architecture and upload documentation | MODIFY only if needed | Update directly related documentation if the supported route/API contract or implementation changes. |

Use the action labels `MODIFY`, `ADD`, `DELETE`, `REFERENCE ONLY`, and `INVESTIGATE` precisely. Do not delete an endpoint or query constant until repository-wide references and test coverage show it is safe.

## 7. Current Implementation

### Verified current facts

- `app/routes/upload-file.js` registers many `app.post(...)` endpoints for registration, standalone uploads, updates, and upgrade workflows.
- The route module creates one shared uploader through `createBusinessMediaUpload(...)`, but defines multiple route-specific `.fields(...)` middleware configurations and repeated route handlers.
- The route module delegates database persistence to `executeBusinessMediaQuery(...)` through a local `runBusinessMediaQuery` wrapper. One no-upload registration endpoint uses a direct `db.query(...)`.
- `app/query/users_business_medias.query.js` still exports multiple hard-coded CREATE combinations and several UPDATE variants.
- `app/db_models/users_business_medias.model.js` defines a Sequelize model with the media columns, but the inspected upload route uses the legacy mysql2 query constants.
- `test/052-business-media-db-failure.test.js` verifies persistence cleanup and currently contains a source-level check for one direct query and a fixed count of wrapped calls. A route refactor will need to update that brittle structural expectation while retaining behavioral coverage.
- `app/middleware/business-media-upload.middleware.js` has field policies for JPEG/PNG images, PDF brochures, and MP4 video, performs structural checks for PDF/MP4 and image decode/re-encoding, uses generated filenames, and stages files before publication. Finding 53 documents unresolved stronger PDF/MP4 assurance; this refactor must not imply that current checks are full parsing or sanitization.

### Important facts to verify during implementation

- Exact active endpoint list, field combinations, field-to-column mappings, and endpoint response contracts.
- Whether a route uses CREATE, UPDATE, a SELECT followed by a write, or any other sequencing.
- Which columns must be omitted rather than written as `NULL`/empty string for each workflow.
- Which update routes are allowed to replace a subset of columns and which preserve all other media metadata.
- Whether `videoInput` and other media fields represent actual files, metadata, or both in each workflow.
- Whether any old route is unused, and whether a deprecated URL can be retained as a thin alias.

Do not treat examples in `CODE_REVIEW.md`, README diagrams, or a proposed dynamic query as proof of the current route contract.

## 8. Current → Target

### Current

```text
Many endpoint-specific handlers and field-list configurations
   ↓
Repeated request mapping and success/error callback code
   ↓
Many static CREATE/UPDATE query variants
```

### Target

```text
Existing route URLs (retained as aliases where required)
   ↓
Small route configuration describing allowed fields and operation semantics
   ↓
Shared field validation/mapping and one common handler path
   ↓
Small, safe persistence surface using existing Sequelize patterns where feasible
   ↓
Existing response and upload/persistence failure guarantees
```

The implementation may register multiple existing URL aliases against a shared handler factory. “One shared route implementation” does not require replacing all URLs with one new path. If a new canonical route is introduced, preserve old URLs until every caller is migrated and compatibility is demonstrated.

For dynamic persistence, column names must come only from a fixed, reviewed mapping of supported multipart fields to model attributes/database columns. Bind all values as parameters or pass them through Sequelize's structured `create`/`update` APIs. Never construct identifiers from request body keys, filenames, or arbitrary `req.files` keys. For UPDATE behavior, modify only the allowlisted fields intended by that endpoint; do not clear fields that the old query left untouched.

## 9. Detailed Implementation Plan

### Step 1 — Build an endpoint behavior matrix

For every current upload route, record:

| Route | Caller(s) | Allowed file fields | Required/optional fields | Operation | Columns updated | Success response |
|---|---|---|---|---|---|---|
| Existing endpoint | Confirm in client/forms | Exact field names | Verify from current code | CREATE / UPDATE / other | Verify query mapping | Record exact status/body/text |

Include routes with no uploaded file only when they are part of the same media workflow; do not force them through a file-required middleware.

### Step 2 — Define shared route configuration

Replace repeated handler logic with a small configuration-driven registration/helper pattern. Configuration may describe:

- The existing route path or alias.
- The allowed multer field definitions and per-field maximum counts.
- Required versus optional media fields.
- The mapping from multipart fields and metadata to fixed database/model attributes.
- Whether this endpoint creates a media row or updates an existing row.
- Any verified response-specific behavior that must remain.

Do not allow a request to upload fields that the original route did not allow. Reuse the existing `createBusinessMediaUpload(...).fields(...)` middleware and its policy rather than creating a parallel Multer instance. Avoid a giant generic framework or opaque one-letter configuration; the route table must remain auditable.

### Step 3 — Extract common request mapping

Create a focused mapper that transforms the endpoint's verified request contract into a persistence DTO. Keep multipart field names, metadata names, filename values, date handling, omission/default behavior, and value semantics compatible with the current endpoint.

Use explicit mapping from known field names to known model attributes. Reject or ignore unknown keys according to the existing route contract; do not pass arbitrary request data directly into Sequelize or SQL.

### Step 4 — Consolidate persistence safely

Follow the current repository's Sequelize preference for new database logic. First verify model attribute names, null/default behavior, and update semantics against the active model definitions and existing queries.

- Use the fewest persistence operations that preserve all distinct create/update semantics.
- For a dynamic INSERT, include only the verified attributes intended for that endpoint and preserve required UUID/timestamp values.
- For UPDATE, update only the fields that the corresponding legacy query changed.
- If raw mysql2 SQL remains necessary for a narrow compatibility reason, use static allowlisted identifiers plus `?` placeholders for every value. Keep the helper small and explain why it is not a new general SQL abstraction.
- Do not delete old query constants until `rg` confirms there are no remaining runtime references and the replacement has been tested for every old combination.

### Step 5 — Preserve route and response compatibility

Register all existing URLs as aliases to the shared implementation where clients still depend on them. Keep HTTP methods, multipart fields, auth/public status, validation behavior, and success response body/status exactly as before unless an approved contract change is explicitly documented.

Do not perform a bulk client migration as a shortcut. If aliases are to be retired later, handle that as a separate, evidenced compatibility change.

### Step 6 — Preserve upload validation and persistence failure behavior

Continue using the existing shared upload middleware and persistence cleanup behavior. Verify:

- Upload type/size/count checks still run for every route.
- Route-specific field allowlists remain enforced.
- Only validated files are published and stored filenames remain compatible with existing URL construction.
- Database failure still logs the underlying error, removes only new request files, and returns a sanitized non-success response.
- Failed updates do not remove previously stored files.
- The no-upload route retains its intentional behavior and is not incorrectly passed through file-required middleware.

### Step 7 — Add or update tests

Use the existing Node.js `node:test` setup. Prefer unit tests for pure mapping/configuration and request-level tests for route and multipart behavior. Use temporary directories and controlled database/model stubs; do not require production data.

Replace any source-level test that asserts a fixed number of implementation call sites with tests that verify behavior and complete route/configuration coverage.

### Step 8 — Retire redundant implementation

Only after all routes use the shared path:

1. Search for references to each old query constant and route-specific handler.
2. Remove only constants and functions that are demonstrably unused.
3. Confirm no request URL or client field combination was dropped.
4. Keep existing URLs as aliases unless a separate migration has proven them unused and approved their retirement.

### Step 9 — Review the diff and verify

Review the entire diff for changed SQL semantics, dropped route aliases, widened upload-field permissions, altered success responses, or accidental changes to upload limits/content checks. Run the focused tests and the broader suite as feasible. Document any database-dependent skips and any unresolved deployment/product questions.

## 10. Architecture and Existing Patterns

- Follow `AGENTS.md`: use CommonJS modules and the current Node.js test conventions; all new database work should prefer the Sequelize stack. The existing mysql2 upload path is legacy and should not be expanded without a concrete compatibility reason.
- Follow `CODE_REVIEW.md`'s incremental change guidance. Extract shared mapping/handler behavior first, migrate route configurations, then remove redundant variants only after coverage.
- Reuse `createBusinessMediaUpload(...)` and `executeBusinessMediaQuery(...)` rather than duplicating their validation, cleanup, and failure-response behavior.
- Inspect Sequelize patterns in `app/db_controllers/` before deciding how route persistence should call models. Do not introduce a new repository/service architecture solely for this refactor.
- Keep the implementation explicit and auditable. Prefer a route configuration table and small helpers over metaprogramming or a generic router DSL.
- Do not add a dependency unless investigation demonstrates the existing stack cannot meet a required behavior.

## 11. Security and Reliability Requirements

- Preserve the current server-side file allowlist, content checks, size/count limits, generated filenames, staging, and cleanup. Do not weaken them during consolidation.
- Route-level field configurations must not become permissive merely because the shared handler accepts all possible fields.
- Never derive SQL column names from request keys, multipart field names without a fixed mapping, file names, or user input.
- Bind user-controlled values as SQL parameters or use Sequelize's structured model operations.
- Keep update columns constrained to the existing endpoint's intended field set.
- Preserve `executeBusinessMediaQuery(...)` failure semantics or provide equivalent tested cleanup: delete only files from the current failed request, never pre-existing media.
- Avoid returning SQL errors, filesystem paths, stack traces, or sensitive implementation details to clients.
- Do not represent a failed upload or database write as success, suppress errors, or risk duplicate responses.
- Do not claim PDF/MP4 checks provide full parsing or malware scanning; Finding 53 remains separately unresolved.

## 12. Backward Compatibility

Preserve:

- Existing HTTP method and URL for every endpoint currently called by clients.
- Existing multipart field names and endpoint-specific allowed combinations.
- Existing required/optional file behavior.
- Registration, standalone upload, profile update, and upgrade workflows.
- Correct mapping of uploaded filenames and metadata to media table attributes.
- Existing database semantics, including which columns are omitted, updated, or preserved.
- Existing successful response status and body/text.
- Existing generated filename format and `/uploads/users_upload_files/` URL behavior.
- Existing file validation and database-failure cleanup behavior.

Any endpoint retirement, field renaming, response change, storage migration, or file-policy change must be separate, explicitly justified, and approved. Do not infer that an endpoint is obsolete simply because a search finds no obvious caller; verify dynamic or server-rendered callers too.

## 13. Testing Strategy

### Route and field coverage

- Verify each existing upload URL is still registered or intentionally preserved as an alias.
- Verify each route accepts exactly its prior set of multipart fields and rejects unexpected fields.
- Verify required and optional file behavior for every configuration.
- Verify a route cannot use another endpoint's field combination to write extra media columns.

### Mapping and persistence

- For representative and exhaustive route configurations, assert field-to-column mappings and parameter/model values.
- Test missing optional media, absent metadata, empty strings, and explicit `null` according to current behavior.
- Test CREATE and UPDATE behavior separately. Confirm UPDATE changes only intended columns and retains other media fields.
- Verify UUID, date, and metadata handling remain compatible.
- Verify the fixed allowlisted column mapping cannot be influenced by arbitrary body keys or multipart field names.

### Response and upload regressions

- Assert the existing success status and response body/text for every response variant.
- Exercise valid image, PDF, and MP4 uploads using the existing test fixtures and verify generated filename/public URL behavior remains unchanged.
- Verify malformed, unsupported, or oversized uploads still fail with the existing explicit client error and leave no staged/published file.
- Simulate DB failures and verify sanitized failure response, single response, request-file cleanup, and preservation of old media.
- Verify the intentional no-upload registration route does not require a file.

### Regression and suite validation

- Update source-structure tests to avoid hard-coded counts of call sites; assert that all registered route configurations use the shared implementation and that each is covered.
- Run the focused upload and persistence tests first.
- Run `npm test` if the focused tests pass and the environment permits. Report skipped database-dependent tests separately from passes.
- Do not run broad formatting across the repository; format only changed files using the repository's configured formatter if needed.

## 14. Verification / Evidence

Before declaring completion, provide evidence that:

1. Every existing upload endpoint and its callers were inventoried.
2. Every retained endpoint routes through the shared handling path and preserves its field allowlist.
3. Each prior create/update mapping is represented in the shared configuration or otherwise covered by a compatibility test.
4. No request-controlled identifier can affect a SQL column name.
5. All remaining query constants are referenced or safely removed after a repository-wide search.
6. Existing file validation, generated names, URL behavior, and Finding 52 cleanup behavior remain in place.
7. Valid requests retain the expected success status/body; rejected files and persistence failures remain explicit non-success outcomes.
8. Focused test results and broader suite results, including skips, are reported accurately.
9. The final diff does not contain unrelated changes to authentication, registration, upload policy, storage, schema, or public media delivery.

## 15. Do NOT Do

- Do not rewrite the application or introduce an upload framework.
- Do not delete or rename existing upload URLs solely to reduce route count.
- Do not change client-visible request/response contracts without a separately approved migration.
- Do not accept every upload field on every old endpoint; retain endpoint-specific field allowlists.
- Do not build SQL identifiers from request data.
- Do not change update behavior by clearing fields that the old query left untouched.
- Do not weaken or bypass the existing upload middleware, field policy, validation, staging, or cleanup.
- Do not delete an old media file when an upload or update fails.
- Do not silently drop a route/query variant before finding all consumers and testing its replacement.
- Do not perform a broad Sequelize migration or database-schema redesign as an unverified side effect.
- Do not change environment secrets, production data, or existing uploaded files.
- Do not add unnecessary dependencies, suppress errors, or remove failing tests.
- Do not modify unrelated functionality or revert pre-existing worktree changes.

## 16. Acceptance Criteria

- [ ] All current upload endpoints, callers, field combinations, query mappings, and response contracts have been inventoried.
- [ ] Repeated route logic is replaced with a small, auditable shared implementation or handler factory.
- [ ] All existing URLs required by current clients remain available and behavior-compatible.
- [ ] Route-specific allowed fields and required/optional behavior remain enforced.
- [ ] Repeated media mappings are centralized and use only fixed, allowlisted attributes.
- [ ] Persistence uses established Sequelize patterns where feasible; any retained raw SQL uses parameterized values and fixed identifiers with a documented reason.
- [ ] CREATE and UPDATE semantics, including omitted/preserved columns, are unchanged.
- [ ] Existing upload validation, storage paths, generated filenames, response behavior, and persistence-failure cleanup remain intact.
- [ ] Redundant query constants and handler code are removed only after reference searches and replacement coverage.
- [ ] Tests cover route configurations, mapping, success responses, invalid uploads, DB failure cleanup, and update preservation.
- [ ] Brittle fixed-call-count assertions are replaced with meaningful behavior or route-coverage tests.
- [ ] Focused tests pass; full-suite results and database-dependent skips are reported.
- [ ] The final diff is reviewed and contains no unrelated changes.
- [ ] Remaining risks or uncertain legacy semantics are documented.

## 17. Expected Final Report

The implementing agent must finish with:

```markdown
# Implementation Report

## Summary

Briefly explain how route/query duplication was reduced and which compatibility approach was used.

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

Describe the route configuration, mapping, persistence approach, retained aliases, and behavior-preservation decisions.

## Testing

| Test | Result |
|---|---|
| Route and field coverage | PASS/FAIL |
| Mapping and CREATE/UPDATE semantics | PASS/FAIL |
| Valid upload and response regression | PASS/FAIL |
| Validation and persistence-failure cleanup | PASS/FAIL |
| Full test suite | PASS/FAIL/SKIPPED |

## Verification

Explain the repository-wide caller/query search and how equivalent behavior was demonstrated.

## Remaining Risks

List any unresolved legacy semantics, database/environment skips, or product/deployment questions.

## Final Status

PASS / NEEDS REVIEW
```

## 18. Important Rules for the Implementing Agent

1. **Verify current behavior first.** The review's route/query counts and proposed implementation may not match the current source.
2. **Separate facts from recommendations.** Mark unknown field requirements, update semantics, and route retirement decisions as `TO INVESTIGATE`.
3. **Preserve production behavior.** Reduce duplicated code without changing valid upload behavior or client contracts.
4. **Follow the complete path.** Trace browser callers, route aliases, multer field policy, file publication, mapping, persistence, cleanup, response, and displayed media URLs.
5. **Use safe identifiers.** Dynamic values may vary; column names must remain fixed and allowlisted.
6. **Keep the existing protections.** Finding 12's upload validation and Finding 52's persistence cleanup are dependencies of this refactor, not cleanup opportunities.
7. **Make the change demonstrable.** Tests must cover behavior, not merely assert that fewer lines or query constants exist.
8. **Refactor incrementally.** Route aliases can share an implementation before any endpoint is removed. Retire redundant variants only after usage searches and tests prove they are unused.

## 19. Output Requirements

Implement the verified, behavior-preserving refactor in the repository. Run the relevant tests, review the final diff, and provide the Implementation Report from Section 17. If route contracts, persistence semantics, or a safe migration path cannot be established, leave the uncertain behavior unchanged and report the specific blocker instead of making a production-breaking assumption.
