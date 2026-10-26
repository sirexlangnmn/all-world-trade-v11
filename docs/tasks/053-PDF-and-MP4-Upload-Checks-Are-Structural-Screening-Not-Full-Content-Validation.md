# AI Implementation Task: Strengthen PDF and MP4 Upload Content Inspection

## 1. Task Title

# Strengthen PDF and MP4 Upload Content Inspection

## 2. Objective

Choose and implement an appropriate level of content assurance for publicly served business-media PDFs and MP4s. The current middleware performs useful structural screening, but it does not fully parse, sanitize, or decode either format.

The implementation must reduce the risk of malformed or hostile files reaching downstream browser and media parsers, while preserving the existing business-media upload workflow and public URL contract. The coding agent must first establish which original-file behaviors the product requires, then select the smallest production-operable strategy that satisfies those requirements.

Do not claim that structural checks, MIME declarations, file extensions, or malware scanning alone provide full format validation. If the repository and deployment constraints do not support a stronger implementation safely, document the unresolved decision and do not report the finding as fixed.

## 3. Problem / Finding

**Finding:** Finding 53 — PDF and MP4 Upload Checks Are Structural Screening, Not Full Content Validation  
**Source:** `CODE_REVIEW.md`, Detailed Findings  
**Priority:** Medium–High in the review priority table.

**Affected code:** `app/middleware/business-media-upload.middleware.js`, particularly `validatePdf` and `validateMp4`.

### Verified current implementation

- Image uploads are decoded and re-encoded by Sharp, with a pixel limit.
- PDF uploads are read into memory and screened for a `%PDF-` header, catalog marker, `startxref`/EOF markers, and a cross-reference table or stream.
- MP4 uploads are scanned for a plausible top-level box sequence, `ftyp`, `moov`, `mdat`, and a video handler.
- After validation, files receive generated names, are moved into the configured public upload directory, and are referenced by existing media routes/database workflows.
- Existing policy accepts JPEG/PNG images, PDF brochures up to 10 MiB, and MP4 video up to 50 MiB. Preserve the actual field-specific policies in the current middleware; do not use this finding to widen accepted sizes or types.
- `public/` is served statically by Express. The existing security-header tests assert `X-Content-Type-Options: nosniff`.
- `test/012-file-upload-without-validation.test.js` covers valid upload flows, MIME spoofing, malformed examples, limits, and cleanup. Its synthetic MP4 fixture is structural, not evidence that a production decoder accepts or safely processes real video.

These checks reject some common malformed or spoofed inputs, but they do not validate every PDF object/stream or decode every MP4 track, sample, codec, or media payload. A file that passes these checks may still be interpreted differently by a browser or media decoder. Public serving increases the impact of parser discrepancies and active PDF features.

**Important distinction:** This finding does not say the current checks are useless or that every upload is exploitable. The implementation should improve or accurately bound the assurance, and must not describe a format signature check as full validation or malware scanning.

## 4. Affected Functionality

Business profiles accept brochure PDFs and MP4 video alongside image media. Uploads use the common middleware and are stored under the public uploads path used by existing profile/media flows.

### Current high-level flow

```text
Browser multipart upload
   ↓
app/routes/upload-file.js selects allowed field(s)
   ↓
app/middleware/business-media-upload.middleware.js
   ├─ field/MIME/size checks and temporary staging
   ├─ image decode/re-encode with Sharp
   ├─ PDF structural screening OR MP4 box/handler screening
   └─ publish generated filename under the public upload directory
   ↓
Existing route handler persists/uses the generated filename
   ↓
Express serves public files from public/
```

The exact sequencing and persistence behavior must be reconfirmed in the current code before implementation. Finding 52 separately addresses cleanup after database-write failures; do not combine or regress that work.

### Target high-level flow

```text
Browser multipart upload
   ↓
Existing field, declared-type, request, and size limits
   ↓
Bounded content processing in an isolated or otherwise adequately constrained step
   ├─ validate and sanitize/rasterize PDF, if compatible with product requirements
   └─ fully decode and/or transcode MP4 to an explicitly supported output profile
   ↓
Publish only successfully processed output
   ↓
Preserve existing filename/URL and database/API behavior where possible
```

