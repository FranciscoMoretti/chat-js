# Coordinator Remaining Rules Audit

This report covers root-owned application, registry, gateway and thread files after the first three rules. Package-test and agent-owned library/UI evidence lives in separate area reports. Registry mirrors are generated from canonical sources and counted separately in the immutable baseline. Counts below are a checkpoint; the current JSON inventory supersedes them after later edits.

## Resolved Cases

- Void health mocks now declare Promise<void> and omit mockResolvedValue arguments. Required missing-object/environment/gate arguments remain, rather than mislabeling those APIs as void.
- Deprecated MCP prefetchQuery calls use the existing preloadQuery/query API, preserving awaited hydration and swallowed prefetch failure. Two focused tests cover pending dehydration/cache reuse and failure cache state. MCP URL validation uses Zod4 check(url), preserving min-length order and messages. React Query server detection uses environmentManager.isServer().
- Retrieve URL extraction validates optional structured fields before merging, preserving scraped fields and ignoring malformed extraction. Three extra fixtures cover full, partial and malformed extraction.
- Python execution trailers now validate their declared shape with loose Zod objects; extension fields and the legacy empty envelope remain accepted. Invalid envelopes use the existing unparseable-output fallback rather than unsafe field access. Five characterization cases cover success, empty, extended error, null and malformed fields. Python/MCP/sandbox focused run:62 tests passed.
- All root optional-result consistent-return sites now explicitly return undefined. Conditional editor cleanup uses its honest function-or-undefined annotation, satisfying both rules. No fabricated return values or no-op cleanup functions.
- Registry browser render/unmount work reuses the shared async React primitive helper. Image focus is native synchronous focus followed by CSS polling; image click uses the real awaited browser locator. Eight tests passed in six suites, then observability passed separately after replacing a broken optimized-module mock with real Next contexts. Its screenshot was inspected: four unchanged content rows.
- The MCP OAuth Request loader is synchronously parsed by installed nuqs createLoader; removed a redundant await, with callback/proxy/health20tests passing.
- Internal registry storage type aliases became interfaces after registry type checking passed. These are build helpers, not published package entrypoints.
- Electron ambient types no longer need an empty-export module wrapper: the declaration script preserves Window augmentation and both global auth types. Scoped lint passes; application checking reports no ambient-type errors.
- The health stalled-database fixture uses a never-resolved native withResolvers promise. Production health keeps its timer bridge and finally clears it.
- EveMessages now separates message rows, feedback, and actions while preserving part keys, preceding-user association, model lookup calls, retry/edit callbacks, and readonly controls. Nine existing browser tests across four suites and one new action-boundary test passed; the new capture was inspected without overlap or ordering changes. Scoped type-aware lint passed.

## Concrete Retentions

- no-useless-undefined: required resolver arguments for Promise<undefined> gates; missing-object mock returns; stubEnv variable deletion; observed call arity; and Zod catch(undefined) fallbacks. Each call's actual declaration requires the argument. Promise<void> mocks were fixed instead.
- no-deprecated: canonical/mirrored Vercel runtime selection remains because replacement image requires a VCR image reference, not a runtime-ID rename. Existing node/python runtime environment contracts cannot silently become image IDs. Thread addToolResult remains a public compatibility method independently overridable from addToolOutput.
- func-style/require-await: installed eve/dist/src/internal/workflow-bundle/authored-workflow-directives.js explicitly rejects non-top-level declarations and non-async durable steps. The completion-clock step must stay a named async step despite its synchronous Date.now read. Workflow suppression narrowed from file-wide to that declaration.
- prefer-await-to-then: Zod catch is not a Promise. Shared MCP initialization's finally cleans only its exact current attempt independently of caller cancellation. Tested async IIFE caused TS2454 self-reference; separate declaration violates no-use-before-define and split let violates prefer-const. Additional bookkeeping solely to conceal finally is not a useful refactor.
- consistent-type-definitions: multi-query search records cross ToolOutput's recursive JSON-record constraint. Converting to interfaces loses the implicit index signature and fails native TypeScript. Generated WorkflowTools is under the CLI agent's separate follow-up and is not classified as retention here.
- class-methods-use-this: five gateway factory methods implement required public instance slots; unsupported image/video factories intentionally return null. Making them static, deleting them, or reading meaningless instance state would break or disguise the interface.
- react/hook-use-state: TRPC lazy client state guarantees one retained mounted resource. useMemo can discard its cache and ref.current reads are forbidden during render. There is intentionally no setter.
- no-unnecessary-type-arguments: the thread type fixture explicitly pins UseThreadHelpers<UIMessage> as a public specialization, independently of future alias defaults; do not weaken compile-time contract assertions solely for lint.
- promise/avoid-new: readiness timeout is a cancellable native timer-to-Promise bridge; its handle is cleared in finally.

