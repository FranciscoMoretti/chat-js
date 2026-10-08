# Prelaunch session retirement and recovery decision

Francisco explicitly accepted retiring old sessions on 8 October 2026 because ChatJS has not launched. Preserve readable history by default. Resuming 0.61 sessions under 0.71 or operating a dual-runtime router is no longer a launch requirement. This investigation does not select or mutate a live deployment/database.

## Scoped retirement procedure

The executable [procedure and disposable proof](../tests/eve-prelaunch-retirement/proof.ts) use the original production fork `@chat-js/eve@0.61.0-chatjs.0`, its native `session.reset()`, the existing PostgreSQL inventory/retirement markers and write fences. They neither delete native data nor rewrite workflow step identities. The application preflight still rejects any incompatible run left active.

For a separately selected deployment, use a maintenance window and one operator:

1. Stop new admission, guest cleanup, scheduled work and other mutating application jobs. Keep the original worker available to finish terminal reset. Explicitly select the database, authenticated owner/session roots and the complete set of sessions intended for cutover. Do not infer a target from a shell's existing environment.
2. Run read-only inventory first. Review exact roots, reachable descendants/activity collectors, statuses and owned stream IDs. Missing runs or ambiguous stream ownership stop the procedure. Include other active EVE roots before a whole-database package switch; a subset retirement does not authorize switching outstanding sessions.
3. Archive all selected snapshots, original events and stream payloads before the first reset. The proof writes an exclusive, mode-0600 JSON archive and a readable Markdown transcript in a mode-0700 directory. Keep its SHA-256 and target database address/name/port with the reviewed plan. Pending approval cards in the archive are historical records, not executable requests. Retain attachment/sandbox resources; this is not resource cleanup. If archive creation fails, do not reset: use a new archive directory and retain the partial files for diagnosis.
4. Recheck the archive hash, target and exact inventory immediately before apply. On the **original** runtime, terminally reset each exact root with reason `Prelaunch session retired`; never approve a pending request, send a new turn, clear history or create a replacement session. Wait for every inventoried descendant to become terminal. A changed run/stream inventory requires a new archive and review; unresolved descendants block completion.
5. Commit the existing native retirement marker and apply the existing run/stream/linked-queue write fences. Retire each matching submission's authority while retaining its immutable owner/operation/conversation binding and original command. Do not release or retarget old operation IDs. Native history, app conversation records and annotations remain present. No payload purge/deletion method is called.
6. Repeat apply after an interruption using the same verified plan. A loss immediately after reset retries the same terminal reset; after the durable marker, reset is skipped and remaining fencing/submission work is completed. Partial completion is not a cutover receipt. Verify no active incompatible runs remain, late approve/send cannot execute, all selected fences are present and archives are readable before stopping the old worker and switching packages.
7. Keep old history read-only. Never replay archived events as commands, import old approvals as new authority, or reopen retired submissions. The Markdown archive is independently readable; rendering old events with a new client remains a separate decoder concern. If the deployment keeps its existing conversation UI, make its terminal status visible before reopening traffic; this proof does not redesign that UI.

The research API is intentionally under `tests/`, not exposed as an automatic production command. It proves the staged procedure and fails closed on incomplete scope. Running the disposable proof below does **not** operate on existing application data.

```sh
bash tests/eve-retirement-postgres/cluster.sh start
bash tests/eve-retirement-postgres/setup-db.sh /absolute/new/connection.json lane_d
EVE_TEST_NODE=/opt/homebrew/opt/node@24/bin/node bun tests/eve-prelaunch-retirement/proof.ts /absolute/new/connection.json
```

Verified on disposable PostgreSQL 17.11: pending native approval plus its active collector; dry-run/archive leave the original nine events unchanged; terminal reset adds one terminal event; simulated loss after reset, retry and a repeated apply succeed; all reachable runs become terminal; late approval and send reject; an attempted run resurrection is fenced; zero tool effects. The incompatible-runtime preflight rejects before retirement and passes afterward on the fresh database. A changed archive digest is rejected before reset. The submission remains bound to its original command/conversation with retired authority; duplicate operation insertion is rejected. Evidence: `chatjs-eve-retirement-eEjFII/retirement-result.json`, its `archive/{archive.json,transcript.md}`, and `/tmp/e70d-oct8-retirement.log` on the investigation host. No existing user/live database was touched.

## Crash recovery findings

Crash recovery is a measured configuration/deployment question, **not an established upstream-only blocker**. Tests keep EVE 0.71.3 and AI SDK 7.0.106 fixed. Baseline uses the existing patched Postgres World beta.40 and Graphile 0.16.6. Candidate packages were resolved from the npm registry on 8 October and pinned in [the isolated experiment](../experiments/eve-postgres-recovery/package.json).

