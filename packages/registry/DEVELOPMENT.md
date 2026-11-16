# Registry mirror development

Run `bun dev` from the repository root and edit canonical registry source. **registry-mirror** publishes the selected installation into `apps/chat`, then starts the app after successful reconciliation. Saves update the running preview through Next and EVE's own watchers. `dev:query`, `dev:scan`, `dev:debug` and the development supervisor use the same launcher.

Installed registry files in **our reference app** are disposable generated output. Local changes to those files are overwritten on the next reconciliation. Consumers installing the registry into their own applications still own and customize their installed source; this mirror is a repository development tool.

## Sources and ownership

- Plugin implementation: `packages/registry/src/plugins/<id>/src/`; framework adapters: the adjacent `adapters/` directory.
- Registry declarations and manifests: declare new files, renamed targets, removals and contributions there.
- Tools and providers: their canonical files under `packages/registry/src`.
- Selection: only `demoInstallation` in `packages/registry/installation.ts`.
- Application-owned files: credentials, dependency manifests, `chat.config.ts`, fetched model catalog, UI ordering and custom extensions stay in the application.

`bun demo:sync` performs one reconciliation. `bun demo:check` verifies current output without changing it. Commit generated source and `packages/registry/mirror-manifest.json` together. The manifest contains **paths only**: it grants cleanup ownership for previously generated files. Missing generated files are restored; edited generated files are overwritten; previously recorded files absent from the next installation are deleted. Unrecorded files are never swept from a directory. There is no content baseline or `--discard` option.

The ChatJS adapter derives current output ownership from the resolved installation plan, plus composition-generator and provider-configuration outputs. The mirror rejects unauthorized current outputs, path traversal and symlinked destinations before publishing. Treat the manifest as ownership configuration: adding a path authorizes its later deletion. It is not an inventory of every app file.

## Native UI variants

Feature state, queries, mutations and library-independent presentation stay shared. `ui-implementations.ts` explicitly declares the few feature-level boundaries that need different native composition. Each entry names an installed target, its canonical Base source (the unsuffixed reference implementation), and a neighboring `.radix.tsx` implementation. Both implementations use native shadcn components directly. Ordinary components import shadcn directly. Repeated compositions such as hints, action buttons and navigation links have small native implementations, rather than duplicating application state or translating JSX.

`selectUiSources` resolves a complete batch before publication and validates that both implementations exist and are nonempty. Selection copies authored source verbatim; there is no Base-to-Radix source transformer. Their callers import the unsuffixed destination; consumers receive only the chosen implementation there, without a runtime library switch or internal variant imports. Keep a pair's feature interface small: data, callbacks and shared content. App-owned state, permissions, persistence and server calls belong in the shared integration.

Registry generation selects **per item**, because different gateway/storage items intentionally install to identical paths. It validates both libraries' dependency contracts before replacing build output. The scaffold uses the same selector on its canonical app-owned sources, then removes the alternative source files. Plugin manifests list the shared source and unsuffixed implementation; the reference mirror installs Base. Add new installed paths to those manifests and run `bun demo:sync`. The native variants use the core's existing native shadcn dependencies; any new external dependencies must pass the per-item dependency audit for both libraries.

`bun run build` emits complete `dist/r/base/` and `dist/r/radix/` namespaces. The original `dist/r/<name>.json` remains Base-compatible, and the Base namespace is a byte-for-byte copy. Item IDs, destination paths and `@chatjs/` dependencies stay unchanged. Version 2 metadata and `chatjs.json` identify the selected `uiBase`; the installer checks compatibility before writing. Version 1 descriptors retain their existing meaning. Scaffold setup forwards shadcn preset/theme arguments unchanged and selects the registry namespace, so later installation uses the same generated sources. Selection never runs against consumer customizations during add/sync.

The native boundaries are search dialog nesting/backdrop/trigger composition, editable-bubble fallback DOM, context hover timing, and tool/connector/project/share menu activation and dismissal. Search content and keyboard shortcut state, edit handlers, usage calculations, authorization and menu mutations remain shared. The app and registry TypeScript projects exclude `.radix.tsx` because their aliases resolve Base primitives; standalone generated Radix apps type-check the selected files against actual Radix primitives. Browser fixtures use the same explicit manifest with the generated app's native components.

This follows shadcn/ui's authored `registry/bases/base` and `registry/bases/radix` sources at commit `481d523374745e77d0cf9c53a4115ab5dd7c8481`. Library-specific slots, direction context, selection indicators, transport options and state selectors live in native source files. Shared compositions are copied unchanged. No AST pass renames props, removes options, synthesizes children or translates CSS selectors. The regular registry build and shadcn's own styling/import transformations remain responsible for packaging and installation.

For an additional boundary, declare the exact source paths in `ui-implementations.ts`, author both native files, register the unsuffixed target and shared files in its owner, and add meaningful browser coverage. Validate fresh Base and Radix scaffolds, installed registry items, native type checks and interaction/visual parity. Missing files must fail before source publication. Source selection does not make filesystem publication transactional if an I/O write fails midway.

## Three responsibilities