The selected strategy may retain original bytes only if the threat model and chosen parser/validation approach justify doing so. Record any intentional content changes, such as loss of PDF interactivity or video transcoding.

## 5. Investigation Phase

Complete this investigation before changing code:

1. Read `README.md`, `AGENTS.md`, and `CODE_REVIEW.md`, including Finding 12, Finding 52, Finding 53, the upload/data-flow sections, and applicable security and deployment guidance. Treat current code as authoritative where documentation is stale.
2. Inspect the complete current `app/middleware/business-media-upload.middleware.js`. Trace all content checks, error mapping, temporary-file handling, publication timing, file naming, and supported fields/types/sizes.
3. Search the repository for `createBusinessMediaUpload`, `validatePdf`, `validateMp4`, all brochure/video upload fields, `users_upload_files`, and code that reads or serves the stored filenames. Verify whether the shared middleware is used outside `app/routes/upload-file.js`.
4. Inspect `app/routes/upload-file.js` to confirm which legacy, registration, update, and upgrade paths use the middleware and what response/database contracts depend on generated filenames. Do not refactor its duplicated routes as part of this finding.
5. Trace static serving and security headers in `app/src/server.js` and related middleware. Confirm the actual response `Content-Type` behavior for PDFs/MP4s and that `X-Content-Type-Options: nosniff` remains set for uploaded files.
6. Inspect `test/012-file-upload-without-validation.test.js`, `test/010-helmet-security-headers.test.js`, and the remaining `test/` suite for established fixtures, temporary-directory setup, cleanup assertions, HTTP response conventions, and relevant regression coverage.
7. Establish product requirements before choosing a processing strategy:
   - Must the exact original PDF bytes be preserved?
   - Are PDF forms, links, annotations, scripts/actions, embedded files, or other active features required?
   - What PDF page count, dimensions, output size, and accessibility/searchability behavior must be preserved?
   - Which video codecs, profiles, container features, audio tracks, playback clients, and quality levels are supported?
   - Is asynchronous processing acceptable, or must uploads complete synchronously?
   Mark unanswered requirements `TO INVESTIGATE`; do not make irreversible behavior choices by assumption.
8. Inspect `package.json`, lockfiles, deployment configuration, and available runtime/container tooling to determine whether a maintained parser, sanitizer, decoder, or transcoder already exists and can be operated in production. Do not assume a binary or package is installed just because it is available locally.
9. Evaluate operational constraints for any proposed processor: isolation, CPU/memory/disk limits, wall-clock timeout, concurrency, process lifecycle, temporary storage, deployment availability, upgrade/patch ownership, and failure monitoring. Confirm these limits are enforceable in the actual deployment environment.
10. Check worktree state before editing. Preserve unrelated changes and do not inspect or alter `.env`, production media, or production data.

## 6. File Impact Analysis

| File | Role | Action | Reason |
|---|---|---|---|
| `app/middleware/business-media-upload.middleware.js` | Shared media policy, validation, staging, publication, and error mapping | MODIFY | Integrate the chosen PDF/MP4 processing step and publish only accepted output; retain the current field and size policies unless product requirements explicitly change them. |
| `test/012-file-upload-without-validation.test.js` | `node:test` integration coverage for upload middleware | MODIFY | Add tests proving the selected processor rejects/normalizes relevant adversarial content, enforces resource/failure behavior, and preserves existing upload behavior and cleanup. |
| `test/010-helmet-security-headers.test.js` | Existing HTTP security-header regression tests | REFERENCE ONLY; MODIFY only if serving behavior changes | Confirm `nosniff` remains in effect for uploaded public content. |
| `app/routes/upload-file.js` | Upload endpoint/field wiring and legacy persistence callbacks | REFERENCE ONLY by default | Verify every relevant upload path uses the middleware and that filenames/response contracts remain compatible. Modify only if investigation proves integration changes are required. |
| `app/src/server.js` | Express static-file serving and application middleware setup | REFERENCE ONLY by default | Verify public serving and security-header ordering; change only if required to preserve safe, explicit upload content types or headers. |
| `package.json` and the corresponding lockfile | Runtime dependencies and scripts | MODIFY only if required | Add a parser/processor dependency only after evaluating existing project tooling, supported formats, deployment availability, licensing, maintenance, and operational cost. |
| Deployment/container/process configuration (exact path `TO INVESTIGATE`) | Production runtime limits and processor availability | INVESTIGATE; MODIFY only if required | Any external or resource-intensive processor must be available and constrained in every deployment environment. |
| `README.md` | Human-facing upload behavior and security documentation | MODIFY only if behavior or guarantees change | Correct stale upload descriptions and document material user-visible behavior or explicitly bounded assurance. |

