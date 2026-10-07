# Lane A: native deletion approval

**No production gate removed.** Published EVE `0.71.3` passes the native capability experiments below. The production alias `@chat-js/eve@0.61.0-chatjs.0` fails the foreign-cancellation requirement. Its authenticated cancellation bypasses `approval.response` and settles the owner's pending request. It does **not** execute a deletion in this counterexample. Keep deletion's receipt gate and MCP receipts intact pending integration; retaining the receipt does not itself repair cancellation.

The selected release is `eve@0.71.3`, source `fab8ba1424eddfdedd6a177cac21710258da0e81`, with AI SDK `7.0.106` and bundled Workflow `5.0.1` (serde `5.0.0`). Lane D owns the pin, installation lockfile and disposable-worker runner in `tests/eve-retirement-runtime`. No production manifest or lockfile changed here. Initial exploration used `0.71.2`; all acceptance results below were rerun on `0.71.3`.

## Run the proofs

After installing Lane D's isolated harness dependencies, from the repository root:

```sh
bun tests/eve-retirement-lane-a/native-deletion.proof.mjs tests/eve-retirement-runtime/node_modules/eve
EVE_TEST_NODE=/opt/homebrew/opt/node@24/bin/node bun tests/eve-retirement-runtime/run.ts "$PWD/tests/eve-retirement-lane-a/fixture"
```

Use any Node >=24 executable for `EVE_TEST_NODE`. The internal proof takes an explicit installed EVE directory and rejects other versions. It loads AI SDK from that installation, uses the real approval coordinator/tool loop, and writes/reads a serialized pending session in a disposable directory. No EVE execution or settlement function is mocked. The model and document state/effect probe are fixtures.

To reproduce the production-fork counterexample after the ordinary frozen workspace installation:

```sh
bun tests/eve-retirement-lane-a/native-deletion.proof.mjs node_modules/eve
```

Expected: exit 1, precisely two failed cases, foreign cancellation in generate and stream modes. On the fork the response policy is never called for that cancellation. The request is gone, so a later owner cannot approve it. The fixture adapts only the public response callback shape: fork `responder`, native `response.principal`.

The native proof emits expected runtime errors for revision/ownership/cancellation denial and the foreign out-of-turn invocation. Its final summary is the verdict. A warning about Workflow attributes outside a workflow body is expected in the internal harness; the separate HTTP/Workflow evaluation runs inside the real worker.

## Evidence collected

| Proof | Result |
| --- | --- |
| Published native harness | 26/26 pass, generate and stream paths |
| Installed fork harness | 22/24 pass; foreign cancellation fails in both paths |
| Native static HTTP + local Workflow | 1 evaluation passes, 3 EVE gates plus Node assertions; two durable sessions |
| Actual installed dynamic source | All three modes pass their expected-result assertions; candidate covers four durable sessions |
| Existing deletion and MCP approval tests | 8/8 pass across two Vitest files |
| `bun test:types` | 7/7 workspace tasks pass, all Turbo cache hits; no production files changed |
| Lane fixture `tsc` | Pass against isolated `eve@0.71.3` |
| Lane `oxlint` and `oxfmt` | Pass |
| `bun lint` | Stops at the repository lint-exception budget: new isolated proof scopes are not in the shared baseline |

Verification host: Bun `1.3.11`; HTTP/Workflow worker uses Node `24.20.0`. The final native and fork summaries are respectively `{cases:26,failures:0}` and `{cases:24,failures:2}`.

The harness cases cover missing consent, owner approval after serialized continuation reload, foreign approval, foreign cancellation, owner cancellation with a late approval, unauthenticated approval, plain approval text, a wrong request ID, revision/owner changes and real turn-signal abortion during response authorization, a second identical call needing fresh consent, and native out-of-turn invocation. An owner out-of-turn call returns `approval-required`; a foreign one fails the fixture ownership gate; neither executes.

The HTTP fixture sends real authenticated owner/foreign responses, proves no `action.result` before owner consent, completes the original request after foreign approve and cancel were rejected, checks owner cancellation produces no completed tool, and reattaches a fresh client to replay durable events. The eval driver's `requireInputRequest()` only projects the latest turn's requests and cannot be used after a rejection without a new `input.requested` event; the proof checks durable `approval.candidate` rejection events and subsequent owner success instead.

## Production boundary and removal dependencies

