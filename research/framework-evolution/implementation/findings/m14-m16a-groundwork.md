# M14/M16a: selected files and exact text revisions

Date: 2026-09-06. Source baseline: `18db694b9b67263904707a85f93673f494ea0e6d` (SDK 7 main). This is the design/reproduction handoff for #323, with no production app changes, PR #317/#318 edits, migration, or publication. Live PR pins at the start of this tranche: #317 `c686b31bb0fe00e3234eaa92af7f81ed4d172ad7`, #318 `1b47cffe692acb8e2ebaf1ebebfa7ec76df75f10`, both OPEN. Neither was assumed approved or merged. Reused R08 (`c8e9d30c`) and R07 (`47355b66`) plus the coordinating checkout's `work-packets.json` and `findings-integration.md`. R07's full resolved defaults, including attachments and text/code/sheet documents, remain the parity baseline. Deferring heavy editors here does not remove them from M31 acceptance.

## Recommendation

Keep Files SDK as the selected bytes implementation and tRPC as the document/query API. Add exact immutable document references and ownership at persistence before migrating the document UI. Text revisions can live in the selected document database without requiring object storage. Attachments require a durable file ownership/reference catalog in addition to Files SDK bytes. Neither capability requires saved transcript UI or Better Auth tables; both consume the host's verified caller. Do not expose Eve canonical history to the browser. ChatJS owns document ancestry and refs; Eve owns execution.

## Actual paths and gaps

All paths below are relative to repository root; these describe source, not live production observations.

| Journey | Existing implementation | Required change |
| --- | --- | --- |
| Upload | `apps/chat/app/(chat)/api/files/upload/route.ts`: feature flag, Better Auth, JPEG/PNG/PDF, 5 MiB; `lib/files/upload-prep.ts` prepares images/PDFs; `lib/file-storage.ts` sanitizes name and assigns random key | Reuse validation and preparation; inject verified caller; persist owned file identity before returning success. Validate submitted attachments again when attaching to execution. |
| Bytes/provider | `lib/file-storage.ts`: lazy `Files`, prefix, retries, upload/download/head/delete/list; `lib/storage-provider.ts`: only `files-sdk/vercel-blob` | Keep native constructor/options/capabilities. Selected provider file and peers only. No new universal adapter. |
| Read/download | content route directly exports `createFileContentResponse`; that function accepts key, redirects via `url()` or streams/downloads with range support | Resolve owned/explicitly shared file before metadata, signing, redirect or bytes. Key possession is not authorization. Private no-store applies to proxy responses too. |
| Browser download | `components/attachment-list.tsx` fetches attachment URL, makes Blob download | Preserve filename and download action; use authorized stable file endpoint, never persist expiring signed URLs. |
| Cleanup | monolithic `lib/db/queries.ts` imports `deleteFilesByUrls` and deletes extracted URLs during message cleanup | Selected lifecycle hook; retain bytes while any durable revision/execution reference or authorized share needs them. A projection deletion must not delete authoritative content. |
| Create text | `tools/platform/documents/create-text-document.ts` conditionally saves for user, then returns success and fresh date; `saveDocument` assigns separate timestamp, no returned row | Save first; return inserted revision. Missing caller/save failure cannot return success. |
| Edit text | `edit-text-document.ts`: newest document by ID, no owner check, conditional save | Require exact base; authorize before reading content or writing; immutable append in transaction. |
| Read text | `tools/platform/read-document.ts`: latest by ID then checks user | Exact ref; authorize first. Its prompt's “current conversation” instruction is not an ACL. |
| API | `trpc/routers/document.router.ts`: owner/public version list; save accepts ID/content/title/kind and appends after unowned latest lookup | Narrow text input schema, exact read and base-write procedures; shared service for tools and router, no self-HTTP round trip. |
| Schema | `Document` composite `(id,createdAt)`, user FK, Message FK with cascade; Suggestion FK to timestamp | Stable document row/owner, immutable revision UUID and base FK, producing operation provenance; independent of display-message lifetime. Suggestion binds exact revision. |
| Editor/render | `artifact-panel.tsx` picks versions from document list/message, saves against last element; `part/document-tool.tsx` uses result date; preview dynamically imports all editor kinds | Workspace selection `{documentId,revisionId}`, view-local draft/base; query exact revision. Remove all-kinds import list from text-only output. Existing lazy loading alone does not omit installed source/deps. |

