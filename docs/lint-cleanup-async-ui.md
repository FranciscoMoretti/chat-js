# UI/site promise-function-async audit

Scope: apps/chat/components/** and apps/site/**, 14 original matching files. Original: 29 actual type-aware rule sites under 15 disable directives. Final: 24 sites resolved; 5 local exceptions in 4 files remain explicitly unresolved; all original broad first-rule scopes and matching enables removed. Other suppressed rules preserved.

## Verification

- bunx oxlint --type-aware apps/chat/components apps/site --format json: exit 0, zero diagnostics in 225 files.
- apps/chat bunx vitest run components lib/eve/optimistic-metadata.test.ts: 6 files, 22 tests passed.
- packages/registry bunx vitest run --config visual/vitest.config.ts model-selector-actions model-selector-concurrency eve-conversation eve-artifact fork-cleanup chat-rename share-menu-item share-dialog: 8 files, 26 tests passed. Includes live rejection/retry, optimistic model update order, concurrent selection, fork lifecycle, artifact and conversation captures, and synchronous share rendering.
- bun test:visual:site with bun dev:site: passed interaction checks and wrote 9 deterministic screenshots (desktop/mobile/dark, live/stopped/complete, new branch, docs/install links). Site dev server stopped cleanly after smoke. Inspected threads-mobile-live.png: streaming chat, controls, map, and mobile composition render without overlap.
- git diff --check -- apps/chat/components apps/site: exit 0.
- UI Verify cloud preview attempted with sanitized fixture archive in packages/registry/uiverify-archive; unavailable because UIVERIFY_API_KEY is unset. /tmp/ui-uiverify-check.log contains '[uiverify] ... UIVERIFY_API_KEY is required'. No cloud pixel baseline verdict is claimed.
- Existing captures reused; site capture implementation updated to await actual font readiness and link attribute reads in this change. No new visual states, layout, style, or markup added. Existing model concurrency/action captures verify pre-await optimistic order and producer failures.
- Read making-ui-changes, economical-visual-tests, check-visual-changes, vitest-visual-testing, strategic-testing, trpc-patterns, worktree-ports. No new tests added for mechanical await changes; meaningful existing behavior assertions and capture tests were run.

## Per-file counts

| File | Original disables | Resolved sites | Retained sites | Final disables |
| --- | --: | --: | --: | --: |
| apps/chat/components/device-login-page.test.tsx | 1 | 1 | 0 | 0 |
| apps/site/components/thread-showcase.tsx | 1 | 2 | 0 | 0 |
| apps/chat/components/sidebar-chat-item.tsx | 1 | 0 | 1 | 1 |
| apps/site/components/thread-playground-model.ts | 1 | 0 | 2 | 2 |
| apps/chat/components/ai-elements/code-block.test.tsx | 1 | 1 | 0 | 0 |
| apps/site/tests/thread-playground.visual.ts | 1 | 2 | 0 | 0 |
| apps/chat/components/project-chat-item.tsx | 1 | 0 | 1 | 1 |
| apps/chat/components/eve/use-eve-metadata-mutations.ts | 1 | 3 | 0 | 0 |
| apps/chat/components/model-selector.tsx | 1 | 1 | 0 | 0 |
| apps/chat/components/eve/eve-conversation.tsx | 1 | 6 | 0 | 0 |
| apps/chat/components/eve/use-document-draft.ts | 1 | 1 | 0 | 0 |
| apps/chat/components/eve/use-eve-fork.ts | 1 | 4 | 1 | 1 |
| apps/chat/components/eve/eve-artifact-layout.tsx | 2 | 2 | 0 | 0 |
| apps/chat/components/eve/eve-feedback-actions.tsx | 1 | 1 | 0 | 0 |

## Remaining sites / unresolved

### apps/chat/components/sidebar-chat-item.tsx

- Line 173: ReactNode includes promises, but this render callback must retain synchronous element results for the client share dialog.

### apps/site/components/thread-playground-model.ts

- Line 163: The demo has no reconnectable backend stream; this no-work transport result has no asynchronous operation to await.
- Line 165: Stream construction and its initial enqueues happen synchronously; awaiting token production here would postpone returning the streaming body.

### apps/chat/components/project-chat-item.tsx

- Line 136: ReactNode includes promises, but this render callback must retain synchronous element results for the client share dialog.

### apps/chat/components/eve/use-eve-fork.ts

- Line 405: This action only commits local selection synchronously and resolves; there is no asynchronous operation to await.

The ReactNode callbacks have mixed synchronous and Promise-capable types, but client rendering needs the synchronous element path. Converting them to async would change rendered values into promises. The local model setter only updates state and resolves. Playground reconnect has no backend, and sendMessages immediately constructs a ReadableStream whose async start owns token waits: waiting for those token delays in sendMessages would break streaming. These are not claimed as eliminated; no fabricated awaits or config changes were added.

## Behavior evidence

Async callbacks now await actual metadata operations, fork execution, commands, cancellation, document actions, voting, and sibling run creation. The model producer is still invoked before startTransition, and optimistic state is still updated synchronously before awaiting its completion, preserving the latest-selection send behavior. Cancellation/formatting test fixtures await real controllable pending gates. Redundant forwarding callbacks removed for document retry and playground onSend; same existing function is passed directly. No public APIs, dependencies, lint configuration, styles, or DOM structure changed.
