# @chat-js/cli

CLI to scaffold and extend ChatJS apps.

## Usage

```bash
npx @chat-js/cli@latest
```

Or with the command alias:

```bash
npx @chat-js/cli@latest create
```

After install, the binary is:

- `chat-js`

Choose the existing app's gateway interactively, or pass a built-in name, external registry item URL, or local JSON path:

```sh
chat-js create my-chat --gateway vercel
chat-js create my-chat --gateway https://example.com/r/acme-gateway.json
chat-js create my-chat --gateway ./acme-gateway.json
```

The CLI installs only that item's adapter files and declared dependencies. `@chat-js/gateways` supplies shared contracts and utilities, with no gateway implementations. Third-party items declare their own ID, defaults, capabilities, and credentials; the CLI has no fixed gateway enum. See [gateway authoring](https://github.com/FranciscoMoretti/chat-js/blob/main/packages/registry/src/gateways/README.md) for the version 1 contract.

Run `bun --filter @chat-js/cli test:gateways` from the repository root to verify independent installs of all built-ins and an external registry gateway.

## Installation and migration

The `0.9.0-beta.2` release candidate supports Base UI and Radix with matching registry `0.2.0-beta.2`. Use a local build until these candidates are published, then invoke `npx @chat-js/cli@0.9.0-beta.2` for the examples below. The earlier beta.0 releases support Base UI only. Stable `latest` is unchanged.

Pass native shadcn visual options after `--`:

```sh
chat-js create my-chat --yes --gateway openrouter --attachments --sandbox-provider vercel --storage-provider s3 --storage-config '{"bucket":"uploads"}' -- --preset b27I2r8C --base base --no-rtl --pointer
```

ChatJS invokes native `init` before selected registry source is installed and reinstalls the scaffold's native primitives to match the preset. Native spelling, ordering, values, and errors are preserved; ChatJS has no theme schema or preset decoder. Without native arguments, creation retains the maintained Base UI/Rhea scaffold. Pass `--base radix` to generate native Radix primitives and matching application compositions; pass `--base base` for Base UI. React Aria is rejected before scaffolding. Directory, template, monorepo, and initialization lifecycle flags belong to ChatJS and cannot be forwarded; `--from-git` never applies native initialization arguments.

Uploads require durable storage and a sandbox that supports persistent files. Pass `--sandbox-provider vercel` or a compatible external registry provider when enabling `--attachments`. The built-in Daytona adapter currently supports code execution only. Create's web configurator includes Vercel Sandbox when uploads are selected. Configure the generated sandbox credentials and use `bun dev:supervise` for local attachment conversations. The CLI validates the selected or installed provider's literal `supportsPersistentSandbox = true` declaration without executing its source, including when replacing providers in an app that already has uploads.

For a fresh Radix app with a native preset:

```sh
chat-js create my-chat --yes -- --preset b27I2r8C --base radix
```

The reference app remains Base UI. Fresh generation adapts application composition to the selected library and installs the native shadcn component source for that library. It does not install a permanent compatibility layer between Base UI and Radix.

For an existing app, use shadcn directly to change only theme or font without replacing component implementations:

```sh
bunx shadcn@4.22.1 apply <preset> --only theme
bunx shadcn@4.22.1 apply <preset> --only font
```

To change component shape or icon library as well, native shadcn must regenerate the installed primitives. Commit your app first, inspect native `add --diff` output for components you customized, then apply your chosen preset with native `init --preset <preset> --base <existing-base> --force --reinstall`, substituting the app's existing `base` or `radix` library. This replaces native component source. Keep application behavior in compositions outside `components/ui` so later native updates stay small.

Existing ChatJS applications need a source migration; upgrading the CLI does not rewrite an app's conversation or composer. Use the current scaffold as the reference:

| Previous composition | Current source |
| --- | --- |
| Message/conversation wrappers | `components/ui/message`, `bubble`, `message-scroller`, `attachment` |
| Prompt-input facade | `components/composer/prompt-form` with native InputGroup; preserve the app's editor and submission handlers |
| Tool/reasoning wrappers | Native Trace with `components/part/tool-activity`, `tool-data`, and `message-reasoning` |
| Code-block facade | Native CodeBlock plus `components/code-snippet`, `hooks/use-highlighted-code`, and `lib/highlighter` |
| Sandbox facade | `components/sandbox`, composing native Trace, Tabs and CodeBlock |

