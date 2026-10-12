# Lib promise-function-async audit

Scope: all 50 original matching files under apps/chat/lib, excluding registry-owned eve/mcp-tools.ts. Original rule issues were measured by temporarily removing owned directives and running the type-aware checker: 96 actual sites, covered by 78 disable directives. Final: 61 narrow next-line directives in 30 files; 35 actual sites resolved, 20 files fully cleared, net 17 fewer disable directives. Every original broad scope and its matching enable was removed; remaining exceptions are local to the actual callback.

## Verification

- PATH=/Users/fran/.volta/tools/image/node/24.20.0/bin:$PATH bunx oxlint --type-aware apps/chat/lib --format json: exit 0, zero diagnostics (363 files).
- Type-aware unused-directive check: only the 3 pre-existing warnings outside this rule, in eve/tool-models.ts and eve/gateway-auth.ts.
- PATH=... bunx vitest run lib from apps/chat: 128 files passed; 776 tests passed, final run 2026-10-11 09:43:23 Europe/London.
- git diff --check -- apps/chat/lib: exit 0.
- No new tests per strategic-testing: changes are control-flow-preserving awaits, mock API simplifications, and narrower comments; existing full lib tests cover cancellation, migration DB operations, copy transactions, resource lifecycle, and scheduling.
- Initial test run exposed a real synchronous-result contract in readInstructions (hook signature permits promises but implementation returns content/null synchronously). Restored that direct helper and retained a precise exception. Final full rerun passed.

## Per-file counts

Original disable count measures directives, not covered functions. Resolved/retained count measures actual rule sites found with suppressions removed. Retained sites are not presented as solved; most are fixtures without real async work or ordering/identity contracts. Broader contract/API changes are out of this pass.

