# Loop Rule Test Subtree Report

Scope: apps/chat/tests/** only. Original rule suppression sites: 40; final narrowly scoped sequential blocks: 32; net reduction: 8. Every original site was exposed and inspected. Broad file-level comments were removed, including unused sites.

## Outcome

- 39 original independent loops now use Promise.all with async item callbacks; all required per-item operation ordering and assertions remain inside those callbacks. An enclosing local-snapshot verification loop also became a Promise.all map after the inner loops were parallelized.
- 32 loops remain sequential with local disable/enable pairs stating the concrete shared state or dependency. No recursion, fake awaits, changed test expectations, or concurrency configuration changes were introduced.
- Independent database reads, candidate checks, fenced-insert rejection assertions, upload-key work, snapshot existence checks, distinct source file copies, and distinct billing-hook file writes now run concurrently.
- Shared browser page navigation, viewport screenshots, document panel/clipboard interactions, stream appends and reads, harness continuations, bounded polling, migrations, ordered foreign-key teardown and shared admission-race rounds remain sequential.
- Original count reduction understates the narrowed scope: one whole-file suppression can become several individual retained-loop blocks.

## Verification

- PASS: bun x oxlint --type-aware apps/chat/tests (165 files, zero diagnostics across all configured rules).
- PASS: bun x oxfmt --check apps/chat/tests (171 files).
- PASS: git diff --check -- apps/chat/tests.
- PASS: native approval unit suite, 4/4 tests.
- PASS: Chromium MCP connector discovery scenario, 1/1 selected test; other file cases explicitly filtered, not skipped in source.
- Previously PASS: Chromium reasoning and primitive-forwarding suites, 3/3 tests. React lifecycle act warnings are emitted by these fixture suites.
- Provider/database/live worker integration tests not run because they need configured external/local services; coordinator owns full repository lint/types checks.
- Async receipt forwarding now validates sessionId with Zod after awaiting JSON, fixing unknown-result errors identified by the coordinator type check.
- No unresolved executable rule violations remain. No remaining site is classified as merely unresolved; retained sites have ordering evidence below.

## Per-File Counts

| File | Original Directives | Final Sequential Blocks | Original Loops Parallelized |
| --- | --: | --: | --: |
| apps/chat/tests/eve-browser.e2e.ts | 1 | 1 | 1 |
| apps/chat/tests/eve-contracts.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-conversation-fixture.ts | 3 | 1 | 0 |
| apps/chat/tests/eve-copy-documents.e2e.ts | 1 | 1 | 0 |
| apps/chat/tests/eve-copy-journal.e2e.ts | 1 | 1 | 1 |
| apps/chat/tests/eve-create-recovery.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-delete-family.e2e.ts | 1 | 0 | 2 |
| apps/chat/tests/eve-document-run.e2e.ts | 1 | 1 | 0 |
| apps/chat/tests/eve-document-tools.e2e.ts | 1 | 3 | 1 |
| apps/chat/tests/eve-documents.e2e.ts | 1 | 1 | 5 |
| apps/chat/tests/eve-feedback.e2e.ts | 1 | 2 | 0 |
| apps/chat/tests/eve-file-identities.e2e.ts | 1 | 1 | 0 |
| apps/chat/tests/eve-file-storage.e2e.ts | 1 | 0 | 3 |
| apps/chat/tests/eve-files.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-followups-ui.e2e.ts | 1 | 1 | 1 |
| apps/chat/tests/eve-guest-cleanup.e2e.ts | 1 | 1 | 0 |
| apps/chat/tests/eve-guests.e2e.ts | 1 | 2 | 0 |
| apps/chat/tests/eve-idle-checkpoint-live.e2e.ts | 1 | 1 | 0 |
| apps/chat/tests/eve-live.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-local-snapshots.e2e.ts | 1 | 0 | 4 |
| apps/chat/tests/eve-mcp-native-approval.test.ts | 1 | 1 | 0 |
| apps/chat/tests/eve-metadata.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-orphan-cleanup.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-payload-purge.e2e.ts | 1 | 1 | 2 |
| apps/chat/tests/eve-postgres-stream-resume.e2e.ts | 1 | 2 | 0 |
| apps/chat/tests/eve-project-ui.e2e.ts | 1 | 1 | 0 |
| apps/chat/tests/eve-projects.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-queue-fence.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-resource-fence.e2e.ts | 1 | 0 | 2 |
| apps/chat/tests/eve-response-groups.e2e.ts | 1 | 1 | 3 |
| apps/chat/tests/eve-save-copy.e2e.ts | 1 | 1 | 0 |
| apps/chat/tests/eve-search.e2e.ts | 1 | 2 | 1 |
| apps/chat/tests/eve-session-mapping.runtime.e2e.ts | 2 | 1 | 0 |
| apps/chat/tests/eve-tool-renderers.e2e.ts | 1 | 5 | 1 |
| apps/chat/tests/eve-votes.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/native-research-runtime.ts | 1 | 0 | 2 |
| apps/chat/tests/visual/mcp-settings.browser.tsx | 1 | 0 | 1 |
| TOTAL | 40 | 32 | 39 |

## Retained Loop Evidence

Line references below identify the audited loop before this pass changed formatting; they are audit coordinates, not final code links.

- apps/chat/tests/eve-session-mapping.runtime.e2e.ts:33: Each poll observes the worker before the next bounded delay and exits when binding completes.
- apps/chat/tests/eve-postgres-stream-resume.e2e.ts:42: Stream chunks must be appended in fixture order to assert exact replay content.
- apps/chat/tests/eve-postgres-stream-resume.e2e.ts:86: Each read advances the same stream reader and appends its next chunk before checking completion.
- apps/chat/tests/eve-mcp-native-approval.test.ts:234: Each harness continuation returns the next session and continuation consumed by the next iteration.
- apps/chat/tests/eve-idle-checkpoint-live.e2e.ts:178: Candidates share one browser page; finish navigation and assertions before visiting the next chat.
- apps/chat/tests/eve-conversation-fixture.ts:30: Parent-first transaction batches may reference chats and conversations inserted by earlier fixture rows.
- apps/chat/tests/eve-file-identities.e2e.ts:75: Migration statements share a transaction and depend on earlier schema statements.
- apps/chat/tests/eve-feedback.e2e.ts:61: One browser page must finish each viewport capture before its dimensions change.
- apps/chat/tests/eve-feedback.e2e.ts:243: One browser page must finish each viewport assertion and capture before its dimensions change.
- apps/chat/tests/eve-copy-documents.e2e.ts:112: Delete checkpoint entries before their checkpoint headers to satisfy foreign keys.
- apps/chat/tests/eve-response-groups.e2e.ts:51: Delete fork rows in fixture order before deleting their shared root; foreign keys constrain teardown.
- apps/chat/tests/eve-guest-cleanup.e2e.ts:83: Each bounded claim round updates claimed families and determines whether another round is needed.
- apps/chat/tests/eve-tool-renderers.e2e.ts:33: Viewport changes and screenshots operate on the same browser page.
- apps/chat/tests/eve-tool-renderers.e2e.ts:85: Viewport changes and screenshots operate on the same browser page.
- apps/chat/tests/eve-tool-renderers.e2e.ts:144: Viewport changes and screenshots operate on the same browser page.
- apps/chat/tests/eve-tool-renderers.e2e.ts:188: Viewport changes and screenshots operate on the same browser page.
- apps/chat/tests/eve-tool-renderers.e2e.ts:259: Viewport changes and screenshots operate on the same browser page.
- apps/chat/tests/eve-document-tools.e2e.ts:48: Viewport changes and screenshots operate on the same browser page.
- apps/chat/tests/eve-document-tools.e2e.ts:119: Each document interaction reuses the artifact panel and clipboard; finish copying and closing before opening the next document.
- apps/chat/tests/eve-document-tools.e2e.ts:290: Replay the exact save twice in order to verify the completed write is idempotent.
- apps/chat/tests/eve-payload-purge.e2e.ts:42: Teardown removes dependent workflow table rows in their declared order before run deletion.
- apps/chat/tests/eve-followups-ui.e2e.ts:52: One browser page must finish each viewport assertion and capture before its dimensions change.
- apps/chat/tests/eve-document-run.e2e.ts:63: Viewport changes and screenshots operate on the same browser page.
- apps/chat/tests/eve-copy-journal.e2e.ts:58: Delete copy files and checkpoint entries before their headers, documents and conversation parents.
- apps/chat/tests/eve-project-ui.e2e.ts:120: Viewport changes and screenshots operate on the same browser page.
- apps/chat/tests/eve-save-copy.e2e.ts:75: Delete copy files and checkpoint entries before their headers, documents and conversation parents.
- apps/chat/tests/eve-documents.e2e.ts:1231: Both changed intents replay the same operation ID; preserve sequential rejection checks.
- apps/chat/tests/eve-search.e2e.ts:87: Sources reuse the same dialog; close it before opening the next source.
- apps/chat/tests/eve-search.e2e.ts:192: Viewport changes and screenshots operate on the same browser page.
- apps/chat/tests/eve-guests.e2e.ts:357: Denial cases assert shared admission-rate state remains absent before the next case.
- apps/chat/tests/eve-guests.e2e.ts:681: Run one creation/refund race at a time so shared IP admission counters do not add interference.
- apps/chat/tests/eve-browser.e2e.ts:410: Navigate and inspect each 404 on the same browser page before the next navigation.

## Parallelized Loop Evidence

- apps/chat/tests/visual/mcp-settings.browser.tsx:248: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-orphan-cleanup.e2e.ts:56: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/native-research-runtime.ts:55: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/native-research-runtime.ts:65: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-response-groups.e2e.ts:121: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-response-groups.e2e.ts:176: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-response-groups.e2e.ts:254: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-local-snapshots.e2e.ts:134: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-local-snapshots.e2e.ts:147: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-local-snapshots.e2e.ts:301: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-local-snapshots.e2e.ts:306: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-resource-fence.e2e.ts:77: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-resource-fence.e2e.ts:82: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-create-recovery.e2e.ts:57: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-tool-renderers.e2e.ts:251: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-document-tools.e2e.ts:113: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-payload-purge.e2e.ts:85: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-payload-purge.e2e.ts:306: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-delete-family.e2e.ts:67: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-delete-family.e2e.ts:132: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-followups-ui.e2e.ts:44: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-file-storage.e2e.ts:48: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-file-storage.e2e.ts:51: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-file-storage.e2e.ts:69: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-queue-fence.e2e.ts:63: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-metadata.e2e.ts:130: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-projects.e2e.ts:302: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-copy-journal.e2e.ts:495: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-contracts.e2e.ts:652: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-documents.e2e.ts:151: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-documents.e2e.ts:198: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-documents.e2e.ts:409: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-documents.e2e.ts:1031: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-documents.e2e.ts:1168: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-votes.e2e.ts:95: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-search.e2e.ts:127: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-files.e2e.ts:77: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-live.e2e.ts:158: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
- apps/chat/tests/eve-browser.e2e.ts:416: Independent item operations retain intra-item awaits and assertions; Promise.all joins all work before the next scenario step.