Do not add a worker, service, queue, binary, dependency, or configuration file until investigation demonstrates it is needed and its production operation can be supported.

## 7. Current Implementation

**CURRENT IMPLEMENTATION — verified facts**

- The shared middleware defines field-specific MIME types and byte limits.
- Multer stages file data in a temporary directory and enforces request limits.
- Images use Sharp to inspect, decode, and re-encode accepted content.
- `validatePdf` reads the file and checks selected PDF markers and cross-reference structure.
- `validateMp4` walks top-level boxes and searches the movie box for a video handler; it does not decode all media samples or validate codecs.
- Processed files are assigned generated names and copied into the public upload directory after content checks succeed.
- Unknown processing errors and invalid uploads are mapped through the middleware's upload-error handling; confirm exact status/message behavior before changing it.
- The upload tests use generated PDFs and a hand-built MP4 fixture. They test structural acceptance/rejection, not a security boundary against all parser differentials or hostile embedded content.

Do not assume the existing PDF or MP4 routines can be removed wholesale. Reuse any low-cost structural screening that remains useful, but make the selected parser/sanitizer/decoder the actual acceptance gate.

## 8. Current → Target

## Current

```text
PDF: selected header/catalog/xref/EOF checks → publish original uploaded bytes
MP4: selected top-level box and video-handler checks → publish original uploaded bytes
Images: Sharp decode/re-encode → publish processed output
```

## Target

```text
PDF: inspect with a maintained parser; apply the agreed sanitizer or rasterization
     policy where required; reject processing failures; publish only approved output.

MP4: fully decode and/or transcode with a maintained parser/decoder to the agreed
     output profile; reject processing failures; publish only approved output.

All: preserve existing type/size/field limits, generated filenames, URL paths,
     and successful endpoint behavior unless an intentional change is approved.
     Run expensive/untrusted parsing under enforceable resource and isolation limits.
```

The precise implementation depends on product requirements, available tooling, and deployment constraints. Use the target as an assurance goal, not as a mandate for a particular package, binary, worker architecture, or conversion format.

## 9. Detailed Implementation Plan

### Step 1 — Map the Existing Upload Contract

Record the route fields, MIME types, byte limits, generated output extensions, public URL paths, response behavior, staging lifecycle, and database persistence order. Verify all upload callers. Do not consolidate the 30+ route/query variants.

### Step 2 — Agree on Output Requirements

Document the PDF and video behaviors users need to retain. For PDFs, evaluate active actions/scripts, embedded files, forms, annotations, links, page count, text extraction, accessibility, and rasterization tradeoffs. For MP4, identify supported codecs/tracks, playback targets, quality, output size, and whether transcoding is acceptable.

If requirements cannot be established, stop before choosing a destructive transformation and report the open decision. Do not mark the finding resolved on the basis of existing structural screening.

### Step 3 — Select a Maintained Processing Strategy

Select only after confirming it can be deployed and maintained:

- **PDF:** use a maintained parser to inspect the complete document and a suitable sanitizer to remove prohibited active content; rasterize only if product behavior, accessibility, and quality requirements permit it. Define exactly which features are retained or rejected.
- **MP4:** decode the complete relevant media streams and/or transcode to an explicitly supported profile. Validate the produced output as well as successful completion of the processing step.
- **Malware scanning:** treat scanning as defense in depth, not as a substitute for parsing, sanitization, or decoding. Do not claim a clean scan proves a file is safe.