| File | Original disables | Resolved sites | Retained sites | Final disables | Evidence |
| --- | --: | --: | --: | --: | --- |
| apps/chat/lib/file-storage.test.ts | 2 | 1 | 2 | 2 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/credits/cost-accumulator.ts | 1 | 1 | 0 | 0 | Genuine asynchronous work is now awaited, or gate/value configured through existing mock APIs. |
| apps/chat/lib/db/eve-search.ts | 1 | 1 | 0 | 0 | Genuine asynchronous work is now awaited, or gate/value configured through existing mock APIs. |
| apps/chat/lib/db/mcp-oauth-lock.test.ts | 1 | 1 | 0 | 0 | Genuine asynchronous work is now awaited, or gate/value configured through existing mock APIs. |
| apps/chat/lib/db/health.ts | 1 | 0 | 1 | 1 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/db/eve-response-groups.ts | 1 | 1 | 0 | 0 | Genuine asynchronous work is now awaited, or gate/value configured through existing mock APIs. |
| apps/chat/lib/db/eve-queries.ts | 1 | 1 | 0 | 0 | Genuine asynchronous work is now awaited, or gate/value configured through existing mock APIs. |
| apps/chat/lib/db/eve-search.test.ts | 1 | 1 | 0 | 0 | Genuine asynchronous work is now awaited, or gate/value configured through existing mock APIs. |
| apps/chat/lib/db/eve-guests.ts | 1 | 1 | 0 | 0 | Genuine asynchronous work is now awaited, or gate/value configured through existing mock APIs. |
| apps/chat/lib/db/queries.ts | 3 | 3 | 0 | 0 | Genuine asynchronous work is now awaited, or gate/value configured through existing mock APIs. |
| apps/chat/lib/file-content-response.test.ts | 1 | 0 | 2 | 2 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/ai/active-gateway.ts | 1 | 0 | 1 | 1 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/db/eve-subagents.test.ts | 1 | 1 | 0 | 0 | Genuine asynchronous work is now awaited, or gate/value configured through existing mock APIs. |
| apps/chat/lib/ai/mcp/mcp-oauth-provider.test.ts | 3 | 0 | 3 | 3 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/ai/mcp/mcp-client.test.ts | 1 | 1 | 0 | 0 | Genuine asynchronous work is now awaited, or gate/value configured through existing mock APIs. |
| apps/chat/lib/eve/research-tool.test.ts | 3 | 0 | 3 | 3 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/eve/search-hook.test.ts | 1 | 1 | 0 | 0 | Genuine asynchronous work is now awaited, or gate/value configured through existing mock APIs. |
| apps/chat/lib/eve/tool-availability.ts | 1 | 0 | 1 | 1 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/eve/followup-sdk-usage.test.ts | 2 | 0 | 2 | 2 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/eve/prepare-copy-plan.ts | 1 | 0 | 1 | 1 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/eve/gateway-auth.test.ts | 1 | 0 | 1 | 1 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/eve/checkpoint-readiness.test.ts | 1 | 0 | 1 | 1 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/eve/response-group.ts | 1 | 2 | 0 | 0 | Genuine asynchronous work is now awaited, or gate/value configured through existing mock APIs. |
| apps/chat/lib/eve/save-copy-operation.ts | 2 | 2 | 0 | 0 | Genuine asynchronous work is now awaited, or gate/value configured through existing mock APIs. |
| apps/chat/lib/eve/project-instructions.test.ts | 2 | 1 | 1 | 1 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/eve/tool-usage.ts | 1 | 1 | 0 | 0 | Genuine asynchronous work is now awaited, or gate/value configured through existing mock APIs. |
| apps/chat/lib/eve/mcp-tools.test.ts | 2 | 1 | 1 | 1 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/eve/contracts.test.ts | 2 | 0 | 6 | 6 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/eve/verify-local-coverage.test.ts | 2 | 0 | 2 | 2 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/eve/model-selection.test.ts | 1 | 0 | 1 | 1 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/eve/restore-message-attachments.ts | 1 | 2 | 1 | 1 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/eve/tool-usage.test.ts | 1 | 0 | 1 | 1 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/eve/generated-files.test.ts | 1 | 1 | 0 | 0 | Genuine asynchronous work is now awaited, or gate/value configured through existing mock APIs. |
| apps/chat/lib/eve/tool-selection.test.ts | 1 | 1 | 0 | 0 | Genuine asynchronous work is now awaited, or gate/value configured through existing mock APIs. |
| apps/chat/lib/eve/create-conversation.test.ts | 1 | 0 | 1 | 1 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/eve/restore-message-attachments.test.ts | 2 | 1 | 3 | 3 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/eve/lifecycle/postgres/eve-native-purge.ts | 4 | 3 | 1 | 1 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/eve/tool-cost.test.ts | 1 | 0 | 1 | 1 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/eve/tool-types.test.ts | 1 | 1 | 0 | 0 | Genuine asynchronous work is now awaited, or gate/value configured through existing mock APIs. |
| apps/chat/lib/eve/research-availability.test.ts | 1 | 1 | 1 | 1 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/eve/retire-session.test.ts | 2 | 1 | 1 | 1 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/eve/reconcile-usage.test.ts | 5 | 0 | 5 | 5 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/eve/logical-chat.test.ts | 1 | 0 | 5 | 5 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/eve/create-conversation-operation.test.ts | 3 | 0 | 3 | 3 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/eve/research-progress.ts | 1 | 1 | 0 | 0 | Genuine asynchronous work is now awaited, or gate/value configured through existing mock APIs. |
| apps/chat/lib/eve/conversation-scope.test.ts | 1 | 1 | 0 | 0 | Genuine asynchronous work is now awaited, or gate/value configured through existing mock APIs. |
| apps/chat/lib/eve/purge-local-sandbox.test.ts | 2 | 0 | 3 | 3 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/eve/cleanup-orphaned-files.test.ts | 1 | 0 | 1 | 1 | See local callback explanations below; unresolved rather than a cosmetic await. |
| apps/chat/lib/eve/purge-local-sandbox.ts | 1 | 1 | 0 | 0 | Genuine asynchronous work is now awaited, or gate/value configured through existing mock APIs. |
| apps/chat/lib/eve/copy-transcript.test.ts | 4 | 0 | 5 | 5 | See local callback explanations below; unresolved rather than a cosmetic await. |

## Remaining local exceptions / unresolved sites

Promise identity is a demonstrated production invariant for db/health.ts's deduplicated pending probe. Pure in-memory callbacks, Promise.resolve/reject fixtures, no-work retirement stages, and cancellation/ordering fixtures have no meaningful async operation or an existing boundary to preserve. They retain narrow suppressions; adding fabricated awaits would not be a proper resolution. Some forward-only scheduling fixtures could be migrated in a later separately scoped test-contract change but were deliberately not claimed as solved here.

