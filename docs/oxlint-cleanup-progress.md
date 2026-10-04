# Oxlint cleanup progress

Tracking: [#503](https://github.com/FranciscoMoretti/chat-js/issues/503). Integration PR: [#646](https://github.com/FranciscoMoretti/chat-js/pull/646).

The goal remains **open**. Every starting suppression must be removed by a verified code fix or canonical regeneration, or retained after individual review with a narrowly scoped explanation of its actual contract. Passing lint, an existing comment, or a completed batch does not establish completion. Substantial deferred work remains unresolved.

Fresh GitHub state verification on 2026-10-04 confirms 110 original rule issues (#505–#614): 46 closed and 64 open. The umbrella #504 and goal #503 are separate. No rule issue was closed by this local checkpoint. The 11 approved off policies and 99 enforced rules remain unchanged.

## Latest validated local measurement

Measured 2026-10-04 after integrating the CLI transport/configuration, thread readers/sentinels, core admission, UI type contracts, registry test narrowing and MCP compatibility batches. The disposable audit covers 1,363 files, with no unmapped rule codes. These changes are local, not merged.

| Measurement | Starting main | Current local measurement | Net reduction |
| --- | --: | --: | --: |
| Diagnostics with all 110 audited rules enabled | 34,180 | 31,427 | 2,753 |
| Diagnostics from 99 enforced rules | 22,518 | 19,055 | 3,463 |
| Diagnostics from 11 approved off policies | 11,662 | 12,372 | -710 |
| Canonical-source suppression entries | 11,612 | 9,484 | 2,128 |
| Generated-mirror suppression entries | 860 | 658 | 202 |
| All suppression entries | 12,472 | 10,142 | 2,330 |

Full `bun lint`, all seven `bun test:types` tasks, and regenerated `bun template:check` pass at checkpoint 19. Checkpoint 15 adds 70 app-local import scope fixes with exact TypeScript/Bun resolution and normalized emitted-runtime comparisons, plus native CLI/script/prototype readers. A temporary verification copy accidentally appeared in an initial inventory; it was removed from source coverage and both lint and the audit were rerun in a fresh disposable directory. Only the clean audit is reported. The unchanged shared package passed 69 thread tests (218 assertions) at checkpoint 13. Checkpoint 14 adds native CLI installation reader/metadata/callback fixes, composer return contracts/documentation, one prototype history reader fix and named Forge constants. CLI rollback controls pass; composer fixtures retain explicit visual coverage limits. Forge trace controls compare 108 cases; explicit-file typed lint reproduces the same 26 CJS type-context diagnostics in original/current source, while full repository lint passes. This batch includes exact native return/read boundaries, package-local test imports, hook helper extraction, CLI output/installation contracts, and canonical OAuth lock/editor fixes followed by regeneration. Independent review also passed nine hook tests and two OAuth lock tests. Existing public identities, hook ordering and cancellation cleanup were examined. The moved helper directives were individually mapped before the serialized baseline update; the growth guard remains unchanged.

The starting-entry ledger accounts for all 12,472 entries: **2,183 removed by verified source fixes, 211 via canonical regeneration, seven verified unused scopes removed, 120 retained with reviewed narrow mappings, and 9,951 still unreviewed**. There are 190 reviewed current scopes and 9,952 unreviewed current scopes. No unmatched proof identities, failed current-scope mappings or supplemental mapping failures remain. Gross dispositions differ from net changes because narrowing can split scopes. Seven previously retained starting entries now have real fixes; no blanket retention was accepted.

The SDK canonical-message type correction for #643 is included in the published checkpoint 12. Targeted UI visual and type-contract evidence passes for integrated UI changes; full authenticated screens are not claimed. Full independent multi-package-manager scaffold validation remains pending. Prototype type/lint and SQL/predicate controls pass; live PostgreSQL tests remain unavailable without `initdb` and `pg_ctl`. Checkpoint 16 directly verifies and integrates the JavaScript protocol decoder:35 cases pass on Node and35 on Bun, including malformed envelopes and runtime-mutated Error fields. It deliberately replaces the engine-dependent null dereference message with an explicit TypeError message, preserving rejection type and stdout/stderr/logging order. Ordinary commands/results/logs retain parity. Canonical consumers are regenerated. Shared test readers pass69 tests/221assertions, and CLI contribution planning passes14 tests/59assertions, focused lint and types. Checkpoint17 adds six native React-node reader scope removals across Tag, SettingsPage helpers and ChatWelcomeView. Native ReactNode/view assignability holds in both directions, emitted runtime tokens match, and desktop/mobile actual component captures have zero changed pixels and zero browser errors after fixing fixture dependency prebundling. Other unfinished UI alias proposals remain excluded.

## Previous fully validated checkpoint

Updated 2026-10-04. Starting main contains PR #645 at `44a9d32318b9f1afe82d32b2f95ed085e740ba5f`. The measured integration tree is `628b4f88a0502f104890ce01933eb4c4ce0932ca`; subsequent work requires a fresh measurement. The recovered checkout was verified byte-for-byte against that tree after the execution workspace was replaced.

| Measurement | Starting main | Measured local integration | Net reduction |
| --- | --: | --: | --: |
| Diagnostics with all 110 audited rules enabled | 34,180 | 32,877 | 1,303 |
| Diagnostics from 99 enforced rules, including their scoped exceptions | 22,518 | 20,737 | 1,781 |
| Diagnostics from 11 approved off policies, enabled only for measurement | 11,662 | 12,140 | -478 |
| Canonical-source suppression entries | 11,612 | 10,510 | 1,102 |
| Generated-mirror suppression entries | 860 | 782 | 78 |
| All suppression entries | 12,472 | 11,292 | 1,180 |

Diagnostics and suppression entries are different units, and neither is a bug count. The diagnostic audit uses pinned Oxlint 1.82.0 with type-aware linting, all 110 audited rules forced on, and local directive bodies blanked in a disposable snapshot. It retains configured options and source coverage; it does not enable unrelated rules. Additional contract tests and named imports can increase diagnostics from approved off policies. None of those policies was changed to improve the totals.

The starting-entry ledger at that checkpoint records 1,099 source entries removed by verified fixes, 80 generated entries removed by canonical regeneration, six individually verified unused directives removed, 83 original entries retained after review, and 11,204 entries still unreviewed. Narrowing and splitting some retained scopes leaves 88 reviewed current scopes. These dispositions account for all 12,472 starting entries; net suppression reduction differs from gross removals.

## Validation and publication

The measured local integration passed full `bun lint`, including the unchanged growth guard and generated parity; all seven `bun test:types` tasks passed. Focused guard tests passed 37/37, thread tests 69/69, and new CLI contract tests 11/11. UI changes have type-contract evidence and before/after browser comparisons with no changed pixels in the exercised fixtures. The local tsx Unix IPC restriction remains an environment limitation for affected subprocess tests, not a claimed full-suite pass.

Published PR head `b62e85bb9edb85ac6e2f7e8d1c5912636521e938` exactly matches validated checkpoint 12 tree `0bfd8f534b211222fa2a52844b478309028d612a`. Lint, Typecheck, Unit, UI Verify, Docs and Playwright pass on this head; CLI Scaffold and aggregate Required also pass. This contains the Electron CommonJS and optional model-count corrections plus TanStack Query compatibility fixes. The supported Query minimum is 5.104.1, with native query/infiniteQuery calls. Exact old/new cache, stale-time, retry, rejection and preload controls pass; frozen Bun installation succeeds. Checkpoint18 is published at `5fb2a32d4bfa3d3605272e6e988609276e4f3764` with exact local tree parity. Lint, Typecheck, Docs, UI Verify and Playwright pass; Unit passes after one unchanged retry of a five-second PGlite history test timeout (the same28-test suite also passes locally). All184 CLI unit tests pass in CI, including the locally IPC-blocked Node/tsx scaffold case. CLI Scaffold exposed13 form-state type errors under freshly installed React Hook Form7.89.0; checkpoint19 corrects this with the exported native ControllerFieldState. Fresh CI for that correction is required. No cleanup has been merged.

Checkpoint 11 preserves the exported four-argument MCP adapter after a trial DTO refactor broke an existing invocation test. That attempted max-params removal was withdrawn. The rename callback correction has 14 exact visual comparison pairs and verifies a forced parent close/reopen retains the in-flight save lock, preventing duplicate submission. No additional unrelated diagnostic is hidden by its pre-existing component scopes. Checkpoint12 adds canonical MCP query decomposition and native transport readers, shared SDK reader fixes/narrow boundaries, CLI source generation fixes, and precise core query/guest return contracts. Broader remaining scopes stay unreviewed. Prototype changes pass type/lint and predicate/SQL-text controls; its live PostgreSQL suite is not claimed passing because initdb and pg_ctl are unavailable.

## Remaining work

- Individually review and fix the remaining scopes under module issues #618, #619, #620, #621, #622 and #623, then reconcile the original rule subissues.
- Confirm CLI Scaffold and aggregate Required for the checkpoint19 form-state correction; all PR work remains unmerged.
- Continue registry test cleanup with correct TypeScript project coverage. The Bun/Node SDK fetch compatibility correction passes local lint and type checks; retained test exceptions with insufficient evidence remain unresolved.
- Continue actual shared type and runtime boundary fixes, preserving public contracts and validating warranted changes explicitly.
- Refresh the complete per-entry ledger and diagnostic audit after integrated changes. Unvalidated or lost scratch proposals are not included in the verified counts.

Delegated workers were stopped on user instruction on 2026-10-04. Further review and integration proceed directly in the isolated checkout. Their unfinished patches remain uncounted until independently validated.

Checkpoint18 adds32 verified CLI parent-import scope removals across13 files using private package imports. Fresh TypeScript and Bun resolution and normalized emitted runtime order match. Eleven formatter-reordered candidates were restored. CLI native bundles build and six Node command outputs/exits match before/after. Full CLI source suite:183 pass, one failure because tsx cannot create its local IPC socket (`EPERM`). A pre-change control reproduces that failure. Explicit-file lint of the external gateway fixture reports the same nine type-context diagnostics before/after; full repository lint passes. These limitations are disclosed rather than weakening tests or declaring the goal complete. Two previously retained parent-import exceptions now have real fixes.

Checkpoint19 directly removes seven shared test scopes: readonly native gateway adapter options, Vitest resolved-response fixtures and explicit hook compatibility return types. All19 gateway tests, focused lint and typing pass. Serial full repository lint, seven type tasks and template parity pass. An initial concurrent lint/type/audit invocation raced over rebuilt package declarations; its failed typing and inflated audit are discarded, and gates/audit reran serially. The clean audit has1,363files and no unmapped codes.

The form scaffold correction reproduces all13 original errors with independently installed React Hook Form7.89.0; direct exported ControllerFieldState clears them, with native type-contract checks. It preserves exact emitted runtime output, and six actual form before/after visual pairs (initial/error/success, desktop/mobile) have zero changed pixels and no browser errors. FormControl/Label/Message consumers retain native validation/accessibility behavior. The sole app importer is McpCreateDialog; no full authenticated dialog coverage is claimed. Broad existing form metric scopes remain unreviewed; changed baseline fingerprints are recorded without treating them as reviewed.
