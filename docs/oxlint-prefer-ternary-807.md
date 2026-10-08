# Oxlint `unicorn/prefer-ternary` ticket #807

## Scope and frozen inputs

This disposition covers only the three canonical files named in the released owner manifest at `/Users/fran/.codex/visualizations/2026/10/08/786-released-807-c5f232b599/manifest.json`. The manifest declares source commit `c5f232b5992156934b249d400264c73c8a033aa0`, `released: true`, and `noActiveEdits: true`. Its three source files matched their declared SHA-256 hashes before edits:

| Canonical path | Frozen SHA-256 | Current SHA-256 |
| --- | --- | --- |
| `apps/chat/components/eve/eve-conversation.tsx` | `87c4fa0f2a9a5f29ba403f037521f3f95fcf09c7132b715a8962eaeaf309ec74` | `80269ce34e26ab5581b402d2f03987cfe2adf711c28d77171a165ea503e1d0fb` |
| `apps/chat/tests/eve-browser.e2e.ts` | `a61e44face53388f315dbac9e7e3e02fd6cd3885bef53fc922d11b2ea36454e3` | `570eb928bfff65b974d6d8727a852948b95a3b98e7f51b6d9bb40714e4f4bc89` |
| `apps/chat/tests/eve-delete-ui.e2e.ts` | `8df3d09f00ab0c56765baaa237581db660309b160a39a438ebfc3583607a1f24` | `baec8befebdfe2dbae0f976ba500945b32047cf70b6462fc88289be93ccd996d` |

The released manifest selects zero generated mirrors. The pinned review snapshot is `e56e9b74b` (`Reduce readonly lint exceptions in upload flows`); no content from older owner read-only copies was applied.

## Counts and disposition

| Measure | Original frozen source | Current source |
| --- | --: | --: |
| Canonical `unicorn/prefer-ternary` suppression memberships in scope | 4 | 4 |
| Selected generated mirror memberships | 0 | 0 |
| File-wide `unicorn/prefer-ternary` scopes | 2 | 0 |
| Line-scoped `unicorn/prefer-ternary` scopes | 2 | 4 |

Removing the two broad test-file scopes exposed four native findings. Each now has one line-scoped exception. These are four justified conflicts, not fixed findings: the existing project policy enables `eslint(no-ternary)` as an error, so converting the statements to ternary expressions creates four violations of that policy. The effective configuration was read from the repository and standalone chat configs: `no-ternary` is explicitly set to `error` in `apps/chat/oxlint-policy.ts`; `unicorn/prefer-ternary` is enabled by the pinned Ultracite preset. The exceptions are not based on a general readability or argument-shape preference.

Native proof used Oxlint `1.82.0`, the version pinned in `bun.lock`. With the four original directives temporarily removed, configured Oxlint reported `unicorn(prefer-ternary)` at `eve-conversation.tsx:540` and `:685`, `eve-browser.e2e.ts:469`, and `eve-delete-ui.e2e.ts:48`. Temporary equivalent ternary rewrites reported `eslint(no-ternary)` at those same four branches. The temporary edits were restored before the final source edits. Focused lint of the final files passes and reports no unused directive for these scopes.

The two EVE component branches await different operations: `fork.compare` for multi-model work and `submitMessage` for a single-model send. Both run inside `run`, whose `catch` stores the command failure and whose `finally` releases the pending lock. Their local comments state this awaited recovery contract and the conflicting rule. The two test branches inspect whether the “Expand sidebar” control is visible and then await exactly one of its click actions. Their comments state that live browser condition and the conflicting rule. No executable statements changed.

Upstream defines `prefer-ternary` for simple `if` statements that return or assign mergeable values and documents the `always` and `only-single-line` modes: [Oxlint rule reference](https://oxc.rs/docs/guide/usage/linter/rules/unicorn/prefer-ternary), [Unicorn upstream rule reference](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-ternary.md). The local rule conflict is independently visible in the pinned repository configuration.

## Verification

- `bun lint` — passed, including repository lint/format checks, docs doctor, and generated demo parity (32 assertions).
- Focused `use-eve-fork.test.tsx` — 12 tests passed under Node `v24.19.0`.
- Focused Oxlint with unused-disable reporting — passed for the three canonical files; unrelated pre-existing unused directives remain in the output.
- `bun test:types --force` — passed all 7 tasks with 0 cached tasks.
- Credentialed browser E2E — not run: `AUTH_SECRET`, `DATABASE_URL`, `EVE_GATEWAY_SECRET`, and `WORKFLOW_POSTGRES_URL` are unset, and neither `.env.local` nor `.env.worktree.local` exists in this checkout.
- Generated synchronization — no selected mirrors exist for this scope, so no mirror was rewritten. The full lint run's `demo:check` confirmed generated demo parity.

No visual capture was required for this comment-only change; rendered UI and runtime statements are unchanged.
