# AI Implementation Task: Validate Business Media File Uploads

## 1. Task Title

# Add Server-Side Validation to Business Media Uploads

## 2. Objective

Harden the business media upload endpoints so untrusted clients cannot upload arbitrary file types or unbounded files. Validate uploaded media on the server, constrain resource use, and return clear client errors for rejected uploads.

The change must preserve the current supported business-media workflows and response behavior wherever practical. In particular, confirm how uploaded filenames and public URLs are consumed before changing storage paths or URLs.

## 3. Problem / Finding

**Finding:** Finding 12 — File Upload Without Validation  
**Source:** `CODE_REVIEW.md`, Detailed Findings  
**Risk:** The finding describes accepting files without server-side type validation or file-size limits. The upload destination is under `public/`, which is served by Express static middleware.

The current configuration in `app/routes/upload-file.js` uses Multer disk storage with a destination of `./public/uploads/users_upload_files/`, creates the stored name from the submitted field name, current time, and `path.extname(file.originalname)`, and initializes Multer with storage only. No `fileFilter` or `limits` option is present in the inspected configuration. The module also calls `express.static()` for `public/`; the main server separately serves that directory.

Because the directory is web-accessible, accepting attacker-controlled extensions or content can expose visitors to active or misleading content. Missing size limits also allow excessive disk and request-resource consumption. Client-side file input restrictions are not a security boundary.

The code review suggests an allowlist, a 50 MB limit, UUID filenames, and potentially moving uploads outside the public directory. Treat those as recommendations to evaluate, not as already-implemented behavior or fixed product requirements. Confirm supported formats, expected maximum sizes, storage/URL dependencies, and deployment constraints before selecting exact policy values.

## 4. Affected Functionality

The affected feature is business media upload for registration and related profile workflows. `app/routes/upload-file.js` registers many legacy `/api/post/registration-upload-*` endpoints for combinations of logo, banner, video thumbnail, brochure, and webinar thumbnail fields. The handlers persist stored filenames and associated metadata through the legacy mysql2 query layer.

The current high-level path is:

```text
Browser multipart/form-data
   ↓
Express route in app/routes/upload-file.js
   ↓
Multer disk storage writes uploaded files
   ↓
Route handler reads req.files and req.body
   ↓
Legacy mysql2 query persists filenames and metadata
   ↓
Browser receives the existing upload response
```

`app/src/server.js` and `app/routes/upload-file.js` serve `public/` with Express static middleware. Existing client scripts refer to files under `/uploads/users_upload_files/`. Verify all consumers before changing the storage root, URL shape, or access policy.

## 5. Investigation Phase

Do not change code until completing this investigation:

1. Read `README.md`, `AGENTS.md`, and `CODE_REVIEW.md`, including Finding 12 and the incremental refactoring principles.
2. Inspect the current Multer configuration and every route registered in `app/routes/upload-file.js`. Identify each accepted field name, expected media role, route, DB query, response, and error path. Do not assume the full route list or current implementation is unchanged from the review.
3. Search the repository for all upload endpoints, Multer configuration, references to `users_upload_files`, and uses of the uploaded field names. Include client scripts, EJS inputs, profile/edit flows, and any other file-serving paths.
4. Determine which formats are actually required for each field. A logo/banner/thumbnail, video media, brochure, and webinar media may not share the same valid formats. Inspect the corresponding forms and server-side consumers rather than relying on filenames or the review's illustrative MIME list.
5. Determine the established and expected maximum sizes for each media type. Check existing product behavior, deployment/storage capacity, and any proxy/request limits. Do not apply one arbitrary threshold to every media class.
6. Inspect the global API middleware and route protection as it exists now. Do not infer authentication status from stale review text or add redundant auth logic as part of file validation.
7. Inspect existing error-handling conventions and the current test suite under `test/`. Identify how route/Multer errors can be tested and how the app handles Multer errors, unsupported files, partial uploads, and DB failures.
8. Inspect `app/query/users_business_medias.query.js` only as needed to understand the current persistence contract. Finding 13 covers route/query duplication separately; do not combine that broad refactor with this validation task unless a minimal coupled change is necessary.
9. Search for installed validation, file-inspection, or image-processing utilities before proposing a new dependency. `sharp` is present in `package.json`; verify whether and where it is used before relying on it for validation.
10. Check the working tree before editing and preserve unrelated changes.

