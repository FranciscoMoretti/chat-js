# Whole-codebase functional UI goal state and migration plan

**Approval status: proposed plan for Francisco. No implementation authorization, active execution goal, release, or deployment is created by this document.**

2026-09-06. Current worktree baseline: main `18db694b` (AI SDK 7). This plan supersedes the factory examples in the first M04 exploration. Direct imports and JSX composition are the accepted direction; the concrete end-state, stages and acceptance below are submitted for approval. A separate implementation task should execute the approved revision.

## 1. Goal state first

When this migration is complete, ChatJS developers assemble working chat applications by directly importing functional React components and placing them in ordinary JSX. Components connect through scoped Zustand, React Query/tRPC and runtime hooks. A composer sends, history fetches and mutates, approvals respond, files upload, and documents load/save with the installed defaults. Ordinary users of the components do not write those workflows themselves.

There is **no component factory, component-registration setup object, global selected conversation, universal extension framework or custom layout language**. Providers establish state scope and lifetime; they do not discover, register or choose their children. Local typed source and inferred router/tool/model definitions carry types. Existing shadcn/UI and AI Elements remain the lower-level interface implementation; this project does not rebuild their primitives.

One app-level runtime registry retains conversation resources and Eve attachments independently of visible views. ChatJS owns ancestry and chooses linear histories. Eve owns execution and authoritative events. Each view selects its own path and owns its own draft/model/tool/attachment selection. Workspace panels remember their exact document revision and action origin. Two or three areas can be freely composed from the same components.

The generated minimal app installs only its selected source and exclusive dependencies, and it works with default integration. The full reference app resolves to the existing demo behavior. An external registry implementation can replace any supported installation choice using that choice's actual contract. Plain frontend items need no backend tool registration. Dynamic tool/document data still requires selected parser/renderer mappings, independently of JSX composition.

Completion means a working, verified full migration plus minimal/external generated-app evidence, docs and obsolete-wiring removal—not just providers, an isolated fixture, a hidden feature flag, or a passing typecheck. Supported historical execution and other unresolved prerequisites remain explicit gates; reaching such a gate is not completion.

### Target user composition

Names/paths below are concrete proposed targets. Minor mechanical naming changes may be made during implementation, but changes to ownership or normal usage require discussion.

```tsx
// components/chat/app-layout.tsx — editable by the developer
import { ConversationView } from "@/components/chat/conversation-view";
import { Messages } from "@/components/chat/messages";
import { Composer } from "@/components/chat/composer";
import { ComposerInput } from "@/components/chat/composer-input";
import { ComposerSubmit } from "@/components/chat/composer-submit";
import { ModelPicker } from "@/components/models/model-picker";
import { AttachmentPicker } from "@/components/files/attachment-picker";

export function AppLayout({ conversationId }: { conversationId: string }) {
  return (
    <ConversationView id="main" conversationId={conversationId}>
      <Messages />
      <Composer>
        <ComposerInput />
        <ModelPicker />
        <AttachmentPicker />
        <ComposerSubmit />
      </Composer>
    </ConversationView>
  );
}
```

`Composer` owns the form and submission workflow. `ComposerInput` binds the chosen rich/basic editor. `ComposerSubmit` binds eligibility/pending state. No `onSubmit` is required for ordinary use. Optional callbacks are for host customization. A separately installed `DefaultComposer` may assemble these same imports as a convenience; it must not eagerly import every optional control. Full reference uses the current Lexical behavior; a separately selected basic input can use AI Elements without installing Lexical.

Removing ModelPicker leaves the selected/default model usable. Removing AttachmentPicker hides upload affordances; it does not silently delete existing attachments or server capabilities. Clearing attachments is an explicit operation. Uninstalling optional files/dependencies is distinct from removing JSX. Children can be rearranged under their required scope; shadcn-like composition does not mean scope-free operation.

```tsx
// Same primitives, three areas. App Query/runtime providers are above this file.
<Workspace id="comparison">
  <ResizableWorkspace>
    <ConversationView id="left" conversationId={id}>
      <ConversationHeader />
      <Messages />
      <DefaultComposer />
    </ConversationView>
    <ConversationView id="right" conversationId={id}>
      <Messages />
      <ExternalComposer />
    </ConversationView>
    <DocumentPanel />
  </ResizableWorkspace>
</Workspace>
```

The document panel is not inside either conversation view. Its target comes from the document-open command. History/search controls outside both views specify a target view, e.g. `<ConversationHistory targetView="left" />`. Routes can bind the primary view through the selected navigation adapter. A frontend-only external component imports hooks or accepts normal explicit props; neither requires registering it with a UI runtime.

## 2. Evidence, scope and what is not yet proved

Read these before implementation:

