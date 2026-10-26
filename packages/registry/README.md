# @chat-js/registry

Code-first authoring and generated shadcn registry distribution for ChatJS.

Edit the real TypeScript sources in `src/gateways/<id>/gateway.ts` and `src/tools/<id>/`. `registry.ts` declares standard item files, targets, dependencies, and validated `meta.chatjs` metadata. Test implementations by importing those sources directly.

```sh
bun run test:types
bun run test:unit
bun run build
```

`build.ts` serializes the catalog and tool descriptors, then runs published `shadcn@4.21.0 build`. shadcn reads the source files and emits `dist/r/*.json`. Both the intermediate `registry.json` and output are generated, never edited. The output directory is cleared first, so deleted items cannot survive a build.

The npm package publishes `dist/r/`. Release candidate `0.2.0-beta.2` provides the Base UI namespace `https://unpkg.com/@chat-js/registry@0.2.0-beta.2/dist/r/{name}.json`, an identical `/base/{name}.json` namespace, and native Radix source at `/radix/{name}.json`. These candidate URLs become available after publication. Historical version 0 npm artifacts retain their legacy `items/` format for already-published CLIs; existing standard-registry clients retain their configured release. UI-dependent plugins and document bundles declare `contractVersion: 2` and matching `uiBase: "base"` or `uiBase: "radix"` so incompatible hosts are rejected before ChatJS installation or synchronization writes. The shared gateway and sandbox contracts remain at published version `0.2.0`. Publish the registry candidate before the matching CLI `0.9.0-beta.2`. Use `--tag beta` for both prereleases and keep stable `latest` unchanged. Descriptor contract version 2 is independent of npm versioning. The static Vercel deployment serves the same output.

## Tools

Each tool item installs `tool.ts`, `renderer.tsx`, and `chatjs.json` under `~/tools/chatjs/<id>/`. All tools use native EVE definitions and a single contractVersion 1 descriptor with kind `tool`, id, named tool/renderer exports, optional plugin slot, and environment requirements. The version validates the format and never selects an execution adapter. The build derives it from the same typed metadata used in the catalog.

`chat-js add` delegates installation to shadcn, then generates typed server and client indexes. Direct `shadcn add` installs are supported by running `chat-js sync` afterward. Custom registrations belong in `custom-tools.ts` and `custom-ui.ts`. Third-party items use the same shape and standard namespaces in `components.json`.

See [gateway authoring](./src/gateways/README.md) for adapter-specific metadata.

## Organization and naming

Source folders group items by category. Each gateway has a `gateway.ts`; each tool has a `tool.ts` and `renderer.tsx`. Receipt and renderer helpers are supplied by the ChatJS scaffold. Category-level gateway catalog, metadata, and defaults live directly under `src/gateways/`.

`meta.chatjs.kind` identifies a gateway or tool independently of its public name. Registry namespace aliases such as `@chatjs` identify a configured registry source. Public item names remain `vercel-gateway`, `word-count`, and the other existing names. Source folders do not determine registry addresses or installation targets.

The selected gateway installs into the app's `lib/ai/gateway.ts` slot. Tools install under `tools/chatjs/<id>/` with generated registrations and separate custom modules. Third-party destination namespacing is not inferred from registry aliases and is not added by this source reorganization.

`packages/gateways` owns shared runtime contracts. `packages/cli` owns installation and configuration. `apps/chat` is the reference consumer and app template source. New categories such as layouts and caches should introduce source folders and contracts when their first implementation is added, rather than empty scaffolding.

## Ownership inventory

From the repository root, run `bun architecture:inventory` for a summary or `bun architecture:inventory --json` for every file's owners, source paths and cross-module imports. The inventory derives installable ownership from the current demo selection, local registry dependencies, explicit targets and generated tool/plugin descriptors. Core is the complement. It does not mutate installations or replace source receipts.

