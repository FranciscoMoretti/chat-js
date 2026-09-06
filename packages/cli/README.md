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

## Selected minimal Next app (opt-in)

This path uses published Eve 0.52.1 and shadcn 4.21.0. It requires Node 24+ and
Bun 1.3.11. Existing full-demo creation remains the default.

```sh
chat-js create my-app --minimal
chat-js create my-app --minimal --yes
chat-js create my-app --selection ./selection.json --yes
```

The interactive model/tool choices and JSON input use the same schema:

```json
{
  "items": [
    "@chatjs/minimal-next",
    "@chatjs/openai",
    "@chatjs/host-identity",
    "@chatjs/postgres",
    "@chatjs/layout-minimal"
  ],
  "registries": {},
  "settings": { "model": "gpt-5-mini" }
}
```

`--selection` also accepts an HTTP(S) URL. Do not put secrets in shared selections
or registry URLs. Creation installs dependencies and typechecks generated source;
`--no-install` is unsupported on this path. Read the generated `SETUP.md` for
database bootstrap, provider credentials, host-issued identity and worker setup.
The worker must remain private. No login page or deployment recipe is installed.

The default selection omits app-specific optional tool implementations and
unselected direct dependencies. Eve's built-in tools are explicitly disabled
through its public source API; its npm package still vendors those implementations.
Add `@chatjs/confirm-note` for the approval tool and lazy typed renderer.

## Extend developer-owned source

```sh
chat-js add @chatjs/confirm-note --cwd ./my-app --yes
chat-js add https://example.com/r/weather.json --cwd ./my-app --yes
# Replace a provider or layout by editing the complete desired selection:
chat-js add --selection ./updated-selection.json --cwd ./my-app --yes
```

New files/dependencies are installed using shadcn's public materializer. Existing
source is preserved, and composition edits are proposed under `.chatjs/proposals`.
The proposed composition is typechecked in an isolated copy of the actual app.
Changed registry source at an existing path is also proposed and typechecked,
including replacement identity or execution modules. Per-file source hashes in
the adopted receipt distinguish changed registry source from developer edits to
an unchanged item. Each successful materialization replaces the generated proposal
set; copy any edits you want to keep out of `.chatjs/proposals` before another add.
Review and adopt each intended change, for example from the app directory:

```sh
git diff --no-index chat.client.ts .chatjs/proposals/chat.client.ts
# Edit chat.client.ts to incorporate the desired imports/registrations.
# After review, adopt the corresponding selection and installation receipt.
bun run test:types
```

`add` does not remove old source/dependencies when a selection changes. It is not
transactional: files/packages may already have been installed if typechecking
fails. Use version control to review those changes. The saved selection is
starting provenance; CLI `config` does not execute or reverse-engineer modified
TypeScript. Source files remain authoritative. Proposed files are not a patch
against arbitrary developer customization.

## External registry contract

External and bundled items use the same public shadcn universal item format:
`registry:item`, `registry:file`, explicit `~/` project targets, `dependencies`,
`registryDependencies`, `envVars`, and `docs`. Namespace URL templates can be
supplied in `registries`, including an override of `@chatjs`. shadcn owns address
resolution, dependency fetching and materialization. This composition path
requires explicit targets; it does not support shadcn UI source transforms or
execute external setup hooks. Read an item's setup instructions before use.

Optional `meta.chatjs` describes only composition requirements and exports:

```json
{
  "requires": ["eve"],
  "renderers": [
    { "mount": "weather", "path": "./tools/weather/client", "export": "Weather" }
  ],
  "components": [
    { "path": "./components/banner", "export": "Banner" }
  ]
}
```

An integration declares `provides` and `requires`; providers are exclusive in a
selection. The minimal recipe needs `node`, `next`, `eve`, `model`, `identity`,
`execution`, `bindings`, and `layout`. Model and layout providers additionally
declare `model` or `layout` with a local `path` and `export`. Model exports are
factories accepting the configured model ID; layouts accept React `children`.
Frontend-only components accept no required props. Imports are typechecked against
the actual generated app. Replacement identity, bindings and execution modules
must preserve the source contracts their consumers import.

Each renderer receives `unknown` at the transport boundary. Use the generated
`toolRenderer(outputSchema, () => import('./renderer'))` helper to validate that
value and infer the lazy renderer's `{ output }` prop from a shared browser-safe
Zod schema. The backend tool uses the same schema's inferred output type.
`mount` must equal Eve's final mounted tool name; typechecking cannot establish
that dynamic identity or a model's actual tool support. The recipe currently uses
root tools with explicit names. Default-tool slots contain `disableTool()` files;
replacing that execution policy requires a deliberate source edit or custom base.

Preflight rejects missing capabilities, competing providers, target collisions,
duplicate renderer identities, unsafe paths and conflicting exact dependency
pins. It does not solve arbitrary semver compatibility or prove behavioral
capabilities. Check package-manager warnings and test replacement integrations.
JSON schemas are shipped as `registry/selection-schema.json` and
`registry/metadata-schema.json` in the CLI package.

`chat.installation.json` records the CLI version and observed item/file hashes. It is
an audit receipt, not a lockfile: external URLs may change between installations.
Use immutable registry URLs when reproducibility matters. Bun's lockfile records
the installed package graph. No new plugin runtime or version resolver is added.

## Compatibility coverage and limits

`bun packages/cli/tests/selected-app.ts` runs the built CLI against a real minimal
selection and a separate HTTP registry supplying a paired tool, frontend-only
component and replacement layout. It verifies omission, preservation of edited
source and typechecks the installed/proposed compositions. Unit tests reject
incompatible graphs before materialization. CI runs these without provider keys.
Live generated-app approval, recovery and cancellation checks require separate
provider/database setup; passing types is not a claim every permutation works.

Published Eve gaps remain explicit: ambiguous session creation fails closed and
requires operator reconciliation; cancellation is cooperative, with replay
catch-up after a following command. This linear slice does not implement durable
historical branching, atomic upstream create-once recovery, immediate provider
abortion, or rollback of external side effects.
