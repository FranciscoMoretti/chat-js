# @chat-js/thread

## Unreleased

### Changed

- Normalize thread and hook message results to AI SDK's canonical metadata, data-part, and tool shape. Arbitrary required top-level extensions, narrower IDs or roles, and fixed part tuples are no longer falsely guaranteed. Existing SDK message specializations and default constructors retain their types and runtime behavior.

## 0.1.0

### Minor Changes

- [#254](https://github.com/FranciscoMoretti/chat-js/pull/254) [`8b3bba3`](https://github.com/FranciscoMoretti/chat-js/commit/8b3bba3a226cd7d487083cfc7021b1cee976ff5a) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Add a useChat-compatible threaded message runtime with branching, concurrent response streams, and React bindings.
