# Minimal EVE history contract: fork experiment

> Historical 0.52.2 audit. The installed fork is now 0.61.0; see [the current reduction report](eve-fork-061-reduction.md) and [patch instructions](../../patches/README.md). Older patch files remain available in commit `27c14d41`.

The smaller contract works for the tested **settled conversation** flows. It is not yet a complete ChatJS migration. The experiment uses the maintained EVE 0.52.2 fork, not pristine upstream; the existing authenticated transcript-seed channel and idle initialization remain prerequisites.

## What changed

- Add `createSessionHistorySeed(history)` to `eve/transcript`. It validates a selected structured history and returns an existing seed plus destination message/tool ID mappings. Empty history supports first-message edits.
- Reuse the existing fresh idle-session seed path. No historical checkpoint read, Workflow fork, or replay of old model/tool calls is required by the experiment.
- Fix successful turn completion to pass settled model history to the existing public memory-capture callback. The declaration alone was insufficient: the pinned harness did not pass the messages needed to dispatch it.
- Preserve text versus JSON tool results through seed import, descendant prefix reads, and ChatJS's shared-copy projection.

The source patch includes native documentation, a research proposal, changeset, unit tests and a mock-runtime integration test. Nothing has been published. The ChatJS dependency overlay is rebuilt and installed in this isolated worktree. No production capture provider, schema migration, or UI change was installed.

## What the proof covers

A native local Workflow test captures history through `defineMemory`, starts fresh idle children from selected prefixes, and continues each child. It covers editing and regenerating the first message, editing and regenerating a later message, branching after the latest answer, excluding the later suffix, and continuing the parent independently. Initial child events are only `history.seeded` and `session.waiting`; execution starts after sending the next user message.

Native pure tests cover paired calls/results, fresh IDs, URL files, text/JSON/error outputs, empty prefixes, malformed or incomplete pairs, unsupported provider fields, binary files, and size bounds. ChatJS's existing imported-message boundary and original-model tests still pass. A new copy regression passes through the installed public helper and actual shared-copy code to preserve text tool results.

This does not demonstrate a production app-owned history store or a full browser flow. The native integration starts the workflow through its test harness; the existing seed integration separately tests the channel path. The earlier 20-case SQL/resource prototype remains separate and uses a disposable local database and mock snapshot provider.

## Smallest useful contract

1. **Capture settled structured history.** The existing memory callback works after the completion handoff fix. ChatJS must persist a success receipt; EVE logs callback failures, so completion alone cannot mark a branch ready.
2. **Initialize an idle conversation from authorized structured history.** Reuse the maintained `resolveSeed` path, with an immutable operation bound on the server. The browser submits the operation ID, not arbitrary history.
3. **Define the supported history semantics.** This experiment offers normalized, validated conversation import with fresh identities. It does not promise exact replay of arbitrary model/provider state.

The convenience converter could ultimately live in ChatJS. The essential EVE contract is the capture handoff plus supported structured idle initialization. There is no evidence here that EVE needs to own ChatJS's branch tree, documents, attachments, resource journal, or annotation tables.

## What still prevents claiming all ChatJS requirements

- **Resource consistency:** history capture is not an all-writer fence. Documents, files, background writes, and persistent sandbox state need the app resource protocol. Real Vercel snapshot interruption/recovery remains unproven.
- **History semantics:** nonempty provider options, system messages, signed or provider-executed content, pending approvals, binary attachments, and several richer tool output types reject. Compaction can erase or rearrange prefix boundaries; stable selection across it remains unresolved. Fresh authored state and current system instructions may differ from the parent execution.
- **App integration:** durable immutable capture storage, retention/deletion, source-to-destination annotation joins, operation binding, ownership checks, and destination attachment access still need production wiring. Model/tool UI annotations are not present in `ModelMessage[]`; ChatJS must keep them separately.
- **Fork cleanup:** this adds a small experiment atop the existing large fork. It does not prove that the checkpoint machinery can already be deleted, or that this patch applies directly to current upstream.

## Validation

- ChatJS `bun lint` and `bun test:types`: pass.
- ChatJS copy/shared-message/boundary/model suites: 61 tests pass.
- Disposable local SQL/resource prototype: 20 tests pass; prototype typecheck passes.
- Native selected-history and existing seed integration: 10 tests pass, using deterministic authored mock models; no paid provider or remote database.
- Native focused history/memory/channel unit set: 70 tests pass.
- Broader native harness set: 319 pass, one pre-existing no-input preamble assertion fails. Repeating that assertion with the pre-experiment harness reproduces it.
- Native production declaration build passes. Full native test-inclusive typecheck still fails on existing checkpoint/seed/fork test types; no new history-helper diagnostics remain. These are contribution gates, not passing checks.
- Native docs structural/link and snippet checks pass; full `docs:check` stops at its MDX compiler lookup because that script requires a pnpm-store layout, while this isolated dependency tree was installed with Bun.
- Compiled installed patch and native source patch reverse-apply checks pass.

Reproduction inputs and patch order are in [patches/README.md](../../patches/README.md). Native tests live in the source patch under `packages/eve/src/execution/session-history-seed*.ts`. Use the native tier configs, not bare Vitest, so aliases resolve source rather than stale compiled modules.
