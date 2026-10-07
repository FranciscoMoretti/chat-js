# Caller correlation on exact received messages

Local proposal, 6 October 2026. Not published, accepted upstream, or a supported replacement for ChatJS's metadata extension.

Target: published eve **0.71.3**, source `fab8ba1424eddfdedd6a177cac21710258da0e81`, bundled Workflow core/world **5.0.1** (serde **5.0.0**), AI SDK **7.0.106**. Lane D selected this baseline. Main is not used.

## Problem and proposed contract

A proxy can receive eve's positive admission response and crash before saving the generated delivery ID. Neither an application transaction nor tracing headers make that remote admission atomic with its mapping write. Matching message text fails for identical submissions. Turn-wide `meta.deliveryIds` is not an exact received-message receipt.

Add optional `correlationId: string` to HTTP creation with an initial message, HTTP fixed-session message sends, authored `Session.send`, and the client creation/send serializers. Emit `data.correlationIds: readonly string[]` on the exact durable `message.received` event. The names remain proposals.

1. Token is opaque, 1–128 ASCII letters/digits/underscore/hyphen. Reject invalid values and tokens on control-only or message-free HTTP requests. ChatJS uses UUIDs. The token grants no authority.
2. Carry it in the durable inbox payload, separate from auth, client/model context, tool arguments and tracing. Runtime associates the token with the result of that payload's delivery hook; authored `StepInput` cannot invent its association.
3. List every materialized contributing token in message contribution order. Do not collapse distinct identical messages. Preserve repeated tokens if the caller sends one twice: correlation does not deduplicate admission.
4. A control-only payload contributes no token and cannot erase a preceding user token. A normalized-away or ignored payload produces no fabricated received-message receipt. Unrelated events, later messages, or later turns do not inherit these IDs.
5. Persist event tokens through normal stream replay. No matching receipt means unconfirmed; positive admission may precede materialization indefinitely. A late receipt can move uncertain/admitted to received.
6. Scope interpretation to the authenticated owner and exact native session of the stream, then to a preexisting immutable ChatJS submission. Never discover ownership from a token. Never attach annotations belonging to another scope.
7. No automatic resend, inbox idempotency, exactly-once model execution, exactly-once tools, or generic metadata storage is promised.

The experimental patch covers HTTP parsing/forwarding, public client serialization, authored fixed-session sends, first-input construction, delivery-to-step binding, coalescing and event emission. It deliberately does not upgrade production dependencies or replace ChatJS metadata consumers. Aggregate token count/event-size limits still need an upstream decision consistent with queue limits: silently truncating a contributing ID is unacceptable.

## Creation identity is separate

`docs/eve-creation-recovery.md` describes a persisted immutable creation command, reservation lock, native operation receipt lookup and owner-scoped binding. Preserve those semantics. Caller correlation cannot find a session whose allocation response was lost, and cannot authorize a second creation.

The experiment loses the creation response after real admission. A test-only oracle records the session ID solely to inspect the runtime evidence. **The application has no recovered identity in that test.** The receipt is recoverable once the identity is independently known; allocation recovery is not proven.

Released 0.71.3 accepts a creation `operationId` and resolves its continuation token on repeated creation, but that is a different operation contract. This lane neither replaces the fork's operation lookup nor repeats uncertain creation requests. Separate proof must establish scope, immutable-command conflicts, lookup, retention, concurrent allocation and existing-run behavior before retiring that dependency.

## ChatJS owns annotations and submission state

Persist before dispatch: authenticated owner, logical creation operation or exact session, UUID, immutable effective command (including attachments/model/tool), selected display tool including explicit `null`, and dispatch state. Bind unknown creation session only using an independently verified native operation receipt. An expired dispatch lease is not permission to resend.

After a trusted exact message event, join every ID against that scope. Acknowledge every matching submission. Project the selection belonging to the **last contributing ID**, including `null`; do not fall back to an earlier selected tool when the final submission is missing. All ChatJS message sends must carry IDs for this rule; imported/native untagged contributors need an explicit unavailable annotation policy.

Persist a projection keyed by native session and stable materialized message identity, plus ordered contributing IDs, before advancing the reconciliation cursor. Stream retention must not erase annotations from history. On reload, render this app projection without requiring the pending tab draft. Copies store a sanitized selection snapshot; never copy delivery tokens or reuse source submission identities as fresh acknowledgements. Shared views expose only display-safe fields.

The isolated projection example demonstrates scope and last-null-selection behavior after JSON serialization. It is **not** a production database schema, migration, authenticated-stream implementation, or persistence integration.

## Current consumers that block metadata removal

| Consumer | Required replacement |
| --- | --- |
| `lib/eve/message-delivery.ts` and `components/eve/use-eve-message-delivery.ts` | Reconcile every contributing ID; retain exact session/owner binding and operation-specific pending cleanup. |
| `app/api/eve/[...path]/route.ts` | Validate token, bind immutable authenticated submission and selected tool; forward only narrow correlation. |
| `lib/eve/execute-conversation-creation.ts` | Same token on initial input; preserve separate native creation-operation recovery. |
| `lib/eve/message-tool-selection.ts` | Read app-owned durable projection for live and restored messages. |
| `lib/eve/logical-chat.ts` (`logicalNativeId`) | Replace scalar operation-derived identity with stable materialized-message identity, retaining all submission aliases across reload/coalescing. Do not pick an arbitrary contributing ID as identity. |
| `lib/eve/copy-transcript.ts`, `shared-messages.ts`, `components/eve/use-eve-fork.ts` | Copy/share/edit from sanitized last-contributor selection; strip source operation acknowledgements. |
| Existing durable native history and saved copies | Backfill/read legacy scalar metadata alongside new projection until migration is proven; tokens alone cannot reconstruct past tool selection. |

## Evidence and remaining gates

See [experiment](../../experiments/eve-delivery-correlation/README.md). Stock 0.71.3 accepts the test HTTP requests but discards the token. The local patch passes the isolated worker proofs, including actual process death and same-world replay after completed turns. The lost follow-up is never resent. In-flight checkpoint recovery is a separate unproven boundary. Neither observation is supported upstream parity.

Before removal: upstream acceptance and a consumable release; aggregate size/retention semantics; in-flight restart/checkpoint and Postgres proofs; terminal queued-cancellation disposition; allocation recovery proof; production submission/projection persistence and history/copy migration; adversarial authenticated owner/session binding; and clean integration checks. No product decision is needed to retain the current guarantees while these dependencies remain.

## Creation allocation is a separate proven gap

The released 0.71.3 HTTP creation endpoint already accepts authenticated `operationId`: repeating it while its continuation is live returns the same session. This is not missing creation deduplication. The real worker probe `experiments/eve-delivery-correlation/creation-lookup.ts` also proves that after terminal `session.reset()`, the identical operation POST allocates a different session. Its GET `/eve/v1/operation/:id` route is absent.

ChatJS's existing creation journal needs a read-only, principal-scoped immutable allocation receipt: an accepted operation must continue to identify its original session or explicit retired disposition, never an active replacement. First-turn hooks use that receipt to validate the reservation/session binding before effects. Reposting a create command is neither a read-only lookup nor a lifetime receipt. Keep this requirement separate from the per-message `correlationId` proposal; do not add it implicitly to the correlation patch or enable automatic create recovery POSTs. Current app lookup remains in place pending an equivalent supported contract.

The local application migration is documented in `docs/eve-submission-journal.md`. It retains the metadata seam while persisting immutable commands and app-owned annotations. PostgreSQL abrupt-restart liveness remains dependent on the adapter's dead-worker job recovery; no absence of a receipt is classified as rejection.
