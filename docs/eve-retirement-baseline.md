# EVE retirement runtime baseline

Selected 6 October 2026 for lanes A–D. Keep this baseline fixed during the proofs.

| Component | Exact baseline |
| --- | --- |
| Published EVE | `eve@0.71.3` |
| Release tag / source commit | `eve@0.71.3` / `fab8ba1424eddfdedd6a177cac21710258da0e81` |
| Registry integrity | `sha512-n0IdHqthlSTZvWjRtyaai0dQQB6K441JUbBbk9N63zsZrVkOkaJrLxh0hY9AfPb+TlJINOlhd/BcIQIHgf5w4g==` |
| Bundled Workflow | core/errors/world/world-local/world-vercel `5.0.1`, serde `5.0.0` (release source and lockfile) |
| AI SDK for isolated proofs | `ai@7.0.106` (satisfies EVE peer `^7.0.105`, matches ChatJS) |
| Host | Node `>=24`; Bun for install/scripts |
| Production ChatJS (unchanged) | `eve: npm:@chat-js/eve@0.61.0-chatjs.0`, fork source `3a7acfe6ba42a8dc9d330132b11856962a675705` |
| Production Postgres world (unchanged) | `@workflow/world-postgres@5.0.0-beta.40` plus existing ChatJS patch |

## Evidence and setup

Read [registry metadata](https://registry.npmjs.org/eve/0.71.3), the [release package](https://github.com/vercel/eve/blob/fab8ba1424eddfdedd6a177cac21710258da0e81/packages/eve/package.json), and [release lockfile](https://github.com/vercel/eve/blob/fab8ba1424eddfdedd6a177cac21710258da0e81/pnpm-lock.yaml). `git ls-remote https://github.com/vercel/eve.git HEAD refs/tags/eve@0.71.3` returned the commit above for both refs. The registry `latest` was `0.71.3`; no proof may depend on a moving `latest` or `main`.

Use the committed, isolated harness and frozen lockfile:

```sh
bun install --cwd tests/eve-retirement-runtime --frozen-lockfile
# Requires Node >=24 on PATH, or EVE_TEST_NODE=/absolute/path/to/node
bun run --cwd tests/eve-retirement-runtime test
bun run --cwd tests/eve-retirement-runtime test:types
```

See [harness instructions](../tests/eve-retirement-runtime/README.md) for feature fixtures. This package lives outside root workspace globs and uses the published package, mock models, a fresh local-world directory, loopback networking, and no application/provider credentials. Feature proofs supply agent/tool fixtures without mocking EVE admission or settlement. The [complete fork inventory](eve-retirement-inventory.md) records additional removal gates.

## Consequences for feature lanes

Unlike the prior `0.71.2` review, `0.71.3` includes public channel `invokeTool`, caller propagation for approved calls, and cancellation follow-up changes. Lane A must cover out-of-turn invocation. Lane B must inspect the new caller propagation: authenticated caller identity alone must not be assumed to be an exact settled-human receipt. Lane C still needs to establish exact per-message caller correlation through real create/send surfaces.

This selects a published upstream proof target, not a production dependency upgrade or a claim of supported fork removal. Workflow's local bundled backend is the first proof backend. Compatibility with ChatJS's patched Postgres backend, old durable runs/checkpoints, and the complete fork inventory remain separate gates. Do not replace the production alias until all its consumers have proven replacements.

## Lane D verification

Run in `/Users/fran/.codex/worktrees/e70d/chat-js` on 6 October 2026 with Bun `1.3.11`, Node `24.20.0` for the runtime child:

| Command | Result |
| --- | --- |
| `bun install --cwd tests/eve-retirement-runtime --frozen-lockfile` | Exact published baseline installed independently of the production fork. |
| `EVE_TEST_NODE=/opt/homebrew/opt/node@24/bin/node bun run --cwd tests/eve-retirement-runtime test` | PASS: 1 real-runtime eval, 4 EVE gates; explicit assertions also check separate received messages, durable delivery IDs and fresh-client snapshot replay. |
| `bun run --cwd tests/eve-retirement-runtime test:types` | PASS. |
| `bunx oxlint tests/eve-retirement-runtime` | PASS. |
| `bun test:types` | PASS: 7 tasks, 5 cached. The standalone harness has its own explicit type check above. |
| `bun lint` | FAIL outside changed code: 7 `typescript/no-unsafe-*` errors in `scripts/vercel-preview-build.ts:127–137`, from its existing Postgres type/import resolution. Exception budget, lint preparation and repository formatting passed before this failure. Later lint stages did not run. |
| `git diff --check` | PASS. |

The lint exception baseline adds only the harness's scoped EVE default-export, Node launcher and SDK evaluation-boundary exceptions. It does not suppress the unrelated lint failure. The runtime launcher rejects a different EVE package/version, requires Node 24+, applies a three-minute process timeout, and retains failed fixture directories for diagnosis.

No feature lane was integrated and no production manifest, production lockfile or adapter was changed. The current proof reads durable state through a new client while the worker remains running; it does not certify process restart or deployment migration. No specific user decision is needed for this baseline/harness handoff. Production retirement remains gated by the inventory and A/B/C proofs.

Subsequent shared support adds a real parked-approval process restart and two explicitly failing acceptance probes. See [restart controls and results](../tests/eve-retirement-runtime/RESTART.md) and [lane integration/exception ownership](eve-retirement-integration-plan.md). The baseline version remains unchanged; these results do not establish complete approval recovery.
