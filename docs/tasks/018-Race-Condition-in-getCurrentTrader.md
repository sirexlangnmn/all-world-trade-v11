# 018 — Remove the `getCurrentTrader` Timing Race

| Field | Value |
|---|---|
| Document ID | `018` |
| Requested filename | `docs/tasks/018-Race-Condition-in-getCurrentTrader.md` |
| Source finding | `CODE_REVIEW.md` → Detailed Findings → **Finding 18: Race Condition in getCurrentTrader** |
| Primary implementation | `app/models/visitors-of-traders.model.js` → `Model.getCurrentTrader` |
| Affected endpoint | `POST /api/post/get-current-trader` |
| Priority | Correctness and reliability; no severity rating is assigned by the source finding |
| Task type | Focused asynchronous coordination fix and regression coverage |
| Production constraint | This is an active production workflow. Preserve the existing endpoint and successful response/session data behavior. |

> **Verification-first:** Inspect the checked-out implementation and tests before editing. The source finding records a fixed `setTimeout(1500)` workaround, but the implementation may have changed since that review. If the race is already resolved, do not reintroduce a duplicate fix; add or run focused regression coverage and report the evidence.

---

# 1. Task Title

**Remove the Timing Race in `getCurrentTrader` Without Changing Its Data Contract**

# 2. Objective

Ensure `Model.getCurrentTrader` waits for every database result needed by the current-trader session data before invoking its callback. Remove the arbitrary 1.5-second delay rather than relying on it to give independent title queries time to finish.

The completed change must:

- Return only after the required trader details and category-title lookups have settled successfully.
- Avoid delaying the response when those queries finish sooner than the former timer.
- Never return partially populated session data as a successful result.
- Preserve the endpoint, the normal callback response value, and the session fields consumed by the PDF-download workflow.
- Propagate database and unexpected failures through the existing controller error path.
- Include deterministic regression tests that do not depend on a real-time sleep.

# 3. Problem / Finding

## Finding details

`CODE_REVIEW.md` Finding 18 identifies `setTimeout(1500)` as a workaround for multiple callback-based SQL queries. The current reviewed implementation starts three independent category-title lookups and then starts the trader-details lookup after an arbitrary delay:

```js
fetchTitle('trade_categories', business_major_category, 'current_trader_major_category');
fetchTitle('sub_categories', business_sub_category, 'current_trader_sub_category');
fetchTitle('minor_sub_categories', business_minor_sub_category, 'current_trader_minor_sub_category');

setTimeout(() => {
    sql.query(USERS_BUSINESS.DETAILS, [trader_uuid], (err, res) => {
        // ...
    });
}, 1500);
```

The timer does not coordinate these operations. If a title query takes longer than 1.5 seconds, the request can finish before the title is added to `session.items`. If the queries finish sooner, the endpoint waits unnecessarily. Timing-dependent completion makes the response unreliable and adds avoidable latency.

## Related error-handling issue to verify

In the reviewed implementation, a failure in the initial characteristics query returns without invoking the callback. A category-title query logs an error but does not signal failure, and the trader-details error path calls `result(null, err)` even though the controller interprets the first callback argument as the error. These are directly coupled to coordinating the asynchronous work: the revised implementation must not leave the request pending or convert a query failure into a successful response.

Do not treat this task as a broad error-handling rewrite. Follow the established route/controller conventions and change only what is needed to make this operation complete or fail explicitly and exactly once.

## Severity and security

The source finding does not assign a severity. This is a correctness, reliability, and latency issue, not a documented security vulnerability. Do not invent a severity rating or expand the task into an unrelated security audit.

# 4. Affected Functionality

The API retrieves a selected trader’s business details and stores the related data in the visitor’s session. The trader data is subsequently used by the download workflow to build a PDF.

```text
Browser selection workflow
   ↓
POST /api/post/get-current-trader
   ↓
app/controllers/visitors-of-traders.controller.js
   ↓
Model.getCurrentTrader(parameters, callback)
   ├── characteristics query for trader UUID
   ├── title lookups for major, sub-, and minor-subcategory IDs
   └── trader-details query
   ↓
Populate req.session / callback with trader details
   ↓
POST response and later /download-current-trader-data PDF workflow
```

