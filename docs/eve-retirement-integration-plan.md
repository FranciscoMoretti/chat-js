# Lane D shared integration plan

This plan reviews A `7890d3ff3`, B's provisional `135c8a8f1`, and C `8296d3ef9`. No lane commit or runtime patch has been integrated. Updated commits requested by the parent supersede those review points.

## Shared support ready for relay

Use [persistent runtime controls](../tests/eve-retirement-runtime/RESTART.md) for actual process death and `eve dev --resume` with the same local world. The shared launcher pins EVE 0.71.3 and AI SDK 7.0.106. Alternate, separately built installations are explicitly labeled experimental. B's source-only checkpoint proof does not become a Workflow proof until run through a compiled/persistent boundary; C's fresh-client replay similarly does not become process restart merely by reattaching a client.

Lane D's executable evidence finds a same-name dynamic connector replacement after a parked approval, and an uncompleted continuation within 60 seconds after killing inside settlement callbacks. Relay these failures to B; retain the receipt adapter. For C, first verify receipt replay after restarting an idle/completed session, then exercise queued non-materialization separately. An in-flight interrupted step may expose the same recovery limitation; absence of a receipt during a timeout is not rejection or terminal cancellation.

## A's exception review

A's lane-only JSON has **40 rule/directive entries across seven files**, not eight. Thirteen entries apply to five compiled fixture files; 27 apply to two `.mjs` internal-runtime probes. All include reasons and scope fingerprints; `missingReasons` is empty.

- EVE-required default exports, native test Node imports, ordered awaited scenario steps and SDK-owned callback types are expected fixture boundaries. Keep their scopes restricted to these tests.
- Scenario numeric literals and function-size exceptions are acceptable only for the bounded proof sequence they describe. Do not copy them into production deletion code.
- The two `.mjs` probes dynamically load internals from two different runtime distributions. Their `no-unsafe-*` / template-expression waivers reflect that untyped boundary, not approval to weaken application types. Keep those probes explicitly classified as research evidence; use typed public/compiled fixtures for the installed-path acceptance proof.
- Recompute fingerprints after A finishes the actual installed dynamic-path proof. The present JSON is a review aid, not a baseline file to overwrite D's shared budget with.

C should produce the same lane-only additions format for unavoidable scoped Node, default-export, ordered-loop and SDK callback exceptions, while fixing ordinary unsafe typing/style directly. C must not edit the shared baseline. Prefer no new exceptions where a typed public interface works.

## Integration sequence (only after parent authorization)

1. Parent supplies each final worktree/commit and which artifact is approved for integration. Do not cherry-pick B/C's provisional runtime patches as a dependency replacement.
2. Integrate the shared controller before feature fixtures, retaining the isolated manifest/lockfile. A's fixture may consume the shared installation; B/C experiments must use separate installations with explicit provenance.
3. Bring in one lane at a time. Review its production diff separately from experimental/runtime proof code. A remains blocked until the actual installed dynamic path and guarded database mutation are covered; a static authored tool or internal `invokeTool` call is insufficient.
4. Read that lane's scoped exceptions and regenerate the central budget from final integrated source with `bun scripts/lint-exceptions.ts --write-baseline --allow-new`. Inspect the diff: only reviewed lane/shared files may gain entries, counts or fingerprints. Do not replace the central JSON with a lane-only snapshot or silently bless unrelated waivers.
5. Run `bun lint:exceptions`, targeted `bunx oxlint <lane paths>`, explicit isolated fixture type checks, each lane's real-runtime commands, `bun lint`, and `bun test:types`. Root Turbo type checks do not cover packages outside workspace globs. Record expected negative probes as failures/counterexamples, not green acceptance tests.
6. Keep each proven removal independently reviewable. Do not switch production EVE/Workflow until the [complete inventory](eve-retirement-inventory.md), old durable runs and patched Postgres adapter pass their own gates.

## Independent lint attribution

The seven `typescript/no-unsafe-*` errors at `scripts/vercel-preview-build.ts:127–137` reproduce from a clean `git archive` of unchanged ChatJS `3a6dfcbef5da45df8e0f089b0604796c40150066`, without any D harness files or exception changes. Both root and `apps/chat` installed dependency directories were linked read-only from D's frozen install. No source was edited in the archive. The command was:

```sh
bunx --no-install oxlint scripts/vercel-preview-build.ts
```

The unchanged file and its config/policy come from the baseline archive. This attributes the failure to the existing source/dependency-resolution combination, not D's new files; it does not establish whether another dependency layout would pass. Evidence remains at `/tmp/chatjs-lint-baseline.kWI7sT` and `/tmp/e70d-pristine-lint.log` on this host. The same errors occur in D's `bun lint`. No suppression or unrelated fix was made.
