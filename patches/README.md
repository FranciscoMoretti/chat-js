# Maintained runtime dependencies

EVE is installed from the published `@chat-js/eve@1.0.0-rc.6-chatjs.0` fork through the `eve` npm alias. Its source and packaging workflow live in [the fork](https://github.com/FranciscoMoretti/eve/tree/francisco/chatjs-package); see [the package development guide](../docs/eve-package-development.md).

The former compiled EVE workflow-identity patch is removed: the maintained RC1 source supplies the scoped-package workflow behavior.

## Supported upstream contracts

- `@ai-sdk/mcp@2.0.73` contains upstream commit `4b5cb49`, which coalesces legacy SSE OAuth refresh and reuses newer tokens after late 401 responses. The local MCP patch and its scaffold archive are removed. AI SDK packages use the matching `ai@7.0.137`, `@ai-sdk/gateway@4.0.110` and `@ai-sdk/react@4.0.140` releases to share `@ai-sdk/provider-utils@5.0.58` types. Preserve the transport refresh tests and application cross-client OAuth lock tests on upgrades.
- `files-sdk@2.5.0` implements private Vercel Blob signed downloads through its supported adapter. ChatJS configures private access and a five-minute default; it no longer implements signing. Contract tests execute the SDK adapter with mocked Blob network calls and cover read-write token credentials, OIDC/store credentials, expiry and abort signals.

## Remaining compiled patch

`workflow-world-postgres@5.1.1.patch` resolves a consumed stream prefix in SQL to avoid transferring those payloads during resume. World 5.1.1 supplies atomic start hooks and allows unkeyed wake delivery while deduplicating exact delivery keys.

The installer still packages the patched world so all four package managers receive the same stream behavior. ChatJS verifies the 5.1.1 migration boundary and fences the regular and executor queue tasks as well as the provider's run and payload tables.

The remaining EVE dynamic-tool approval typing issue is also unresolved in the published fork. `DynamicToolEntry` uses an unparameterized `Approval` and fixes `approvalKey` input to `Record<string, unknown>`. ChatJS's `defineToolSet` retains native tool inference and the application durable-output constraint. Remove that compensation only after a source change and tested release of the maintained EVE fork, preserving input, output and approval inference. No new EVE package or world fork was published by this task.

See [the acceptance evidence and outstanding contracts](../docs/runtime-dependency-acceptance.md) for the exact verification scope.
