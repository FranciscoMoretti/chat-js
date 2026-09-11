# Draft: PostgreSQL queue serialization delays workflow cancellation

Unpublished draft for Workflow DevKit review. Reproduced with `@workflow/world-postgres@5.0.0-beta.40` and EVE 0.52.2. The installed adapter was byte-for-byte identical to its published npm tarball before the experiment.

## Problem

The PostgreSQL queue adapter serializes deliveries without an idempotency key by workflow run ID through `inflightWorkflowRuns`. If the first invocation eagerly waits for a pending step, a later hook/cancellation delivery for that same workflow waits behind it. The signal needed to end the step cannot reach it promptly.

In ChatJS, a local HTTP MCP server held a `tools/call` response open. Stop received HTTP 202, but the MCP request stayed open and the UI remained busy throughout a 20-second observation window. A diagnostic listener did not receive the tool AbortSignal. When the test released the provider call during cleanup, native history eventually recorded `turn.cancelled`.

A separate test of the real ChatJS MCP client with an ordinary AbortController closed its HTTP request in 173 ms. Temporarily disabling only per-workflow serialization made the browser cancellation, next message, and reload assertions pass. This isolates the delay from the MCP transport.

## Proposed change

Remove run-wide serialization for distinct deliveries. Preserve existing in-flight and completed-message deduplication for exact idempotency keys. A later workflow invocation must be able to process a cancellation or other wake-up while an earlier invocation is still waiting on step work. No transcript or cancellation store is added.

The maintained Bun patch is `patches/workflow-world-postgres@5.0.0-beta.40.patch`. Before contributing upstream, review concurrent replay/event-log conflict handling in the adapter/core contract; this draft does not claim exhaustive concurrency coverage.

## Reproduction and validation

- `apps/chat/tests/eve-queue-cancellation.e2e.ts` uses real local PostgreSQL, Graphile Worker, and HTTP delivery with an isolated task prefix. It holds the first delivery open, requires a second delivery for the same run to reach the executor before releasing the first, then verifies in-flight and completed exact duplicates remain suppressed.
- `apps/chat/tests/eve-mcp.e2e.ts` holds a real MCP call pending, attaches the browser to the native conversation, presses Stop, verifies transport disconnection, sends another message, and checks reload persistence.
- The same file checks direct client cancellation and ordinary execution/removal/reload/public sharing.

A separate ChatJS defect rejected the attached client's empty cancellation body with HTTP 400. The gateway now permits an omitted `turnId`, matching EVE's active-turn cancellation protocol, while preserving strict fields, owner authorization, and same-origin checks.

All database testing uses local PostgreSQL. Do not publish this draft before user review.
