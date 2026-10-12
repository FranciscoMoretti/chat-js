# Promise Function Async: Packages And Scripts

Audited every current suppression in packages/cli (excluding root-owned generated templates), packages/thread, packages/gateways, and scripts. Counts are disable sites, not matching enable markers. Baseline: HEAD. Total 41 -> 14 sites; 27 net removed. Three broad blocks were replaced with narrower retained exceptions, so this is not a count of affected functions.

| File | Before | After | Result |
| --- | --: | --: | --- |
| packages/cli/test/gateway-selection.test.ts | 2 | 0 | Await actual read/remove/existence operations in map callbacks. |
| packages/gateways/src/runtime.ts | 1 | 1 | Retain dynamic fetch forwarding contract. |
| scripts/cleanup-preview-database.test.ts | 2 | 0 | Native Bun resolved-value mocks with assertions on recorded calls. |
| scripts/sync-template-snapshot.ts | 2 | 1 | Await actual limiter IO; retain synchronous option validation. |
| scripts/dev-supervisor.ts | 1 | 0 | Remove sleep wrapper and call imported delay directly. |
| scripts/vercel-preview-build.ts | 1 | 0 | Await actual postgres connection close. |
| scripts/test-eve-package.ts | 1 | 1 | Await restoration writes; retain only synchronous manifest validation/write scheduling callback. |
| scripts/vercel-preview-build.test.ts | 1 | 3 | Narrow broad harness block to three deliberate synchronous-throw fixture methods. |
| packages/cli/src/helpers/scaffold-content.test.ts | 1 | 0 | Await actual IO callbacks. |
| packages/cli/src/helpers/scaffold.test.ts | 3 | 0 | Await actual IO callbacks. |
| packages/thread/src/ai-sdk-run-chat.ts | 1 | 1 | Retain sync transport error reporting. |
| packages/thread/src/thread-core.ts | 1 | 1 | Retain addressed stopRun override forwarding. |
| packages/thread/src/thread-hook-helpers.ts | 5 | 5 | Retain exposed override forwarding contracts. |
| packages/cli/src/utils/sync-observability.test.ts | 2 | 0 | Await actual IO callbacks. |
| packages/cli/src/utils/sync-features.ts | 3 | 0 | Await actual IO callbacks. |
| packages/cli/src/utils/sync-features.test.ts | 5 | 0 | Await actual IO; native Bun rejecting registration mocks. |
| packages/cli/src/sync-template-snapshot.test.ts | 1 | 0 | Await actual fixture writes; characterize synchronous option rejection. |
| packages/cli/src/utils/sync-tools.ts | 1 | 0 | Await actual validation reads. |
| packages/cli/src/utils/install-plan.test.ts | 3 | 0 | Await actual IO; replace promise-chain helper with async control flow and native Bun registration mocks. |
| packages/cli/src/utils/installation-plan-code-execution.test.ts | 1 | 0 | Await actual cleanup. |
| packages/cli/src/utils/sync-tools.test.ts | 1 | 0 | Await actual cleanup. |
| packages/cli/src/commands/create.test.ts | 1 | 0 | Await actual cleanup. |
| packages/cli/src/registry/transport.ts | 1 | 1 | Retain synchronous insecure-fetch rejection. |

## Retention Evidence

- GatewayRuntime default fetch is public through subclass implementations and reads globalThis.fetch at call time. New packages/gateways/src/runtime.test.ts replaces global fetch after construction, asserts exact request/options/promise identity, then verifies synchronous failure propagation.
- Thread hook helpers expose supplied controller methods. New packages/thread/test/promise-forwarding.test.ts configures startRun/resumeRun/stopAll/stopRun/stopRunForMessage overrides, asserts exact promise identity, then replaces each with a synchronous throw and checks the exposed helper throws synchronously. This covers all five retained helper suppressions.
- ThreadCore.stopRunForMessage dispatches the public overridable stopRun method. The same test file supplies a run, asserts exact stopRun promise identity and addressed run ID, then verifies synchronous failure propagation.
- ThreadRunChat.sendMessages directly forwards custom transport invocation into AI SDK makeRequest. The same test file calls Thread.regenerate with a synchronously throwing transport and asserts public onError ran before regenerate returned, then awaits completion. An async forwarding wrapper would fail this test by deferring onError.
- collectSnapshot constructs SnapshotIoLimiter as a call argument before returning its promise. New CLI snapshot test checks 0, -1, fractional, and NaN concurrency throw RangeError synchronously.
- Registry fetch Proxy.apply invokes requireSecure before fetch. New transport test invokes fetch for a non-loopback HTTP URL inside a serialized operation and asserts the call itself throws synchronously.
- Preview build harness execute/close/run methods intentionally inject synchronous driver/subprocess-launch throws via step(). Existing parameterized `reports failure at ... without leaking credentials` cases cover SELECT/lock, migration/build, and close; keeping these methods synchronous preserves coverage of launch-time failure handling rather than silently changing that coverage to rejected promises. The existing lock-wait test also confirms the supplied gate still controls migration order.
- test-eve-package first manifest callback parses/checks dependencies before returning a write promise. Its enclosing try/finally restores original manifests and lockfile. Synchronous validation stops Array.map immediately before finally starts; converting this callback to async would continue scheduling later writes after malformed-manifest rejection, allowing them to race restoration. Retained exception narrowed to this callback. Caller/finally code is the evidence; no tarball-install workflow executed because it mutates dependencies and runs broad repository tasks.

## Verification

- PASS focused `bunx oxlint --type-aware packages/cli/src packages/cli/test scripts packages/thread packages/gateways` with repository configuration and all enabled rules, not a rule-only override.
- PASS direct TypeScript no-emit checks for packages/cli, packages/thread, and packages/gateways.
- PASS thread suite: 73 tests across 6 files.
- PASS gateways Vitest suite: 20 tests across 5 files.
- PASS focused scripts/snapshot/thread/registry transport tests after final edits: 42 tests across 5 files.
- CLI source suite: 204 pass, 2 fail across 40 files. Both failures are generated scaffold gateway warning execution (`rewrites ... npm-friendly`, `keeps Bun commands ...`) because generated temporary projects cannot resolve the vitest executable. Isolated Bun case reproduces `/bin/bash: vitest: command not found`, exit 127. These tests exercise fixture command discovery, not the edited async callbacks.
- Not run gateway-selection.test.ts because its beforeAll regenerates registry output and builds/packages fixtures; root requested no sync generators. Changes there only await actual IO already collected by Promise.all.
- No full lint/type task, dependency/config changes, commits, or PRs. Formatted touched files with oxfmt.

## Shared Worktree Notes

Preexisting/concurrent edits were observed in packages/cli/src/registry/{shadcn,transport}.ts, transport.test.ts, utils/{install-plan,installation-files,sync-observability}.ts. Parent confirmed these were external. Preserved compatible edits, restored required await where the intermediate rule-only fixer changed return-await behavior, and added the transport characterization test. Current source-only diffs for transport.ts, installation-files.ts, and sync-observability.ts are empty against HEAD. Do not count unrelated shadcn/install-plan source changes as this agent's cleanup.
