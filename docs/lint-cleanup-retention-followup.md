# Independent Retention Audit Follow-Up

Read-only review used the current inventory structure from `/tmp/lint-current.cjs`, `docs/lint-cleanup-current.json`, area reports, and actual suppression bodies. Did not execute the inventory generator or global checks. Parent authorized only the five exact files below for the resulting concrete fixes.

## Implemented Sites

| File | Rule | Before follow-up | Final | Removed | Retained | Unresolved |
| --- | --- | --: | --: | --: | --: | --: |
| apps/chat/tests/visual/primitive-overlays.browser.tsx | require-await | 1 | 0 | 1 | 0 | 0 |
| apps/chat/tests/visual/mcp-settings.browser.tsx | func-style | 1 | 0 | 1 | 0 | 0 |
| apps/chat/tests/eve-create-recovery.e2e.ts | typescript/promise-function-async | 1 | 0 | 1 | 0 | 0 |
| apps/chat/tests/eve-deletion-retire.e2e.ts | typescript/promise-function-async | 1 | 0 | 1 | 0 | 0 |
| apps/chat/tests/eve-copy-journal.e2e.ts | typescript/promise-function-async | 3 | 2 | 1 | 2 | 0 |

- Primitive progress rerender reuses the existing `renderRoot` actual async act completion boundary. All exact transform assertions and capture positions remain unchanged.
- MCP query construction now uses a typed name-driven object table inside `vi.hoisted`. Every queryKey/queryOptions value remains identical. Simply moving a query arrow into that factory exposed `consistent-function-scoping`; the data-driven table genuinely removes the duplicated builder requirement without a replacement exception or meaningless capture.
- Two fixed rejection callbacks use typed `vi.fn().mockRejectedValue(...)`. Although these are Playwright Node suites, the pinned Vitest mock API works standalone: a direct Node24 ESM experiment from apps/chat verified import, rejection and exact Error identity. An initial untested assumption about Vitest worker-state requirements was rejected on that evidence; no incorrect runner limitation remains in source.
- Copy-journal fresh UUID allocation reuses the existing named `createEveTestSession` fixture. Every invocation still creates a new native-session identity. The other two callbacks synchronously record their supplied operation then settle; they retain narrow exceptions because fixed-value APIs would lose those invocation-time side effects.

## Other Concrete Findings Delegated by Parent

- Library tests: five pure Promise callbacks in logical-chat.test.ts, three fixed metadata replies in copy-transcript.test.ts, and two pure void-completion callbacks in contracts.test.ts can use typed settled mock APIs. Parent assigned the corresponding library agent; this report does not claim those changes.
- NEW chat-models-lifecycle.browser.tsx: shorthand `values.push(value)` callbacks return numbers into a void probe contract; block callbacks preserve the assertions and remove its broad strict-void-return directive. Parent assigned the UI agent.

## Verified Retention Boundaries

Reviewed examples support continued narrow retention for actual invocation-time side effects, dynamic argument-dependent fixtures, callback-only HTTP/listen/stream/frame completion, exact file ClipboardEvent/DataTransfer act scenarios, disabled native click act, Promise<undefined> required resolver arguments, Zod catch(undefined), durable EVE declaration/async-step compilation requirements, dynamic typed Next routes, JSON wire omission, bounded serial processing and public SDK override promise/throw forwarding. No new concrete production hole was identified in this read-only review. This is not a claim that an arbitrary retained suppression is justified by its mere presence.

## Verification and Limits

- Scoped native type-aware lint passes all five changed files, with no added suppressions/config/dependencies.
- Primitive overlays Chromium: **3 passed**, `/tmp/primitive-overlays-reuse-browser.log`.
- MCP settings Chromium: **19 passed**, `/tmp/mcp-hoisted-helper-browser.log`.
- These existing suites emit React act warnings in Radix delayed position/presence updates and MCP Next Link/Sonner activity. Warnings were not hidden or filtered; parent notified. The scoped lint edits do not claim to resolve these additional timing boundaries.
- Standalone Node24 Vitest rejected mock preserves exact Error identity.
- Bun invocation test confirms fresh native session UUID per call.
- Oxfmt applied to the five owned files; git diff --check passes.
- Live database/provider E2E execution remains unavailable and was not replaced with the wrong runner. Parent owns integrated types and acceptance runs.
