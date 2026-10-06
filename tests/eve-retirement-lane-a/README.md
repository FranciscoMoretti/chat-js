# Lane A: native deletion approval

**No production gate removed.** Published EVE `0.71.3` passes the native capability experiments below. The production alias `@chat-js/eve@0.61.0-chatjs.0` fails the foreign-cancellation requirement. Its authenticated cancellation bypasses `approval.response` and settles the owner's pending request. It does **not** execute a deletion in this counterexample. Keep deletion's receipt gate and MCP receipts intact pending integration; retaining the receipt does not itself repair cancellation.

The selected release is `eve@0.71.3`, source `fab8ba1424eddfdedd6a177cac21710258da0e81`, with AI SDK `7.0.106` and bundled Workflow `5.0.1` (serde `5.0.0`). Lane D owns the pin, installation lockfile and disposable-worker runner in `tests/eve-retirement-runtime`. No production manifest or lockfile changed here. Initial exploration used `0.71.2`; all acceptance results below were rerun on `0.71.3`.

## Run the proofs

After installing Lane D's isolated harness dependencies, from the repository root:

```sh
bun tests/eve-retirement-lane-a/native-deletion.proof.mjs tests/eve-retirement-runtime/node_modules/eve
EVE_TEST_NODE=/opt/homebrew/opt/node@24/bin/node bun tests/eve-retirement-runtime/run.ts ../eve-retirement-lane-a/fixture
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
| Native HTTP + local Workflow | 1 evaluation passes, 3 EVE gates plus Node assertions; two durable sessions |
| Existing deletion and MCP approval tests | 8/8 pass across two Vitest files |
| `bun test:types` | 7/7 workspace tasks pass, all Turbo cache hits; no production files changed |
| Lane fixture `tsc` | Pass against isolated `eve@0.71.3` |
| Lane `oxlint` and `oxfmt` | Pass |
| `bun lint` | Stops at the repository lint-exception budget: new isolated proof scopes are not in the shared baseline |

Verification host: Bun `1.3.11`; HTTP/Workflow worker uses Node `24.20.0`. The final native and fork summaries are respectively `{cases:26,failures:0}` and `{cases:24,failures:2}`.

The harness cases cover missing consent, owner approval after serialized continuation reload, foreign approval, foreign cancellation, owner cancellation with a late approval, unauthenticated approval, plain approval text, a wrong request ID, revision/owner changes and real turn-signal abortion during response authorization, a second identical call needing fresh consent, and native out-of-turn invocation. An owner out-of-turn call returns `approval-required`; a foreign one fails the fixture ownership gate; neither executes.

The HTTP fixture sends real authenticated owner/foreign responses, proves no `action.result` before owner consent, completes the original request after foreign approve and cancel were rejected, checks owner cancellation produces no completed tool, and reattaches a fresh client to replay durable events. The eval driver's `requireInputRequest()` only projects the latest turn's requests and cannot be used after a rejection without a new `input.requested` event; the proof checks durable `approval.candidate` rejection events and subsequent owner success instead.

## Production boundary and removal dependencies

Source analysis found deletion is registered through `tools/chatjs/tools.ts` and the installed dynamic resolver in `agent/tools/installed.ts`. The proxy is the browser ingress. There is no application route directly invoking `executeDocumentDeletion`; its other imports are its authored tool and unit tests. The current receipt-protected executor remains exported. Before a receipt-free version ships, move its request policy and executor into the authored tool module and make both private.

The existing DB mutation in `apps/chat/lib/db/eve-documents.ts` takes family/document advisory transaction locks, checks bound conversation ownership, checks the exact document revision and title, conditionally removes only that revision's head, and checks cancellation inside the transaction. Those checks must remain. This proof's mutable document state is a bounded effect probe, **not a real Postgres deletion proof**.

Removal still needs Lane D to integrate a runtime that retains the other required fork capabilities while providing the native response/cancellation contract. Merely removing the deletion receipt on today's package would leave the accepted cancellation requirement unmet. Do not introduce a compatibility alias or conditional receipt bypass. Native `0.71.3` alone still lacks the other lanes' required contracts.

At that integration point, run the actual consolidated authored deletion definition through the installed dynamic-tool path and a disposable ChatJS database. Cover stale revision and cancellation at the transaction gate, and verify all final runtime entry points. The lower-level `invokeTool` experiment exercises the real implementation with a static compiled binding; ChatJS deletion is dynamically installed, and dynamic resolvers are not invoked by that out-of-turn API. The HTTP fixture uses an authored static tool, not the ChatJS dynamic resolver or app proxy. Worker/process crash recovery around settlement and Postgres-world compatibility are not established by the serialized harness reload or client replay here.

Shared-harness needs are limited to D's pinned dependencies and runner. The lane fixture is self-contained and has no credentials, cloud models or external effects. For local fixture type checking, link this lane's ignored `node_modules` to D's isolated `node_modules`, then run `bunx --no-install tsc -p tests/eve-retirement-lane-a/tsconfig.json`.

`lint-exception-additions.json` contains only this lane's explicit scope fingerprints, generated by the existing `snapshotExceptions` API. D should review and merge these with the shared baseline after the lanes are integrated, then rerun `bun lint`. The shared baseline was not edited in this lane. No user product decision is required: retain the gate under the accepted design until the integration proofs pass.
