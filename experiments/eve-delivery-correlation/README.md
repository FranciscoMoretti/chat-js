# Lane C: exact received-message correlation

Production is unchanged; arbitrary metadata is still required. This is a local upstream patch and isolated proof, not a supported fork removal. Contract and consumer inventory: [proposal](../../docs/upstream-drafts/eve-caller-message-correlation.md).

## Baseline and reproduction

Exact release: eve **0.71.3**, source **fab8ba1424eddfdedd6a177cac21710258da0e81**, bundled Workflow **5.0.1** (serde **5.0.0**), AI SDK **7.0.106**, Node **24.20.0**, Bun **1.3.11**. Same target as Lane D commit `858d36fe8`. No main-only source. Root manifests, lockfile, shared adapters and parent checkout are untouched.

Run from repository root:

```sh
bun experiments/eve-delivery-correlation/setup.mjs
bun test experiments/eve-delivery-correlation/probe.test.mjs
CORRELATION_PATCHED=1 bun test experiments/eve-delivery-correlation/probe.test.mjs
EVE_TEST_NODE=/opt/homebrew/opt/node@24/bin/node bun experiments/eve-delivery-correlation/run-runtime.mjs
EVE_TEST_NODE=/opt/homebrew/opt/node@24/bin/node CORRELATION_PATCHED=1 bun experiments/eve-delivery-correlation/run-runtime.mjs
```

Setup creates separate stock/patched installations and a source checkout under ignored `apps/chat/.eve/lane-c-*`. It verifies the source commit, applies `runtime.patch`, and transpiles only changed runtime modules into the isolated patched package. Production and Lane D dependencies are never patched. The patch is deliberately experimental: this is not the upstream build/type-generation pipeline. Direct dependency versions are pinned; generated isolated Bun lockfiles are retained locally, not a new shared dependency contract.

The launcher follows Lane D's mock-model/disposable-local-world approach and keeps all writes inside this worktree. It gives the worker an environment allowlist, no application/provider credentials, and a nonexistent Docker socket. Every run gets fresh local storage and a loopback server. Successful fixtures are removed; failed evidence is retained with a printed path. `EVE_TEST_NODE` must name Node 24+.

## Proven results

| Proof | Stock | Experimental patch |
| --- | --- | --- |
| Module/contract tests | 5 passing, 11 assertions; missing token is expected | 7 passing, 23 assertions |
| Real HTTP worker evals | 2 passing counterexample scenarios | 2 passing positive scenarios |
| Creation and two identical follow-ups, proxy throws after HTTP 202 before mapping write | No caller tokens in durable events | Exact `create-a`, `follow-a`, `follow-b` tokens replayed |
| Two identical sends queued behind a deterministic tool barrier | One coalesced message, no tokens | One message with both IDs in contribution order |
| Unrelated events/another session | No invented correlation | No invented/inherited correlation |
| Queued admission held before materialization, then disposable worker shutdown | No received receipt | No received receipt; no automatic resend |
| Control-only coalescing, invalid tokens, model-history exclusion | Module checks | Module checks |
| Owner/session-scoped app projection; last selection is null; JSON reload | App-only proof | App-only proof |

The full worker proof uses real HTTP routes, admission, inbox/Workflow execution, the model/tool harness and durable event replay. Only model responses and the tool barrier are authored test fixtures. HTTP acceptance is not mocked. The proxy crash is an injected exception after the real acceptance response, before the test proxy can write its mapping. The mapping stays empty and dispatch count stays exactly three; there is no resend.

For creation, a **test oracle** privately observes the session ID to inspect native storage after the simulated proxy failure. That does not recover unknown session identity for the application. Fresh-client replay is tested; killing and restarting a worker against the same storage is not.

The queued non-materialization check holds the first model turn at a file barrier, confirms the queued send has no message receipt, then the launcher stops the disposable worker. It does not prove a durable terminal cancellation disposition or prevent future materialization if the same world is resumed. A reset experiment showed that a queued message can materialize before reset completes; reset is not used as evidence of non-receipt.

`projection.mjs` is a small application-owned contract example. It is not integrated persistence. `probe.test.mjs` calls real release/patched parsers, send/coalescing and emission modules with a test dispatcher; that layer alone is not durable admission proof.

## Integration status

- No production metadata consumer removed. No UI changed, so no visual-test scope.
- Existing delivery/tool-selection/proxy tests: 8 passing on Node 24 (3 files).
- `bun test:types`: passed, all 7 monorepo tasks from Turbo cache; isolated experimental files are not covered by that result.
- `bun lint`: ran; fails on the new isolated experiment's research/fixture code under the repository's strict production rules. No lint exceptions/baseline or shared config were changed. This is a review artifact, not merge-ready production code.
- Remaining gates: upstream supported contract/release, production immutable submission and annotation storage, old-history/copy migration, restart/Postgres proof, terminal cancellation disposition and independent creation allocation recovery.

No user decision is needed now. Retain the existing fork seam. Lane D can integrate the proof fixture and its lint/type policy when the contract is accepted; this lane does not alter D's shared harness.