- [M04 inventory and original exploration](../findings/m04-functional-ui.md), [247-file integration index](../findings/m04-source-index.json), [direct JSX browser proof](../findings/m04-direct-jsx.md). Prior proof: two mounted views, shared query/invalidation, independent drafts/models, removable picker, external hook consumer. Recording API only, not Eve or production UI.
- [M07 report](/Users/fran/.codex/worktrees/7f9a/chat-js/research/framework-evolution/implementation/findings/m07.md), pinned source **`688c7e944cb66397ec2a0e2a80f1557dc7325b07`**. Public Eve linear browser/ACL/recovery and after-Stop follow-up evidence. Use `git show` at this commit when later working-tree content differs.
- [CLI decisions](/Users/fran/.codex/worktrees/0305/chat-js/research/framework-evolution/implementation/findings/m08-registry-groundwork.md): shared JSON starting selection, standard upstream bundles, developer-owned composition/proposed edits; optional narrow semantic metadata, not a second package manager.
- [External clarification](/Users/fran/.codex/worktrees/34f9/chat-js/research/framework-evolution/implementation/findings/external-cli-ui-handoff.md): external substitution at **every** choice, per-case guides/types/examples sufficient initially; no mandatory universal descriptor or `defineModels`/extension runtime API.
- [M08 compatibility plan](/Users/fran/.codex/worktrees/0305/chat-js/research/framework-evolution/implementation/findings/m08-compatibility-plan.md) and its adjacent evidence/matrix: actual M07 **b4f11884** baseline, text-only and external-model/identity source variants typecheck; 11 local tests/42 assertions pass, four semantic negatives reject, and each compiler rejects invalid inferred Binding. A type-correct always-allow identity fails shared conformance. This is source/type/local conformance evidence, **not** a live model/DB/browser rerun and not validation of the later M07 cancellation fix. Use its reusable boundary suites and representative matrix; a matrix coverage check is not execution success.
- [R05](/Users/fran/.codex/worktrees/fdcc/chat-js/research/framework-evolution/implementation/findings/r05.md), [R07](/Users/fran/.codex/worktrees/b381/chat-js/research/framework-evolution/implementation/findings/r07.md), [R08](/Users/fran/.codex/worktrees/50c0/chat-js/research/framework-evolution/implementation/findings/r08.md), R04/R09 installation evidence linked in M04 reports.
- [Eve private tree prototype](/Users/fran/.codex/worktrees/c631/chat-js/research/framework-evolution/implementation/findings/eve-tree-session-prototype.md), requested `8d584dcd`: feasibility accepted; private history patch not a supported production contract. Distributed create-once remains unproven.

The [coverage ledger](m04-codebase-coverage.json) covers 862 tracked files in relevant app/packages/docs/support directories. It is a mechanical file-family inventory, not a claim 854 files were individually semantically reviewed. Concrete integration traces are in the M04 source index and mappings below. Input file hashes record the CLI/external working-file clarifications, some of which were not committed in their worktrees. Recheck against current main before beginning implementation; do not copy stale source wholesale.

No unrelated marketing-site redesign, new website builder, marketplace, local-first desktop, arbitrary source round-trip, historical conversation import, upstream private fork, publishing or deployment is included. Existing docs and desktop behavior affected by the migration are included. The deferred selection website is a downstream consumer, not a prerequisite or UI-migration deliverable.

## 3. Target source organization and public surface

Canonical installable source stays in the repository's existing app/module locations. Registry items reference that source; do not maintain an independently edited second UI implementation in CLI templates. The reference app imports the same source that items distribute. Standard registry packaging may copy/build outputs, but generated copies are checked, not edited as a second authority.

```text
apps/chat/
  components/
    chat/
      app-layout.tsx                    user-owned composition; no registration
      conversation-view.tsx              ordinary view provider
      conversation-header.tsx
      messages.tsx, message.tsx          functional projection + Message scope
      message-parts.tsx, message-actions.tsx
      composer.tsx, composer-input.tsx, composer-submit.tsx
      default-composer.tsx              selected convenience assembly
      branch-navigation.tsx, parallel-responses.tsx
      stop-button.tsx, retry-button.tsx, approval-request.tsx
    workspace/workspace.tsx, resizable-workspace.tsx
    history/conversation-history.tsx, conversation-search.tsx
    files/attachment-picker.tsx, attachment-list.tsx, attachment-card.tsx
    models/model-picker.tsx, model-settings.tsx
    documents/document-panel.tsx, document-actions.tsx, revision-navigation.tsx
    projects/...   sharing/...   feedback/...   suggestions/...
    connectors/... usage/... auth/...         selected functional groups
    ui/... ai-elements/...                    existing lower-level sources
  lib/
    chat/
      runtime/registry.tsx, session-slot.tsx, projection.ts, commands.ts
      runtime/after-cancellation.ts           M07 public catch-up behavior
      view/store.ts, use-view.ts, use-messages.ts, use-commands.ts
      view/draft.ts, message-scope.tsx
      workspace/store.ts, use-workspace.ts
      types.ts                               inferred local display/origin types
    history/queries.ts                       current Query behavior extracted
    documents/queries.ts, revision-contract.ts
    files/upload-prep.ts, use-uploads.ts      reuse existing preparation
    models/use-models.ts                     catalog/preference Query hook
    ai/...                                  selected models/tools/helpers as needed
    db/...                                  selected persistence, retained history
  integrations/
    navigation.tsx, identity.ts              concrete host-selected modules
    model.server.ts, models.ts               native execution + browser catalog
    files.server.ts                         selected Files SDK implementation
  tools/<selected-tool>/
    tool.ts, contract.ts, renderer.tsx        native definition, safe schema, lazy UI
  tools/tool-mounts.ts                        selected Eve server registration
  tools/tool-renderers.tsx                    selected mounted-name parser/loaders
  documents/<selected-kind>/                 separate editor/companion imports
  trpc/react.tsx, init.ts, server.tsx
  trpc/routers/...                            selected procedures, inferred AppRouter
  app/...                                    thin Next route adapters/pages/layout
  chat.config.ts                             local runtime defaults, no UI factory
  chat.selection.json                        starting installation intent, not source authority
packages/registry/                           ordinary shadcn items/bundles
packages/cli/                                shared selection + upstream orchestration
packages/thread/                             reuse ancestry; legacy execution removed only at gate
apps/docs/                                  usage, per-case author guides, validation
```

Do not create empty files for every listed seam. Split when it isolates an actual owner, dependency or installable feature. Keep existing leaf helper names where they fit; target family and interface are authoritative. No barrel files; direct imports keep optional dependencies observable. A standalone public UI npm package is not required for this source-installation goal.

