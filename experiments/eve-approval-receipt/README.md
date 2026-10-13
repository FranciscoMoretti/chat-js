# Lane B — conditional MCP receipt experiment

Final baseline: **published EVE 0.71.3**, source `fab8ba1424eddfdedd6a177cac21710258da0e81`, selected by Lane D. The real Workflow restart, compiled dynamic identity and parsed-input proofs now run against that baseline. **This does not remove a fork dependency.** ChatJS's production adapter is unchanged.

Worktree: `/Users/fran/.codex/worktrees/5509/chat-js`, branch `codex/eve-mcp-receipt-proof`. The earlier `135c8a8f1` commit contains the provisional 0.71.2 experiment. This revision supersedes its final-baseline and missing-runtime-proof limitations.

The [13 October typed migration and final validation](TYPED-VALIDATION-2026-10-13.md) supersede the earlier blocked maintenance audit. All B-authored materialized files and added upstream lines now pass the current type-aware lint policy. PG crash recovery and old-run replay remain separate runtime blockers.

## Reproduce the published-runtime proof

Use Lane D's frozen harness manifest and lockfile read-only. The runner copies both into a fresh temporary package, installs with Bun, and starts the real EVE CLI with bundled Workflow local-world storage and compiled authored tools. It first tests the stock published package, then applies the experimental source patch to an isolated package copy and repeats the same scenarios.

```sh
EVE_TEST_NODE=/opt/homebrew/opt/node@24/bin/node \
  bash experiments/eve-approval-receipt/run-runtime.sh \
  /Users/fran/.codex/worktrees/e70d/chat-js/tests/eve-retirement-runtime \
  /tmp/chatjs-lane-b-0713
```

Omit the final argument to clone upstream instead of the available read-only source repository. Both paths check out the exact source SHA. The runner requires Node 24.20.0. No shared manifest, lockfile, parent checkout, production adapter, provider credentials or remote service is modified.

`runtime-fixture.patch` contains the typed Node scenario runner, typed Postgres/old-run controllers, shared validated evidence contracts, three boundary tests, and EVE fixture. The launcher type-checks these files and runs the boundary tests before starting scenarios. Node 24 executes `runtime-proof.ts` using native type stripping. These are external-runtime fixtures, materialized in the isolated package rather than installed as ChatJS application modules. The launcher retains storage, entry/effect evidence and `proof-results.json` in the printed temporary directory. It allows 180 seconds per mode and stops workers on failure. Auth is fixture-owned; the effect is an append-only disposable file. Approval settlement, HTTP ingress, tool compilation, dynamic callback restoration, AI SDK execution and Workflow storage/recovery are real.

The patched mode replaces only four isolated published distribution modules with transpiled source: receipt projection, auth wrapper, tool loop, and tool dispatch. Atomic file replacement avoids modifying package-manager hardlinks. This is an experimental package, **not** an upstream release. Other published modules and bundled Workflow stay unchanged.

## Executed versions

| Component | Exact version |
| --- | --- |
| Published EVE / source | 0.71.3 / `fab8ba1424eddfdedd6a177cac21710258da0e81` |
| Workflow core/errors/world/local/vercel; serde | 5.0.1; 5.0.0 |
| AI SDK | 7.0.106 |
| AI SDK provider / provider-utils | 4.0.17 / 5.0.44 |
| Node / Bun | 24.20.0 / 1.3.11 |
| Source-suite Vitest | 5.0.2 |
| Published-fixture Zod | 4.3.6 |

Published-runtime dependencies use Lane D commit `858d36fe8`'s frozen lockfile. The supplemental source suite uses upstream source dependencies with the AI SDK versions pinned explicitly; it is not a replacement for that frozen published-package proof.

## Published-runtime results

Both stock and patched modes pass ten scenarios, each with explicit assertions:

| Scenario | Stock 0.71.3 | Experimental patch |
| --- | --- | --- |
| `invokeTool`: required policy, false→true policy flip, dynamic tool name | Required returns `approval-required`; flip reaches the owner caller but missing consent blocks effect; dynamic name is unavailable. | Same; no fabricated receipt for out-of-turn execution. |
| Conversation policy flips false→true between request and executor | Owner caller exists but receipt is absent; zero effects. | Same. |
| Kill server before human response, then `--resume` from the same Workflow storage | Restores exact parsed input and original unchanged connector; receipt absent, zero effects. | Restores exact owner receipt and executes once in this bounded fixture. |
| Kill while approval is pending, replace connector behind the same `step.started` tool name, then approve | Replacement is discovered; missing receipt blocks effect. | Executes only the original bound connector, parsed input and output projection; the replacement receives no old consent. |
| Captured message history changes during approval | Uses rediscovered history; no receipt. | Preserves original history and consent. |
| New same-name call after replacement/schema change | Fresh discovery; no receipt. | Fresh connector/schema and a separate approval, never old consent. |
| Current owner changes or connector becomes disabled | Zero effects. | Zero new effects despite settled consent. |
| Owner cancellation | Zero new effects. | Zero new effects. |
| Kill after response candidate ingestion while authorizer is paused, before settlement; restart without resending | Durable candidate resumes; caller remains owner but no receipt/effect. | Authorizer resumes in a new process, settles the original request and supplies its receipt before the effect. |
| Kill after settlement and executor entry, before effect; restart with `--resume` | Replays in a different PID; owner caller still has no receipt, zero effects. | Replays in a different PID with the same request receipt, exact parsed input and connector, then performs the effect. |

The compiled fixture transforms `hello` to `HELLO:original`, coerces `"2"` to `2`, and inserts a `mode: "safe"` default. Both request and executor observe the parsed values. The dynamic resolver is `step.started`, matching ChatJS's MCP registration scope.