| Candidate | Measurement | Interpretation |
| --- | --- | --- |
| Current adapter, abrupt serving-process SIGKILL | New server starts; approval candidate does not reach settlement within 60 seconds | Reproduced the original queue-lock symptom. |
| Supported Graphile `minResetLockedInterval`/`maxResetLockedInterval` = 100 ms, 0.16.6 | 24 observed scans in 2.5 seconds, recently dead job remains locked | Scan frequency is not stale-lock age; not a recovery fix. |
| Graphile 0.18.0, same supported settings | 24 scans in 2.5 seconds, same locked job | Upgrade alone does not change this tested behavior. |
| Postgres World 5.0.2, bundled Graphile 0.16.6 | Needs its new Workflow migrations; after migration the full approval test still times out at 60 seconds | Startup schema compatibility and recovery are separate findings. |
| Supported `forceUnlockWorkers`, exact locally owned child termination | 102.8 ms on 0.16.6; 102.5 ms on 0.18.0 (earlier runs about 53 ms) in minimized queue test | Recovers the original queued job without re-enqueueing; one original effect observed. |
| Existing explicit operator recovery, full EVE candidate and settlement crashes | 4.21 seconds from first verified crash to settlement; 2.00 seconds from second crash to effect, including server startup | Original parsed arguments, connector, call/session identity; one observed effect; no approval resend. |

Graphile 0.18.0 migrates to schema revision 20 (breaking migration 19), which the current 0.16.6 worker correctly refuses. Lock ownership also changes from worker IDs to pool IDs: the proof records the actual `job.locked_by` provided by `job:start`, not an assumed identifier. The newer World schema fails ChatJS's existing lifecycle compatibility guard. No compatibility guard or adapter patch was bypassed in production; no dependency upgrade is recommended merely for this recovery symptom.

Primary sources: [Graphile configuration](https://worker.graphile.org/docs/config), [supported force-unlock API](https://worker.graphile.org/docs/admin-functions), [Worker releases](https://worker.graphile.org/releases), [Workflow Postgres queue source](https://github.com/vercel/workflow/blob/main/packages/world-postgres/src/queue.ts). Exact installed sources for both Graphile versions retain the four-hour SQL threshold in `dist/sql/resetLockedAt.js`; the locked experiment pins the candidate independently of mutable documentation.

## Smallest proven option and its boundary

Keep current dependencies. For a host that can own a queue worker as its child, the smallest demonstrated fast-recovery primitive is: record its exact lock-owner IDs at job start, observe the owned child's exit, and call the supported API for only those IDs. A paused (`SIGSTOP`) child remains live and is refused. A dead child's handle cannot authorize another child's lock ID, and an unregistered process handle is rejected. Replacement startup overlaps with a paused unrelated worker, whose job remains locked and later completes once. Ownership is keyed by the child-process object, not a reusable numeric PID. Shortened stale ages and blind SQL lock clearing are not used.

This is a local-supervisor proof, not a deployed distributed recovery service. A restarted supervisor lacking its ownership records must refuse intervention. Remote worker death, network partitions, host loss and escaped descendant processes cannot be established from a stale heartbeat or PID; require external process/container fencing before unlocking. A stopped event loop is not proof of death. The current World configuration does not expose its Graphile event emitter or worker ownership registry to the app, so promoting the proof needs a deliberate queue-process/ownership integration boundary. Do not automatically poll database locks and adopt them as locally owned.

Concrete deployment choice: retain bounded manual recovery for now, or introduce an explicitly supervised local queue process with lifecycle registration and exclusive process/container termination guarantees. For multi-host automatic recovery, define the platform's fencing contract first. [Graphile Worker Pro recovery](https://worker.graphile.org/docs/pro/recovery) is another documented option, but its heartbeat documentation explicitly notes the partition tradeoff; it was not installed/purchased or proven here. These two tested versions do not establish global impossibility or an upstream obligation.

Neither recovery test proves exactly-once external effects. A crash after an external effect but before durable completion can repeat that effect; these barriers are before the effect. Existing execution-time policy and exact human approval checks remain required.

## Final validation

Full root lint (including canonical registry parity), all seven workspace type tasks, explicit proof TypeScript checks, six existing compatibility tests, both queue-version proofs and the original-fork retirement proof pass. New lint exceptions are scoped to the local filesystem/process/SDK proof boundaries; no unsafe type waivers were added. Production EVE, Workflow and Graphile versions are unchanged. Disposable PostgreSQL data and logs are retained after stopping the investigation clusters.