### Functional interfaces

| Export/hook | Caller supplies | Bundled behavior / required scope |
|---|---|---|
| ConversationView | stable view ID, initial/current conversation binding, optional initial selection/read-only mode | View store, binding generation and resource subscription; does not create a duplicate execution owner |
| Messages | normal layout props, optional custom message composition | View path projection; scroll/empty/loading/error; part/action rendering |
| Message / MessageActions | message ID or enclosing Message scope; JSX action children | Stable per-message lookup and eligibility; copy/edit/retry/vote components act on that message |
| Composer / input / submit | normal children and optional default/editor selection | Draft/form/eligibility, send and error recovery, attachments and model/tool snapshot; no required send callback |
| ModelPicker | optional display/filter props | Catalog/preferences query plus current view selection; works outside Composer under View |
| AttachmentPicker | optional upload policy overrides allowed by selected service | Paste/drop/file input, progress/error/retry, preparation, upload, draft-targeted completion |
| StopButton / RetryButton | resolved origin or enclosing message/run scope | Exact-target request, local pending/error and durable state; no selected-global fallback |
| ApprovalRequest | validated originating request handle | Options/freeform, pending/error, response; only authoritative resolution clears request |
| ConversationHistory / Search | target view or explicit host navigation callback | Fetch/filter/paginate as current behavior, rename/delete/pin, pending/error, invalidation |
| Workspace / DocumentPanel | workspace ID; panel generally reads workspace target | Active panels/sizing/origin; read exact revision, edit/save/diff/history, toolbar commands |
| Tool renderer | validated lifecycle payload and origin | Selected renderer's functionality; shared generic display/required-input fallback when supported |
| useView / useCommands / resource hooks | selectors or explicit targets | Typed public consumer seam for external components; defaults installed, host overrides optional |

Exact optional props should grow from converted usage, not from anticipating every imaginable host. Missing required scope errors should identify the provider needed. A provider may be wrapped by the default app layout, but consumers can import and compose it directly.

## 4. Ownership, state and lifetime rules

| State/resource | Sole writable owner | Lifetime and integration rules |
|---|---|---|
| Trusted caller, installed integration instances, QueryClient | Application/host | Per-app browser context; request-scoped server contexts; clear/replace caller caches on identity change |
| Conversation identity, title/share/project metadata, ancestry, session mappings | ChatJS server/storage | Durable identity/ownership independent of optional saved transcript navigation |
| Sessions, turns, tool results, pending input and execution lifecycle | Eve | Public events/commands authoritative; projections may be rebuilt, not independently edited transcripts |
| Session attachment and execution projection | App runtime slot keyed by authorized binding | One retained attachment per intended shared resource; view unmount removes subscription only; safe explicit app/logout disposal, not cancellation |
| View conversation binding, branch cursor, follow intent | View Zustand store | Stable identity; binding/selection generation guards async completions; same conversation may appear in multiple independent views |
| Draft, model/tool selection, attachment queue, edit draft | View/composer instance | No shared `input` or provisional-create key. Independent edit composer scope when editing; selected model availability may be shared, choice is local |
| Message-specific edit/copy/action display | Message/local UI | Stable message identity; cannot depend on global selected message array |
| Active document revision/origin, panel arrangement/sizing | Workspace Zustand store | May outlive or sit outside origin view. Closed panel does not stop work. Resize library optional |
| History/model preferences/projects/votes/documents/MCP/usage queries | React Query through installed resource hooks | Caller/resource/filter keys, mutations invalidate intended resources; same resource deduplicates across views |
| Scroll, local popover, hover, collapse | Mounted UI | Local presentation only. Heavy hidden renderers not mounted solely to hide via CSS |

A second writable transcript in Query and Zustand is prohibited. An execution projection can be read by selectors, while Query owns application resources. Persisted history projections are event-derived; ChatJS ancestry/application metadata are durable independently. `packages/thread` ancestry helpers are reusable; a Thread's canonical selected messages/status are not the view model.

Draft persistence defaults must be explicit per selected composition: preserve current reference's draft persistence with caller + conversation/provisional + view keys; a minimal app may use memory only. Attachment File objects are not persisted as JSON. Edit mode cannot overwrite the main composer draft. Rebinding, selection away/back, newer edits, unmount and successful submission each have a generation policy tested below. No global document drag/drop listeners per composer: bind to local drop target or one workspace handler that chooses the intended view.

Command target envelopes are discriminated by operation. Send captures conversation, parent/path, operation ID and initiating view/draft generation. Stop captures the supported session/run handle. Approval captures session binding and request ID; tool results also retain call identity. Document save captures document/base revision. **Do not force every target into one nonempty Eve turn ID**: M07 observed empty continuation turn IDs. Layout selection must never become authorization; validate ownership at each public ID-addressed server operation.

## 5. Before/after flows and M07 integration

**Before:** ChatSystem nests ArtifactProvider, CustomStoreProvider and ChatInputProvider. MultimodalInput combines uploads, model policy, authentication, provisional navigation, Thread commands, stop API and panel effects. Messages reads canonical selected fields. ArtifactPanel assumes surrounding chat actions. Sidebar and tool renderers import broad app modules.

**After:** app route/host providers retain runtime and Query integration. ConversationView supplies only its independent selection/draft binding. Functional pieces use focused hooks. Workspace opens a target with exact revision/origin. Selected registry items add their implementation and imports. AppLayout simply arranges those pieces.

Send: composer snapshots draft/selection → scoped command with explicit parent/operation → authorized application binding/create/resolve → public Eve command → shared event projection → each view derives its selected path. Successful follow applies only to the initiating unchanged view; other views see canonical data changes without being redirected. Failed send retains recoverable submitted content without overwriting newer typing. Ambiguous create retains its original owner-scoped reservation and pending operation; no fresh create disguised as retry.

