# Remaining UI Rule Audit

Owned original baseline: 265 memberships. This report's remaining-rule pass excludes the four previously audited priority rules: 84 memberships, 76 removed, 8 retained, zero unresolved. Current scope and all own lifecycle fixtures pass focused type-aware lint. Root owns integrated verification and generators.

## Verified Milestones

- Shiki raw HTML replaced with native React token rendering. Preserves two themes, line numbering, foreground/background and token font styles. New browser test proves HTML-like source remains text and pre remains keyboard-focusable. Screenshot inspected: native lines and token styles visible, no injected image. Stale highlights cannot overwrite streamed source. Chromium 2 tests pass.
- Shared withTaskCleanup keeps awaited operation/cleanup semantics and failure precedence, including synchronous cleanup before settlement. Removed compiler-unsupported async try/finally from nine operation boundaries; task-cleanup unit coverage tests success, failure, awaited cleanup and cleanup rejection precedence.
- Removed unsafe array narrowing in message branches and ambiguous function/object narrowing for artifact metadata. Branch context now honestly accepts readonly ReactNode[] matching children contract, without React.Children key rewriting.
- All 13 original strict-void-return and all 9 original consistent-return memberships removed. Explicit (() => void) | undefined cleanup annotations preserve genuine conditional resource cleanup; no no-op cleanup or synthetic await.
- Site observer effects: removed 2 previously retained no-useless-undefined exceptions using explicit cleanup return annotations.
- Speech browser API readiness now uses a true subscription/snapshot store. Browser test verifies readiness, start/stop, callback replacement cleanup and unmount cleanup. No set-state-in-effect exception.
- Composer draft session storage now uses a scoped subscription/snapshot store, with stable cached snapshots and synchronous functional updates. Two native browser tests verify scope restoration/isolation, synchronous persistence, restore/save failures and in-memory preservation.
- Removed EveMessages render callback closure mutation: compute preceding-user lookup in a single ordered pass, then render without mutating captured state.
- Creation/conversation test interactions await React act around actual browser actions and controlled promise rejection. No fake resolved microtask await.

## Focused Verification

- Final /tmp/ui-final-focused-browser.log: 6 files, 13 Chromium tests passed, no React act warnings (chat models2, code block2, speech1, composer draft2, native boundaries4, creation cleanup2).
- Final /tmp/ui-final-unit.log: 3 files, 6 unit/SSR tests passed (task cleanup2, optional content3, responsive SSR1).
- Artifact decomposition /tmp/ui-artifact-browser.log: 2 files, 4 Chromium tests passed. Streaming artifact screenshot inspected after refactor; panel/content framing remains intact. Existing suite emits Radix/Panel warnings, recorded below.

- /tmp/ui-remaining-browser-followup.log: 5 Chromium tests passed (code-block lifecycle 2, creation cleanup 2, conversation 1), no React act warnings.
- /tmp/ui-subscriptions-browser.log: 16 Chromium tests passed (fork lifecycle 12, speech 1, conversation 1, creation cleanup 2), no React act warnings.
- /tmp/ui-draft-browser.log: 2 Chromium composer draft tests passed.
- Safe highlight screenshot inspected: apps/chat/tests/visual/**screenshots**/code-block-lifecycle.browser.tsx/highlighted-tokens-preserve-source-text--line-numbers--styling-and-keyboard-focus-1.png.

## Final Implementation Follow-Up

- All eight state-in-effect memberships removed by real storage/browser subscription models and recovered-operation snapshots. No callback merely hides a local React setState effect. Async_e2e owns document/delivery/navigation migration and its nine storage lifecycle tests; this report includes their final scoped ledger. Own fork12 + creation2 pass after snapshot migration. Stable public draft/tool setters preserve functional updates.
- All five complexity memberships removed by domain selectors and focused rendering units: recovery status, server recovery scope, Artifact header/content/assistant/footer with one shared state model; root decomposed message rows/actions and async_e2e decomposed conversation controller/views. No duplicated queries or editor models.
- Runtime registry keeps mounted identity in a ref accessed only inside event callbacks/effects, eliminating the setterless state exception without render-time ref reads.
- Shimmer uses a callback-ref animation lifecycle rather than an extra dependency: stops the old DOM animation, binds the replacement polymorphic element, stops on unmount. Native browser test verifies all three.
- Canonical MCP create dialog resets advanced expansion on guarded open-prop change, leaving mounted form/mutation lifetime intact. Attachment upload uses a module-local cleanup helper with genuine finally release, preserving serialization and memory bound. No new installation dependency. Root demo/template sync passed; MCP19 and composer20 browser tests pass afterward.
- Native-boundaries4, composer-draft2 and speech1 new browser tests pass. Artifact/document4 pass after decomposition. Existing suite Radix/ImagePreview act warning noise remains in MCP/composer and artifact fixtures; tests pass and warnings are not suppressed. Root is running full browser verification.
- ChatModels lifecycle migrated callbacks now discard push results explicitly; removed the old broad strict-void suppression entirely.

## Concrete Retentions

