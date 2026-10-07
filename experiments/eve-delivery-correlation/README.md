# Lane C: exact received-message correlation

Production is unchanged; arbitrary metadata is still required. This is a local upstream patch and isolated proof, not a supported fork removal. Contract and consumer inventory: [proposal](../../docs/upstream-drafts/eve-caller-message-correlation.md).

## Baseline and reproduction

Exact release: eve **0.71.3**, source **fab8ba1424eddfdedd6a177cac21710258da0e81**, bundled Workflow **5.0.1** (serde **5.0.0**), AI SDK **7.0.106**, Node **24.20.0**, Bun **1.3.11**. Same target as Lane D baseline `858d36fe8`; restart controller copied unchanged from `7a312a544`. No main-only source. Root manifests, lockfile, shared adapters and parent checkout are untouched.

Run from repository root:

```sh
bun experiments/eve-delivery-correlation/setup.ts
# Supply Lane D’s shared harness directory (at commit 7a312a544).
bun experiments/eve-delivery-correlation/setup-shared.ts /Users/fran/.codex/worktrees/e70d/chat-js/tests/eve-retirement-runtime
bunx --no-install tsc --noEmit -p experiments/eve-delivery-correlation/tsconfig.json
bunx --no-install oxlint experiments/eve-delivery-correlation
bun test experiments/eve-delivery-correlation/probe.test.ts
CORRELATION_PATCHED=1 bun test experiments/eve-delivery-correlation/probe.test.ts
EVE_TEST_NODE=/opt/homebrew/opt/node@24/bin/node bun experiments/eve-delivery-correlation/run-runtime.ts
EVE_TEST_NODE=/opt/homebrew/opt/node@24/bin/node CORRELATION_PATCHED=1 bun experiments/eve-delivery-correlation/run-runtime.ts
EVE_TEST_NODE=/opt/homebrew/opt/node@24/bin/node bun experiments/eve-delivery-correlation/restart.ts
EVE_TEST_NODE=/opt/homebrew/opt/node@24/bin/node CORRELATION_PATCHED=1 bun experiments/eve-delivery-correlation/restart.ts
```

`setup-shared.ts` validates SHA-256 hashes of both unchanged controller files from D commit `7a312a5448fb88403897217b3998cd0b775ee5c2` before copying them, and records the commit/hashes in the ignored `controller-provenance.json`.

Setup creates separate stock/patched installations and a source checkout under ignored `apps/chat/.eve/lane-c-*`. It verifies the source commit, applies `runtime.patch`, and transpiles only changed runtime modules into the isolated patched package. Production and Lane D dependencies are never patched. The patch is deliberately experimental: this is not the upstream build/type-generation pipeline. Direct dependency versions are pinned; generated isolated Bun lockfiles are retained locally, not a new shared dependency contract.

The eval launcher follows Lane D's mock-model/disposable-local-world approach and keeps its writes inside this worktree. The unchanged shared restart controller owns a fresh OS temporary world; it never alters D's checkout. It gives the worker an environment allowlist, no application/provider credentials, and a nonexistent Docker socket. Every run gets fresh local storage and a loopback server. Successful fixtures are removed; failed evidence is retained with a printed path. `EVE_TEST_NODE` must name Node 24+.

## Proven results

| Proof | Stock | Experimental patch |
| --- | --- | --- |
| Module/contract tests | 5 passing, 11 assertions; missing token is expected | 7 passing, 23 assertions |
| Real HTTP worker evals | 2 passing counterexample scenarios | 2 passing positive scenarios |
| Completed-world SIGKILL/restart with lost follow-up response | Same durable events, no caller tokens | Same events with `create-restart` and `lost-restart`; no resend |
| Creation and two identical follow-ups, proxy throws after HTTP 202 before mapping write | No caller tokens in durable events | Exact `create-a`, `follow-a`, `follow-b` tokens replayed |
| Two identical sends queued behind a deterministic tool barrier | One coalesced message, no tokens | One message with both IDs in contribution order |
| Unrelated events/another session | No invented correlation | No invented/inherited correlation |
| Queued admission held before materialization, then disposable worker shutdown | No received receipt | No received receipt; no automatic resend |
| Control-only coalescing, invalid tokens, model-history exclusion | Module checks | Module checks |
| Owner/session-scoped app projection; last selection is null; JSON reload | App-only proof | App-only proof |

The full worker proof uses real HTTP routes, admission, inbox/Workflow execution, the model/tool harness and durable event replay. Only model responses and the tool barrier are authored test fixtures. HTTP acceptance is not mocked. The proxy crash is an injected exception after the real acceptance response, before the test proxy can write its mapping. The mapping stays empty and dispatch count stays exactly three; there is no resend.

For creation, a **test oracle** privately observes the session ID to inspect native storage after the simulated proxy failure. That does not recover unknown session identity for the application. The separate `restart.ts` proof uses a legitimately known session ID. It injects response loss for one follow-up after real HTTP 202, waits for two completed turns, SIGKILLs the process group, and restarts the same local world with `eve dev --resume`. The corrected controller waits for detached-server state cleanup before restart. The proof also queries a fixture-only HTTP process-identity endpoint before and after, asserts distinct serving-process PIDs, and verifies the old state file is absent after crash. The entire native event snapshot is identical before and after restart, including creation/follow-up tokens on the experimental runtime. The mapping stays empty and exactly one follow-up dispatch occurs. This proves completed-world restart replay, not crash recovery of a partially committed running step.