Prefer a restricted worker/process over doing unbounded parsing in the Express request path when the selected tools or file sizes make that necessary. Use fixed executable paths/arguments and avoid shell interpolation if invoking external tools. Ensure concurrency, timeouts, and resource limits are meaningful and enforceable, not merely documented.

### Step 4 — Integrate with Staging and Publication

1. Keep incoming data outside the public directory while it is being processed.
2. Process into a distinct temporary output path; do not overwrite an existing file or publish partial output.
3. Validate the processor's exit/result status, output existence, output type, and output size before publication.
4. Publish atomically only after processing succeeds. Continue using generated filenames and the existing public URL contract unless an intentional, approved compatibility change is necessary.
5. Remove input and partial output on rejection, timeout, processor failure, or publication failure. Log cleanup/processor failures using repository conventions without exposing internal paths, commands, or parser details to clients.
6. Preserve the current middleware's status codes and sanitized response shape for expected invalid uploads. Distinguish malformed user content from internal processor/service failures; do not hide infrastructure failures as successful or invalid-input outcomes.
7. Keep the existing field/type/file-size/request limits. Enforce additional processing limits (including decompressed PDF/page/pixel-like expansion or video duration/output limits) based on evidence and product/deployment requirements.

### Step 5 — Preserve Serving and Persistence Behavior

Confirm Express serves the published files with the intended `Content-Type` and `X-Content-Type-Options: nosniff`. Preserve middleware ordering and security headers. Ensure generated extensions match the actual processed output format.

Keep route and database behavior stable. Do not alter media schema, route contracts, authorization, or existing-media cleanup as part of this finding. Coordinate with Finding 52 only if the implementation changes staging/publication timing; do not regress its request-scoped cleanup guarantees.

### Step 6 — Add Focused Tests

Extend the existing `node:test` upload tests or add a focused test file following repository conventions. Use temporary directories and deterministic fixtures; do not require production data or an uncontrolled external service.

Test the actual selected processor in a reproducible test environment. If a required production binary cannot be present in regular CI, provide a deterministic integration/contract test for the processing adapter and document the separate deployment-level verification; do not substitute a mock for all evidence that the binary runs correctly.

### Step 7 — Update Directly Related Documentation

Correct only descriptions that no longer match the implementation. State what is parsed, sanitized, decoded, or scanned and the limits of those guarantees. Do not use “safe,” “fully validated,” or “malware-free” as an absolute claim.

### Step 8 — Review the Final Diff

Verify the complete upload path, all relevant fields, cleanup, processor failure behavior, headers, compatibility, and tests. Confirm the change is scoped to Finding 53 and that no production upload data or environment secrets were changed.

## 10. Architecture and Existing Patterns

Follow the existing shared upload middleware and `node:test` integration-test patterns. Reuse current temporary staging, generated filenames, error mapping, cleanup helpers, and configuration mechanisms where they fit the chosen solution.

Search for existing package wrappers, worker/process management, logging, deployment/container configuration, test fixtures, and security-header setup before adding new code. Keep endpoint-specific behavior in the route layer and shared file-content processing in the common middleware or an appropriately scoped helper.

Do not introduce a new dependency, framework, queue, daemon, storage service, or architecture when an adequate supported project pattern already exists. Do not migrate legacy upload routes or persistence to Sequelize as part of this finding. If no suitable processing or isolation pattern exists, present the operational choice explicitly rather than inventing a fragile local-only solution.

## 11. Security Requirements

- Never treat the client-supplied filename, extension, MIME type, or file signature as proof that content is valid.
- Never publish a file before the selected full parser/decoder and any required sanitizer/transcoder have completed successfully.
- Never allow malformed, partial, timed-out, over-resource, or processor-error output to be treated as a successful upload.
- Do not run external commands through a shell with user-controlled input. Use fixed executable paths and argument arrays if external processes are used.
- Bound CPU, memory, wall-clock time, disk usage, and processing concurrency in the actual runtime environment.
- Keep untrusted input and intermediate output out of public/static paths. Clean up temporary inputs and outputs on every success and failure path.
- Preserve `X-Content-Type-Options: nosniff` and confirm explicit content types match actual output formats. Do not weaken Helmet or CSP to accommodate a processor.
- Do not expose stack traces, local paths, command lines, parser diagnostics, or internal service details in API responses.
- Treat antivirus/malware scanning as additive and do not claim it proves semantic safety.
- Test malformed PDFs, PDFs containing prohibited active content or embedded files, malformed MP4 box/sample data, unsupported or invalid codecs, decoder failures, timeouts, oversized/decompression/resource cases, and cleanup after failure.
- Inspect for alternate upload paths that can publish PDFs or videos without the common middleware.

