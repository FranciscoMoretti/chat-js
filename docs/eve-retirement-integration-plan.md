# Lane D shared integration plan

Reviewed final A `12dfce419`, B `19a4035fbf6184910374824911e6cec206add286`, and C `1a359d1f8081a3d358e0234eb8d8c977d6972b72` atop `db96edc6d` and `8296d3ef9`. No lane commit or runtime patch has been integrated; production dependencies remain unchanged.

## Shared support and conflicting restart observations

Use the corrected [persistent runtime controls](../tests/eve-retirement-runtime/RESTART.md), retaining the isolated EVE 0.71.3 / AI SDK 7.0.106 installation. D's prior callback timeout used the default 860-second ownership lease with a 60-second wait and did not wait for the detached server to close. B's final runner uses a one-second lease and waits for server-state removal. D now matches those controls, checks different process IDs and retains its one-effect assertion. The corrected callback case passes. B's later barrier is inside the executor after receipt context; D's is inside the settlement hook. This resolves the apparent contradiction without adopting B's experimental patch.

The same-name dynamic connector replacement counterexample remains independent. Retain the receipt adapter pending an accepted replacement. C's final completed-world restart is a distinct, narrower boundary than in-flight recovery; absent receipts are not terminal cancellation. Neither lane establishes production Postgres, old durable-run compatibility or exactly-once external effects.

## Final scoped exception review

A's `tests/eve-retirement-lane-a/lint-exception-additions.json` matches its final files: **60 occurrences across 14 files**, no missing reasons. SHA-256: `06359a3fa6b234ca581738441c2bb928985e2f240b93f9b4e137e3c775cb70d0`.

- Default exports, native Node imports, ordered awaited scenarios and SDK-owned callback types are fixture boundaries. Numeric/function-size and template inference exceptions stay local.
- The two `.mjs` internal-runtime probes contribute 27 occurrences; their unsafe/template-expression waivers remain research-only boundaries, not precedent for production code. The added installed dynamic proof introduces no unsafe waivers.

C's `experiments/eve-delivery-correlation/lint-exception-additions.json` matches its final files: **102 occurrences across 15 files, 46 rule/directive records**, no missing reasons or `no-unsafe-*` waivers. SHA-256: `10efc4200c9ca18fa7ff525fde79038b0a75ef169ea8eb7d4c17f13d527c8797`. Scoped Node/SDK, ordered-loop, default-export, mock callback and JSON-wire roundtrip exceptions are justified for these experiments. The two added `require-await` records cover an async HTTP route that returns only the serving process ID. Recomputed counts, fingerprints and reasons match the final snapshot exactly. C now SHA-256-verifies the shared controller from `7a312a544`, asserts detached-server state cleanup and distinct HTTP serving PIDs across its completed-world restart. Its final evidence reports stock 84516 → 84771 and experimental 84470 → 84706, with one follow-up dispatch and no resend; this remains completed-world replay evidence.

B has no lane manifest: shell and patch-text artifacts do not add executable-root exception entries. Materialized patched fixtures still require their own type/proof checks before promotion. These snapshots are review aids; verify hashes against the exact integrated commits and never overwrite the central budget with a lane-only snapshot.

## Integration sequence (only after parent authorization)

1. Parent supplies each final worktree/commit and which artifact is approved for integration. Do not cherry-pick B/C's provisional runtime patches as a dependency replacement.
2. Integrate the shared controller before feature fixtures, retaining the isolated manifest/lockfile. A's fixture may consume the shared installation; B/C experiments must use separate installations with explicit provenance.
3. Bring in one lane at a time. Review its production diff separately from experimental/runtime proof code. Review A's final installed dynamic-path proof and guarded database mutation coverage; a static authored tool or internal `invokeTool` call alone is insufficient.
4. Read that lane's scoped exceptions and regenerate the central budget from final integrated source with `bun scripts/lint-exceptions.ts --write-baseline --allow-new`. Inspect the diff: only reviewed lane/shared files may gain entries, counts or fingerprints. Do not replace the central JSON with a lane-only snapshot or silently bless unrelated waivers.
5. Run `bun lint:exceptions`, targeted `bunx oxlint <lane paths>`, explicit isolated fixture type checks, each lane's real-runtime commands, `bun lint`, and `bun test:types`. Root Turbo type checks do not cover packages outside workspace globs. Record expected negative probes as failures/counterexamples, not green acceptance tests.
6. Keep each proven removal independently reviewable. Do not switch production EVE/Workflow until the [complete inventory](eve-retirement-inventory.md), old durable runs and patched Postgres adapter pass their own gates.

## Independent lint attribution

The seven `typescript/no-unsafe-*` errors at `scripts/vercel-preview-build.ts:127–137` reproduce from a clean `git archive` of unchanged ChatJS `3a6dfcbef5da45df8e0f089b0604796c40150066`, without any D harness files or exception changes. Both root and `apps/chat` installed dependency directories were linked read-only from D's frozen install. No source was edited in the archive. The command was:

```sh
bunx --no-install oxlint scripts/vercel-preview-build.ts
```

The unchanged file and its config/policy come from the baseline archive. This attributes the failure to the existing source/dependency-resolution combination, not D's new files; it does not establish whether another dependency layout would pass. Evidence remains at `/tmp/chatjs-lint-baseline.kWI7sT` and `/tmp/e70d-pristine-lint.log` on this host. The same errors occur in D's `bun lint`. No suppression or unrelated fix was made.
