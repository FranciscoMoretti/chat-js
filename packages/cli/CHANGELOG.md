# @chat-js/cli

## 0.7.0

### Minor Changes

- [#201](https://github.com/FranciscoMoretti/chat-js/pull/201) [`dbd6cb0`](https://github.com/FranciscoMoretti/chat-js/commit/dbd6cb0cfa8ed5ae497fa500e1f45a869974f235) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Add LiteLLM gateway scaffolding support, including generated config defaults,
  environment checklist coverage for `LITELLM_BASE_URL`, and optional
  `LITELLM_API_KEY` documentation for authenticated proxies.

## 0.6.5

### Patch Changes

- [#198](https://github.com/FranciscoMoretti/chat-js/pull/198) [`e85a88f`](https://github.com/FranciscoMoretti/chat-js/commit/e85a88fe062a95f28a6c68898e49a64b001da3cb) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Fix scaffold config validation, registry-tool install issues, and pnpm native build approvals across package managers and gateway/tool combinations.

## 0.6.4

### Patch Changes

- [#186](https://github.com/FranciscoMoretti/chat-js/pull/186) [`f705f77`](https://github.com/FranciscoMoretti/chat-js/commit/f705f778bb6292b90d52dd49f018c45baa7169ae) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Revamp navigation

- [#195](https://github.com/FranciscoMoretti/chat-js/pull/195) [`16654a2`](https://github.com/FranciscoMoretti/chat-js/commit/16654a293e0380a0d5a9457962c9556ebf4b989a) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Revamped navigation to handle multi route streaming and transitions

## 0.6.3

### Patch Changes

- [#180](https://github.com/FranciscoMoretti/chat-js/pull/180) [`eee3cdc`](https://github.com/FranciscoMoretti/chat-js/commit/eee3cdcf32c89129d895774cfed420914c058214) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Unify package releases around Changesets by removing the dedicated registry
  deploy workflow and switching the CLI's default registry source to the
  published `@chat-js/registry` package on npm.

## 0.6.2

### Patch Changes

- Test patch release generation across all releasable packages.

## 0.6.1

### Patch Changes

- [#165](https://github.com/FranciscoMoretti/chat-js/pull/165) [`357def8`](https://github.com/FranciscoMoretti/chat-js/commit/357def8f78b27310182fcfd2f884d0c864179c85) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - support for all package managers

## 0.6.0

### Minor Changes

- [#136](https://github.com/FranciscoMoretti/chat-js/pull/136) [`a825e73`](https://github.com/FranciscoMoretti/chat-js/commit/a825e73e79888634d1b8c890118fe8554f92a9fb) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Electron desktop app scaffolding is available from the `create` command via `Include an Electron desktop app?`. Accepted projects get a pre-configured `electron/` subfolder with the main process, preload script (context isolation), system tray, deep-link OAuth flow, auto-updater (GitHub Releases), and Electron Forge config for macOS, Windows, and Linux targets.

## 0.4.0

### Minor Changes

- Add Electron desktop app scaffolding. The `create` command now prompts `Include an Electron desktop app?` and, when accepted, copies a pre-configured `electron/` subfolder into the new project. The folder includes the main process, preload script (context isolation), system tray, deep-link OAuth flow, auto-updater (GitHub Releases), and Electron Forge config for macOS, Windows, and Linux targets.
- [#107](https://github.com/FranciscoMoretti/chat-js/pull/107) [`bd8bd35`](https://github.com/FranciscoMoretti/chat-js/commit/bd8bd351ea4775bd505cb1d45090a8c12df76d7f) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Parallel responses (Use multiple models)

## 0.3.0

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

## 0.2.1

### Patch Changes

- [#100](https://github.com/FranciscoMoretti/chat-js/pull/100) [`a665893`](https://github.com/FranciscoMoretti/chat-js/commit/a665893048abdcded8be5040a243cfcd1b9bd0eb) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - - Improve AI title generation prompt for cleaner, more concise titles
  - Switch title and followup suggestion workflows to `google/gemini-2.5-flash-lite`
  - Refactor followup suggestions to use recent messages for better context
  - Fix streamdown source path in globals.css for wildcard imports
  - Rename internal references from `chat.js` to `chat-js` for consistency
  - Simplify template sync process

## 0.2.0

### Minor Changes

- [#94](https://github.com/FranciscoMoretti/chat-js/pull/94) [`2a8a7cc`](https://github.com/FranciscoMoretti/chat-js/commit/2a8a7cc2b0649bd73e41999dbf0528a21e8065be) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Video generation and new config
