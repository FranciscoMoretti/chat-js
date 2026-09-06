# M14/M16a bounded acceptance fixture

This is an isolated reproduction/design artifact for #323. It does not modify the
production app, reviewed PRs, or historical Eve branching. Start with
[the handoff](../../findings/m14-m16a-groundwork.md).

Requires Bun 1.3.11 and a Playwright-compatible Chromium. All live HTTP servers
bind `127.0.0.1` with `port: 0` (kernel-assigned unique ports). Databases, bytes,
registry consumers and browser bundles use a unique temporary directory and are
removed after the run. No app DB/environment or fixed app port is used.

```sh
bun install --frozen-lockfile
# If Chromium is not already installed:
bunx playwright install chromium
bun test
bun run test:types
bun run registry-proof.ts
```

`FIXTURE_CHROMIUM` can point to an existing compatible Chromium executable.
`FIXTURE_SCREENSHOT` and `FIXTURE_BROWSER_EVIDENCE` optionally save browser
proof artifacts at absolute paths. The browser evidence records the exact observed Chromium version; other
compatible builds may be used.

- `documents.server.ts`: disposable SQLite transaction, exact returned ref,
  explicit stale-base conflict, owner checks, immutable revision UPDATE trigger.
- `api.server.ts`: actual native tRPC HTTP adapter and AI SDK 7 tool definitions;
  multipart file route shares the Files SDK byte/catalog service. Random local
  opaque credentials stand in for the host's trusted caller resolver.
- `http.test.ts`: real localhost authenticated requests, tool result to UI-query
  round trip, conflicting concurrent requests, and denied reads/mutations.
- `transaction.test.ts`: DB-triggered save failures, rollback and foreign-base
  rejection; no success result after failed storage.
- `sdk-router.test.ts`: actual Files SDK native HTTP router, authorization,
  range bytes, metadata denial and mutation allowlist.
- `ui.tsx`, `result-renderer.tsx`, `text-editor.tsx`, `browser.test.ts`: direct
  functional JSX, network-observed lazy editor, committed ref and preserved
  stale draft. No heavyweight editor packages or model call required.
- `registry-proof.ts`: actual upstream shadcn 4.18.0 external URL installs with
  Bun into five separate consumers, plus a minimal no-selection consumer.
  Checks source/manifests/locks/provider peers, strict installed source types,
  native external adapter bytes and external renderer/editor bundles. Dev-only
  TypeScript/Bun/React types form the common verification harness. The local
  list of specimen items is not a proposed ChatJS plugin descriptor.

The complete fixture package intentionally includes all testing/runtime tooling.
Its manifest is not a generated minimal app. The registry consumers are the
omission evidence. Files SDK's npm tarball contains all provider subpaths; this
proof excludes unselected application integrations and optional provider peers,
not files shipped inside the selected upstream package.