The exact browser-side call and any changes since this document was written must be confirmed before implementation.

# 5. Investigation Phase

Complete these checks before changing code:

1. Read the project’s `README.md`, `AGENTS.md`, and `CODE_REVIEW.md`. Pay particular attention to:
   - README sections on backend architecture, visitor-trader connections, API routes, data flow, error handling, and testing.
   - AGENTS.md’s legacy mysql2 versus Sequelize guidance, production-safety requirements, and test commands.
   - CODE_REVIEW.md Findings 18 and 34 and the review’s incremental-change principles.
2. Inspect the complete current implementation of `Model.getCurrentTrader` in `app/models/visitors-of-traders.model.js`. Verify whether the fixed timer, nested callbacks, or an existing Promise-based coordination mechanism remains.
3. Search the repository for:
   - `getCurrentTrader`
   - `/api/post/get-current-trader`
   - `current_trader_*` session fields
   - `current_trader_business_characteristics`
   - `session.items`
   - `/download-current-trader-data`
4. Read the controller in `app/controllers/visitors-of-traders.controller.js`. Confirm its callback error convention, HTTP status behavior, and returned success payload.
5. Read the route registration in `app/routes/index.js` and the browser-side caller in `public/assets/js/selection.js`. Preserve the route and client expectations.
6. Inspect `app/query/users_business_characteristics.query.js` and the relevant query constants in `app/query/users_business.query.js`. Confirm the SQL inputs, result fields, and whether lookups can return empty rows.
7. Inspect `app/src/server.js` around `/download-current-trader-data`. Confirm how it reads `session.items`, the trader detail object, category labels, and characteristics. Do not change the PDF generation workflow unless evidence shows a tightly coupled contract issue.
8. Inspect the existing Node.js `node:test` patterns under `test/` and determine a repository-consistent way to control or stub database callbacks. Do not add a test dependency when the existing test tools suffice.
9. Check whether a focused Finding 18 test or implementation has already been added on the current branch. Avoid duplicate tests and duplicate logic.
10. Check the worktree before editing and preserve unrelated user changes.

If a result shape, missing-row behavior, or error response cannot be established from the current code and tests, mark it **TO INVESTIGATE** and avoid guessing or changing the public contract.

# 6. File Impact Analysis

| File | Role | Action | Reason |
|---|---|---|---|
| `app/models/visitors-of-traders.model.js` | Legacy mysql2 model containing `Model.getCurrentTrader` | `MODIFY` only if the race or related callback error path remains | Coordinate dependent/parallel query completion and report errors without an arbitrary delay. |
| `app/controllers/visitors-of-traders.controller.js` | Passes request data to the model and maps callback errors to HTTP responses | `REFERENCE ONLY`; `MODIFY` only if required to align the established callback contract | Confirm that model failures reach the controller’s 500 path and successful payload remains unchanged. |
| `app/routes/index.js` | Registers `/api/post/get-current-trader` | `REFERENCE ONLY` | The existing endpoint and route wiring should remain unchanged. |
| `app/query/users_business_characteristics.query.js` | Defines the characteristics lookup | `REFERENCE ONLY` unless a verified query defect blocks this task | Establish required fields and query behavior; avoid unrelated SQL changes. |
| `app/query/users_business.query.js` | Defines the trader-details lookup | `REFERENCE ONLY` unless a verified query defect blocks this task | Establish the details result shape. |
| `public/assets/js/selection.js` | Calls the current-trader endpoint | `REFERENCE ONLY` | Confirm request and response expectations; do not change unrelated UI behavior. |
| `app/src/server.js` | Consumes session data in `/download-current-trader-data` | `REFERENCE ONLY` | Preserve the existing session shape required by PDF generation. |
| `test/018-get-current-trader.test.js` | Focused regression tests | `ADD` if no equivalent current test exists; otherwise `MODIFY` the existing focused test | Prove completion waits for database callbacks and errors do not hang or masquerade as success. |

Do not modify or create any other files unless investigation identifies a necessary, narrowly scoped dependency. Explain any additional file in the final report.

# 7. Current Implementation

## Facts recorded by Finding 18