1. **ChatJS adapter** (`scripts/demo-mirror.ts`, `demo-generator.ts`, `demo-worker.ts`) reads the real preset and uses the CLI planner, shadcn transforms and formatter in a temporary installation. Fresh subprocesses reload imported configuration. It returns the complete desired files without publishing into the app.
2. **registry-mirror** (`scripts/registry-mirror/mirror.ts`) publishes generated files, removes obsolete recorded outputs, maintains the path manifest, watches declared inputs and serializes reconciliation. It has no knowledge of ChatJS plugins, Next, EVE or Turbo.
3. **Development launcher** (`scripts/demo-dev.ts`, `demo-watch.ts`, `demo-processes.ts`) waits for settled success, starts Turbo/Next/EVE, reports stale previews and shuts down owned processes.

The local mirror interface is:

```ts
interface FileGenerator {
  readonly inputs: readonly string[]; // relative to sourceRoot; ! excludes
  generate(): Promise<ReadonlyMap<string, Uint8Array>>; // COMPLETE output
}

const mirror = createRegistryMirror({
  sourceRoot,
  destinationRoot,
  manifestPath,
  ownedPaths: () => currentPlanPaths, // exact destination-relative paths
  generator,
});
await mirror.run();
await mirror.run({ check: true });
await mirror.watch({ signal, onEvent });
```

`ownedPaths` is evaluated after generation, so an adapter can expose its freshly resolved plan. Prior manifest paths separately authorize obsolete-output cleanup. Watch events report `success` with a `settled` flag, `failure`, or `watch-error`. The launcher uses settled success for initial readiness. Keep this module local until a second real consumer justifies a shared package.

## Reconciliation and failures

Watching begins before the first input snapshot. Content hashes bracket each pass; edits during generation trigger another pass. An 80 ms quiet window coalesces saves, and a two-second content poll covers missed notifications or unavailable native watches. Generation runs serially and is allowed to finish on abort. Once edits settle and generation succeeds, the output catches up; this does not promise an atomic snapshot of actively edited source.

Generation failure leaves existing output and its manifest untouched. Initial failure keeps the app stopped; later failure marks the running preview stale. The watcher retries after changes or its safety poll. Unchanged outputs and manifests are not rewritten.

Publication stages file contents first, then replaces files individually. The path manifest records additions before replacement and drops obsolete paths after cleanup, allowing a retry to repair a partial publication failure. File-to-directory or directory-to-file target changes are rejected before publication; remove the obsolete generated path manually before retrying. The mirror never recursively deletes an output directory. There is **no atomic multi-file visibility or rollback guarantee**: Next/EVE can observe intermediate files, and an I/O error during publication can leave partial output until a successful retry.

A writer lock (`mirror-manifest.json.lock`) covers generation and publication, including manual runs. A second watcher is rejected by `mirror-manifest.json.watch.lock`. Normal shutdown drains active work and releases both locks. Generation workers have a 60-second deadline; a hung worker is killed before releasing its lease, while publication still drains. Unchanged failures retry with exponential backoff (2–30 seconds); source changes retry immediately. After a crash or SIGKILL, verify the recorded PID has stopped before removing a stale lock; locks are not stolen automatically. The launcher uses an isolated process group and IPC so Bun/dotenv wrapper shutdown can still drain publication. App process cleanup tracks descendant start times to avoid signalling reused PIDs or other checkouts.

## Incremental generation and limits

The adapter's first pass generates the complete installation. Declared plugin source/adapter edits can regenerate only their mapped outputs through the real installer, including one-to-many mappings, then return the complete merged map. Incremental state and change tracking stay inside the adapter. Preset, manifest, tools/providers, generator/configuration, added/deleted and unknown paths trigger full generation. A generator import graph also forces a full pass when a plugin source file is imported by configuration. Bun versions without import-graph metadata safely use full generation.

Generated output, the ownership manifest, locks and build artifacts are excluded from generator inputs. Restart `bun dev` after editing the watcher implementation. Root dev retains Turbo prerequisite builds; it does not continuously rerun the whole Turbo build graph. Next watches UI dependencies; EVE watches its authored runtime imports and updates generations or replaces workers as needed.

The launcher uses POSIX process groups, matching the existing supervisor. It never installs packages or migrates databases. `dev:eve` still serves explicitly built production artifacts; `dev:electron` connects to a separately running app. Running the application dev command directly bypasses this repository mirror.

## Runner comparison — 2026-10-25

Experiments used Bun 1.3.11, Turbo 2.10.12 and Next 16.3.0 in isolated fixtures. These observations motivated the coordinator; they are not stronger guarantees than the tested cases.

| Case | Turbo watch | Dedicated coordinator |
| --- | --- | --- |
| Input selection | `watchUsingTaskInputs` required for task-level filtering | Explicit generator input globs |
| Tracked output feedback | No reruns with the flag; tracked output is not inherently a loop | Output excluded from inputs |
| Rapid saves / edit during generation | Coalesced saves; finished current pass and queued another | Serialized passes and follow-up reconciliation |
| Initial generation failure, then correction | Corrected generation succeeded, but persistent app did not start during 20 seconds and another edit | App starts after successful reconciliation |
| Edit during startup | App briefly started on the older output, 619 ms before the follow-up completed | Reconcile observed edits before starting app |
| Later failure | Existing app remained running and generation recovered | Preview marked stale; retry recovers |

