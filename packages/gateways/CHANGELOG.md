# @chat-js/gateways

## 0.2.0

### Minor Changes

- Select AI gateways during ChatJS creation through shadcn-format registry items, including external registry URLs. Install only the selected adapter source and its declared dependencies. Keep shared contracts and runtime utilities in @chat-js/gateways, and validate configuration against the installed adapter.

### Patch Changes

- Accept a fetch-compatible callable without requiring host-specific static fetch properties, so injected fetch implementations work across Node and Bun typings.

- Use the upstream MCP SSE OAuth refresh fix and Files SDK private Blob signing in generated applications. Remove the MCP patch archive, align AI SDK type versions, and retain the existing storage provider selection.