Query mutation: history/feedback/project component → local hook → inferred tRPC procedure → authorized persistence → targeted cache update/invalidation → all subscribers. Current optimistic rollback behavior must survive extraction. One resource hook is allowed to encapsulate repeated integration; direct component imports do not require duplicated fetch code.

Document: tool/message reference → `openDocument({documentId, revisionId, origin})` → workspace selection → exact read query → selected lazy editor → save with base revision → persisted successor returned → workspace/editor updates. Historical reference does not become latest by fallback. Document-generated conversation commands preserve origin even when another panel is active.

### Mandatory M07 public-Eve behavior (688c7e94)

Reuse public `useEveAgent<ProjectData>` with explicit generic and the project reducer, or the same supported lower-level API when lifetime requires it. `ProjectMessage` is an Eve-derived projection, not an asserted AI SDK UIMessage. Share browser-safe tool schemas and validate only the correct mounted name/lifecycle state. Retain hook attachment cleanup, placed in retained runtime scope rather than each visible view.

- Pending requests appear on `input.requested` and clear on `input.resolved`. Respond acceptance, hidden controls and navigation do not clear them. Test approval and rejection after reconnect/restart.
- Cancellation is cooperative. Request accepted is distinct from durable `turn.cancelled`; active model work may finish. Preserve output and report cancellation request state without promising instant provider abort.
- `lib/send-turn.ts` performs **public catch-up after the next command following accepted cancellation**. Ordinary sends avoid extra replay. Carry the after-cancellation flag in the originating runtime/session owner, not the current composer; consume/reset it correctly across success/failure and reattachment. Test that the next response renders without manual reconnect, including after switching views.
- Current proof shows owner/non-owner isolation, linear reconnect, approval/rejection, after-Stop send, narrow mobile/a11y checks. It is not full multi-view/branch/document acceptance.
- Empty continuation turn IDs stay missing; never synthesize a replacement and present it as Eve identity.
- Durable owner-scoped creation is fail-closed for uncertain outcomes; distributed create-once and transparent crash-time recovery remain unproved. Show actionable pending/reconciliation failure, preserve draft/operation, and do not silently retry into a new session.
- Reconcile **one effective lockfile** for the production integration and rerun the relevant behavior. Separate ai 7.0.93/7.0.84 and Eve fixture proofs do not supply that lockfile.

Historical seeding/forks must use an accepted supported contract. UI extraction and public linear integration can proceed first. Full reference engine replacement cannot complete until historical tools/revisions, simultaneous branches, independent cancellation and replay pass against that contract. No private patch promoted via the registry.

## 6. Whole-codebase mapping and disposition

Paths below are relative to repository root; app-relative shorthand is marked. The coverage ledger assigns every tracked path in scope a family. The table supplies actual target responsibility and exit criterion; existing source index traces the UI integrations. A source file split across families must be removed once all owned behavior has a replacement, not kept as a compatibility hub.

