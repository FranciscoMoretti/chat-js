# Library no-await-in-loop audit

Scope: apps/chat/lib/** excluding registry-owned apps/chat/lib/eve/mcp-tools.ts. Baseline membership captured before edits; no config/dependency/public API changes. Other async-rule exceptions were not part of this pass.

## Result

51 baseline files contained 103 disable directives covering 116 actual loop-await sites. Resolved 20 sites (6 production, 14 fixture/test sites). Retained 96 sites in 46 files, each now narrowly next-line scoped with operation-specific rationale. Net directive reduction: 7 (103 to 96); broad block directives and enables removed. Pending/unreviewed: 0. Retention means preservation of the existing ordering/admission/memory contract, not a claim that a differently specified concurrent API would be impossible.

## Implemented refactors

- db/eve-guests.ts: one OR-predicate read for both IP windows, one multi-row reservation upsert, and one refund update for both windows. Existing IP advisory transaction lock still serializes admission/refund; reservation replay and double-refund remain idempotent.
- db/eve-documents.ts: backfill already retained all history metadata, so one ancestry query now retrieves it and groups by document ID (parent revision/document/owner composite FK prevents cross-document ancestry). Missing checkpoint headers use one insert. Legacy fork inference accumulates selected heads only and inserts after validating every ancestry, retaining onConflictDoNothing. Transaction rollback remains the conflict boundary.
- Fixture loops: bounded independent authorization cases, distinct directory setup, marker reads, and teardown now use Promise.all. Mutable one-shot mocks, shared ownership records, retry state, migration dependencies, and foreign-key fixture ordering remain sequential.

## Five document batching candidates

1. Backfill per-head ancestry read: resolved with one metadata query; no newly retained full document contents.
2. Backfill per-turn checkpoint header insert: resolved with one multi-row insert.
3. Backfill per-turn manifest entries: retained. One turn allocates at most one entry per document; batching all missing turns would retain missing-turn-count times document-count entries. Header insert now precedes these bounded writes in the same transaction.
4. Legacy fork per-head ancestry read: retained. The existing algorithm holds one ancestry at a time and keeps only its selected head; batch-reading all histories increases peak memory to the sum of all histories. Existing history length is not bounded to a small fixture count.
5. Legacy fork per-head insert: resolved. Selected IDs are already small per-document metadata; one insert after all ancestry validations preserves transaction rollback and conflict-ignore behavior.

## Verification

- Node 24 PATH and Bun used throughout.
- bunx oxlint --type-aware --format json apps/chat/lib: exit 0, 365 files, zero diagnostics. /tmp/lib-loop-final-lint.json.
- bunx vitest run --config apps/chat/vitest.config.ts apps/chat/lib: exit 0, 129 files, 779 tests. /tmp/lib-loop-final-tests.log. Counts reflect current shared worktree, not earlier concurrent snapshots.
- git diff --check -- apps/chat/lib: clean. Whole-worktree diff-check has unrelated concurrent UI whitespace; not modified here.
- Added PGlite guest-rate tests: both windows reserve/refund exactly once, reservation replay, repeated refund refusal, and separate minute/month limit exhaustion (3 cases).
- PGlite document capabilities now 6 tests: two-document native backfill preserves historical turn numbers and exact revision IDs; two-document legacy fork selects pre-turn heads, replays exact existing heads; malformed manual ancestry rejects and leaves zero child heads; pre-existing tests cover replay-identity conflict, immutable checkpoint selection, and absent published checkpoint boundaries.
- Broader live PostgreSQL e2e tests were not run: no established disposable DATABASE_URL. Root owns full repo lint/types/generators.

## Per-file Counts

Original disable counts differ from sites where old block directives covered multiple awaits. Removed/retained/pending columns count actual await sites, not lines of comments. All paths below are relative to apps/chat/lib/.

| File | Original disables | Original sites | Removed | Retained | Pending |
| --- | --: | --: | --: | --: | --: |
| db/eve-search.ts | 1 | 1 | 0 | 1 | 0 |
| db/eve-documents.ts | 6 | 6 | 3 | 3 | 0 |
| db/eve-document-capabilities.test.ts | 1 | 2 | 0 | 2 | 0 |
| db/eve-queries.ts | 1 | 1 | 0 | 1 | 0 |
| db/eve-search.test.ts | 4 | 6 | 0 | 6 | 0 |
| db/eve-guests.ts | 4 | 4 | 3 | 1 | 0 |
| db/eve-subagents.test.ts | 1 | 6 | 0 | 6 | 0 |
| db/eve-deletion.ts | 1 | 1 | 0 | 1 | 0 |
| db/eve-copy-journal.ts | 1 | 1 | 0 | 1 | 0 |
| db/eve-orphaned-files.ts | 1 | 1 | 0 | 1 | 0 |
| file-storage.ts | 2 | 2 | 0 | 2 | 0 |
| eve/create-response-group.test.ts | 1 | 1 | 0 | 1 | 0 |
| eve/search-hook.test.ts | 1 | 1 | 0 | 1 | 0 |
| eve/local-sandbox-inventory.ts | 1 | 1 | 0 | 1 | 0 |
| eve/verify-local-coverage.ts | 1 | 1 | 0 | 1 | 0 |
| eve/prepare-message.ts | 2 | 2 | 0 | 2 | 0 |
| eve/guest-message-admission.test.ts | 3 | 3 | 0 | 3 | 0 |
| eve/copy-transcript.ts | 1 | 1 | 0 | 1 | 0 |
| eve/usage.ts | 1 | 1 | 0 | 1 | 0 |
| eve/cleanup-expired-guests.ts | 4 | 4 | 0 | 4 | 0 |
| eve/reconcile-usage.ts | 2 | 3 | 0 | 3 | 0 |
| eve/recover-creations.ts | 5 | 5 | 0 | 5 | 0 |
| eve/admission-retry.ts | 2 | 2 | 0 | 2 | 0 |
| eve/cleanup-orphaned-files.ts | 1 | 1 | 0 | 1 | 0 |
| eve/local-sandbox-fence.ts | 3 | 3 | 0 | 3 | 0 |
| eve/checkpoint-readiness.test.ts | 1 | 1 | 0 | 1 | 0 |
| eve/checkpoint-readiness.ts | 2 | 2 | 0 | 2 | 0 |
| eve/restore-message-attachments.ts | 7 | 7 | 0 | 7 | 0 |
| eve/local-sandbox-fence.test.ts | 1 | 1 | 1 | 0 | 0 |
| eve/send-command.ts | 2 | 2 | 0 | 2 | 0 |
| eve/retire-session.ts | 1 | 1 | 0 | 1 | 0 |
| eve/prepare-copy-plan.ts | 2 | 2 | 0 | 2 | 0 |
| eve/save-copy-operation.ts | 1 | 1 | 0 | 1 | 0 |
| eve/local-sandbox-inventory.test.ts | 3 | 3 | 3 | 0 | 0 |
| eve/lifecycle/postgres/eve-native-purge.ts | 3 | 3 | 0 | 3 | 0 |
| eve/gateway-auth.test.ts | 2 | 2 | 2 | 0 | 0 |
| eve/purge-code-sandboxes.ts | 1 | 1 | 0 | 1 | 0 |
| eve/lifecycle/postgres/eve-queue-purge.ts | 3 | 3 | 0 | 3 | 0 |
| eve/lifecycle/postgres/eve-stream-positions.ts | 1 | 1 | 0 | 1 | 0 |
| eve/lifecycle/postgres/eve-session-fence.ts | 2 | 2 | 0 | 2 | 0 |
| eve/lifecycle/postgres/eve-sandbox-coverage-proof.ts | 1 | 1 | 0 | 1 | 0 |
| eve/lifecycle/postgres/eve-resource-fence.ts | 1 | 1 | 0 | 1 | 0 |
| eve/delete-local-conversation.ts | 1 | 1 | 0 | 1 | 0 |
| eve/search-backfill.ts | 1 | 1 | 0 | 1 | 0 |
| eve/disposable-guest.test.ts | 1 | 5 | 5 | 0 | 0 |
| eve/guest-group-admission.ts | 1 | 1 | 0 | 1 | 0 |
| eve/prepare-deletion.ts | 1 | 1 | 0 | 1 | 0 |
| eve/purge-local-sandbox.test.ts | 5 | 5 | 2 | 3 | 0 |
| eve/usage.test.ts | 1 | 1 | 0 | 1 | 0 |
| eve/guest-admission.test.ts | 1 | 1 | 1 | 0 | 0 |
| eve/purge-local-sandbox.ts | 6 | 6 | 0 | 6 | 0 |

## Retained Evidence By File

- db/eve-search.ts (78): Insert at most SEARCH_WRITE_BATCH_SIZE rows per query on the locked transaction; search-backfill awaits each committed batch before advancing.
- db/eve-documents.ts (269, 499, 1066): Acquire each family document advisory lock before deleting checkpoint rows; document writers retain those locks through commit. Headers are already inserted; write one turn's manifest at a time instead of retaining entries for every missing turn times every document. Legacy fork inference reads only one document's ancestry at a time; loading all document histories together would increase peak memory before selecting the pre-turn heads.
- db/eve-document-capabilities.test.ts (43, 45): Apply each checked-in migration after its predecessor so dependent SQL schema objects exist before the next migration and document fixtures.
- db/eve-queries.ts (723): Family deletion must acquire each eve-document advisory lock before changing bound rows to deleting; document writers hold these locks through commit.
- db/eve-search.test.ts (59, 61, 76, 81, 309, 312): Apply ordered schema/history migrations and create each chat before its conversation foreign-key row; preview repair depends on the exact retained migration journal.
- db/eve-guests.ts (410): Each candidate consumes the shared guest balance and IP windows in this transaction; stop at the first rejection before reserving another candidate.
- db/eve-subagents.test.ts (31, 33, 45, 50, 55, 137): Migration SQL and user/chat/conversation foreign-key fixtures require predecessor completion; billing fixtures intentionally replay receipts in order before asserting the ledger.
- db/eve-deletion.ts (273): Probe dependent content tables in declared order and stop at the first surviving row before writing the completed deletion tombstone.
- db/eve-copy-journal.ts (136): Acquire sorted distinct eve-family owner locks one by one to avoid opposite-order deadlocks between source and destination copies.
- db/eve-orphaned-files.ts (43): Finish each owner's family lock and committed file fence before processing the next owner; failed owners must not enqueue later fencing transactions.
- file-storage.ts (93, 95): The next inventory page needs this page's cursor; resolve only this page's file-ID mapping before yielding and fetching another page.
- eve/create-response-group.test.ts (306): Each case installs a one-shot rejection body against the same storage operation; finish resolving and assert recovery persistence before configuring the next.
- eve/search-hook.test.ts (158): Dispatch 300 successive outage events against one recovery buffer to prove it stays bounded; parallel dispatch would test simultaneous writers instead.
- eve/local-sandbox-inventory.ts (89): Read and classify sorted owner.json records one at a time to bound raw owner-file memory and preserve deterministic owned/unattributed output.
- eve/verify-local-coverage.ts (57): Use the single-connection coverage transaction and finish native/local identity verification before checking the next family inventory; mismatch must stop proof generation.
- eve/prepare-message.ts (40, 51): Download, validate, and encode one attachment before reading the next; Promise.all would retain multiple max-size byte buffers at once.
- eve/guest-message-admission.test.ts (74, 81, 95): Each case reconfigures the shared reserve mock or reads its lastCall hash; finish admission and JSON assertions before reusing that mutable fixture.
- eve/copy-transcript.ts (653): Materialization mutates the detached transcript and caches metadata per destination key; finish one part before revisiting the same file or rewriting later parts.
- eve/usage.ts (98): Persist each model-attempt receipt before the next; a rejected ledger write must stop later attempts and unresolved completed calls prevent cursor advance.
- eve/cleanup-expired-guests.ts (30, 36, 38, 41): Claim one expired family and complete its unaccepted-copy or retired-family deletion before the next claim; the five-attempt budget and pending counters depend on that result.
- eve/reconcile-usage.ts (63, 95, 242): Discover and settle descendants before their durable cursor advances; each of four workers must finish its read and observe shared failure before scheduling another.
- eve/recover-creations.ts (26, 28, 60, 66, 76): Recover admitted commands in order and poll only after the previous 250ms delay/read; stop on ambiguous conflict so accounting cannot admit new work.
- eve/admission-retry.ts (23, 32): Only the preceding admission's certified busy error permits a retry; complete its delay and recheck the deadline before attempting admission again. Yield between retryable admissions without holding a server connection. Only the preceding admission's certified busy error permits a retry; complete its delay and recheck the deadline before attempting admission again.
- eve/cleanup-orphaned-files.ts (34): Storage deletion already succeeded; finish each owner's durable file-purge receipt in this bounded batch before marking the batch counted, preserving stop-on-receipt-failure behavior.
- eve/local-sandbox-fence.ts (25, 27, 40): Create every family deletion marker before inspecting operation leases; each write depends on mkdir, and pending work must fail closed without expiring a lease.
- eve/checkpoint-readiness.test.ts (89): Each case installs the next one-shot invalid checkpoint response; await its rejection before configuring another response on the shared request mock.
- eve/checkpoint-readiness.ts (116, 130): A named checkpoint request and its validation must finish before the retry delay; timeout stops polling without allocating or switching checkpoint identity. Retry only after the preceding attempt and delay have completed. A named checkpoint request and its validation must finish before the retry delay; timeout stops polling without allocating or switching checkpoint identity.
- eve/restore-message-attachments.ts (183, 188, 202, 205, 208, 210, 220): Validate original-part ownership before admitting descriptors, then reserve, copy, and digest one file's bytes before starting the next; restore tests cover validation before writes.
- eve/send-command.ts (33, 43): Complete the preceding reader and inspect acceptance/error state before the 250ms delay and next resume; ambiguous failures cannot resubmit the command. Yield 250 ms after an unaccepted resume before checking input and opening another reader. Complete the preceding reader and inspect acceptance/error state before the 250ms delay and next resume; ambiguous failures cannot resubmit the command.
- eve/retire-session.ts (48): Ingest snapshot events in native order before subagent reconciliation; unresolved costs prevent retirement receipts and payload erasure.
- eve/prepare-copy-plan.ts (53, 55): Read and hash one source Blob at a time, retaining only its digest and size in the plan; parallel reads would retain all attachment byte buffers.
- eve/save-copy-operation.ts (112): Accept each reserved destination file through writeEveCopyFile before reading/uploading another; a failed copy must stop before dispatch and bounds live byte buffers.
- eve/lifecycle/postgres/eve-native-purge.ts (92, 99, 187): Purge the currently fenced queue, then fence newly discovered runs before the next inventory pass; retire each session before committing its native retirement marker.
- eve/purge-code-sandboxes.ts (94): The shared provider cleanup session verifies identity, proves absence, and durably releases one resource before the next; a failed resource must retain later ownership.
- eve/lifecycle/postgres/eve-queue-purge.ts (220, 228, 231): Read queue associations, fence newly discovered runs, then repeat; persist stable inventory before removing its last queued associations.
- eve/lifecycle/postgres/eve-stream-positions.ts (39): Issue at most STREAM_POSITION_BATCH_SIZE authorized names per query on the supplied connection; stop on a failed batch and preserve result insertion order.
- eve/lifecycle/postgres/eve-session-fence.ts (87, 99): Fence all newly inventoried runs/streams before taking another snapshot; concurrent snapshots could miss writes admitted before the new fence.
- eve/lifecycle/postgres/eve-sandbox-coverage-proof.ts (133): Verify every native session identity before inserting the saved coverage proof; stop on the first mismatch while the transaction's resource fences remain held.
- eve/lifecycle/postgres/eve-resource-fence.ts (177): Acquire sorted resource row fences sequentially; admitted writers hold shared locks until commit and opposite acquisition order can deadlock deletion.
- eve/delete-local-conversation.ts (22): Await each native family purge before its sibling and before completeEveConversationDeletion; partial purge retains pending state for a full ordered retry.
- eve/search-backfill.ts (33): Flush SEARCH_INDEX_BATCH_SIZE text entries before continuing the snapshot so a failed batch stops later writes and buffered indexing work stays bounded.
- eve/guest-group-admission.ts (40): Validate candidates in input order and return the first policy/ownership Response before any atomic group reservation; do not invoke later validators after rejection.
- eve/prepare-deletion.ts (44): Finish each authorized session's retirement and native preparation before the next; partial preparation must return no inventory and retry the full family.
- eve/purge-local-sandbox.test.ts (106, 108, 222): Each adversarial case rewrites the same ownership record or retries the same provider state; await failure/idempotency assertions before mutating that fixture again.
- eve/usage.test.ts (173): Each malformed receipt is ingested and asserted before the shared billing mock is reused; unresolved external receipts must stay visible to reconciliation.
- eve/purge-local-sandbox.ts (83, 150, 196, 263, 276, 280): Validate resource records before provider effects; snapshot removal passes depend on prior child deletions, and VM destruction must finish before snapshot cleanup.

## Caller And Test Cross-checks

- Family/document/resource advisory and row-lock sites: transaction callers retain locks through commit; sorted owner/resource acquisition avoids opposite-order lock deadlocks. Independent Promise.all query submission on the same transaction cannot supply that acquisition contract.
- prepare-deletion/delete-local-conversation tests cover partial preparation returning no inventory, pending state after partial native purge, and retry of the full ordered family. purge-code-sandboxes tests retain ownership when provider cleanup fails.
- local-sandbox-fence tests require every family marker before checking pending operation leases. purge-local-sandbox tests validate the whole family and remove VMs before snapshot dependency resolution; retry passes depend on prior child removals.
- reconcile-usage tests cover the four-reader scheduling bound, drain-on-failure, descendant discovery and unresolved durable cursors. recover-creations tests cover waiting for concurrent binding without redispatch and closed admission during ambiguous recovery.
- cleanup-expired-guests tests cover the five-attempt budget and partial failures staying pending while cleanup accounting advances. Retry and stream-reader loops use the preceding response/state and deadline before the next attempt.
- copy-transcript tests cover input immutability, one metadata read for repeated file identity and missing allocation before dispatch. Restore/copy tests require ownership and metadata validation before writes; keeping byte buffers per attachment avoids multiplying peak byte memory.
- Fixture migration loops execute dependent SQL before seeding; schema tests use the real PGlite relational constraints. Remaining adversarial test loops explicitly reuse one-shot mocks or overwrite the same ownership/provider state before the next assertion.
