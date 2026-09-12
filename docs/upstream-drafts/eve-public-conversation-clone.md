# Draft: create a private session from a public transcript

Unpublished implementation proposal. The local native seed primitive is implemented and tested; the ChatJS save/copy operation is not integrated yet.

## Problem

ChatJS lets an owner publish a read-only conversation. A viewer should be able to save that visible conversation to their own chats and continue it. The saved copy must survive later source edits, revocation, and deletion.

The current native checkpoint fork is an owner-only editing primitive. `restoreSessionCheckpoint` copies the model history and, when present, the sandbox checkpoint. Its resource-copy guarantee is useful for editing an owner's conversation, but unsuitable for a different viewer: the sandbox can contain files that were never published. The source history can also contain provider/tool data beyond the public message projection. ChatJS deliberately removes connection challenges and tool runtime metadata from public messages.

Allowing public source IDs in the existing `authorizeFork` callback would therefore grant more than access to the published transcript. Do not widen that callback to implement this feature.

## Reproduction to add before implementation

1. Create an owner session with a visible answer and a private file in its native sandbox that was never attached to a message.
2. Include a connection challenge containing an owner-only URL/code and tool runtime metadata in the source events.
3. Publish the conversation and verify the shared UI excludes the challenge and metadata.
4. Attempt to save it as a different authenticated viewer.
5. Assert the destination contains the exact public messages, starts with an empty sandbox, and cannot read the private file, source credentials, owner-only challenge, or source runtime state.
6. Unpublish and delete the source. Assert a previously completed copy still displays its own attachments/documents, while a new clone request fails.

Current access control rejects step 4. A naive public-source fork grant would restore private sandbox content instead of providing the required boundary.

## Proposed native primitive

Add a distinct server-authorized `seed` input for a fresh idle session, rather than another flag on full checkpoint restoration. The browser supplies only an opaque source/revision request and operation ID; it never supplies trusted history or an arbitrary native session ID.

The application callback authorizes the public source and returns a validated immutable public transcript projection. It includes paired completed tool calls/results where those are published, supported file references, and visible message identities. Connection challenges, execution identities, tool authorization metadata, billing events, system instructions, and sandbox snapshots are excluded. Reject unsupported or unresolved parts rather than quietly dropping history. This mode must not replay tool calls or start a model turn when the user clicks Save.

EVE owns the destination history and emits its initial visible snapshot. The destination gets fresh auth, model configuration, runtime state, and sandbox resources. Later messages use the normal native send path. ChatJS stores no second transcript and does not manufacture a synthetic user prompt containing the conversation.

Idempotency must cover native seed creation exactly as native create does today. A lost reply must resolve to the same destination; an operation ID with different source revision or projection hash must fail. A destination must be independently readable after its source is removed.

## Application integration

Reserve the destination under the viewer as a new family root. Do not use `parentConversationId` or `rootConversationId` to link different owners: existing family deletion and document ancestry operate inside one owner boundary.

A durable clone operation needs source conversation ID, immutable source revision/checkpoint identity, projection hash, and allocation state. Source identity is provenance, not a live transcript fallback or a cross-owner permission grant. The exact table/fields should be chosen alongside the native seed API; no migration is proposed or applied in this draft.

Copy only published attachment/document payloads to newly reserved viewer-owned keys and document revisions. Rewrite the native seed references to those copies. Existing file ownership and document ancestry APIs cannot be reused by assigning a foreign owner's keys or revision IDs. Preserve an allocation journal so interruption does not strand resources or create duplicates.

Authorize the source before reading and again before accepting the prepared copy. Coordinate the final authorization with source revocation/deletion and resource copying; the current public-read recheck alone is not an atomic clone commit. After acceptance, source revocation does not revoke the independent private copy. Failures remain retryable under the same clone operation.

Expose Save to your chats in the existing shared page only once this full path is supported. Authentication, ownership, exact retry, uncertain allocation, source revocation, source deletion, supported attachments/documents, and no-model-on-save behavior all need integration coverage. Browser coverage should verify Save, pending/error/retry, navigation to the resulting private conversation, and continuation after source deletion.

## Sources inspected locally

- `apps/chat/agent/channels/eve.ts`: `authorizeFork` delegates to `ownsEveSession`.
- `patches/eve-session-checkpoints.source.patch`: `restoreSessionCheckpoint` restores source history and sandbox checkpoint.
- `node_modules/eve/dist/src/client/sessions.d.ts`: create starts the first-turn response; no idle public transcript seed API is exposed.
- `apps/chat/lib/eve/shared-messages.ts`: public projection removes connection challenges/runtime metadata.
- `apps/chat/lib/db/eve-queries.ts`: fork reservation requires the same owner and joins the owner's deletion family.
- `apps/chat/lib/db/eve-documents.ts`: fork document initialization inherits same-owner checkpoint revisions.
- `apps/chat/lib/db/eve-files.ts`: file ownership cannot be reassigned; references require viewer ownership.

## Local native implementation status

The maintained source and compiled patches now accept a server-side `RunInput.seed`. It is distinct from the owner checkpoint fork and is not accepted by the browser session-create API. Both model history and the `history.seeded` display event are derived from one strict transcript schema. The schema excludes source message/tool IDs, runtime metadata, authorization challenges, system messages, unresolved tools, and partial output. Message and tool identities are generated in a destination-local namespace.

The driver emits the copied history and an idle boundary without executing a turn. The first real message retains normal session initialization and starts `turn_0`. Named idle checkpoints and nested forks preserve the seed. Fresh destination instructions, limits, continuation and sandbox identity remain intact; no sandbox checkpoint is imported. Copied file URLs are serialized in model history as native URL values.

Native unit and workflow integration coverage exercises completed tools and denials, strict rejection, idempotent replay, zero-turn saving, idle checkpointing, first continuation, nested forks, fresh session identity, and attachment checkpoint round-trips. This does not establish the application-level copy guarantee: destination file/document allocation, source authorization and revocation ordering, operation idempotency, the trusted channel callback, and the Save UI remain to be implemented and tested. Seeded historical messages currently have no native execution turn IDs; editing or regenerating those imported messages also needs a deliberate checkpoint strategy before claiming full copy parity.
