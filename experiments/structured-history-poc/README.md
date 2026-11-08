# Structured native history — throwaway paired PoC

Question: can ChatJS use eve's `onMessage.history` for structured branches, without `resolveSeed` or a separate seed initialization lifecycle?

**Yes for branch-and-send.** This is an isolated companion adapter and native API experiment, not a migrated ChatJS application or a merge-ready fork release. Existing production code, database, and working fork are untouched.

## Run this prepared pair

The adjacent source checkout `/tmp/eve-structured-history-poc` is based on official `eve@1.0.0-rc.6`, commit `663640b`. Its branch is `codex/structured-history-poc` (signed+DCO commit `350f80a`). The PoC was verified on ChatJS `c406327`; the draft branch is rebased onto main `c746c42` (homepage/docs changes only). The fixture depends on that local built package, not a published candidate or committed archive. The relative local dependency expects the two checkouts to remain adjacent.

```sh
cd experiments/structured-history-poc
POC_NODE=/opt/homebrew/opt/node@24/bin/node bun run verify
```

With Node 24 on PATH, `bun run verify` suffices. From a fresh checkout, install and build the eve source with its pinned pnpm first (`pnpm install`, `pnpm --filter eve build`), then `bun install --frozen-lockfile` and `bun run setup` in this fixture. The fixture's `just-bash` and `zod` versions are explicit. Runtime databases/builds are created in a disposable temporary directory and removed on exit. No live model, production database, deployment, or publication is involved.

## Evidence

- Real local eve HTTP create/send/stream/snapshot using the patched package.
- Middle edit, regeneration, first-message edit, nested branches, full copy plus send, unchanged source, and follow-up without repeated import.
- A captured ChatJS `EveCopySeed`-shaped prefix is mapped into native history; changing the source collection afterward does not change the captured input.
- Reasoning, successful tool output, error, and denial survive native display and reach the mock model. Historical calls produce no `call.requested` events and no live approval interactions.
- An owned text attachment resolves through `fetchFile` and actual just-bash staging; model input contains the staged attachment label, not a failure note. Nested rich branches resolve the retained original URL again.
- Native message `historyId` preserves captured IDs across nested branches.
- Synthetic wrong-owner source/reservation imports are rejected.
- Empty native create has no imported display rows, confirming the pre-send gap.
- Focused eve source tests exercise ordering, distinct imported call IDs, invalid/pending approval shapes, native display and existing text behavior. The original official package rejects structured `parts` for the expected reason.

## What this does not prove

The fixture uses synthetic auth and in-memory captured reservations, not the production ChatJS database, gateway or dispatch journal. The production owner, revision, file-membership and immutable-intent capture and unknown-delivery fencing remain unchanged and must be retained in a real migration. This fixture is not an exactly-once API and must never replace those controls.

No live-provider reasoning signatures, production billing, new live approval round trip, browser UI, sharing/search/votes or legacy history migration was tested here. The mock model checks the actual model-bound prompt through eve's mock-model interface; it is not real external inference. The text attachment uses native label semantics, not a claim that its full bytes were inlined to a model. Exact old filesystem paths and continuous digest enforcement are not preserved by this PoC's restaging adapter. Tool JSON outputs containing paths are not rewritten automatically. Metadata/model labels outside the import contract are not carried by the adapter; the app can retain them as annotations.

Standalone copy-before-send remains the decision: app-owned prefix display until first send, or a small native initialization/projection extension using this same history type. No parallel seed API was reintroduced and no dummy prompt is sent.

## Patch shape

The eve experiment changes the existing input validator, model conversion, delivery schema, client display/text projection and history-file staging. It adds no runtime dependencies. Its import spelling `dynamic-tool` matches the current ChatJS captured shape; the RC6 client projects native `tool` parts. This spelling is a draft, not an upstream-approved public contract.

The fork's old seed code was not copied into this RC6 baseline. Removing it from the shipping fork is a later migration after pre-send behavior and app resource guarantees are settled. This proves feasibility, not a net removal already made.

Checks passed: eve build, full-source type check, lint (pre-existing warnings), protocol invariant guard, all docs checks, and 39 tests across four focused files; ChatJS lint, all ten workspace type tasks, standalone fixture types, and the native API eval. These are local results, not hosted CI or production acceptance.
