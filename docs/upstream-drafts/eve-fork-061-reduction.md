# eve fork reduction on 0.61.0

ChatJS now pins the maintained **eve 0.61.0** package in this isolated worktree. This is a tested upgrade and maintenance reduction, not a completed migration to a two-guarantee-only fork. No package was published, upstream PR opened, worker restarted, or existing database migrated.

## What became smaller

- Replaced five ordered source overlays with one patch against the exact 0.61.0 tag and a repeatable Bun packaging script. Removed the old 0.52.2 compiled overlay and incremental experiment builder.
- Reused upstream's message-free idle creation; removed the old empty-string seed sentinel.
- Retired the old fork's versioned inbox adapters and snapshot migration integration. Checkpoint commands now use upstream's current owner queue; historical fork-format handling stays local to the fork rather than changing upstream Workflow snapshot versions.
- Reused upstream's optimistic message-submission implementation, adding only the metadata that ChatJS needs.
- Removed an old no-input turn-preamble override; upstream handles ordinary continuations correctly.
- Consolidated seed attachment staging, and separated creation, streaming, and sandbox module loading so the fork passes upstream's file-size and runtime-boundary guards.

The compiled patch is smaller in bytes than its 0.52.2 predecessor. The readable source patch is larger after the rebase, test repairs, and module splits. Those are different measurements: this work reduces obsolete behavior and the patch application process, but does not turn the fork into a tiny patch.

## Keep / replace / remove

| Capability | Decision | Evidence / reason |
| --- | --- | --- |
| Idle conversation creation | Replace with upstream | 0.61.0 supports creation without a message. Seed import reuses it. |
| Settled history capture and authorized structured initialization | Keep | Public-memory capture and fresh-history integration pass. Issue [#3524](https://github.com/vercel/eve/issues/3524) remains the proposal. |
| Manual compaction with a dynamic model | Keep | The fork still supplies resolver dispatch before manual compaction; covered by accounting tests. Related [#3437](https://github.com/vercel/eve/issues/3437). |
| Durable per-call compaction usage | Keep | Still needed for billing evidence, including calls that return unusable summaries. Related [#3483](https://github.com/vercel/eve/issues/3483). |
| Built worker startup under `next start` | Keep | Upstream route-prefix changes were retained while porting the existing startup fix. Related [#3456](https://github.com/vercel/eve/issues/3456). |
| Tool approval receipts | Keep | Exact session/call/tool/input authorization still needs the fork receipt. Outside a runtime context, no receipt is issued. |
| Message metadata and durable completion results | Keep | ChatJS's tool selection, projection, and document coordination still consume them. |
| Historical / named checkpoints and resource snapshots | Keep | Production editing, comparisons, documents, attachments, and sandbox isolation still rely on these boundaries. |
| Sandbox birth receipts and collector inventory | Keep | Deletion certification still needs these. Only reviewed workflow identities are allowed; new unknown wrappers remain unresolved. |
| Old inbox wire helpers, old snapshot-version coupling, duplicate pending-submission state | Remove / replace | Superseded by 0.61.0 runtime architecture, with replacement contract tests. |

0.61.1 appeared during verification. Its changelog covers model-router output schemas, development setup warnings, and workflow-step context restrictions. None replaces the submitted contracts above. This change deliberately retains the tested 0.61.0 baseline.

## Why production branching still uses checkpoints

The smaller contract is sufficient for the tested settled-history flows, but not yet for every production branch. ChatJS has no production immutable capture store or durable capture-success receipts. Memory callback completion alone does not prove persistence. Model history also lacks the UI annotation joins, resource fences, and document revisions needed by ChatJS.

Compaction and framework-generated history can invalidate prefix selection; the import helper rejects unsupported semantics rather than silently discarding them. Existing sandbox/document snapshots cannot be replaced by a history array. Therefore no checkpoint or resource-protection path was removed on the strength of the prototype alone. App-owned branching remains a separate prototype, not a second production transcript.

## Validation and limits

- ChatJS lint and workspace typecheck pass.
- Focused ChatJS history, copy, MCP, research, billing, approval, and run-coverage tests: 359 pass.
- Thread package: 68 tests pass. Gateways package: 14 tests pass. CLI scaffold and vendoring: 22 tests pass.
- App-owned SQL/resource prototype: 20 tests pass on a disposable local PostgreSQL cluster with TCP disabled.
- Native production and test-inclusive TypeScript checks pass.
- Native fork integration suite: 44 tests pass across 12 files, using mock models/providers and local resources.
- Native broad unit suite: 9,141 pass, four fail, one upstream skip. The four failures reproduce on an untouched 0.61.0 checkout with the same build dependencies: three log-redaction assertions match `/private/tmp` in macOS stack paths; one OpenAI prompt-conversion expectation differs. No fork regression remains in that run.
- Fresh-cache installation can import and use `eve/transcript`; the installed patch is also checked by scaffold vendoring. During iteration Bun retained a stale declaration despite reinstall, so the final package was installed from a new cache and verified outside the ChatJS Git tree.

The upgrade aligns the AI SDK family to `ai@7.0.105`, including MCP 2.0.52. The existing MCP auth-refresh patch was regenerated at the new package's exact hunk offsets; merely renaming it passed Git's offset-tolerant check but produced a broken Bun install. MCP transport regressions cover the regenerated patch.

This does not certify migration of live 0.52.2 Workflow runs, production deployment, a full browser exercise, or real Vercel snapshot interruption/recovery. The app's `world-postgres@5.0.0-beta.40` package remains unchanged. The protected original ChatJS checkout and its services/database were not touched.

See [patch build instructions](../../patches/README.md). The submitted history issue is awaiting maintainer input; local implementation is not upstream approval.
