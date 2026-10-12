# UI strict-boolean-expressions audit

Original baseline: 47 memberships in 36 owned files. Removed 47, retained 0, unresolved 0. Generated app files from demo-baseline.json were excluded (connectors-settings, mcp-connect-dialog, mcp-create-dialog), and hooks/providers had no original membership. Counts refer to suppression memberships, not individual hidden diagnostics.

| File (relative to repo) | Starting | Removed | Retained |
| --- | --: | --: | --: |
| apps/chat/components/ai-elements/code-block.tsx | 1 | 1 | 0 |
| apps/chat/components/ai-elements/context.tsx | 4 | 4 | 0 |
| apps/chat/components/ai-elements/conversation.tsx | 1 | 1 | 0 |
| apps/chat/components/ai-elements/message.tsx | 1 | 1 | 0 |
| apps/chat/components/electron-auth-handler.tsx | 1 | 1 | 0 |
| apps/chat/components/eve/disposable-guest-chat.tsx | 2 | 2 | 0 |
| apps/chat/components/eve/eve-artifact-layout.tsx | 3 | 3 | 0 |
| apps/chat/components/eve/eve-attachment.tsx | 1 | 1 | 0 |
| apps/chat/components/eve/eve-chat-header.tsx | 1 | 1 | 0 |
| apps/chat/components/eve/eve-chat-page.tsx | 1 | 1 | 0 |
| apps/chat/components/eve/eve-composer.tsx | 2 | 2 | 0 |
| apps/chat/components/eve/eve-conversation.tsx | 1 | 1 | 0 |
| apps/chat/components/eve/eve-copy-button.tsx | 1 | 1 | 0 |
| apps/chat/components/eve/eve-creation-recovery.tsx | 1 | 1 | 0 |
| apps/chat/components/eve/eve-deletion-provider.tsx | 1 | 1 | 0 |
| apps/chat/components/eve/eve-document-tool.tsx | 1 | 1 | 0 |
| apps/chat/components/eve/eve-history-list.tsx | 1 | 1 | 0 |
| apps/chat/components/eve/eve-logical-group-recovery.tsx | 1 | 1 | 0 |
| apps/chat/components/eve/eve-mcp-result.tsx | 1 | 1 | 0 |
| apps/chat/components/eve/eve-messages.tsx | 2 | 2 | 0 |
| apps/chat/components/eve/eve-model-picker.tsx | 1 | 1 | 0 |
| apps/chat/components/eve/eve-move-project-dialog.tsx | 1 | 1 | 0 |
| apps/chat/components/eve/eve-runtime-provider.tsx | 1 | 1 | 0 |
| apps/chat/components/eve/eve-search-chats.tsx | 1 | 1 | 0 |
| apps/chat/components/eve/eve-tool-result.tsx | 1 | 1 | 0 |
| apps/chat/components/eve/new-eve-conversation.tsx | 1 | 1 | 0 |
| apps/chat/components/eve/use-document-draft.ts | 1 | 1 | 0 |
| apps/chat/components/eve/use-eve-fork.ts | 2 | 2 | 0 |
| apps/chat/components/model-selector.tsx | 1 | 1 | 0 |
| apps/chat/components/part/document-common.tsx | 1 | 1 | 0 |
| apps/chat/components/part/web-search.tsx | 1 | 1 | 0 |
| apps/chat/components/project-chat-item.tsx | 1 | 1 | 0 |
| apps/chat/components/settings/model-row.tsx | 1 | 1 | 0 |
| apps/chat/components/user-message-view.tsx | 1 | 1 | 0 |
| apps/site/components/thread-playground-model.ts | 1 | 1 | 0 |
| apps/site/components/thread-showcase.tsx | 3 | 3 | 0 |

## Semantic decisions

- Nullable boolean flags compare === true; undefined/null remain false. String IDs, errors, names and drafts use hasText: only nonempty strings pass, including whitespace. nonEmptyText normalizes only null/undefined/empty strings before ?? fallback selection in model-picker, guest failure and Electron authentication. Helpers evaluate values once and introduce no Boolean coercions or casts.
- ReactNode custom chrome uses hasCustomContent: excludes false/null/undefined/empty string/0/-0/0n/NaN, retaining all other historical truthy children (including true and empty arrays). code-block, conversation icon and user-message editor retain the original falsy child as the false ternary branch, preserving raw numeric DOM children. context usage and MessageAttachments instead retain their existing default/null behavior. No public prop types changed.
- Project updatedAt explicitly excludes undefined/empty string while retaining Date values. Initial-message union explicitly excludes undefined/empty string while retaining draft objects. Site indexed messages and siblings compare to undefined; negative-index behavior was not changed to Array.at.
- Existing unrelated changes from concurrent agents were preserved, including async callbacks. No config/dependency/generator changes.

## Verification

- Scoped oxlint --type-aware across components/hooks/providers/site and new browser test: zero diagnostics, /tmp/ui-boolean-final-lint.json.
- Vitest optional-content plus existing code-block: 4 tests pass. Characterizes every falsy React child, whitespace, nonempty strings, numbers, arrays, fallback normalization.
- Existing Chromium browser captures: model-selector, eve-artifact, composer-menu, code-copy: 26 tests pass. Expected React act warnings and intentional error-boundary logs remain.
- Additional Chromium recovery fixtures eve-conversation, creation-cleanup and fork-cleanup: 4 tests pass. Total browser tests31, /tmp/ui-boolean-recovery-visual.log.
- New custom-content.browser.tsx: 1 Chromium test passes; one compact canvas verifies zero raw children, omitted empty chrome/attachments, default token usage and custom usage. Shiki is stubbed only for deterministic highlighting outside this test's scope; initial run exposed optimizer reload/wasm failure, resolved with this fixture boundary.
- Inspected new screenshot apps/chat/tests/visual/**screenshots**/custom-content.browser.tsx/optional-content-preserves-raw-zero-and-default-usage-without-empty-chrome-1.png: zero preserved, no empty toolbar/icon chrome, two default token rows, custom content visible, no overlap.
- Site test:visual:site passed; inspected threads-mobile-live.png and threads-live-and-stopped.png: coherent responsive layout, active/stopped branches, correct status/control states. Local server used discovered worktree port3012 and was stopped afterward.
- Site direct tsc passed. Initial chat direct tsc had only external apps/chat/agent/hooks/billing.ts54 nullable-string error. Final rerun after new browser test has concurrent lib/tools errors only, no components/hooks/providers/site or new browser-test errors; /tmp/ui-boolean-chat-types-final.log reported to parent. Parent runs integrated checks.
- UI Verify scoped preview could not run: UIVERIFY_API_KEY is absent, including through .env.local. /tmp/ui-boolean-uiverify.log. Local browser captures and screenshot inspection completed instead. No preview or CI baseline accepted.
