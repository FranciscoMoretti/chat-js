# @chat-js/cli

## 0.9.0

### Minor Changes

- [#906](https://github.com/FranciscoMoretti/chat-js/pull/906) [`95bfbcb`](https://github.com/FranciscoMoretti/chat-js/commit/95bfbcb3ef01c7d03a0b79a545e9fb425c4ed7c6) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Extract Desktop into an optional registry plugin with authentication, navigation, and session synchronization contributions. Install the web integration and Electron companion together through create or add desktop, keep web-only apps free of desktop code and dependencies, and generate the companion's runtime configuration during prebuild.

## 0.9.0-beta.2

### Beta Changes

- Exclude maintainer-only visual fixture stylesheets from generated apps.
- Pin new apps to registry `0.2.0-beta.2` and include its model-settings layout fix in the scaffold.
- Keep long mobile model descriptions wrapped so the enable switches remain visible and usable with both Base UI and Radix.
- Publish under `beta`; stable `latest` remains unchanged.

## 0.9.0-beta.1

### Beta Changes

- Generate fresh Base UI or Radix apps using native shadcn presets and options. Adapt application composition to native Radix components during scaffolding, select the matching registry namespace, and validate UI compatibility before later installs or sync. No runtime compatibility layer or automatic migration of existing applications is added.
- Pin new apps to registry `0.2.0-beta.1`, including its Base and Radix sources. Keep native shadcn argument semantics and application-owned customizations intact. Handle the native library-switch confirmation for fresh scaffolds and omit maintainer-only visual fixtures from generated apps.
- Require an uploads-compatible persistent sandbox when selecting attachments or changing providers in an app with uploads. Validate capabilities before installation writes; preserve existing apps when the selection is incompatible.
- Retain TypeScript as a runtime dependency for source generation. Publish this prerelease under `beta`; stable `latest` remains unchanged.

## 0.9.0-beta.0

### Beta Changes

- Create apps from native shadcn presets and options through the explicit `--` argument boundary. Initialize and reinstall Base UI components before installing ChatJS features, preserve native configuration during later additions and sync, and keep application helpers outside shadcn-owned utilities.

  Ship the Base UI registry as an opt-in prerelease pinned to 0.2.0-beta.0. Base-dependent plugins and document tools declare version-2 descriptors, while the CLI validates host compatibility before writes and continues reading legacy version-1 descriptors. Existing Radix applications must retain their previous registry source until their primitives and callers are migrated together.

  Publish the shared gateway and sandbox contracts first, then the registry beta, then the matching CLI beta. Publish both prereleases with the beta tag; stable latest remains unchanged. Descriptor contractVersion 2 identifies the Base UI host contract independently of npm versioning.

- Build standard registry JSON from tested TypeScript sources using shadcn. Use shadcn for gateway/tool installation and generate typed registrations from local tool descriptors. Add `chat-js sync` and separate custom registration modules.

  The standard registry publishes `dist/r/`; historical v0 npm artifacts keep their legacy format. Publish the registry beta and gateway contracts before the CLI beta. Remove `--registry`, `--no-install`, `--package-manager`, and `paths.tools` in favor of standard namespaces, immediate installation, package-manager detection, and explicit registry targets. Known legacy built-in registrations migrate on sync.

### Minor Changes

- Upgrade ChatJS and generated applications to AI SDK 7 and provider v4. Thread now requires ai >=7.0.93 and @ai-sdk/react >=4.0.96 within their current majors, with Node >=22. Preserve canonical assistant identity, restored tool ownership, and errors across reconnects.

- Install Daytona as a non-Vercel code-execution provider, sharing Python and JavaScript output handling and the typed executor used by saved documents. Track durable allocations, terminate cancelled runs, confirm deletion before releasing ownership, and retain uncertain allocations for reconciliation.

  Validate execution capability declarations before installing new providers and preserve replacement of older installed descriptors. Live Daytona acceptance still requires provider credentials and native lifecycle validation.

- Separate optional sandbox infrastructure from code-execution tools. Add a shared provider and lifecycle contract with Vercel and Daytona implementations, selected through `--sandbox-provider`. Install the generic `code-execution` tool instead of the former `vercel-code-execution` or `daytona-code-execution` items. Saved-code execution reuses the generic executor and requires an explicit sandbox selection when none is installed.

  This release targets newly scaffolded apps. Upgrading apps generated by previous releases is unsupported; no compatibility aliases or migration shims are included.

- Make generated Postgres setup independent of the database host. Support a separate schema connection and runtime pooling options, run explicit migrations without Vercel environment flags, and expose Neon branching through opt-in commands.

  Guide Postgres setup by host and add an explicit, read-only `db:connect` check.

- Validate standard Redis connection URLs, document provider setup, and add a redis:connect capability check for generated apps.

- Select AI gateways during ChatJS creation through shadcn-format registry items, including external registry URLs. Install only the selected adapter source and its declared dependencies. Keep shared contracts and runtime utilities in @chat-js/gateways, and validate configuration against the installed adapter.

- Extract Tavily and Firecrawl search into selectable registry tools shared by chat and deep research. Add the webSearch factory slot, selected credential requirements, and the --search-tool create option.

- Distribute Vercel code execution as a source registry item. Let code-execution and search selections export standard AI SDK tools with their own schemas and optional renderers. Install only the selected implementations in new apps and pass request services through AI SDK tool context.

- Select image generation from built-in or external registry items. Fresh apps install only the selected image tool and renderer, with request services supplied through AI SDK context.

- Select URL retrieval tools during creation using the retrieveUrl slot. Install only the selected provider and derive its credential requirements from registry metadata.

- Install video generation as a selectable registry tool with optional renderer, provider credentials, and request context. Omit the built-in implementation from unselected apps.

- Install storage adapters through shadcn registry items. Support external storage items during app creation, generate typed provider options, and validate declared environment requirements without requiring a built-in Files SDK provider name.

### Patch Changes

- Add an optional persistent filesystem capability to the shared sandbox provider contract and its Vercel registry implementation. Use app-owned EVE resource lifecycle handling when the installed provider supports persistent files. No-provider and execution-only installations explicitly disable EVE filesystem access without resolving sandbox credentials. Cleanup resolves providers only for outstanding owned resources. Requires a fresh world and current database schema. Release the shared package before distributing consumers of its new persistent export.

- Use the upstream MCP SSE OAuth refresh fix and Files SDK private Blob signing in generated applications. Remove the MCP patch archive, align AI SDK type versions, and retain the existing storage provider selection.

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