If the actual acceptable formats, size policy, public-serving requirements, or error contract cannot be established from the repository, mark the choice as `TO INVESTIGATE` and ask for clarification rather than silently imposing a potentially breaking policy.

## 6. File Impact Analysis

| File | Role | Action | Reason |
|---|---|---|---|
| `app/routes/upload-file.js` | Multer configuration and upload handlers | MODIFY | Add shared, server-enforced validation and limits while preserving route contracts. |
| `test/` | Existing Node.js test suite | ADD or MODIFY | Add focused tests for valid uploads, invalid uploads, size limits, and error handling, following existing patterns. Confirm the best test file before choosing a path. |
| `public/assets/js/*upload*` and related media scripts | Client upload callers | REFERENCE ONLY / INVESTIGATE | Confirm fields, valid workflows, and response expectations; change only if an intentional compatible UI adjustment is needed. |
| `public/view/` upload forms | File input definitions | REFERENCE ONLY / INVESTIGATE | Confirm the user-facing file types and required upload fields; client restrictions must not replace server validation. |
| `app/src/server.js` | Global middleware and static serving | REFERENCE ONLY / INVESTIGATE | Verify static exposure and middleware order. Modify only if the selected safe-storage approach requires a carefully scoped, compatible serving change. |
| `app/query/users_business_medias.query.js` | Legacy media persistence queries | REFERENCE ONLY | Understand persistence only; query consolidation is a separate finding and should not be bundled into this task. |
| `README.md` | Project and file-upload documentation | MODIFY only if needed | Update directly related upload documentation if the implemented behavior or limits materially change documented behavior. |
| `package.json` and lockfile | Dependencies | MODIFY only if justified | Add a dependency only if no suitable existing capability can meet verified content-validation requirements. |

Do not delete endpoints or query variants as part of this task by default. Any such consolidation is outside Finding 12 and requires separate evidence and a behavior-preserving plan.

## 7. Current Implementation

### Verified current facts

- `app/routes/upload-file.js` imports Multer and configures `diskStorage`.
- Its inspected destination is `./public/uploads/users_upload_files/`.
- Its stored filename uses `file.fieldname`, `Date.now()`, and the extension from `file.originalname`.
- The inspected Multer instance is configured with `storage` only; it has no `fileFilter` or `limits`.
- The module installs `express.static()` for `public/`, and `app/src/server.js` also serves `public/`.
- Upload handlers use the `req.files` object, read metadata from `req.body`, call legacy media queries, and return the existing success text on successful persistence.
- The route file contains many endpoint-specific Multer field configurations and handlers. Their complete current behavior and coverage must be inventoried before changing shared configuration.
- The README describes uploads as multipart requests and says profile media URLs are returned to the browser, but its sequence diagram and implementation details may not match the current code exactly. Verify behavior in the implementation and clients before relying on the diagram.

### Current risk

The inspected upload configuration does not limit file size or restrict accepted content. A filename extension and the multipart `file.mimetype` value are client-influenced; neither alone proves the uploaded file's actual content type.

## 8. Current → Target

### Current

```text
Multer writes files from multipart requests to a public static directory.
The inspected Multer configuration has no fileFilter or limits.
The filename preserves a client-supplied extension.
Handlers persist the resulting filenames and metadata.
```

### Target

