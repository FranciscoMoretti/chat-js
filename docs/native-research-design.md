# Native EVE research migration

## Approved scope

Preserve the adaptive supervisor/researcher structure, clarification, brief creation, follow-up research, compression of findings, synthesis, report saving, and existing research-round and search-step limits. Keep one user-facing research capability. This is an execution migration, not a research-algorithm redesign.

## Execution

- Keep the user-visible research call in default (blocking) execution mode. Preserve conversational clarification and the current stop behavior; do not introduce background task UX in this migration.
- Implement the outer capability as a static EVE workflow tool. Workflow bodies cannot be returned by the current dynamic ordinary-tool registry, so research needs its own native entry point with equivalent feature and access checks.
- Run the adaptive supervisor as a native EVE agent returning typed decisions. The workflow invokes researchers sequentially and sends all collected findings into the next decision. It enforces the same `max_researcher_iterations + 1` decision bound as the previous SDK loop.
- Native researchers receive only the installed search capability they need. Search executes through EVE's tool dispatch, eliminating the AI SDK search bridge and direct invocation of installed definitions for research.
- Preserve the separate findings-compression and final-synthesis phases. Use native agent outputs with runtime schemas at orchestration boundaries. Keep the existing model selections and adapt completion instructions to EVE’s typed final output. Use EVE/model output limits: the former 4,000-token cap can exhaust a reasoning model before it returns findings.
- Save the final report in a durable step, retaining the existing idempotent document operation identity and access checks.

Native workflow delegation and execution semantics: [pinned workflows docs](../apps/chat/node_modules/eve/docs/tools/workflows.mdx). Native agent result schemas and limits: [pinned agent configuration](../apps/chat/node_modules/eve/docs/agent-config.md).

## Integration work to prove

### Completion and limits

The former SDK loop stopped on `researchComplete` or a supervisor step limit. The native workflow preserves the decision bound and retains all collected notes. Its typed completion decision replaces the marker tool.

Inspection of the pinned `AgentLimitsDefinition` confirms that EVE exposes session time, token, and token-cost limits, but no model-step limit. Hooks cannot request normal early completion either. The original blocking `conductResearch` proposal therefore cannot preserve the SDK stop condition through the documented agent configuration alone.

Approved decision: the bounded adaptive loop lives in the workflow. Each supervisor response contains research topics or completion. The workflow runs topics sequentially and retains every compressed finding. No background delegation receipts are substituted for findings.

Four hidden native agents implement the phases: a planner handles clarification, brief creation, and supervisor decisions; a researcher receives the installed search definition; a compressor compresses the researcher's typed raw findings (including source URLs and conflicting evidence); and a writer returns the full document content for the workflow to persist. The researcher's search tools are withdrawn after nineteen model steps, reserving the twentieth response for findings. Search-query and topic-batch limits remain prompt guidance, as before.

The workflow replaces the Promise queue with sequential awaited invocations. Each invocation starts a fresh child session; continuing a child under a different root turn is explicitly rejected by the ownership binding. This avoids attributing later work to an earlier billing turn.

### Progress and cancellation

The root remains one research capability. Show phase and topic progress, not every internal agent message. EVE child streams carry detailed activity; parent lifecycle events alone do not expose every search update. Verify reconnect reconstruction and owner authorization before relaying child events. Cancellation must stop the outer workflow and owned research work and prevent report saving afterward.

Source: [pinned subagent stream and cancellation docs](../apps/chat/node_modules/eve/docs/subagents/index.mdx).

### Costs

The existing usage ingestor and reconciler read root session events. Native child sessions need explicit owner/root attribution and reconciliation. Charge each native model event and installed-search receipt once, keyed by its original session/event identity. A parent summary must not charge the same child usage again. Preserve known versus unknown costs, replay deduplication, and interrupted-run reconciliation; provider-side exactly-once spending remains outside the receipt guarantee.

The gateway currently authorizes session stream reads through `ownsEveSession`, and billing cursors live on root conversation rows. Child reconciliation therefore requires a durable descendant-to-root ownership link and separate stream progress, not merely recursive calls to the current reconciler. Only trusted native delegation evidence may create that link; client-supplied child IDs must not authorize access.

Sources: [usage ingestor](../apps/chat/lib/eve/usage.ts), [usage reconciliation](../apps/chat/lib/eve/reconcile-usage.ts).

## Verification before replacing the SDK flow

1. An adaptive supervisor receives findings, identifies a gap, requests follow-up research, then finishes with all findings.
2. Clarification returns to normal conversation without saving a report.
3. Existing iteration and search limits retain their behavior; execution remains serialized initially.
4. Installed search uses native validation, authorization, progress, cancellation, and result projection.
5. Restart/reconnect reconstructs progress; cancelling prevents later report writes and stops owned work.
6. Child model usage and search costs are attributed once, including replay and partial failure.
7. Native inputs/outputs remain concrete in TypeScript and are validated at durable boundaries.

## Deliberate exclusions

No fixed-plan replacement, single-agent replacement, general-purpose workflow builder, new background UX, or incidental research-quality changes. Workflow installability is separate from the ordinary-tool registry format; do not widen that format merely to make this example fit.

## Local verification

- `bun --cwd apps/chat test:research:native` compiles the production workflow and runs it in an isolated EVE worker with deterministic models and persistence. It verifies adaptive follow-up, native search dispatch, durable progress, and cancellation of owned children before saving.
- Unit tests cover clarification, round exhaustion, output validation, failures, child stream reconciliation, and read-only child authorization.
- PGlite tests apply the real migrations and verify owner isolation, monotonic cursors, and replay-safe root-turn cost aggregation.
- Migration `0007_kind_charles_xavier.sql` adds descendant ownership and usage cursors; it must be applied before deploying native research. Model and search usage remain in the existing ledger.

Static workflow tools remain in the authored native tool surface; runtime preparation rejects disabled research, guests, nested invocation, incompatible selected tools, missing search, and disabled text documents before any child model starts. Phase/topic progress is streamed through the outer receipt; individual search events stay on the native child stream.

## Live provider smoke tests

Run `bun test:tools:live` from the repository root against an already running `bun dev`. The command loads worktree-local credentials and ports, and uses Bun to load the application's ESM-only dependencies in Playwright. It runs the existing search, sandbox, document, and research browser scenarios with real configured models and providers; these calls incur provider usage.

Use local PostgreSQL or an explicitly isolated test database accepted by `assertEveTestDatabase`. Run `bun setup` against that database first. The tests authenticate through `/api/dev-login` and create test conversations and documents. Research verifies a reloadable report, attributed child model/search costs, and unchanged ledger rows after full replay. The outer workflow receipt adds zero cost. Standalone search visibility can be disabled while research continues using its installed search definition.

### Verification status (2026-09-28)

Live search, sandbox execution, and the document scenario passed against the local test databases. Research reached native searches and compression, but end-to-end report persistence and billing replay remain unverified: inherited output caps caused empty responses, and the fresh run after removing them encountered long runtime/network gaps and provider timeouts. The smoke test now allows fifteen minutes and cancels outstanding root/child work on failure. Deterministic native workflow scenarios, unit tests, typechecks, and the EVE build pass.