1. PromptInputButton React.Children.count preserves opaque null/boolean slots, nested array traversal, and fragments as single children. Native-boundaries test proves sm/sm/icon-sm outcomes; Children.toArray or manual flattening changes these outcomes.
2. ModelsTable immutable initialSort is a mounted snapshot, not a derivable live sort: models-table.browser test explicitly verifies toggles, rollback/search, and reset on remount. A ref read during render is disallowed; useMemo is not identity storage. No unused setter was introduced.
3. Favicon exposes React.ImgHTMLAttributes including string dimensions/srcSet, forwards native browser attributes, and reveals the adjacent sibling on image error. Native-boundaries test proves string width/referrerPolicy and fallback. Next Image narrows this public native-image contract.
4. Sidebar Cookie Store compatibility fallback must persist preference when that API is absent. Native-boundaries removes the property and checks sidebar_state=false in document.cookie.
5. DevLoginTool anchors /api/dev-login, whose route sets the authentication cookie then performs a full-document redirect. This endpoint is not a Next page transition. The existing API route tests cover response/auth redirect behavior.
6. InternalLink has two generated Route assertions: its existing public string/URL href is used by dynamic conversation/project/sidebar links; Electron modified/auxiliary-click handling reads the actual rendered anchor href before router.push. Generated route literals cannot represent arbitrary runtime URLs. No fake validator or public API narrowing was added.
7. Site stream emits each word after a cancellable per-token delay. Concurrent delays collapse visible cadence and permit emissions after abort; existing completed/stopped site visual scenarios exercise both paths.

Prior async5 and required-undefined9 retentions are recorded separately; updated undefined ledger removes five cases, including both site observer callbacks. One new visible accessibility exception preserves Shiki's existing pre tabIndex=0 keyboard-scroll behavior, verified by native focus test, formerly hidden inside raw HTML.

## Per-File Rule Ledger

