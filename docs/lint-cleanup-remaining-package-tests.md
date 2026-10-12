# CLI, Scripts And Daytona Test Rules

Exclusive scope: packages/cli/src/**/_.test.ts; packages/cli/test/gateway-selection.test.ts; scripts/_.test.ts; canonical Daytona execution.test.ts and sandbox.test.ts. 52 files checked. Repository/testing instructions read. No production, config, dependency, generated artifact, or public API edits.

Counts compare the original docs/lint-cleanup-baseline.json with final source; parent first-rule/JSON fixes were preserved and are INCLUDED in original-to-final counts, not claimed as new work. This task specifically removed 30 await-thenable and31 no-confusing-void-expression memberships; two remaining unsafe-argument matchers, one unbound-method callback and one complexity exception were fixed. require-await fixture scopes were audited/narrowed.

Removed=max(Starting-Final,0); retained=min(Starting,Final); added narrow=max(Final-Starting,0). Additional narrower directives can replace broad blocks; they do not conceal newly introduced solvable errors. Unresolved=0.

## Assertion Semantics

Awaited node:assert/strict.rejects owns asynchronous settlement. Its reason validator invokes the ORIGINAL synchronous Bun toThrow, preserving substring/regex/non-Error rejection behavior. Identity uses reason===original failure. Void success verifies exact undefined through a Promise<unknown> receiving annotation on the actual promise. No casts, fake awaits, dropped awaited operations, removed assertions, or relaxed matching. Previously unawaited Bun matcher calls in converted files now await the actual Node assertion promise.

Bun probes confirmed toThrow substring accepts both Error and string reasons and message-bearing objects; delegation preserves that behavior instead of replacing it with narrower instanceof checks or Node exact-message object matching.

## typescript/no-unsafe-member-access

| File | Starting | Removed | Retained | Added Narrow | Unresolved |
| --- | --: | --: | --: | --: | --: |
| packages/cli/src/helpers/empty-tool-registry.test.ts | 3 | 3 | 0 | 0 | 0 |
| packages/cli/src/helpers/scaffold.test.ts | 6 | 6 | 0 | 0 | 0 |
| packages/cli/src/helpers/turbo-affected.test.ts | 3 | 3 | 0 | 0 | 0 |
| packages/cli/src/helpers/vendor-patched-package.test.ts | 1 | 1 | 0 | 0 | 0 |
| packages/cli/src/utils/install-plan.test.ts | 1 | 1 | 0 | 0 | 0 |
| packages/cli/src/utils/sync-observability.test.ts | 2 | 2 | 0 | 0 | 0 |
| packages/cli/src/utils/sync-tools.test.ts | 9 | 9 | 0 | 0 | 0 |
| packages/cli/test/gateway-selection.test.ts | 17 | 17 | 0 | 0 | 0 |

## typescript/no-unsafe-assignment

| File | Starting | Removed | Retained | Added Narrow | Unresolved |
| --- | --: | --: | --: | --: | --: |
| packages/cli/src/helpers/empty-tool-registry.test.ts | 1 | 1 | 0 | 0 | 0 |
| packages/cli/src/helpers/scaffold.test.ts | 3 | 3 | 0 | 0 | 0 |
| packages/cli/src/helpers/turbo-affected.test.ts | 2 | 2 | 0 | 0 | 0 |
| packages/cli/src/helpers/vendor-patched-package.test.ts | 1 | 1 | 0 | 0 | 0 |
| packages/cli/src/utils/install-plan.test.ts | 1 | 1 | 0 | 0 | 0 |
| packages/cli/src/utils/sync-observability.test.ts | 2 | 2 | 0 | 0 | 0 |
| packages/cli/src/utils/sync-tools.test.ts | 16 | 16 | 0 | 0 | 0 |
| packages/cli/test/gateway-selection.test.ts | 6 | 6 | 0 | 0 | 0 |

## typescript/no-confusing-void-expression

| File | Starting | Removed | Retained | Added Narrow | Unresolved |
| --- | --: | --: | --: | --: | --: |
| packages/cli/src/utils/install-plan.test.ts | 1 | 1 | 0 | 0 | 0 |
| packages/cli/src/utils/installation-plan-code-execution.test.ts | 2 | 2 | 0 | 0 | 0 |
| packages/cli/src/utils/installation-plan.test.ts | 1 | 1 | 0 | 0 | 0 |
| packages/cli/src/utils/installation-requirements.test.ts | 9 | 9 | 0 | 0 | 0 |
| packages/cli/src/utils/instrumentation.test.ts | 1 | 1 | 0 | 0 | 0 |
| packages/cli/src/utils/sync-features.test.ts | 2 | 2 | 0 | 0 | 0 |
| packages/cli/test/gateway-selection.test.ts | 7 | 7 | 0 | 0 | 0 |
| packages/registry/src/tools/daytona-code-execution/execution.test.ts | 1 | 1 | 0 | 0 | 0 |
| packages/registry/src/tools/daytona-code-execution/sandbox.test.ts | 1 | 1 | 0 | 0 | 0 |
| scripts/dev-health.test.ts | 4 | 4 | 0 | 0 | 0 |
| scripts/dev-service.test.ts | 2 | 2 | 0 | 0 | 0 |

