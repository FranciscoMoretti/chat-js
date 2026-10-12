# Async Rule Test Subtree Report

Scope: apps/chat/tests/** only.

Original suppression sites: 182; final narrowly retained sites: 28; net removed: 154. Original whole-test blocks were removed, including matching enables; remaining immediate fixtures use single-function blocks. Negative per-file reductions reflect narrowing a broad original block to several independent function scopes, not introducing new suppressed functions.

## Behavior and Evidence

- Playwright route callbacks now use async blocks and await route.abort/fulfill. Poll callbacks await evaluation and database operations. React act callbacks await browser clicks, keyboard input and hover. No fake awaits were added.
- Promise.resolve mock values become natural async values where existing require-await exemptions permit that contract. Constant-string mocks, immutable fixture Blob reads, known session bindings and canSpend use typed mockResolvedValue. Promise.reject callbacks become async throws where permitted; the must-not-retire callback uses typed mockRejectedValue.
- Typed mockResolvedValue() with no argument handles pure no-op mocks without fake awaits or explicit undefined. It removes the copy storage writer, share dialog setVisibility and three native purge no-op callback exceptions. The earlier assumption that an explicit undefined argument was required was incorrect and has been corrected.
- Immediate callbacks with dynamic values or synchronous side effects but no asynchronous work still conflict with active require-await. These remain explicit first-rule exceptions. Examples: native retirement callbacks recording counters/failure paths, storage upload mocks mutating their in-memory provider, browser clipboard failure fixture, render-only no-op onAction, and the note confirmation tool. Dynamic values and side effects remain evaluated per call.
- eve-artifact-query.fixture.ts retains its fetch callback: it creates responses synchronously and intentionally validates inputs with synchronous throws. eve-save-copy.e2e.ts retains synchronous File missing throw timing in its download mock.
- visual/model-selector-actions.browser.tsx keeps void | Promise<void> behavior and forwards onSend unchanged; its suppression was unused under the native rule and removed. eve-comparison-ui.mocks.tsx similarly had an unused rule suppression.
- Fixtures that return deferred promises (copy journal and MCP cancellation) now await those real deferred operations. Tests assert operation receipts/session bindings rather than callback promise identity; no identity contract was changed.

## Verification

- PASS: bun x oxlint --type-aware apps/chat/tests (165 files, all configured rules, zero diagnostics).
- PASS: bun x oxfmt --check apps/chat/tests (171 files).
- PASS: git diff --check -- apps/chat/tests.
- PASS: apps/chat native approval unit test: 4 tests, 1 file.
- PASS: registry Chromium reasoning and primitive-forwarding browser suites: 3 tests, 2 files. Tests emit React act warnings from primitive lifecycle updates but all assertions pass.
- Not run: provider/database acceptance or live-provider browser suites; these require their configured local services and credentials. Full repo lint/types are coordinator-owned.
- No unresolved executable rule violations remain in the owned subtree. Remaining exceptions are documented above; some can be redesigned as richer mock APIs in follow-up work, but no extra asynchronous work was invented.

## Per-File Counts

Counts are disable directives naming this rule, not callback counts.

| File | Original | Final Retained | Net Removed |
| --- | --: | --: | --: |
| apps/chat/tests/eve-artifact-query.fixture.ts | 1 | 1 | 0 |
| apps/chat/tests/eve-attachments.e2e.ts | 5 | 0 | 5 |
| apps/chat/tests/eve-browser.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-chat-identity.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-code-execution.e2e.ts | 2 | 0 | 2 |
| apps/chat/tests/eve-comparison-live.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-comparison-ui.e2e.ts | 2 | 0 | 2 |
| apps/chat/tests/eve-comparison-ui.mocks.tsx | 1 | 0 | 1 |
| apps/chat/tests/eve-composer-states.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-contracts.e2e.ts | 14 | 0 | 14 |
| apps/chat/tests/eve-conversation-fixture.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-copy-documents-live.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-copy-journal.e2e.ts | 7 | 3 | 4 |
| apps/chat/tests/eve-copy-live.e2e.ts | 2 | 0 | 2 |
| apps/chat/tests/eve-copy-regeneration-live.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-create-recovery.e2e.ts | 4 | 1 | 3 |
| apps/chat/tests/eve-creation-recovery.e2e.ts | 4 | 2 | 2 |
| apps/chat/tests/eve-delete-dialog.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-delete-document.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-delete-family.e2e.ts | 2 | 1 | 1 |
| apps/chat/tests/eve-delete-ui.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-deletion-fence.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-deletion-retire.e2e.ts | 2 | 1 | 1 |
| apps/chat/tests/eve-disposable-guest.e2e.ts | 5 | 0 | 5 |
| apps/chat/tests/eve-disposable-guest.visual.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-document-auto-open.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-document-auto-open.fixture.tsx | 1 | 1 | 0 |
| apps/chat/tests/eve-document-run-fixture.ts | 1 | 1 | 0 |
| apps/chat/tests/eve-document-run.e2e.ts | 2 | 0 | 2 |
| apps/chat/tests/eve-document-tools.e2e.ts | 2 | 1 | 1 |
| apps/chat/tests/eve-documents.e2e.ts | 5 | 0 | 5 |
| apps/chat/tests/eve-editing.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-feedback.e2e.ts | 2 | 0 | 2 |
| apps/chat/tests/eve-files.e2e.ts | 2 | 0 | 2 |
| apps/chat/tests/eve-fixture/agent/tools/confirm-note.ts | 1 | 1 | 0 |
| apps/chat/tests/eve-followups-live.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-followups-ui.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-forks.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-guests.e2e.ts | 7 | 0 | 7 |
| apps/chat/tests/eve-header-parity.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-history.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-idle-checkpoint-live.e2e.ts | 2 | 0 | 2 |
| apps/chat/tests/eve-image.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-live.e2e.ts | 3 | 0 | 3 |
| apps/chat/tests/eve-loading.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-logical-chat.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-mcp-native-approval.test.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-mcp-oauth.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-mcp.e2e.ts | 4 | 0 | 4 |
| apps/chat/tests/eve-message-delivery.visual.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-metadata.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-model-picker.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-optimistic-create.e2e.ts | 2 | 0 | 2 |
| apps/chat/tests/eve-orphan-cleanup.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-payload-purge.e2e.ts | 9 | 8 | 1 |
| apps/chat/tests/eve-pdf.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-project-instructions.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-project-move.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-project-routing.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-project-ui.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-projects.e2e.ts | 3 | 0 | 3 |
| apps/chat/tests/eve-rejected-send.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-research.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-response-cards.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-response-groups.e2e.ts | 2 | 0 | 2 |
| apps/chat/tests/eve-sandbox-lifecycle.e2e.ts | 1 | 1 | 0 |
| apps/chat/tests/eve-save-copy.e2e.ts | 5 | 6 | -1 |
| apps/chat/tests/eve-search.e2e.ts | 2 | 0 | 2 |
| apps/chat/tests/eve-search.visual.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-session-mapping.runtime.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-sharing.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/eve-tool-renderers.e2e.ts | 5 | 0 | 5 |
| apps/chat/tests/eve-tool-selection.e2e.ts | 1 | 0 | 1 |
| apps/chat/tests/fixtures/eve-oauth-mcp-server.ts | 1 | 0 | 1 |
| apps/chat/tests/visual/composer-menu.browser.tsx | 14 | 0 | 14 |
| apps/chat/tests/visual/eve-document-bundles.browser.tsx | 1 | 0 | 1 |
| apps/chat/tests/visual/eve-tool-results.browser.tsx | 1 | 0 | 1 |
| apps/chat/tests/visual/mcp-settings.browser.tsx | 5 | 0 | 5 |
| apps/chat/tests/visual/model-selector-actions.browser.tsx | 1 | 0 | 1 |
| apps/chat/tests/visual/primitive-forwarding.browser.tsx | 2 | 0 | 2 |
| apps/chat/tests/visual/primitive-overlays.browser.tsx | 2 | 0 | 2 |
| apps/chat/tests/visual/prompt-input-heading.browser.tsx | 1 | 0 | 1 |
| apps/chat/tests/visual/reasoning.browser.tsx | 1 | 0 | 1 |
| apps/chat/tests/visual/share-dialog.browser.tsx | 1 | 0 | 1 |
| TOTAL | 182 | 28 | 154 |