| Family/current source | Target / work | Retirement or preservation rule |
|---|---|---|
| ROUTES: `apps/chat/app/(chat)/{chat-route-host,chat-providers}.tsx`, home/chat/project/share routes | Thin Next binding/navigation/loading adapters + target AppLayout; shared runtime providers above layout | Remove route-derived global selected-view assumptions; keep URLs/auth/read-only behavior |
| UI shell: `components/{chat-system,chat,chat-runtime-controller}.tsx`, `components/chat/*` | ConversationView, Workspace, AppLayout; runtime session slot separate | Delete obsolete ChatSystem wrapper/controller paths after all routes use new composition |
| UI messages: `messages*`, `message*`, assistant/user messages, thinking/errors/reasoning | `components/chat/{messages,message,message-parts,...}` + `lib/chat/view` selectors | No read of canonical selected messages/status in view components; reuse text/render primitives |
| UI actions: message-actions/editor/retry/feedback/siblings/parallel cards | Individually functional actions with Message/origin scope; branch/parallel/feedback selected separately | No implicit regenerate/stop or message lookup through another view's selected array |
| UI input: `multimodal-input`, `lexical-chat-input`, responsive tools, context bar/usage | Composer core, selected editor and optional files/models/tools/context controls; focused hooks | Remove monolithic MultimodalInput after all edit/main/default call sites replaced; retain Lexical functionality in reference |
| HOOKS/STATE: input/model/default providers, stores/base + with-* + hooks-* | View store, focused resource hooks, shared runtime projection/selectors; preserve useful store mechanics | Remove unchecked generic store casts and duplicated projection mirrors where superseded; no alias compatibility layer |
| STATE runtime: `lib/app-chat-runtime.ts`, `lib/runtime-registry/*`, ChatSync | Registry identity/lifetime reused; replace execution slot with accepted Eve adapter | Keep old slot only during migration; never execute old/new engines for one command; remove after full gate |
| TREE: `packages/thread/src/{message-tree,message-utils,...}` vs `{abstract-thread,run-registry,ai-sdk-run-chat,use-thread,...}` | Reuse ancestry/path operations and tests; replace old execution orchestration with Eve integration | Inventory actual imports; retire unused execution surfaces only after supported branch/full gates. Do not delete shared tree needed by selected features |
| HELPERS execution: cancellation/gated transports, stop-response, generation-cancellation, request IDs, parallel-chat-requests, chat-tree-actions, provisional helpers | Runtime command module, authorized binding/operation lifecycle, view-targeted adapters | Reuse proven algorithms where applicable; remove old transport/cancellation-column calls and dead helpers after endpoint replacement |
| AI: `core-chat-agent`, message conversions, completion queue, stream/data transforms | Selected Eve/native execution and event projection; keep selected prompt/error/token utilities | No independently writable transcript conversion; retire old pipeline when unused; no forced renaming of still-useful helpers |
| AI model: gateway registry/provider interface, active-gateway, model catalog/generated data/defaults/providers | Selected native model/gateway imports + optional browser-safe catalog/preferences; local inferred aliases/types | Remove eager central implementation registry/closed provider requirement and null-method obligations; keep useful schemas/metadata |
| UI/HOOKS files: attachment cards/list/modal, upload-prep, file-storage/url/content helpers | Functional files components/hooks + selected Files SDK integration; authorized upload/read/download | Preserve preparation/range/download behavior. Remove hardcoded upload fetch from composer; omit exclusive files routes/deps when unselected |
| DOCUMENTS: artifact provider/panel/actions/toolbars/version-footer + `lib/artifacts/*` | Workspace state; document query/revision module; per-kind functional editor/companion | Delete broad artifactDefinitions/eager imports and latest-revision fallback; keep editing behavior and exact save semantics |
| TOOLS documents: `tools/platform/documents/*`, read-document | Selected native tools using document persistence returning exact revision identities | Authorize writes/reads; preserve inherited revision references across branches; no success on failed save |
| TOOLS/REGISTRY built-ins: platform tools map, installed-tools and tools/chatjs maps, `part/tool-part` | Selected Eve mounts and browser-safe parsers/lazy renderers; same native contract for external items | Keep necessary data-driven dispatch, delete all-built-in central switch/eager imports; frontend-only items bypass tool plumbing |
| TOOLS search/research: web-search, steps, deep-research, progress/sources | Independently selected native tool/workflow + functional renderer; common citation projection only where needed | Preserve richer provider inputs; no universal Tavily-shaped provider interface; suggestions independent |
| TOOLS compute/media: code-execution.*, sandbox/console/charts, image/video | Selected native services + lazy functional renderers, explicit files/sandbox requirements | Keep video disabled in reference; test optional selection separately. No editor installed merely because tool returns media |
| UI/API history: sidebar history/list/item/search/new-chat/menu; chat-sync-hooks | `components/history`, `lib/history/queries`, selected tRPC chat metadata/history procedures | Retain query loading/optimism/rename/pin/delete/search/current navigation policy; split from projects/sharing |
| UI/API projects/sharing/feedback/suggestions | Corresponding components/resource hooks/routers selected independently | Preserve current CRUD, ownership, public read/revocation, clone, votes and follow-up target semantics; no invented collaboration |
| UI/API connectors: connector dropdown/settings, mcp router/client/OAuth/cache/nuqs | Selected connector UI/hooks and authorized MCP backend | Independent of basic Composer/ToolPart; preserve namespace/ownership/OAuth/discovery; unknown tool generic validation |
| UI/API auth/usage: session/anonymous/login/register/device/upgrade/credits/rate-limits | Host identity adapter + optional auth screens, usage enforcement/UI | No second auth system for external host; fail policy explicit on distributed backend outage; anonymous demo preserved |
| API: `trpc/{init,react,server,routers/*}` | Reuse tRPC inferred AppRouter; selected resource procedures; M07 create/resolve + guarded Eve routes | Split broad chat procedure ownership as needed; no UI service mega-interface; retire old stopStream/deleteTrailing transcript operations after replacement |
| PERSISTENCE: `lib/db/{schema,queries,mcp-queries,credits,...}` | Selected schemas/query modules for bindings, ancestry, metadata, document revisions, optional resources | ACL/bindings not optional with transcript UI. Avoid dragging entire reference schema into minimal selection |
| LEGACY-DATA: existing SQL migrations and snapshots, backfill utilities | Retained historical repository evidence/rollback compatibility; separate new execution store/schema | Do not rewrite applied migrations or migrate historical data under this plan; do not install unused legacy schema into minimal |
| PRIMITIVES: `components/ui`, `components/ai-elements` | Reuse existing selected source; update only proven integration/accessibility needs | No new parallel primitive library; item-level dependencies may exceed one imported symbol—measure honestly |
| DESKTOP: `apps/electron/src/*`, app electron auth handlers | Existing shell/preload/auth bridge pointed at new composed web runtime | Verify login/navigation/reconnect/branch; web-only generated output excludes Electron; no offline/local-first redesign |
| INSTALL: CLI create/add/config/scaffold/private tool resolver/injection/vendor helper | Accepted shared selection, selected upstream items, reviewable typed local imports/layout edits | Remove whole-demo copy and private tool-only format as default installation. Reuse selected storage/env helper logic; no second resolver |
| REGISTRY: build/static metadata/src/items/index | Standard shadcn items for functional slices and coherent bundles; source references canonical app/modules | Retire private file kinds/duplicate catalog requirements after consumers migrate; official Eve setup only where supported |
| DOCS: quickstart/project structure/cookbook/components/tools/gateways/CLI/testing/deployment | Functional usage, per-case external author guides, minimal/full selections, actual supported runtime limitations | Replace stale factory/old engine instructions; preserve unrelated content; run docs link validation |
| APP-SUPPORT: manifests/config/env/scripts/tests/assets | Select dependency/env requirements per graph; tests/assertions updated to new interfaces; retain branding/assets | No dependency deletions until import graph checked; never remove tests just to pass migration |
| ROOT: package/Bun/Turbo manifests, root README/migration docs, changesets | Reconcile effective dependency graph and top-level usage/package checks | Update stale engine/scaffold guidance; preserve existing version tooling; no publishing |
| SITE/RELEASE: `apps/site`, workflows/releases, support scripts | Update only migration-affected links/snippets/package checks; no builder/site redesign/publishing | Template sync cannot restore whole-demo copying. Existing release/version tooling preserved, no new package manager |

