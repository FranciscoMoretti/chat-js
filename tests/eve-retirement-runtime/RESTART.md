# Persistent Workflow restart controller

The controller uses the same pinned EVE `0.71.3` / AI SDK `7.0.106` installation as the baseline smoke proof. Node 24+ is required. It compiles authored fixtures through the real EVE development server; it does not alias source modules, mock Workflow, serialize a hand-built session snapshot or mutate world records.

## Feature-fixture interface

Import `createPersistentRuntime` and, optionally, the bounded evidence poller `until` from `persistent-runtime.ts`. Supply an absolute fixture source directory. The source needs an authored agent, instructions and an HTTP channel. No eval config is required for this controller.

```ts
const runtime = await createPersistentRuntime("/absolute/path/to/fixture");
try {
  await runtime.start();
  // Use eve/client or HTTP against runtime.url; save the known session ID.
  await runtime.waitForMarker("candidate");
  await runtime.crash();
  await runtime.release("candidate");
  await runtime.start();
  // Reattach the same session. Do not resend the admitted command.
} finally {
  await runtime.crash(); // Keep evidence on failure.
}
// Call runtime.remove() only after all assertions pass.
```

| Member | Contract |
| --- | --- |
| `directory` | Fresh temporary app root. Holds authored source, runtime logs, provenance, fixture effects and `.eve/.workflow-data`. |
| `url` | Fixed loopback URL for this fixture across restarts. A free port is reserved then released before EVE binds; external port contention can fail startup. |
| `start()` | Starts `eve dev --resume --no-ui --no-default-extensions`, waits for health, preserves `.eve` generation bundles and world storage. Rejects if already running. |
| `crash()` | Sends SIGKILL to the CLI process group, waits for CLI exit and removal of `.eve/dev-server-state.v1.json` after the detached server closes on IPC disconnect. This is CLI death followed by server cleanup, not direct server SIGKILL. Unix/macOS process-group support is required. Does not clear world files or resubmit any delivery. |
| `waitForMarker(name, timeoutMs = 60000)` | Waits for `<directory>/<name>.json`, parses JSON and returns `unknown`. Does not interpret a marker as an EVE authority receipt. |
| `release(name)` | Writes `<directory>/<name>.release` for an authored barrier to observe, including after restart. |
| `remove()` | Stops the process and removes this fixture/storage. |
| `until(probe, timeoutMs = 60000)` | Polls every 100ms; `undefined` means not ready. Use only evidence reads, never send/retry commands inside the probe. |

`restart-fixture/control.ts` is a small barrier example. It atomically renames marker JSON before waiting for its release file. Feature fixtures can copy/adapt it locally. Use unique marker names for repeated callbacks; delete neither world records nor generation bundles to make a test pass. Keep all effect ledgers in the fixture directory. A barrier file demonstrates callback reachability, not commit atomicity.

## Experimental installations

B/C must not patch the shared installation. A separate installation can be supplied explicitly:

```ts
const runtime = await createPersistentRuntime("/absolute/path/to/fixture", {
  nodeModules: "/absolute/path/to/isolated-patched/node_modules",
  provenance: "experimental correlation patch <commit/hash>, based on fab8ba14",
});
```

The alternate directory must expose runnable `eve@0.71.3` and `ai@7.0.106`, including EVE's compiler/vendor artifacts and the fixture's other dependencies. `runtime-provenance.json` labels any alternate installation **experimental** and records its supplied provenance, installation path and Node version. Package version validation is not proof that its bytes match the published artifact; lanes must retain the exact patch/build evidence and lockfile. This interface does not adopt the supplied package into ChatJS or establish upstream support.

## Executable proofs and known failures

```sh
bun install --cwd tests/eve-retirement-runtime --frozen-lockfile
EVE_TEST_NODE=/opt/homebrew/opt/node@24/bin/node bun run --cwd tests/eve-retirement-runtime test
EVE_TEST_NODE=/opt/homebrew/opt/node@24/bin/node bun run --cwd tests/eve-retirement-runtime test:restart
# Dynamic-identity acceptance probe deliberately fails on the stock baseline:
EVE_TEST_NODE=/opt/homebrew/opt/node@24/bin/node bun run --cwd tests/eve-retirement-runtime test:restart --swap-connector
# Callback restart uses an explicit one-second test ownership lease:
EVE_TEST_NODE=/opt/homebrew/opt/node@24/bin/node bun run --cwd tests/eve-retirement-runtime test:restart --callbacks
```

