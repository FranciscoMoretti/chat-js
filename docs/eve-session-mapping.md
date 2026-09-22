# Session-to-branch mapping investigation

## Baseline and scope

This work starts at `da78b23ae977ecafb997d36eb12b3c861b8057e1`, with the immutable `eve-identity-handoff-o3tqknyy` patch and untracked archive applied. The inherited UI changes, initial-request journal, migration, recovery executor and accounting fixes are preserved. The two provisional `recover-session-binding` files are deliberately replaced by the existing `conversation-scope` module and its tests.

The source checkout and EVE fork were inspected without edits. Verification uses a cloned installation of the source's local tarball package, `@chat-js/eve@0.61.0-chatjs.0`, not registry `eve@0.61.0`. Its resolved installation directory contains `@chat-js+eve@+tmp+chatjs-logical-eve-fixed.tgz+2fbf0e02e2b8d290`. The handoff lockfile does not describe that local installation; an ordinary fresh install is not an equivalent reproduction.

The isolated app is `http://localhost:3080` (worktree slot 8), using `chatjs_identity_test` and `eve_identity_test` on local PostgreSQL port 5447. Source port 3060 and source databases were not reused or reset. Node 24 and Bun were used.

## Identity trace

| Identity | Owner and purpose |
| --- | --- |
| Browser `input.operationId` | ChatJS browser retry/admission identity. Stored with an owner uniqueness constraint; also used for initial message delivery metadata. |
| Reservation `EveConversation.id` | ChatJS branch identity and the existing native creation key. `createEveConversation` passes **this ID** to its dispatch callback. It is not the browser operation ID. |
| `EveChat.id` | Logical chat containing the branch tree; ChatJS owns active view selection, lineage and product metadata. |
| Native continuation token | EVE derives an owner/authenticator/issuer/principal-type/operation-scoped token. Seed creation has a separate namespace. Auth attributes do not participate in this derivation. |
| Canonical `sessionId` | EVE's accepted execution/transcript identity. One session binds to one ChatJS branch. |

Evidence in the inspected EVE fork (`packages/eve/src/`):

- `eve-channel/request.ts:28`: operation token derivation includes the authenticated principal and existing operation key.
- `eve-channel/create-session-route.ts:125`: anonymous operation IDs are rejected; existing ownership is resolved before starting another candidate.
- `execution/session/entry.ts:123`: the stable and continuation hooks are claimed before normal turn execution. A continuation loser exits rather than running a duplicate normal turn.
- `eve-channel/create-session-route.ts:288`: the HTTP response resolves the canonical owner, including when another candidate won; unresolved acceptance returns `eve_operation_pending`.
- `execution/runtime-context.ts:71` and `execution/session/turn-step.ts:170`: a message creation seeds initiator auth; later deliveries update current auth without replacing an existing initiator. Idle seeds defer initiator identity until the first message.
- `subagents/tool.ts:65`: children inherit initiator auth but receive a distinct continuation and native session. An inherited attribute is therefore **not** proof that a child owns its parent's branch.
- `execution/restore-session-checkpoint.ts`: forks restore transcript/resource state into the target; they do not replace target execution identity with the source's identity.
- `channel/forwarded-principal.ts:101`: an asserted forwarded principal is rejected without configured trusted forwarders. ChatJS does not configure them.
- `context/session-context.ts`: public hook context exposes the exact session ID, auth and lineage, but not the accepted operation key/receipt.

The corresponding installed `dist/src` functions were exercised in a Node probe: owner and seed namespaces differ, changing attributes does not change operation identity, browser and reservation keys differ, current-auth replacement preserves initiator auth, subagent construction inherits the reservation attribute with a distinct continuation, and forged forwarding is rejected with 403. This is runtime construction/authorization evidence, not a live model-driven subagent end-to-end run.

## Chosen implementation

No new ID, schema, EVE interface or lifecycle state is needed.

1. The existing gateway validates the bearer credential first. For creation, it reads the body without consuming it, finds the exact reservation, verifies owner, live state and message-versus-seed namespace, and stamps `chatjsReservationId` into authenticated attributes. An arbitrary header or message metadata cannot choose this attribute.
2. The hook passes that initiator attribute alongside its trusted native session ID. The attribute locates a row; it does not authorize binding by itself.
3. `resolveEveConversationScope` reads that exact row, including tombstones. A bound row must match both owner and native session. For an unbound message reservation, the owner-scoped native operation receipt must name the hook's **exact** session before the shared binder can write it.
4. The binder atomically enforces owner, live state and a non-conflicting session. A session-scoped transaction lock gives simultaneous claims by different branches a deterministic domain error rather than a raw uniqueness exception. The database unique constraint remains the final invariant.
5. Already-bound sessions without the new attribute resolve through their exact native-session binding. Pending seed copies stay with their existing resource/copy journal; hooks do not complete half of that transaction.

