# @chat-js/registry

## 0.2.0

### Minor Changes

- [#906](https://github.com/FranciscoMoretti/chat-js/pull/906) [`95bfbcb`](https://github.com/FranciscoMoretti/chat-js/commit/95bfbcb3ef01c7d03a0b79a545e9fb425c4ed7c6) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Extract Desktop into an optional registry plugin with authentication, navigation, and session synchronization contributions. Install the web integration and Electron companion together through create or add desktop, keep web-only apps free of desktop code and dependencies, and generate the companion's runtime configuration during prebuild.

## 0.2.0-beta.2

### Beta Changes

- Allow model descriptions to wrap in settings rows, keeping enable switches inside narrow mobile viewports for both Base UI and Radix.
- Preserve existing registry contracts and namespaces. Gateway and sandbox packages remain at `0.2.0`.
- Publish under `beta`; stable `latest` remains unchanged.

## 0.2.0-beta.1

### Beta Changes

- Publish matching Base UI and Radix registry sources under `/base/` and `/radix/`, preserving the root Base namespace and existing item names and installation targets. UI-dependent descriptors declare the selected `uiBase` with contract version 2, independent of npm versioning.
- Generate native Radix compositions from the maintained Base source, preserving menu actions, triggers, checked state, and hover behavior without shipping a runtime compatibility layer. Keep Base source byte-identical to its existing namespace.
- Declare that attachment uploads require a persistent sandbox so CLI installation can reject incompatible providers before writes. Gateway and sandbox contract packages remain at `0.2.0`.
- Publish this prerelease under `beta`; stable `latest` remains unchanged.

## 0.2.0-beta.0

### Beta Changes

- Create apps from native shadcn presets and options through the explicit `--` argument boundary. Initialize and reinstall Base UI components before installing ChatJS features, preserve native configuration during later additions and sync, and keep application helpers outside shadcn-owned utilities.

  Ship the Base UI registry as an opt-in prerelease pinned to 0.2.0-beta.0. Base-dependent plugins and document tools declare version-2 descriptors, while the CLI validates host compatibility before writes and continues reading legacy version-1 descriptors. Existing Radix applications must retain their previous registry source until their primitives and callers are migrated together.

  Publish the shared gateway and sandbox contracts first, then the registry beta, then the matching CLI beta. Publish both prereleases with the beta tag; stable latest remains unchanged. Descriptor contractVersion 2 identifies the Base UI host contract independently of npm versioning.

- Build standard registry JSON from tested TypeScript sources using shadcn. Use shadcn for gateway/tool installation and generate typed registrations from local tool descriptors. Add `chat-js sync` and separate custom registration modules.

  The standard registry publishes `dist/r/`; historical v0 npm artifacts keep their legacy format. Publish the registry beta and gateway contracts before the CLI beta. Remove `--registry`, `--no-install`, `--package-manager`, and `paths.tools` in favor of standard namespaces, immediate installation, package-manager detection, and explicit registry targets. Known legacy built-in registrations migrate on sync.

### Minor Changes

- Add an optional persistent filesystem capability to the shared sandbox provider contract and its Vercel registry implementation. Use app-owned EVE resource lifecycle handling when the installed provider supports persistent files. No-provider and execution-only installations explicitly disable EVE filesystem access without resolving sandbox credentials. Cleanup resolves providers only for outstanding owned resources. Requires a fresh world and current database schema. Release the shared package before distributing consumers of its new persistent export.

- Install Daytona as a non-Vercel code-execution provider, sharing Python and JavaScript output handling and the typed executor used by saved documents. Track durable allocations, terminate cancelled runs, confirm deletion before releasing ownership, and retain uncertain allocations for reconciliation.

  Validate execution capability declarations before installing new providers and preserve replacement of older installed descriptors. Live Daytona acceptance still requires provider credentials and native lifecycle validation.

- Separate optional sandbox infrastructure from code-execution tools. Add a shared provider and lifecycle contract with Vercel and Daytona implementations, selected through `--sandbox-provider`. Install the generic `code-execution` tool instead of the former `vercel-code-execution` or `daytona-code-execution` items. Saved-code execution reuses the generic executor and requires an explicit sandbox selection when none is installed.

  This release targets newly scaffolded apps. Upgrading apps generated by previous releases is unsupported; no compatibility aliases or migration shims are included.

- Select AI gateways during ChatJS creation through shadcn-format registry items, including external registry URLs. Install only the selected adapter source and its declared dependencies. Keep shared contracts and runtime utilities in @chat-js/gateways, and validate configuration against the installed adapter.

- Extract Tavily and Firecrawl search into selectable registry tools shared by chat and deep research. Add the webSearch factory slot, selected credential requirements, and the --search-tool create option.

- Distribute Vercel code execution as a source registry item. Let code-execution and search selections export standard AI SDK tools with their own schemas and optional renderers. Install only the selected implementations in new apps and pass request services through AI SDK tool context.

- Select image generation from built-in or external registry items. Fresh apps install only the selected image tool and renderer, with request services supplied through AI SDK context.

- Select URL retrieval tools during creation using the retrieveUrl slot. Install only the selected provider and derive its credential requirements from registry metadata.

- Install video generation as a selectable registry tool with optional renderer, provider credentials, and request context. Omit the built-in implementation from unselected apps.

- Install storage adapters through shadcn registry items. Support external storage items during app creation, generate typed provider options, and validate declared environment requirements without requiring a built-in Files SDK provider name.

### Patch Changes

- Use the upstream MCP SSE OAuth refresh fix and Files SDK private Blob signing in generated applications. Remove the MCP patch archive, align AI SDK type versions, and retain the existing storage provider selection.

## 0.1.2

### Patch Changes

- [#180](https://github.com/FranciscoMoretti/chat-js/pull/180) [`eee3cdc`](https://github.com/FranciscoMoretti/chat-js/commit/eee3cdcf32c89129d895774cfed420914c058214) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Unify package releases around Changesets by removing the dedicated registry deploy workflow and switching the CLI's default registry source to the published `@chat-js/registry` package on npm.

## 0.1.1

### Patch Changes

- [#159](https://github.com/FranciscoMoretti/chat-js/pull/159) [`a507edd`](https://github.com/FranciscoMoretti/chat-js/commit/a507edd5e6678cadc5b73937d3c5baac49af246e) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Publish `@chat-js/registry` as a public package and expose its generated registry artifacts plus shared tool env requirement types.

- Test patch release generation across all releasable packages.
