# Preserved approved callback binding — 7 October 2026

This is a bounded experimental derivative of published EVE 0.71.3 (`fab8ba1424eddfdedd6a177cac21710258da0e81`). No production adapter, manifest or lockfile was changed; nothing was published upstream.

## Local proof

The source runner passes two stock counterexamples, 26 patched tests (one optional checkpoint skipped), and its three separate checkpoint processes. Both stock and patched published-runtime runs pass ten assertions groups. Only the patched runtime supplies exact consent; stock produces no gated effects. Patched mode produces five authorized effects. Original parsed input, captured message history, connector callback and output projection survive pending approval replay; the next call uses fresh discovery/schema and a distinct approval. Current owner/enabled revocation and cancellation produce no new effects.

Evidence retained:

- Stock: `/var/folders/yh/gd_w4qx53yd7j9z0lypwzsk00000gn/T/lane-b-workflow-9yIIsO/proof-results.json`.
- Patched: `/var/folders/yh/gd_w4qx53yd7j9z0lypwzsk00000gn/T/lane-b-workflow-BjYPHJ/proof-results.json`.
- Frozen installation: `/var/folders/yh/gd_w4qx53yd7j9z0lypwzsk00000gn/T/lane-b-released.4WTLxl`.
- Source suite: `/var/folders/yh/gd_w4qx53yd7j9z0lypwzsk00000gn/T/chatjs-approval-proof.K7BPSE/eve`.

## PostgreSQL boundary

D provisioned the dedicated `lane_b` database in disposable PostgreSQL 17.11, using actual ChatJS migrations, Workflow schema and resource/queue fences. Runtime uses bundled Workflow 5.0.1 and the existing patched `@workflow/world-postgres@5.0.0-beta.40`. D helper baseline is `d94afdb5f` atop `c7137b0c5`; the first abrupt helper was uncommitted and changing during investigation. No other lane database was used or reset.

The default CLI-stop run (`chatjs-eve-retirement-UazyNu`) passes pending approval restart, captured-message drift, replacement connector/schema, fresh next-call consent, current owner/enabled revocation and cancellation. It records three authorized effects. It then times out awaiting candidate settlement after restart. CLI termination allows graceful detached-server shutdown and can reject the in-flight response candidate; this is not evidence that an accepted settlement was lost.

The first explicit serving-process crash attempt (`chatjs-eve-retirement-XjmDUO`) stops inside the candidate authorizer but the shared helper times out during cleanup before starting worker 2. The stale URL file remains. This is a harness blocker, not an EVE recovery result. No duplicate abrupt attempts are made while D repairs the helper. No rows were cleared and no approval resent.

### Corrected abrupt controller

With D commit `49385ae69`, fixture `chatjs-eve-retirement-Q51iyE` successfully kills its verified serving process (PID 56704), completes cleanup, and starts worker 2. Candidate run `wrun_01M4BYHD74GTACV1AEPAED94DB` remains `running` with no executor entry in the observation window. Graphile job 207 (`msg_01M4BYHD9Y0TE2TX1S4RZ3S207`) remains locked by dead worker `worker-178b0438beec8dec0f`; its payload identifies the same run. D reports the pinned Graphile 0.16.6 stale-lock threshold is four hours. No lock was aged, cleared or forcibly unlocked by B. The run used a 60-second candidate observation; the saved driver now uses 15 seconds for this known PostgreSQL condition.

This establishes a queue-recovery limitation under the pinned configuration, not loss of a settled receipt. The later executor-entry crash boundary is not reached on this baseline. D owns a separate supported operator-recovery proof; results with an explicit unlock must not be labeled automatic recovery.

## Production-fork old-run switch

`runtime-old-run.ts` seeds one completed conversation turn (the session remains active) and one pending tool approval under `@chat-js/eve@0.61.0-chatjs.0` / `3a7acfe6`. It stops the idle runtime, switches only the isolated overlay's EVE package to the experimental 0.71.3, and starts against the same database and retained `.eve` directory. It does not clear data or manufacture a new approval.

Evidence: `/var/folders/yh/gd_w4qx53yd7j9z0lypwzsk00000gn/T/chatjs-eve-retirement-SFELAn`. `old-seed.json`, `package-switch.json`, `history-decoded.json`, `old-run-results.json` and `worker-2.log` retain the sequence.

Historical stream decoding **passes**: all 13 events are identical. Active continuation **fails before receipt execution**. Pending session `wrun_01M4BYAQWG237CP3YPTFY8HYT9` returns `session_not_active`; PostgreSQL records `failed / CORRUPTED_EVENT_LOG`. The previous completed-turn session is likewise failed on startup recovery. The runtime reports:

```text
step event step_created ... belongs to "step//eve@0.61.0//createSessionStep",
but the current step consumer is "step//eve@0.71.3//createSessionStep"
```

Three automatic recovery replays do not repair this versioned step identity mismatch; the fourth divergence terminates the run. Decodable history is therefore not migration compatibility. Keeping original compiled files on disk does not make the new package execute the old step identity. A supported routing/drain/migration strategy is required before switching active production runs; relabeling durable events is not validated or proposed here.

### Root cause and supported boundary

The first divergent persisted record is `evnt_00000000000000000000000004`, type `step_created`, correlation `step_01M4BYAQWG4ZQT0KVNVWENNGA8`; the run is named `workflow//eve//workflowEntry`, protocol/spec version 7, deployment ID `postgres`. The pinned compiler explicitly keeps step IDs version-stamped as per-deployment identifiers (`packages/eve/src/internal/workflow-bundle/workflow-transformer.ts:129,690`); only selected workflow names are stable across releases. The patched Postgres world's `dist/queue.js:77` returns the constant deployment ID `postgres`. This is an expected code-version replay incompatibility when replacing the package beneath an existing run, not a changed authored tool name or missing fixture file. The failure occurs at framework session creation, before dynamic callback restoration and before the experimental receipt path.

Pinned primary contracts: `docs/concepts/execution-model-and-durability.mdx:24–32` and `packages/eve/src/execution/session/checkpoint-migrations.ts:5–9` in EVE `fab8ba1424eddfdedd6a177cac21710258da0e81`. Deployment-aware handoff is described for Vercel, accepts idle checkpoints from EVE 0.66+, and excludes pending input/authorization or active work. The 0.61 seed falls outside that supported checkpoint range. The separate legacy-driver import described later explicitly abandons pending work and is not a lossless answer for this approval continuation.

The smallest safe integration decision is to retain the old executor for its existing sessions until a supported routing/retirement plan exists. Merely finishing the current tool call does not retire its long-lived session workflow. D owns the routing/drain/migration design; this experiment neither implements it nor substitutes new sessions for failed ones.

## Repository validation

- `bun test:types`: seven tasks pass (cached).
- Retained MCP adapter unit tests: 29 pass.
- `bun lint`: same seven baseline `typescript/no-unsafe-*` errors in `scripts/vercel-preview-build.ts:127–137`; earlier lint stages pass.

The receipt API still needs upstream acceptance and a supported release. The old-run incompatibility independently blocks production replacement. Keep the existing adapter and live authorization checks.