Implementation must maintain a disposition ledger of actually moved/split/retained/deleted source families plus any new findings. A catchall “legacy” folder containing live old wiring does not satisfy retirement. New unrelated cleanup does not help completion.

## 7. Installation, external replacement and defaults

Starting selection is data-only JSON shared by CLI and a future website. Standard upstream items/bundles carry files/dependencies/docs. `components/chat/app-layout.tsx` is the proposed conventional editable layout location; confirm exact path with CLI during P0 and record it once. CLI proposes edits/diffs, never round-trips arbitrary JSX or silently overwrites developer changes. Selection records starting intent after customization; source stays authoritative.

All option-bearing choices accept external item addresses: layout, input/composer/messages/actions or other selected frontend, tool/companion, model/gateway/catalog, identity/auth, files, search, sandbox/media, persistence/execution host adapters within supported scope, and other selected services. Discovery lists may be built-in; eligibility must not depend on registry origin. Compatibility remains conditional on the consumed contract, not universal interchangeability.

| Replacement case | Minimum documented contract | Required verification |
|---|---|---|
| Functional component/layout | Exports/props, required View/Workspace/Query hooks, normal usage example, dependencies | Mount alongside built-in component, scope isolation, target behavior, typecheck |
| Model/gateway | Native AI SDK/Eve model factory/ref, credentials/options, required context metadata | Actual selected model execution; picker/catalog only if selected; dynamic model reconstruction tested when used |
| Catalog/preferences | Browser-safe validated records, model keys and missing metadata behavior | Strict aliases where promised; unknown metadata stays unknown; no fabricated feature support |
| Tool/companion | Native Eve tool, browser-safe schema, lifecycle and mounted-name mapping, origin actions | Serialized invalid/mismatched payloads, two aliases, partial/error/approval/final states, actual model-tool-renderer journey |
| Files/storage | Consumed Files SDK operations, authorization and setup | Upload/read/download access, failure/range/URL behavior; optional peers omitted correctly |
| Search/research/sandbox/media | Native selected service/tool input/output plus actual capability requirements | Provider-specific behavior, cancellation/failure and returned resource handling; no universal lowest-common interface |
| Identity/persistence/host | Trusted-caller + durable binding + routes and setup supported by target host | Two-principal negative tests, no direct route bypass, restart/reconnect, target environment |

Per-case author guides and examples suffice initially. Optional semantic metadata may assist known composition; universal manifests, arbitrary install lifecycle hooks and new runtime registration systems are not prerequisites. Install-only and fully wired setup are distinct reported states. External Eve setup metadata does not execute in the tested release; do not bypass official-registry trust to run it.

Minimal selection: secure linear runtime/binding + functional message/text composer + fixed model, selected identity/host and necessary primitives. No history sidebar, full model catalog, files/editors/MCP/projects/sharing/feedback/usage screens unless selected; necessary ACL storage remains. Rich composer is separate from basic input; the reference selection keeps Lexical.

Full reference selection: reproduce [production resolved defaults](m04-reference-production.json) and [development defaults](m04-reference-development.json), captured from M08's executed resolution of baseline. Preserve attachments PNG/JPEG/PDF and limits; parallel responses; Vercel gateway/catalog/preferences; three social auth providers/anonymous limits; text/code/sheet tools/editors; weather/URL/word-count; search/deep research/code execution/image generation/follow-ups/MCP; history/projects/sharing/votes/settings/credits; existing desktop; current responsive conversation+document layout. Video remains disabled in reference; separately selectable functionality is not erased. Exact model IDs/settings are in the snapshots; changed provider availability requires explicit documented treatment, not silent parity redefinition.

Selected backend tools/renderer loaders use actual mounted keys and inferred schemas. An optional heavy renderer must add only its item graph and load on first required use. AI SDK/Eve/Files SDK upstream transitives may still bring otherwise unused provider code: report selected direct dependencies, copied source, lockfile transitives and browser chunks separately. Do not fork upstream to claim zero transitive dependencies.

## 8. Migration stages, dependencies and exit evidence

All stages begin **only after plan approval and separate implementation delegation**. Mechanical fixes within the approved scope are autonomous. Use Bun, nearest AGENTS and relevant skills. Do not turn an unmet upstream prerequisite into a weakened acceptance check.