The model initializes `session.items`, records `current_trader_date_created`, queries business characteristics, launches three title lookups, and schedules the trader-details query after 1,500 milliseconds. The title callbacks independently append results to the session. That means the timer is not a reliable completion signal.

The characteristics result supplies the major-, sub-, and minor-subcategory IDs. The three title lookups use fixed table names in the reviewed implementation; the ID is interpolated into their SQL string. If that lookup implementation remains, inspect its safety and prefer a bound value for the ID while keeping SQL identifiers restricted to fixed internal constants. Do not allow request-controlled values to become table or column names.

## Current-state verification

The implementation may have changed. The coding agent must inspect the checked-out source before treating the facts above as current. Record any difference between this description and the actual branch before deciding what to modify.

## Current callback behavior to verify

- The successful model callback currently receives the trader-details query result (`res`, generally a row array), while related category labels and characteristics are placed on the session.
- The controller expects an error-first callback: a truthy first argument produces an HTTP 500 response; otherwise it sends the second argument.
- Category labels are stored in `session.items` as objects keyed by `current_trader_major_category`, `current_trader_sub_category`, and `current_trader_minor_sub_category`. The trader details are also pushed into `session.items`.
- The download route searches `session.items` by these category-label keys and reads trader details and characteristics from named session properties.

Verify these contracts directly. Preserve them on success unless current tests or the caller prove a deliberate, documented change is required.

# 8. Current → Target

## Current

```text
Fetch characteristics
   ├── Start three title queries without awaiting them
   └── Start a 1.5-second timer
          ↓
      Fetch details when the timer expires
          ↓
      Respond even if title queries have not completed
```

## Target

```text
Fetch characteristics
   ↓
Start all required title lookups and the details lookup
   ↓
Wait for every required operation to succeed
   ├── On success: populate the expected session fields and invoke callback once
   └── On failure: propagate the error through the error-first callback once
```

Use the target behavior, not a prescribed architecture. A small Promise adapter around the existing mysql2 callback API may be sufficient; `Promise.all` is appropriate when every query is required for a valid result. If the current code has already migrated, follow its established async pattern. A Sequelize migration is not automatically required for this focused fix; avoid broad data-access migration or schema changes.

# 9. Detailed Implementation Plan

## Step 1 — Verify the live behavior

Inspect the current model, controller, route, browser call, PDF consumer, query constants, tests, and worktree. Determine which operations are required for a successful response and how missing rows are handled elsewhere in the same workflow.

## Step 2 — Define the callback and data contract

Before editing, document from source/tests:

- The exact successful callback payload.
- The session fields required by the PDF download route.
- How absent category IDs or empty title lookup results are represented.
- How missing characteristics or trader-detail rows should be handled.
- The controller’s expected error-first callback behavior.

Do not return a partial result as success. Do not introduce a new HTTP response shape without evidence and a compatibility justification.

## Step 3 — Coordinate asynchronous queries

Replace the fixed timeout with explicit completion tracking:

1. Preserve the characteristics lookup as the source of the category IDs.
2. Convert callback-based query operations into Promises or use an existing Promise-based helper.
3. Start independent title lookups together. Start the trader-details query at the earliest point allowed by the actual query dependencies.
4. Await all required results before mutating session data in a way that represents a completed fetch or invoking the success callback.
5. Remove the arbitrary `setTimeout(1500)`; do not replace it with a different fixed delay or polling loop.

If a category ID is optional, retain its existing null/empty behavior as verified from the consumers. If an ID exists but no title row is returned, handle it explicitly without dereferencing `res[0]`; determine the compatible behavior from current code and tests.

## Step 4 — Make failure completion explicit

- Ensure every database failure reaches the model callback as an error and does not leave the HTTP request pending.
- Use the controller’s error-first convention (`result(error, null)` for a model failure), not a success-shaped callback containing an error object.
- Ensure callback completion happens exactly once.
- Do not silently log-and-continue after a required lookup fails.
- Avoid broad catches or defaults that conceal a database or programming failure.
- If Promise rejections are used, catch them at the model boundary and report them through the callback, unless the model/controller contract is deliberately and consistently migrated together.

## Step 5 — Preserve success behavior