## 12. Backward Compatibility

Preserve, unless an intentional product change is agreed and documented:

- Existing upload route paths, accepted field names, MIME types, and current size limits.
- Generated filename safety and `/uploads/users_upload_files/` URL behavior.
- Database filename values and media references.
- Successful response status, response body, and client-visible workflow.
- Existing replacement/update semantics and previously stored media.
- Valid PDF/video functionality required by existing users.
- Existing image decode/re-encode behavior.
- Error response shape and status behavior for rejected uploads where feasible.
- Static serving and security headers.

If sanitization or transcoding intentionally changes output bytes or features, document the difference, validate existing clients/playback workflows, and obtain the required product decision before implementation.

## 13. Testing Strategy

### Normal Case

- Upload representative valid PDFs and MP4s covering the supported feature/codec profiles.
- Confirm the processing result is accepted, has the expected output type/extension, and is playable/readable by supported clients.
- Confirm existing logo/banner/image uploads and successful media persistence paths still work.

### Empty, Missing, and Boundary Cases

- Missing file, empty file, minimum valid input, and files at existing 10 MiB PDF and 50 MiB MP4 limits.
- Files exceeding existing limits and any newly approved processing limits.
- Large page counts, unusually large decoded structures, long-duration/high-resolution videos, and outputs that expand substantially during processing.
- Ensure no partial file becomes visible and no stale temporary file remains.

### Invalid Input

- Correct MIME declaration with non-PDF/non-MP4 bytes.
- Truncated/corrupt xref tables, objects, streams, boxes, samples, and container metadata.
- Files that pass the old structural screening but fail the selected full parser/decoder.
- PDFs with prohibited scripts/actions, embedded files, or other active features, verifying the agreed sanitize/reject policy.
- MP4s with unsupported codecs, invalid tracks, malformed payloads, and decode/transcode errors.

### Security and Resource Cases

- Processor timeout, non-zero exit, crash, missing executable/service, and invalid or empty processor output.
- Attempts to exhaust CPU, memory, temporary disk, or concurrency within configured limits.
- Verify process arguments cannot be affected by uploaded filenames or fields.
- Confirm rejected uploads leave no files in public storage or temporary staging.
- Confirm `nosniff`, accurate content types, generated filenames, and no public access to staging data.

### Regression Testing

- Run the focused upload and security-header tests.
- Run `npm test`; report database-dependent tests that skip separately.
- Verify all registration, profile-update, and upgrade upload fields still use the expected limits and generated filenames.
- Check PDF and MP4 playback/download through the existing application routes.

## 14. Verification / Evidence

The implementation report must include evidence, not only “fixed”:

- Name the selected PDF and MP4 processing strategy and explain why it meets confirmed product and deployment requirements.
- Identify the actual parser/sanitizer/decoder version and where it is installed/configured. Include deployment verification if CI cannot exercise the production binary.
- Show that uploaded files are not published until processing completes successfully.
- Show enforcement of resource limits and cleanup behavior for rejection, timeout, and processor failure.
- Report tests run and results, including representative valid files and adversarial cases.
- Confirm `nosniff`, actual response content types, generated extension correctness, upload route contracts, and successful media behavior.
- Search for alternate routes that bypass the common validation path and state the result.
- Review the final diff and list residual limitations, including parser coverage and any accepted original-content features.

If no stronger strategy was safely implemented, explicitly state that Finding 53 remains unresolved or needs a product/deployment decision. Do not report structural screening as full validation.

## 15. Do NOT Do

