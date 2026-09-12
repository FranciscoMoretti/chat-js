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

The maintained source and compiled patches now accept a server-side `RunInput.seed`. It is distinct from the owner checkpoint fork. The HTTP session-create API accepts only `{ "seed": true, "operationId": "..." }`; an explicit `resolveSeed` server callback supplies the trusted transcript. Browser history, source runtime IDs, forwarded principals, and execution controls are rejected. Both model history and the `history.seeded` display event are derived from one strict transcript schema. The schema excludes source message/tool IDs, runtime metadata, authorization challenges, system messages, unresolved tools, and partial output. Message and tool identities are generated in a destination-local namespace.

The driver emits the copied history and an idle boundary without executing a turn. The first real message retains normal session initialization and starts `turn_0`. Named idle checkpoints and nested forks preserve the seed. Fresh destination instructions, limits, continuation and sandbox identity remain intact; no sandbox checkpoint is imported. Copied file URLs are serialized in model history as native URL values.

Native unit and workflow integration coverage exercises completed tools and denials, strict rejection, idempotent replay, zero-turn saving, idle checkpointing, first continuation, nested forks, fresh session identity, and attachment checkpoint round-trips. These native tests alone do not establish application-level copying. The application integration and its separate validation are described below. Seeded historical messages currently have no native execution turn IDs; editing or regenerating those imported messages also needs a deliberate checkpoint strategy before claiming full copy parity.

The channel authenticates seed operations directly and isolates their continuation tokens from ordinary creates. `GET /eve/v1/operation/:operationId?kind=seed` recovers the destination in the same principal namespace. Accepted POST retries return the durable destination without calling the source resolver again. Missing authorization, malformed callback data, and browser-supplied history fail before allocation. The callback must bind its operation to one immutable source projection and destination-owned resources; the native endpoint cannot establish those application guarantees. Seed requests bypass `onMessage` and preserve the authenticated destination principal.

## Local copy preparation

`apps/chat/lib/eve/copy-transcript.ts` prepares a seed from the shared projection only after a durable idle/completed boundary. It excludes source message, turn, tool-call, approval, and billing identities; refuses unresolved or partial parts; and hashes the resulting projection. This is preparation for the application copy journal, not an exposed Save operation.

Resource discovery includes nested tool values and document content. Native document identities are interpreted only inside known ChatJS document/artifact tools, so arbitrary MCP `documentId` fields remain application data. Completed failed/denied document arguments are preserved as history without requiring nonexistent artifacts. Successful native references require explicit replacement allocations. UUID references are canonicalized consistently, including document assistant instructions embedded in prose.

Copied file links are parsed as whole URL tokens and rewritten to canonical local paths, including protocol-relative and mixed-case HTTP URLs. A local-looking path inside a foreign URL query is not a file reference and must never receive a destination key. Allocation maps must contain fresh, distinct destination identities. Actual native attachment parts are materialized through an owner-authorized destination-key metadata loader, not by fetching a source-supplied URL. The resulting seed has been checked against the installed native parser and model-history conversion.

### Transcript size boundary

The native seed schema caps serialized input at 8 MiB. Attachment bytes no longer count against this cap: application materialization emits compact destination URLs with `attachments: "channel"`. The remaining limit applies to transcript JSON itself; very long histories still need an explicit product/storage design rather than silently dropping messages.

### Native destination file resolution

The local patch now accepts `attachments: "channel"` on a seed. In this mode it keeps destination URLs compact and defers byte resolution until continuation. The authored eve channel exposes the existing `fetchFile` hook with authenticated session context. ChatJS checks destination ownership before reading storage by key; it never fetches the supplied hostname.

The first real turn stages these files through the standard sandbox attachment pipeline and commits compact `eve-sandbox:` references. Later model calls hydrate them normally. Saving still performs no file fetch, model call, or tool execution. Unresolved or denied files fail closed. A temporary staging failure emits a recoverable failed turn and parks the conversation, retaining the seed files and incoming user message for a later retry. Manual compaction also stages pending files before passing history to the compactor.

