# Replace the parallel transcript-seed API with native history import

Assessment, 2026-11-08. No implementation or issue posting. Sources are the pinned official EVE 1.0.0-rc.6 package, published @chat-js/eve 1.0.0-rc.1-chatjs.0, and ChatJS c406327. This is not a claim about later upstream releases.

## Recommendation

Extend `onMessage.history` with structured user/assistant content. Retire `resolveSeed`, seed-only create, and the seed initialization wait for operations that immediately send a message. Keep owner authorization, source capture, resource membership, immutable operation intent, and uncertain-delivery fencing in ChatJS. Do not add an EVE admission ledger or lookup adapter.

This is a modest public API addition, but more than widening a TypeScript type: the model-history conversion, durable delivery representation, display projection, and attachment staging must all agree. Reuse existing lifecycle and attachment mechanisms instead of porting the seed subsystem wholesale.

## Evidence and minimum extension

Official `shared/session-history.d.ts` defines `{ id?, role, text }` and rejects unknown fields. `eve-channel/types.d.ts` exposes this through `onMessage.history`. `harness/messages.js:createImportedHistoryMessages` maps text directly to model content. `harness/step/intake.js:prepareTurnInput` imports that history but stages attachments only on the new message. Consequently changing the input type alone would bypass attachment preparation for history.

Suggested shape (design sketch, not an existing API): retain upstream's current text form and add a mutually exclusive `parts` form with the same optional app message ID and user/assistant roles. This preserves upstream consumers; ChatJS itself needs only one canonical structured representation, not a compatibility adapter. Exact part naming should follow EVE's existing public part vocabulary.

Required parts: text; assistant reasoning text where supported; file references using existing channel resolution; completed tool exchanges with JSON/text input/output, error or denial; ordered step boundaries where needed. No pending calls, resumable execution IDs, approval capabilities, or raw workflow state. Do not promise opaque provider-specific reasoning/signature preservation.

Model conversion must translate each completed tool exchange into matching assistant tool-call and tool-result messages, preserving order before later assistant text. Import does not execute tools, authorize them, or create current charges. Historical denial remains historical; new calls use native approval. Source IDs stay app references, not execution IDs. Derived tool IDs must be namespaced per imported batch/message to avoid collisions with later imports.

Extend `delivery.consumed.history` (currently `ImportedMessage` with text) and its client projection to preserve the structured display. Reuse `metadata.imported` and `metadata.historyId`; no `seed_message_i` protocol. Do not fabricate execution or billing events for imported calls. SDK transcript/search helpers also need a consistent textual projection of these parts.

## Attachments: scope and tradeoffs

Use the existing `fetchFile`, upload policy, sandbox staging, and hydration path. Process files inside imported history before the first model call as well as files in the new prompt. Assistant-file support needs role-aware normalization; the current inbound staging helper accepts user content. Do not serialize raw bytes into the durable history as a shortcut.

The shipped fork's file shape requires `existingPath`, not just a URL. Its `stageSeedFile` resolves authorized bytes and verifies/reuses that shared-workspace path; later hydration also checks digests. These are fork-specific guarantees, not requirements for generic history import. Our previous broad description of this package as simply copying attachments into a fresh sandbox was incomplete.

ChatJS must continue owner/resource checks and immutable original identity. Exact workspace path retention and continuous digest enforcement should be app-provider responsibilities or explicitly dropped. Restaging a file at a new path can break old tool outputs that refer to the former path; do not claim full workspace continuity unless the app preserves it. Never blindly reuse source-session refs.

Native RC6 behavior degrades unstaged/unavailable files to notes, including when no sandbox is available. Reusing that behavior means accepting it explicitly, or enforcing stricter readiness in the app. A preflight alone cannot guarantee later availability. Sandbox-independent files, durable resolvers, URL renewal, and a storage-system redesign remain separate work.

## ChatJS-owned authorization and immutable intent

Current `apps/chat/lib/db/eve-current-copy.ts:initializeEveCurrentCopy` captures the completed prefix, document heads/revisions, file memberships, and initial seed under owner/workspace fences before dispatch; an existing seed is not recomputed. Preserve that capture, renaming its payload to imported history.

