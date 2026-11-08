# RC6 history lifecycle assessment

Scope: read-only inspection of official `eve@1.0.0-rc.6` installed for the text branching PoC. This is an implementation assessment, not a newly executed runtime test. Paths below refer to that package's `dist/src` tree.

## Existing path

1. [shared/session-history.d.ts](/tmp/chatjs-text-branching-poc/experiments/text-branching-poc/node_modules/eve/dist/src/shared/session-history.d.ts) declares only optional `id`, `role: user | assistant`, and nonempty `text`. [shared/session-history.js](/tmp/chatjs-text-branching-poc/experiments/text-branching-poc/node_modules/eve/dist/src/shared/session-history.js) rejects unknown fields. Merely returning `parts` from the application is therefore impossible.
2. [eve-channel/types.d.ts](/tmp/chatjs-text-branching-poc/experiments/text-branching-poc/node_modules/eve/dist/src/eve-channel/types.d.ts) explicitly documents `onMessage.history` as prior conversation resolved server-side with caller authorization. This is the right existing trust boundary for ChatJS's immutable reservation, rather than a second `resolveSeed` callback.
3. [eve-channel/index.js](/tmp/chatjs-text-branching-poc/experiments/text-branching-poc/node_modules/eve/dist/src/eve-channel/index.js) HTTP create uses a conditional: when `message` is absent, it constructs auth/clientContext directly; otherwise it calls `resolveOnMessage`. HTTP send also only calls the hook when a message exists. Thus an ordinary message-free HTTP create does not call the app history resolver.
4. [execution/create-session-step.js](/tmp/chatjs-text-branching-poc/experiments/text-branching-poc/node_modules/eve/dist/src/execution/create-session-step.js) calls `withPendingHistory` rather than immediately inserting model history. The declaration explicitly says history from `create()` is held until the first message's turn.
5. [execution/session/turn-step.js](/tmp/chatjs-text-branching-poc/experiments/text-branching-poc/node_modules/eve/dist/src/execution/session/turn-step.js) reads pending history only when a delivery payload contains `message`, adds it to the first delivered input, and removes pending state. `harness/step/intake.js:prepareTurnInput` calls `createImportedHistoryMessages` before adding the actual new user message.
6. `harness/messages.js:createImportedHistoryMessages` maps each text entry into a user/assistant model message. It does not currently stage historical file parts; the staging in `prepareTurnInput` applies to the new user message.
7. `client/conversation.js:Conversation.observe` learns imported display rows from `delivery.consumed.history`. Its message assembly requires consumed deliveries with turn IDs. `client/messages.js:importedMessages` builds only text parts and exposes the app ID in `metadata.historyId` with `metadata.imported: true`.

Primary source directory: `/tmp/chatjs-text-branching-poc/experiments/text-branching-poc/node_modules/eve/dist/src`.

## Consequence for minimal structured history

Widening the existing type and updating validation, model conversion, durable history/event shape, and display conversion is the coherent minimal extension. Completed tool exchanges should become historical call/result pairs, not live calls or open approvals. Imported files also need the existing attachment staging semantics applied to the imported history, not only the new user message.

Edit/regenerate or a fork that immediately submits a first message fits this lifecycle. Use the existing app-owned reservation to freeze the prefix and bind owner, revision, branch intent, and attachment authorizations; onMessage should read that reservation rather than re-read the latest source conversation.

## Copy before first message

**Structured parts alone do not make this work natively.** Even text history from lower-level create is pending until a message; the HTTP hook is skipped on empty create, and the public display projection learns it only at consumption.

Two viable choices avoid another parallel seed API:

- **App-side copied view:** ChatJS durably records and displays its immutable copy snapshot before the first message, then imports that same snapshot through onMessage.history on first send. EVE alone will not expose the copied conversation beforehand. ChatJS must switch/deduplicate the app-projected rows against imported `historyId`s once the consumption event appears. An unknown first-send outcome must stay fenced; do not resend history merely because no event was observed. This is not a claim that EVE has already accepted the copy.
- **Native initialize-with-history on the same contract:** allow server-authorized history resolution for message-free create and expose initialized imported rows without starting inference. This needs a persisted event/projection integration independent of `delivery.consumed`, or a carefully specified history-only delivery that does not create a model turn. Reuse the history schema and converters; do not reintroduce separate seed types, callback, or seed-message reconstruction. An upstream design decision is needed on event semantics. Existing RC6 behavior does not provide this.

Do not simulate this with an empty/dummy user message: it risks an extra user turn, model execution and charging, and changes the meaning of the copied history.

Recommendation: remove resolveSeed for paths with an immediate first message; prefer app-owned pre-send display if ChatJS already needs a durable frozen prefix. Only request native pre-send projection if a copied EVE session must be independently readable before any message. Avoid claiming that preserving current copy UI is free: app-side view synchronization is the tradeoff for keeping upstream's lifecycle small.