Populate the existing trader details, characteristics, creation date, category-label session properties, and `session.items` structure required by callers. Preserve the successful callback payload and endpoint. Avoid relying on title-query completion order; consumers should continue locating values by their existing keys.

## Step 6 — Add focused tests

Add or update Node.js `node:test` coverage using the project’s existing test style. Stub or control database callbacks so tests can prove ordering deterministically without sleeping. Cover successful completion, delayed callbacks, each query failure, optional/missing category values, and missing result rows as established during investigation.

## Step 7 — Review and validate

Review the entire diff, search again for the timer and all usages of `getCurrentTrader`, and run the focused test plus the smallest relevant test command. Check that the normal session/result shape and controller response are unchanged.

# 10. Architecture and Existing Patterns

- This feature currently resides in the legacy `app/controllers/` + `app/models/` mysql2 callback stack. AGENTS.md describes the legacy stack as frozen and directs new work toward Sequelize. This is a focused defect in an existing legacy path: do not expand it into a broad migration or introduce a second implementation unless investigation demonstrates that migration is necessary to fix the issue safely.
- Search for existing callback-to-Promise adapters, async model patterns, and `Promise.all` usage before adding a helper.
- Follow `node:test` patterns already present under `test/`. Do not add a new test framework or dependency.
- Keep database logic in the established model layer and HTTP response handling in the controller.
- Do not introduce a new architecture, abstraction, or dependency when an existing project pattern is suitable.

# 11. Security and Data-Safety Requirements

This finding is not itself a security vulnerability, but the model executes SQL and handles session data. While working in this code path:

- Do not interpolate request-controlled or database-derived values into SQL.
- If the title lookup SQL is retained, bind the category ID as a query parameter and constrain table identifiers to a fixed internal allowlist; SQL identifiers cannot be value-bound.
- Do not expose SQL statements, driver errors, or sensitive session data in the HTTP response or logs.
- Do not store partial or mismatched trader data in the session after a failed required lookup.
- Do not weaken existing route protections or alter authentication behavior.
- Do not turn database errors into a successful response, an empty trader record, or an indefinitely pending request.

Do not broaden this task into an audit of unrelated SQL or API authorization.

# 12. Backward Compatibility

Preserve:

- `POST /api/post/get-current-trader` and its request fields.
- The successful response payload expected by `public/assets/js/selection.js`.
- The session fields and `session.items` entries consumed by `/download-current-trader-data`.
- Existing PDF generation behavior and trader detail fields.
- Optional category behavior, once confirmed from current implementation and consumers.
- Existing controller-level error response conventions.

The intended behavior change is limited to removing timing-dependent or partial success and returning explicit errors for failed required queries. Do not change response schemas, request names, PDF fields, or unrelated visitor-trader workflows.

# 13. Testing Strategy

Use deterministic controlled callbacks/promises. Avoid tests that wait for 1.5 seconds or rely on fragile wall-clock thresholds.

### Normal Case

- Provide valid characteristics, all requested category titles, and trader details.
- Verify the model callback is invoked once with the same successful payload shape as before.
- Verify all expected session values are present before the callback is observed.
- Verify `session.items` contains the expected entries and consumers can locate each title by its key.

### Asynchronous Ordering

- Hold one or more category callbacks while completing the other queries.
- Verify the success callback has not fired while any required lookup is pending.
- Complete the held callback and verify the operation completes without a fixed delay.
- Vary callback completion order and verify the resulting data is stable.

### Optional and Missing Data

- Verify null/absent category IDs follow the established optional-field behavior.
- Verify an ID whose title query returns no row does not cause a `res[0]` dereference.
- Verify empty characteristics or details results are handled explicitly according to existing route semantics and do not produce a false successful trader result.

### Failure Cases

For each required query (characteristics, each applicable title lookup, and details):

- Simulate a database error.
- Verify the callback receives an error in the first argument exactly once.
- Verify no success response or incomplete trader data is reported.
- Verify the request does not remain pending.

### Regression

- Confirm the route remains registered at the existing path.
- Confirm controller success and error mapping remain compatible.
- Confirm the downstream PDF workflow still receives the expected session shape.
- Run the focused test and, where practical, `npm test`; report database-dependent skips separately.

