# App-owned branching and snapshot prototype

Investigated 2026-09-18. Unpublished, isolated experiment based on ChatJS `525e4e2c13eb4961f3c00b846241f7277285993b`, on `codex/app-owned-branch-prototype`. No production behavior changed. No model calls, remote databases, provider allocations, deployment, or source-worktree mutations.

## Verdict

**Shared immutable prefixes and app/provider-owned resource checkpoints work as a data model. Pristine EVE does not yet offer the public history contracts needed to substitute this model for the current fork implementation without behavioral changes.** Full Workflow execution cloning is not inherently required for a settled conversational branch. A bounded conversation-history continuation contract plus a coordinated resource boundary is a smaller target.

Public callbacks do expose structured model history. If the app already holds an authorized, valid selected history, the smallest missing execution capability is a validated, idempotent **structured seed write**. Arbitrary historical selection without another app transcript additionally needs native prefix addressability.

Do not replace native checkpoints with a display-event reconstruction pipeline. Do not call serialized conversation text in `clientContext` or instructions an equivalent import. The prototype deliberately does neither. It proves the app-side state machine, not a working unpatched EVE integration.

There are two distinct architectures:

1. **Recommended incremental direction: native transcript authority, app prefix references.** App branch records refer to immutable native prefix identities and retain app annotations/resource manifests. EVE resolves a selected native prefix and initializes fresh execution. App does not persist another transcript. EVE may internally copy model history; app references do not eliminate that copying.
2. **Larger alternative: app transcript authority.** Immutable app nodes become the canonical conversation history, with EVE only an execution engine. This prototype demonstrates the node structure. Adopting it requires a supported history-store/turn-execution boundary and authoritative output commits, or replacing more orchestration with an app-owned loop. Mirroring EVE events into these nodes while retaining EVE's mutable transcript authority would introduce a second synchronized transcript. That is not the proposed migration.

## Exact inspected inputs

| Input | Exact identity | What was inspected |
| --- | --- | --- |
| Pristine pinned source | `eve@0.52.2`, `247b3f05244893170bcf4dbcf20a2e35e416ccee` | Client, hooks/event emission, public definitions, sandbox backend, workflow authoring |
| Pristine pinned npm artifact | `eve@0.52.2`; tarball SHA-1 `80bd73c5545f04800707333ea50835d83b330499` | Published declarations/package exports, separately unpacked |
| Latest registry release at this check | `eve@0.59.1`, tag `a59a8f4f811520d44fcdbb26e7ed33d3b859b99b`; tarball SHA-1 `eac5a41d0526118f14ea3fe00e1230402e7308f6` | Published client/backend declarations, source contract comparison |
| Live upstream HEAD at this check | `da82a953dc62fcce8a3684e4eed7a8b693b0941d` | Client/server creation, hooks, backend, workflow docs, public definitions |
| Installed ChatJS dependency | Patched `eve@0.52.2` after this worktree's own `bun install --frozen-lockfile` | Compiled patch reverse-check passed; maintained source patch/docs inspected separately |
| Installed provider SDK | `@vercel/sandbox@3.3.0` | `dist/sandbox.d.ts`, `dist/session.js`, snapshot lifecycle and creation options |

