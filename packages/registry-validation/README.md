# Registry validation

Private Bun workspace package for reusable registry verification. It has no ChatJS application, CLI, manifest or fixture imports.

- `typecheckProject(files, dependencyFixture)` checks a binary file snapshot with isolated declared dependencies. The fixture supplies installed packages and must match the engine's TypeScript version. Pass an ordered list of fixture directories when packages live in separate workspace installations. Only consumer-declared packages are exposed; transitive dependencies resolve from their owning installation.
- `auditDependencies(owner, originalSources, contract?)` returns per-owner missing-source and undeclared-package diagnostics. The caller supplies any inherited packages and local import prefixes.
- `compareProjects(expected, actual, options?)` returns inventory/content differences. Exact bytes are the default. Caller normalization can return comparable structured values and is applied to both sides.
- `readProjectFiles(directory, include?)` reads regular files into a project-relative byte map, rejecting symlinks.
- `withRegistryProject(options, operation)` from `/shadcn` stages an isolated local source catalog through real shadcn, supports caller configuration in the callback, and cleans up on success or failure. It returns the callback result and stage timings.

Snapshots use `ReadonlyMap<string, Uint8Array>`, matching the mirror's file-generator output. No watcher or mirror publication machinery is required by validation.

The shadcn adapter supports embedded content, explicit `~/` file targets and prerequisites in the supplied namespace. Unsupported registry side effects and protected bootstrap writes fail closed. Dependency installation, manifest assembly, application configuration, combination policy and runtime checks belong to the caller.

Run `bun run test:types` and `bun run test:unit` here. Tests use an independent temporary dependency fixture and compare an unrelated notes registry against the unmodified shadcn CLI. Bun and Node must be available. Real installation tests can access the package registry.

The package is not published. See the [ChatJS validation guide](../../apps/docs/registry/validation.mdx).
