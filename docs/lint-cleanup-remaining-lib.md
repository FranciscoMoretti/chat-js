# Library Remaining Rules Audit

Scope: apps/chat/lib/** except registry-owned eve/mcp-tools.ts. First three rules are covered by separate async, loop, and boolean reports. Counts below are suppression directive memberships, not expanded diagnostics. Snapshot is shared-worktree state, including root-owned MCP edits. No configurations, dependencies, public package APIs, or generators changed.

## Verification

- Node 24 + Bun: `bunx vitest run --config apps/chat/vitest.config.ts apps/chat/lib`: 130 files, 789 tests passed; `/tmp/lib-final-remaining-tests.log`.
- Type-aware scoped lint on 367 files: zero diagnostics (`/tmp/lib-final-remaining-lint.json`).
- `tsc --project apps/chat/tsconfig.json --noEmit --incremental false`: no errors from this pass after fixes; concurrent root MCP self-reference and external tests errors remain (`/tmp/lib-final-remaining-types.log`). Root coordinates integrated validation.
- No full lint/type scripts or generators run here. An initial root-default Vitest invocation lacked chat mocks/config and failed; corrected explicit chat configuration passes.

## Changes

- True void completion mocks now have actual Promise<void> signatures and argumentless mockResolvedValue; no object-result fixture was relabeled void.
- Typed mock functions from native signatures, unknown matcher boundaries, and Zod parsing eliminate unsafe member/call/assignment/argument/return suppressions without weakening assertions.
- Optional-result functions explicitly return their existing undefined sentinel; all consistent-return exceptions removed.
- All eight complexity exceptions removed by extracting document replay comparison, copy document validation, creation identity resolution/matching, inherited-message validation, chat selection steps, regeneration replacement lookup, and hook/tool usage ingestion. Transaction scope, lock/write order, per-attempt usage ordering, and atomic snapshot publication remain intact.
- Nine alias exceptions removed by interfaces after concrete caller/type checks. Two retained aliases demonstrably require implicit JSON-record signatures.
- All three prefer-nullish exceptions were obsolete after boolean fixes and removed. No owned no-deprecated memberships existed.

## Retention Evidence

- no-useless-undefined: explicit undefined is the value of required missing-object lookups/error statuses, schema default inputs, environment deletion, Promise<undefined> gate resolutions, and AsyncGenerator.return completion. Native void mock conversions account for nine removals. Replacing Promise<undefined> gates with withResolvers<void>() is rejected by the pinned no-invalid-void-type rule; adding wrappers or new Promise executors only to hide this is not a meaningful fix. Required-argument calls cannot omit undefined without changing types/behavior.
- consistent-type-definitions: db/eve-search EveSearchResult passes directly into db.execute constrained to Record<string, unknown>; CodeExecutionOutput passes into ToolResult constrained to ToolOutput JSON records. Interface conversion was tested and caused TS2344 plus code-execution provider constraint failures, then restored only that alias.
- avoid-new: browser/shared production retry waits use native setTimeout and must not import Node timer modules. Final independent review replaced cancellation executors with withResolvers plus genuine pending awaits and Node-only fixture drain timers with node:timers/promises. Existing send-command/checkpoint/admission tests exercise the three retained browser-compatible event/timer boundaries.
- unsafe-type-assertion: ai/errors.ts casts two components of a statically constrained colon-delimited ErrorCode after split erases component literal unions. Runtime validation would alter the typed caller contract and error behavior. The final packed Daytona replacement test proved that tool-models requires both unsafe and unnecessary assertion exceptions across generated gateways: OpenAI narrows image IDs and unsupported video IDs become never. The two unsafe exceptions were restored after that concrete failure; reference-app lint alone cannot establish their redundancy.
- prefer-promise-reject-errors: cancellation mocks deliberately forward the exact controlled AbortSignal.reason; provider fixture deliberately rejects its original plain object. Wrapping in Error would defeat rejection-identity assertions.
- prefer-structured-clone: two persisted-event fixtures intentionally JSON roundtrip to omit undefined optional receipt fields, matching JSON wire persistence; structuredClone preserves them.
- error-message: stream-errors fixture deliberately supplies empty AI errorText to assert fallback text. only-throw-error: tool-usage fixture asserts non-Error provider failure behavior.
- no-dynamic-delete: turn-tools filters a copied heterogeneous registry while preserving each key concrete definition type; Object.fromEntries loses key/value correlations. Replacing delete with Reflect.deleteProperty merely disguises the same operation.
- no-control-regex: file-storage intentionally strips every ASCII C0 + DEL character from upload pathname while preserving all other characters; replacing explicit control range with a per-character allocator only obscures that security contract.
- prefer-await-to-then: root reviewed native shared connection .finally cleanup and retained it after async rewrites raised self-reference errors or changed promise ownership. Existing mcp-client tests cover shared connect deduplication and cancellation; final scoped lint passes.

## Per-Rule and File Counts

Columns: baseline / removed / retained / unresolved. Retained means concrete evidence above; no pending audit cases remain in this scope.

### unicorn/no-useless-undefined

Total: 47 / 9 / 38 / 0

- `apps/chat/lib/ai/mcp/mcp-client.test.ts`: 5 / 0 / 5 / 0 (see retention evidence above).
- `apps/chat/lib/ai/mcp/mcp-sse-refresh.test.ts`: 2 / 0 / 2 / 0 (see retention evidence above).
- `apps/chat/lib/eve/channel-files.test.ts`: 1 / 0 / 1 / 0 (see retention evidence above).
- `apps/chat/lib/eve/cleanup-orphaned-files.test.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/eve/conversation-scope.test.ts`: 1 / 0 / 1 / 0 (see retention evidence above).
- `apps/chat/lib/eve/create-conversation-operation.test.ts`: 3 / 1 / 2 / 0 (see retention evidence above).
- `apps/chat/lib/eve/delete-local-conversation.test.ts`: 3 / 1 / 2 / 0 (see retention evidence above).
- `apps/chat/lib/eve/document-deletion.test.ts`: 1 / 0 / 1 / 0 (see retention evidence above).
- `apps/chat/lib/eve/environment.test.ts`: 1 / 0 / 1 / 0 (see retention evidence above).
- `apps/chat/lib/eve/gateway-auth.test.ts`: 4 / 0 / 4 / 0 (see retention evidence above).
- `apps/chat/lib/eve/guest-admission.test.ts`: 4 / 0 / 4 / 0 (see retention evidence above).
- `apps/chat/lib/eve/local-guest-cleanup-scheduler.test.ts`: 2 / 0 / 2 / 0 (see retention evidence above).
- `apps/chat/lib/eve/mcp-tools.test.ts`: 3 / 1 / 2 / 0 (see retention evidence above).
- `apps/chat/lib/eve/purge-code-sandboxes.test.ts`: 2 / 2 / 0 / 0.
- `apps/chat/lib/eve/reconcile-usage.test.ts`: 3 / 0 / 3 / 0 (see retention evidence above).
- `apps/chat/lib/eve/research-progress.test.ts`: 1 / 0 / 1 / 0 (see retention evidence above).
- `apps/chat/lib/eve/retire-session.test.ts`: 3 / 0 / 3 / 0 (see retention evidence above).
- `apps/chat/lib/eve/saved-code-executor.test.ts`: 1 / 0 / 1 / 0 (see retention evidence above).
- `apps/chat/lib/eve/search-backfill.test.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/eve/search-hook.test.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/eve/send-command.test.ts`: 2 / 1 / 1 / 0 (see retention evidence above).
- `apps/chat/lib/social-auth.test.ts`: 1 / 0 / 1 / 0 (see retention evidence above).
- `apps/chat/lib/url.test.ts`: 1 / 0 / 1 / 0 (see retention evidence above).

### typescript/no-unsafe-member-access

Total: 31 / 31 / 0 / 0

- `apps/chat/lib/db/eve-subagents.test.ts`: 2 / 2 / 0 / 0.
- `apps/chat/lib/eve/create-conversation-operation.test.ts`: 12 / 12 / 0 / 0.
- `apps/chat/lib/eve/create-conversation.test.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/eve/create-response-group.test.ts`: 4 / 4 / 0 / 0.
- `apps/chat/lib/eve/mcp-tools.test.ts`: 2 / 2 / 0 / 0.
- `apps/chat/lib/eve/research-tool.test.ts`: 5 / 5 / 0 / 0.
- `apps/chat/lib/eve/response-group.test.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/eve/search-backfill.test.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/eve/usage.test.ts`: 3 / 3 / 0 / 0.

### typescript/consistent-return

Total: 25 / 25 / 0 / 0

- `apps/chat/lib/ai/installed-tool-capabilities.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/ai/mcp/mcp-oauth-provider.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/ai/tool-renderer-registry.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/db/eve-copy-journal.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/db/eve-documents.ts`: 2 / 2 / 0 / 0.
- `apps/chat/lib/db/eve-queries.ts`: 3 / 3 / 0 / 0.
- `apps/chat/lib/db/eve-response-groups.ts`: 4 / 4 / 0 / 0.
- `apps/chat/lib/eve/conversation-title.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/eve/delete-local-conversation.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/eve/fork-source.ts`: 2 / 2 / 0 / 0.
- `apps/chat/lib/eve/guest-admission.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/eve/local-guest-cleanup-scheduler.ts`: 2 / 2 / 0 / 0.
- `apps/chat/lib/eve/logical-response-slots.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/eve/message-delivery.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/eve/prepare-deletion.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/eve/response-group-lineage.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/eve/retire-session.ts`: 1 / 1 / 0 / 0.

### typescript/consistent-type-definitions

Total: 11 / 9 / 2 / 0

- `apps/chat/lib/ai/define-tool-renderer.tsx`: 1 / 1 / 0 / 0.
- `apps/chat/lib/ai/tool-renderer-registry.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/config-schema.ts`: 3 / 3 / 0 / 0.
- `apps/chat/lib/db/eve-search.ts`: 1 / 0 / 1 / 0 (see retention evidence above).
- `apps/chat/lib/eve/code-executor.ts`: 1 / 0 / 1 / 0 (see retention evidence above).
- `apps/chat/lib/eve/logical-chat.ts`: 2 / 2 / 0 / 0.
- `apps/chat/lib/eve/logical-commands.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/eve/tool-types.ts`: 1 / 1 / 0 / 0.

### complexity

Total: 8 / 8 / 0 / 0

- `apps/chat/lib/db/eve-copy-journal.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/db/eve-documents.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/db/eve-queries.ts`: 2 / 2 / 0 / 0.
- `apps/chat/lib/eve/logical-chat.ts`: 2 / 2 / 0 / 0.
- `apps/chat/lib/eve/response-group-lineage.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/eve/usage.ts`: 1 / 1 / 0 / 0.

### typescript/no-unsafe-assignment

Total: 8 / 8 / 0 / 0

- `apps/chat/lib/db/eve-subagents.test.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/eve/create-conversation-operation.test.ts`: 4 / 4 / 0 / 0.
- `apps/chat/lib/eve/guest-admission.test.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/eve/research-tool.test.ts`: 2 / 2 / 0 / 0.

### promise/avoid-new

Total: 7 / 4 / 3 / 0

- `apps/chat/lib/eve/admission-retry.ts`: 1 / 0 / 1 / 0 (see retention evidence above).
- `apps/chat/lib/eve/checkpoint-readiness.ts`: 1 / 0 / 1 / 0 (see retention evidence above).
- `apps/chat/lib/eve/create-conversation.test.ts`: 1 / 1 / 0 / 0 (withResolvers, listener installed before pending await).
- `apps/chat/lib/eve/mcp-tools.test.ts`: 2 / 2 / 0 / 0 (withResolvers cancellation and native promise timer).
- `apps/chat/lib/eve/reconcile-usage.test.ts`: 1 / 1 / 0 / 0 (native promise timer).
- `apps/chat/lib/eve/send-command.ts`: 1 / 0 / 1 / 0 (see retention evidence above).

### typescript/no-unsafe-return

Total: 7 / 7 / 0 / 0

- `apps/chat/lib/eve/create-conversation-operation.test.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/eve/create-conversation.test.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/eve/response-group.test.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/eve/search-backfill.test.ts`: 2 / 2 / 0 / 0.
- `apps/chat/lib/eve/usage.test.ts`: 2 / 2 / 0 / 0.

### typescript/no-unsafe-type-assertion

Total: 4 / 0 / 4 / 0

- `apps/chat/lib/ai/errors.ts`: 2 / 0 / 2 / 0 (see retention evidence above).
- `apps/chat/lib/eve/tool-models.ts`: 2 / 0 / 2 / 0 (packed gateway model-ID contracts).

### typescript/no-unsafe-call

Total: 4 / 4 / 0 / 0

- `apps/chat/lib/eve/create-conversation-operation.test.ts`: 2 / 2 / 0 / 0.
- `apps/chat/lib/eve/create-response-group.test.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/eve/mcp-tools.test.ts`: 1 / 1 / 0 / 0.

### typescript/no-unsafe-argument

Total: 4 / 4 / 0 / 0

- `apps/chat/lib/eve/create-conversation-operation.test.ts`: 3 / 3 / 0 / 0.
- `apps/chat/lib/eve/create-response-group.test.ts`: 1 / 1 / 0 / 0.

### typescript/prefer-promise-reject-errors

Total: 4 / 0 / 4 / 0

- `apps/chat/lib/eve/create-conversation.test.ts`: 1 / 0 / 1 / 0 (see retention evidence above).
- `apps/chat/lib/eve/mcp-tools.test.ts`: 1 / 0 / 1 / 0 (see retention evidence above).
- `apps/chat/lib/eve/research-tool.test.ts`: 1 / 0 / 1 / 0 (see retention evidence above).
- `apps/chat/lib/eve/tool-usage.test.ts`: 1 / 0 / 1 / 0 (see retention evidence above).

### typescript/prefer-nullish-coalescing

Total: 3 / 3 / 0 / 0

- `apps/chat/lib/db/connection.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/eve/gateway-auth.ts`: 1 / 1 / 0 / 0.
- `apps/chat/lib/playwright-test-environment.ts`: 1 / 1 / 0 / 0.

### typescript/no-unnecessary-type-assertion

Total: 2 / 0 / 2 / 0

- `apps/chat/lib/eve/tool-models.ts`: 2 / 0 / 2 / 0 (see retention evidence above).

### unicorn/prefer-structured-clone

Total: 2 / 0 / 2 / 0

- `apps/chat/lib/eve/tool-usage.test.ts`: 1 / 0 / 1 / 0 (see retention evidence above).
- `apps/chat/lib/eve/usage.test.ts`: 1 / 0 / 1 / 0 (see retention evidence above).

### promise/prefer-await-to-then

Total: 1 / 0 / 1 / 0

- `apps/chat/lib/ai/mcp/mcp-client.ts`: 1 / 0 / 1 / 0 (shared connection cleanup promise ownership).

### unicorn/error-message

Total: 1 / 0 / 1 / 0

- `apps/chat/lib/ai/stream-errors.test.ts`: 1 / 0 / 1 / 0 (see retention evidence above).

### typescript/only-throw-error

Total: 1 / 0 / 1 / 0

- `apps/chat/lib/eve/tool-usage.test.ts`: 1 / 0 / 1 / 0 (see retention evidence above).

### typescript/no-dynamic-delete

Total: 1 / 0 / 1 / 0

- `apps/chat/lib/eve/turn-tools.ts`: 1 / 0 / 1 / 0 (see retention evidence above).

### no-control-regex

Total: 1 / 0 / 1 / 0

- `apps/chat/lib/file-storage.ts`: 1 / 0 / 1 / 0 (see retention evidence above).

## Zero-Owned Rules

Other baseline rules with zero owned memberships, including no-deprecated, await-thenable, no-confusing-void-expression, require-await, func-style, and strict-void-return, were checked against baseline scope and need no library changes.