| Stage | Work and dependencies | Exit evidence / packet relationship |
|---|---|---|
| P0 — freeze baseline/contracts | Rebase/reconcile main and handoff revisions; map resolved config; agree layout path with CLI; record approved plan revision | Current tests + inventory, selected version plan, R07 coverage ledger, no hidden scope losses. Inputs M01/R05/R07/R08 and accepted M08/external decisions |
| P1 — independent view layer | Reuse current runtime identity/tree, introduce View/Message/Workspace stores and explicit selectors/commands. Migrate all selected-path readers together | Mounted two-view paths/drafts/model/edit isolation, generations, origin routing and unmount tests. Current reference still usable. M04 groundwork; no Eve dependency |
| P2 — functional direct imports | Split Messages/Composer/actions/header and selected model/files/history hooks; build reference AppLayout using ordinary imports. P1 | Real API-backed current-runtime composition and direct external component consumer; no handwritten ordinary callbacks or factory. Provider/hook inference passes |
| P3 — public linear Eve adapter | Integrate M07 688c7e94 in retained runtime slot; reconcile dependencies; secure binding/create/resolve; pending/replay/cancel catch-up. Can develop after P0, joins P1/P2 | Linear model send/approval/rejection/restart/ACL and after-Stop send, same runtime across mounted views. M07; no full-demo engine switch |
| P4 — selected resources and workspace | Extract history/projects/sharing/votes/model settings/files/usage/auth/MCP/document modules, preserve current resource behavior. P1/P2; join execution-specific flows with P3 | Per-family real API/authorization/failure checks; document exact revisions and targeted toolbar; independent install graphs defined. M09, M14–M25 as applicable |
| P5 — tool/editor lifecycle | Port selected native tools; typed browser contracts and mounted loaders, per-kind lazy editor/renderer; optional suggestions/search/etc. P3 + relevant P4 services | Real tool result + interactive/pending/error/replay behavior; heavy initial/first-use network evidence; generic fallback; exact document revisions. M11, M16a and tool slices |
| P6 — selected create/add and external | Feed canonical source into CLI/registry accepted graph; minimal/full intent expansion; preserve edited JSX; consume M08 compatibility results. P2/P3, then incrementally P4/P5 | Fresh minimal runtime journey, external frontend-only and paired item, omission/conflict/typecheck/behavior evidence, conformance suites. M08/M11; website deferred |
| P7 — supported ancestry/execution join | Integrate accepted upstream historical history contract, ChatJS linear selection/session mapping, real concurrent branches. P3/P5 + external supported-history prerequisite | Historical tool/revision preservation, no reexecution, independent cancellation/approvals, actual compacted descendant/replay where required. M10/M16b; **hard gate** |
| P8 — full reference and portability | Assemble every resolved reference family and actual two/three-view layouts; Vite host with chosen adapters; desktop bridge. P4–P7/P6 | Full acceptance matrix below, one effective graph, host-specific tests; unsupported hosts remain unverified and cannot satisfy claimed support. M29/M30/M31 |
| P9 — retirement/docs/final audit | Remove old live wiring/unused exports/deps; replace private installer/default copy; update docs and registry inventories. Per-family retirement follows earlier exits; final after P8 | Completion checklist fully evidenced, clean relevant checks, reproducible minimal/full/external runs. No merge/release/deploy |

Stages are vertical deliverables, not permission to leave a new parallel architecture indefinitely. P4/P5 families can be completed in dependency order; each includes UI, hooks, API/runtime connection, selected files/deps and acceptance. Do not finish all presentation first and defer functionality to a later unspecified task.

If the supported-history prerequisite is unavailable, continue independent stages, retain working current reference, record the exact gate and ask for the required external decision. Do not mark the whole goal complete, silently remove branching, or introduce a private fallback. The separate implementation agent should work until the approved checklist is satisfied or a real external dependency/user decision prevents further progress; this plan does not itself start that goal.

## 9. Acceptance scenarios and evidence matrix

Every row needs a reproducible command/journey, exact environment/versions, observed result and artifact reference in the implementation ledger. Existing tests should be reused where they protect the same behavior. Add tests for real invariants, not component internals. Test doubles prove routing/edge cases; live provider/DB/browser proves integrated behavior. Typecheck success is never ACL/recovery evidence.

| ID | Scenario | Required evidence |
|---|---|---|
| A01 | Directly import functional Messages/Composer, send with defaults, remove/reorder optional controls | Mounted browser + real server; no component factory/registration or consumer send wiring |
| A02 | Same conversation A/B with distinct branches, drafts, model/tool/attachment choices and scroll | Both stay independent while shared data updates; test two and three areas |
| A03 | Edit a message while main composer has unsent content | Edit parent/target correct; main draft unchanged; failed edit recoverable |
| A04 | Submit/upload A, type more, select away/back, rebind, close/reopen before completion | Generation checks preserve later state; no stale cursor following/upload insertion; scoped persisted draft on reload/caller change |
| A05 | Regenerate A and B concurrently, change active view, stop only A | B continues; run-specific loading/error; view unmount/navigation does not cancel |
| A06 | Approval/options/freeform arrives from inactive origin, user switches views, then approves/rejects | Original session/request receives response; pending clears only on input.resolved; failure leaves retryable pending; no invented turn IDs |
| A07 | Stop accepted during model work, then next command from another view sharing session | Cooperative semantics visible; matching durable cancellation; next new assistant response renders without manual reconnect using public catch-up; ordinary send avoids redundant replay |
| A08 | Reload and restart app/worker while pending or streaming | Reattach existing authorized work, no replacement create, no duplicate tool result/workspace effect; interrupted connection can recover |
| A09 | Two trusted principals use known conversation/session/file/document/MCP IDs | Deny unauthorized read/mutation and direct Eve bypass; namespace cache/logout isolation independently checked |
| A10 | Concurrent duplicate create, lost/ambiguous creation outcome | Owner-scoped reservation; no duplicate callback/replacement; unresolved outcome shown honestly, operation/draft retained; no distributed create-once claim without proof |
| A11 | Open revision R from A while B active; edit/save; select old revision; close panel | Workspace target independent; exact R read; returned persisted successor/base validation; no latest fallback; completed output retained |
| A12 | Fork after completed tools/doc revision, generate divergent successors, reload | No completed external action rerun; ancestors and exact revision refs retained; original path unchanged; supported history contract used |
| A13 | Attach PNG/JPEG/PDF, upload failure/retry, incompatible selected model, download/range/private URL | Current policy/limits and model handling preserved; correct draft target; server access enforced |
| A14 | History list/search/rename/pin/delete; project CRUD; public share/revoke/clone; feedback updates | Current navigation targets selected view; optimistic rollback/invalidation and authorization; each item can be omitted independently |
| A15 | Model preferences and fixed external model; anonymous/signed-in policy; usage exhaustion/backend outage | Fixed app works without picker/catalog; aliases/types validated; feature requirements explicit; configured enforcement never silently fail-open |
| A16 | Built-in and external tool in all supported lifecycle states; mount same tool twice | Correct parser/renderer and original call target, malformed/unknown safe fallback; partial/preliminary/final/error/replay handled, required input not auto-resolved |
| A17 | Optional heavy renderer/editor omitted, installed-unused, then first used, then fails to load | Separate installed graph and chunk/network evidence; no server imports, hidden eager mount, or whole-registry load; loading/error/retry localized |
| A18 | Fresh minimal vs full selection, then external component/tool/service/layout add | Actual emitted source/deps/lockfile + generated typecheck + runtime journeys; selected-only imports; built-in origin not required |
| A19 | Existing customized layout/register file, colliding targets/deps, missing service/setup | Reviewable proposed diff; no silent overwrite/false complete status; upstream resolver reused; unmet behavior remains unverified |
| A20 | Next/Vite/desktop selected host, mobile layout and keyboard/screen-reader interactions | Host-specific API/auth/reconnect; no Next-only imports in portable core; reference desktop parity; responsive/a11y functional checks |
| A21 | Every full-reference feature in both resolved-default snapshots | Explicit pass or separately approved scope change for every R07 row; page-load smoke insufficient |
| A22 | Retirement scan and generated output after migration | No old live engine/store/transport/whole-copy paths or dead aliases; retained SQL history justified; docs/examples match exports |

