# Draft: terminal session deletion with durable purge completion

Status: local draft for review; not submitted upstream.

## Problem

We are integrating EVE into an existing chat application with conversation deletion, public share links, forked conversations, uploaded files, and tool-created artifacts. We need to retire execution and erase conversation payloads without allowing retries or delayed callbacks to restore the conversation.

In the installed EVE 0.52.2 API, `ClientSession.cancel()` cooperatively cancels work, `clear()` removes model context, and `reset()` terminally retires a session. None advertises physical deletion. Calling reset and removing our application row would leave us without a supported purge contract or a reliable completion signal for erasure.

This is a requested capability, not a claim that reset violates its documented behavior.

## Evidence inspected

Source inspection against the installed EVE 0.52.2 package and its matching local source checkout:

- `src/client/session.ts`: public controls expose cancel, clear, compact, and reset; no delete/purge method.
- `src/execution/workflow-runtime.ts`, `dispatchWorkflowCommand`: reset waits for the session command hook to be released. The return describes retirement, not storage erasure.
- `src/execution/turn-control-receiver.ts`: reset forwards cancellation and buffers a reset control for the active turn.
- `src/execution/workflow-entry.ts`: a parked reset invokes session finalization.
- `src/execution/terminate-child-sessions-step.ts`: cleanup traverses known child handles and cancels indexed tasks; unaddressed starting children are explicitly skipped. This is relevant to defining a stronger deletion barrier, not proof of a reproducible leak.
- The installed `@workflow/world` Storage interface and `@workflow/world-postgres` public API do not expose a general run-payload purge operation.

These findings establish an API gap. We have not yet executed a storage-level erasure reproduction, and do not claim to have enumerated every retained storage object.

## Requested contract

A native, retryable deletion operation should provide:

1. An immediate, durable fence on the exact session identity. New sends, responses, task starts, forks from the session, and late delivery attempts must not recreate it.
2. An explicit retirement phase that waits for active tools/tasks and known child work to stop. In-flight child creation needs a defined handoff to the deletion operation.
3. A durable deletion receipt distinguishing accepted, retiring, purging, completed, and failed/retryable outcomes. A caller timeout must not imply cancellation of deletion or successful erasure.
4. Defined purge coverage for transcript events, workflow inputs/outputs, step results, streams, task records, hooks, sandbox state/snapshots, and continuation or idempotency payloads.
5. Storage-provider support with an explicit unsupported response where purge cannot be guaranteed. Avoid silently interpreting reset as deletion.
6. A minimal tombstone or equivalent fence that prevents resurrection after payload erasure, with documented retention and no original conversation text.
7. A documented boundary for application-owned artifacts, billing receipts, shared links, and independent conversation forks. The application must be able to retain minimal accounting records while deleting conversation content.

The exact API shape is open. A possible shape is an idempotent session deletion request returning an operation ID, with a separate status read. An application should not have to delete undocumented Workflow Postgres tables directly.

## Acceptance scenarios

- Delete a parked session twice; both requests converge on one completed deletion.
- Delete during a streaming tool and during child/task creation; delayed completions cannot restore content.
- Retry after a request timeout and after a worker restart; progress and final status remain recoverable.
- Attempt send/respond/fork with old session and operation identifiers after completion; content cannot be recreated.
- Inspect the supported World's storage for a unique marker from message, tool input, and tool output; those payloads are absent after purge completion.
- Verify the published policy for independent forks and shared sandbox/blob references; deleting one conversation must not corrupt surviving conversations.
- Preserve separately owned accounting totals without preserving transcript or tool payloads.

## Application integration boundary

ChatJS still needs its own deletion record and access fence to remove history visibility and revoke shares immediately, coordinate application-owned file/document cleanup, and preserve accounting. Those responsibilities do not require EVE to own ChatJS metadata. EVE should own retirement and purge of the transcript/execution data it persists.

We will use local Postgres for reproduction and implementation tests. No production data or legacy conversation migration is involved.