Use the authenticated server gateway to carry the reservation reference to `onMessage`. Resolve it against owner, destination, accepted operation and its frozen payload. Do not trust browser-supplied transcript/source IDs or recapture live source history on retries. The callback only projects previously admitted intent; it does not admit, charge, dispatch, or mint new operations.

For edits/regenerations, create with history plus the replacement/regen prompt in one native operation instead of seed-create -> wait -> send. Record the exact returned session/delivery binding when known. An interrupted response remains unknown and fenced; absence of lookup evidence is never permission to resend. Do not attach history on every send. Existing/prewarmed destination sessions require explicit app import state; `sessionId === undefined` alone is insufficient if native session creation happened earlier.

## Copy without a first message

Native imported display is currently tied to consumed delivery history. A seed copy currently creates immediately visible native messages without model work. HTTP create explicitly skips `onMessage` without a message. Lower-level create stores history in `eve.session.pendingHistory`; `turn-step` consumes it only when a delivery contains a message. The client places imported rows under a consumed turn. Ordinary create-without-message is therefore not equivalent. Do not send a dummy prompt or assume a history-only send will avoid execution or charges.

Preferred smallest upstream request: structured history on existing deliveries. ChatJS can display its immutable captured prefix while the copy awaits its first real send, and import it then. Tradeoff: the copied transcript exists app-side until then; native snapshots are not yet authoritative for that prefix. Reload, search, sharing, votes, nested copies and deletion must consistently use that saved prefix. Switch to native imported rows by app history ID without duplicate rows. Retain files/documents independently of source deletion. This is feasible, but it is an additional app display projection and not free simplification.

If native display before the first send is a firm requirement, ask separately for history at ordinary session initialization using the SAME history type, converter, and display projector, without scheduling inference. Creation-only `onMessage` invocation and durable initial-history visibility need defined semantics; extending only `onMessage.history` cannot supply that guarantee. This is additional lifecycle support but need not be a second public seed API.

A simpler explicit product tradeoff is to offer branch-and-send only and defer standalone copied-conversation creation. Do not silently disable standalone copy.

## Removal and migration inventory

Remove fork `resolveSeed`, `SessionTranscriptSeed` protocol, `seed: true`, seed emitter, seed-only projection, and attachment seed path once their required behavior has moved or been intentionally dropped. Reuse native import machinery.

ChatJS: adapt channel resolver; `execute-conversation-creation.ts` and `create-native-copy.ts`; remove `waitForSeed` handling; change `logical-chat.ts` from positional `seed_message_i` matching to imported app IDs; update transcript capture, search/backfill, votes, nested branches, and tests that read `session.started.transcriptSeed`. Retain app reservation/resource state. Existing stored fork histories require a separate migration/reset decision; this assessment does not authorize a reset or maintain a legacy reader automatically.

Verification before removal: real structured round trip through native snapshots and model input; tool success/error/denial without reexecution; new approval and charge behavior; attachment resolution under the destination owner; nested edits and ID mapping; empty-prefix edits; source mutation after capture; unauthorized reservation/file access; interrupted create with no redispatch; and whichever pre-send copy display semantics are chosen. Prior PoC validates text only, not this proposed structured extension.

## Source pointers

- Official package: `experiments/text-branching-poc/node_modules/eve/dist/src/`: `shared/session-history.d.ts`, `eve-channel/types.d.ts`, `harness/messages.js`, `harness/step/intake.js`, `harness/attachment-staging.d.ts`, `client/messages.d.ts`, `protocol/session-events/families/delivery.d.ts`.
- Published fork: `/tmp/eve-fork-contract-check/package/dist/src/`: `protocol/session-events/families/transcript-seed.d.ts`, `execution/session-transcript-seed.js`, `harness/seed-attachments.js`, `harness/attachment-staging.js`.
- ChatJS: `apps/chat/agent/channels/eve.ts`, `apps/chat/lib/db/eve-current-copy.ts`, `apps/chat/lib/eve/execute-conversation-creation.ts`, `create-native-copy.ts`, `logical-chat.ts`, `channel-files.ts`, `workspace-attachments.ts`.

See the [independent lifecycle trace](./structured-history-lifecycle-assessment.md) for function-level references.
