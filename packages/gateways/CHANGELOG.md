# @chat-js/gateways

## 0.2.0

### Minor Changes

- [#332](https://github.com/FranciscoMoretti/chat-js/pull/332) [`5b6664e`](https://github.com/FranciscoMoretti/chat-js/commit/5b6664e7b846851228605933160281b07a4b0ce2) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Select AI gateways during ChatJS creation through shadcn-format registry items, including external registry URLs. Install only the selected adapter source and its declared dependencies. Keep shared contracts and runtime utilities in @chat-js/gateways, and validate configuration against the installed adapter.

### Patch Changes

- [#341](https://github.com/FranciscoMoretti/chat-js/pull/341) [`ea73556`](https://github.com/FranciscoMoretti/chat-js/commit/ea73556a6d3805687ba9dcf755d9d766376dcddf) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Accept a fetch-compatible callable without requiring host-specific static fetch properties, so injected fetch implementations work across Node and Bun typings.