Local native workflow tests cover six 1 MiB files, zero work on Save, reuse on later turns, and failed storage followed by successful continuation. The application resolver tests cover owner authorization, rejected access, absent authentication, and malformed/foreign URL handling. These fixtures require neither a database nor a model provider.

Application materialization now uses the compact channel path. Inline attachment IDs bind their MIME type and exact bytes, so the upcoming journal can allocate and write each distinct inline payload once before constructing the seed. Materialization requires destination allocations and matching stored MIME/size metadata; it performs no byte reads. Six distinct 1 MiB inline images produce a seed smaller than 2 KiB instead of exceeding 8 MiB. The installed native parser accepts the resulting channel URLs.

### Document resource preparation

The application snapshots only document identities discovered in the sanitized public transcript. It rechecks the exact source session as bound/public, acquires the existing family/document locks, and takes a shared source-row lock to serialize with revocation. A single ancestry query captures the selected heads and all their accessible revisions, excluding private sibling branches and unrelated documents. Explicit revision references outside that ancestry fail closed. The snapshot omits source ownership, operation IDs, and execution turn indices.

Preparation inventories files across all captured revision contents and titles, requires complete fresh document/revision/file allocations, rewrites head and parent references as well as content, and gives imported revisions stable destination operation IDs with null turn indices. Local PostgreSQL tests verify complete ancestry, private-history exclusion, missing resources, exact session identity, and revocation while the source row is locked.

### Durable application acceptance still required

Conversation reservations now persist `creationKind: message | copy`, with existing rows defaulting to `message`. PostgreSQL requires copy reservations to be fresh roots. Ordinary creation rejects copy operations before native lookup and again inside reservation/binding checks; retries cannot cross native namespaces. A normal message fork from a copied root remains valid. The local migration and creation/deletion contracts are verified.

The next integration needs a copy journal containing immutable source/projection/resource identities, stable allocations, temporary seed data, and resource-completion receipts. Copy creation must likewise reject an existing message reservation before preparing resources. Native identity remains the destination reservation ID, and copy lookup uses `kind=seed`.

Accept the copy only after destination resources are complete. Acquire source/destination family locks in deterministic order, recheck publication under a source-row lock, and commit acceptance in a short transaction. Thereafter the destination is independent of source revocation/deletion, and native dispatch/recovery reads the accepted journal without reopening source access. Bind the native session and clear the temporary seed atomically; it must not become a permanent second transcript.

Pre-acceptance rejection needs a provably never-dispatched resource-cleanup path. After acceptance, a native lookup 404 is not proof that creation never happened: retain the seed/resources for recovery. Deletion must purge copy preparation content while retaining operation/kind tombstones. The Save UI must preserve the same operation identity through uncertain replies and reloads.


## Copy journal implementation

The local application now reserves a copy root, immutable preparation plan, and owned destination file keys in one transaction. File receipts bind exact bytes, MIME type, and size; document ancestry and heads commit together. Acceptance rechecks publication and captured document heads, then retains only the compact seed. Native binding clears that seed atomically, leaving eve as the transcript authority. The patched `eve/transcript` entry point exports `parseSessionTranscriptSeed` so application acceptance uses the native structural and byte limits instead of maintaining a second schema.

Pre-acceptance rejection fences resource writes and provides a never-dispatched cleanup proof. Accepted copies retain their seed through uncertain native replies and recover with the same reservation identity, independent of source revocation. Deletion removes the temporary journal while preserving the operation/kind tombstone.

This foundation is tested with local PostgreSQL and simulated storage/native replies. The following integration sections describe its application wiring; journal tests alone do not establish browser correctness.


## Server integration

The preparation service now derives the plan from a sanitized, idle public snapshot and complete authorized document ancestry. It reads files only through exact source-conversation references, under publication/ownership locks; inline attachments become independently owned stored files. Retries reuse the journal's original allocation and model, including concurrent requests. Native lookup uses `kind=seed`; creation sends only the destination operation ID and seed intent. The authenticated channel resolves the persisted accepted seed. Saving does not spend model credits or execute tools.