Representative compatibility matrix includes minimal fixed-model Next; full reference Next; two-view shared runtime; external composer without backend; external model + paired tool in two mounts; files with selected non-default storage; text-only documents versus heavyweight sheet/code; Vite selected host; desktop reference. Pairwise/targeted combinations are chosen from changed boundaries and known risks, not every combinatorial permutation. Publish a supported/tested matrix and mark untested combinations unverified. Author conformance suites cover each per-case contract and can be reused by external authors without a universal compatibility protocol.

## 10. Retirement checklist and final completion criteria

These checkboxes are the proposed implementation goal's completion condition. They are intentionally unchecked; earlier research/spikes do not complete production rows.

- [ ] Approved plan revision and current baseline/handoff commits recorded; no unresolved contradiction hidden in implementation.
- [ ] Direct imports/JSX are the normal API; no required component factory, UI registry, or all-services setup object.
- [ ] Components contain functional queries/mutations/runtime integration with installed defaults; ordinary app does not wire every action.
- [ ] Existing shadcn/AI Elements source reused; no parallel primitive library; local types inferred without unsafe generic casts or central closed provider union.
- [ ] View/Message/Workspace/application ownership implemented; independent paths/drafts/edit state/selections and origin-targeted commands pass A02–A06.
- [ ] Shared runtime survives view removal; Query and Zustand do not hold independently writable execution histories.
- [ ] M07 public cancellation/recovery behavior, including after-Stop command catch-up, integrated and live-verified; empty IDs preserved honestly.
- [ ] Durable owner bindings, fail-closed creation, public route ACLs, file/document/MCP ownership and caller caches verified.
- [ ] Supported historical branching and immutable document successors pass A11–A12 before old full-demo execution is removed.
- [ ] All current UI families and resolved-reference behavior mapped and implemented; exclusions require Francisco's explicit scope decision.
- [ ] Every option-bearing installation case accepts compatible external source; per-case guide/export/type/setup/example and relevant conformance tests exist.
- [ ] Minimal/full/external create/add produce actual selected source/dependency graphs using upstream architecture; edited composition preserved; install/setup status accurate.
- [ ] Optional heavy tool/editor loading and browser/server separation verified by actual artifacts/network; upstream transitives disclosed separately.
- [ ] Next/reference, selected Vite and desktop support verified to the claimed scope; mobile/keyboard/accessibility acceptance complete.
- [ ] Old ChatSystem composition, canonical selected-path view wiring, shared draft key, implicit stop/regenerate, broad artifact stream dispatch, eager tool/gateway imports and obsolete live transports removed after replacement.
- [ ] Whole-demo scaffold default/private tool-only resolver/duplicate edited templates and unused compatibility exports removed; retained history/migration files explained.
- [ ] Quickstart, JSX composition, scope hooks, external author guides, CLI selection/add, host setup, known limitations and parity documentation match tested code.
- [ ] `bun lint`, `bun test:types`, relevant unit/integration/browser tests and docs links pass; cache use and live proof limits recorded. No production build merely for types.
- [ ] Final evidence ledger links each A01–A22 row, per-family disposition and installation inventory; no unresolved required gate mislabeled complete.
- [ ] Work is ready for review with no unauthorized merge, publishing, deployment, legacy-data conversion or upstream submission.

## 11. Approval request and subsequent delegation

Approve this end-state and staged scope before implementation begins. The accepted direct-JSX direction is not being reopened. The plan's consequential commitments are: functional slices across the whole reference app, shared runtime with independent views, selected canonical source distribution, per-case external contracts, and full parity/old-wiring removal only after supported runtime gates.

Upon approval, a separate implementation task should receive this exact plan revision and the source/evidence inputs, maintain the acceptance ledger, and execute to the checklist. It should first reconcile main and current upstream handoffs rather than blindly cherry-pick the research fixtures. The fixtures are evidence, not production implementations to transplant.

Preparation checks: all 862 coverage-ledger paths exist and are unique; family counts reconcile; P0–P9 and A01–A22 rows are present; local document links resolve; both reference JSON snapshots exactly match the inspected M08 outputs. Root lint (4 tasks) and types (3 tasks) pass via Turbo cache on unchanged application code. These validate this planning artifact, not production completion of any checklist row.
