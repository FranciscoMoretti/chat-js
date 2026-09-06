# M09: optional saved conversations and application identity

Review handoff for [#322](https://github.com/FranciscoMoretti/chat-js/issues/322), 2026-09-06. This is a proposed goal state plus isolated SQLite and Postgres/HTTP ownership proofs. It does not modify PR #317/#318, migrate the full app, or approve a new deletion/retention policy.

## Recommendation and scope

Keep M07's verified caller and durable conversation/session reservation mandatory. Add saved conversation metadata and its list/reopen/rename UI as selectable source. Reopen by authorized resolution and public Eve event replay; initially omit any additional persisted transcript projection. Offer existing-app identity as the normal integration and starter Better Auth as an independent selection. Login UI must not be a prerequisite for history. History must not be a prerequisite for ownership.

Do not replace the full demo until its **resolved** defaults pass M31. Saved history is one slice, not parity for branching, projects, sharing, votes, files, documents, MCP, credits, desktop or login journeys. M09 may ship a linear saved conversation example while M10 remains gated on supported historical execution APIs. ChatJS owns ancestry; Eve owns execution. Neither replay cursors nor a browser transcript create a historical branch.

## Pinned reference code and observed differences

All references were inspected locally; PR head was queried read-only with `gh pr view 318 --json headRefOid,headRefName,url,state`. Recheck the diff at implementation start if the PR moves.

| Evidence | Exact revision / source | Meaning for M09 |
| --- | --- | --- |
| R08 | `c8e9d30c3e3e43d8f4df46b4e257e62de13cb5d1`, [report](/Users/fran/.codex/worktrees/50c0/chat-js/research/framework-evolution/implementation/findings/r08.md) at `/Users/fran/.codex/worktrees/50c0/chat-js/research/framework-evolution/implementation/findings/r08.md` | Mandatory ACL is separate from saved history; monolithic auth/schema/queries create accidental dependencies. R08 is source evidence, not live runtime proof. |
| R07 | `47355b661c626227115830ec9fc4b0079458e1d4`, `/Users/fran/.codex/worktrees/b381/chat-js/research/framework-evolution/implementation/findings/r07.md` | Saved history/OAuth mostly source-inspected; browser smoke does not establish parity. |
| M07 | `688c7e944cb66397ec2a0e2a80f1557dc7325b07`, `/Users/fran/.codex/worktrees/7f9a/chat-js/examples/minimal-next` | Durable Postgres reservation, verified JWT host adapter, public-Eve allowlist, restart replay. |
| Reviewed PR318 | `1b47cffe692acb8e2ebaf1ebebfa7ec76df75f10`, [PR](https://github.com/FranciscoMoretti/chat-js/pull/318) | Selection/composition changes are layered on M07; `bindings.ts`, `identity.ts`, `scripts/db-init.ts` unchanged. Create validation moved to `lib/create-contract.ts`. |
| Reviewed PR317 | `c686b31bb0fe00e3234eaa92af7f81ed4d172ad7`, `apps/chat/lib/chat/view-store.ts`, `components/chat/conversation-view.tsx`, `components/chat-system.tsx` | View selection is keyed by runtime + view ID; draft key is `[draftScope, viewId]`. This is current-engine scoping, not public-Eve multi-view runtime proof. |
| Current full app | `18db694b9b67263904707a85f93673f494ea0e6d`, `apps/chat/trpc/routers/chat.router.ts`, `lib/db/schema.ts`, `lib/db/queries.ts`, `trpc/react.tsx` | Chat list sorts pinned then updated; rename max 255; delete cleans attachments then deletes Chat with cascades. Preserve or explicitly decide differences. |
| Coordination | `/Users/fran/Code/chat-js/research/framework-evolution/implementation/{work-packets.json,findings-integration.md,investigation-results.json}` | M09 depends on accepted M08 and R08; private fork evidence is not a supported public API. |

Pinned M07/PR318 runtime set: Eve `0.52.1`, Next `16.3.0`, React `19.2.3`, AI SDK `7.0.93`, OpenAI provider `4.0.59`, Postgres client `3.4.7`, Workflow Postgres World `5.0.0-beta.40`, tRPC `11.16.0`, Zod `4.3.6`, jose `6.2.3`. Eve server runs Node 24+, not Bun. Bun owns installs/scripts. These are inspected pins, not a newly rerun combined Eve deployment proof.

To inspect exact source without switching branches:

```sh
git show 1b47cffe:examples/minimal-next/lib/bindings.ts
git show 1b47cffe:examples/minimal-next/lib/router.ts
git show 1b47cffe:examples/minimal-next/app/api/eve/\[...path\]/route.ts
git show 1b47cffe:packages/cli/src/selection/schema.ts
git show 1b47cffe:packages/cli/src/selection/registry.ts
```

Concrete M07 constraints: `create` reserves `(owner_subject, operation_id)` before Eve, retains normalized first-message text, and returns only a committed bound session. Completed exact retries return the same binding. Concurrent/unresolved and changed-payload retries conflict. `creating`/`uncertain` cannot be blindly retried into a new session. `resolve` only returns bound owner rows. Gateway and Eve channel both check ownership; raw create/reset/clear/compact/unknown routes remain denied. The signed host identity verifier returns a string from a fixed issuer/audience token. PR318's `sessionStorage["chatjs.pending-create"]` is not owner/view scoped; M09 must fix that at account/view transitions before relying on it for saved history recovery.

## Ownership and selection matrix

| State | Authority / owner | Required when history omitted? | Browser exposure |
| --- | --- | --- | --- |
| Verified principal | Selected host verifier, or selected auth provider | Yes | Minimal account display/session epoch; never accept owner from mutation body |
| Conversation ID, create operation, lifecycle, owner | ChatJS application DB | Yes | Opaque IDs and explicit operation status |
| Eve session / turn / input-request ID | Eve, associated through authorized ChatJS binding | Yes | IDs needed by public client; knowledge grants no access |
| Execution events, workflow state, pending input | Eve durable store | Yes | Authorized frontend-safe events/projection only |
| Canonical model history / future ancestry seeds | Server execution boundary; ChatJS ancestry | Yes where execution requires it | Never serialize through list/reopen, RSC props, query dehydration or local storage |
| Title, pinned state, saved time, activity ordering | Selected saved-history repository | No | Typed list/detail metadata |
| Cached display snapshot | Optional derived projection, not canonical model history | No | Native public project data only after authorization |
| View cursor, selected path, draft | Each view scope | View-local | Key by identity epoch + workspace/view + conversation; not one DB-wide selected cursor |
| Shared stream/runtime lifetime | Conversation execution owner | Execution required | Multiple views subscribe; closing a view doesn't cancel a turn |
| Login page/provider tables | Selected starter identity | No | Provider-native client/session contract |

The later Postgres proof passes **7 scenarios / 59 checks**, including actual API process death, PostgreSQL crash recovery, two-process create/CAS races, and a host JWT integration without auth tables. See [reproduction and limits](postgres-fixture/README.md) and [sanitized evidence](postgres-fixture/evidence.json). The [dependency-specific packets](implementation-packets.json) distinguish proven seams from pending generated-feature acceptance.

A no-history app still stores ownership, create payload and execution data. Describe this accurately; “no saved history UI” does not mean zero data retention. Remove history/auth source and dependencies in generated inventory, rather than leaving disabled imports.

## Proposed application schema

Use the existing `chatjs.conversations` reservation table as the durable identity root. Keep `conversation_id`, `owner_subject`, `operation_id`, `message`, unique nullable `session_id`, and `state` checks exactly as M07 until a separately tested migration changes them. `state` describes creation, not deletion or turn status. No foreign key to Better Auth `user`: an existing application may use another database or service principals.

Proposed Postgres additions (names are application-local, not a framework schema):

```sql
-- Mandatory lifecycle only if conversation deletion is accepted for this recipe.
ALTER TABLE chatjs.conversations ADD COLUMN deleted_at timestamptz;
-- Every session and conversation authorization query must then include
-- deleted_at IS NULL, including the internal Eve channel.

-- Optional history installation:
CREATE TABLE chatjs.saved_conversations (
  conversation_id uuid PRIMARY KEY
    REFERENCES chatjs.conversations(conversation_id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 255),
  is_pinned boolean NOT NULL DEFAULT false,
  saved_at timestamptz NOT NULL DEFAULT now(),
  activity_at timestamptz NOT NULL DEFAULT now(),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0)
);
CREATE INDEX conversations_owner_id
  ON chatjs.conversations(owner_subject, conversation_id);
CREATE INDEX saved_order
  ON chatjs.saved_conversations(is_pinned DESC, activity_at DESC, conversation_id DESC);
```

`owner_subject` is not copied into metadata, preventing owner drift. Queries join the binding and predicate on owner and lifecycle in the same statement. IDs are server-generated. `revision` prevents stale-tab rename/pin overwrites; it is an ordinary row revision, not a new framework version system. Activity updates must be server-observed accepted activity, monotonic and independent of renames/pins; never trust a browser timestamp. Stable list ordering is pinned, activity, ID descending. Use keyset pagination with all three tuple values, limit 1–100, default 30, owner predicate on every page. A moved row can move between pages: invalidate all pages after mutation/activity and dedupe by ID when appending pages.

Separate optional display snapshots only after a measured need:

```ts
// Import these from the selected app's public Eve projection, not DB schema.
type DisplaySnapshot = {
  conversationId: string;
  sessionId: string;
  streamIndex: number;
  data: ProjectData;
};
```

Persist `sessionId`, `streamIndex` and `data` from the **same** `ClientSession.snapshot()` boundary; never pair the newest cursor with an older projection. Validate persisted JSON with the selected projection's schema before reuse. A server worker reading authorized public events may write this cache; no browser procedure accepts arbitrary snapshots or messages. First release uses cursor-zero replay, so it needs no snapshot table/rebuild service. A later cache must be disposable: unsupported shape, mismatch, corruption or missing prefix discards the snapshot and replays from zero. Rebuilding a display snapshot never reruns a model/tool. A failed durable replay shows unavailable/reconnect, not a fabricated empty transcript or prompt summary.

Do not add `Message`/`Part`, document/file dependencies, project IDs, visibility, or feedback joins to this slice. Future multi-session conversation mappings belong to M10; do not encode “one selected session” as a permanent global conversation cursor or build branch tables now.

## Identity contracts and recipe choices

Keep an ordinary server-only function at `lib/identity.ts`, consuming the selected provider's native API. The fixed-issuer M07 example can preserve its string owner contract. For multiple issuers or tenants, derive a collision-safe owner key server-side, for example `JSON.stringify([verifiedIssuer, verifiedTenant ?? null, principalType, verifiedSubject])`. Do not concatenate unescaped delimiters. The principal must be stable across token refreshes; use neither email nor access token as the key. Changing an existing key format requires an explicit binding migration, never opportunistic reassignment.

```ts
// Host integration example; verifyHostSession is the application's existing API.
export async function caller(request: Request): Promise<string | null> {
  const session = await verifyHostSession(request);
  if (!session) return null;
  return JSON.stringify([session.issuer, session.tenantId, "user", session.subject]);
}
```

Only verified fields enter Eve's native authentication context and application ACL. Login UI consumes its provider's native client API; no universal auth provider union or new session framework. Missing/expired credentials return 401. Known foreign/deleted conversation/session IDs return the same 404 as missing ones. Preserve same-origin mutation checks and fresh credential propagation on create/send/respond/stream/cancel. Never forward unverified owner headers to Eve. Do not expose the worker listener or callbacks to make login integration easier.

| Choice | Installed source/dependencies | Recommendation / acceptance |
| --- | --- | --- |
| Existing application identity | Project-local verifier; existing provider dependencies only | Default for an existing app. No Better Auth tables/login pages/secrets/provider-count validation unless already used. Two users with the same local subject in different tenants cannot collide. |
| Starter Better Auth | Provider construction, selected auth tables/migrations, route handler, native client, login/account UI, selected provider configuration | For a new standalone app. Reuse current provider choices; Google/GitHub/Vercel and Electron belong to the full resolved preset, not every starter. Select provider-specific dependencies and environment requirements. |
| Trusted anonymous identity | Explicit signed/opaque server-issued principal and lifecycle | Only if selected policy permits it. R08's editable anonymous quota cookie is not identity. Expiry, account claiming and quota are separate decisions. No automatic anonymous-to-account ownership transfer. |
| External registry identity/history/UI | Explicit files, native types, environment checklist and tests for this choice | Same replaceability as built-ins. External identity must pass the same ACL journey; history can supply its own concrete repository/router; UI accepts inferred transport DTOs and explicit actions. |

On logout/account switch: stop/detach old subscriptions, cancel pending reads, destroy the identity-scoped QueryClient and runtime/view stores, and purge drafts/pending-create cache for that identity before rendering the next user. Check the identity epoch before applying an in-flight response. Do not replay Alice's pending create under Bob's new credentials. A private view may persist its own draft only under the selected retention policy; reattachment must reverify the caller. Already delivered bytes cannot be revoked, and logout alone does not mean canceling a running execution.

## API and procedure examples

Procedure names below are proposed local API names; retain M07's `conversation.create` and `conversation.resolve`. Use strict Zod inputs, inferred tRPC outputs, request-scoped verified owner and explicit output schemas that cannot leak `message`, `owner_subject` or canonical history.

| Procedure | Input / result | Database and behavior |
| --- | --- | --- |
| `conversation.create` | Existing `{operationId, message}` → `{conversationId, sessionId}` | M07 reservation semantics. Empty UI has no record until first send. Selected history creates metadata after successful binding, idempotently; metadata failure must never rerun Eve. |
| `conversation.operation` (new mandatory recovery API) | `{operationId}` → discriminated `missing / creating / uncertain / bound` with bound IDs only | Owner-scoped status; no message returned. Missing operation is missing only for current owner. Enables safe reload without blindly reposting first text. |
| `conversation.resolve` | `{conversationId}` → existing binding | Owner + bound + not deleted. Works with no saved row. Reopening never creates a new session or sends a message. |
| `history.save` | `{conversationId}` → summary | Bound owner only. Idempotent upsert metadata; default `New conversation`. Selected automatic save path calls the same operation. No arbitrary transcript payload. |
| `history.list` | `{limit?, after?}` → `{items, nextCursor}` | Owner-only join, filter deleted, sorted/keyset paginated. No session IDs/messages in list summaries. |
| `history.detail` | `{conversationId}` → summary | Metadata read; absent metadata is distinguishable from inaccessible execution only after authorization. |
| `history.rename` | `{conversationId,title,expectedRevision}` → updated summary | Trim 1–255, SQL owner predicate + revision CAS. 409 refetch preserves user's edit for retry. |
| `history.setPinned` | `{conversationId,isPinned,expectedRevision}` → updated summary | Include for saved-history reference parity; same CAS and owner rules. |
| `conversation.delete` | `{conversationId}` → explicit deletion state | Implement only after decision below; owner-qualified tombstone/outbox transaction; retry idempotent for owner, foreign 404. No direct Eve purge assumed. |

Recommend automatic metadata saving in the selected history recipe to match the current saved-chat experience. A user-selectable explicit Save mode is a material alternative, not the default silently assumed. Use `history.save` internally for both paths. Implement selected after-bind metadata insertion as a transaction plus owner operation retry repair: completed retries repair missing metadata without another Eve call. If metadata is unavailable, expose “Conversation started; saving unavailable” with retry on the existing ID. Do not report ambiguous execution creation when only metadata persistence failed. Avoid a generic plugin callback bus: compose the concrete history service in the selected app router.

Browser types come from the selected router, and recovery status is a narrow local contract:

```ts
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "./router";
type Summary = inferRouterOutputs<AppRouter>["history"]["list"]["items"][number];
type CreateStatus =
  | { state: "missing" }
  | { state: "creating" | "uncertain"; operationId: string }
  | { state: "bound"; operationId: string; conversationId: string; sessionId: string };
```

Use a matching Zod discriminated output schema at the transport. Neither type includes the saved first-message retry text or an owner override. UI command functions accept these native inferred results; they do not coerce every selectable repository/provider into a universal framework interface.

Illustrative update shape:

```sql
UPDATE chatjs.saved_conversations s
SET title = $1, revision = revision + 1
FROM chatjs.conversations c
WHERE s.conversation_id = $2 AND c.conversation_id = s.conversation_id
  AND c.owner_subject = $3 AND c.deleted_at IS NULL
  AND s.revision = $4
RETURNING s.conversation_id, s.title, s.is_pinned, s.activity_at, s.revision;
```

If no row updated, perform an owner-scoped existence check: foreign/missing → 404; accessible stale revision → 409. Never return a foreign record's title in conflict details. Enforce inputs and ACL in SQL/service even when the UI hides a button.

## Query keys, UI states and view ownership

Use selected `@trpc/tanstack-react-query` + TanStack Query v5 generated options/keys, as the current app does. Install them only for the selected history UI. Each identity session gets its own QueryClient; server rendering gets a new request-local client. Query keys are not authorization. Do not rely on the full app's browser singleton cache across users.

```ts
const listOptions = trpc.history.list.queryOptions({ limit: 30 });
const detailKey = trpc.history.detail.queryKey({ conversationId });
const bindingKey = trpc.conversation.resolve.queryKey({ conversationId });
// after an acknowledged rename or pin:
await Promise.all([
  queryClient.invalidateQueries({ queryKey: trpc.history.list.queryKey() }),
  queryClient.invalidateQueries({ queryKey: detailKey }),
]);
```

| Event | Cache/action consequence |
| --- | --- |
| Create bound + saved | Set/refetch binding and detail from verified result; invalidate every list page; replace only the originating view's URL/selection |
| Save retry succeeds | Invalidate list/detail; execution store unchanged |
| Rename/pin succeeds | Invalidate list prefix and that detail; do not rebuild Eve store or change cursors |
| Accepted new activity | Coalesce list/detail invalidation on server-observed activity or settled turn, not every token; focus refetch reconciles other tabs |
| Delete accepted | Remove matching detail/binding/projection caches; invalidate list; detach every view of that conversation; execute selected cancellation policy server-side |
| 401 / identity epoch change | Dispose old client's cache and subscriptions; ignore stale responses; show selected login action or host identity-required state |
| 404 on reopen | Remove stale item/detail; show unavailable state; do not silently create a replacement conversation |

Independent views can share metadata and one execution owner while maintaining different display cursors and drafts. A list item click targets an explicit `viewId`; it must not overwrite another view's selection. Replay offset is not a view's selected message/path cursor. If a user clicks A then B while A loads, apply only B's response to that view. Cancel/respond commands target the actual session/turn/request, not a global selected conversation. Reopen from history installs no universal run framework and does not require freezing P2+ component names from PR317.

Direct JSX example (local illustrative names, not a registry API):

```tsx
export function SavedWorkspace() {
  return (
    <WorkspaceLayout>
      <SavedList onOpen={(id) => openInView("main", id)} />
      <ConversationView viewId="main" />
      <ConversationView viewId="comparison" />
    </WorkspaceLayout>
  );
}
```

Components remain ordinary editable functions. Select a concrete layout module; don't make core enumerate and auto-place every history component through a global component dictionary. Pending/failed states below are behavior requirements, independent of names or styling.

| Situation | Required presentation/action |
| --- | --- |
| No conversations | Successful empty list with New conversation action; distinguish from list failure |
| List pending / failed | Stable loading placeholder; error with Retry. Never label a failed query “No conversations” |
| First send pending | Disable duplicate submit in originating view; persist identity/view-scoped operation and normalized payload before request |
| Creating / uncertain | Show unresolved status, preserve operation ID; status refresh and selected recovery route, no automatic new UUID retry |
| Bound, metadata failed | Keep conversation usable; saving error/retry against same ID |
| Reopen loading | Target view loading, preserve other views; no automatic send |
| Replay/network failure | Reconnect against same binding; partial projection labelled reconnecting; don't lose pending input based on optimistic click |
| Pending tool approval | Render native request identity; only authoritative `input.resolved` clears it |
| Rename pending / failed | Keep edit draft, disable duplicate save; restore or refetch on conflict; no misleading success toast |
| Delete pending / failed | State reflects accepted policy; no disappearance before server acknowledgement; explain retained/deleting state accurately |

## Decisions for Francisco before product implementation

These are options for review, not enacted policies. The fixture's `forget` only removes optional metadata and is deliberately not called Delete.

| Decision | Options and recommendation | Consequence / gate |
| --- | --- | --- |
| Meaning of Delete | (A) Remove from saved list only; name it “Remove from history”. (B) Tombstone conversation, deny future access, coordinate cancel and eventual purge. Recommend B for a Delete label, with explicit retention disclosure. (C) immediate complete purge only if all selected stores support it | Current demo deletes Chat/messages/attachments. A/B change that behavior and require approval. Public M07 does not expose execution deletion; do not claim complete purge. |
| Active execution at deletion | Reject until terminal; or accept tombstone and queue cooperative cancellation. Recommend the latter only with durable cleanup job and trusted internal authorization | Tombstoning first makes normal cancel ACL fail. Worker must use a narrow internal cleanup path for that recorded deletion job, not a public owner bypass. Crash/retry tests required; effects already completed remain. |
| Retention | Keep until explicit purge; bounded retention; or host-managed retention. Recommend a documented host-selected retention schedule, with no invented number | Specify separate binding tombstone, first-message retry payload, Eve execution, display cache, auth/account data and selected file/document references. No private SQL deletion of Eve workflow tables. Disable unimplemented purge promises. |
| Ambiguous create | Keep current fail-closed operator reconciliation; or provide supported recovery once upstream lookup/idempotency semantics are proven. Recommend current behavior for the first slice | Status API may surface unresolved state; never clear reservation and resend. Do not infer an absent upstream result means no execution. Private table inspection/fork patches are excluded. |
| Save behavior | Automatic selected history saving (recommended for demo parity) or explicit user Save | Auto metadata failure is recoverable independently of execution. Omitting history removes both automatic metadata and UI. |
| Anonymous → account | Keep separate identities (recommended initial scope), or explicit authenticated claim flow | Never merge merely by email, browser IDs, or cookie possession without verified claim proof. Account deletion and ownership transfer need their own selected policy. |

Deletion acceptance must define treatment of already-open streams: future requests deny after tombstone, but a previously authorized long-lived stream can continue unless actively revoked. Specify and test a revocation notification/abort mechanism before promising immediate revocation. Server cannot erase bytes already delivered. `deleted_at` must be enforced in both gateway and channel and any metadata/cache read. A tombstone and durable cleanup outbox belong in one application transaction; Eve cancellation/purge and file cleanup are external operations with explicit retry/idempotency, not one imaginary cross-store transaction.

## Selection, files and executable migration stages

PR318 currently understands explicit registry files plus `provides/requires`, model/layout references, renderers and components. It does **not** yet have a native history-router composition slot or general identity-construction slot. Do not claim an item can already merge arbitrary routers. Keep existing generation supported; ship a reviewable selected router/layout source composition, and require M08 owner agreement for any narrow new composition entry. A second conflicting `lib/router.ts` target must fail preflight rather than overwrite user code.

Proposed local modules for the selected app (not changes to current `apps/chat`):

| File | Purpose / installed when |
| --- | --- |
| `lib/identity.ts` | Exactly one host/starter/external verifier; mandatory contract |
| `lib/bindings.ts`, `lib/conversation-router.ts` | Reservation/ACL/status, no saved-history imports; mandatory |
| `lib/router.ts` | Developer-owned explicit selected router construction |
| `features/history/schema.sql`, `repository.ts`, `router.ts`, `contracts.ts` | Metadata schema, owner SQL, typed API; history server selected |
| `features/history/queries.tsx`, `list.tsx`, `actions.tsx` | Generated tRPC queries and functional JSX; history UI selected |
| `components/chat/app-layout.tsx` | Reviewable JSX placement; selected concrete layout |
| `integrations/auth/*`, `app/api/auth/[...all]/route.ts` | Native starter provider wiring only when selected |
| `scripts/db-init.ts` / selected migration files | Mandatory schema plus explicit selected migrations; no auto full-demo schema import |

Selection examples below are **proposed addresses**, not published registry items or commands claimed to work today:

```json
{
  "items": [
    "@chatjs/minimal-next", "@chatjs/openai", "@chatjs/postgres",
    "@company/app-identity", "@company/history-postgres", "@company/saved-layout"
  ],
  "registries": {"@company":"https://registry.example/r/{name}.json"},
  "settings": {"model":"gpt-5-mini"}
}
```

A starter substitutes a selected auth item for `@company/app-identity`; it does not install both providers. Built-in and external history, identity, projection, UI and layout choices must declare the same **per-case** requirements and explicit files. External storage can replace the concrete binding/history repository if it preserves atomic owner reservation/CAS and authorization; do not force it through a universal database adapter. Execution storage remains constrained by supported Eve deployment, so an external binding store does not imply arbitrary Eve storage support. Registry addresses select source/dependencies; runtime environment/model settings remain project config. Validate missing requirements, conflicting identity implementations and target collisions before writing, with external setup exposed as a checklist, not arbitrary scripts.

| Stage | Concrete work | Testable acceptance and stop |
| --- | --- | --- |
| 0: Pin and decisions | Reconcile accepted M08 head; approve deletion/retention/save/recovery semantics above | Record chosen policy and supported public-Eve limitations; no production mutation |
| 1: Required seam | Extract mandatory conversation router without behavior change; add owner status API and identity-scoped pending-create handling | Existing M07 ACL/create suite passes; two valid callers, same operation UUID, concurrent duplicate, payload mismatch, crash/ambiguous create; logout cannot replay another owner's pending draft |
| 2: Metadata-only history | Fresh optional SQL migration; owner save/list/detail/rename/pin and automatic-save repair | Real Postgres tests for all foreign IDs, CAS collision, page boundary, metadata failure after bind; restart retains metadata and ACL; no metadata tables needed for minimal recipe |
| 3: History UI/reopen | Explicit JSX placement and identity-scoped query provider; zero-cursor public replay | Browser save/list/open/reload/rename/pin/error journey; no extra model/tool invocation on reopen; two independent views; pending approval resumes; account switch clears caches |
| 4: Identity recipes | Existing app verifier and selectable native starter login; external identity example | Existing identity generates without Better Auth; starter authenticates selected real provider; issuer/tenant collision negative; fresh schema/env requirements match selection |
| 5: Chosen deletion | Implement selected semantics and durable cleanup only where public support exists | Owner/foreign delete, retry, active run, open-stream revocation, restart between tombstone/cancel, retained refs and cache invalidation tested. Do not advertise full erasure absent supported cleanup |
| 6: Selected installation/reference | M08 selected add/create files and external replacements; dependency and environment inventory | Minimal omits history/auth source/deps; history+host and history+starter work; external replacement works without built-in fallback; full resolved reference keeps R07 gaps with their packet owners |

Use Bun install/lint/types and meaningful DB/API/browser tests per repository guidance. No production build merely for types. The added proof now covers real Postgres and host-supplied JWT identity. M09 implementation acceptance still needs generated source/dependency omission, live public-Eve replay, browser query/view behavior and the selected starter auth journey. Never import legacy Chat/Message trees into Eve or migrate in-flight approvals; fresh selected schema/store and explicit rollback to separate old app/store are the scope. Deploy/cutover remains unapproved.

## Dependencies handed off, not implemented

- Projects: membership/project repository owns project authorization; use stable conversation IDs and an optional relation. Moving a conversation must verify both conversation ownership and project access. Do not make every binding depend on projects or widen all owner reads now.
- Sharing: separate explicit public-read policy and sanitized projection endpoint; never grant public execute/cancel/respond, expose raw canonical history, or use public visibility to bypass private session ACL. Cloning into executable history remains M10-supported API work; old full-app clone code is not portable proof.
- Feedback/votes: own table keyed to stable conversation plus validated execution/event/message reference, caller, and uniqueness policy; validate target membership server-side. No required saved `Message` row, nor optimistic display-only IDs as authority.
- Files/documents: selected retention coordinator tracks references across Eve events and exact document revisions. Removing a display cache cannot cascade authoritative documents/files. Sharing and deletion decisions must specify those references before cleanup implementation.
- M10/UI: own supported ancestry mapping and independent live execution integration. M09 list/reopen DTOs do not embed the canonical tree or prescribe P2+ component names.

## Isolated proof and its limits

[Fixture](fixture/seam.ts), [tests](fixture/seam.test.ts), independent [manifest](fixture/package.json) and Bun lockfile. Uses real disk-backed Bun SQLite and a real tRPC HTTP handler for the credential/input check, with a controlled session-creation callback. It proves the ownership/persistence seam; it does not use Eve's private APIs or launch an Eve model/runtime. The schema is a small SQLite analogue, not the production Postgres migration above.

```sh
cd research/framework-evolution/implementation/m09/fixture
bun install --frozen-lockfile
bun test
bun run test:types
bun run lint
```

Tests cover mandatory ownership with history tables absent, reopen after database close, metadata save/list/CAS rename, foreign read/save/rename/forget denial, preservation of binding after optional metadata removal, same-owner concurrent duplicate suppression, different-owner operation isolation, unresolved creation across reopen, and HTTP rejection of unauthenticated/body-owner requests. Temporary databases are created under OS temp and removed by each test. The fixed test credential is only an injected test-host verifier. `forget` is intentionally metadata removal, not authorization to choose product Delete semantics.

SQLite fixture limitations: reopening a DB connection is not killing a process mid-transaction; SQLite's locking is not multi-process Postgres evidence; callback simulation is not public-Eve distributed idempotency; the fixture tests no OAuth/CSRF gateway, live streams, transcript cache, UI, purging, pagination or multi-view execution. Those remain explicit stage acceptance, not implied by green tests.

### Recorded validation

On 2026-09-06 with Bun `1.3.11`:

- Fixture: **5 tests passed, 30 assertions**, no skipped tests; strict `tsc --noEmit` and Biome passed after fixing optional-router narrowing in the test helper, without assertions/casts.
- Root `bun lint`: **4 successful tasks**, all shared Turbo cache hits.
- Root `bun test:types`: **3 successful tasks**, all shared Turbo cache hits. These do not cover the standalone fixture; its checks above ran directly.
- Root install used `bun install --frozen-lockfile`; no root manifest/lockfile changes. Initial root checks failed to start because this fresh worktree lacked dependencies; reruns after installation succeeded.
- No production Next build or live provider calls were run. No application source, PR branch, registry publication, deployment or deletion policy changed.


### Postgres/HTTP follow-through for #322

The [Postgres fixture](postgres-fixture/README.md) extends the first fixture's evidence without changing either reviewed PR. It starts two independently listening Bun API processes against its own PostgreSQL 17.11 database and derives trusted owner subjects from a host-issued JWT. Strict Zod output contracts prevent retry-message/owner leakage through summaries. No Better Auth, account schema or login UI is installed. `M09_HISTORY=false` installs only the mandatory conversation table and leaves the history route absent; this demonstrates schema/API separation, not selected registry source/dependency omission.

The proof kills API processes, stops PostgreSQL with `-m immediate`, restarts it and verifies PostgreSQL logged crash recovery. Both no-history and history-enabled bindings remain usable only by their owners; saved metadata/CAS revision survives. A crash immediately after the controlled external effect leaves `creating`; a caught ambiguous response leaves `uncertain`. Owner retries do not create another external effect, and other owners cannot inspect the operation status.

`history.forget` and `conversation.revoke` remain distinct fixture procedures to demonstrate the two proposed deletion meanings. Revoke preserves the binding and denies subsequent owner/foreign session access; it does not erase events or cancel running tools. The proof has no live streams to revoke. No production Delete policy was selected.

Current-engine PR317 observations inform M09-C rather than become new frozen component APIs: `getConversationView` caches each named controller under its runtime using weak keys; asynchronous follow checks `selectionVersion`; `ConversationView` remounts on runtime/view binding; `ChatSystem` persists drafts with `JSON.stringify([draftScope, viewId])`. M09 must additionally incorporate identity lifecycle and dispose old runtime/query state on account transition. Carrying an entire `ThreadStateSnapshot` into the new browser model is not authorized by this reuse recommendation.

Dependency-specific packets M09-A through M09-F are in [implementation-packets.json](implementation-packets.json). Actual generated feature implementation follows accepted #313 and relevant UI contracts. #317/#318 remain open and under review; pinned heads are evidence, not approval. The fixture is a bounded proposed API and does not replace the M07 public-Eve gateway or re-run its live model evidence.