Corrected-controller rerun on 6 October 2026: stock **84516 → 84771**, experimental **84470 → 84706**; both commands exited 0. These replace the earlier `422e371e3` controller results, which did not rule out reuse of the detached server. Only the two restart proofs and affected isolated types/lint/exception snapshot were rerun for this correction.

The queued non-materialization check holds the first model turn at a file barrier, confirms the queued send has no message receipt, then the launcher stops the disposable worker. It does not prove a durable terminal cancellation disposition or prevent future materialization if the same world is resumed. A reset experiment showed that a queued message can materialize before reset completes; reset is not used as evidence of non-receipt.

`projection.ts` is a small application-owned contract example. It is not integrated persistence. `probe.test.ts` calls real release/patched parsers, send/coalescing and emission modules with a test dispatcher; that layer alone is not durable admission proof.

## Integration status

- No production metadata consumer removed. No UI changed, so no visual-test scope.
- Existing delivery/tool-selection/proxy tests: 8 passing on Node 24 (3 files).
- `bun test:types`: passed, all 7 monorepo tasks from Turbo cache; isolated experimental files are not covered by that result.
- Explicit `tsc --noEmit -p experiments/eve-delivery-correlation/tsconfig.json`: passed. It includes launchers, module probes and compiled HTTP fixtures; experimental fields are schema-validated against the released SDK.
- Targeted `oxlint experiments/eve-delivery-correlation`: passed. No unsafe-type waivers. Required EVE default exports, Node/process boundaries, ordered tests and SDK callbacks have statement-scoped reasons.
- `lint-exception-additions.json`: 46 rule/directive records, no missing reasons, exported with `snapshotExceptions` for D. The shared baseline/config remains untouched. `bun lint` stops at these not-yet-integrated budget additions; D owns reviewing and merging them.
- Running `ultracite check .` independently of the budget gate reaches only seven errors in unchanged `scripts/vercel-preview-build.ts:127–137`, matching D’s baseline attribution. No new Lane C lint errors remain.
- Remaining gates: upstream supported contract/release, production immutable submission and annotation storage, old-history/copy migration, in-flight restart/Postgres proof, terminal cancellation disposition and independent creation allocation recovery.

No user decision is needed now. Retain the existing fork seam. Lane D can integrate these reviewable proofs and the reviewed exception-budget additions independently of upstream acceptance. This lane does not alter D’s shared harness.

## Application migration and additional runtime proofs

See `docs/eve-submission-journal.md` for the implemented immutable submission journal, app annotation projection, authenticated status read, preserved metadata/creation seams, and database/browser gates.

Additional isolated commands (run from the repository root):

```sh
EVE_TEST_NODE=/opt/homebrew/opt/node@24/bin/node bun experiments/eve-delivery-correlation/creation-lookup.ts
EVE_TEST_NODE=/opt/homebrew/opt/node@24/bin/node bun experiments/eve-delivery-correlation/cancellation.ts
bun experiments/eve-delivery-correlation/setup-postgres.ts /absolute/D/tests/eve-retirement-runtime
EVE_TEST_NODE=/opt/homebrew/opt/node@24/bin/node bun experiments/eve-delivery-correlation/postgres-restart.ts /absolute/disposable/connection.json
```

Postgres setup uses D controller commit `49385ae69` and records copied file hashes in `.eve/lane-c-pg-shared/controller-provenance.json`. It uses only lane_c, validated by D's preparer. PostgreSQL 17.11 / patched world-postgres 5.0.0-beta.40 / bundled Workflow 5.0.1 / eve 0.71.3. It does not mutate the original isolated EVE installation or shared database locks. The optional controller serving-PID argument verifies that the killed server belongs to its CLI.

Observed results:

- Creation: two same-operation POSTs reused `wrun_01M4BYF4W890S91C6KPYDSHQY6`. After terminal reset, the same POST allocated `wrun_01M4BYF5CZF6CZ6SBRCE7G4X2Y`. The immutable allocation lookup remains a separate requirement; live-session create replay exists.
- Cancellation: a held turn accepted a queued message, then emitted `turn.cancelled`; the queued message subsequently emitted its own correlated receipt and completed. There was no follow-up resend. Cancel does not prove queued non-admission.
- PG graceful shutdown boundary: PIDs 49406 → 49797; one queued dispatch survived restart. Initial input was also replay-appended under a new native event ID. App receipt and logical-node regressions cover that shape.
- PG abrupt boundary: corrected controller killed serving PID 57046, completed cleanup and launched worker2. No queued receipt within 15 seconds; root `wrun_01M4BYHPQDC5BTDD250VMEQW1K` remained running. Read-only SQL found jobs 46/49 locked to dead workers. No artificial lock aging/unlocking was done. The proof currently fails this bounded liveness assertion, and is not claimed as a pass. D owns separate supported operator recovery.
- Earlier abrupt attempt with the pre-fix controller timed out in its shutdown record wait; it is harness-only evidence, superseded for runtime interpretation by the corrected attempt.

The proof has no claim about native/public-copy duplicate-history elimination, exactly-once effects, production package switching, or automatic resend.