### apps/chat/lib/file-storage.test.ts

- Line 110: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.
- Line 116: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.

### apps/chat/lib/db/health.ts

- Line 6: Concurrent probes must return the same in-flight promise; async would replace that identity.

### apps/chat/lib/file-content-response.test.ts

- Line 113: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.
- Line 120: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.

### apps/chat/lib/eve/tool-availability.ts

- Line 25: Filtering is synchronous before Promise.resolve; async would turn filter/getter throws into rejections and has no real work to await.

### apps/chat/lib/eve/mcp-tools.test.ts

- Line 206: This cancellation fixture directly returns the abort-listener promise so cancellation ordering stays observable.

### apps/chat/lib/eve/research-tool.test.ts

- Line 18: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.
- Line 110: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.
- Line 168: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.

### apps/chat/lib/ai/active-gateway.ts

- Line 14: Forward the native fetch promise directly to preserve the adapter promise and synchronous call boundary.

### apps/chat/lib/eve/verify-local-coverage.test.ts

- Line 75: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.
- Line 116: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.

### apps/chat/lib/eve/restore-message-attachments.ts

- Line 178: Inline decoding runs synchronously and resolves a Blob; an async wrapper changes the throw boundary without asynchronous work to await.

### apps/chat/lib/eve/tool-usage.test.ts

- Line 70: Preserve the plain-object provider rejection identity; this fixture has no asynchronous operation to await.

### apps/chat/lib/eve/followup-sdk-usage.test.ts

- Line 7: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.
- Line 23: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.

### apps/chat/lib/ai/mcp/mcp-oauth-provider.test.ts

- Line 48: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.
- Line 78: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.
- Line 345: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.

### apps/chat/lib/eve/create-conversation.test.ts

- Line 23: This cancellation fixture directly returns the abort-listener promise so cancellation ordering stays observable.

### apps/chat/lib/eve/model-selection.test.ts

- Line 14: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.

### apps/chat/lib/eve/project-instructions.test.ts

- Line 95: The hook may return a promise by type, but this fixture asserts its synchronous instruction content and null results.

### apps/chat/lib/eve/retire-session.test.ts

- Line 102: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.

### apps/chat/lib/eve/restore-message-attachments.test.ts

- Line 363: Native metadata fixture callbacks retain Blob promise settlement relative to queued metadata getter effects.
- Line 365: Native metadata fixture callbacks retain Blob promise settlement relative to queued metadata getter effects.
- Line 380: Native metadata fixture callbacks retain Blob promise settlement relative to queued metadata getter effects.

### apps/chat/lib/eve/checkpoint-readiness.test.ts

- Line 50: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.

### apps/chat/lib/eve/reconcile-usage.test.ts

- Line 89: This scheduling fixture forwards the original pending promise so concurrency and settlement observations keep their timing.
- Line 113: This scheduling fixture forwards the original pending promise so concurrency and settlement observations keep their timing.
- Line 214: This scheduling fixture forwards the original pending promise so concurrency and settlement observations keep their timing.
- Line 222: This scheduling fixture forwards the original pending promise so concurrency and settlement observations keep their timing.
- Line 243: This scheduling fixture forwards the original pending promise so concurrency and settlement observations keep their timing.

### apps/chat/lib/eve/logical-chat.test.ts

- Line 43: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.
- Line 48: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.
- Line 53: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.
- Line 55: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.
- Line 57: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.

### apps/chat/lib/eve/prepare-copy-plan.ts

- Line 90: Metadata lookup throws synchronously for missing allocations and otherwise resolves an in-memory value; no asynchronous work exists to await.

### apps/chat/lib/eve/gateway-auth.test.ts

- Line 295: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.

### apps/chat/lib/eve/lifecycle/postgres/eve-native-purge.ts

- Line 189: This completed retirement stage intentionally does no work; awaiting a fabricated promise would add a fake await.

### apps/chat/lib/eve/research-availability.test.ts

- Line 86: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.

### apps/chat/lib/eve/contracts.test.ts

- Line 132: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.
- Line 134: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.
- Line 145: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.
- Line 147: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.
- Line 165: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.
- Line 170: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.

### apps/chat/lib/eve/purge-local-sandbox.test.ts