Source analysis found deletion is registered through `tools/chatjs/tools.ts` and the installed dynamic resolver in `agent/tools/installed.ts`. The proxy is the browser ingress. There is no application route directly invoking `executeDocumentDeletion`; its other imports are its authored tool and unit tests. The request policy and receipt-protected executor now live privately in the authored `tool.ts`; only `deleteDocument` is exported. The old `execute.ts` is removed. Tests reach the authored definition. The owner receipt and every existing scope, revision, kind and abort check remain intact.

The existing DB mutation in `apps/chat/lib/db/eve-documents.ts` takes family/document advisory transaction locks, checks bound conversation ownership, checks the exact document revision and title, conditionally removes only that revision's head, and checks cancellation inside the transaction. Those checks must remain. The original fixture uses a bounded effect probe. The PostgreSQL tests below now exercise the actual mutation and schema.

Removal still needs Lane D to integrate a runtime that retains the other required fork capabilities while providing the native response/cancellation contract. Merely removing the deletion receipt on today's package would leave the accepted cancellation requirement unmet. Do not introduce a compatibility alias or conditional receipt bypass. Native `0.71.3` alone still lacks the other lanes' required contracts.

The follow-up below now covers the actual installed dynamic resolver and deletion source with disposable DB substitutes. The follow-up now consolidates the authored module and exercises stale revision/cancellation at the real PostgreSQL transaction gate. Final integrated runtime entry-point coverage remains required. The lower-level `invokeTool` experiment exercises the real implementation with a static compiled binding; ChatJS deletion is dynamically installed, and dynamic resolvers are not invoked by that out-of-turn API. The original HTTP fixture uses an authored static tool; the follow-up adds the actual ChatJS dynamic resolver. Neither exercises the Next.js app proxy. The serialized harness alone establishes neither worker restart nor PostgreSQL-world behavior; see the separate restart proof below.

Shared-harness needs are limited to D's pinned dependencies and runner. The lane fixture is self-contained and has no credentials, cloud models or external effects. For local fixture type checking, link this lane's ignored `node_modules` to D's isolated `node_modules`, then run `bunx --no-install tsc -p tests/eve-retirement-lane-a/tsconfig.json`.

`lint-exception-additions.json` contains only this lane's explicit scope fingerprints, generated by the existing `snapshotExceptions` API. D should review and merge these with the shared baseline after the lanes are integrated, then rerun `bun lint`. The shared baseline was not edited in this lane. No user product decision is required: retain the gate under the accepted design until the integration proofs pass.

## Follow-up: actual installed dynamic source

`dynamic/prepare.mjs` builds a disposable fixture by copying the current application sources, not by recreating the deletion definition. EVE compiles and invokes the actual `agent/tools/installed.ts` event resolver, `tools/chatjs/tools.ts` registry, `filterEveTools`, deletion tool definition, input schema, availability logic, `requestDocumentDeletion`, `executeDocumentDeletion`, and `resolveEveConversationScope`. Source hashes and the exact modified-file list are recorded in `source-provenance.json` in the prepared directory. Published 0.71.3 exposes the actual flat tool name `deleteDocument`; no static authored substitute is installed for it.

From the repository root, using D's shared harness after integration:

```sh
lane_a_fixture="$(bun tests/eve-retirement-lane-a/dynamic/prepare.mjs native-candidate)"
EVE_TEST_NODE=/opt/homebrew/opt/node@24/bin/node bun tests/eve-retirement-runtime/run.ts "$lane_a_fixture"
```

The preparer prints an **absolute** source-fixture directory. Substitute `unchanged` or `response-adapted` for the mode to reproduce the two blockers. D's runner makes a second disposable worker copy and cleans it on success; the prepared source directory remains available for provenance review. During lane work the runner was read from `/Users/fran/.codex/worktrees/e70d/chat-js/tests/eve-retirement-runtime/run.ts` without modifying that checkout.

| Mode | Changes confined to the disposable source copy | Result on published 0.71.3 |
| --- | --- | --- |
| `unchanged` | None of the copied app sources change | Request/scope/revision checks run; owner response authorization fails because production expects `responder`, not `response.principal`; zero deletions |
| `response-adapted` | Destructure `response.principal` into the existing local `responder` name | Foreign approve/cancel are rejected; owner approval reaches the actual executor, which fails with `Document deletion requires the owner's approval`; zero deletions |
| `native-candidate` | The same response adaptation, plus removal of the three-line owner-receipt check | Exact owner-approved input produces one disposable deletion; missing consent, foreign approve/cancel, changed revision, changed owner and owner cancellation produce none |

