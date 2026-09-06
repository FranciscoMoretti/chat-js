# M08 upstream installation contracts

Investigated 2026-09-06. This is a source-backed supplement to R09 and R04, not a production installer implementation. Reused their installation results; independently fetched current official documentation, npm metadata and pinned source, and executed the shadcn preset API below.

## Versions and evidence

| Surface | Current observed version | Evidence |
| --- | --- | --- |
| Standalone shadcn | 4.21.0 | [npm metadata](https://registry.npmjs.org/shadcn/4.21.0), source commit `7c9eaba1c0a6404c990c144a654792e3313c650d` |
| Eve | 0.52.1 | [npm metadata](https://registry.npmjs.org/eve/0.52.1), source commit `4e0b3452c7cfe2889911f02091a59d3ecc448e29` |
| Eve vendored shadcn | 4.18.0 | [Eve package source](https://github.com/vercel/eve/blob/4e0b3452c7cfe2889911f02091a59d3ecc448e29/packages/eve/package.json) |

The npm `/latest` endpoints returned the first two versions on this date. R09 tested standalone 4.21.0; R04 tested Eve 0.52.1. Do not substitute a floating latest command in a reproduction. Eve requires Node >=24; shadcn requires Node >=20.18.1. A current compatible peer range is not evidence of a single tested production Eve/ChatJS dependency lockfile.

Prior evidence: [R09](/Users/fran/.codex/worktrees/c997/chat-js/research/framework-evolution/implementation/findings/r09.md) and [R04](/Users/fran/.codex/worktrees/ceca/chat-js/research/framework-evolution/implementation/findings/r04.md). They remain valid for their bounded claims; neither is a complete ChatJS create acceptance test.

## Create and shareable presets

`create` is an alias of `init`, whose positional arguments are registry component addresses, **not a project name**. Name goes in `--name`. The pinned CLI supports `--template`, `--base`, `--preset`, `--monorepo`/`--no-monorepo`, and `--name`; its template identifiers are a predefined list (next/start/vite/react-router/laravel/astro), not an arbitrary third-party template plugin interface. [Pinned init source](https://github.com/shadcn-ui/ui/blob/7c9eaba1c0a6404c990c144a654792e3313c650d/packages/shadcn/src/commands/init.ts#L125-L164).

A supported command shape is:

```sh
bunx shadcn@4.21.0 create --template next --name my-chat --preset base-nova --no-monorepo
```

This is an upstream application scaffold and design preset; it does not create an Eve/ChatJS app automatically. The supported public integration surfaces are `shadcn/registry`, `shadcn/schema`, and `shadcn/preset`. CLI command implementations are explicitly outside the stable public API. Thus shell out for upstream create/init rather than importing its internal command handlers. [Pinned API documentation](https://github.com/shadcn-ui/ui/blob/7c9eaba1c0a6404c990c144a654792e3313c650d/apps/v4/content/docs/registry/api-reference.mdx#L7-L20).

The browser-safe preset codec encodes design options: style, base color, theme, chart color, icon library, font and heading font, radius, and menu appearance. It does not encode ChatJS provider choices, tools, semantic prerequisites, layout wiring or secrets. Base/framework flags also belong outside the codec's decoded design object. Reuse the upstream code as a field in a ChatJS selection document; do not invent a replacement theme codec or treat a shadcn preset as a full ChatJS configuration. [Preset exports](https://github.com/shadcn-ui/ui/blob/7c9eaba1c0a6404c990c144a654792e3313c650d/packages/shadcn/src/preset/index.ts), [codec documentation](https://github.com/shadcn-ui/ui/blob/7c9eaba1c0a6404c990c144a654792e3313c650d/apps/v4/content/docs/registry/api-reference.mdx#L384-L446).

Executed with Bun 1.3.11 and `shadcn@4.21.0` in an isolated temporary directory:

```ts
import { encodePreset, decodePreset } from "shadcn/preset";
const code = encodePreset({
  style: "vega", baseColor: "stone", theme: "blue",
  radius: "large", font: "geist",
});
console.log(code); // observed bJ4FLU0
console.log(decodePreset(code)); // design fields plus defaults
console.log(decodePreset("not-a-code")); // observed null
```

Copy-paste reproduction without editing this monorepo's dependencies:

```sh
scratch=$(mktemp -d)
bun add --cwd "$scratch" --exact shadcn@4.21.0
bun --cwd "$scratch" -e 'import {encodePreset,decodePreset} from "shadcn/preset"; const code=encodePreset({style:"vega",baseColor:"stone",theme:"blue",radius:"large",font:"geist"}); console.log(code,decodePreset(code),decodePreset("not-a-code"));'
```

## Registry graph and supported materialization seam

Use `getRegistryItems` to inspect original item metadata, `resolveRegistryItems` to inspect the recursively resolved tree, and `addRegistryItems` to install through upstream. The resolver flattens files/dependencies/CSS into one tree; it is not a semantic provider compatibility solver. Arbitrary `meta` can describe ChatJS semantics, but shadcn does not execute arbitrary metadata. [Public API](https://github.com/shadcn-ui/ui/blob/7c9eaba1c0a6404c990c144a654792e3313c650d/apps/v4/content/docs/registry/api-reference.mdx#L126-L197), [item schema](https://github.com/shadcn-ui/ui/blob/7c9eaba1c0a6404c990c144a654792e3313c650d/packages/shadcn/src/registry/schema.ts#L157-L176).

```ts
import {
  getRegistriesConfig, getRegistryItems,
  resolveRegistryItems, addRegistryItems,
} from "shadcn/registry";

const cwd = process.cwd();
const config = await getRegistriesConfig(cwd);
const addresses = ["@chatjs/minimal-shell", "https://vendor.example/r/search.json"];
const items = await getRegistryItems(addresses, { config });
// Proposed ChatJS semantic checks inspect items before any writes.
const tree = await resolveRegistryItems(addresses, { config });
// Review files/dependencies, then use upstream materialization.
await addRegistryItems(addresses, { cwd, config, overwrite: false });
```

Addresses above are provisional placeholders, not published ChatJS items. `getRegistriesConfig` merges package and components registry mappings, with components taking precedence. The installer does not read project configuration itself. A config with just `registries` is sufficient only if **all selected items and every transitive item** are universal `registry:item`/`registry:file` entries with explicit file targets. Installing ordinary UI items needs a fully resolved project config with aliases and `resolvedPaths`; use the documented CLI in an initialized app when appropriate. This qualification prevents incorrectly treating a namespace-only config as a universal frontend installer. [Pinned API documentation](https://github.com/shadcn-ui/ui/blob/7c9eaba1c0a6404c990c144a654792e3313c650d/apps/v4/content/docs/registry/api-reference.mdx#L69-L95).

Namespaces map `@vendor/item` to item URL templates using `{name}`. They support custom hosting and authenticated request configuration, and every referenced namespace must be available. A selection may share the address/template and environment variable names; credentials stay local. [Namespace docs](https://ui.shadcn.com/docs/registry/namespace), [pinned namespace schema](https://github.com/shadcn-ui/ui/blob/7c9eaba1c0a6404c990c144a654792e3313c650d/packages/shadcn/src/registry/schema.ts#L5-L26).

## Source pinning uses upstream addresses, not a new version manager

Standalone shadcn accepts `owner/repo/item#ref` GitHub addresses. The repository must have root `registry.json`; source files must exist. GitHub registries can use includes; no registry server/build publication is required for this route. Current GitHub address support excludes GitHub Enterprise hosts. Bare registry dependency names still refer to shadcn's own registry, not the parent GitHub repo. [Pinned GitHub documentation](https://github.com/shadcn-ui/ui/blob/7c9eaba1c0a6404c990c144a654792e3313c650d/apps/v4/content/docs/registry/github.mdx).

Provisional publisher commands (replace `acme/toolkit` with an actual registry):

```sh
bunx shadcn@4.21.0 registry validate acme/toolkit#v1.0.0
bunx shadcn@4.21.0 view acme/toolkit/minimal#v1.0.0
bunx shadcn@4.21.0 add acme/toolkit/minimal#v1.0.0 --dry-run
bunx shadcn@4.21.0 add acme/toolkit/minimal#v1.0.0
```

A full commit SHA is the strongest GitHub source identity; tags/branches can move. A root ref **is not inherited by dependencies**: each GitHub dependency must carry its own ref, and every independently hosted URL retains its own mutability. Exact npm requests and the Bun lockfile capture the package graph, not mutable registry JSON. Record source addresses and resolved SHAs; use immutable upstream URLs/refs for reproducibility, and disclose mutable inputs rather than claiming a lock. [Dependency refs](https://github.com/shadcn-ui/ui/blob/7c9eaba1c0a6404c990c144a654792e3313c650d/apps/v4/content/docs/registry/github.mdx#L496-L524), [Git refs](https://github.com/shadcn-ui/ui/blob/7c9eaba1c0a6404c990c144a654792e3313c650d/apps/v4/content/docs/registry/github.mdx#L584-L600).

## Eve is narrower than standalone shadcn

Eve imports its vendored shadcn API and supplies Eve-specific setup orchestration. Its `itemAddress` only preserves `@...` and HTTP(S) input. Everything else becomes `https://eve.dev/r/<input>.json`. Consequently **do not feed `owner/repo/item#sha` directly to `eve add`** or assume all standalone shadcn addresses pass through. This follows the pinned implementation; it was not newly live-installed here. [Address normalization](https://github.com/vercel/eve/blob/4e0b3452c7cfe2889911f02091a59d3ecc448e29/packages/eve/src/cli/commands/registry.ts#L145-L157).

Official Eve item setup is special: non-official items have Eve metadata explicitly set to `undefined`. Their Eve setup, package/component orchestration, install policy, and Eve-version requirements are therefore not executed through that metadata. External `--skip-install` setup resumption is rejected. `EVE_DEV_OFFICIAL_REGISTRY_URL` is explicitly a development trust override, not a recommended external extension architecture. [Eve installer](https://github.com/vercel/eve/blob/4e0b3452c7cfe2889911f02091a59d3ecc448e29/packages/eve/src/cli/commands/registry.ts#L455-L578).

R04 already ran this supported external command and observed seven installed source files:

```sh
bunx eve@0.52.1 add http://127.0.0.1:48731/r/paired-weather.json --non-interactive --yes
```

Run under Node >=24 with the R04 server active. This proves installation of backend extension, explicit Eve mount files, browser-safe contract and lazy frontend registration together. It does not prove external setup hooks. For external authors, install the registration/mount source directly and include explicit setup documentation. The fixture's workspace package shell was preseeded: shadcn installs package dependencies before source files, so creating a new unpublished workspace package and immediately resolving it in the same item is not proven. Use an already available pinned package or design the scaffold phase explicitly.

## Existing edits, replacement, and failure boundaries

`addRegistryItems` never prompts, throws on error and skips existing files unless overwrite is enabled. R09 observed preservation and subsequent explicit overwrite. This preserves source by default but is not an AST merge or successful runtime wiring guarantee. A new renderer can be installed while an edited registration file is skipped; ChatJS must report the required edit instead of claiming complete integration. Upstream `add --dry-run`, `--diff`, and `--view` provide inspection; they do not promise to merge project edits. [Official CLI changelog](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4).

Do not repurpose `init --preset` as layout replacement: the pinned initializer installs with `overwrite: true`, and preset switching may reinstall UI files. A ChatJS layout should be a conventional project-local composition file, with a reviewed file replacement/diff when changed. [Pinned init materialization](https://github.com/shadcn-ui/ui/blob/7c9eaba1c0a6404c990c144a654792e3313c650d/packages/shadcn/src/commands/init.ts#L827-L830).

R09 source inspection found last-wins target deduplication and explicit dependency-version conflicts; a flattened tree can already have lost competing originals. Semantic conflict reporting must inspect original selected/transitive items and their target intentions before flattening, while delegating fetching/materialization to upstream. Resolving every transformed target using only public APIs remains a design limit to spike; do not quietly import internal path utilities as a stable contract.

Eve has an install rollback wrapper, but it snapshots selected manifests/lockfiles/env files and direct targets from the input item, not an entire project. Its source explicitly excludes node_modules restoration. Do not promise transactional rollback of the full recursively resolved graph or a whole create/add/config sequence based on that wrapper. [Pinned transaction source](https://github.com/vercel/eve/blob/4e0b3452c7cfe2889911f02091a59d3ecc448e29/packages/eve/src/cli/commands/registry-install-transaction.ts).

## Recommended architectural boundary

Use one small serializable ChatJS selection envelope containing upstream design preset and upstream item addresses, plus semantic slot choices and non-secret installation intent. Keep runtime imports/settings in generated, project-local TypeScript. Delegate ordinary graph installation to public shadcn APIs/CLI; use Eve's installer where official Eve setup is required. Avoid treating the two pinned installer versions as interchangeable. Do not add a registry lock/versioning system: use existing upstream source refs, package pins and lockfiles, with clear mutable-source disclosure.

Website work remains blocked on the shared selection semantics and functional UI components. The preset codec proof enables a reusable design-control field; it does not settle that full contract or make the separate minimal Eve app ready.

## Implementation follow-up: restrict Eve's default tool surface

Rechecked against the installed `examples/minimal-next/node_modules/eve` 0.52.1 and the same pinned upstream commit. Eve merges programmatic framework sources with authored sources, so installing only `confirm_note` and `weather` does **not** imply that those are the agent's only tools. The framework contributes these local tool slots:

```text
bash read_file write_file todo web_fetch load_skill
connection_search ask_question task_update task_cancel web_search
```

It additionally contributes `agent` at the root. This inventory comes from [pinned framework source registry](https://github.com/vercel/eve/blob/4e0b3452c7cfe2889911f02091a59d3ecc448e29/packages/eve/src/framework/sources/registry.ts). The built-in documentation table omits task_update/task_cancel; the pinned source registry is the complete composition inventory.

The supported published mechanism is a sentinel default export in the matching file, e.g.:

```ts
// agent/tools/bash.ts
import { disableTool } from "eve/tools";
export default disableTool();
```

Use the same file contents separately for each omitted default. `agent/tools/agent.ts` removes root delegation. The published signature is `disableTool(): DisabledToolSentinel`; its readonly `kind` is `"eve:disabled-tool"`. `isDisabledToolSentinel(value: unknown): value is DisabledToolSentinel` is also public. [Public types](https://github.com/vercel/eve/blob/4e0b3452c7cfe2889911f02091a59d3ecc448e29/packages/eve/src/tools/definition.ts#L376-L407), [normalizer](https://github.com/vercel/eve/blob/4e0b3452c7cfe2889911f02091a59d3ecc448e29/packages/eve/src/compiler/normalize-tool.ts).

[Published built-in tool documentation](https://github.com/vercel/eve/blob/4e0b3452c7cfe2889911f02091a59d3ecc448e29/docs/concepts/built-in-tools.md) confirms this is static agent source composition, not an agent-level `tools: []` configuration option. A matching authored definition overrides the default; a disable sentinel removes it. A nonexistent default slug is an error rather than a silent no-op. `glob`, `grep`, and `sleep` are opt-in tools, so do not generate disable sentinels for those absent slots. Deleting a disable file restores the corresponding framework default on the next compilation.

The compiled summary is also not identical to the session-advertised toolset: skills/connections/user-input/provider conditions further gate certain built-ins at runtime. To guarantee an exact minimal application toolset, author the disable files for all unwanted default slots and verify the generated summary, then verify a session/tool invocation through the published runtime. The root-only `agent` tool is intentionally absent in its copies and declared subagents.

A local non-mutating execution of the installed published implementation returned `{"value":{"kind":"eve:disabled-tool"},"recognized":true}` for `disableTool()` and `isDisabledToolSentinel`. This follow-up did not edit agent files or run a new build; the parent task owns generated-app verification.

This removes a capability from the composed agent, not source files from the installed Eve npm package. M08 omission assertions must distinguish unselected ChatJS-owned authored source/dependencies from framework code distributed inside Eve itself. Do not promise removal of Eve's bundled implementations through this API.