The owner-wide receipt scan and five-second binding polling loop are removed. The successful hook write clears the inherited initial-request journal in the same transaction as binding, just like the HTTP caller. If the hook wins, the later HTTP write is idempotent.

The native receipt check remains deliberate. Initiator attributes are inherited, and EVE does not expose a public immutable accepted-operation receipt in hook context. An attribute-only writer would authorize the wrong session. A future zero-lookup design would need equivalent exact-session acceptance proof; it should not introduce another application identity.

## Errors and retained safeguards

| Code | Meaning |
| --- | --- |
| `unauthenticated` | No authenticated owner in trusted context. |
| `identity_pending` | No binding for pre-attribute context, or a copy journal has not completed. Not proof of corruption. |
| `receipt_pending` | Native operation lookup has no acceptance receipt yet. Not treated as proof of rejection. |
| `receipt_unavailable` | Network failure, failed HTTP lookup, or an unusable lookup response. No binding is guessed. |
| `identity_missing` | A trusted explicit reservation identity has no durable row. |
| `owner_mismatch` | The located identity belongs to another owner. |
| `identity_deleted` | Deletion is underway or complete; no resurrection. |
| `binding_conflict` | Malformed identity, contradictory state/session, inherited wrong-session identity, or competing binding. |

Database connectivity errors and aborts remain errors; they are not relabeled as corruption. No mismatch is silently rebound.

The initial command journal and owner recovery are retained: authenticated context cannot deliver a request that never reached EVE, nor reconstruct lost attachments/tool selection. Admission, native idempotency, usage reconciliation, credit policy, completed unknown-cost blocking, failed-step evidence and deletion fences are unchanged. Copy resource acceptance and cleanup also retain their existing journals.

## Verification

- `bun lint` and `bun test:types` pass.
- EVE unit suite: 359 tests pass, including mapping errors, inherited wrong-session identity, missing auth, network failure, seed namespace gating and forged headers.
- Focused PostgreSQL suites: 32 tests pass across creation recovery, contracts and usage cursors. New cases exercise the actual mapping function while dispatch is held, competing session claims, owner rejection, missing rows and deletion without rebinding.
- Real-worker suite: two tests pass. One holds the accepted native HTTP response inside the caller's transport until the independent authored hook binds, then throws away the response. Retry returns the same session with one dispatch and a cleared journal. The other concurrently dispatches the same key, verifies one canonical session, and checks foreign reservations (401), foreign receipts (404), and forged forwarded principals (403).
- Browser: new chat (`READY`), reload, follow-up, regenerate, previous-version selection, edit, reload preserving branch selection, save a shared copy and send its first follow-up (`COPYOK`). The original chat had three branches with distinct session IDs and correct parent links. React inspection confirmed that switching branches changes the selected conversation/session while keeping the logical chat draft scope.
- Browser deletion: copied chat deletion first returned pending cleanup (202); normal retry completed it (200), leaving a tombstone. The original three-branch family also reached three `deleted` tombstones through the existing coordinator; a direct diagnostic invocation of that same coordinator completed its pending cleanup, and browser status was checked afterward. No database rows or accounting guards were bypassed.
- Next runtime inspection returned no compilation issues or runtime errors. The isolated worker was restarted after authored-hook changes; testing did not rely on Next-only hot reload.

The real-worker suite is intentionally separate from ordinary tests and requires the matching live isolated worker:

```sh
EVE_INTERNAL_ORIGIN=http://localhost:3080 bunx dotenv -e .env.worktree.local -e .env.local -- bunx vitest run --root apps/chat --config vitest.eve-runtime.config.ts
```

It retains its test users/native sessions in the isolated database for inspection. The local installed-package probe and execution logs are under `/tmp/eve-native-identity-probe.mjs` and `/tmp/eve-identity-*` in this task's environment.

## Limitations and baseline failures

Existing bound sessions need no backfill. **An already-accepted, unbound session created before the attribute existed cannot be identified directly by the new hook path.** Reconcile those reservations with the existing owner recovery/caller retry before switching them to this hook implementation. Existing authored snapshots may keep their earlier hook code; this change does not backfill their auth attributes. The resolver reports pending identity rather than scanning or guessing. This task did not mutate or reconcile the source application's sessions.

Native operation lookup resolves continuation ownership; it is not a new permanent application receipt store. This change does not establish an unlimited retention guarantee for missing receipts after native retirement. A continuing receipt/DB outage still prevents hook authorization; fail-closed classification is not a promise of eventual success during an outage.

Broader copy verification produced five failures on both this change and a separately reconstructed, untouched handoff baseline: four cleanup/revocation cases encounter `The entire conversation family must be pending deletion`; one invalid-seed case receives a document-boundary validation error before its expected size error. The two suites contain 15 passing and five failing tests. They were not changed or concealed. The ordinary browser save-copy/follow-up/delete path passed separately.
