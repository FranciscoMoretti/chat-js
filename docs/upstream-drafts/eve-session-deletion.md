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

### Run inventory needs more than a root-attribute query

Further source inspection identifies an important boundary for a provider implementation:

| Record | Available relationship | Purge implication |
| --- | --- | --- |
| Top-level session | Its own run ID; `buildSessionAttributes` deliberately omits `$eve.root` | Include the session explicitly. |
| Turn | `buildTurnAttributes` supplies `$eve.parent` and `$eve.root`; `dispatch-turn-step.ts` passes them when starting the workflow | These attributes can help inventory descendants without reading every turn payload. |
| Delegated subagent | `buildSubagentRootAttributes` supplies immediate parent and root | Include nested descendants, subject to the retirement barrier. |
| Activity collector | `workflow-runtime.ts` starts it before the session, without explicit lineage attributes, and then places its ID in `WorkflowEntryInput.activityCollectorRunId` | A query using only EVE root attributes is insufficient; retain an explicit collector relationship before erasing the session input. |

Collector creation is conditional on a top-level session needing channel activity renderers. This is source evidence about that path, not a claim that every ChatJS session creates a collector. A failure between collector creation and durable session creation also needs a recovery policy; cancellation alone is not payload erasure.

The installed Postgres provider's `dist/drizzle/schema.js` stores run payloads in `workflow_runs`, plus separate `workflow_events`, `workflow_event_slots`, `workflow_steps`, `workflow_hooks`, `workflow_waits`, and `workflow_stream_chunks`. Stream chunks have a nullable `run_id`, so coverage must account for stream identity as well. This is a list of inspected tables, **not an exhaustive deletion recipe**: queue messages, late writes, sandbox storage, and external references still require investigation. Application code should not infer complete erasure from deleting these rows.

The next implementation boundary is a durable run/resource inventory owned by EVE and its provider. It must include collector relationships, survive retries, and prevent new descendants or writes after retirement. Only then can a provider report completed purge rather than merely successful row deletion.

Our local fork now adds `$eve.activity_collector` to the session's creation attributes when it starts a collector. The source patch and regression test are retained in `patches/eve-collector-inventory.source.patch`. This is an inventory aid for newly created sessions, not the requested purge implementation. It does not address earlier sessions or collectors orphaned before session creation succeeds. Normal writes in the inspected Postgres streamer persist the supplied run ID; the nullable column alone is not evidence that current EVE writes omit it.

Workflow's `runtime/start.js`, `resolveLineageAttributes`, also records `$parentRunId` and `$rootRunId` from the ambient step context. These relationships matter beyond EVE's own tags: our local retired chat fixture has a terminal session, a cancelled timeout run, and a completed turn linked by native Workflow metadata. The local read-only Postgres inventory adapter follows both native and EVE parent edges plus the collector reference, without returning payload columns. It reports active runs, missing referenced runs, and stream names containing chunks from outside the inventory or without run attribution. A repeatable-read snapshot makes those reads consistent, but does not prevent future writes or prove coverage of unlinked resources. It is not a purge receipt.

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
- Exercise an activity-rendering session and verify the collector's payloads are included, including recovery when session startup fails after collector creation.
- Verify stream coverage when a chunk has no run ID, and ensure delayed queue delivery cannot restore erased data.

## Application integration boundary

ChatJS still needs its own deletion record and access fence to remove history visibility and revoke shares immediately, coordinate application-owned file/document cleanup, and preserve accounting. Those responsibilities do not require EVE to own ChatJS metadata. EVE should own retirement and purge of the transcript/execution data it persists.

Local Postgres tests now exercise a provider extension in `apps/chat/lib/db/eve-resource-fence.ts`. It installs insert/update guards for the inspected run, event, step, hook, wait, event-slot, and stream tables. Writers hold shared locks on resource-ID records through commit; fencing updates those records and waits for admitted writers. Tests verify rejection of later writes and replay after fixture payload deletion, transaction rollback for active runs or ambiguous streams, and rejection from an older repeatable-read snapshot. The normal browser chat/retirement test also passes with these guards installed locally.

This extension is an explicit provider migration primitive, not automatically installed by an application request or application database migration. It adds a small registry row per observed run/stream identity and row-lock work to writes. It currently fences only the caller's known resource set: it does not establish a complete family inventory barrier, fence Graphile queue payloads, delete sandbox/blob data, or report completed erasure. Those remain integration requirements before enabling full conversation deletion.

The local session coordinator now closes the inventory-to-fence race for the reachable native graph in one READ COMMITTED transaction. It fences the root, reads and fences descendants/streams, and re-reads after waiting for their admitted writers until no new resources appear. Active runs, missing references, ambiguous streams, or failure to stabilize roll back the transaction. A local concurrency test verifies that a collector child and its stream committed while the collector fence waits are included on the next pass. This still does not prove coverage of unlinked resources, queues, sandboxes, or blobs.

The installed provider's `message.js` and `queue.js` encode Graphile message bodies as base64 JSON. `WorkflowInvokePayloadSchema.runInput.attributes` can identify a queued child before its run row exists. Our local queue inventory decodes that envelope inside Postgres, scopes it to the explicitly configured task identifier, and returns job/run IDs, lock status, and unsupported-job IDs. Tests cover those queued children, unrelated jobs, health probes, locks, and invalid encoding. No queue payload contents are returned to the application. This remains a snapshot: enqueue fencing and transactional removal are still needed. Graphile's `complete_jobs` removes eligible jobs and returns fewer rows when some cannot be removed; its age-based lock eligibility is not proof that a worker has stopped, so cleanup must explicitly handle live locks rather than blindly treating completion as erasure.

All reproduction and implementation tests use local Postgres. No production data or legacy conversation migration is involved.
