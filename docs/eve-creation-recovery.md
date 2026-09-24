# Interrupted conversation creation

## Incident and evidence

On September 21, 2026, the local browser reproduced `Usage reconciliation is unavailable` on a new message. One earlier `hello` creation had a committed ChatJS reservation in `uncertain` state and no session binding. Owner usage reconciliation rejected that row before reading any usage streams. The API then mislabeled this creation failure as usage unavailability.

The native operation lookup returned `eve_operation_not_found` for the reservation ID (the native idempotency key). Retrying the original immutable command succeeded with the same reservation. The initial transport exception was discarded by the old implementation, so its precise historical cause cannot be established from the retained logs. A successful retry is not evidence that the original worker failure is understood.

## Recovery boundary

- Admission validates ownership, model and credits. It persists the complete creation command on the existing reservation before dispatch.
- Execution is separate from admission. Both explicit browser retry and recovery call the same executor, reservation transaction lock and native idempotency key.
- Owner reconciliation first finishes interrupted message creations, then reconciles their native usage, then allows admission to continue. It does not skip unbound rows or certify unknown usage as free.
- Native receipts are checked before dispatch. A lost response adopts the existing native session; a request that never arrived reuses its original identity and payload.
- The temporary command journal is cleared in the binding transaction and during deletion. It is recovery intent, not another model transcript.
- Earlier plain-text commands without content hashes can be reconstructed exactly from existing immutable columns. Older attachment/tool commands without journals still require their original request; recovery never guesses missing content.
- Saved-copy and deletion journals remain separate. Their unresolved states retain the existing admission guard.
- Logs identify operation, error type, native phase and HTTP status without logging message bodies or credentials. Recovery failure has its own API code instead of being labeled a usage failure.

## Verification

- Real browser: reproduced the original failure, retried its original operation, received a response, reloaded, and sent a follow-up.
- Real worker: injected a lost response after successful native acceptance. A subsequent browser creation recovered that reservation automatically. The native receipt and ChatJS binding matched, and the temporary journal was cleared.
- PostgreSQL integration tests: request never dispatched; accepted request with lost reply; continued outage preserves the journal and prevents new admission; retry does not allocate a duplicate; recovered session enters usage reconciliation.
- Existing billing cursor tests retain their unknown-cost and replay checks.
- Deletion contract assertions now use logical-chat identity and verify metadata erasure on the chat record rather than the branch record.

## First-turn binding race

The lost-response browser probe exposed a second failure: `turn.started` waited five seconds for the HTTP caller to bind the native session, then parked the session with `Conversation binding is not ready`. A later successful binding alone did not repair that failed turn.

Native scope resolution now looks up pending owner reservations by their native operation receipts. It binds only a receipt whose session ID exactly matches the trusted hook context, using the same atomic binding operation as the HTTP caller. The binding write is owner-scoped, rejects deletion and conflicting sessions, and tolerates the hook winning the race against the HTTP response. It neither trusts a model-provided conversation ID nor merely extends the timeout. The worker was restarted to load the changed authored hook bundle before repeating the live probe.

## Failed-step evidence during deletion

Deletion of the deliberately failed test sessions revealed a shared parser inconsistency: `step.failed` persisted an unknown-cost evidence record and returned `false`, which retirement interpreted as an unpriced completed call. Owner admission already excludes failed-step events from that condition. The parser now preserves the evidence but returns no completed-charge result for failed steps, consistently with failed auxiliary hook calls. Unknown completed model/tool charges remain blocking. Both failed test sessions were subsequently removed through the normal authenticated deletion API; no rows or guards were bypassed.
