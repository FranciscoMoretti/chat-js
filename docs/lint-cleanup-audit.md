# Lint Suppression Cleanup Audit

Baseline: `d6caaf3cbe3ec4c3d2895f8b5da9a1d7d852272c` (2026-10-11). The immutable [baseline](lint-cleanup-baseline.json) identifies all 1,728 original memberships across 47 rules, including file, original line, directive scope, and justification.

## Status

Code audit and required local verification complete. All baseline files/rules received a full pass in descending starting-rule count, with additional independent retention reviews. No known solvable case is deferred. Current total: **512**, a net reduction of **1,216 (70.4%)**. **16 original rules have no suppression**.

The [current inventory](lint-cleanup-current.json) contains rule totals, every original/current file-rule pair, and all remaining directives with exact source locations and concrete reasons. These are directive-rule memberships, not expanded diagnostics. Narrowing a broad block can increase a count. One new accessibility directive exposes the existing Shiki keyboard-scroll behavior formerly hidden inside raw HTML.

Ultracite configuration, dependency versions and public contracts are unchanged. No commits, pushes or PRs were created during this goal. Changes remain in the requested worktree.

## Rule Ledger

| Rule | Starting | Current | Net Removed | Audit Verdict |
| --- | --: | --: | --: | --- |
| typescript/promise-function-async | 363 | 73 | 290 | Reviewed retention |
| no-await-in-loop | 211 | 187 | 24 | Reviewed retention |
| typescript/strict-boolean-expressions | 199 | 0 | 199 | Removed |
| unicorn/no-useless-undefined | 129 | 112 | 17 | Reviewed retention |
| typescript/no-deprecated | 114 | 3 | 111 | Reviewed retention |
| typescript/no-unsafe-member-access | 98 | 0 | 98 | Removed |
| typescript/await-thenable | 84 | 7 | 77 | Reviewed retention |
| typescript/no-confusing-void-expression | 83 | 7 | 76 | Reviewed retention |
| typescript/no-unsafe-assignment | 65 | 0 | 65 | Removed |
| typescript/consistent-return | 52 | 0 | 52 | Removed |
| require-await | 41 | 41 | 0 | Reviewed retention |
| func-style | 35 | 10 | 25 | Reviewed retention |
| typescript/strict-void-return | 32 | 3 | 29 | Reviewed retention |
| typescript/prefer-nullish-coalescing | 28 | 0 | 28 | Removed |
| react/todo | 21 | 0 | 21 | Removed |
| promise/avoid-new | 19 | 16 | 3 | Reviewed retention |
| typescript/consistent-type-definitions | 18 | 5 | 13 | Reviewed retention |
| typescript/no-unsafe-argument | 18 | 0 | 18 | Removed |
| typescript/no-unsafe-return | 16 | 0 | 16 | Removed |
| promise/prefer-await-to-then | 16 | 8 | 8 | Reviewed retention |
| complexity | 15 | 0 | 15 | Removed |
| typescript/no-unsafe-call | 13 | 0 | 13 | Removed |
| react/set-state-in-effect | 10 | 0 | 10 | Removed |
| typescript/no-unsafe-type-assertion | 7 | 7 | 0 | Reviewed retention |
| class-methods-use-this | 5 | 5 | 0 | Reviewed retention |
| unicorn/prefer-ternary | 4 | 2 | 2 | Reviewed retention |
| typescript/prefer-promise-reject-errors | 4 | 4 | 0 | Reviewed retention |
| react/hook-use-state | 3 | 2 | 1 | Reviewed retention |
| unicorn/prefer-structured-clone | 3 | 3 | 0 | Reviewed retention |
| react/no-danger | 2 | 0 | 2 | Removed |
| typescript/no-unnecessary-type-assertion | 2 | 2 | 0 | Reviewed retention |
| promise/prefer-await-to-callbacks | 2 | 2 | 0 | Reviewed retention |
| no-unmodified-loop-condition | 2 | 2 | 0 | Reviewed retention |
| react/no-react-children | 1 | 1 | 0 | Reviewed retention |
| react/exhaustive-effect-dependencies | 1 | 0 | 1 | Removed |
| next/no-html-link-for-pages | 1 | 1 | 0 | Reviewed retention |
| react/immutability | 1 | 0 | 1 | Removed |
| next/no-img-element | 1 | 1 | 0 | Reviewed retention |
| unicorn/no-document-cookie | 1 | 1 | 0 | Reviewed retention |
| unicorn/require-module-specifiers | 1 | 0 | 1 | Removed |
| unicorn/error-message | 1 | 1 | 0 | Reviewed retention |
| typescript/only-throw-error | 1 | 1 | 0 | Reviewed retention |
| typescript/no-dynamic-delete | 1 | 1 | 0 | Reviewed retention |
| no-control-regex | 1 | 1 | 0 | Reviewed retention |
| typescript/unbound-method | 1 | 0 | 1 | Removed |
| no-bitwise | 1 | 1 | 0 | Reviewed retention |
| typescript/no-unnecessary-type-arguments | 1 | 1 | 0 | Reviewed retention |
| jsx-a11y/no-noninteractive-tabindex | 0 | 1 | -1 | Newly visible accessibility boundary |
| **Total** | **1728** | **512** | **1216** | **Full pass complete; local checks passed** |

