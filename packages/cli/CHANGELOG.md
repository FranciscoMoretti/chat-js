# @chat-js/cli

## 1.0.0

### Major Changes

- [#346](https://github.com/FranciscoMoretti/chat-js/pull/346) [`2962417`](https://github.com/FranciscoMoretti/chat-js/commit/296241729e7235be9e91149f37f79b7dfb678fb7) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Build standard registry JSON from tested TypeScript sources using shadcn. Use shadcn for gateway/tool installation and generate typed registrations from local tool descriptors. Add `chat-js sync` and separate custom registration modules.

  Registry v1 publishes `dist/r/`; historical v0 npm artifacts keep their legacy format. Publish registry v1 and gateway contracts before promoting the CLI. Remove `--registry`, `--no-install`, `--package-manager`, and `paths.tools` in favor of standard namespaces, immediate installation, package-manager detection, and explicit registry targets. Known legacy built-in registrations migrate on sync.

### Minor Changes

- [#308](https://github.com/FranciscoMoretti/chat-js/pull/308) [`18db694`](https://github.com/FranciscoMoretti/chat-js/commit/18db694b9b67263904707a85f93673f494ea0e6d) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Upgrade ChatJS and generated applications to AI SDK 7 and provider v4. Thread now requires ai >=7.0.93 and @ai-sdk/react >=4.0.96 within their current majors, with Node >=22. Preserve canonical assistant identity, restored tool ownership, and errors across reconnects.

- [#351](https://github.com/FranciscoMoretti/chat-js/pull/351) [`0fef3dc`](https://github.com/FranciscoMoretti/chat-js/commit/0fef3dca5d7f02e9cbec4a5dce5b2df3fb0fbf55) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Make generated Postgres setup independent of the database host. Support a separate schema connection and runtime pooling options, run explicit migrations without Vercel environment flags, and expose Neon branching through opt-in commands.

  Guide Postgres setup by host and add an explicit, read-only `db:connect` check.

- [#352](https://github.com/FranciscoMoretti/chat-js/pull/352) [`03ca3c5`](https://github.com/FranciscoMoretti/chat-js/commit/03ca3c5047e72ce45353174a46de6dfad577c59e) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Validate standard Redis connection URLs, document provider setup, and add a redis:connect capability check for generated apps.

- [#332](https://github.com/FranciscoMoretti/chat-js/pull/332) [`5b6664e`](https://github.com/FranciscoMoretti/chat-js/commit/5b6664e7b846851228605933160281b07a4b0ce2) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Select AI gateways during ChatJS creation through shadcn-format registry items, including external registry URLs. Install only the selected adapter source and its declared dependencies. Keep shared contracts and runtime utilities in @chat-js/gateways, and validate configuration against the installed adapter.

- [#358](https://github.com/FranciscoMoretti/chat-js/pull/358) [`5d55983`](https://github.com/FranciscoMoretti/chat-js/commit/5d5598361cf3bed3e7df5a2efa2b467e0dc9a54e) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Extract Tavily and Firecrawl search into selectable registry tools shared by chat and deep research. Add the webSearch factory slot, selected credential requirements, and the --search-tool create option.

- [#360](https://github.com/FranciscoMoretti/chat-js/pull/360) [`62cdaf2`](https://github.com/FranciscoMoretti/chat-js/commit/62cdaf2316cbfa1a8e5100e41d88513671962c5c) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Distribute Vercel code execution as a source registry item. Let code-execution and search selections export standard AI SDK tools with their own schemas and optional renderers. Install only the selected implementations in new apps and pass request services through AI SDK tool context.

- [#362](https://github.com/FranciscoMoretti/chat-js/pull/362) [`d1e1eb8`](https://github.com/FranciscoMoretti/chat-js/commit/d1e1eb89245145d3afd7cba4ec37f35ce9dfa838) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Select image generation from built-in or external registry items. Fresh apps install only the selected image tool and renderer, with request services supplied through AI SDK context.

- [#361](https://github.com/FranciscoMoretti/chat-js/pull/361) [`10e1996`](https://github.com/FranciscoMoretti/chat-js/commit/10e1996a72c64619a00ec5482d67c9a9c05dda62) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Select URL retrieval tools during creation using the retrieveUrl slot. Install only the selected provider and derive its credential requirements from registry metadata.

- [#363](https://github.com/FranciscoMoretti/chat-js/pull/363) [`0a8ca04`](https://github.com/FranciscoMoretti/chat-js/commit/0a8ca041baabe045e17a351b4e8836c3c2850a2c) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Install video generation as a selectable registry tool with optional renderer, provider credentials, and request context. Omit the built-in implementation from unselected apps.

- [#350](https://github.com/FranciscoMoretti/chat-js/pull/350) [`5691d2a`](https://github.com/FranciscoMoretti/chat-js/commit/5691d2aa1e3ea1866e991db6678f186ca8acfaaa) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Install storage adapters through shadcn registry items. Support external storage items during app creation, generate typed provider options, and validate declared environment requirements without requiring a built-in Files SDK provider name.

### Patch Changes

- Updated dependencies [[`ea73556`](https://github.com/FranciscoMoretti/chat-js/commit/ea73556a6d3805687ba9dcf755d9d766376dcddf), [`5b6664e`](https://github.com/FranciscoMoretti/chat-js/commit/5b6664e7b846851228605933160281b07a4b0ce2)]:
  - @chat-js/gateways@0.2.0

## 0.8.0

### Minor Changes

- [#269](https://github.com/FranciscoMoretti/chat-js/pull/269) [`8210f85`](https://github.com/FranciscoMoretti/chat-js/commit/8210f85e79827e424772a7a02627d6a587f90461) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Ship Instant Navigations in the scaffolded chat app. New apps use Next.js 16.3 with Cache Components and Partial Prefetching enabled, so route shells stream instead of blocking on cookies/session.

## 0.7.0

### Minor Changes

- [#201](https://github.com/FranciscoMoretti/chat-js/pull/201) [`dbd6cb0`](https://github.com/FranciscoMoretti/chat-js/commit/dbd6cb0cfa8ed5ae497fa500e1f45a869974f235) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Add LiteLLM gateway scaffolding support, including generated config defaults, environment checklist coverage for `LITELLM_BASE_URL`, and optional `LITELLM_API_KEY` documentation for authenticated proxies.

## 0.6.5

### Patch Changes

- [#198](https://github.com/FranciscoMoretti/chat-js/pull/198) [`e85a88f`](https://github.com/FranciscoMoretti/chat-js/commit/e85a88fe062a95f28a6c68898e49a64b001da3cb) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Fix scaffold config validation, registry-tool install issues, and pnpm native build approvals across package managers and gateway/tool combinations.

## 0.6.4

### Patch Changes

- [#186](https://github.com/FranciscoMoretti/chat-js/pull/186) [`f705f77`](https://github.com/FranciscoMoretti/chat-js/commit/f705f778bb6292b90d52dd49f018c45baa7169ae) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Revamp navigation

- [#195](https://github.com/FranciscoMoretti/chat-js/pull/195) [`16654a2`](https://github.com/FranciscoMoretti/chat-js/commit/16654a293e0380a0d5a9457962c9556ebf4b989a) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Revamped navigation to handle multi route streaming and transitions

## 0.6.3

### Patch Changes

- [#180](https://github.com/FranciscoMoretti/chat-js/pull/180) [`eee3cdc`](https://github.com/FranciscoMoretti/chat-js/commit/eee3cdcf32c89129d895774cfed420914c058214) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Unify package releases around Changesets by removing the dedicated registry deploy workflow and switching the CLI's default registry source to the published `@chat-js/registry` package on npm.

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
