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

Canonical feature source uses the reference app's Base UI primitives. `bun run build` first runs the native shadcn registry builder, then emits complete `dist/r/base/` and `dist/r/radix/` namespaces. The original `dist/r/<name>.json` remains Base-compatible, and the Base namespace is a byte-for-byte copy. Each namespace includes its own `registry.json` catalog and every provider, plugin, and tool.

Radix output uses `transformUiSource` to convert native composition props in shipped source. Its version 2 metadata and installed `chatjs.json` descriptors identify `uiBase: "radix"`. Item IDs, destination paths, and `@chatjs/` dependencies stay unchanged; dependencies resolve through the consuming app's selected namespace. The installer checks the descriptor against the app's native library before writing source. Version 1 descriptors retain their existing meaning.

Keep Base-specific composition inside the transform's supported native component APIs. Add a transform regression test when introducing a new API difference, then verify a generated Radix app as well as the reference Base app. Do not install runtime compatibility wrappers or transform consumer customizations during add/sync.

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