## typescript/await-thenable

| File | Starting | Removed | Retained | Added Narrow | Unresolved |
| --- | --: | --: | --: | --: | --: |
| packages/cli/src/utils/install-plan.test.ts | 1 | 1 | 0 | 0 | 0 |
| packages/cli/src/utils/installation-plan-code-execution.test.ts | 2 | 2 | 0 | 0 | 0 |
| packages/cli/src/utils/installation-plan.test.ts | 1 | 1 | 0 | 0 | 0 |
| packages/cli/src/utils/installation-requirements.test.ts | 9 | 9 | 0 | 0 | 0 |
| packages/cli/src/utils/sync-features.test.ts | 2 | 2 | 0 | 0 | 0 |
| packages/cli/test/gateway-selection.test.ts | 7 | 7 | 0 | 0 | 0 |
| packages/registry/src/tools/daytona-code-execution/execution.test.ts | 1 | 1 | 0 | 0 | 0 |
| packages/registry/src/tools/daytona-code-execution/sandbox.test.ts | 1 | 1 | 0 | 0 | 0 |
| scripts/dev-health.test.ts | 4 | 4 | 0 | 0 | 0 |
| scripts/dev-service.test.ts | 2 | 2 | 0 | 0 | 0 |

## typescript/promise-function-async

| File | Starting | Removed | Retained | Added Narrow | Unresolved |
| --- | --: | --: | --: | --: | --: |
| packages/cli/src/commands/create.test.ts | 1 | 1 | 0 | 0 | 0 |
| packages/cli/src/helpers/scaffold-content.test.ts | 1 | 1 | 0 | 0 | 0 |
| packages/cli/src/helpers/scaffold.test.ts | 3 | 3 | 0 | 0 | 0 |
| packages/cli/src/sync-template-snapshot.test.ts | 1 | 1 | 0 | 0 | 0 |
| packages/cli/src/utils/install-plan.test.ts | 3 | 3 | 0 | 0 | 0 |
| packages/cli/src/utils/installation-plan-code-execution.test.ts | 1 | 1 | 0 | 0 | 0 |
| packages/cli/src/utils/sync-features.test.ts | 5 | 5 | 0 | 0 | 0 |
| packages/cli/src/utils/sync-observability.test.ts | 2 | 2 | 0 | 0 | 0 |
| packages/cli/src/utils/sync-tools.test.ts | 1 | 1 | 0 | 0 | 0 |
| packages/cli/test/gateway-selection.test.ts | 2 | 2 | 0 | 0 | 0 |
| scripts/cleanup-preview-database.test.ts | 2 | 2 | 0 | 0 | 0 |
| scripts/vercel-preview-build.test.ts | 1 | 0 | 1 | 2 | 0 |

scripts/vercel-preview-build.test.ts: Failure cases below exercise a driver throwing synchronously during close; runMaintainerBuild must still retain the original migration failure. failAt injects synchronous driver failures at SELECT/lock steps, which the phase-redaction tests exercise. The migration/build failure cases exercise synchronous subprocess-launch failures as well as async driver work.

## require-await

| File | Starting | Removed | Retained | Added Narrow | Unresolved |
| --- | --: | --: | --: | --: | --: |
| packages/registry/src/tools/daytona-code-execution/execution.test.ts | 9 | 0 | 9 | 0 | 0 |
| packages/registry/src/tools/daytona-code-execution/sandbox.test.ts | 9 | 0 | 9 | 0 | 0 |

packages/registry/src/tools/daytona-code-execution/execution.test.ts: This Promise-returning provider fixture records invocation-time calls or changes cancellation/deletion state before settling; a precomputed settled mock would skip or move those effects.

packages/registry/src/tools/daytona-code-execution/sandbox.test.ts: Provider create/get require a Promise and must construct a fresh resource for each invocation rather than share a precomputed fixture. This Promise-returning provider fixture records invocation-time calls or changes cancellation/deletion state before settling; a precomputed settled mock would skip or move those effects. The provider get callback must inspect current deletion state and asynchronously reject after the recorded delete, not precompute an earlier result.

## no-await-in-loop

| File | Starting | Removed | Retained | Added Narrow | Unresolved |
| --- | --: | --: | --: | --: | --: |
| packages/cli/src/helpers/config-docs.test.ts | 1 | 1 | 0 | 0 | 0 |
| packages/cli/src/helpers/gateway-provider.test.ts | 4 | 2 | 2 | 0 | 0 |
| packages/cli/src/helpers/scaffold.test.ts | 1 | 1 | 0 | 0 | 0 |
| packages/cli/src/utils/sync-features.test.ts | 5 | 2 | 3 | 0 | 0 |
| packages/cli/test/gateway-selection.test.ts | 1 | 1 | 0 | 0 | 0 |
| scripts/dev-health.test.ts | 2 | 2 | 0 | 0 | 0 |