| File | Rule | Original | Removed | Retained |
| --- | --- | --: | --: | --: |
| apps/chat/components/ai-elements/code-block.tsx | react/no-danger | 2 | 2 | 0 |
| apps/chat/components/ai-elements/message.tsx | typescript/no-unsafe-assignment | 1 | 1 | 0 |
| apps/chat/components/ai-elements/message.tsx | typescript/no-unsafe-member-access | 1 | 1 | 0 |
| apps/chat/components/ai-elements/message.tsx | typescript/no-unsafe-return | 1 | 1 | 0 |
| apps/chat/components/ai-elements/prompt-input.tsx | react/no-react-children | 1 | 0 | 1 |
| apps/chat/components/ai-elements/prompt-input.tsx | react/set-state-in-effect | 1 | 1 | 0 |
| apps/chat/components/ai-elements/reasoning.tsx | typescript/consistent-return | 1 | 1 | 0 |
| apps/chat/components/ai-elements/shimmer.tsx | react/exhaustive-effect-dependencies | 1 | 1 | 0 |
| apps/chat/components/attachment-list.tsx | react/todo | 2 | 2 | 0 |
| apps/chat/components/composer/tool-display.ts | typescript/consistent-return | 1 | 1 | 0 |
| apps/chat/components/dev-login-tool.tsx | next/no-html-link-for-pages | 1 | 0 | 1 |
| apps/chat/components/device-login-page.test.tsx | typescript/no-unsafe-call | 1 | 1 | 0 |
| apps/chat/components/device-login-page.tsx | typescript/consistent-return | 1 | 1 | 0 |
| apps/chat/components/electron-auth-handler.tsx | typescript/consistent-return | 2 | 2 | 0 |
| apps/chat/components/electron-auth-handler.tsx | typescript/prefer-nullish-coalescing | 1 | 1 | 0 |
| apps/chat/components/eve/disposable-guest-chat.tsx | typescript/prefer-nullish-coalescing | 1 | 1 | 0 |
| apps/chat/components/eve/eve-artifact-layout.tsx | complexity | 1 | 1 | 0 |
| apps/chat/components/eve/eve-artifact-layout.tsx | typescript/prefer-nullish-coalescing | 1 | 1 | 0 |
| apps/chat/components/eve/eve-artifact-layout.tsx | typescript/strict-void-return | 1 | 1 | 0 |
| apps/chat/components/eve/eve-attachment.tsx | typescript/consistent-return | 1 | 1 | 0 |
| apps/chat/components/eve/eve-chat-page.tsx | complexity | 1 | 1 | 0 |
| apps/chat/components/eve/eve-composer.tsx | typescript/prefer-nullish-coalescing | 1 | 1 | 0 |
| apps/chat/components/eve/eve-conversation.tsx | complexity | 1 | 1 | 0 |
| apps/chat/components/eve/eve-conversation.tsx | react/todo | 2 | 2 | 0 |
| apps/chat/components/eve/eve-conversation.tsx | typescript/strict-void-return | 1 | 1 | 0 |
| apps/chat/components/eve/eve-conversation.tsx | unicorn/prefer-ternary | 2 | 2 | 0 |
| apps/chat/components/eve/eve-copy-button.tsx | react/todo | 1 | 1 | 0 |
| apps/chat/components/eve/eve-copy-button.tsx | typescript/prefer-nullish-coalescing | 1 | 1 | 0 |
| apps/chat/components/eve/eve-copy-button.tsx | typescript/strict-void-return | 1 | 1 | 0 |
| apps/chat/components/eve/eve-creation-recovery.tsx | complexity | 1 | 1 | 0 |
| apps/chat/components/eve/eve-creation-recovery.tsx | react/set-state-in-effect | 1 | 1 | 0 |
| apps/chat/components/eve/eve-creation-recovery.tsx | react/todo | 2 | 2 | 0 |
| apps/chat/components/eve/eve-creation-recovery.tsx | typescript/strict-void-return | 1 | 1 | 0 |
| apps/chat/components/eve/eve-delete-dialog.tsx | react/todo | 2 | 2 | 0 |
| apps/chat/components/eve/eve-deletion-provider.tsx | react/todo | 1 | 1 | 0 |
| apps/chat/components/eve/eve-document-assistant-actions.tsx | typescript/strict-void-return | 1 | 1 | 0 |
| apps/chat/components/eve/eve-feedback-actions.tsx | typescript/strict-void-return | 1 | 1 | 0 |
| apps/chat/components/eve/eve-fork-recovery.tsx | typescript/strict-void-return | 1 | 1 | 0 |
| apps/chat/components/eve/eve-history-list.tsx | typescript/consistent-return | 1 | 1 | 0 |
| apps/chat/components/eve/eve-history-list.tsx | typescript/prefer-nullish-coalescing | 1 | 1 | 0 |
| apps/chat/components/eve/eve-logical-group-recovery.tsx | react/todo | 2 | 2 | 0 |
| apps/chat/components/eve/eve-logical-group-recovery.tsx | typescript/strict-void-return | 1 | 1 | 0 |
| apps/chat/components/eve/eve-logical-navigation.tsx | react/set-state-in-effect | 1 | 1 | 0 |
| apps/chat/components/eve/eve-messages.tsx | complexity | 1 | 1 | 0 |
| apps/chat/components/eve/eve-messages.tsx | react/immutability | 1 | 1 | 0 |
| apps/chat/components/eve/eve-messages.tsx | typescript/prefer-nullish-coalescing | 1 | 1 | 0 |
| apps/chat/components/eve/eve-messages.tsx | typescript/strict-void-return | 1 | 1 | 0 |
| apps/chat/components/eve/eve-model-picker.tsx | typescript/prefer-nullish-coalescing | 2 | 2 | 0 |
| apps/chat/components/eve/eve-model-picker.tsx | typescript/strict-void-return | 1 | 1 | 0 |
| apps/chat/components/eve/eve-optimistic-response-group.test.tsx | typescript/no-unsafe-return | 1 | 1 | 0 |
| apps/chat/components/eve/eve-runtime-provider.tsx | react/hook-use-state | 1 | 1 | 0 |
| apps/chat/components/eve/new-eve-conversation.tsx | react/set-state-in-effect | 1 | 1 | 0 |
| apps/chat/components/eve/new-eve-conversation.tsx | react/todo | 2 | 2 | 0 |
| apps/chat/components/eve/new-eve-conversation.tsx | typescript/strict-void-return | 1 | 1 | 0 |
| apps/chat/components/eve/use-document-draft.ts | react/set-state-in-effect | 1 | 1 | 0 |
| apps/chat/components/eve/use-document-draft.ts | react/todo | 2 | 2 | 0 |
| apps/chat/components/eve/use-document-draft.ts | typescript/consistent-return | 1 | 1 | 0 |
| apps/chat/components/eve/use-document-draft.ts | typescript/strict-void-return | 1 | 1 | 0 |
| apps/chat/components/eve/use-eve-composer-draft.ts | react/set-state-in-effect | 1 | 1 | 0 |
| apps/chat/components/eve/use-eve-fork.ts | react/set-state-in-effect | 1 | 1 | 0 |
| apps/chat/components/eve/use-eve-fork.ts | react/todo | 3 | 3 | 0 |
| apps/chat/components/eve/use-eve-message-delivery.ts | react/set-state-in-effect | 1 | 1 | 0 |
| apps/chat/components/favicon.tsx | next/no-img-element | 1 | 0 | 1 |
| apps/chat/components/internal-link.tsx | typescript/no-unsafe-type-assertion | 2 | 0 | 2 |
| apps/chat/components/settings/models-table.tsx | react/hook-use-state | 1 | 0 | 1 |
| apps/chat/components/ui/sidebar.tsx | unicorn/no-document-cookie | 1 | 0 | 1 |
| apps/chat/hooks/use-artifact.tsx | typescript/no-unsafe-assignment | 1 | 1 | 0 |
| apps/chat/hooks/use-auto-focus.ts | typescript/consistent-return | 1 | 1 | 0 |
| apps/chat/providers/chat-models-provider.test.tsx | typescript/strict-void-return | 1 | 1 | 0 |
| apps/site/components/thread-playground-model.ts | no-await-in-loop | 1 | 0 | 1 |

Additional canonical handoffs: mcp-create-dialog react/set-state-in-effect 1/1/0; attachment integration react/todo 1/1/0. These are outside the original app-scope ledger above.