The default restart proof parks a compiled dynamic tool at approval, kills the process, resumes the same Workflow world, submits one owner response, and checks the execution identity, call/session, parsed input and one observed effect. The input starts as `{ amount: "7" }`; Zod coercion, default and transform produce `{ amount: 7, label: "default" }` both in the approval request and executor. This passes for the unchanged connector. It covers this concrete schema, not every transform/refinement or a schema changed while approval is pending.

The `--swap-connector` probe changes `connector.txt` from `original` to `replacement` while approval is pending, then restarts. On stock 0.71.3, the same tool name/call/input executes with **replacement** connector identity. The exact-identity assertion fails and retains evidence. This is a concrete counterexample to treating those visible identifiers as a frozen dynamic callback/connector binding. It is not a claim that the released API promises such a binding.

The `--callbacks` probe submits approval once, stops at the response-policy barrier before it returns allowed, restarts, then stops at the `approval.settled` hook before the effect and restarts again. It now passes with distinct process IDs across boundaries and one observed effect. It explicitly uses `WORKFLOW_INLINE_OWNERSHIP_LEASE_SECONDS=1`; the controller records this in `recovery-policy.json`. The third launcher argument accepts `{ inlineOwnershipLeaseSeconds: 1 }` for isolated recovery experiments. Omit it to retain runtime defaults; `--callbacks --default-lease` reproduces the original lease selection.

The earlier 60-second timeout is **not a stock-runtime recovery counterexample**. Bundled Workflow defaults to an 860-second inline ownership lease, so the bounded wait was too short. The original controller also waited only for CLI exit, while EVE's detached server closes asynchronously on IPC disconnect. Releasing barriers immediately could let the old server continue. A lease-only rerun observed four effects and was rejected; adding the server-state removal wait made the probe pass without weakening the one-effect assertion. The one-second lease is test-only and does not establish safe production multi-instance settings.

Lane B's final `19a4035fb` runner already sets the lease to one second and waits for the same server-state removal. Its later crash barrier is inside the executor after receipt-context construction; D's is earlier, inside the settlement hook. B's experimental receipt success and D's original timeout therefore used different controls and boundaries. Neither establishes exactly-once effects or production/old-run compatibility. Source evidence at EVE `fab8ba14`: `cli/dev/local-server-process.ts` creates a detached server; `local-server-child.ts` closes it on IPC disconnect; `internal/nitro/host/dev-server-state.ts` removes the URL record after listener stop. The record is not an ownership lock. Bundled Workflow's `getInlineOwnershipLeaseSeconds` defaults to 860 (range 1–900).

The marker after `approval.settled` lies inside an in-flight runtime step. The hook's event is durably accepted before hook execution, but this does not establish that the enclosing Workflow step's completion committed. No fsync/torn-write, explicit database commit failure, Postgres, production-server, multiple-replica, or exactly-once external-effect proof is supplied. Feature lanes must still add competing-candidate, cancellation, sibling-call and effect-retry coverage specific to their contract.

Failed runs retain `worker-N.log`, `runtime-provenance.json`, `snapshot.json`, marker/effect files, and real `.eve/.workflow-data` records. Successful runs dispose the directory. The driver never automatically resends a delivery.

## Verification of the shared support change

- Original smoke command: PASS, one eval/four EVE gates.
- `test:restart`: PASS, real parked-approval process restart with unchanged dynamic identity and parsed-input assertions.
- `test:restart --swap-connector`: FAIL as an acceptance counterexample; the executor observed `replacement` instead of `original`.
- `test:restart --callbacks`: PASS after correcting lease selection and detached-server shutdown ordering; distinct process IDs and one observed effect.
- `bun run --cwd tests/eve-retirement-runtime test:types` and targeted Oxlint: PASS.
- `bun test:types`: PASS, seven tasks (cached).
- `bun lint`: the same seven existing preview-build Postgres type-resolution errors, independently reproduced on unchanged source; see the integration plan. The shared exception budget and repository formatting pass.

The dynamic-identity failing command is an opt-in proof probe, not silently skipped or converted to passing regression tests. It retains storage and returns nonzero for the feature lanes to diagnose against an experimental/supported replacement.