```text
Server applies a field-aware allowlist for expected media.
Server enforces verified, documented per-file (and, if needed, request/count) limits.
The stored filename is generated safely and uses an extension derived from validated content.
Invalid type, malformed content, and over-limit requests fail explicitly without a success-shaped response.
Valid uploads continue to use the existing fields, metadata, persistence semantics, and URLs unless a separate compatible storage change is justified.
```

Use Multer's `fileFilter` and `limits` as early request controls, but do not treat the browser-provided MIME type or extension as sufficient content validation. Where the risk and supported formats require it, verify file signatures or decode/re-encode supported media with an existing suitable library. Reject formats that cannot be safely validated rather than accepting arbitrary files.

## 9. Detailed Implementation Plan

### Step 1 — Inventory upload contracts

Create an implementation checklist from every active route and client caller. Record field names, permitted file formats, count, size expectations, stored filename consumers, and response behavior. Confirm whether the `videoInput` field accepts an uploaded file or whether video links are supplied separately.

### Step 2 — Define a field-aware policy

Define only the media types supported by actual product flows. For each field, specify:

- Accepted, content-verified formats.
- A product-approved maximum file size.
- Maximum file count.
- Whether empty/missing files are allowed for that route.

Use a common policy/helper only if it preserves field-specific differences. Do not copy the review's example list or 50 MB limit without verifying it against the actual upload contract.

### Step 3 — Add server-side checks

Add validation to the shared Multer configuration so every relevant route receives the same baseline protections. Apply any necessary field-specific restrictions consistently. Validate content rather than trusting `originalname` or `file.mimetype` alone.

Generate an unpredictable, collision-resistant storage name. Do not use the original filename as a path component. Derive any retained extension from the validated file type, not from an unchecked client-supplied suffix.

If the safest implementation requires a temporary location, ensure files are moved only after validation and are cleaned up after failures. Ensure a failed DB write does not leave orphaned files when practical and consistent with the existing flow.

### Step 4 — Handle validation errors explicitly

Ensure rejected files and Multer limit errors become explicit client errors using the repository's existing error-handling conventions. Do not return upload success when validation fails; do not silently ignore errors or turn them into generic successful responses. Avoid exposing internal filesystem paths or stack traces.

### Step 5 — Preserve serving and API behavior

Keep existing route URLs, field names, metadata, persistence, and successful response contract unless a change is demonstrably necessary. If files remain under `public/`, ensure only validated passive content can be written there and consider appropriate response headers such as `X-Content-Type-Options: nosniff` where compatible.

Moving storage outside `public/` and adding an authenticated serving endpoint can be a safer design, but it changes URL/access behavior. Do not implement that migration without tracing every existing URL consumer and proving the new serving behavior preserves required access and response semantics. Treat it as a separate scoped change if it cannot be made safely within this finding.

### Step 6 — Add focused tests

Add tests for validation policy and the route/middleware behavior. Use temporary test files and clean them up. Do not rely only on unit tests of a helper if request-level Multer behavior is where the protection is applied.

### Step 7 — Review and verify

Review the full diff. Search again for any upload path using a different Multer instance or bypassing the new checks. Verify that all relevant upload endpoints inherit the protection, errors are not swallowed, and valid business-media uploads still follow the current contract.

## 10. Architecture and Existing Patterns

- Follow `AGENTS.md`: use existing project conventions and do not introduce a new architecture for this targeted bugfix. The upload module currently belongs to the legacy route/mysql2 stack; avoid unrelated data-access migration.
- Follow `CODE_REVIEW.md`'s incremental-change guidance: extract or share a small validation helper only if that reduces duplication without broad route rewrites.
- Reuse existing package capabilities where suitable. `multer` is already installed; `sharp` is also listed, but its suitability and current use must be inspected.
- Do not consolidate the 30+ handlers or the media SQL variants as part of this task. That is Finding 13 / the separate media-query duplication recommendation.
- Match existing formatting and test conventions. Tests are run with `npm test` (`node --test`).
- Do not invoke broad formatting over the entire repository for this documentation/task; when implementing, use the smallest relevant validation commands.