- Line 11: Fixture validation throws synchronously before returning its promise; retain that ordering and direct settlement.
- Line 15: Fixture validation throws synchronously before returning its promise; retain that ordering and direct settlement.
- Line 136: Fixture validation throws synchronously before returning its promise; retain that ordering and direct settlement.

### apps/chat/lib/eve/cleanup-orphaned-files.test.ts

- Line 27: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.

### apps/chat/lib/eve/create-conversation-operation.test.ts

- Line 37: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.
- Line 43: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.
- Line 72: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.

### apps/chat/lib/eve/tool-cost.test.ts

- Line 7: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.

### apps/chat/lib/eve/copy-transcript.test.ts

- Line 335: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.
- Line 375: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.
- Line 416: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.
- Line 452: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.
- Line 464: This settled fixture has no asynchronous operation to await; keep its direct promise result without a fake await.

## Implementation evidence

### Final Independent Review Addendum

This addendum supersedes earlier generic retained-fixture descriptions above. Removed 20 more promise-function-async memberships across eight files, plus four avoid-new memberships tracked in lint-lib-remaining-report.md. No new suppression was added.

| File | Additional async removals | Evidence |
| --- | --: | --- |
| apps/chat/lib/eve/logical-chat.test.ts | 5 | Constant cancel/prewarm/respond/resume/send results now use typed native-method settled mocks. |
| apps/chat/lib/eve/copy-transcript.test.ts | 3 | Constant size/type metadata uses settled mocks; dynamic read-key and read-count effects remain synchronous. |
| apps/chat/lib/eve/contracts.test.ts | 2 | Completion-only send callbacks use typed Promise<void> mocks; state-changing callbacks remain unchanged. |
| apps/chat/lib/ai/mcp/mcp-oauth-provider.test.ts | 1 | Completion-only authorization redirect uses a typed settled mock. Mutable state getters remain invocation-dependent. |
| apps/chat/lib/eve/purge-local-sandbox.test.ts | 2 | Constant Sandbox.get resource and remove failure use settled mocks. Neither old callback validated or synchronously threw, contrary to its old comment. Shared resource is not mutated and error identity is not asserted. The actual dependency-validation callback remains synchronous. |
| apps/chat/lib/eve/create-conversation.test.ts | 1 | Abort listener still installs synchronously before genuine pending await. Test asserts timeout rejection, one fetch, unchanged serialized operation; no promise identity assertion. |
| apps/chat/lib/eve/mcp-tools.test.ts | 1 | Abort listener still installs synchronously before genuine pending await. Test asserts AbortError and exactly one client close; original abort reason forwarded. No promise identity assertion. |
| apps/chat/lib/eve/reconcile-usage.test.ts | 5 | Two gate waits and three real reconciliation callbacks now await actual work. Assertions retain four initial active reads, refill after gate1, admission order0..7, no completion while reads pending after rejection, and four total reads after failure. Managed tests preserve target-only/cooldown sweep and historical replay checks. No exact microtask count or promise identity is asserted. |

Verification: explicit chat Vitest configuration, all eight files/135 tests passed. Final scoped type-aware oxlint on eight files passed. No assertions weakened. Node timer replacements preserve real event-loop draining durations0ms and10ms; neither timer test uses fake timers. Creation timeout still uses fake timers and its existing30-second deadline assertion passes.

Independent sampled retained exception review: actual synchronous validation/throws, fresh Response body allocation, stateful per-invocation fixtures, native React async act protocol, workflow use-step async declarations, and browser-compatible callback timers have concrete contracts. No new evasion found. This is a sample audit of the remaining global async exception inventory, not a claim of exhaustive validation outside owned lib tests.

Database query wrappers await their Drizzle operations and transaction callbacks await their actual work. Copy preparation/dispatch, response candidates, stored attachment reads/uploads, tool usage/progress, sandbox inventory reads, and native lifecycle stages now await real I/O. Cost lookups use explicit try/await/catch with the same null fallback. Transaction ordering and Promise.all concurrency remain intact. Three controllable gate mocks use mockReturnValue, retaining original promise identity. A fixed settled reconciliation mock uses mockResolvedValue. Hook helpers await real turn hooks except readInstructions' synchronous result contract. No config, dependency, public API, UI, or registry-owned source changes were made by this agent.