The after-settlement test writes an entry marker after runtime receipt construction, pauses before the disposable effect, kills the EVE process with SIGKILL, removes the pause marker, then uses `eve dev --resume`. SIGKILL targets the CLI; the detached server closes on IPC disconnect, and the controller waits for its state-record removal before releasing the barrier. This is not direct detached-server SIGKILL. It does not reconstruct session JSON or mock a Workflow checkpoint. The same request ID and a different executor PID are recorded across replay. This proves the tested local-world recovery boundary, **not** Postgres compatibility, arbitrary deployment migration or exactly-once external effects.

## Finding and fix from the runtime proof

The initial 0.71.2-derived backport matched only session, call, tool name and parsed input. The compiled step-scoped test demonstrated that a refreshed connector closure could receive that receipt after restart. That local experimental patch was insufficient.

The resumed experiment preserves the callback definition restored from pending dynamic metadata before lifecycle refresh. Execution and approval rechecks select it only for the matching pending call. A private async context permits receipt construction only inside that selected callback, with exact parsed input, session and tool checks. Its output projection stays bound to the same definition. New calls retain fresh discovery and require their own consent. Ephemeral authority is cleared at harness entry and consumed at callback-context construction; replay reconstructs it from the resolved batch and durable winner.

The compiled fixture captures real `context.messages`, matching the production MCP adapter's closure pattern. Rediscovery changes that history during approval, but the approved executor sees the original captured history. A replacement connector and changed schema suffix do not alter the resumed action. A subsequent call in the same session uses the replacement connector and new suffix, with a distinct approval. Live owner and enabled-state revocation each block the effect despite a valid receipt. These are bounded experiment results, not a supported upstream API or proof of arbitrary source migration.

This finding concerns the experimental backport on 0.71.3. It is not a claim that the deployed fork has been reproduced with the same failure.

## Supplemental source proofs

```sh
EVE_TEST_NODE=/opt/homebrew/opt/node@24/bin/node \
  bash experiments/eve-approval-receipt/run.sh /tmp/chatjs-lane-b-0713
```

The stock counterexample passes **2 tests**: removing the final gate permits the effect after a policy flip; retaining it blocks the effect. The patched source suite passes **26 tests, 1 skipped** (the opt-in JSON checkpoint case). The runner's three legacy checkpoint processes each pass separately. Those JSON checkpoint cases remain supplemental; the published-runtime proof above establishes actual Workflow restart.

Source cases cover owner and foreign approve/cancel, foreign issuer with the same ID, competing decisions in both orders, stale losing candidates, absent/cancelled settlement, call/tool/input/session mismatch, duplicate evidence, historical-only evidence, reused receipt, fresh context, early park, cancellation, immutable capture and unchanged/replaced dynamic closure identity. EVE's coordinator/tool loop and AI SDK execute real code, with a mock model and effect spy.

## Repository checks

After `bun install --frozen-lockfile --ignore-scripts` in this worktree, shared manifests and lockfile remain unchanged:

- `bun test:types`: PASS, seven tasks (cached).
- `bun run --cwd apps/chat test:unit lib/eve/mcp-tools.test.ts`: PASS, 29 tests against the retained adapter.
- `bun lint`: FAIL on seven existing `typescript/no-unsafe-*` errors in `scripts/vercel-preview-build.ts:127–137`, matching Lane D’s baseline. Exception budget, preparation and formatting passed; later stages did not run.
- `bash -n` on both launchers and patch application checks: PASS.

## PostgreSQL and old-run evidence

[7 October validation](VALIDATION-2026-10-07.md) records the real patched-Postgres run, bounded abrupt-crash queue-lock observation, and production-fork package-switch failure. Old history decodes, but the old active workflow fails on versioned framework step identity before receipt execution. These are executed compatibility findings, not deferred proof work.

The fixture patch also materializes `runtime-postgres.ts` and `runtime-old-run.ts`. Run them with Bun and `EVE_TEST_NODE` pointing to Node 24.20.0. PostgreSQL requires D's committed helper and a provisioned dedicated `lane_b` database; do not reuse another lane's database. Arguments:

```sh
bun runtime-postgres.ts /absolute/D/tests/eve-retirement-runtime /absolute/experimental-install /absolute/connection.json --restart-only
bun runtime-old-run.ts /absolute/D/tests/eve-retirement-runtime /absolute/production/node_modules /absolute/experimental/node_modules /absolute/connection.json
```

The first runner uses the verified serving PID for abrupt crashes and a bounded observation window. Omitting `--restart-only` runs all scenarios. The old-run probe intentionally exits nonzero when compatibility fails; inspect its saved stage/error and worker logs. Neither runner deletes durable rows or resends consent.

## Remaining dependency and integration gates

[Comparison with Lane D’s callback-restart probe and upstream binding recommendation](RESTART-COMPARISON.md) records D’s resolved callback-restart result in `7a312a544`, while keeping its settlement-hook boundary distinct from B’s executor-entry boundary. Binding preservation remains a proposal, not an approved production API.

EVE 0.71.3 exposes caller propagation, **not** the proposed exact-consent receipt. Caller identity is also present for unapproved owner calls, as the runtime counterexample demonstrates. A supported receipt contract and release remain the upstream blocker.

Lane D can consume these fixtures without changing its harness checkout. Before production removal, upstream needs the receipt API and invariant tests, then ChatJS needs the supported release, adapter integration, full checks and compatibility with its patched Postgres world and existing runs. Code revision migration and all other fork consumers remain separate gates. The experiment does not authorize old closures across arbitrary deployed source changes.

Keep the current fork adapter, execution-time ownership/policy checks and conditional approval UX. No application ledger, blanket consent requirement, workflow-router redesign or automatic resend was introduced. No user decision is currently needed, and nothing was published upstream.
