# Native approval receipts consumed by ChatJS

This separate proof slice executes the **actual** ChatJS MCP and deletion request and execution functions with native eve 0.80.1 approval contexts. Five scenarios pass. It does not make the real ChatJS agents compile: the exact-candidate checkpoint still has copy/projection and other blockers.

Based independently on ChatJS main `c0ab1c0504bb3da73ca0f3625f66c47bf69e042e` (including dependency #847). No production source or package pin changes. The fork evidence slice stacks after streaming #10; this app proof has no dependency on the streaming companion #848.

## Boundary executed

A real native backend parks a tool for approval and accepts an authenticated response. Its authored request/execute callbacks call a disposable localhost HTTP bridge. That bridge invokes `requestEveMcpApproval`, `executeEveMcpTool`, `requestDocumentDeletion` and `executeDocumentDeletion` from the actual app files. The backend supplies session, call, validated input and native receipt fields. Positive consent is not fabricated by the test. Recorded request/execution call IDs and input match for the approved MCP invocation.

The bridge parses serialized identities and reconstructs an AbortSignal. It does not transfer credential capabilities, function closures or workflow context. Database lookup/persistence, conversation binding and remote MCP SDK clients are fixture adapters. Atomic database deletion, real connector credentials, production OAuth and cancellation propagation are not proven here.

Five real-runtime scenarios cover:

- A foreign MCP responder cannot execute; subsequent owner approval executes once with the native owner receipt and original input/call identity.
- A connector transferred to another owner while pending is rejected by the actual current-policy consumer before a remote effect.
- Policy tightened immediately after a no-approval request rejects execution without an owner receipt, even though the requester is the owner.
- The actual deletion consumer accepts native owner consent for the exact document, title and expected revision, passing owned scope to the persistence adapter.
- A document revision changed while pending is rejected by the actual request consumer on native recheck; no successful removal occurs.

`AUDIT.json` records native request/execution contexts and the expected consumer errors. The existing accepted 15 runtime +3 boundary proof is not rerun wholesale. It remains the separate evidence for restart, exact parked bindings and the broader native approval state machine; these five cases add real consumer coverage.

## Minimal candidate adaptation

Native response policy identity is **`response.principal`**. Native execution consent remains **`approval.responder`**. `auth` is a separate capability surface; it is not the responder principal. Never substitute the original requester.

`candidate-response-policy.patch` is a reviewable two-file adaptation for the native candidate only. It changes the MCP/deletion response-policy accessor and types, preserving the same owner comparison and execution consumers. It is not applied to the maintained 0.61 application. The authored proof uses the equivalent native policy; it does not claim to execute the entire production dynamic catalog.

Applied only to the disposable exact #9/current-main compiler fixture, the patch reduces authenticated diagnostics from56 to49. All seven diagnostics in MCP tool registration/deletion definitions disappear, including overload-inference cascades. The full compiler remains red. `candidate-adapter-results.json` and the remaining output record this result against #9 `aab691297a59cc8c325b8f8c584a472495aed9ce`.

Native `approval` exposes the responder, not the fork's public `requestId`. These actual consumers require the responder only; native parked-call binding supplies exact consent internally. The proof initially required the old requestId shape and caught that mismatch. Removing the unused fixture requirement made the positive native consent paths pass; no runtime implementation was weakened.

## Reproduce and validation

```sh
bun install --frozen-lockfile --ignore-scripts
bun install --cwd experiments/eve080-approval-consumers --frozen-lockfile --ignore-scripts
/path/to/node24 experiments/eve080-approval-consumers/proof.mjs
```

The explicit Vitest config keeps real subprocess/HTTP scenarios out of the ordinary unit suite. The fixture uses a deterministic model, an ephemeral port and disposable local world. It stops the backend and bridge; no live environment or database is used.

For the candidate patch check, first run the exact-candidate compiler probe from `codex/eve080-candidate-verification` to produce a fresh temporary fixture. Then:

```sh
python3 experiments/eve080-approval-consumers/check-adapter.py /path/to/compiler-results.json /path/to/node24
```

Five scenarios, full workspace lint and eight current-pin type tasks pass. The candidate adapter check intentionally remains red with49 unrelated diagnostics. Full app startup/send/cancel/copy/attachment/sandbox flows remain blocked. No credential/getToken or workflow-context equivalence, billing import, old-session continuity, release or deployment is claimed.
