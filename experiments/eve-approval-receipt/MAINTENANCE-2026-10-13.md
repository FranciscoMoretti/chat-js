# B maintenance — 13 October 2026

**Historical checkpoint, superseded by [the completed typed migration](TYPED-VALIDATION-2026-10-13.md).** The parent subsequently authorized and received the bounded migration described below.

**Status at commit `9432c91697afdee45a0bd98e70b9a81b85d6a601`: not ready for the requested all-new-code lint compliance.** Repository checks pass, but materialized experimental payloads still have substantive lint findings. This maintenance preserves the completed receipt/callback experiments and records the remaining work without adding lint exclusions or claiming the patch contents are covered by repository lint.

## Main update and scoped cleanup

Restored the missing worktree on its existing `codex/eve-mcp-receipt-proof` branch at `87b1e035e`. Fetched and merged `origin/main` at **`d612af7c128a3d962455f8c4574ae5a69ce2d99e`**, producing merge commit `a13c972e2`. No conflicts; previous commits remain intact. Main itself was not modified.

Read current root/app `AGENTS.md`, `docs/lint-policy.md`, root Oxlint/Oxfmt configurations and the strategic-testing skill. The current contract is Ultracite 8 defaults with type-aware lint; obsolete disabled-rule suppressions must be removed and import evaluation order preserved.

Removed the obsolete `import/no-default-export` suppression in the authored EVE channel. Applied only control-flow braces, numeric separators, import spacing and formatting to the runtime fixture payload. A TypeScript AST comparison of all eight executable payload files passes after normalizing single-statement control-flow blocks; literals, imports, expressions, assertions and execution order are unchanged. No receipt implementation, authority boundary, restart timing, effect assertion, package pin or production adapter was changed. Earlier runtime results remain historical evidence; no fresh runtime/PG/migration claim is made.

## Checks

- `bun install --frozen-lockfile --ignore-scripts`: passes; tracked manifests/lockfile unchanged.
- `bun lint`: passes, including docs doctor and demo parity. The seven errors recorded on 7 October are absent on this main baseline.
- `bun test:types`: seven tasks pass.
- `bun run --cwd apps/chat test:unit lib/eve/mcp-tools.test.ts`: 31 tests pass.
- Shell syntax, all three patch-application checks against their intended targets, payload parsing and normalized AST comparison: pass.

Repository lint does **not** parse `.patch` bodies. Its success is not payload compliance.

## Corrected payload audit

All remaining **455 diagnostics** belong to **B-authored runtime code**, not unchanged upstream EVE source: 349 TypeScript safety diagnostics and 106 other diagnostics. Counts are diagnostics, not distinct defects; missing types at one boundary cause many downstream reports.

| Payload                                      | Diagnostics |
| -------------------------------------------- | ----------: |
| `runtime-proof.mjs`                          |         311 |
| `runtime-old-run.ts`                         |         112 |
| `runtime-postgres.ts`                        |          11 |
| `runtime-fixture/agent/tools/mcp.ts`         |          15 |
| `runtime-fixture/agent/tools/static-gate.ts` |           4 |
| `runtime-fixture/agent/channels/invoke.ts`   |           2 |

Full rule counts are in [the audit JSON](LINT-AUDIT-2026-10-13.json). The main categories are unsafe member access (158), assignment (81), call (65), argument (16), await-expression member access (45), and sequential awaits (11). The controllers use untyped dynamic client/helper imports, JSON evidence and a global runtime bridge. These are actual untyped boundaries. Some findings, such as sequential polling/crash barriers, require narrowly justified source exceptions; they do not justify disabling entire categories. The receipt casts in authored tools also need typed experimental-context handling.

