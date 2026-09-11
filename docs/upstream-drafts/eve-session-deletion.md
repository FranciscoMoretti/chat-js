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

The local queue extension now guards enqueue and payload/task replacement for explicitly registered Workflow task identifiers. It checks both old and new run associations, including resilient creation attributes, through the same resource fence. Workers may still update bookkeeping when the stored payload text is unchanged. Queue cleanup requires installed fences, discovers queued descendants to a fixed point, rechecks worker ownership under row locks, and uses Graphile's completion function only for unlocked jobs. Discovered run IDs are persisted atomically with removal so retries do not lose their association after queued content disappears. Tests verify nested queued children, unrelated-job preservation, repeat cleanup, protected payload replacement, and refusal to remove even an old worker lock. The local browser chat/retirement flow passes with the queue guard enabled. Unlinked resources, sandbox/blob cleanup, and application completion coordination remain separate work; this is not full session-erasure evidence.

The local native-payload primitive now requires terminal, unambiguous run/stream inventory, all corresponding write fences, and an empty registered queue. It includes run identities retained by queue cleanup and deletes the inspected native payload tables in one transaction with an identity-only retry receipt. Local database tests verify unrelated-session isolation, queue-clearance enforcement, late-write rejection, and retries after the root row is gone. The browser retirement test now also exercises native deletion and retries while checking that settled credits stay unchanged. This is still an internal provider primitive, not a complete application deletion endpoint or proof of sandbox/blob and unlinked-resource erasure.

The local native cleanup coordinator now serializes attempts per session and commits a retirement receipt before fencing. Retries resume without resetting a fenced or erased session. Queue-discovered identities feed back into graph and stream fencing; newly discovered descendants trigger another queue pass. Local tests cover failed retirement, downstream failure, concurrent attempts, detached streams, and retries after payload erasure. A browser test verifies the real retirement-to-purge path and unchanged settled credits on retry. Application authorization, document/file cleanup, sandbox coverage, and final deletion status still need the full application coordinator.

## Sandbox deletion evidence and integration order

Inspected the local EVE 0.52.2 source and ChatJS fork patches. These findings are source evidence; they are not a completed sandbox-erasure test.

- `execution/sandbox/ensure.ts` lazily creates or reattaches the sandbox. Its `delete` method calls `getHandle()` before deleting, so invoking it without an initialized handle can provision or restore a sandbox. Cleanup needs a resource-based operation that does not create resources merely to remove them.
- `execution/sandbox/bindings/microsandbox-runtime.ts` explicitly preserves the stopped VM during `shutdown` for later reconnect. Process shutdown is not sandbox erasure.
- `microsandbox-lifecycle.ts` implements handle deletion with `shutdown` followed by `removePersisted`. `removePersisted` removes the live VM and the current `stateSnapshotName`; session metadata records those identities and the options hash.
- ChatJS's **local fork-checkpoint extension** creates separate `eve-sbx-fork-*` snapshots in `captureForkCheckpoint`. They are not listed in the session metadata interface or removed by `removePersisted`. This checkpoint-retention gap belongs to our extension; do not report it as an unmodified upstream EVE defect.
- Fork restore can depend on a source checkpoint. Removing it when only the source is retired would be unsafe. ChatJS deletes the whole conversation family, so cleanup must first retire every member and preserve the complete set of checkpoint identities.

The application coordinator must inventory sandbox resources **before** calling native payload purge: the state carrying resource identities may otherwise disappear. Preserve a durable manifest of owned VM, state-snapshot, and fork-checkpoint identities; then fence/retire the family, remove those resources with retry-safe provider operations, and only mark application deletion complete after provider confirmation. Shared bootstrap templates are outside the family manifest and must remain intact. Missing or ambiguous ownership must leave deletion pending rather than trigger global sandbox or snapshot pruning.

The local fork now records each checkpoint identity in a private JSON file alongside sandbox metadata before provider lookup or creation. Atomic rename prevents partial records, retries use the same identity, and failed capture retains the record. These local records are not a remote durable manifest or coverage for older snapshots. Next implementation: provide deletion by recorded provider identity without restoring a VM, and test restart/retry plus an unrelated surviving family's sandbox. The existing native-payload coordinator remains an internal stage and must not be treated as the complete deletion endpoint.