The scope is present Git-tracked and non-ignored untracked files in `apps/chat` plus all claimed installation targets, including absent targets marked `present: false`. Records include a `templateCopyEligible` flag for the initial template copy filter (which omits demo migration history). This flag does not describe the final scaffold: creation removes reference installables and providers before installing the selected items. The import audit describes the current reference app, not a simulated fresh installation. A file owned by an installable retains that owner even when its framework entrypoint lives outside the plugin folder. Generated composition remains core with a separate role, using generator headers and the demo baseline; app-owned customization files remain core. Inventory counts include tests/assets, while the import audit excludes test files and repository-only source. Static imports, type imports, re-exports, literal dynamic imports and literal `require` calls use the app's TypeScript resolver. Computed imports, external packages and external registry URLs are outside this audit.

`--check` exits nonzero for shared or missing targets, unresolved local imports, or import crossings needing review. Crossings through generated composition, direct declared registry dependencies, and explicitly reviewed public core contracts are distinguished from unresolved findings. This is an audit command, not yet a required CI gate: existing crossings must be reviewed before enforcing it globally. Do not accept them by recording a blanket baseline.

Session identity (`lib/eve/session-identity.ts`) is a core contract. MCP and research consume it; neither installs or overwrites it. The minimal scaffold retains it independently of those selections.

## Plugin database schemas

A plugin may declare `databaseSchemas` in its `chatjs.json`, using app-relative TypeScript paths beneath `plugins/<id>/`. Sync validates the selected descriptors and files, then generates `composition/generated/installed-database.ts`. Drizzle consumes that list alongside `lib/db/schema.ts`. This is composition metadata, not a barrel that core runtime modules import. MCP contributes `plugins/mcp/db/mcp-schema.ts` and consumes the core user table for its foreign key.

Fresh scaffolds exclude the demo's historical migrations. After installing dependencies, create runs the offline `db:generate` script to generate the selected schema's initial migration. Only create generates a baseline, and it refuses a nonempty migration directory. Add and sync preserve the app's migration history. Schema generation and applying migrations remain separate actions. ChatJS supports new installations, without migration support for older template versions.

## Tool configuration

Tools can declare `config: { key }` and export `configSchema` from their own `configuration-schema.ts`. Sync generates `composition/generated/installed-config.ts` from installed descriptors, rejecting duplicate or reserved keys. The core composes those schemas under `ai.tools`, deriving both input and output types. The editable interface remains `chat.config.ts`. Unknown tool keys are rejected at the type and runtime boundaries.

Gateways supply `roles.smart`, `roles.balanced`, `roles.fast`, and optional `roles.image`/`roles.video`. Tool schemas own their defaults and choose from these roles through the pure `lib/config-models.ts` core contract. They must not import runtime configuration or credentials. Document assistant actions similarly belong to document bundles and enter core through a generated registration. Follow-up suggestions and attachment limits remain core because core runtime code consumes them independently of installable tools.

## Plugins and composition

Plugins replace the former installable feature category. Their open ID contract lives in `metadata.ts`. A plugin declares separate server and client factory exports and its router, instrumentation, layout, composer, settings, or upload contributions. The installer reads descriptors without executing plugin entrypoints. Core business logic consumes generated composition rather than importing optional implementations.

MCP and attachment uploads keep manifests beside `src/` and `adapters/`. All plugin runtime source installs under `plugins/<id>/`; Next and EVE adapters retain explicit ownership despite their framework-required locations. Plugin entrypoints use `server-plugin.ts` and `client-plugin.ts` to avoid basename collisions with host modules during shadcn installation.

Generated tool and plugin registrations live under `composition/generated/`. Editable custom tool and renderer registrations live under `composition/custom/`. `composer-controls.ts`, `settings-items.ts`, and `chat.config.ts` remain app-owned. Adding a plugin with existing contribution kinds requires no CLI whitelist change. New contribution kinds require an explicit host contract and generator support.

See [plugin authoring](../../apps/docs/plugins/authoring.mdx) for the complete source-installation contract.
