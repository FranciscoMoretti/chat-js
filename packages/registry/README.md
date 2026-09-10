# @chat-js/registry

Code-first authoring and generated shadcn registry distribution for ChatJS.

Edit the real TypeScript sources in `src/gateways/<id>/gateway.ts` and
`src/tools/<id>/`. `registry.ts` declares
standard item files, targets, dependencies, and validated `meta.chatjs` metadata.
Test implementations by importing those sources directly.

```sh
bun run test:types
bun run test:unit
bun run build
```

`build.ts` serializes the catalog and tool descriptors, then runs published
`shadcn@4.21.0 build`. shadcn reads the source files and emits `dist/r/*.json`.
Both the intermediate `registry.json` and output are generated, never edited.
The output directory is cleared first, so deleted items cannot survive a build.

The npm package publishes `dist/r/`. Version 1 uses the standard registry format:
`https://unpkg.com/@chat-js/registry@1/dist/r/{name}.json`. Historical version 0
npm artifacts retain their legacy `items/` format for already-published CLIs.
Publish registry v1 and the shared gateway contracts before promoting the CLI
release that consumes them. The static Vercel deployment serves the same output.

## Tools

Each tool item installs `tool.ts`, `renderer.tsx`, and `chatjs.json` under
`~/tools/chatjs/<id>/`. The descriptor contains contractVersion 1, kind `tool`,
id, named tool/renderer exports, and environment requirements. The build derives
it from the same typed metadata used in the catalog.

`chat-js add` delegates installation to shadcn, then generates typed server and
client indexes. Direct `shadcn add` installs are supported by running `chat-js sync`
afterward. Custom registrations belong in `custom-tools.ts` and `custom-ui.ts`.
Third-party items use the same shape and standard namespaces in `components.json`.

See [gateway authoring](./src/gateways/README.md) for adapter-specific metadata.

## Organization and naming

Source folders group items by category. Each gateway has a `gateway.ts`; each tool
has a `tool.ts` and `renderer.tsx`. Shared tool support lives under
`src/tools/toolkit-renderer/`. Category-level gateway catalog, metadata, and defaults
live directly under `src/gateways/`.

`meta.chatjs.kind` identifies a gateway or tool independently of its public name.
Registry namespace aliases such as `@chatjs` identify a configured registry source.
Public item names remain `vercel-gateway`, `word-count`, and the other existing
names. Source folders do not determine registry addresses or installation targets.

The selected gateway installs into the app's `lib/ai/gateway.ts` slot. Tools install
under `tools/chatjs/<id>/` with generated registrations and separate custom modules.
Third-party destination namespacing is not inferred from registry aliases and is
not added by this source reorganization.

`packages/gateways` owns shared runtime contracts. `packages/cli` owns installation
and configuration. `apps/chat` is the reference consumer and app template source.
New categories such as layouts and caches should introduce source folders and
contracts when their first implementation is added, rather than empty scaffolding.