Migrate callers together with primitives. Base UI menu actions use `onClick` and custom triggers use `render`; Radix uses `onSelect` and `asChild`. Passing Radix `onSelect` to a Base UI menu may compile without running the action. Use each library's native composition and ordinary links styled with `buttonVariants` for navigation. Preserve EVE message IDs, scroll anchoring, draft/IME behavior, approval dispatch before specialized renderers, and document revision actions. Verify these flows in your app before removing the old wrappers. Markdown still uses Streamdown; tool-specific renderers remain installed source.

This CLI candidate pins new apps to `@chat-js/registry@0.2.0-beta.2`. Matching registry builds preserve the root Base namespace and add complete `/base/{name}.json` and `/radix/{name}.json` namespaces. Fresh Radix generation selects `/radix/`; item IDs and installation targets remain the same. Subsequent `add` and `sync` retain the configured namespace and check the host's native `base-*` or `radix-*` style before writing source or registrations.

UI-specific plugins and tools declare descriptor `contractVersion: 2` with matching `uiBase: "base"` or `uiBase: "radix"`. A mismatch stops installation; v2 descriptor versions do not prescribe npm major versions. Legacy v1 descriptors remain supported. Existing applications are not automatically migrated between libraries: changing `components.json` or a registry URL alone is insufficient. Keep the compatible registry namespace until migrating primitives and callers together. Publish the matching registry candidate before the CLI candidate, both under `beta`. This does not move stable `latest` or replace earlier published versions.

Run `bun --cwd packages/cli test:native-create` to generate a real standalone preset app with uploads, OpenRouter, S3 and Vercel Sandbox, verify native preset resolution and add/sync preservation, then typecheck the result. Set `CHATJS_KEEP_NATIVE_FIXTURE=1` to retain the generated app and logs. This check needs network access but no gateway or storage credentials.

The CLI uses unmodified shadcn 4.22.1 for registry resolution and installation. New apps use the invoking package manager, with Bun as the fallback. Existing apps use their standard package metadata and lockfiles. Dependencies install immediately. `--no-install`, `--package-manager`, and `--registry` are removed. Configure registry namespaces in `components.json` instead:

```json
{ "registries": { "@acme": "https://example.com/r/{name}.json" } }
```

```sh
chat-js add @acme/my-tool --yes
chat-js add word-count --overwrite
chat-js sync
```

### Manual connection when automatic registration conflicts

Normal `add` maintains generated registrations in `chatjs/generated`; app-owned integration files consume those registrations and remain editable. If a legacy layout, edited index, or conflicting provider prevents automatic connection, export the source instead:

```sh
chat-js add projects --files-only
chat-js add @acme/my-tool --files-only
```

`--files-only` writes a unique bundle in the operating system's temporary directory and prints its path. It does not install packages, change application files, write receipts, or register plugins. The bundle includes dependency source, a `manifest.json` mapping files to intended destinations and integration metadata, full upstream registry items, and a manual connection guide. Conflicting items remain separate so both implementations can be reviewed. Omit `--replace`, `--overwrite`, and `--storage-config` in this mode.

This is raw registry source, not a shadcn-transformed installation: review aliases, package dependencies, styling and library adaptations before copying selected files. Keep existing `components/ui` primitives when they already meet the dependency. Connect behavior and components in app-owned composition. Review native routes, EVE hooks and database schemas separately because their placement can activate behavior. Keep descriptors out of auto-discovered `chatjs/plugins/` and `chatjs/tools/` directories unless enrolling the item in `sync`; do not copy the bundle wholesale into your app. Manual copies are app-owned and are not enrolled in `status` or `remove`. Move the bundle to a durable location if you need to retain it beyond temporary-directory cleanup.

After resolving the conflict, managed installation remains available by rerunning the original selection without `--files-only`. Existing source protections still apply.