Permanent pre-acceptance failures (revocation, changed document heads, or changed file bytes) reject and clean up the destination using never-dispatched proof. Source availability is checked before unfinished file reads, so deleting an unwritten source file cannot trap preparation in storage retries. Temporary storage/native errors retain the same operation. Cleanup failures remain discoverable as rejected/deleting, and repeating the save finishes erasure without native dispatch. Accepted copies retain normal recovery semantics.

Local service tests use real database transactions and simulated storage/native replies; they cover complete documents/files, concurrency, ownership denial, lost writes/native replies, revocation and interrupted cleanup.

## HTTP and browser integration

The local copy endpoint authenticates the owner, enforces same-origin requests and a bounded strict body, and accepts only source ID, operation ID, and model ID. The browser retains those coordinates through ambiguous replies and reloads. The shared page reuses the existing ChatJS Save control; an unbound destination exposes recovery from its persisted operation even when the original source becomes private. Never-dispatched copies use the preparation cleanup path on deletion. A definitive model rejection records a tombstone before allowing a fresh operation; transient catalogue failures retain the original request.

The pure `eve/transcript` export keeps structural validation out of the channel runtime dependency graph, avoiding optional sandbox imports in Next.js server rendering. A real browser test now proves a text copy produces no execution events, recovers the same native session after a lost reply and interrupted binding even after source revocation, and continues with its imported context. It also checks that the composer cannot accept input before hydration. Local desktop/mobile captures cover Save, pending, retry and recovery. A separate real image-copy test verifies fresh destination storage keys and identical bytes, deletes the source through the application HTTP API, confirms the original file is inaccessible, and continues the native copy with an image-dependent answer. A real text-document copy test preserves two revisions and their ancestry under fresh destination identities, deletes the source, navigates both copied versions in the artifact panel, and uses readDocument/editTextDocument to append a third version without losing a manual update. It checks both native idle events and an empty destination usage ledger before continuation. This tool-heavy check uses Gemini 2.5 Flash with an explicit copied document ID, matching contextual artifact actions; Flash Lite returned empty responses or declined tool use during exploratory runs. The PDF-copy browser test also verifies independent bytes and a document-dependent continuation after source deletion, with a strict source acknowledgement that keeps the answer out of the imported transcript. The initial generic acknowledgement prompt caused Gemini to transcribe the PDF in both the native path and a direct gateway probe; an explicit request to defer reading the PDF resolved this without changing runtime code. Imported-history editing/regeneration remains separate work; this is not yet full copy parity.

## Imported-history editing gap

Imported messages currently have `seed_message_*` identities without execution turn metadata. The application disables their edit/regenerate controls, and native checkpoint forks cannot address those messages. Enabling the controls alone is insufficient: regeneration's response-model metadata is omitted from the public seed, and edit attachment restoration currently expects inline data URLs rather than the authenticated file URLs retained by saved copies.

The proposed extension is an owner-authorized transcript-prefix fork keyed by the imported message identity, alongside execution-turn checkpoint forks. Eve should resolve the prefix from its durable history and stage its retained attachments lazily; it must not copy a later sandbox or fabricate execution turns. Boundary provenance must remain addressable through descendant branches. The application can then reuse durable fork creation and recovery. Document heads must be restored for the selected imported boundary rather than inherited from the copy's final heads. Safe historical model metadata and a defined fallback for existing copies also need implementation before claiming imported-history edit/regenerate parity.

The checkpoint restore path now preserves pending seed-attachment staging when an owned copy is forked before its first continuation. It transfers only that marker, leaving source auth and unrelated state behind. Native integration tests verify resolution under destination authorization, retry after retrieval failure, one-time staging after success, and unchanged source history. A compiled installed-module check verifies that the application package uses the corrected restore implementation. This prerequisite does not yet enable imported-message boundaries.

Native imported-boundary forks now accept `{ sessionId, beforeMessageId }` under the existing owner authorization. The bounded reader selects an imported user boundary from durable seeded history, derives matching model/display prefixes, and starts execution at turn zero with deferred attachment staging and a fresh sandbox. Native workflow tests cover excluded suffixes, model/display agreement, empty first-message prefixes, and descendant forks. The local source patch includes API documentation and an unpublished proposal. Application boundary contracts, document heads, historical model selection, and UI controls still need integration; this native slice does not yet provide application edit/regenerate parity.