## Files SDK source checked

Installed exact `files-sdk@2.1.0` in the isolated fixture (lockfile retained). Inspected shipped `dist/index.d.ts`, `dist/api/index.d.ts`, `dist/internal/files-router/authorize.d.ts`, and fs/memory implementation source maps. Package provenance: [Files SDK repository](https://github.com/haydenbleasel/files-sdk). No assumption about a newer release is required.

`Files.upload` returns a key/content type/size; `download` returns a stored file stream; `capabilities.rangeRead` and `capabilities.signedUrl` govern range/signing. Keys and provider etags are not document revision identities. Upload to an existing key may replace bytes: allocate a fresh internal key for immutable attachments and expose no overwrite/move/delete operation to a model or browser.

The SDK already has `createFilesRouter`, native browser client/React bindings, Next bindings, operation allowlists, authorization hooks, origin checks, upload size limits, expiry clamps, `downloadMode: "proxy"`, and upload tokens. Reuse these if selecting its full upload protocol. `authorize` returns scope or throws; returning void from a supplied hook allows the operation, so it must explicitly reject missing/unauthorized callers. An operation allowlist alone also permits the listed operations; always supply the application authorization hook. The native HTTP proof uses `FilesError("Unauthorized", ...)` for a 401 rather than an ordinary Error (which serializes as 500). Do not expose list/search/delete/copy/move merely because SDK supports them. The existing small multipart route is also a valid first M14 transport: wrapping direct SDK calls with the application ownership/catalog check is smaller than replacing the transport immediately. Keep file ownership/reference creation in ChatJS; an SDK prefix alone cannot enforce shared-document policy.

Local fs was selected only for this isolated byte proof; current CLI explicitly excludes fs/memory as generated Next providers. No claim of serverless durability or provider signing proof. For public deployments select the existing supported provider recipe and its native configuration; retain a private bucket/access mode where the policy requires privacy.

## Browser/server and persistence contract

Browser-safe data (runtime-validated at serialized tool boundaries):

```ts
type RevisionRef = { documentId: string; revisionId: string };
type TextResult = {
  status: 'success'; ref: RevisionRef; kind: 'text'; title: string;
};
type FileRef = { fileId: string; contentType: string; size: number; name: string };
// Actual selected tRPC inputs:
// text.getRevision({ documentId, revisionId })
// text.create({ title, content })
// text.edit({ documentId, baseRevisionId, title, content })
```

Server-only document row: stable ID, immutable owner subject (canonical issuer/tenant + principal namespace), optional selected conversation scope. Revision: ID, document ID, nullable base revision ID, title/content/kind, DB timestamp for display, trusted producing operation ID; execution/session/tool-call IDs when applicable. Editor writes have their own server-bound operation identity. Do not invent an Eve event ID before commit: bind the accepted event later if necessary; neither caller nor model supplies ownership/provenance. Keep canonical history server-only and serialize just authorized display data/ref.

Use a database transaction: check owner and base membership, append revision, compare-and-set the linear head, return inserted row. Production PostgreSQL must lock the document row or use a conditional head update and roll back the insert if zero rows change. A check followed by unguarded insert is insufficient under concurrent requests. Unique operation identity plus a payload fingerprint must return the same committed result on execution retry; reusing an operation identity for different input must conflict. The fixture proves revision identity and linear stale policy, not worker retry/idempotency or PostgreSQL concurrent isolation.

Files: catalog `fileId -> owner, internalKey, mediaType, size, originalName, state`, plus selected durable reference records. Upload bytes under a fresh key, then commit catalog and return file ref; failed catalog write attempts cleanup, and a sweeper handles crash or cleanup-failure orphans. Attach/send/tool ingestion authorizes file IDs before resolving bytes. Do not fetch an arbitrary model/browser URL through server credentials. Model providers that cannot read the app's authenticated endpoint need server-resolved bytes or a deliberately short-lived scoped capability after authorization.

Tools call the same document service as tRPC with trusted execution caller; results are JSON with exact refs. Runtime validation uses the installed tool's own schema, including failures such as conflict/not-found, rather than a central union of every document/tool kind. No dates, DB rows, credentials, raw provider instances, or canonical execution history cross this result boundary. `toModelOutput` may summarize content but retains the exact revision ref needed by a later edit/read.

Reuse tRPC/TanStack Query inference and keys: exact revision query input contains both IDs; never resolve latest as a fallback when a historical ref is missing. On save success, cache the returned revision and invalidate the document revision-list/head queries. Preserve older immutable cache entries. Scope cache by authenticated caller or clear it on caller change; sharing revocation still requires server reauthorization and appropriate refetch, despite immutable bytes. On conflict preserve the draft/base and show reload/compare, without clearing dirty state on failed save.

## Before/after

Before: create saves `(D, databaseTime)` but emits `{documentId:D,date:toolTime}`; edit `{documentId:D,content:'two'}` selects whatever newest row exists. Clicking an earlier result can resolve later content.

After: create commits R1 and emits `{status:'success',ref:{documentId:D,revisionId:R1},kind:'text',title:'Notes'}`. Read R1 returns exactly content 'one'. Edit `{documentId:D,baseRevisionId:R1,title:'Notes',content:'two'}` commits R2 with base R1 and returns R2. A second linear editor saving from R1 receives conflict. R1 still reads 'one'; another principal receives not-found on both read and edit. Ownership remains the original document's owner.

Before: `GET /api/files/content?key=known-key` can redirect/download without caller authorization. After: `GET /api/files/F/content` resolves F against verified caller or an explicit authorized share, then downloads the associated internal key. Knowledge of F or that key grants no access.

## Selected source and frontend composition

| Choice | Materialized source/deps | External replacement seam |
| --- | --- | --- |
| No files/documents | None of file routes, catalog, SDK/providers, document tools/router/editor | No service config required |
| Files SDK integration | Attachment UI/transport/catalog; Files SDK; one provider source + its peers/env validation | External registry file integration may own transport/catalog; a provider-only replacement uses native Files SDK adapter/options |
| Text documents | Text contracts, document schema/queries/router, create/read/edit tools | External text persistence/tool item supplies its own per-case API/setup without inheriting Files SDK |
| Result renderer | Small typed result component + selected query client | External renderer item consumes validated text result and host workspace callback |
| Text editor | Lazy editor module and its actual dependencies | External editor has base-ref/save-result contract; renderer-only selection needs no editor |

Each selectable choice accepts a registry URL through the accepted installer path. Do not hard-code a provider slug or closed renderer union as the only selection input. Requirements for external selections must be declared/resolved by installer/M11; conflicting targets and required setup must be reviewable. Reuse CLI provider metadata/peer generation for built-ins (`packages/cli/src/helpers/storage-provider.ts`). No new registry/version system. Do not install all packages and hide with runtime flags.

Direct functional JSX composition: a selected `TextDocumentResult` renders a button that calls `openDocument(result.ref)`; the selected workspace renders `<TextDocumentPanel refValue={selectedRef} />`. That panel may lazily import its text editor on edit. Pass base and commit callback directly; do not reproduce `new Artifact` or central all-editor registration. The proof now implements that direct JSX shape in `ui.tsx`, `result-renderer.tsx` and `text-editor.tsx`; a real browser verifies exact-ref query/save, lazy loading and preserved stale draft. This is a small unstyled contract page, not the production workspace migration. M11 owns accepted mounted tool names and lazy companion registration; R04's isolated chunks are not an integrated renderer journey.

## Stages and exact prerequisites

1. **Revision/security seam now:** narrow document queries returning persisted refs, exact read/base edit with ACL and transaction; remove false success. Requires trusted caller policy and selected document schema, not M10/#298. Fresh schema design only here; legacy-row conversion remains outside scope. Protect current app paths before new UI migration if implemented as a separate approved change.
2. **M14 integration:** accepted installer selection/materialization from #313/M08 (#318 remains under review), host caller/durable ownership context from M07, selected Files SDK provider configuration, catalog initialization and attachment composer hook. Exercise actual authenticated HTTP upload/download, range, signing/proxy, attach authorization, cleanup failure. No M10 dependency.
3. **M16a selected text:** accepted M11 tool installation, browser-safe result validation and relevant renderer/workspace boundary (UI #317 remains under review), selected document store and query composition. Build one create/read/edit/reload journey with direct JSX and a lazy text editor. Text DB storage does not require M14 unless files/exports are selected. Verify external replacement and omitted source/deps through real installer, not this specimen copier.
4. **Retry/concurrency acceptance:** PostgreSQL transaction conflict test using two connections, failure rollback, producing-operation replay after interrupted tool completion; browser draft preserved on conflict. No historical fork required.
5. **M16b later:** only after supported #298/M10 acceptance: real branch from exact R3, two successors with separate branch/path heads, independent execution, no completed tool replay, reload/view switch and authorization. Do not call private history APIs. Heavy code/sheet editors follow the same revision contract in later selection work; M31 still requires full default parity.

## Material policy choices

- **Stale writes:** recommend conflict for linear saves. For later deliberate ancestry divergence, append from an authorized historical base and advance only the explicitly targeted path head. Never make stale autosave silently branch or rewrite another path. This is an API policy distinction, not a universal branching subsystem.
- **Private downloads:** recommend proxy for promptly enforced access revocation. A signed redirect reduces app bandwidth but leaked grants remain usable until expiry, and public provider URLs are not revocable ACLs. Validate the chosen provider's real private-access behavior before claiming privacy.
- **Sharing:** documents alone remain owner-only. Full preset must preserve deliberately public reads using exact revision references granted by the public conversation/share. Current public query exposes revisions joined to public messages; broaden-to-whole-document sharing would be a policy change. Test grant/revoke across document and file endpoints with M31/M23b, without installing saved-history sharing into minimal text apps.

## Executable evidence and limits

The fixture is [here](../fixtures/m14-m16a/README.md). A typecheck is not counted as a runtime pass. Observed after the extended tranche:

| Evidence | Observed result | Boundary of the claim |
| --- | --- | --- |
| Real Files SDK fs bytes + SQLite catalog | Upload, reopen, authorized download, unauthorized upload/read rejection | Local persistent filesystem; not Vercel Blob/private signing or deployed storage |
| Native AI SDK 7 tool + tRPC HTTP | Returned tool ref equals committed row and UI-query ref; unauthorized query/write denied; concurrent same-base requests produce one success and one conflict | Real localhost transport and real SDK definitions with fixture caller tokens; not current production route authentication or an Eve worker/model run |
| Failure injection | DB-triggered save error rejects tool execution and rolls back new document; failed edit leaves base usable; immutable update and foreign-document base rejected | SQLite transaction evidence; no PostgreSQL isolation claim |
| Native Files SDK HTTP router | Authorized byte range returns 206 and exact bytes; unauthorized metadata/download returns 401; unselected delete returns 403 and bytes remain | Reuses SDK router/authorization surface; proxy/memory proof, not upload signing/restart tokens |
| Playwright Chromium | Page/title render; exact historical content; editor chunk requested only on Edit; UI displays committed revision; stale draft/base preserved; another owner sees unavailable document | Direct JSX proof page, no framework overlay, no page errors/console warnings; expected denied requests/conflict responses are exercised. Desktop 1000×760 only; not full ChatJS visual parity |
| Native shadcn 4.18.0 + Bun | Five real external HTTP item installs plus empty selection; installed source/manifests/Bun locks inspected; installed source strictly typechecked; native external memory provider uploads/downloads; alternate renderer/editor bundle | Genuine upstream installer, not production ChatJS #313 installer acceptance. External renderer/editor installed and bundled; only the built-in editor runs the browser save journey |
| Checks | **7 tests / 62 assertions pass**, strict fixture types pass, explicit Biome fixture check passes; root `bun lint` and `bun test:types` pass with Turbo cache hits | Root tasks do not include research fixture; fixture checks are therefore separate |

Machine-readable records: [registry inventories](./m14-m16a-evidence/registry.json), [browser observations](./m14-m16a-evidence/browser.json). Screenshot was inspected at `/tmp/m14-m16a-stale-draft.png`; it shows the stale draft still in the textarea and the save-failure explanation. Browser plugin/skill absent, so regular Playwright was used. These are bounded behavior checks, not a redesigned UI.

The root checks initially could not run because dependencies were absent. `bun install --frozen-lockfile` installed the unchanged root lockfile; both required checks subsequently passed. Worktree app discovery reports slot 0, so no app was started on those shared defaults: each isolated server instead asks the kernel for a unique loopback port with `port: 0`; each test uses a unique disposable directory/database. No other checkout, DB, or existing server was modified.

From repository root:

```sh
bun install --frozen-lockfile
bun install --cwd research/framework-evolution/implementation/fixtures/m14-m16a --frozen-lockfile
# Once if a compatible browser is unavailable (run inside the fixture):
# bunx playwright install chromium
# FIXTURE_CHROMIUM may name an existing compatible browser executable.
bun test --cwd research/framework-evolution/implementation/fixtures/m14-m16a
bun run --cwd research/framework-evolution/implementation/fixtures/m14-m16a test:types
bun run research/framework-evolution/implementation/fixtures/m14-m16a/registry-proof.ts
bunx --bun @biomejs/biome@2.4.10 check research/framework-evolution/implementation/fixtures/m14-m16a
bun lint
bun test:types
```

The fixture's own package includes all test dependencies. Generated consumers are the omission proof: minimal has no runtime dependencies; files/external-provider have only Files SDK; text has only Zod; external renderer has React/Zod; external editor adds fast-diff. Common dev-only TypeScript/Bun/React type packages support verification. Files SDK's selected npm tarball still ships other provider subpaths and may contain optional-peer metadata; the proof excludes unselected application source, runtime lock entries and installed provider peers, not the contents of an upstream package. The external memory provider is deliberately ephemeral and cannot satisfy persistent-storage deployment semantics.

The current app's original vulnerabilities remain open: this artifact implements/proves a proposed boundary instead of silently patching production during a design task. PostgreSQL concurrent transactions, stable producing-operation retry deduplication, provider private URL behavior, reference-aware deletion/sharing revoke, production host identity/CSRF integration, M11 actual mounted tool/renderer and external browser journeys, and #298 historical execution remain gates. No runtime fork or private history API was attempted.

## Exact proposed PostgreSQL seam (design only)

The fixture contains runnable SQLite DDL. A selected production text store can use this narrow shape; this SQL is not a generated/applied migration and does not promise legacy row conversion:

```sql
CREATE TABLE text_document (
  id uuid PRIMARY KEY,
  owner_subject text NOT NULL,
  head_revision_id uuid
);
CREATE TABLE text_revision (
  id uuid PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES text_document(id),
  base_revision_id uuid,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  producing_operation_key text NOT NULL UNIQUE,
  input_fingerprint text NOT NULL,
  producing_session_id text,
  UNIQUE (document_id, id),
  FOREIGN KEY (document_id, base_revision_id)
    REFERENCES text_revision(document_id, id)
);
ALTER TABLE text_document ADD CONSTRAINT head_belongs_to_document
  FOREIGN KEY (id, head_revision_id)
  REFERENCES text_revision(document_id, id) DEFERRABLE INITIALLY DEFERRED;
```

`producing_operation_key` is a server-bound stable operation identity with the trusted caller/execution namespace, not a browser or model supplied free-form key. For UI edits the host issues/binds an operation identity; for tool executions use the accepted execution/tool-call identity. If the installed execution contract cannot supply one across retries, record that as an implementation prerequisite. The schema contains no Message/Better Auth foreign keys. Enforce immutable revision UPDATE restrictions with DB permissions/trigger in the selected recipe; DELETE follows a separately verified reference-retention policy.

Write transaction sketch: lock the document row selected by `(id, owner_subject)`; require its head equals `baseRevisionId`; load that exact revision under the same document; insert successor with `RETURNING`; update head to that returned ID; commit; only then serialize the successful tool/UI result. For a retried operation, reauthorize and compare the recorded input fingerprint before returning the same result. A different payload with the same operation identity conflicts. Creation must handle this same operation-identity race without leaving an orphan document row. The runnable fixture covers rollback and stale heads but deliberately does not claim this production retry protocol has been implemented.

No decision from Francisco is needed to review or reuse the proof. Before production adoption, settle only the material options above: linear conflict behavior, private proxy versus bounded signed grants, and exact shared-revision visibility. Installer and actual tool/renderer contracts remain dependencies; historical branching does not block the revision/security seam.