Tools install under `chatjs/tools`; `paths.tools` is no longer configuration. Generated server/client indexes in `chatjs/generated/` supply static inputs to app-owned `integrations/tools/execution.ts` and `integrations/tools/ui.ts`. Tool source remains yours to edit. Each tool registration can include `composer: { icon, name, shortName }` in its `chatjs.json` descriptor, where `icon` names a Lucide React icon export (including aliases). Sync validates it against the bundled Lucide catalog and rejects unknown names before changing generated files. Installed tools without optional display metadata use their tool name and a generic icon. Sync generates `chatjs/generated/composer-tools.ts` from installed descriptors; the menu and active-tool pill share this metadata independently of application-owned menu ordering. Removing a tool and syncing removes its metadata. A restored selection for an absent tool stays clearable and blocks sending until cleared or replaced. Missing descriptors and manually edited generated indexes cause an actionable error.

`create --from-git` preserves the cloned repository's configuration, dependencies, and installed source. It does not contact the registry or apply plugin-selection flags. Follow the cloned repository's setup instructions; use `chat-js add` for subsequent tool installations. Fresh scaffolds assemble the selected plugins. Direct shadcn installations require `chat-js sync` afterward.

Older apps using `features/` descriptors or generated/custom registrations under `chatjs/tools/` must migrate before running `add` or `sync`. The CLI detects this layout and stops before writing. Use the current template to move implementation/descriptors into `chatjs/plugins/<id>`, generated registrations into `chatjs/generated`, and custom registrations into `integrations/tools/execution.ts` and `integrations/tools/ui.ts`. Update imports and adopt the plugin descriptor plus server/client factory contract, then remove the old registration files.

## MCP and composer controls

Selecting MCP during app creation installs its tRPC router, connector settings pages, OAuth callback, and agent integration. Skipping MCP leaves those source files and database schemas out of the fresh scaffold. Historical message rendering remains available. The MCP registry item builds from canonical source in `packages/registry/src/plugins/mcp`. The demo contains installed copies. Use `--mcp` or `--no-mcp` to select MCP during creation.

Use `chat-js add mcp` to install MCP later. Installed registrations determine availability. Set `MCP_ENCRYPTION_KEY` whenever MCP is installed, including before any connectors are added. Missing credentials produce an explicit setup error. For a direct shadcn installation, run `chat-js sync` to register its server and UI contributions.

Plugins export module-scope `definePlugin` declarations with typed slot contributions. Generated chat and layout lists reference those declarations. App-owned JSX places `SidebarSections`, `ChatActions`, `MessageActions`, settings links, account summaries, and other slots. `ComposerAttachments` and `ComposerExtensions` surround the app-owned tool controls in `composer-controls.ts`. Neither `add` nor `sync` rewrites this JSX or the plugin's component declarations.

Edit installed components directly or contribute normal React wrappers. Keep declarations at module scope, and use ordinary dynamic imports and Suspense for expensive UI. Plugin removal updates the generated list, so slots without contributions render nothing. UI placement does not change authorization.

Older apps need to adopt the current provider and slot composition explicitly. The CLI preserves existing customization and does not migrate arbitrary source expressions.

`chatjs/generated/installed-routers.ts` and `chatjs/generated/installed.ts` are generated from installed plugin descriptors. Compose application-specific routers in `integrations/routers.ts`; native tRPC consumes the result. Bundle and dependency optimization are separate from this source-installation boundary.

## Removing plugins

```sh
chat-js remove projects sharing --dry-run
chat-js remove projects sharing
chat-js remove projects --backup
```

Removal plans the complete change before writing: plugin source, Next/EVE adapters, and generated registrations. Required plugins and dangling static imports from app-owned source block removal. Modified or untracked source requires `--backup`, which retains removed files as `.bak` files at their original relative paths under `chatjs/removed-plugins/<run-id>/`. The command prints this path. `--yes` skips the prompt but never bypasses source protection. Reinstall using `chat-js add`, then restore selected customizations from the backup.

Database schema files and their plugin-local dependencies stay at their original paths. `chatjs/retained-plugin-schemas.json` keeps them in Drizzle's schema inputs after runtime registration is removed. Removing plugin code does not delete database data or generate a destructive migration. Review any later schema retirement separately. Shared UI primitives, package dependencies, environment values, and migration history are retained.

Source installed directly through shadcn has no ChatJS source receipt, so removal requires `--backup`. Import checks cover relative and `@/` static imports, re-exports and literal dynamic imports. Review integrations using computed imports or other custom aliases yourself.
