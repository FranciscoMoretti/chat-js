# @chatjs/chat

## 0.2.2

### Patch Changes

- Updated dependencies [[`18db694`](https://github.com/FranciscoMoretti/chat-js/commit/18db694b9b67263904707a85f93673f494ea0e6d)]:
  - @chat-js/thread@0.2.0

## 0.2.1

### Patch Changes

- Updated dependencies [[`8b3bba3`](https://github.com/FranciscoMoretti/chat-js/commit/8b3bba3a226cd7d487083cfc7021b1cee976ff5a)]:
  - @chat-js/thread@0.1.0

## 0.2.0

### Minor Changes

- [#94](https://github.com/FranciscoMoretti/chat-js/pull/94) [`2a8a7cc`](https://github.com/FranciscoMoretti/chat-js/commit/2a8a7cc2b0649bd73e41999dbf0528a21e8065be) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - ## Config defaults & `defineConfig` helper

  ### New features

  - **`defineConfig()` helper** — new type-safe wrapper for `chat.config.ts`. The gateway type is inferred from `ai.gateway`, so autocomplete and type errors are scoped to the model IDs available in the chosen gateway. Replace `satisfies ConfigInput` with `defineConfig({...})`.
  - **Gateway-specific defaults** — all AI config fields (models, tools, workflows) are now optional. Omitted fields are automatically filled from per-gateway defaults at runtime via `applyDefaults()`. Only `ai.gateway` is required.
  - **`chatjs config` CLI command** — new command that prints the fully-resolved configuration for the current project, applying all defaults. Useful for debugging and verifying your setup.
  - **Separate defaults per gateway** — `vercel`, `openrouter`, `openai`, and `openai-compatible` each have their own typed defaults (`ModelDefaultsFor<G>`), ensuring model IDs are validated against the correct gateway's model registry.
  - **Stricter image/video tool schemas** — `tools.image` and `tools.video` now use a discriminated union: `enabled: true` requires a `default` model, while `enabled: false` makes it optional.

  ### Breaking changes

  None — existing configs using `satisfies ConfigInput` continue to work. Migrating to `defineConfig()` is recommended for better DX but not required.