- Do not rewrite the upload route module or consolidate its SQL/query variants.
- Do not change the database schema or media URL/file-name contract without evidence and approval.
- Do not increase supported file sizes, formats, codecs, or field counts as incidental scope.
- Do not pass original PDF/MP4 bytes through solely because their headers or MIME values look correct.
- Do not describe signature checks or malware scanning as full parsing, sanitization, or proof of safety.
- Do not add an unmaintained or unsupported dependency, or rely on a tool present only on a developer workstation.
- Do not run a parser/transcoder without enforceable resource and execution limits.
- Do not publish intermediate output or return success after processor failure.
- Do not suppress processor errors, cleanup errors, or failing tests.
- Do not delete existing user media or change replacement cleanup semantics.
- Do not modify `.env`, secrets, production data, or unrelated functionality.
- Do not remove or weaken `nosniff`, Helmet, validation, size checks, or existing tests.

## 16. Acceptance Criteria

- [ ] The PDF and MP4 upload paths and all shared-middleware callers were investigated.
- [ ] Product requirements for retained PDF features and supported video profiles are documented or explicitly marked as unresolved.
- [ ] A maintained, production-operable parser/sanitizer/decoder strategy is selected based on verified requirements and deployment constraints.
- [ ] PDFs and MP4s are processed to the agreed assurance level; structural checks are not represented as full validation.
- [ ] Parsing/decoding runs with enforceable resource, timeout, temporary-storage, and concurrency limits appropriate to the deployed environment.
- [ ] Files are published only after successful processing; all rejected, partial, timed-out, or failed artifacts are cleaned up.
- [ ] Existing media field policies, size limits, generated filenames, public URLs, database values, and successful endpoint behavior are preserved unless a documented change was approved.
- [ ] `X-Content-Type-Options: nosniff` remains enabled and the served content types/extensions match the processed outputs.
- [ ] Tests cover valid files, malformed/adversarial content, processor failures, resource failures, cleanup, and existing upload regressions.
- [ ] Relevant upload and security-header tests pass; any skipped database-dependent tests are reported separately.
- [ ] Directly related documentation accurately describes the implemented assurance and its limits.
- [ ] The final diff contains no unrelated changes, and remaining risks or open decisions are documented.

## 17. Expected Final Report

```markdown
# Implementation Report

## Summary

Briefly describe the implemented PDF and MP4 assurance strategy.

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

Describe the parser/sanitizer/decoder, output policy, isolation/resource limits,
publication timing, error mapping, and compatibility decisions.

## Testing

| Test | Result |
|---|---|
| Representative valid PDF and MP4 | PASS/FAIL |
| Malformed/active-content and codec cases | PASS/FAIL |
| Timeout/resource/processor failure and cleanup | PASS/FAIL |
| Upload and security-header regression | PASS/FAIL |
| `npm test` (including skips) | PASS/FAIL/SKIPPED |

## Verification

Explain how publication gating, output types, headers, route compatibility, and
deployment availability were verified.

## Remaining Risks

List parser limits, unsupported formats/features, deployment constraints, and
unresolved product decisions. State clearly if Finding 53 remains unresolved.

## Final Status

PASS / NEEDS REVIEW
```

## 18. Important Rules for the Implementing Agent

1. **Do not hallucinate.** Verify file paths, middleware callers, tools, dependencies, deployment configuration, test behavior, and content features from the repository and runtime environment. Mark unknown facts `TO INVESTIGATE`.
2. **Separate facts from recommendations.** Label the current structural checks as existing behavior and any parser/sanitizer/decoder as a proposed or implemented change, as appropriate.
3. **Preserve production behavior.** The application is in production; make a small, testable change and avoid broad rewrites or unapproved format/feature changes.
4. **Trace the entire path.** Follow upload field → route → middleware → processing → publication → persistence → static serving/client use.
5. **Treat deployment as part of correctness.** A processor that is absent, unbounded, or unmaintainable in production does not satisfy the finding.
6. **Be accurate about assurance.** No single parser or scan proves a file harmless in all consumers. Document which content is normalized/rejected and which residual risks remain.

## 19. Output Requirements

When executing this task, implement and verify the scoped change rather than merely restating the finding. Finish with the implementation report in Section 17. If a required product or deployment decision blocks safe implementation, stop before an irreversible behavior change and report `NEEDS REVIEW` with the precise decision required.