# 14. Verification / Evidence

The implementation report must include evidence that:

- The fixed 1,500-millisecond timer is gone from the active `getCurrentTrader` path.
- Success cannot occur before all required database callbacks/results have completed.
- The callback is invoked exactly once on success and on failure.
- Database errors reach the controller’s error branch and do not become success-shaped data.
- Successful payload and session shapes remain compatible with the selection client and PDF-download route.
- Focused tests pass, including deterministic out-of-order/delayed query completion.
- A repository search finds no alternate active `getCurrentTrader` implementation still using a timer workaround.
- The final diff contains no unrelated changes.

Do not claim the issue is fixed based solely on removing `setTimeout`; prove that completion is now tied to query completion.

# 15. Do NOT Do

- Do not rewrite the visitor-trader workflow or migrate the whole legacy data-access layer.
- Do not change route names, request fields, successful response schemas, or PDF output without demonstrated necessity.
- Do not replace the timer with another arbitrary delay, polling, or a race-prone callback counter.
- Do not silently ignore required query errors or return partial data as success.
- Do not update session fields incrementally in a way that exposes an incomplete result as complete.
- Do not use a broad catch with an empty result or other success-shaped fallback.
- Do not add dependencies or a new test framework.
- Do not change database schema, unrelated endpoints, authentication, or UI behavior.
- Do not modify environment files, production data, or unrelated user changes.
- Do not remove or weaken tests to make the change pass.

# 16. Acceptance Criteria

- [ ] Current implementation and all relevant callers/consumers were inspected before editing.
- [ ] The active `getCurrentTrader` path no longer uses a fixed timeout to sequence database operations.
- [ ] All required lookup results are available before the success callback and completed session state are exposed.
- [ ] Callback-based database errors are propagated using the controller’s error-first convention.
- [ ] The callback is invoked exactly once and the HTTP request cannot hang on a required query error.
- [ ] Missing optional IDs and empty query results are handled without an unhandled property access or a false success.
- [ ] Existing successful endpoint response and session data contracts are preserved.
- [ ] Deterministic focused tests cover delayed/out-of-order callbacks and failure paths.
- [ ] Relevant tests pass; database-dependent skips or unverified runtime behavior are reported.
- [ ] No unrelated files or behavior were changed.
- [ ] The final diff and remaining risks were reviewed and documented.

# 17. Expected Final Report

Finish implementation with:

```markdown
# Implementation Report

## Summary

Briefly explain the race-condition fix or, if already fixed, the verification performed.

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

Explain how completion is coordinated, how failures are propagated, and how existing contracts were preserved.

## Testing

| Test | Result |
|---|---|
| Successful lookup and session shape | PASS/FAIL |
| Delayed/out-of-order lookup completion | PASS/FAIL |
| Database error propagation | PASS/FAIL |
| Missing/optional lookup results | PASS/FAIL |
| Regression suite | PASS/FAIL/SKIPPED |

## Verification

Provide evidence that completion waits for required operations and no fixed timer remains on the active path.

## Remaining Risks

List anything that could not be verified, including database/runtime limitations.

## Final Status

PASS / NEEDS REVIEW
```

# 18. Important Rules for Executing This Task

1. **Do not assume the review describes the current branch.** Inspect the implementation and tests first.
2. **Separate facts from recommendations.** Identify current behavior from source; label proposed behavior as the target.
3. **Preserve production behavior.** Keep the endpoint, response, session, and PDF workflow stable except for eliminating partial/timing-dependent completion and correctly surfacing failures.
4. **Follow the whole path.** Inspect browser request → route → controller → model → SQL results → session → PDF consumer.
5. **Prefer the smallest complete fix.** Use the established callback model and testing patterns unless evidence requires otherwise.
6. **Verify the fix, not just the code change.** Use tests that control query completion, not a sleep or a superficial source assertion alone.

# 19. Output Requirements

This file is the task guide for:

```text
docs/tasks/018-Race-Condition-in-getCurrentTrader.md
```

An implementing agent must make code changes only after completing the investigation phase and must end with the implementation report specified above. If the race is already fixed, it must avoid unnecessary production-code changes and provide test or inspection evidence instead.
