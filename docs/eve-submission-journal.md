# Durable EVE submissions and display annotations

The application keeps the existing runtime metadata and creation-operation lookup seams. The narrow caller-correlation patch remains an isolated proposal; production requests do not claim the proposed upstream API exists.

`EveSubmission` binds an authenticated owner and operation UUID to one conversation and original command. JSONB equality rejects changes to message parts, attachments, model, tool choice, target or creation input. Follow-up dispatch uses a database compare-and-set from pending to uncertain, committed before the network call. Only that claimant sends. No expiry, reconnect or repeated POST reclaims an uncertain/admitted/received operation.

Positive EVE acceptance advances uncertain to admitted. An exact scoped received-message receipt advances to received. App rejection before dispatch, or EVE's explicit `session_not_active` response, records rejected. Transport failure and missing evidence remain uncertain. Turn cancellation, waiting and completion do not acknowledge or reject queued submissions. The authenticated read endpoint at `/api/eve/submissions/{sessionId}/{operationId}` reconciles from a native snapshot and exposes the recorded status without redispatching.

`EveMessageAnnotation` projects every ordered contribution, with the last contributor's tool choice winning even when it is null. Projection joins only submissions belonging to the authenticated owner and exact bound session. Unknown or mixed proposed tokens cannot borrow another submission's annotation. The browser matcher checks the projected session and all operation IDs. Existing scalar metadata remains readable. Repeated materialization under a changed native event ID keeps the first receipt canonical; the logical graph aliases the scoped operation identity. This is not an exactly-once event or effect guarantee. Native duplicate events remain in authoritative history; public/copy native event deduplication is not claimed.

Older scalar, seeded-copy and restored history imports display annotations without fabricating immutable submission commands or transferring acknowledgement authority. Public transcript/copy readers project before sanitizing through existing shared-message rules, which strip private owner/operation data. Existing copies keep their sanitized display metadata. Creation reservations still persist their original input before dispatch and recover through the existing native operation receipt; first-hook ownership binding continues to require that receipt.

Family deletion erases command content and annotations, retaining only the scoped operation fence and retired state. Retired IDs cannot target another conversation. Migrations 0009 and 0010 were generated with Drizzle and applied only to the disposable lane_c PostgreSQL database. Existing migration checksums are unchanged.

## Proofs

- Real PostgreSQL: concurrent reservation/claim, immutable command and session conflicts, owner isolation, uncertain-to-received recovery, coalesced all-token/last-null display, legacy/copy import, changed-event-ID replay, cancellation then queued receipt, deletion erasure and retired-ID rejection. The actual authenticated proxy uses the real ledger while native transport is fault-injected; a lost response yields one dispatch and an uncertain row, repeated POST does not dispatch, foreign access fails.
- Existing creation recovery suite passes with the new journal alongside its existing reservation/receipt behavior.
- Browser fixture uses the actual delivery hook. Pending state survives reload, foreign-session and unrelated receipts do not clear it, an earlier coalesced contributor does clear it, and rejection/draft restore remain usable. Local pending/recovered captures were inspected. UI Verify fleet comparison is unavailable without `UIVERIFY_API_KEY`; no fleet-baseline claim is made.
- Released-runtime creation probe confirms live-operation reuse and a new allocation after terminal reset. Read-only operation lookup is absent. Caller correlation cannot substitute for a lifetime immutable allocation receipt.
- Patched-runtime cancellation probe confirms `turn.cancelled` on the active turn followed by a real receipt for the previously queued token, without another send.
- PostgreSQL in-flight CLI shutdown/restart recovered a queued token with one dispatch, but also replay-appended the initial received event. Abrupt server SIGKILL with validated shared controller starts worker2; the 15-second observation did not recover the token, with jobs still locked to dead Graphile workers. This is a liveness limitation, not a rejected delivery or permission to resend. Operator recovery is a separate Lane D proof.

## Local validation

Use Node 24.20.0 and Bun. See the isolated experiment README for pinned runtime/adapter provenance. The app database tests require explicitly setting `DATABASE_URL` to the disposable lane_c URL, plus fixture-only auth/gateway environment values:

```sh
bun run --cwd apps/chat test:unit --config vitest.eve-submissions.config.ts
bun run --cwd apps/chat test:unit lib/eve/message-delivery.test.ts lib/eve/message-tool-selection.test.ts lib/eve/logical-chat.test.ts lib/eve/copy-transcript.test.ts 'app/api/eve/[...path]/route.test.ts'
bun test:types
bunx --no-install tsc --noEmit -p experiments/eve-delivery-correlation/tsconfig.json
bun lint
```

The central lint-exception baseline belongs to Lane D. This lane exports scoped exception snapshots for integration; full lint stops at that pending baseline integration. Targeted type-aware lint checks the changed code independently.