The local-provider cleanup helper now validates session metadata and every published fork manifest before any provider action. It removes the recorded VM by provider handle, then its current state snapshot and recorded fork snapshots without forced deletion. Recognized missing-resource responses make retries idempotent; other errors leave cleanup pending and identity records intact. A local acceptance test creates an isolated real VM, state/fork snapshots, and an unrelated snapshot, verifies removal and retry, and confirms the unrelated snapshot survives. Full-family ordering, application authorization, old-resource discovery, and remote durable inventory remain integration requirements.

Local sandbox cleanup now accepts the whole family inventory, validates every member before provider actions, and removes all recorded VMs before processing snapshots. Non-forced snapshot removal proceeds in passes so recorded children can be removed before blocked parents; a pass with no progress returns the provider failures instead of looping indefinitely. A real-provider test restores a child VM from a parent fork snapshot, captures child state, removes both members, retries, and verifies an unrelated snapshot survives. Family membership discovery and application-level retirement authorization remain the coordinator's responsibility.

The maintained local fork now also writes immutable VM and state-snapshot identities before provider creation, including VM restore and network-policy replacement. Those records are separate from the latest reconnect metadata, so replacement does not lose old identities and a failed final metadata write does not hide a newly created resource. Cleanup validates and retains these records, deduplicates their identities, and removes all recorded VMs before snapshots. Fork manifests are scoped by session and immutable snapshot identity; a later configuration hash must not hide earlier checkpoints belonging to that same session.

A real EVE-backend acceptance test captures a checkpoint, edits the parent's file, restores a child with the original file contents, captures state snapshots, removes the child's reconnect metadata, and verifies cleanup of both VMs and all recorded snapshots plus retry. Source tests verify that a failed resource-record write prevents VM creation and that a failed provider snapshot capture retains its identity. These tests use isolated local VM resources and no database. This closes the inspected local creation-before-record gap for new session resources; it does not recover older unrecorded resources, establish application family membership, or provide remote durable inventory.

Before calling the local microsandbox backend, the fork now publishes an immutable `owner.json` containing the original native session ID and sandbox key. Publishing a complete record without replacement rejects a different owner before provider access, including key collisions caused by sanitization. ChatJS's local inventory reader selects exact native session IDs across sandbox versions and reports missing, malformed, mismatched, or symlinked entries separately. The coordinator still needs the authorized native family, an inventory barrier, and a policy for older unattributed directories; the reader alone is not proof of complete resource coverage.

The local fork now guards resource-changing backend operations with admission records under a native-session scope. An operation publishes its record before checking the permanent deletion marker and retains it through the awaited provider call. Deletion publishes markers for every member before checking for outstanding operations, preventing new sandbox versions from bypassing the family barrier. VM creation/reconnection, checkpoint and state capture, and network-policy replacement participate. Temporary bootstrap resources remain outside session cleanup.

Tests cover an admitted operation surviving the fence until completion, rejection of later work, whole-family marking before pending-work checks, and real-backend refusal to reopen or capture a new checkpoint after fencing. Records are never expired by age: a process loss can leave an unresolved admission, and safe reconciliation of that state is still required before the complete deletion coordinator is enabled. This mechanism is local-filesystem coordination, not a remote-provider deletion protocol.

The internal local-resource coordinator now composes family retirement, native preparation, the local mutation fence, sandbox inventory/removal, document erasure, and file-reference cleanup. It retains native history and the application's `deleting` state so external tool resources can be accounted for before final completion. In particular, ChatJS's code-execution tool creates a separate Vercel sandbox; that resource path is not covered by the local EVE sandbox inventory.

For older local directories without ownership records, the reader uses the pinned key format only to exclude a canonical, unrelated native ULID under the current app's realpath-derived scope. It never uses a key to authorize erasure. Possible family members, malformed ownership, truncated IDs, and unknown scopes remain unresolved. The browser acceptance test runs the composed cleanup through Bun against the actual app root and local Postgres, verifies document removal and retry, and checks that the native run and pending deletion state remain until later erasure.
