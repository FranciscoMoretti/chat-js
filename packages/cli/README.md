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

The CLI uses unmodified shadcn 4.21.0 for registry resolution and installation. New apps use the invoking package manager, with Bun as the fallback. Existing apps use their standard package metadata and lockfiles. Dependencies install immediately. `--no-install`, `--package-manager`, and `--registry` are removed. Configure registry namespaces in `components.json` instead:

```json
{ "registries": { "@acme": "https://example.com/r/{name}.json" } }
```

```sh
chat-js add @acme/my-tool --yes
chat-js add word-count --overwrite
chat-js sync
```

Tools install under `tools/chatjs`; `paths.tools` is no longer configuration. Generated server/client indexes merge user-owned `custom-tools.ts` and `custom-ui.ts`. Known legacy built-in indexes are migrated automatically. For customized legacy indexes, move registrations into the custom modules and remove the old indexes before syncing. Tool source remains yours to edit. Each tool registration can include `composer: { icon, name, shortName }` in its `chatjs.json` descriptor, where `icon` names a Lucide React icon export (including aliases). Sync validates it against the bundled Lucide catalog and rejects unknown names before changing generated files. Installed tools without optional display metadata use their tool name and a generic icon. Sync generates `tools/chatjs/composer-tools.ts` from installed descriptors; the menu and active-tool pill share this metadata independently of application-owned menu ordering. Removing a tool and syncing removes its metadata. A restored selection for an absent tool stays clearable and blocks sending until cleared or replaced. Missing descriptors and manually edited generated indexes cause an actionable error.

`create --from-git` preserves the cloned repository's configuration, dependencies, and installed source. It does not contact the registry or apply feature-selection flags. Follow the cloned repository's setup instructions; use `chat-js add` for subsequent tool installations. Fresh scaffolds assemble the selected features. Direct shadcn installations require `chat-js sync` afterward.

## MCP and composer controls

Selecting MCP during app creation installs its tRPC router, connector settings pages, OAuth callback, and agent integration. Skipping MCP leaves those source files out; its database tables and historical message rendering remain available. The MCP registry item builds from canonical source in `packages/registry/src/features/mcp`. The demo contains installed copies. Use `--mcp` or `--no-mcp` to select MCP during creation.

Use `chat-js add mcp` to install MCP later. Installed registrations determine availability. Set `MCP_ENCRYPTION_KEY` whenever MCP is installed, including before any connectors are added. Missing credentials produce an explicit setup error. For a direct shadcn installation, run `chat-js sync` to register the server feature and add the MCP entries to the UI arrays yourself.

`composer-controls.ts` contains the initial order of attachments, tool choices, and connectors in the single composer menu. The model picker stays visible beside it. `settings-items.ts` controls settings navigation. Both arrays belong to the application: reorder or extend them freely. `chat-js sync` preserves them; `chat-js add mcp` appends missing MCP contributions without reordering existing entries. If a customized array can no longer be extended automatically, the CLI reports the manual integration needed.

`features/installed-routers.ts` and `features/installed.ts` are generated from installed feature descriptors. Keep application-specific routers in the main tRPC composition. Bundle and dependency optimization are separate from this source-installation boundary.

Automatic MCP removal is not supported. To remove MCP manually, remove its entries and imports from `composer-controls.ts` and `settings-items.ts`, remove the installed MCP source and `features/mcp/chatjs.json`, then run `chat-js sync`. Sync preserves application-owned UI files.