All three modes pass the evaluation assertions. The native candidate runs four sessions; the two baseline modes run one each. The tests check the exact request input, matching foreign-rejection events, effect counts, and evidence that the original scope/revision code reread the changed state. Request-time ownership and revision errors are emitted by the copied real application functions, not replacement approval policies. Both source transformations require exactly one textual match and fail if the production code drifts. The preparer never changes production sources, manifests, lockfiles, receipt adapters or shared harness files. The follow-up production consolidation described above is independent of these temporary transformations. The template type-check covers the authored fixture code; runtime compilation of copied app sources is not a complete production type migration (the copied context type still names the fork receipt).

The substituted boundaries are explicit: `lib/db/eve-queries.ts` supplies bound disposable mappings; `lib/db/eve-documents.ts` supplies document reads and a guarded effect journal; `lib/eve/server.ts` throws on any attempted external request; anonymous limits disable guest tools; unrelated registered tool implementations are inert definitions that throw if executed. Installed feature sets, custom registration, filtering, scope validation and deletion authoring remain real source copies. The model is deterministic, and D's worker allowlist supplies no live credentials. The DB substitute validates owner, input revision, exact input and abort signal before recording an effect; it is not a substitute for proving the production SQL transaction.

## Follow-up: real PostgreSQL mutation and worker restart

`postgres/deletion.test.ts` uses the actual `removeEveDocumentFromConversation`, Drizzle schema, application migrations, advisory locks and transactions against D's disposable `lane_a` database. Only the DB connection and unused environment initialization are substituted. Nine tests pass: exact revision removal with immutable revision retained and harmless retry; foreign owner, changed title, missing revision and deleting conversation rejected; pre-abort; rollback when cancellation occurs after DELETE dispatch; and cancellation/newer head while genuinely blocked on the family advisory lock. Cleanup removes only each test's UUID-owned fixtures and closes its clients, never the shared cluster.

```sh
EVE_RETIREMENT_POSTGRES_FILE=/absolute/path/to/connection.json bunx --no-install vitest run --config tests/eve-retirement-lane-a/postgres/vitest.config.ts
bunx --no-install tsc -p tests/eve-retirement-lane-a/postgres/tsconfig.json
```

`dynamic/restart.mjs` reuses D's `persistent-runtime.ts` and optional `postgres-fixture.ts` without modifying D's checkout. It runs the actual installed-resolver `native-candidate` source copy, restarts while approval is pending, then holds `approval.settled` before execution, checks that settlement is durable and no effect exists, restarts again and observes the exact owner/input effect once. Request, settlement and effect PID markers prove a different serving process at each boundary. A missing instrumentation insertion fails immediately. Pending/settled snapshots and dependency/source provenance are retained on failure. Successful runtime directories are removed.

```sh
lane_a_fixture=$(bun tests/eve-retirement-lane-a/dynamic/prepare.mjs native-candidate)
EVE_TEST_NODE=/absolute/path/to/node24 bun tests/eve-retirement-lane-a/dynamic/restart.mjs /absolute/path/to/D/tests/eve-retirement-runtime "$lane_a_fixture"
# Add D's disposable handoff as the final argument for PostgreSQL workflow storage:
EVE_TEST_NODE=/absolute/path/to/node24 bun tests/eve-retirement-lane-a/dynamic/restart.mjs /absolute/path/to/D/tests/eve-retirement-runtime "$lane_a_fixture" /absolute/path/to/connection.json
```

Both local-world and PostgreSQL-world restart runs pass on published EVE 0.71.3, Node 24.20.0, PostgreSQL 17.11 and ChatJS-patched world-postgres 5.0.0-beta.40. The helper used D commit `c7137b0c5` or newer, including the corrected detached-server cleanup. Test ownership lease is explicitly one second. **These runs kill the CLI and allow the detached server to shut down gracefully; they do not establish abrupt serving-process SIGKILL recovery or default-lease recovery.** D owns the forthcoming abrupt-crash helper. There is no command resend. The restart fixture's document effect remains disposable file-backed state; real SQL mutation is separately proved by the PostgreSQL integration tests, not combined into a full app proxy end-to-end run.

Production receipt removal still depends on the final integrated runtime retaining the other lanes' contracts and final ingress coverage. No package switch, receipt bypass or runtime patch is included here.

For D's exception integration, the refreshed `lint-exception-additions.json` includes original proofs, dynamic/restart and PostgreSQL fixtures, plus replacement snapshots for the two changed production files. Drop deleted `execute.ts` baseline entries and replace changed-file scopes during integration. Merge/review its lane-only entries against the final shared baseline after cherry-picking the follow-up; do not replace D's baseline wholesale. `bun lint` was rerun and still stops at this unmerged exception budget. Lane `oxlint`, template `tsc`, formatting and `bun test:types` pass. No additional product decision is needed.