packages/cli/src/helpers/gateway-provider.test.ts: Exercise successive gateway switches in the same generated application. Finish reading this gateway's three outputs before the next configureGatewayProvider call overwrites them.

packages/cli/src/utils/sync-features.test.ts: Each case replaces composer-controls.ts in the same fixture; finish the prior sync/read before writing the next subset. Sync the subset just written before checking its source or replacing it with the next case. Read this subset's synced source before the next iteration overwrites the shared composer file.

## typescript/no-unsafe-argument

| File | Starting | Removed | Retained | Added Narrow | Unresolved |
| --- | --: | --: | --: | --: | --: |
| packages/cli/src/helpers/env-checklist.test.ts | 1 | 1 | 0 | 0 | 0 |
| packages/cli/src/helpers/prompts.test.ts | 1 | 1 | 0 | 0 | 0 |
| packages/cli/src/helpers/turbo-affected.test.ts | 1 | 1 | 0 | 0 | 0 |
| packages/cli/src/utils/sync-tools.test.ts | 7 | 7 | 0 | 0 | 0 |

## typescript/no-unsafe-call

| File | Starting | Removed | Retained | Added Narrow | Unresolved |
| --- | --: | --: | --: | --: | --: |
| packages/cli/src/helpers/turbo-affected.test.ts | 3 | 3 | 0 | 0 | 0 |
| packages/cli/test/gateway-selection.test.ts | 1 | 1 | 0 | 0 | 0 |

## complexity

| File | Starting | Removed | Retained | Added Narrow | Unresolved |
| --- | --: | --: | --: | --: | --: |
| packages/cli/test/gateway-selection.test.ts | 1 | 1 | 0 | 0 | 0 |

## typescript/strict-boolean-expressions

| File | Starting | Removed | Retained | Added Narrow | Unresolved |
| --- | --: | --: | --: | --: | --: |
| packages/cli/test/gateway-selection.test.ts | 1 | 1 | 0 | 0 | 0 |

## typescript/unbound-method

| File | Starting | Removed | Retained | Added Narrow | Unresolved |
| --- | --: | --: | --: | --: | --: |
| packages/cli/src/helpers/empty-tool-registry.test.ts | 1 | 1 | 0 | 0 | 0 |

## unicorn/no-useless-undefined

| File | Starting | Removed | Retained | Added Narrow | Unresolved |
| --- | --: | --: | --: | --: | --: |
| scripts/vercel-preview-build.test.ts | 1 | 0 | 1 | 0 | 0 |

scripts/vercel-preview-build.test.ts: The Promise<undefined> resolver requires its explicit completion value.

## Concrete Fixes

- Receiver-preserving TypeScript readFile callback removes unbound-method without asserting any undocumented receiver semantics.
- arrayContaining asymmetric values replaced with equivalent required-item containment checks; original allowance for extra entries/order is unchanged.
- Gateway matrix complexity23 exceeds20: cohesive optional tool-file validation extracted unchanged and invoked at the original point; all conditional assertions and ordering preserved.
- Daytona constant replies/no-op/rejections use typed Bun mock APIs. No-op mocks return a genuinely settled Promise<void>. Fresh resource allocation shared in a named per-invocation helper; recorded lifecycle, abort state, delete retries, and fresh-resource callbacks retain narrow require-await because precomputed mocks would move/omit those effects.
- Sequential gateway-switch and composer-subset setup/read loops remain required: each case rewrites the same generated fixture.
- Build driver callbacks keep original synchronous throws; required undefined resolver remains required.

## Verification

- Full configured native oxlint --type-aware: zero diagnostics across all52 scope files; /tmp/root-tests-lint.json.
- Focused changed CLI helpers, scripts and Daytona:35 pass,0 fail across6 files; /tmp/root-other-tests-final.log.
- All Bun script suites:85 pass,0 fail across8 files; /tmp/root-script-tests.log. Hosted-cleanup uses Vitest and was not incorrectly sent to Bun.
- Explicit CLI ./src unit run:207 pass,0 fail across40 files,1123 assertions; /tmp/root-cli-unit-final.log.
- Broad CLI+gateway integration attempt:209 pass,12 fail,1error. Ten installed-app cases fail generated components/ai-elements/message.tsx:269 TS2345 (ReactNode[] not assignable to readonly ReactElement[]), plus cleanup timeout; unrelated template Electron test selected by bare src filter cannot resolve @/lib/electron-auth. /tmp/root-cli-tests.log. Coordinator notified; no test weakened to bypass these failures. The explicit ./src rerun above excludes that unrelated template suite and passes.
- Native formatting applied to scope; git diff --check passed.
