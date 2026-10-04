# Runtime dependency acceptance

This record describes the maintained runtime boundary for ChatJS 1.0 issue #652. Supported upstream releases replace the MCP compiled patch and the private Blob signing extension. The PostgreSQL world patch and EVE dynamic-tool typing compensation remain release work; neither is counted as resolved by repackaging or moving files.

## Dependency contracts

| Dependency | Maintained contract | Upgrade evidence |
| --- | --- | --- |
| `@ai-sdk/mcp@2.0.53` | Upstream SSE single-flight authorization and reuse of a newer token after a stale 401 | Existing simultaneous/after-save transport regressions and app cross-client OAuth rotation tests remain unchanged |
| `ai@7.0.106`, `@ai-sdk/gateway@4.0.86`, `@ai-sdk/react@4.0.109`, `@ai-sdk/otel@1.0.106` | Matching `@ai-sdk/provider-utils@5.0.44` type identity | Workspace type checks; upgrading MCP alone causes incompatible nominal Schema symbols |
| `files-sdk@2.5.0` with `@vercel/blob@2.4.0` | Native private GET signing, configured five-minute default, token or OIDC/store credentials | Contract tests execute the published adapter and mock only Blob network methods; verify operation/path scope, both credential modes, expiry and abort propagation |
| `eve` alias to `@chat-js/eve@0.61.0-chatjs.0` | Owned published EVE fork; persisted workflow identity stays unchanged | Existing native tool input/output inference tests remain required; approval typing compensation is still present |
| `@workflow/world-postgres@5.0.0-beta.40` with Graphile `0.16.6` | Compiled queue/stream patch plus provider-owned lifecycle SQL | Cancellation/deduplication, resume, inventory, fencing, locked-worker refusal and retry-receipt acceptance |

Files SDK `2.6.2` was evaluated but introduces catalog entries such as RustFS for which this repository has no installed source adapter. The bounded signing upgrade uses `2.5.0`, which contains upstream signing commit `dfa4982ab4` and preserves the existing provider catalog by excluding its new `s3-fetch` adapter from the installer until ChatJS owns its source and configuration. Expanding the catalog is separate installation work.

Generated apps use normal published MCP and Files SDK dependencies. Only the PostgreSQL world is still vendored as a patched archive. This proves package consistency, not hosted provider credentials or full deployment certification. No package was published, no existing database migrated, and no hosted erasure exercised by this task.

## Dependency verification

The final dependency selection passed `bun lint`, all seven `bun test:types` tasks, and 936 app unit tests in 157 files. The unchanged MCP regressions are included in that app run. The real Files SDK adapter tests replace the former mocked-adapter extension test.

Packaging verification passed 61 scaffold/vendor/catalog tests and 95 registry source tests. `bun run --cwd packages/cli test:gateways` passed all nine fresh-app scenarios (238 assertions): the five built-in gateways, an external gateway, native external tools, and MCP omitted/installed flows. Those fixtures install source-built CLI and gateway archives, type-check the generated apps and exercise their adapters. This is generated/typechecked evidence for the candidate sources, not evidence that a release has been published. The full Bun/npm/pnpm/Yarn plus Electron matrix remains the separate required CLI Scaffold CI job.

## Native lifecycle acceptance

[PR #656](https://github.com/FranciscoMoretti/chat-js/pull/656) adds the required `Native Lifecycle` CI job and a versioned provider interface. PostgreSQL operations check the exact workflow/Graphile migration boundary and enabled fence triggers before retirement. Managed Workflow exposes an unsupported result, and `sandboxLifecycle` is explicitly false. Callers must still authorize deleting sessions, settle usage, prove external-resource coverage and retain application journals/receipts.

The eight-file provider selection runs 37 tests without a model, browser, worker service, cloud credentials or shared database. Local evidence used a new PostgreSQL 15 cluster bound to `127.0.0.1:5652`. [GitHub run 37221869790](https://github.com/FranciscoMoretti/chat-js/actions/runs/37221869790) passed on an isolated PostgreSQL 17 service at commit `4fd533a3`. Setup is explicit: app `db:migrate`, `eve:setup`, `eve:check`, then `test:native`. This is local/provider evidence, not managed Workflow or hosted sandbox certification.

The first scaffold CI run found the maintainer config accidentally included in generated apps without its imported base config. Follow-up `aee66356` excludes the config and `test:native` script and adds regression assertions. The public lifecycle contract is unchanged.

## Broader native suite remains unresolved

The exploratory command below ran on `4fd533a3`, using the same isolated local PostgreSQL database and fixture-only auth/gateway secrets, with no Blob credentials or live worker:

```sh
# Set DATABASE_URL and WORKFLOW_POSTGRES_URL to the same isolated local database.
# Set AUTH_SECRET, EVE_GATEWAY_SECRET and EVE_INTERNAL_ORIGIN to test-only values.
bun run --cwd apps/chat db:migrate
bun run --cwd apps/chat eve:setup
bun run --cwd apps/chat vitest run --config vitest.eve.config.ts
```

It produced **175 passing and 6 failing tests across 27 files**. Those assertions were not weakened or skipped. The deterministic required selection is deliberately named and configured separately.

| Failing scenario | Observed failure and current source evidence |
| --- | --- |
| `eve-contracts.e2e.ts`: `codeExecution` and `webSearch` receipt scenarios | An output string without any receipt marker returns `undefined`, while the tests expect `false`. `lib/eve/usage.ts` explicitly returns when `hasEveToolReceipt` is false. Whether arbitrary missing receipts should block retirement requires a billing-policy decision; this is not certified as a harmless stale test. |
| `eve-projects.e2e.ts`: assignment and filtered history | The history assertion expects the conversation ID in `id`; the returned history uses the logical chat ID and carries `conversationId` separately. Fixture expectations need review against the current logical-history contract. |
| `eve-projects.e2e.ts`: unresolved fork route | The fixture expects a null result when removing a pending fork's project; current assignment returns `{ conversationId, projectId: null }`. Product semantics and the fixture must be reconciled. |
| `eve-code-sandboxes.e2e.ts`: retired family inventory | The fixture passes a conversation ID to a function whose `rootId` query matches `eveConversation.chatId`, producing the retirement-precondition error. Ownership and the logical family fixture need review before enabling this broader gate. |
| `eve-file-storage.e2e.ts`: storage purge retry | The default Vercel Blob adapter requires real credentials. Deterministic CI needs an explicitly installed test storage provider; adding hosted credentials to the native gate would change its isolation contract. |

## Outstanding dependency release work

The world patch cannot yet be removed. Published world `5.0.1` was inspected: its queue no longer serializes all invocations for a run, but its stream reader initializes the cursor before fetching and discards consumed chunks in JavaScript. It does not supply the current patch's SQL prefix boundary, so removing the patch loses the bounded-transfer resume behavior protected by `eve-postgres-stream-resume.e2e.ts`. A source-maintained world release with that behavior and schema/identity upgrade acceptance is still needed. Importing thousands of upstream implementation lines into this PR or publishing an unverified fork would not establish that contract.

The published EVE fork still declares `DynamicToolEntry.approval` as unparameterized `Approval` and its `approvalKey` input as `Record<string, unknown>`. Its latest scoped release remains `0.61.0-chatjs.0`. The exact required upstream work is to thread `TInput` through dynamic approval callbacks and preserve heterogeneous tool-set inference, with compile-time input/output/approval coverage, then build and release the maintained fork. Package publication is outside this task's authorization. ChatJS retains its existing typed helper until that supported artifact exists; this gate remains open.
