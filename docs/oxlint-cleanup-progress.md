# Oxlint cleanup progress

Tracking: [#503](https://github.com/FranciscoMoretti/chat-js/issues/503). Integration PR: [#646](https://github.com/FranciscoMoretti/chat-js/pull/646).

The goal remains **open**. Every starting suppression must be removed by a verified code fix or canonical regeneration, or retained after individual review with a narrowly scoped explanation of its actual contract. Passing lint, an existing comment, or a completed batch does not establish completion. Substantial deferred work remains unresolved.

## Latest local measurement (validation in progress)

Measured 2026-10-04 after integrating the CLI transport/configuration, thread readers/sentinels, core admission, UI type contracts, registry test narrowing and MCP compatibility batches. The disposable audit covers 1,341 files, with no unmapped rule codes. These changes are local, not merged.

| Measurement | Starting main | Current local measurement | Net reduction |
| --- | --: | --: | --: |
| Diagnostics with all 110 audited rules enabled | 34,180 | 32,628 | 1,552 |
| Diagnostics from 99 enforced rules | 22,518 | 20,475 | 2,043 |
| Diagnostics from 11 approved off policies | 11,662 | 12,153 | -491 |
| Canonical-source suppression entries | 11,612 | 10,333 | 1,279 |
| Generated-mirror suppression entries | 860 | 786 | 74 |
| All suppression entries | 12,472 | 11,119 | 1,353 |

Full `bun lint`, all seven `bun test:types` tasks, and `bun template:check` passed after correcting the registry mock and regenerating templates. Thread tests passed 69/69 with 218 assertions; guard, Neon, scaffold-contract and transport tests passed 51/51 with 284 assertions. The per-entry disposition ledger is being reconciled against exact current scope fingerprints. The earlier ledger below must not be mistaken for dispositions of this newer snapshot. Targeted UI visual evidence is finishing. Full multi-package-manager scaffold validation is not implied by the passing local contract and lint-policy parity tests.

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

The published PR head `51c64f24952b122d196c37cc0b906e36e9b52603` is an earlier checkpoint: 689 fewer suppression entries and 987 fewer all-audited-rule diagnostics. All eight required workflows passed on that exact head. Local work is not represented as merged or validated by an older head's CI. PR publication occurs at larger checkpoints; local validation continues between them.

## Remaining work

- Individually review and fix the remaining scopes under module issues #618, #619, #620, #621, #622 and #623, then reconcile the original rule subissues.
- Publish the locally validated Neon root-branch acceptance correction and formatter-threshold correction at the next larger PR checkpoint.
- Continue registry test cleanup with correct TypeScript project coverage. The Bun/Node SDK fetch compatibility correction passes local lint and type checks; retained test exceptions with insufficient evidence remain unresolved.
- Continue actual shared type and runtime boundary fixes, preserving public contracts and validating warranted changes explicitly.
- Refresh the complete per-entry ledger and diagnostic audit after integrated changes. Unvalidated or lost scratch proposals are not included in the verified counts.