## 11. Security Requirements

- Never trust the request's filename, extension, declared MIME type, or client-side validation as proof of file content.
- Enforce a server-side allowlist based on the actual field use case and verified file content where applicable.
- Reject executable or active-content formats, including HTML/SVG or script files, unless a documented use case and safe serving strategy explicitly require them.
- Set finite file-size and file-count limits. Confirm limits against legitimate product use and infrastructure constraints.
- Use safe generated filenames and prevent path traversal or overwrite through attacker-controlled names.
- Handle malformed or unsupported files with explicit errors and no success response.
- Avoid storing unvalidated content in a directory served as public web content.
- If uploads are public by design, confirm that only validated passive file types can reach that directory and preserve safe content-type handling.
- Do not claim that MIME allowlisting alone prevents spoofed-content uploads.
- Consider partial files, cleanup after Multer/validation/database errors, repeated uploads, and disk-exhaustion cases.
- Do not leak filesystem paths, secrets, or stack traces in responses.
- Do not disable authentication, rate limiting, Helmet, or other middleware to make uploads pass. Verify current route protection and keep this change scoped to file validation.

## 12. Backward Compatibility

Preserve, unless investigation proves a change necessary:

- Existing upload endpoint URLs and supported combinations of uploaded fields.
- Existing multipart field names and expected optionality.
- Existing media metadata and database persistence behavior.
- Existing successful response shape/text consumed by the browser.
- Existing filename lookup and profile rendering behavior.
- Existing public media URLs and access to already-uploaded files.

Invalid file types and over-limit uploads should intentionally change from being accepted to returning a clear client error. If reducing accepted file formats or size limits could reject existing legitimate uploads, establish the policy before implementation and document that change.

## 13. Testing Strategy

Add focused automated tests using the repository's existing Node.js test runner and conventions.

### Normal cases

- Upload each currently supported valid media type through a representative route.
- Upload supported formats for each field class (logo/banner/thumbnail/brochure and any actual uploaded video format).
- Verify generated filenames are safe and do not reuse attacker-provided path components.
- Verify successful uploads preserve expected persistence fields and response behavior.

### Empty and missing input

- Verify optional file fields remain optional where the current route permits them.
- Verify a request with no file follows the intended existing contract and does not falsely claim an upload succeeded.
- Verify unknown multipart field names are rejected safely.

### Boundary cases

- File exactly at the configured size limit is handled according to the chosen policy.
- File one byte over the limit is rejected.
- File count at and above each configured maximum is handled correctly.
- Exercise empty files, truncated files, unusual Unicode names, long names, and names containing path separators.

### Invalid and adversarial input

- Reject a disallowed extension/content type.
- Reject a file whose declared MIME type is allowed but whose bytes do not match the declared type.
- Reject a file whose extension claims an allowed type but whose content is unsupported or malformed.
- Reject HTML/script or other active content not explicitly supported.
- Confirm rejection does not create a persistent file or media database record.
- Confirm database failure or middleware failure does not leave a success response or unhandled rejection.
- Confirm response messages do not reveal internal paths or implementation details.

### Regression

- Exercise every route family or prove through shared middleware coverage that all upload endpoints use the new policy.
- Verify registration and profile/edit media callers still send the expected field names.
- Verify already stored valid media remains accessible at its existing URL.
- Run focused tests first, then `npm test` if the test setup permits. Report skips separately from passes.

## 14. Verification / Evidence

Before declaring completion, provide evidence that:

1. Every active Multer configuration and business media upload route was found and the validation applies to all intended routes.
2. No relevant upload handler bypasses the policy.
3. The server rejects forged MIME/extension combinations and over-limit files.
4. Invalid uploads produce explicit non-success responses and do not leave persistent files or database records.
5. Valid uploads preserve required client-visible behavior.
6. Relevant tests pass; any skipped tests and environmental limitations are reported.
7. The final diff contains no unrelated endpoint/query consolidation or behavioral changes.
8. Remaining limits or verification gaps are clearly stated.

