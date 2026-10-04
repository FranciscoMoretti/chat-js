# Oxlint cleanup progress

Tracking: [#503](https://github.com/FranciscoMoretti/chat-js/issues/503). Integration PR: [#646](https://github.com/FranciscoMoretti/chat-js/pull/646).

The goal remains **open**. Every starting suppression must be removed by a verified code fix or canonical regeneration, or retained after individual review with a narrowly scoped explanation of its actual contract. Passing lint, an existing comment, or a completed batch does not establish completion. Substantial deferred work remains unresolved.

Fresh GitHub state verification on 2026-10-04 confirms 110 original rule issues (#505–#614): 46 closed and 64 open. The umbrella #504 and goal #503 are separate. No rule issue was closed by this local checkpoint. The 11 approved off policies and 99 enforced rules remain unchanged.

## Latest validated local measurement

Measured 2026-10-04 after integrating the CLI transport/configuration, thread readers/sentinels, core admission, UI type contracts, registry test narrowing and MCP compatibility batches. The disposable audit covers 1,361 files, with no unmapped rule codes. These changes are local, not merged.

| Measurement | Starting main | Current local measurement | Net reduction |
| --- | --: | --: | --: |
| Diagnostics with all 110 audited rules enabled | 34,180 | 31,984 | 2,196 |
| Diagnostics from 99 enforced rules | 22,518 | 19,630 | 2,888 |
| Diagnostics from 11 approved off policies | 11,662 | 12,354 | -692 |
| Canonical-source suppression entries | 11,612 | 9,812 | 1,800 |
| Generated-mirror suppression entries | 860 | 679 | 181 |
| All suppression entries | 12,472 | 10,491 | 1,981 |

Full `bun lint`, all seven `bun test:types` tasks, and `bun template:check` passed at local checkpoint 12 after restoring the exported four-argument MCP API and regenerating consumers. All 34 MCP tests pass; the compatibility test is unchanged. Thread tests passed 69/69 with 218 assertions; guard, Neon, scaffold-contract and transport tests passed 51/51 with 284 assertions. Registry tests passed 57/57 with 156 assertions. The SDK canonical-message type correction for #643 is integrated locally, including packed declaration checks that reject unsupported arbitrary subtype guarantees. The current conservative starting-entry ledger accounts for all 12,472 entries: 1,849 removed by verified source fixes, 190 via canonical regeneration, seven verified unused scopes removed, 125 retained with reviewed narrow mappings, and 10,301 still unreviewed. Exact supplemental evidence accounts for new boundaries separately; 189 current scopes have reviewed mappings and 10,302 remain unreviewed. These gross dispositions differ from net changes because narrowing can split scopes and new contract boundaries can require new scopes. Supplemental new-scope evidence remains separate. There are no unmatched proof identities or failed current-scope mappings in this snapshot. The older ledger below describes only its historical checkpoint. Targeted UI visual captures and type-contract evidence pass for the integrated changes; full authenticated screens are not claimed. Full multi-package-manager scaffold validation is not implied by the passing local contract and lint-policy parity tests. The broader gateway setup timed out at registry packaging while bunx resolved the pinned shadcn dependency; it is not claimed passing locally.

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

Published PR head `a349126d4c17029a0c3164bf8ef9c453daddb78b` adds numeric guards for optional model-selection counts after the Electron CommonJS prebuild correction. The actual no-MCP OpenAI-compatible generated fixture reproduces two TS18048 errors before and zero after; 10,368 predicate cases preserve results and 14 UI pairs have zero changed pixels. Fixture dependencies were linked, not independently installed. Lint, Typecheck, Unit, UI Verify, Docs and Playwright pass on this published head; CLI Scaffold now passes model-count typing but fails standalone lint on six TanStack Query deprecations in four app files; aggregate Required fails. The locked root uses Query 5.97.0, without the new query method. A scoped minimum upgrade to 5.104.1 and native query/infiniteQuery migration now pass local full validation. Both native versions pass finite/infinite cache, stale-time, retry, rejection and preloading behavior comparisons; six browser pairs are exact. Two workspace requirements and two exact Bun-generated package records changed. After resolver stalls, frozen Bun installation succeeded with the generated records and installed version 5.104.1 was verified. This correction awaits publication/independent scaffold CI. The predicates existed in starting main, but our more precise generated model types expose the error; starting main's full scaffold validation was not rerun. Additional cleanup remains local and is not covered by that published head's CI.

Checkpoint 11 preserves the exported four-argument MCP adapter after a trial DTO refactor broke an existing invocation test. That attempted max-params removal was withdrawn. The rename callback correction has 14 exact visual comparison pairs and verifies a forced parent close/reopen retains the in-flight save lock, preventing duplicate submission. No additional unrelated diagnostic is hidden by its pre-existing component scopes. Checkpoint12 adds canonical MCP query decomposition and native transport readers, shared SDK reader fixes/narrow boundaries, CLI source generation fixes, and precise core query/guest return contracts. Broader remaining scopes stay unreviewed. Prototype changes pass type/lint and predicate/SQL-text controls; its live PostgreSQL suite is not claimed passing because initdb and pg_ctl are unavailable.

## Remaining work

- Individually review and fix the remaining scopes under module issues #618, #619, #620, #621, #622 and #623, then reconcile the original rule subissues.
- Confirm CLI Scaffold and aggregate Required on the model-selection guard; all PR work remains unmerged.
- Continue registry test cleanup with correct TypeScript project coverage. The Bun/Node SDK fetch compatibility correction passes local lint and type checks; retained test exceptions with insufficient evidence remain unresolved.
- Continue actual shared type and runtime boundary fixes, preserving public contracts and validating warranted changes explicitly.
- Refresh the complete per-entry ledger and diagnostic audit after integrated changes. Unvalidated or lost scratch proposals are not included in the verified counts.
