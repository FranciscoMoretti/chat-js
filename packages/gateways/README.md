# @chat-js/gateways

Shared contracts and runtime utilities for ChatJS gateway registry extensions.
This package contains no gateway implementations or gateway SDK peers.

The CLI installs the selected registry item's source files and npm dependencies.
Built-in adapters are authored in `packages/registry/src/gateways`; third-party
registries can ship source or a file importing their own npm package.

The installed `lib/ai/gateway.ts` must export a `Gateway` constructor accepting
`GatewayOptions`. Its instance implements `GatewayProvider`: a literal `type`,
`fetchModels()`, and language/image/video model creation. Unsupported media
methods return `null` and accept `never`. Language models use AI SDK v4.

The host supplies environment values, logging, a discovery `fetch` function, and
`getFallbackModels(gateway)`. Model generation uses the selected SDK's transport.
`GatewayRuntime` provides these host dependencies without importing Next.js.

`GatewayModelDefaults<YourGateway>` checks model defaults against adapter model
IDs. `gatewayDefinitionSchema` validates the version 1 installation metadata,
including capabilities, environment requirements and defaults. Model IDs from
compatible servers can be open strings; types cannot verify a remote catalog or
credentials.

See [gateway registry authoring](../registry/src/gateways/README.md).

Verification:

- `bun run test:unit`: adapter model creation, media support and discovery fallback.
- `bun run test:types`: shared declarations and built-in adapter contracts.
- `bun --filter @chat-js/cli test:gateways`: independently install and type-check
  every built-in selection and an external registry, including rejected gateway
  selections and unsupported video configuration. Assert that the shared archive
  contains no adapter implementations.
