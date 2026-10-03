# @chat-js/thread

## 0.2.0

### Minor Changes

- [#308](https://github.com/FranciscoMoretti/chat-js/pull/308) [`18db694`](https://github.com/FranciscoMoretti/chat-js/commit/18db694b9b67263904707a85f93673f494ea0e6d) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Upgrade ChatJS and generated applications to AI SDK 7 and provider v4. Thread now requires ai >=7.0.93 and @ai-sdk/react >=4.0.96 within their current majors, with Node >=22. Preserve canonical assistant identity, restored tool ownership, and errors across reconnects.

### Patch Changes

- [#357](https://github.com/FranciscoMoretti/chat-js/pull/357) [`8c81f1e`](https://github.com/FranciscoMoretti/chat-js/commit/8c81f1e8eeb225586b36e51aa45172e0c6466c63) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Install AI SDK dependencies with the thread package so consumers only need `bun add @chat-js/thread`. Keep React as a shared peer and clarify architecture, editing, and controller ownership.

## 0.1.0

### Minor Changes

- [#254](https://github.com/FranciscoMoretti/chat-js/pull/254) [`8b3bba3`](https://github.com/FranciscoMoretti/chat-js/commit/8b3bba3a226cd7d487083cfc7021b1cee976ff5a) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Add a useChat-compatible threaded message runtime with branching, concurrent response streams, and React bindings.
