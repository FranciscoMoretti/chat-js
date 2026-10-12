# Strict Boolean Expressions: Packages And Scripts

Baseline: docs/lint-cleanup-baseline.json. Audited every original membership under packages/cli, packages/thread, packages/gateways, and scripts. Exactly 3 block-disable memberships existed, all in CLI. All 3 removed; 0 retained; 0 unresolved. No original memberships in thread/gateways/scripts or generated CLI templates.

| File                                        | Starting | Removed | Retained |
| ------------------------------------------- | -------: | ------: | -------: |
| packages/cli/src/utils/sync-features.ts     |        1 |       1 |        0 |
| packages/cli/test/gateway-selection.test.ts |        1 |       1 |        0 |
| packages/cli/test/serve-registry.ts         |        1 |       1 |        0 |
| **Total**                                   |    **3** |   **3** |    **0** |

## Semantic Changes

- syncFeatures addUi is boolean | readonly string[] | undefined. Explicit branches preserve every valid variant: true selects both MCP/uploads, false/undefined select no UI, and arrays retain their exact selection, including an empty array and strings that are empty or unfamiliar. No broad truthiness coercion. Removed adjacent prefer-nullish-coalescing suppression because no fallback truthiness expression remains.
- previous is an edit object or undefined. previous?.content retains the prior expression's undefined sentinel and does not replace empty content with a default. No numeric, NaN, null, or boolean variants exist in this typed contract.
- Both local registry test servers now parse JSON with a small z.looseObject response contract that validates optional dependencies as string[]. All other keys/values pass through unchanged, including registry-index responses and third-party metadata. An explicit `dependencies !== undefined` guard makes array presence meaningful; empty arrays are retained and mapped as before. Adjacent unsafe assignment/call/member suppressions became unnecessary and were removed.
- This is an honest test-fixture input contract correction: fixture dependencies must be absent or a string array. Malformed dependencies now fail fixture validation instead of reaching an unsafe map call (or silently skipping a malformed falsy value). Production registry code and public APIs are unchanged. No new casts, Boolean wrappers, suppression substitutions, configuration, or dependencies.

## Verification

- PASS full-config focused `bunx oxlint --type-aware packages/cli/src packages/cli/test scripts packages/thread packages/gateways` after final changes.
- PASS direct CLI no-emit TypeScript check.
- PASS 19 focused syncFeatures and registry-contract tests across 2 files. Existing cases exercise default/no UI, explicit requested UI, custom controls, registration preservation, and immutable third-party registry contracts.
- PASS read-only round-trip inspection of all 71 existing built registry JSON files: the response contract preserves the entire object exactly.
- PASS actual serve-registry child process: requested all 71 existing registry response routes and compared complete responses against source JSON with only the intended @chat-js/gateways tarball URL rewrite. All matched; child stopped and temporary address directory removed.
- Did not run gateway-selection.test.ts because beforeAll regenerates registry output/builds fixture packages; root owns generators. Both test server implementations use the same validated optional-array contract and mapping logic. No full lint/type tasks, commits, PRs, dependency/config changes, or generated outputs.

Remaining first-rule boundaries were not expanded; no related improvement was needed.
