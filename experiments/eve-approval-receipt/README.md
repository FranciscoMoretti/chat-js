# Lane B — conditional MCP receipt experiment

The executable policy-flip counterexample demonstrates why ChatJS must retain its final receipt gate. The experimental receipt patch passes the local cases below, but **does not remove a fork dependency**. Production MCP adapters are unchanged.

Worktree: `/Users/fran/.codex/worktrees/5509/chat-js`. Read-only design inputs came from `/Users/fran/Code/chat-js/docs/`; EVE modifications were confined to disposable clones. Initial working clone: `/tmp/chatjs-lane-b-eve`.

## Reproduce

Requires Git, Python 3, Bun and Node. Run from the ChatJS worktree:

```sh
bash experiments/eve-approval-receipt/run.sh /tmp/chatjs-eve-retirement.pMZEkL/eve
```

Omit the argument to clone the upstream GitHub repository instead. The runner creates and retains a new temporary clone, pins the source commit, installs dependencies using Bun, runs the unmodified-release counterexample first, applies the experimental receipt patch, runs its proofs, then launches three separate test processes around serialized checkpoints. It never edits ChatJS manifests, lockfile, production code or the parent checkout. EVE's compiled dependency vendoring is needed to run source modules; this is not a ChatJS production build.

The dedicated Vitest config aliases source imports and generated vendor modules. It omits the upstream Workflow compiler plugin because these tests exercise EVE's tool loop and approval coordinator directly. Only the mock language model, effect spy and workflow attribute emitter are substituted; approval arbitration, input resolution, tool loop, AI SDK execution, auth wrapper and receipt projection run real code.

## Version evidence

| Component | Executed version |
| --- | --- |
| EVE source | 0.71.2 / `143fe5717aa8a77d64185c00d1dbb363f307882f` |
| Fork receipt source used as reference | `3a7acfe6ba42a8dc9d330132b11856962a675705` |
| AI SDK | 7.0.128 |
| AI SDK provider / provider-utils | 4.0.22 / 5.0.54 |
| Workflow core / local world packages | 5.0.1 / 5.0.1 |
| Vitest | 5.0.2 |
| Bun / Node | 1.3.11 / 26.9.0 |

This is a provisional source baseline pending Lane D's shared dependency/harness pin. Workflow packages are installed/vendored; the checkpoint proof does not run the Workflow persistence engine. The runner pins the AI SDK versions used above. Other source dependencies retain upstream catalog constraints, so it is not a frozen transitive dependency lock. Lane D must supply the shared reproducible dependency set before integration.

## Proof results

| Proof | Result and boundary |
| --- | --- |
| Request policy false → true before effect | Stock release: effect occurs when final gate is removed; zero effects with missing-receipt gate retained. Two assertions pass. |
| Owner approve/cancel; foreign approve/cancel | Real tool-loop continuation: only owner approval executes. Cancellation and rejected foreign responses cause zero effects. |
| Same ID, foreign issuer | Response policy rejects; zero settlements/effects. |
| Competing approve/cancel, both orders | First settlement wins; loser is stale; cancellation winner never executes. |
| Call/tool/input/session mismatch | Private runtime receipt projection returns no receipt. |
| Missing settlement, cancelled settlement, duplicate call, historical-only evidence | No receipt. |
| Another callback / fresh context | Receipt cannot be reused or inherited. |
| New harness step that parks early | Clears leftover receipt authority. |
| Immutable input/responder capture | Caller mutation cannot change captured action; key ordering does not change structural identity. |
| Abort with an exact receipt | Auth wrapper delivers receipt; executor abort check prevents effect. |
| Restart before settlement | Process 1 saves an actual candidate with zero effects; process 2 restores it and runs EVE's coordinator to settlement. |
| Restart after settlement | Process 3 restores the winning settlement and pending action, then EVE's tool loop reconstructs owner receipt and executes once. |

Commands in the isolated EVE `packages/eve` directory:

```sh
bun x vitest run --config vitest.lane-b.config.ts src/harness/counterexample.lane-b.integration.test.ts
bun x vitest run --config vitest.lane-b.config.ts
# The runner supplies one disposable checkpoint path to three separate processes:
LANE_B_CHECKPOINT=/tmp/example-checkpoint.json LANE_B_PHASE=ingest bun x vitest run --config vitest.lane-b.config.ts -t 'process checkpoint'
LANE_B_CHECKPOINT=/tmp/example-checkpoint.json LANE_B_PHASE=settle bun x vitest run --config vitest.lane-b.config.ts -t 'process checkpoint'
LANE_B_CHECKPOINT=/tmp/example-checkpoint.json LANE_B_PHASE=execute bun x vitest run --config vitest.lane-b.config.ts -t 'process checkpoint'
```

Expected results: stock counterexample **2 passed**; patched suite **22 passed, 1 skipped** (the opt-in checkpoint case); each checkpoint process **1 passed**. These checkpoints persist EVE session state as JSON and intentionally terminate processes between phases. They demonstrate reconstruction by real EVE modules, not database atomicity, Workflow step persistence, process death during commit or exactly-once remote effects.

Repository checks attempted in the ChatJS worktree:

- `bun lint`: blocked in existing `scripts/lint-exceptions.ts:39` because `ts.ScriptTarget` is undefined with this worktree's incomplete dependencies.
- `bun test:types`: blocked because `turbo` is not installed in this worktree.

No application code, UI or shared dependencies changed. Existing `apps/chat/lib/eve/mcp-tools.test.ts` already covers the application's policy flip; this lane adds the missing runtime experiment rather than duplicating that mocked adapter test.

## Shared harness requirements and remaining work

Lane D owns the final release/dependency pin and production harness. Provide the following before claiming removal:

- A source/published-package baseline with exact AI SDK and Workflow versions, compiled vendor output and disposable persistent Workflow world.
- Authenticated response ingress and deterministic competing candidates, with checkpoints before/after settlement and actual world restart/commit failure injection.
- Compiled dynamically discovered MCP tools with persisted callback closures: swapping a connector/tool behind a reused name must not transfer authority.
- Actual parsed-input behavior, including schema defaults/coercions/transforms. The experiment fails closed on unequal request/executor values but does not establish the complete parsing contract.
- Cancellation and terminal-continuation paths through the public runtime; parallel sibling calls; supported retry/replay after callback-context construction and failure.
- A supported EVE receipt property satisfying the proposal, followed by ChatJS adapter and full repository checks against that release.

Upstream dependency: EVE 0.71.2 has no public ordinary-tool approval receipt. The experiment does not make it supported. No user decision is required to keep the adapter; the accepted decision already requires that. Publishing the local proposal would require a separate explicit instruction.