The final audit uses D's frozen installation at `/Users/fran/.codex/worktrees/e70d/chat-js/tests/eve-retirement-runtime/node_modules`: EVE 0.71.3, AI 7.0.106, Zod 4.3.6 and TypeScript 6.0.2. Materialized files are at `/var/folders/yh/gd_w4qx53yd7j9z0lypwzsk00000gn/T/lane-b-oct13-pinned-h839cvtc`. The isolated `tsconfig.json` contains:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["node", "bun"]
  },
  "include": ["runtime*.ts", "runtime*.mjs", "runtime-fixture/**/*.ts"]
}
```

From the B checkout, the exact audit invocation is reproducible with these path variables:

```sh
proof_root=/var/folders/yh/gd_w4qx53yd7j9z0lypwzsk00000gn/T/lane-b-oct13-pinned-h839cvtc
bun x oxlint \
  -c /Users/fran/.codex/worktrees/5509/chat-js/oxlint.config.ts \
  --format json --tsconfig "$proof_root/tsconfig.json" \
  "$proof_root/runtime-proof.mjs" "$proof_root/runtime-postgres.ts" \
  "$proof_root/runtime-old-run.ts" "$proof_root/runtime-fixture"
```

Exit status is 1. Tool versions: Bun 1.3.11, Oxlint 1.87.0, type-aware engine 7.0.2004, Oxfmt 0.71.0. Raw final output is `/tmp/lane-b-oct13-final-payload-lint.json`. Earlier 900/830/786 counts are superseded: initial setup lacked pinned dependencies, and TypeScript 6 required explicit Node/Bun ambient types even after installation. Those preliminary counts must not be presented as code defects.

## Separate upstream-patch audit boundary

`counterexample.patch` and `receipt.patch` apply cleanly to EVE source `fab8ba1424eddfdedd6a177cac21710258da0e81`, fetched into `/tmp/lane-b-oct13-source`. Their four wholly added files are B-authored: the receipt module, two integration-test files and Vitest configuration. Applying the ChatJS config to those files reports **124 diagnostics**, including **two upstream tsconfig-resolution errors**. This is a supplemental style audit, not a valid type-aware proof: the full upstream source dependency/build environment was not installed for this maintenance. It must remain separate from the corrected 455 runtime-payload count.

Auditing the four modified upstream files and retaining only diagnostics located on B's added hunk lines yields six further findings: three missing control-flow braces, two explicit `undefined` returns and one non-null assertion. Findings elsewhere in those upstream files are inherited source and excluded from this count. No upstream source was restyled merely to satisfy ChatJS rules. These source patches remain unchanged in this maintenance commit.

## Smallest remaining migration and decision

The narrow compliant path is a typed proof-harness migration, not a production/runtime redesign:

1. Give the three controllers (747 lines total) explicit client, runtime-bridge and evidence-record types. Keep the Node-executed `.mjs` controller with checked JSDoc if practical; alternatively transpile a typed source while preserving the Node 24 launcher. Replace the untyped `globalThis` bridge with an explicit typed runner argument and validate JSON evidence at ingress.
2. Type the receipt projection at the authored fixture boundary and resolve the remaining fixture style findings. Document only intentional sequential polling/process-control exceptions at their narrow source locations.
3. Restore the exact upstream source build environment, type-check the receipt module/tests against it, and fix B-owned source/hunk findings without reformatting inherited EVE code.

Estimate: a medium test-harness change, roughly 150–300 changed lines plus small shared type/schema helpers, touching three controllers, up to four authored fixture modules and the two upstream test payloads. This is an estimate, not a fixed patch size. Risk is concentrated in promise lifetime, crash barriers, evidence parsing and callback typing. A real behavioral refactor would require focused stock/patched local scenario validation and driver setup checks; it would not require repeating the known PG stale-lock or old-run incompatibility experiments unless those paths change.

The parent must choose whether to expand this maintenance into that typed harness migration or retain these artifacts as explicitly non-compliant historical experiments. The latter does **not** satisfy the user's all-new-code standards request. D should not mark B ready on the strength of repository lint alone. No broad suppression, new feature, main merge, deployment or upstream publication was performed.
