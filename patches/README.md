# Maintained dependency patches

The isolated ChatJS worktree installs **eve 0.61.0** with `eve@0.61.0.patch`. The readable implementation and tests are in **one** `eve-0.61.0.source.patch`, based on tag `eve@0.61.0` (`241e5004cb1ac1e2bcd716a154bbc64f5a61cc53`). Both `package.json` and `bun.lock` pin the installed artifact. Scaffold generation verifies and vendors that same installed package.

The five old source patches, compiled 0.52.2 patch, and incremental experiment builder have been retired. They remain in Git at `27c14d41`. See the [reduction report](../docs/upstream-drafts/eve-fork-061-reduction.md) for retained contracts and migration limits.

## Rebuild

Use a separate checkout of the exact upstream tag and a pristine unpacked npm package. Apply the source patch at the checkout root:

```sh
git apply "$chatjs_root/patches/eve-0.61.0.source.patch"
```

Build with eve's toolchain: vendored dependencies (`build:compiled`), production declarations (`tsconfig.build.json`), and JavaScript (`scripts/build-rolldown.mjs`, after copying compiled assets). The local validation used Bun and an isolated dependency tree; its root workspace manifest was adapted from upstream's pnpm workspace/catalog. That build-only adaptation is not in the source patch. The package assembler requires completed build outputs; it does not install dependencies or run tests.

From ChatJS:

```sh
bun scripts/build-eve-patch.ts "$eve_root" "$pristine_eve_package"
bun install
bun lint
bun test:types
```

The builder checks the source tag and published version, produces the source patch with a temporary Git index, and copies only changed source modules into the compiled overlay. It preserves the published package's vendored dependency bundles. New helpers are relocated to package-root files with explicit import aliases because Bun's nested-file patch installation previously failed. A fresh-cache install and public `eve/transcript` import verify this packaging.

Verify an installed package with:

```sh
verify_root=$(mktemp -d)
cp -R "$installed_eve" "$verify_root/package"
git -C "$verify_root/package" apply --reverse --check "$chatjs_root/patches/eve@0.61.0.patch"
```

Run this check outside the ChatJS Git tree; an ignored `node_modules` subdirectory can cause Git to skip patch paths. If Bun retains stale files after a patch change, reinstall the eve package with a fresh cache and verify again.

Run the source unit and integration tests using eve's tier-specific Vitest configs; they resolve source aliases rather than stale compiled files. The reduction report records exact validation and outstanding upstream failures.

## Other active patches

- `ai-sdk-mcp@2.0.52.patch`: single-flight SSE authorization refresh and late-401 handling. Rebased from 2.0.45 by applying with Git and regenerating the diff against the new package. Correct hunk offsets matter for Bun. SDK versions across ChatJS, gateways, registry, thread, telemetry, and React are aligned with `ai@7.0.105`.
- `workflow-world-postgres@5.0.0-beta.40.patch`: unchanged stream-transfer patch. This upgrade does not change the app's Postgres world package or migrate a database.