The prior audit compared 0.58.1 and an earlier main SHA. This investigation refreshed release/main discovery; it does not assume those earlier refs are current. Registry metadata: [0.52.2](https://registry.npmjs.org/eve/0.52.2), [0.59.1](https://registry.npmjs.org/eve/0.59.1). Release tags and published packages were inspected independently; main availability is not release evidence.

## Public EVE contracts, versus the installed patch

- Pinned client creation requires an initial user message. Current released/source client adds an idle `sessions.create(options?)`, but `CreateSessionOptions` contains request signal/headers, not structured history. The current server also rejects client context on message-free creation. See [pinned client](https://github.com/vercel/eve/blob/247b3f05244893170bcf4dbcf20a2e35e416ccee/packages/eve/src/client/sessions.ts), [released client types](https://github.com/vercel/eve/blob/a59a8f4f811520d44fcdbb26e7ed33d3b859b99b/packages/eve/src/client/types.ts), [current create parser](https://github.com/vercel/eve/blob/da82a953dc62fcce8a3684e4eed7a8b693b0941d/packages/eve/src/eve-channel/create-request.ts).
- `clientContext` is ephemeral per-turn context. It renders strings/objects as user context and does not become durable history. It cannot represent a native assistant/tool transcript or populate retained display history. [Public contract](https://github.com/vercel/eve/blob/da82a953dc62fcce8a3684e4eed7a8b693b0941d/packages/eve/src/client/types.ts).
- Current `defineInstructions` accepts text (`content`, or deprecated `markdown`), with system/user role selection. This is not an assistant/tool/file history initializer. Hooks are observe-only and do not inject model messages. [Instructions definition](https://github.com/vercel/eve/blob/da82a953dc62fcce8a3684e4eed7a8b693b0941d/packages/eve/src/shared/instructions-definition.ts), [hook definition](https://github.com/vercel/eve/blob/da82a953dc62fcce8a3684e4eed7a8b693b0941d/packages/eve/src/public/definitions/hook.ts).
- Public `MemoryOperationContext.messages` and `DynamicResolveContext.messages` expose structured `ModelMessage[]` at callback boundaries. Memory recall returns text records, not a role-preserving transcript. Immutable callback captures can avoid a second mutable transcript, but still duplicate native history bytes and need stable message/boundary mapping across compaction. Completion memory-capture errors are caught/logged, so readiness must come from the app's durable receipt. [Memory API](https://github.com/vercel/eve/blob/da82a953dc62fcce8a3684e4eed7a8b693b0941d/packages/eve/src/public/memory/index.ts), [capture error handling](https://github.com/vercel/eve/blob/da82a953dc62fcce8a3684e4eed7a8b693b0941d/packages/eve/src/context/memory-event-lifecycle.ts). The [independent cross-check](eve-branching-contract-crosscheck.md) records this alternative and its limits.
- Public snapshot/stream readers provide native events and display state; no supported selected-prefix import/export preserving the complete model continuation contract was found in the inspected public client/channel surfaces. In particular, display messages must not be assumed identical to internal model messages, tool results, compaction state, or attachment staging. The installed `eve/transcript`, seed/imported-prefix fork, historical/named checkpoints, and restoration events are local extensions. See the [maintained fork matrix](eve-fork-runtime-maintenance.md) and [patch provenance](../../patches/README.md).
- Public `SandboxBackend` is suitable for an app/provider-owned implementation. It receives `sessionKey`, reconnect metadata, runtime context and tags, and owns create/prewarm/stop/delete/shutdown. `captureState()` returns reconnect metadata, not a guaranteed immutable historical snapshot. Public `getSandbox()` exposes I/O and lifecycle, not historical capture/restore. [Backend](https://github.com/vercel/eve/blob/da82a953dc62fcce8a3684e4eed7a8b693b0941d/packages/eve/src/shared/sandbox-backend.ts), [sandbox handle](https://github.com/vercel/eve/blob/da82a953dc62fcce8a3684e4eed7a8b693b0941d/packages/eve/src/shared/sandbox-session.ts).
- Passing `source` to EVE's built-in Vercel backend is not a per-branch restore API: it is used for template construction and stripped from session creation. Use an owned backend's durable session-key mapping, not private provider bindings. [Built-in Vercel backend](https://github.com/vercel/eve/blob/da82a953dc62fcce8a3684e4eed7a8b693b0941d/packages/eve/src/sandbox/backends/vercel.ts).
- Hooks are awaited, but stream emission precedes hook execution in both pinned and current source. A UI observing `message.completed` or `turn.completed` can therefore race an unfinished hook. Background workflow tools independently outlive their parent's response. [Pinned event emission](https://github.com/vercel/eve/blob/247b3f05244893170bcf4dbcf20a2e35e416ccee/packages/eve/src/execution/workflow-steps.ts#L371), [current event sink](https://github.com/vercel/eve/blob/da82a953dc62fcce8a3684e4eed7a8b693b0941d/packages/eve/src/execution/session/event-sink.ts#L60), [awaited hook dispatch](https://github.com/vercel/eve/blob/da82a953dc62fcce8a3684e4eed7a8b693b0941d/packages/eve/src/context/hook-lifecycle.ts).

## What the prototype actually proves

Code: [isolated prototype](../../prototypes/app-owned-branching/README.md). It has no imports from EVE, app DB configuration, or provider clients. Its SQL is disposable experimental schema, not a production migration.

Twenty deterministic tests use a newly initialized PostgreSQL cluster on a unique Unix socket with TCP disabled. PostgreSQL holds both mock provider files and immutable attachment/document bytes; this is disposable local storage, not a real VM filesystem or object-storage integration. Teardown stops only that cluster and removes only its own temporary directory.

Demonstrated:

- Branches and nested branches share immutable prefix nodes; appending suffixes does not duplicate the prefix or alter ancestors. Compare-and-set heads prevent lost concurrent appends.
- Structured user/assistant/tool roles, paired call/result identities, attachment references, selected-tool and original-model annotations survive prefix selection. Annotations live in separate app rows and are excluded from model history. Incomplete/unpaired tools and oversized prefixes reject. The neutral format is deliberately smaller than EVE's real transcript schema.
- Owner checks cover branch access and attachment/document references. Branches hold immutable revision IDs. Source branch removal retains referenced resources and prefix nodes for children. This is retention evidence, **not** full erasure/garbage-collection implementation.
- Historical replacement excludes later messages. Two idle captures with the same transcript head preserve different manual document revisions. A capture operation retries its original boundary rather than resampling current state.
- Capture rejects outstanding turn, hook, approval, external-edit and background writers. New admission, message append and manual document writes reject while the persisted barrier is held. Registered mock sandbox writes require a live writer token.
- A stopping snapshot creates an immutable receipt, restores a new parent VM, and restores an independent child. Parent and child can append messages and modify their own files without changing the snapshot or each other.
- Pending records recover after coordinator reconstruction; lost provider replies and interruption after restore become retryable failed records while admission remains fenced. Ready retries do not overwrite a continued parent.
- Child creation has a durable owner/checkpoint reservation; changed requests reject. Lost restore replies replay without duplicate allocation. Deletion tombstones prevent resurrection, including deletion during restore publication.

Not demonstrated: EVE session initialization/continuation, real provider snapshot atomicity, native/UI identity mapping, streaming/reload behavior, mounted drives, actual tool execution, tool approval continuation, subprocess shutdown, Workflow restart/replay, billing, public cross-owner copy, production deletion or browser parity. The existing UI and runtime remain intact. No browser verification was needed because no UI changed.

## Safe boundary and recovery protocol

A usable checkpoint is a tuple `(immutable transcript boundary, app annotation cut, document revision manifest, retained attachment grants, persistent sandbox snapshot)` captured under one admission fence. A completion event alone is not this tuple.

1. Serialize reservation against branch writers and every entry point: sends, manual document edits, tool jobs, background workflows/subagents, completion hooks, mounted storage writers, and external file editors. Drain existing writers or return pending/busy; never silently ignore them. The prototype returns busy and lets callers retry.
2. Runtime confirms its selected conversational boundary is settled. Reject unresolved tools/approvals and unknown writers. Persist the barrier and the immutable manifest in a short transaction. Do not hold a DB transaction across slow provider I/O.
3. Capture using an operation-bound provider receipt. Freeze/drain OS processes, open write handles and external volume writers before filesystem capture; wrapper method completion is insufficient if a command daemonized. If a provider cannot certify this, that backend is unsupported for coherent snapshots.
4. If capture stops the source, restore an independent parent and atomically redirect the owned backend's session mapping **before** reopening admission. Cached EVE sandbox handles must resolve through that mapping on each operation, or a supported lifecycle rebind is needed. Child restore uses a distinct identity; never mount a mutable parent directory/drive into both branches.
5. Publish ready only after the receipt, resource manifest and parent continuation binding are durable. An error can be ambiguous: keep the branch fenced and expose failed/retry state. Recovery looks up the same capture/restore effects; it must not take a new snapshot after parent advancement.
6. A crashed writer's token does not expire into permission to snapshot. First fence/cancel its runtime/provider job and prove no later write is possible. Neither a TTL nor `turn.cancelled` alone supplies that proof. The prototype retains the token and blocks indefinitely until explicitly settled; automated abandoned-writer reconciliation remains work.

The mock has stronger replay semantics than the installed Vercel SDK: snapshot/restore effects are atomically discoverable by caller key. `@vercel/sandbox@3.3.0` documents that `snapshot()` stops the sandbox; its public options are expiration/signal, with no caller idempotency key in that method. Its implementation forwards the session ID to `createSnapshot`. A durable Workflow step can replay a committed result, but does not by itself close a crash between provider acceptance and result persistence. An owned provider adapter still needs acceptance lookup/idempotency, or an explicit unknown/manual-reconciliation state. **Do not claim the mock proves that gap solved on Vercel.**

Snapshot expiration, retention eviction, external mounts, credentials, process state and provider identity all need explicit policy. A filesystem snapshot must not be assumed to clone live processes or external services. Historical snapshots need retention independent of the parent VM's ordinary cleanup.

ChatJS's code-execution VMs are a separate lifecycle: `createSandbox` uses `persistent: false`; cleanup stops and deletes them, including orphan snapshots. Keep them disposable and retain only intentionally exported files. Do not snapshot every code-execution VM to implement conversation history. See [code sandbox implementation](../../apps/chat/tools/chatjs/vercel-code-execution/sandbox.ts).

## Smallest native contracts still needed

For the native-authoritative incremental direction:

1. **Immutable structured continuation selection and initialization.** Resolve an authorized prefix at a native message/turn boundary, including settled tool pairs and retained attachments, and initialize a fresh idle session without model/tool replay. Supply stable native-to-child message identity mapping, bounded validation and recoverable idempotent creation. A single `createFromPrefix` operation could combine export/import; exact naming is not important. Explicit structured seed input is also needed for sanitized public copies. Existing upstream idle creation should be reused.
2. **A runtime boundary barrier or equivalent complete participation.** Coordinate EVE turn admission, hooks and all descendant/background writers with the app's resource fence. This may be a small lifecycle/callback capability rather than a native snapshot format. If an app backend and all authored tools can enforce every writer and admission path using public APIs, no provider-specific snapshot extension is needed; that complete participation has not been established here.
3. **Defined conversational semantics.** State whether selection retains original effective model history/compaction and authored durable conversation state, or starts fresh with a normalized transcript. Preserve boundary provenance through descendants. Do not clone credentials, live approval grants, old billing records, or running tasks into the child. If current behavior depends on additional authored state, inventory it and carry the minimal allowlisted state; do not automatically copy an entire Workflow execution.

For app-authoritative history, (1) changes into a public execution/history-store seam with atomic committed output identity. That is a broader change than app prefix records. An import-only API does not make a mirrored app transcript safe.

Delivery correlation is independent: current delivery IDs help correlate successful/coalesced sends, but the existing-session request path still lacks caller-key replay acceptance lookup after a lost native response. The installed generic metadata patch loses all but the last coalesced metadata. Branch tables and snapshot IDs do not fix either issue. Keep delivery work separate.

## Can authored Workflow orchestration replace execution cloning?

Yes for orchestration, conditionally for end-to-end branching. Public `defineWorkflowTool`, `"use workflow"`, `"use step"`, and Workflow start/replay facilities exist in pinned and current EVE. A ChatJS coordinator can call durable steps equivalent to `reserve → capture → restoreParent → publish → reserveChild → restoreChild → initializeNative → bindChild`, passing only operation IDs. UI branch operations should be app-started workflows, not model-chosen tool calls. [Pinned authoring docs](https://github.com/vercel/eve/blob/247b3f05244893170bcf4dbcf20a2e35e416ccee/docs/tools/workflows.mdx), [current authoring docs](https://github.com/vercel/eve/blob/da82a953dc62fcce8a3684e4eed7a8b693b0941d/docs/tools/workflows.mdx).

Existing native `createSessionStep` and `turnStep` are internal, not supported EVE package exports. Their presence in published files is not permission to deep-import them. Reusing those steps in an app-owned session driver requires an explicit upstream driver API; alternatively the outer app workflow can call supported client APIs once structured seeding exists.

This replaces bespoke polling/retry plumbing, not the missing structured initialization or all-writer boundary. Workflow tool bodies do not expose `getSandbox`; provider I/O belongs in owned steps/backend code. A new run is sufficient for a settled child; replaying the old tool execution would repeat side effects. The prototype functions are retryable step-shaped operations, but no compiled authored Workflow was run and no Workflow exactly-once claim is made.

## Feature and semantic gates

| Existing behavior | Candidate preservation rule | Current evidence / remaining risk |
| --- | --- | --- |
| Edit user message | Choose checkpoint before that user; append replacement and restored attachments | Prefix replacement proven in model; real upload/native/UI mapping untested |
| Regenerate answer | Choose before original user turn, resend same user content/tool selection with original model | Annotation retained; actual regeneration/usage and response-card grouping untested |
| Branch / multi-model comparison | Reuse one immutable boundary across children; parent continues independently | DB/provider model proven; native readiness/initial comparison dispatch still required |
| Manual document edits between turns | Capture separate resource boundaries even with identical transcript head | Proven in prototype; reuse existing document ancestry/heads in production |
| Imported copy edit/regenerate | Retain addressable imported boundaries, historical model provenance and mapped resource revisions | Existing runtime supports local extensions; prototype does not replace public-copy sanitization/journal |
| Save public conversation | No paid turn; sanitize; independently authorize/retain bytes after revocation/deletion | Not implemented here. Cross-owner copy needs destination grants/new public identities, not inherited source authorization |
| Failed/cancelled turn | Use prior settled checkpoint, or define an explicit settled failure boundary | Prototype rejects unresolved tools/registered writers; does not normalize partial outputs |
| Pending approvals/background tasks | Do not copy live task/approval execution; refuse capture until safely settled | Prototype refuses; supporting forks at pending state would need a separate policy/API |
| Delete source/family | Retain shared reachable resources for authorized children; erase only with complete reachability/fences | Simple source-removal retention and child tombstone proven; GC, family purge and provider erasure excluded |
| Compaction/dynamic state | Native contract specifies exact retained state or explicit normalization tradeoff | No parity claim; changed model context can change answers and costs |

Rejecting unsupported cases is acceptable inside this isolated prototype. Shipping those restrictions over currently supported product behavior requires a user decision; this branch changes none of those behaviors.

## Total complexity and incremental scope

| Layer | Current maintained approach | Candidate app/provider approach |
| --- | --- | --- |
| EVE fork | Historical snapshots, stream/read/restore, seed/prefix, readiness, provider snapshot implementation | Smaller structured continuation + generic boundary contract; model/display mapping and versioning still native |
| ChatJS | Existing operation/copy journals, lineage, document manifests, files, ownership, UI, deletion | Keep these; add barrier/writer ledger, immutable native-prefix references, snapshot/provider receipt journal, annotation bindings, parent rebind/recovery and retention |
| Provider/backend | Fork-specific backend snapshot paths and inventory evidence | Public owned backend can package capture/restore/session mappings and inventory; full lifecycle still needs implementation and certification |
| Scaffold | Patched EVE artifact, source/dist checks and vendor packaging | A reusable backend/coordinator package can reduce copied adapter code. Remaining metadata/approval/usage/deletion/collector/server patches still require current vendor machinery |
| Verification | Native fork tests plus app DB/browser regressions | Retain semantic tests; add provider lost-response/fencing/retention coverage and migration tests; not simply fewer tests |

The checked-in checkpoint source patch is 9,607 lines and the compiled patch 2,778 lines at the base commit; both mix capabilities and tests. These are inventories, not removable-line estimates. The prototype is additional experiment code and establishes no net line savings. Moving all native history logic into ChatJS would likely increase total coupling. The best reduction is narrower native continuation plus a reusable owned resource backend.

Suggested independently reviewable slices; estimates are engineering judgment, excluding upstream review and remote-provider certification:

1. **Contract fixtures and parity inventory (2–4 days):** enumerate native/imported boundaries, tool/file/compaction cases and durable state used by ChatJS. Reuse current tests. Specify normalized-copy versus exact-owned-branch semantics.
2. **Native continuation seam (1–2 weeks):** minimize the existing seed/prefix code into supported initialization/selection with stable identity mapping and authenticated replay. Prove fresh idle creation against pristine/rebuilt packages. Do not remove historical checkpoints yet.
3. **Owned backend and barrier (1–2 weeks):** journal resources by app/native identity, coordinate every writer, implement parent rebind and pending/failed recovery. Start with deterministic/local backends; gate hosted support on provider guarantees.
4. **App projection and resource integration (1–2 weeks):** native prefix references, existing document revisions, annotation joins, retention/copy grants and existing UI data shapes. No permanent copied transcript. Preserve edit/regenerate/comparison/imported-copy behavior.
5. **Compatibility and deletion (1–2 weeks):** old sessions keep their old backend/checkpoint readers; only certified new sessions use the candidate path. Add family cleanup, expiry and unknown-provider reconciliation. No destructive backfill inferred from missing evidence.
6. **Removal and scaffold gate (2–4 days after parity):** rerun existing local/native/browser regressions; reduce only superseded source/compiled fork slices; rebuild and verify generated scaffolds with fresh dependency installation. Keep unrelated patches. Rollback selects the old path by capability/version; retained prefixes/snapshots remain readable.

These slices overlap; roughly 4–8 engineer-weeks is a planning range for a production migration, not a promise or an outcome of this prototype. Stop after the first two slices if the minimal native contract is unavailable or exact-state parity requires recreating the same complexity elsewhere.

## Verification

Run from the repository root with Bun and local PostgreSQL binaries on PATH:

```sh
bun install --frozen-lockfile
bunx vitest run --config prototypes/app-owned-branching/vitest.config.ts
bunx tsc -p prototypes/app-owned-branching/tsconfig.json
bun lint
bun test:types
```

Results: 20 prototype tests passed; dedicated strict prototype type check passed; repository lint/docs doctor passed; repository type checks passed (7 tasks, 5 cached). Final verification is recorded in the handoff. No production build was used for type-checking. Tests do not load env files or accept a database URL. Existing app runtime behavior was not revalidated by these tests and is not claimed changed.
