# Issue #704: `no-underscore-dangle` audit

## Scope and provenance

- Issue: https://github.com/FranciscoMoretti/chat-js/issues/704
- Original rule snapshot: `e56e9b74be3ce464b7f49bb4d8367475c8000193`
- Frozen release commit: `05255a992f1f6fd7f339c6930632c23bb6ce17dd`
- Frozen source base: `8d69abab1b9de73ee02711649a8c381894b97b00`
- This checkout's starting checkpoint: `3e20b6f7714d7594dde2cf7ba1e33acb2d8ff0df` (common base with the release is `8d69abab1b9de73ee02711649a8c381894b97b00`).

The frozen manifest verified `released: true` and `noActiveEdits: true` for the three canonical files. Its SHA-256 is `579a931d9b30333c4a733541255baa16921cd69fed224d21e9aa4d98cd7bbdd5`. Frozen-source and diff hashes matched the manifest before porting. The release files differ from this checkout because this checkout contains other parent changes; only the issue-specific edits below were ported. App mirrors were generated from canonical registry sources with `bun demo:sync`.

Frozen artifacts:

- `/tmp/786-704-frozen-manifest.json`
- `/tmp/786-704-frozen-packages-registry-src-features-mcp-lib-ai-mcp-mcp-client.ts` and `.diff`
- `/tmp/786-704-frozen-packages-registry-src-tools-text-documents-diffview.tsx` and `.diff`
- `/tmp/786-704-frozen-apps-chat-trpc-init.ts` and `.diff`
- Durable copies: `/Users/fran/.codex/visualizations/2026/10/08/786-readonly-parameter-audit-reviewed-05255a992/released-704/`

Verified immutable source and diff hashes:

| Canonical path | Frozen-source SHA-256 | Released-diff SHA-256 |
| --- | --- | --- |
| `packages/registry/src/features/mcp/lib/ai/mcp/mcp-client.ts` | `c27986330e744269dd52a2be244fe995f576f60b42c9f1fdce7d33fa838d7859` | `e1cb2c4b55442b4775e5028916364acd9bc3fe3bc10856d8083157dbcc71cc80` |
| `packages/registry/src/tools/text-documents/diffview.tsx` | `40f5c5ab38a5021e7dd7987f6477076d52ba523c702a9ff5b4228cb4392fde2d` | `1d120256762394d85caeb094069a8b193e44a02174e6380fd68adf56fe1ff8a2` |
| `apps/chat/trpc/init.ts` | `c1c2a50f7796feba3e21dc9c5cee139be3876957997fb6213bdfc114a8e004a3` | `24c707d680ca0f71ecf09e84970d1671b851f8acb288edc56ecccc15b07ab48f` |

## Dispositions

At the pinned snapshot the issue reports 5 memberships across 5 paths: 3 canonical source paths plus 2 generated app mirrors.

| Canonical source | App mirror | Disposition |
| --- | --- | --- |
| `packages/registry/src/features/mcp/lib/ai/mcp/mcp-client.ts` | `apps/chat/lib/ai/mcp/mcp-client.ts` | Renamed the owned private `_status` field to `connectionStatus` in the canonical source; retained the public `status` getter and all state transitions. Removed the broad rule suppression. Regenerated the mirror. |
| `packages/registry/src/tools/text-documents/diffview.tsx` | `apps/chat/tools/chatjs/text-documents/diffview.tsx` | Retained one class-bounded exception. Lexical 0.32.1 declares and internally uses `TextNode.__text`/`__key`; the subclass stores its custom node state in the same backing-field convention for clone and serialization. Renaming these members would break the Lexical backing-field contract. Regenerated the mirror. |
| `apps/chat/trpc/init.ts` | — | Retained a single-line exception for `trpc._config.isDev`. The installed `@trpc/server` 11.16.0 source marks `TRPCRootObject._config` `@internal`; it supplies the authoritative `isDev` value used by the SDK. Removed it from the broader middleware exception. |

The accepted exceptions correspond to real native findings: after stripping only the target directives from temporary copies, Oxlint reported 7 Lexical backing-field references and the tRPC `_config` access. The MCP client produced no target-rule findings after the owned-field rename. The probe used the pinned Oxlint CLI and explicitly configured the native rule; diagnostics were `eslint(no-underscore-dangle)`. It also confirmed the bare alias in configuration maps to this rule. Probe sources/config are at `/tmp/oxlint-704-probe-3e20b6f7/`. The root policy sets `no-underscore-dangle` to `error`; `--print-config` reports it as `deny`.

## Counts and file identity

| Memberships           | Original snapshot |    Final checkout |
| --------------------- | ----------------: | ----------------: |
| Canonical files       |                 3 | 2 (Lexical, tRPC) |
| Generated app mirrors |                 2 |       1 (Lexical) |
| Total                 |                 5 |                 3 |
| New target-rule debt  |                 — |                 0 |

Current SHA-256 values:

| Path | SHA-256 |
| --- | --- |
| `packages/registry/src/features/mcp/lib/ai/mcp/mcp-client.ts` | `f4ff60bf210e054ea4fdd76e6bd01d69e13ff75a92fd8d1fed7a0369a9e36ff2` |
| `apps/chat/lib/ai/mcp/mcp-client.ts` | `f4ff60bf210e054ea4fdd76e6bd01d69e13ff75a92fd8d1fed7a0369a9e36ff2` |
| `packages/registry/src/tools/text-documents/diffview.tsx` | `15c219e8a0c7a7dcdf38a504da607150d96a58499f6b563957d8755a4098e595` |
| `apps/chat/tools/chatjs/text-documents/diffview.tsx` | `15c219e8a0c7a7dcdf38a504da607150d96a58499f6b563957d8755a4098e595` |
| `apps/chat/trpc/init.ts` | `f01cbbe5f46f4639c842cf487b2b706bed3981dbe3c9454c344b847e2c67feab` |

The two canonical/mirror pairs are byte-identical after generated synchronization. `packages/registry/demo-baseline.json` records their generated hashes.

## Verification

- `bun install --frozen-lockfile` — completed; 2,274 packages installed.
- `node_modules/.bin/oxlint --print-config ...` — effective target rule is `deny`.
- Targeted type-aware Oxlint on all five affected source files — passed. `--report-unused-disable-directives` found no unused target-rule suppressions; it reported unrelated pre-existing type-assertion suppressions in the MCP client files.
- `bun run --filter @chatjs/chat test:unit -- lib/ai/mcp/mcp-client.test.ts` — 14 tests passed.
- `bun run --filter @chat-js/registry test:visual -- visual/text-document-diffview.browser.test.tsx` — 1 browser visual test passed; React emitted its existing `Placeholder` act warning.
- `bun lint` — passed, including formatting, docs doctor, and generated demo parity (`demo:check`: 1 test, 32 assertions).
- `bun test:types --force` — 7 tasks successful, 0 cached.
- `git diff --check` — passed.

No test files changed. No runtime UI output changed; the existing diff-view capture was run as a regression check. No push, pull request, merge, issue update, or closure was performed.

## References

- Oxc rule: https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-underscore-dangle
- Lexical 0.32.1 source: https://github.com/facebook/lexical/blob/v0.32.1/packages/lexical/src/nodes/LexicalTextNode.ts
- tRPC 11.16.0 installed source: `node_modules/@trpc/server/src/unstable-core-do-not-import/initTRPC.ts` and `rootConfig.ts`
