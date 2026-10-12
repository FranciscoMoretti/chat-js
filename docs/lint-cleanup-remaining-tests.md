# Remaining Test Suppression Audit

Scope: apps/chat/tests/** excluding UI-owned new *-lifecycle.browser.tsx, custom-content.browser.tsx, root policy-pages.browser.tsx, and edits to shared primitive-mount.ts. Baseline docs/lint-cleanup-baseline.json. First four rules reported separately. No no-deprecated memberships exist in this subtree. Remaining rules audited in descending subtree original counts, with related unsafe-family fixes grouped to avoid transient untyped boundaries.

Counts are disable-comment memberships, not covered diagnostics. A narrowed original block may become several targeted comments. Per-file Removed=max(Original-Final,0), Retained=min(Original,Final), Added=max(Final-Original,0). Added entries are explicit narrow replacements or newly exposed real React typing boundaries, not newly hidden solvable problems. Unresolved is zero throughout.

## typescript/await-thenable

Original 33; final 7. Second pass extracted renderRoot/unmountRoot from existing primitive-mount completion boundaries; mount/unmount delegate, preserving existing two require-await exceptions rather than adding new ones. 26 duplicate render/unmount act sites reuse these typed harness APIs. Enabled research control click and upload now use genuinely awaited browser locator APIs. Seven remaining sites: disabled native button click; four exact file-bearing ClipboardEvent/DataTransfer dispatch scenarios (including unsupported files/omitted handlers); two correctly typed synchronous native authorization callbacks. Locator text clipboard/element dragging does not synthesize those file payloads. Pinned @types/react/index.d.ts:1895 declares synchronous act overload void; actual react.development.js:902 returns its runtime thenable. No awaits dropped or fake awaited work introduced.

| File under apps/chat/tests | Starting | Removed | Retained | Added narrow | Unresolved |
| --- | --: | --: | --: | --: | --: |
| visual/assertion-contracts.browser.tsx | 2 | 2 | 0 | 0 | 0 |
| visual/composer-menu.browser.tsx | 8 | 3 | 5 | 0 | 0 |
| visual/eve-document-bundles.browser.tsx | 7 | 7 | 0 | 0 | 0 |
| visual/eve-list-identity.browser.tsx | 1 | 1 | 0 | 0 | 0 |
| visual/eve-research-tasks.browser.tsx | 7 | 7 | 0 | 0 | 0 |
| visual/eve-tool-results.browser.tsx | 6 | 6 | 0 | 0 | 0 |
| visual/mcp-settings.browser.tsx | 2 | 0 | 2 | 0 | 0 |

## typescript/no-confusing-void-expression

Original 33; final 7. Same seven awaited act boundaries as await-thenable. Rendering/unmount now reuse the existing shared DOM harness; exact synthetic-event and native callback tests preserve awaited completion.

| File under apps/chat/tests | Starting | Removed | Retained | Added narrow | Unresolved |
| --- | --: | --: | --: | --: | --: |
| visual/assertion-contracts.browser.tsx | 2 | 2 | 0 | 0 | 0 |
| visual/composer-menu.browser.tsx | 8 | 3 | 5 | 0 | 0 |
| visual/eve-document-bundles.browser.tsx | 7 | 7 | 0 | 0 | 0 |
| visual/eve-list-identity.browser.tsx | 1 | 1 | 0 | 0 | 0 |
| visual/eve-research-tasks.browser.tsx | 7 | 7 | 0 | 0 | 0 |
| visual/eve-tool-results.browser.tsx | 6 | 6 | 0 | 0 | 0 |
| visual/mcp-settings.browser.tsx | 2 | 0 | 2 | 0 | 0 |

## func-style

Original 25; final 1. Only retained declaration is visual/mcp-settings.browser.tsx query(): vi.hoisted executes before module initializers. Remaining helpers are const arrows; ordinary scenarios execute after their initializers, including OAuth server handler helpers before listen.

| File under apps/chat/tests | Starting | Removed | Retained | Added narrow | Unresolved |
| --- | --: | --: | --: | --: | --: |
| eve-attachment-fixtures.ts | 1 | 1 | 0 | 0 | 0 |
| eve-attachments.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-browser.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-code-sandboxes.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-copy-journal.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-delete-family.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-delete-ui.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-documents.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-guests.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-idle-checkpoint-live.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-mcp-native-approval.test.ts | 1 | 1 | 0 | 0 | 0 |
| eve-mcp.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-payload-purge.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-postgres-stream-resume.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-projects.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-queue-fence.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-queue-inventory.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-resource-fence.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-run-inventory.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-save-copy.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-test-database.ts | 1 | 1 | 0 | 0 | 0 |
| eve-usage-cursor.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-votes.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| fixtures/eve-oauth-mcp-server.ts | 1 | 1 | 0 | 0 | 0 |
| visual/mcp-settings.browser.tsx | 1 | 0 | 1 | 0 | 0 |

## require-await

Original 18; final 22. Dynamic native callbacks read current registration state, record calls, create fresh IDs or throw asynchronously. Repeated UUID allocators now share eve-native-session.fixture.ts, which generates a new UUID on each invocation. Pure fixed replies/models/rejections use typed Vitest settled mock APIs. Remaining exceptions scoped to individual function expressions, not whole files. React fixture async act callbacks preserve the existing supported completion overload without fake awaits; primitive-mount.ts was excluded from edits by ownership.

| File under apps/chat/tests | Starting | Removed | Retained | Added narrow | Unresolved |
| --- | --: | --: | --: | --: | --: |
| eve-code-sandboxes.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-contracts.e2e.ts | 1 | 0 | 1 | 3 | 0 |
| eve-documents.e2e.ts | 1 | 0 | 1 | 0 | 0 |
| eve-file-storage.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-files.e2e.ts | 1 | 0 | 1 | 1 | 0 |
| eve-guests.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-mcp-native-approval.test.ts | 1 | 1 | 0 | 0 | 0 |
| eve-native-session.fixture.ts | 0 | 0 | 0 | 1 | 0 |
| eve-orphan-cleanup.e2e.ts | 1 | 0 | 1 | 0 | 0 |
| eve-projects.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-response-groups.e2e.ts | 1 | 0 | 1 | 6 | 0 |
| eve-usage-cursor.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-votes.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| visual/eve-contexts.browser.tsx | 1 | 0 | 1 | 0 | 0 |
| visual/native-eve-services.ts | 2 | 0 | 2 | 0 | 0 |
| visual/primitive-mount.ts | 2 | 0 | 2 | 0 | 0 |
| visual/primitive-overlays.browser.tsx | 1 | 0 | 1 | 0 | 0 |

## typescript/no-unsafe-assignment

Original 18; final 0. Removed all original sites: typed native request/mutation mocks, unknown annotations for whole raw payload assertions, typed passthrough schema checks for fields actually accessed. Asymmetric matcher properties now use unknown values or equivalent toHaveProperty matcher assertions.

| File under apps/chat/tests | Starting | Removed | Retained | Added narrow | Unresolved |
| --- | --: | --: | --: | --: | --: |
| eve-contracts.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-create-recovery.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-idle-checkpoint-live.e2e.ts | 4 | 4 | 0 | 0 | 0 |
| eve-live.e2e.ts | 4 | 4 | 0 | 0 | 0 |
| eve-loading.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-local-snapshots.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-resource-fence.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-save-copy.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-session-mapping.runtime.e2e.ts | 2 | 2 | 0 | 0 | 0 |
| eve-tool-selection.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| visual/eve-document-bundles.browser.tsx | 1 | 1 | 0 | 0 | 0 |

## typescript/strict-void-return

Original 17; final 1. Only retained Node promisify(execFile) ABI boundary: execFile returns ChildProcess while completing through Node callback; promisify owns completion. Typed void mocks and genuinely no-op preview callbacks fixed all other live sites; stale broad blocks removed.

| File under apps/chat/tests | Starting | Removed | Retained | Added narrow | Unresolved |
| --- | --: | --: | --: | --: | --: |
| eve-browser.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-comparison-ui.mocks.tsx | 1 | 1 | 0 | 0 | 0 |
| eve-contracts.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-deletion-retire.e2e.ts | 1 | 0 | 1 | 0 | 0 |
| eve-disposable-guest.fixture.tsx | 1 | 1 | 0 | 0 | 0 |
| eve-feedback.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-fixture/agent/agent.ts | 1 | 1 | 0 | 0 | 0 |
| eve-mcp.e2e.ts | 5 | 5 | 0 | 0 | 0 |
| eve-queue-cancellation.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| fixtures/eve-oauth-mcp-server.ts | 1 | 1 | 0 | 0 | 0 |
| visual/composer-menu.browser.tsx | 1 | 1 | 0 | 0 | 0 |
| visual/mcp-settings.browser.tsx | 1 | 1 | 0 | 0 | 0 |
| visual/share-dialog.browser.tsx | 1 | 1 | 0 | 0 | 0 |

## typescript/no-unsafe-member-access

Original 16; final 0. Removed all sites using honest typed mock callbacks or z.looseObject field checks. Passthrough schemas preserve unknown fields; assertions still examine the actual native request and persisted JSON, not constructed replacements.

| File under apps/chat/tests | Starting | Removed | Retained | Added narrow | Unresolved |
| --- | --: | --: | --: | --: | --: |
| eve-comparison-live.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-create-recovery.e2e.ts | 2 | 2 | 0 | 0 | 0 |
| eve-editing.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-idle-checkpoint-live.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-live.e2e.ts | 3 | 3 | 0 | 0 | 0 |
| eve-loading.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-local-snapshots.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-session-mapping.runtime.e2e.ts | 4 | 4 | 0 | 0 | 0 |
| visual/mcp-settings.browser.tsx | 2 | 2 | 0 | 0 | 0 |

## promise/avoid-new

Original 10; final 12. Remaining constructors adapt callback-only HTTP listen/close, UTF-8 stream events, and double requestAnimationFrame completion. Externally released browser void gate retains its no-argument resolver; experiment with withResolvers<void>() produced configured no-invalid-void-type. Timer-only constructors replaced with node:timers/promises delay; stale whole-file suppressions removed. Narrow statement directives can outnumber original file-wide directives while covering fewer operations.

| File under apps/chat/tests | Starting | Removed | Retained | Added narrow | Unresolved |
| --- | --: | --: | --: | --: | --: |
| eve-browser.e2e.ts | 1 | 0 | 1 | 0 | 0 |
| eve-contracts.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-create-recovery.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-feedback.e2e.ts | 1 | 0 | 1 | 0 | 0 |
| eve-fixture/agent/agent.ts | 1 | 1 | 0 | 0 | 0 |
| eve-history.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-mcp.e2e.ts | 1 | 0 | 1 | 4 | 0 |
| eve-project-move.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-queue-cancellation.e2e.ts | 1 | 0 | 1 | 1 | 0 |
| fixtures/eve-oauth-mcp-server.ts | 1 | 0 | 1 | 2 | 0 |

## typescript/no-unsafe-return

Original 7; final 0. Removed using Promise<unknown>/unknown return contracts for parsed whole payloads and typed native request/mutation mocks.

| File under apps/chat/tests | Starting | Removed | Retained | Added narrow | Unresolved |
| --- | --: | --: | --: | --: | --: |
| eve-create-recovery.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-deletion-retire.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-idle-checkpoint-live.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-save-copy.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-session-mapping.runtime.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| visual/mcp-settings.browser.tsx | 2 | 2 | 0 | 0 | 0 |

## typescript/no-unsafe-argument

Original 3; final 0. Removed using typed request mock signatures and explicit shape checks before passing native receipt IDs/checkpoint fields to APIs.

| File under apps/chat/tests | Starting | Removed | Retained | Added narrow | Unresolved |
| --- | --: | --: | --: | --: | --: |
| eve-idle-checkpoint-live.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-save-copy.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| eve-session-mapping.runtime.e2e.ts | 1 | 1 | 0 | 0 | 0 |

## typescript/no-unsafe-call

Original 3; final 0. Removed using typed captured mutation callbacks; missing callbacks now fail explicitly before invocation.

| File under apps/chat/tests | Starting | Removed | Retained | Added narrow | Unresolved |
| --- | --: | --: | --: | --: | --: |
| eve-idle-checkpoint-live.e2e.ts | 1 | 1 | 0 | 0 | 0 |
| visual/mcp-settings.browser.tsx | 2 | 2 | 0 | 0 | 0 |

## unicorn/prefer-ternary

Original 2; final 2. Two sidebar flows await exactly one click according to visible control. Configured eslint/no-ternary forbids the suggested alternate syntax; existing branches preserve selection and awaiting.

| File under apps/chat/tests | Starting | Removed | Retained | Added narrow | Unresolved |
| --- | --: | --: | --: | --: | --: |
| eve-browser.e2e.ts | 1 | 0 | 1 | 0 | 0 |
| eve-delete-ui.e2e.ts | 1 | 0 | 1 | 0 | 0 |

## unicorn/prefer-structured-clone

Original 1; final 1. One JSON wire-roundtrip intentionally omits receipt updates:undefined; structuredClone retains the field and changes the wire contract under test.

| File under apps/chat/tests | Starting | Removed | Retained | Added narrow | Unresolved |
| --- | --: | --: | --: | --: | --: |
| eve-contracts.e2e.ts | 1 | 0 | 1 | 0 | 0 |

## Verification

- Full configured native oxlint --type-aware apps/chat/tests: zero diagnostics across 175 files.
- Initial Chromium pass: 51 tests passed across six suites; second-pass shared harness verification: 60 tests passed across 11 suites, including all changed render/unmount sites and existing custom-content/auth harness consumers. Existing captures retained. React act console warnings remain non-failing. Logs /tmp/tests-remaining-browser.log and /tmp/tests-remaining-browser-second.log.
- Isolated native approval and test-database guards: 8 tests passed. Log /tmp/tests-remaining-unit.log.
- Node24 direct OAuth/MCP fixture protocol check: six checks passed and server close completed.
- Native oxfmt applied within owned baseline paths and new native-session helper.
- No live PostgreSQL/worker/provider acceptance suites run; preserved their assertions and requested integrated app types from coordinator. E2E Vitest suites were not sent to Playwright.
- No dependencies, config, public application API changes, commits or PR.