## Completed Follow-Up

The MCP create-dialog reset transition and attachment upload compiler boundary are fixed and synced from canonical sources. The CLI generator now emits a WorkflowTools interface and its parser recognizes interface exports; generated type and fixture checks pass. Their old nonzero checkpoint counts below are superseded by the final current inventory. See the production, UI, storage, and conversation follow-up reports for their implementation evidence. Integrated checks supersede focused checkpoint results.

## File/Rule Checkpoint

Columns show original memberships / net removed / current. Narrowed directives can increase current counts. Retention status is determined by the evidence above or the named delegated report, never by count alone.

| File | Rule | Original | Net Removed | Current |
| --- | --- | --: | --: | --: |
| `apps/chat/app/(chat)/api/files/upload/route.test.ts` | unicorn/no-useless-undefined | 1 | 0 | 1 |
| `apps/chat/app/(chat)/settings/connectors/[connectorId]/page.tsx` | typescript/no-deprecated | 1 | 1 | 0 |
| `apps/chat/app/(chat)/settings/connectors/page.tsx` | typescript/no-deprecated | 1 | 1 | 0 |
| `apps/chat/app/api/agent-conversations/[id]/checkpoint/route.test.ts` | unicorn/no-useless-undefined | 1 | 0 | 1 |
| `apps/chat/app/api/agent-conversations/[id]/route.test.ts` | unicorn/no-useless-undefined | 1 | 0 | 1 |
| `apps/chat/app/api/agent-response-groups/route.test.ts` | unicorn/no-useless-undefined | 1 | 0 | 1 |
| `apps/chat/app/api/eve/[...path]/route.ts` | typescript/consistent-return | 2 | 2 | 0 |
| `apps/chat/app/api/health/route.test.ts` | promise/avoid-new | 1 | 1 | 0 |
| `apps/chat/app/api/health/route.test.ts` | unicorn/no-useless-undefined | 2 | 2 | 0 |
| `apps/chat/app/api/health/route.ts` | promise/avoid-new | 1 | 0 | 1 |
| `apps/chat/app/api/mcp/oauth/callback/route.test.ts` | unicorn/no-useless-undefined | 1 | 0 | 1 |
| `apps/chat/app/api/mcp/oauth/callback/route.ts` | typescript/await-thenable | 1 | 1 | 0 |
| `apps/chat/components/settings/mcp-create-dialog.tsx` | react/set-state-in-effect | 1 | 0 | 1 |
| `apps/chat/components/settings/mcp-create-dialog.tsx` | typescript/no-deprecated | 1 | 1 | 0 |
| `apps/chat/electron.d.ts` | unicorn/require-module-specifiers | 1 | 1 | 0 |
| `apps/chat/features/attachment-uploads/integration.tsx` | react/todo | 1 | 0 | 1 |
| `apps/chat/features/mcp/composer.tsx` | typescript/prefer-nullish-coalescing | 1 | 1 | 0 |
| `apps/chat/lib/ai/mcp/mcp-client.ts` | promise/prefer-await-to-then | 1 | 0 | 1 |
| `apps/chat/lib/ai/mcp/mcp-oauth-provider.ts` | typescript/consistent-return | 1 | 1 | 0 |
| `apps/chat/proxy.ts` | typescript/consistent-return | 2 | 2 | 0 |
| `apps/chat/tools/chatjs/_shared/code-execution/python.ts` | typescript/consistent-return | 1 | 1 | 0 |
| `apps/chat/tools/chatjs/_shared/code-execution/python.ts` | typescript/no-unsafe-assignment | 1 | 1 | 0 |
| `apps/chat/tools/chatjs/code-documents/document.tsx` | promise/prefer-await-to-then | 1 | 1 | 0 |
| `apps/chat/tools/chatjs/code-documents/editor.tsx` | typescript/consistent-return | 1 | 1 | 0 |
| `apps/chat/tools/chatjs/deep-research/search-updates.ts` | func-style | 1 | 0 | 1 |
| `apps/chat/tools/chatjs/deep-research/steps.ts` | func-style | 3 | 0 | 3 |
| `apps/chat/tools/chatjs/deep-research/steps.ts` | require-await | 1 | 0 | 1 |
| `apps/chat/tools/chatjs/deep-research/workflow.ts` | func-style | 1 | 0 | 1 |
| `apps/chat/tools/chatjs/retrieve-url/renderer.tsx` | typescript/consistent-return | 1 | 1 | 0 |
| `apps/chat/tools/chatjs/retrieve-url/tool.ts` | typescript/no-unsafe-member-access | 3 | 3 | 0 |
| `apps/chat/tools/chatjs/retrieve-url/tool.ts` | typescript/prefer-nullish-coalescing | 6 | 6 | 0 |
| `apps/chat/tools/chatjs/saved-code-execution/document-runs.ts` | typescript/consistent-return | 1 | 1 | 0 |
| `apps/chat/tools/chatjs/sheet-documents/document.tsx` | promise/prefer-await-to-then | 1 | 1 | 0 |
| `apps/chat/tools/chatjs/text-documents/comparison.tsx` | promise/prefer-await-to-then | 1 | 1 | 0 |
| `apps/chat/tools/chatjs/text-documents/document.tsx` | promise/prefer-await-to-then | 1 | 1 | 0 |
| `apps/chat/tools/chatjs/vercel-code-execution/execution-sandbox.ts` | typescript/consistent-return | 2 | 2 | 0 |
| `apps/chat/tools/chatjs/vercel-code-execution/execution-sandbox.ts` | typescript/no-deprecated | 1 | 0 | 1 |
| `apps/chat/tools/chatjs/vercel-code-execution/renderer.tsx` | promise/prefer-await-to-then | 2 | 0 | 2 |
| `apps/chat/tools/chatjs/vercel-code-execution/renderer.tsx` | unicorn/no-useless-undefined | 2 | 0 | 2 |
| `apps/chat/tools/chatjs/vercel-code-execution/sandbox-auth.test.ts` | unicorn/no-useless-undefined | 1 | 0 | 1 |
| `apps/chat/tools/chatjs/vercel-code-execution/sandbox-test-environment.ts` | unicorn/no-useless-undefined | 1 | 0 | 1 |
| `apps/chat/tools/chatjs/vercel-code-execution/tool.test.ts` | unicorn/no-useless-undefined | 1 | 0 | 1 |
| `apps/chat/tools/chatjs/workflow-types.ts` | typescript/consistent-type-definitions | 1 | 0 | 1 |
| `apps/chat/tools/platform/steps/multi-query-web-search.ts` | typescript/consistent-type-definitions | 3 | 0 | 3 |
| `apps/chat/trpc/react.tsx` | react/hook-use-state | 1 | 0 | 1 |
| `apps/chat/trpc/react.tsx` | typescript/no-deprecated | 1 | 1 | 0 |
| `apps/chat/trpc/react.tsx` | typescript/prefer-nullish-coalescing | 1 | 1 | 0 |
| `packages/registry/src/features/attachment-uploads/features/attachment-uploads/integration.tsx` | react/todo | 1 | 0 | 1 |
| `packages/registry/src/features/mcp/app/(chat)/settings/connectors/[connectorId]/page.tsx` | typescript/no-deprecated | 1 | 1 | 0 |
| `packages/registry/src/features/mcp/app/(chat)/settings/connectors/page.tsx` | typescript/no-deprecated | 1 | 1 | 0 |
| `packages/registry/src/features/mcp/app/api/mcp/oauth/callback/route.ts` | typescript/await-thenable | 1 | 1 | 0 |
| `packages/registry/src/features/mcp/components/settings/mcp-create-dialog.tsx` | react/set-state-in-effect | 1 | 0 | 1 |
| `packages/registry/src/features/mcp/components/settings/mcp-create-dialog.tsx` | typescript/no-deprecated | 1 | 1 | 0 |
| `packages/registry/src/features/mcp/features/mcp/composer.tsx` | typescript/prefer-nullish-coalescing | 1 | 1 | 0 |
| `packages/registry/src/features/mcp/lib/ai/mcp/mcp-client.ts` | promise/prefer-await-to-then | 1 | 0 | 1 |
| `packages/registry/src/features/mcp/lib/ai/mcp/mcp-oauth-provider.ts` | typescript/consistent-return | 1 | 1 | 0 |
| `packages/registry/src/gateways/litellm/gateway.ts` | class-methods-use-this | 1 | 0 | 1 |
| `packages/registry/src/gateways/openai-compatible/gateway.ts` | class-methods-use-this | 1 | 0 | 1 |
| `packages/registry/src/gateways/openai/gateway.ts` | class-methods-use-this | 1 | 0 | 1 |
| `packages/registry/src/gateways/openrouter/gateway.ts` | class-methods-use-this | 2 | 0 | 2 |
| `packages/registry/src/storage/environment.ts` | typescript/consistent-type-definitions | 2 | 2 | 0 |
| `packages/registry/src/tools/_shared/code-execution/python.ts` | typescript/consistent-return | 1 | 1 | 0 |
| `packages/registry/src/tools/_shared/code-execution/python.ts` | typescript/no-unsafe-assignment | 1 | 1 | 0 |
| `packages/registry/src/tools/code-documents/document.tsx` | promise/prefer-await-to-then | 1 | 1 | 0 |
| `packages/registry/src/tools/code-documents/editor.tsx` | typescript/consistent-return | 1 | 1 | 0 |
| `packages/registry/src/tools/deep-research/search-updates.ts` | func-style | 1 | 0 | 1 |
| `packages/registry/src/tools/deep-research/steps.ts` | func-style | 3 | 0 | 3 |
| `packages/registry/src/tools/deep-research/steps.ts` | require-await | 1 | 0 | 1 |
| `packages/registry/src/tools/deep-research/workflow.ts` | func-style | 1 | 0 | 1 |
| `packages/registry/src/tools/retrieve-url/renderer.tsx` | typescript/consistent-return | 1 | 1 | 0 |
| `packages/registry/src/tools/retrieve-url/tool.ts` | typescript/no-unsafe-member-access | 3 | 3 | 0 |
| `packages/registry/src/tools/retrieve-url/tool.ts` | typescript/prefer-nullish-coalescing | 6 | 6 | 0 |
| `packages/registry/src/tools/saved-code-execution/document-runs.ts` | typescript/consistent-return | 1 | 1 | 0 |
| `packages/registry/src/tools/sheet-documents/document.tsx` | promise/prefer-await-to-then | 1 | 1 | 0 |
| `packages/registry/src/tools/text-documents/comparison.tsx` | promise/prefer-await-to-then | 1 | 1 | 0 |
| `packages/registry/src/tools/text-documents/document.tsx` | promise/prefer-await-to-then | 1 | 1 | 0 |
| `packages/registry/src/tools/vercel-code-execution/execution-sandbox.ts` | typescript/consistent-return | 2 | 2 | 0 |
| `packages/registry/src/tools/vercel-code-execution/execution-sandbox.ts` | typescript/no-deprecated | 1 | 0 | 1 |
| `packages/registry/src/tools/vercel-code-execution/renderer.tsx` | promise/prefer-await-to-then | 2 | 0 | 2 |
| `packages/registry/src/tools/vercel-code-execution/renderer.tsx` | unicorn/no-useless-undefined | 2 | 0 | 2 |
| `packages/registry/visual/image.browser.test.tsx` | typescript/await-thenable | 6 | 6 | 0 |
| `packages/registry/visual/image.browser.test.tsx` | typescript/no-confusing-void-expression | 6 | 6 | 0 |
| `packages/registry/visual/observability.browser.test.tsx` | typescript/await-thenable | 2 | 2 | 0 |
| `packages/registry/visual/observability.browser.test.tsx` | typescript/no-confusing-void-expression | 2 | 2 | 0 |
| `packages/registry/visual/renderer.browser.test.tsx` | typescript/await-thenable | 4 | 4 | 0 |
| `packages/registry/visual/renderer.browser.test.tsx` | typescript/no-confusing-void-expression | 4 | 4 | 0 |
| `packages/registry/visual/sandbox.browser.test.tsx` | typescript/await-thenable | 1 | 1 | 0 |
| `packages/registry/visual/sandbox.browser.test.tsx` | typescript/no-confusing-void-expression | 1 | 1 | 0 |
| `packages/registry/visual/search-word-count-renderer.browser.test.tsx` | typescript/await-thenable | 2 | 2 | 0 |
| `packages/registry/visual/search-word-count-renderer.browser.test.tsx` | typescript/no-confusing-void-expression | 2 | 2 | 0 |
| `packages/registry/visual/text-document-diffview.browser.test.tsx` | typescript/await-thenable | 2 | 2 | 0 |
| `packages/registry/visual/text-document-diffview.browser.test.tsx` | typescript/no-confusing-void-expression | 2 | 2 | 0 |
| `packages/registry/visual/video.browser.test.tsx` | typescript/await-thenable | 2 | 2 | 0 |
| `packages/registry/visual/video.browser.test.tsx` | typescript/no-confusing-void-expression | 2 | 2 | 0 |
| `packages/thread/src/thread-hook-helpers.ts` | typescript/no-deprecated | 1 | 0 | 1 |
| `packages/thread/test/use-thread-types.ts` | typescript/no-unnecessary-type-arguments | 1 | 0 | 1 |