Keep Turbo for prerequisite ordering and application tasks. A dedicated coordinator provides the initial readiness and recovery behavior that plain Turbo watch did not provide in these fixtures. Turbo's continuous dependency rebuilding is broader than this mirror's input scope.

Earlier end-to-end acceptance measured a canonical MCP edit reaching the browser in 752 ms and an isolated EVE tool update in 638 ms. Those timings predate the path-manifest simplification; the two runner fixtures also used different artificial generation delays, so they are not an intrinsic speed comparison.

The shared installation generator also drives [consumer installation validation](VALIDATION.md), with isolated TypeScript checks and packaged CLI parity sentinels.

## Native EVE capability packaging

A capability has one implementation in `src/tools/<id>`. Its normal registry item includes the source and optional ChatJS application contributions. A portable capability also declares `meta.chatjs.native`:

```ts
native: {
  files: ["tool.ts", "definition.ts", "schemas.ts"],
  dependencies: ["eve", "zod"],
}
```

The build derives `dist/r/eve/<id>.json` and `dist/r/eve/registry.json` from those same files. These are another distribution view of the same catalog IDs, not separately authored tools. Native implementation files land in `agent/lib/chatjs/<id>`; a generated default export in `agent/tools/<toolName>.ts` lets EVE discover each tool. Consumers can register the published `/eve/{name}.json` URL template with `eve registry add`, then use `eve add`. Publishing the package is required before those new endpoints exist remotely.

The native view excludes renderers, ChatJS descriptors, UI dependencies and ChatJS setup. Its dependency audit allows no inherited application packages or `@/` application imports. Missing declared files, undeclared package imports, and unsupported execution/accounting combinations fail the build. Adding a native declaration requires extending the standalone installer/compiler test; an item without one remains an application-dependent bundle.

The shared descriptor already carries tool exports, workflow placement, provider slots, dependencies, environment requirements, gateway/storage/sandbox requirements, renderer exports and composer contributions. The packaging contract also includes:

- `tools[].readOnly`: action classification used by the approval policy.
- `tools[].accounting`: `none` explicitly declares no per-call ChatJS tool charge; `unknown` records an unsettled provider cost; `{ costUsd }` declares a fixed application charge; `receipt` describes capabilities that already return application receipts. An omitted value is not a declaration that an arbitrary native tool is free.
- `native`: the audited standalone source/dependency subset, when supported.
- `channelSupport`: support in the complete ChatJS application. Curated tools currently support web; Slack remains unverified. Portable EVE installation alone does not certify a channel or a live provider.

Word count, weather and Deep Research can be installed into ordinary EVE agents. Tavily and Firecrawl are available through EVE’s connection catalog.

Run `bun run test:native` under Node 24 to install the portable payloads through the real EVE CLI in a fresh project and verify their source, types, discovery and compilation.

## Resolved installation and Agent recipes

Dependency planning captures each complete registry payload with a SHA-256 digest. Installation feeds those payloads to the native shadcn installer through temporary local files, including the complete transitive graph. It does not fetch the source addresses again. Changed payloads and missing dependencies fail before installation.

Fresh Bun creation writes `chatjs/agent-recipe.json`. Replay with `bunx chat-js@<recorded-version> create my-app --yes --recipe ./agent-recipe.json`. The recipe contains the initial public selection, appearance arguments, resolved capability source, native UI source, package manifest and Bun lockfile. It excludes environment files and credentials; do not put secrets in public configuration or instructions. Keep the recipe alongside the generated project. Recipe replay requires the recorded CLI version and Bun, restores the selected sources, and checks the frozen dependency lock. If a package is unavailable, generation fails instead of upgrading it.

The recipe is a starting point, not an export of developer edits. `sync` never rewrites it or authored configuration. Change builder choices and generate a new recipe for an upgrade. Credentials, provisioning, connections and live verification remain separate local setup steps. Recipes are currently emitted by Bun creation; other package managers still support ordinary generation without recipe replay.

## Configuration readiness

`chat-js setup --cwd <app> [--json]` runs the generated application's local capability configuration check using Bun. It reads `.env.local` and prints only missing variable names/descriptions. It does not contact providers, provision resources, or certify credentials. Installation, configuration presence, connection checks, and live verification are separate fields. Re-run after setting values; `bun check-env` validates the whole application and `bun run setup` performs the existing database/runtime setup.

Generated tool requirements also gate runtime availability. Missing tool, storage, gateway, or sandbox credentials disable the affected tool and its dependents; an explicit selection reports the missing configuration. Credentials being present does not mean the service has accepted them.

## Native memory

Memory providers come from EVE’s catalog and use their native storage, identity scopes, and retention behavior. ChatJS does not implement a memory provider. Deleting conversation-derived memory is conditional on support in the selected native EVE provider; it is not an application-wide guarantee or a reason to add a custom provider.
