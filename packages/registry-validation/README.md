# Registry validation

Private Bun workspace package for reusable registry verification. It has no ChatJS application, CLI, manifest or fixture imports.

- `typecheckProject(files, dependencyFixture)` checks a binary file snapshot with isolated declared dependencies. The fixture supplies installed packages and must match the engine's TypeScript version. Pass an ordered list of fixture directories when packages live in separate workspace installations. Only consumer-declared packages are exposed; transitive dependencies resolve from their owning installation.
- `auditDependencies(owner, originalSources, contract?)` returns per-owner missing-source and undeclared-package diagnostics. The caller supplies any inherited packages and local import prefixes.
- `compareProjects(expected, actual, options?)` returns inventory/content differences. Exact bytes are the default. Caller normalization can return comparable structured values and is applied to both sides.
- `compareRegistrySource({ path, baseline, local, formatSource? })` from `/compare` classifies text as `unchanged`, `formatting-only`, or `modified`. The optional async hook receives `{ path, source }` for both versions and returns formatted text, or `null` for unsupported files. Exact matches skip the hook; failures, invalid results and unsupported files remain modified. This entry point imports neither TypeScript nor shadcn. It has no filesystem, configuration loading or mutation policy.
- `readProjectFiles(directory, include?)` reads regular files into a project-relative byte map, rejecting symlinks.
- `withRegistryProject(options, operation)` from `/shadcn` stages an isolated local source catalog through real shadcn, supports caller configuration in the callback, and cleans up on success or failure. It returns the callback result and stage timings.

Snapshots use `ReadonlyMap<string, Uint8Array>`, matching the mirror's file-generator output. No watcher or mirror publication machinery is required by validation.

Source comparison takes the original installed content, not the newest registry release. Callers retain and verify that baseline and supply their project's formatter. Formatting must be deterministic and preserve source meaning; do not use lint fixes, import sorting or whitespace-stripping normalizers as formatters. Formatting-only is an advisory classification, not authorization to overwrite or remove source. Project parity keeps its existing explicit normalization and error behavior.

```ts
import { compareRegistrySource } from "@chat-js/registry-validation/compare";

const result = await compareRegistrySource({
  path: "components/button.tsx",
  baseline: originallyInstalledSource,
  local: currentSource,
  formatSource: ({ path, source }) => projectFormatter(source, path),
});
```

The `/compare` entry point also exports `compareProjects` for binary file snapshots. Its normalization hook is intentionally broader than formatting: parity fixtures may normalize known URLs or return structured values, and normalization errors propagate to the caller.

The shadcn adapter supports embedded content, explicit `~/` file targets and prerequisites in the supplied namespace. Unsupported registry side effects and protected bootstrap writes fail closed. Dependency installation, manifest assembly, application configuration, combination policy and runtime checks belong to the caller.

Run `bun run test:types` and `bun run test:unit` here. Tests use an independent temporary dependency fixture and compare an unrelated notes registry against the unmodified shadcn CLI. Bun and Node must be available. Real installation tests can access the package registry.

The package is not published. See the [ChatJS validation guide](../../apps/docs/registry/validation.mdx).
