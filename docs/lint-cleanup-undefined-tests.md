# `unicorn/no-useless-undefined` audit: `apps/chat/tests/**`

- Baseline memberships: 53.
- Removable memberships: 1.
- Remaining justified memberships: 52.
- Code changes: one mock now uses a typed `vi.fn<() => Promise<void>>()` and `.mockResolvedValue()` with no explicit `undefined`.

All 45 resolver cases call `resolve(undefined)` on `Promise.withResolvers<undefined>()`. The resolver's value parameter is required for this generic. Switching it to `void` does not satisfy the repository's no-invalid-void-type rule, while changing the resolved value would be a cosmetic type workaround and would no longer model the intended absent completion value.

The remaining 7 cases are required inputs or observable values in tests: four `vi.stubEnv(name, undefined)` calls remove individual environment variables; and three test invocations pass undefined through required fixture/state arguments to exercise missing approval state, project selection, and usage cost. Omitting these inputs would either change the API behavior under test or fail the declared signature. `mocks.model` in `eve-save-copy.e2e.ts` is now typed as a no-argument `Promise<void>` mock for the absent model scenario, allowing Vitest's no-value `.mockResolvedValue()` form.

Verification: `bunx oxlint --type-aware apps/chat/tests/eve-save-copy.e2e.ts` passed. `apps/chat` `bun run test:types` did not report errors in this file, but failed on existing type errors in other files. The focused Playwright run could not load this top-level-await test module (`require() async module ... is unsupported`). A temporary config used for the attempt was removed.
