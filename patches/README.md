# Maintained runtime dependencies

EVE is installed from the published `@chat-js/eve@0.61.0-chatjs.0` fork through the `eve` npm alias. Its source and packaging workflow live in [the fork](https://github.com/FranciscoMoretti/eve/tree/francisco/chatjs-package); see [the package development guide](../docs/eve-package-development.md).

## Supported upstream contracts

- `@ai-sdk/mcp@2.0.53` contains upstream commit `4b5cb49`, which coalesces legacy SSE OAuth refresh and reuses newer tokens after late 401 responses. The local MCP patch and its scaffold archive are removed. AI SDK packages use the matching `ai@7.0.106`, `@ai-sdk/gateway@4.0.86` and `@ai-sdk/react@4.0.109` releases to share `@ai-sdk/provider-utils@5.0.44` types. Preserve the transport refresh tests and application cross-client OAuth lock tests on upgrades.
- `files-sdk@2.5.0` implements private Vercel Blob signed downloads through its supported adapter. ChatJS configures private access and a five-minute default; it no longer implements signing. Contract tests execute the SDK adapter with mocked Blob network calls and cover read-write token credentials, OIDC/store credentials, expiry and abort signals.

## Remaining compiled patch

`workflow-world-postgres@5.0.0-beta.40.patch` still changes compiled queue and stream code. It allows distinct deliveries to wake a workflow awaiting a step while retaining exact-idempotency-key deduplication. It also resolves a consumed stream prefix in SQL and avoids transferring already-consumed payloads during resume.

The installer still packages this patched world as an archive so Bun, npm, pnpm and Yarn receive the same behavior. This packaging is not a source-maintained fork and does not close the patch-removal gate in [#652](https://github.com/FranciscoMoretti/chat-js/issues/652). PostgreSQL world `5.0.1` was inspected on 4 October 2026: queue serialization has changed, but its stream reader still skips consumed payloads after fetching them. Replacing the current world requires equivalent stream-prefix behavior plus native upgrade acceptance; a version bump alone is insufficient.

The remaining EVE dynamic-tool approval typing issue is also unresolved in the published fork. `DynamicToolEntry` uses an unparameterized `Approval` and fixes `approvalKey` input to `Record<string, unknown>`. ChatJS's `defineToolSet` retains native tool inference and the application durable-output constraint. Remove that compensation only after a source change and tested release of the maintained EVE fork, preserving input, output and approval inference. No new EVE package or world fork was published by this task.

See [the acceptance evidence and outstanding contracts](../docs/runtime-dependency-acceptance.md) for the exact verification scope.
