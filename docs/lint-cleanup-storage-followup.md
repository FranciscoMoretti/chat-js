# Storage and Logical Selection Lifecycle Follow-Up

## Accounting

| Production file | Original react/set-state-in-effect memberships | Final | Removed | Retained | Unresolved |
| --- | --: | --: | --: | --: | --: |
| apps/chat/components/eve/use-document-draft.ts | 1 | 0 | 1 | 0 | 0 |
| apps/chat/components/eve/use-eve-message-delivery.ts | 1 | 0 | 1 | 0 | 0 |
| apps/chat/components/eve/eve-logical-navigation.tsx | 1 | 0 | 1 | 0 | 0 |

The incoming worktree had already removed some suppression comments but still reported the underlying effect diagnostics. This pass removes the actual effect-driven state hydration, not merely comments. No new suppression, configuration, dependency, deferred task, or fake await was introduced. Existing adjacent edits by other agents are preserved.

## Implementation and Preserved Contracts

- Document drafts use a per-storage-key cached external-store snapshot. `useSyncExternalStore` exposes an empty, unready server snapshot; subscription restores only when enabled and only once per key. Restoration validates the existing schema and calls `onRestore` with the existing base revision before publishing readiness. Synchronous writes update the authoritative latest draft before storage, retain in-memory changes if storage throws, and publish the resulting error state. Immutable in-flight submission, queued edits, autosave timeout cleanup, and save-lock cleanup remain intact. Switching keys restores the correct document rather than reusing the previous key's ready state.
- Message delivery uses a session-keyed external store, with synchronous existing journal operations and operation-ID acknowledgement guards unchanged. The store keeps the authoritative pending reference and acknowledgement independently of React's subscription timing. A matching early acknowledgement is not resurrected; an unrelated early acknowledgement still permits restoration. Subscription initialization is tracked separately from the pending reference for that distinction. Each subscription removes its listener on cleanup; server rendering reads no browser storage.
- Logical response selection now subscribes to the actual logical controller. Accepted native branch arrival consumes the pending intent before `selectBranch`, preventing recursive controller notifications from selecting again. Original disappearance and controller replacement cannot resurrect the consumed intent. UI state remains derived from pending intent and selected slot. The subscription and pending intent are scoped to controller/user identity and cleaned up together. This replaced an interim deletion-only approach discovered during self-review; the final version preserves one-shot clearing semantics.

## New Browser Coverage

`apps/chat/tests/visual/draft-storage-lifecycle.browser.tsx` has eight tests protecting:

1. Early unrelated acknowledgement does not prevent restoration.
2. Immutable save request keeps newer edits queued and rebases the next operation on the saved revision.
3. Failed synchronous storage writes retain in-memory edits and expose the storage error.
4. Enabled-only restoration, document-key isolation, exact one-time restore callback, synchronous edit persistence, and discard isolation.
5. Empty SSR snapshot hydrates without recoverable errors, then restores both document and delivery journals.
6. Invalid stored JSON exposes the error without restoring an invalid revision.
7. Session-isolated delivery restoration and exact matching acknowledgement clearing.
8. Matching acknowledgement before passive subscription cannot resurrect a delivery.

`apps/chat/tests/visual/logical-selection-lifecycle.browser.tsx` tests unresolved selection, accepted arrival, recursive controller notification, later original disappearance, controller identity replacement, and final listener cleanup. Assertions and callback behavior were not weakened.

## Additional Integrated Type Repairs

- `tests/eve-contracts.e2e.ts`: validates the JSON-round-tripped receipt with `z.json()` so its complete wire value has the required JsonValue type; existing omission assertion remains.
- `tests/eve-idle-checkpoint-live.e2e.ts`: validates the birth identity as a string-keyed JSON record before spreading it. All extra identity fields remain part of the exact comparison.
- `tests/eve-save-copy.e2e.ts`: request mock now honestly declares owner, path, optional request body and model arguments; retry interception forwards the same tuple using `Parameters<typeof original>`.

These repairs address the three regressions reported by the parent's integrated chat type check. Live database/provider acceptance tests were not rerun; parent owns integrated types.

## Verification

- Node 24 PATH and Bun used throughout.
- Configured native `oxlint --type-aware` on all eight changed files: zero diagnostics, including all configured React rules.
- Chromium: **9 passed, 0 failed, 2 suites**, `/tmp/storage-browser.log`; no act, hydration, or unhandled-error warnings.
- Deterministic document-key restoration screenshot inspected; correct restored second document and controls, no overlap. Generated image moved out of the worktree to `/tmp/draft-storage-lifecycle.png`. No existing user screenshots removed.
- Oxfmt applied only to owned changed files. Parent retains global lint/type/generator responsibility.

No remaining issue is classified as retained or unresolved in this follow-up scope.