## Evidence

- Priority passes: `lint-cleanup-async-*`, `lint-cleanup-loops-*`, `lint-cleanup-booleans-*` and `lint-cleanup-undefined-*` area reports; [deprecated UI migration](lint-cleanup-deprecated-ui.md).
- Remaining rules: [coordinator](lint-cleanup-remaining-coordinator.md), [library](lint-cleanup-remaining-lib.md), [UI](lint-cleanup-remaining-ui.md), [tests](lint-cleanup-remaining-tests.md), [package tests](lint-cleanup-remaining-package-tests.md), and [production packages/scripts](lint-cleanup-remaining-production.md).
- Substantive lifecycle and complexity changes: [storage](lint-cleanup-storage-followup.md), [conversation](lint-cleanup-conversation-followup.md), plus message/action and artifact details in the coordinator/UI reports.
- Independent retention review: [follow-up](lint-cleanup-retention-followup.md) and the final addendum in [async library](lint-cleanup-async-lib.md). These supersede earlier generic fixture-retention descriptions.
- Independent read-only UI review found no concrete regression in hydration, scope isolation, acknowledgement handling, save/rebase ordering, cleanup failure precedence, message keys or readonly actions.

Historical checkpoint counts and intermediate failures in area reports are preserved as evidence, not final status. This report and the current inventory supersede them. References to HEAD in original reports mean the fixed baseline above.

## Retention Policy

Retentions require concrete contracts, not generic promise-identity claims. Reviewed boundaries include sequential transactional/polling/stream operations, bounded file buffers, synchronous validation and side effects, public override forwarding, required native API arguments, browser callback completion, EVE durable-step compiler restrictions, and deliberate failure fixtures.

No fake await, meaningless instance access, weakened assertion, disabled rule, or public API narrowing was used to force zero. The additional JSX accessibility directive preserves an already-focusable code block and is covered by a native focus test.

Two tool-model assertion exceptions initially appeared redundant in the reference app. The packed Daytona replacement test proved they are necessary for generated OpenAI image-ID unions and unsupported video IDs typed as never. They were restored based on that actual failure.

## Validation

Node 24.20.0 and Bun used. Integrated checks run serially where preparation mutates generated output.

- Final full unit task: nine Turbo tasks passed, including 207 CLI tests. It caught and led to fixing a standalone tsx alias import in the database-check script. Log: /tmp/lint-final-unit.log.
- Final full type task: seven Turbo tasks passed. Log: /tmp/lint-final-types.log.
- Final full Chromium suite: 158 tests across 51 files passed after all fixture follow-ups. Log: /tmp/lint-final-browser-pass2.log. New lifecycle tests cover SSR hydration, storage scope, early acknowledgements, immutable in-flight drafts, queued saves, native API readiness and safe token rendering.
- Final library async follow-up: 135 tests across eight files passed. PGlite database and prototype PostgreSQL tests passed in earlier focused batches.
- Packed CLI: all twelve scenarios verified. Eleven passed in /tmp/lint-final-gateways-pass2.log, including all six gateways, native tools, and both MCP configurations. The Daytona scenario passed after restoring its proven assertion exceptions (/tmp/lint-final-gateways-daytona.log).
- Packed testing also caught the new PGlite regression test leaking into scaffolds. It now follows the existing repository-only filter, with filter coverage. Generated apps do not acquire PGlite.
- Full lint passed, including formatting, type-aware rules, docs doctor and demo parity (/tmp/lint-final-lint.log). Final template parity passed for both chat-app and Electron, plus demo parity (/tmp/lint-final-parity.log).
- `git diff --check` passes. No application production build was used to type-check; package build steps required by existing validation scripts still run.

## Verification Limits

UI Verify cloud comparison was unavailable because `UIVERIFY_API_KEY` is unset. Local Chromium assertions and captures were run and inspected; no cloud baseline parity is claimed. Generated captures are preserved outside source at `/tmp/lint-cleanup-visuals/`, using their original relative paths.

Local Next startup was attempted but stopped at environment validation: missing EVE gateway secret, workflow PostgreSQL URL, and Langfuse credentials. Live provider/database E2E acceptance remains unavailable. No credentials or outcomes were fabricated. No development server remains running.

Existing Radix, Next Link, Sonner and preview fixtures emit non-failing React act warnings in the full browser suite. These were recorded, not filtered or suppressed. Focused new lifecycle suites pass without act/hydration errors.
