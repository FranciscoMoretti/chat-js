# Lane B/D restart comparison and binding recommendation

Compared Lane B `19a4035fb` with Lane D `422e371e3` on EVE 0.71.3 / `fab8ba1424eddfdedd6a177cac21710258da0e81`. This is a source/evidence comparison, not a new runtime reproduction. The experimental patch and production adapter remain unchanged.

## The restart results are not equivalent

| Boundary/control | Lane B | Lane D `--callbacks` |
| --- | --- | --- |
| Before settlement | Pauses inside response policy after candidate ingestion, crashes, releases and resumes without resending. | Also pauses inside response policy, crashes, releases and resumes. These are comparable logical boundaries. |
| Later crash | In a separate scenario/session, pauses inside the executor **after receipt construction**, before the effect. | On the same approval, crashes again **inside the `approval.settled` hook**, before executor entry. B does not cover this hook boundary or D's two-crash sequence. |
| Workflow ownership lease | Explicit `WORKFLOW_INLINE_OWNERSHIP_LEASE_SECONDS=1`. | Fixture environment omits the override. Bundled Workflow 5.0.1 defaults to **860 seconds (14m20s)**. |
| Process termination | SIGKILL to the CLI PID; waits for `.eve/dev-server-state.v1.json` removal. Not an explicit process-group kill. | Detached worker; SIGKILL to the whole process group. This is a stronger process-tree interruption. |
| Restart | First start is fresh; subsequent starts use `eve dev --resume` with the same fixture/world storage. New loopback port and fresh client handles. | Every start uses `--resume`, same storage and fixed port; waits for HTTP health. |
| Recovery observation | Read-only polling; 60 seconds for most boundaries, 90 seconds for executor replay; 180-second overall watchdog per mode. | Effect marker absent after 60 seconds; native settlement readable and persisted `turnStep` still `running`. |

B also runs two distributions: stock replay is asserted to reach the callback but its receipt gate blocks the effect; effect-positive replay is asserted only for the experimental patch. D expects its native approved tool to perform the effect on stock EVE. These success criteria must stay distinct.

The lease difference is a concrete confounder: the bundled runtime documents that a non-owner replay within the lease can defer the step backstop for the remaining lease. A 60-second window is shorter than D's default lease. That is **consistent with delayed recovery, not a demonstrated diagnosis** of D's failure. B's accelerated-lease success establishes neither default-lease recovery latency nor recovery from a full process-group crash. No new run normalized these controls in this note.

The hook boundary also matters independently. In released `harness/tool-loop.ts`, the runtime awaits emission of `approval.settled` before marking its audit record's event as emitted. A hook can therefore be paused while that runtime path remains incomplete. A readable stream event establishes neither completion of the hook nor commitment of the enclosing Workflow step. B's executor-entry barrier is later: its callback has already received the reconstructed receipt. Passing that test cannot establish recovery of D's earlier hook interruption.

**Handoff:** retain D's failing acceptance result as unresolved. A bounded comparison would hold lease, process-group termination and port/client behavior constant and test each crash point separately before the combined sequence. Do not clear Workflow records, alter step status, resend approval or infer permanent loss from the current timeout. D owns that controller comparison; this note does not expand Lane B's implementation.

Evidence read: D's `fixture.ts`, `persistent-runtime.ts`, `restart.ts`, `restart-fixture/control.ts`, `restart-fixture/agent/hooks/settlement.ts` and `RESTART.md`; B's committed `runtime-fixture.patch`; EVE's pinned `harness/tool-loop.ts`; the published package's `dist/src/compiled/@workflow/core/runtime/constants.d.ts` and compiled `getInlineOwnershipLeaseSeconds` implementation (default 860, override clamped to 1–900 seconds).

## Recommend preserving the approved callback binding

For upstream, prefer **resuming the persisted approved callback binding** over inventing a separate stable-action-identity API. At approval request time, the runtime already has the resolved dynamic callback descriptor/closure, scope, resolver/entry identity, schema and parsed action. Keep that binding with the pending execution. Approval replay should execute that binding; subsequent `step.started` discovery can supply tools for new calls, but must not substitute a same-named callback for the already approved call. The receipt still comes only from the winning authenticated settlement for that continuation.

This preserves availability when rediscovery changes incidental captured data: the approved action can resume without comparing its entire old closure to a freshly generated closure. In ChatJS, `apps/chat/agent/tools/mcp.ts` captures `messages = stringify(context.messages)` and later passes `parse(messages)` into execution, in addition to `connectorId` and `remoteName`. Model history can change during approval handling while connector and remote action identity remain the same. Full metadata equality conservatively invalidates that consent too. Schema/descriptive metadata changes can also cause rejection even when the intended effect is unchanged. The current experiment intentionally fails closed in these cases; it is not an availability-complete MCP replacement.

The tradeoff is explicit: preserving a binding executes with the captured invocation data, including its historical message argument. That is the action whose approval was requested. It must **not** freeze current authorization: the private ChatJS executor still reloads connector ownership, enabled state and `requireApproval` immediately before the effect, and checks cancellation. If the callback cannot be restored on a new deployment, or its schema/code is incompatible, fail closed and request fresh approval; never silently rebind by display name.

A runtime-issued stable action identity is a fallback if upstream cannot preserve callback bindings. It would need to identify the exact executable action across reconstruction without letting application code exclude authority-bearing closure fields. It also needs a rule for when changed callback data requires a new identity and consent. That is a larger semantic contract than a receipt, and a stable token alone must not authorize a replacement connector or different code. Prefer binding preservation first; leave cross-deployment compatibility an explicit gate.