For the final repository search, search for Multer initialization, `upload.fields`, `upload.single`, upload destinations, and upload route registrations rather than searching only for the original filename.

## 15. Do NOT Do

- Do not rewrite the upload module or collapse all endpoint/query duplication as part of this finding.
- Do not choose arbitrary accepted formats or a universal file-size threshold without confirming legitimate requirements.
- Do not trust MIME type or extension alone.
- Do not modify API contracts, profile media URLs, or storage layout unnecessarily.
- Do not move files out of public storage without tracing and preserving existing URL consumers.
- Do not add a dependency if existing dependencies can meet the verified requirements safely.
- Do not change the database schema unless investigation proves it is required.
- Do not modify `.env`, secrets, or deployment credentials.
- Do not suppress errors, return success for rejected uploads, or remove failing tests.
- Do not modify unrelated functionality or revert pre-existing worktree changes.

## 16. Acceptance Criteria

- [ ] All current business media upload routes and field names have been inventoried.
- [ ] The accepted file types and size/count limits are based on verified product requirements.
- [ ] Server-side validation is applied consistently to every intended upload endpoint.
- [ ] File content is not accepted solely because its client-provided MIME type or extension is allowed.
- [ ] Stored filenames are generated safely and do not incorporate untrusted path components.
- [ ] Oversized, unsupported, and malformed uploads fail explicitly without a success response.
- [ ] Rejected uploads do not create persistent files or database records.
- [ ] Valid uploads preserve existing endpoints, fields, persistence behavior, and client-visible URLs/responses unless an approved compatible change is documented.
- [ ] Focused upload tests pass; full-suite results and skips are reported.
- [ ] Final diff and repository-wide upload-path search are reviewed.
- [ ] Remaining risks or unverified deployment constraints are documented.

## 17. Expected Final Report

The implementing agent must finish with:

```markdown
# Implementation Report

## Summary

Brief explanation of the validation and limits implemented.

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

State accepted formats, how actual content is validated, configured limits, error behavior, storage/URL decisions, and compatibility impact.

## Testing

| Test | Result |
|---|---|
| Valid supported upload | PASS/FAIL |
| Unsupported or forged content | PASS/FAIL |
| Size and count boundaries | PASS/FAIL |
| Regression tests | PASS/FAIL |

## Verification

Explain the route coverage search, relevant test results, and how the original finding was verified as fixed.

## Remaining Risks

List deployment limits, unknown product policy, skipped tests, or other items that could not be verified.

## Final Status

PASS / NEEDS REVIEW
```

## 18. Important Rules for the Implementing Agent

1. **Do not hallucinate:** Inspect actual routes, field names, media formats, tests, and response consumers. Mark unknown requirements `TO INVESTIGATE`.
2. **Separate facts from recommendations:** The current-code facts in this task are limited to the inspected upload configuration and static serving. Reconfirm them before changing code.
3. **Prefer project consistency:** Reuse existing dependencies and conventions; do not introduce parallel upload architectures.
4. **Preserve behavior:** Keep supported valid uploads working, and make invalid-input behavior the intentional change.
5. **Trace the entire path:** Follow browser form → route/middleware → file write → database persistence → response → media URL rendering.
6. **Make the fix demonstrable:** Test request-level rejection and valid uploads; do not report completion based only on a code inspection.
7. **Keep scope bounded:** Address validation and resource limits for Finding 12. Treat route/query deduplication (Finding 13) and private-storage migration as separate work unless a minimal, verified prerequisite is essential.

## 19. Output Requirements

When implementing this task, make the verified code changes, run the relevant tests, review the final diff, and provide the Implementation Report in Section 17. Do not claim the task is complete when policy decisions, route coverage, or critical validation behavior remain unverified.
