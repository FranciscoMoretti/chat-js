# M04: functional UI composition exploration

Status: **discussion candidate; no production API commitment or app rewrite**.
Date: 2026-09-06. Baseline: `18db694b9b67263904707a85f93673f494ea0e6d` (AI SDK 7, PR #308). Branch: `codex/m04-functional-ui-exploration`.

Recommendation: ship functional components bound by enclosing scopes, with selected, generated default service adapters. A composer should send; a history list should fetch, paginate and mutate; a document panel should load and save. Developers can replace a component or a service without reimplementing the other. Reuse shadcn/UI and AI Elements below this layer. This recommendation fills out #288; it does not reopen its approved ownership decisions.

## Evidence and limits

- [R05 source/ownership investigation](/Users/fran/.codex/worktrees/fdcc/chat-js/research/framework-evolution/implementation/findings/r05.md), commit `cbe0c53f`, is the starting seam. Current baseline still has its single cursor and shared draft-key findings.
- [R07 reference matrix](/Users/fran/.codex/worktrees/b381/chat-js/research/framework-evolution/implementation/findings/r07.md), commit `47355b66`, defines full-demo parity. The configured default, including inherited values, is the reference; a minimal selection is not a new definition of the reference.
- [Approved UI decision #288](https://github.com/FranciscoMoretti/chat-js/issues/288#issuecomment-5552163104) and [execution decision #286](https://github.com/FranciscoMoretti/chat-js/issues/286#issuecomment-5551335132) were fetched again during this investigation.
- [Eve prototype](/Users/fran/.codex/worktrees/c631/chat-js/research/framework-evolution/implementation/findings/eve-tree-session-prototype.md), requested commit `8d584dcd`, supports the ChatJS-tree/linear-history seam. Its private Eve patch is not an upstream API. Distributed create-once remains unproven. Main `ai@7.0.93` and fixture `ai@7.0.84` are separate tested graphs.
- [Upstream reuse research](m04-upstream-reuse.md) supplies current primary-source pins, behavior boundaries and registry cautions.
- [247-file source index](m04-source-index.json) records actual imports and line-numbered integration signals for components, hooks, providers, stores, runtime registry and artifacts. This is a static inventory, not a transitive package resolver or proof every feature works.
- [Executable spike](m04-spike/README.md) verifies real Thread projections, Zustand isolation, asynchronous command guards, target-bearing controls, Query caching and model inference. It does **not** mount the full UI or execute Eve/network/model work.

## Current UI inventory

All paths in this table are relative to `apps/chat/`. The exact baseline is pinned above; the source index supplies imports/line locations. “Boundary” below is proposed, while the functionality and coupling columns describe current source.

| Surface / source | Current functionality | Reads, writes and API coupling | Proposed functional boundary |
|---|---|---|---|
| `components/chat-runtime-controller.tsx`, `chat-system.tsx` | Route/runtime binding, persisted/provisional/read-only entry, initial tree, model/tool overrides | Registry store/thread; nests Artifact and ChatInput providers; remounts with runtime key | Route adapter binds a conversation view; runtime acquisition stays above view lifetime |
| `components/chat.tsx`, `chat/chat-layout.tsx`, `chat/main-chat-panel.tsx`, `chat/secondary-chat-panel.tsx` | Responsive main plus artifact area, resize handle, header/content composition | Artifact visibility; secondary panel reads session; resizable panels | Ordinary editable composition file; workspace owns sizing/panels |
| `components/messages.tsx`, `messages-pane.tsx`, `message.tsx`, `assistant-message.tsx`, `user-message.tsx` | Scroll following/button, message order, empty/loading/error states, role rendering | Selected `messages`, IDs and status from canonical store; per-message lookup | `ConversationMessages` reads view projection; retains supplied lower-level conversation primitives |
| `components/message-parts.tsx`, `part/text-message-part.tsx`, `part/message-reasoning.tsx`, `part/message-annotations.tsx` | Text/markdown, reasoning, annotations and tool dispatch | App `ChatMessage`/part types, selected message parts | Message-part composition with typed selected renderer map |
| `components/message-actions.tsx`, `message-editor.tsx`, `retry-button.tsx`, `feedback-actions.tsx` | Copy text, user edit/cancel, retry/regenerate, vote | Copy searches selected store messages; feedback tRPC mutation/query invalidation; editor embeds composer | Functional action items bind explicit message targets; feedback installs its own service/UI |
| `components/message-siblings.tsx`, `parallel-response-cards.tsx`, `hooks/use-navigate-to-sibling.ts`, `lib/stores/hooks-threads.ts` | Previous/next sibling, parallel models/status/response choice | `thread.setCursor`, canonical selected-path IDs, run map; explicit run stop elsewhere | Optional branch/parallel controls change view cursor; per-execution statuses |
| `components/response-error-message.tsx`, `thinking-message.tsx`, `parallel-response-status.ts` | Error/retry/loading feedback | Selected status/error and implicit regenerate | Error belongs to projected execution; retry targets failing message/run |
| `components/multimodal-input.tsx`, `lexical-chat-input.tsx`, `providers/chat-input-provider.tsx` | Rich text draft, Enter/send, edit mode, model/tool choices, attachment queue, stop, submission eligibility, provisional route creation, multi-response send | Zustand/Thread, session/model providers, `/api/files/upload`, `chat.stopStream`, message invalidation, navigation, artifact closing, config | Functional `Composer` + selected functional children; extract integration orchestration into installed adapters |
| `components/attachment-list.tsx`, `attachment-card.tsx`, `image-modal.tsx`, `lib/files/upload-prep.ts` | Preview/remove/download, paste/drop/file input, image preparation, PDF/image model fallback | Browser blobs, compression, direct fetch, file upload/content routes; attachments live in input provider | Optional `ComposerAttachments` owns upload/error/retry UI with `FilesService`; completion tagged to original draft generation |
| `components/model-selector.tsx`, `model-selector-logo.tsx`, `providers/chat-models-provider.tsx`, `settings/models-*` | Search/filter capability catalog, choose model/multiple counts, enable/disable preferences | Catalog/config, `settings.getModelPreferences`/mutation, session/anonymous policy, composer selection | `ModelPicker` is functional with catalog/preferences adapter; selection belongs to view; account preference changes catalog availability |
| `lib/ai/active-gateway.ts`, `gateways/*`, `app-model-id.ts` | Gateway selection and model access | Selected configuration determines gateway/model types; server provider execution | Gateway is an installation/server choice, not a currently implemented user gateway picker; external gateway supplies browser-safe catalog metadata |
| `components/responsive-tools.tsx`, `connectors-dropdown.tsx` | Tool mode selection and MCP connector enablement | Model capability/config/input state; MCP list/toggle Query mutations | Independent selectable tools and connector controls; do not make every composer import MCP |
| `components/part/tool-part.tsx`, `part/dynamic-tool.tsx`, `lib/ai/tool-renderer-registry.ts`, `tools/chatjs/ui.ts` | Built-in tool-specific rendering and installed renderer lookup; generic dynamic MCP display | Eager built-in imports; installed tool types inferred from local map; dynamic MCP UI queries connector list | Typed per-mounted-name renderer registration, installed only when selected; generic fallback validates serialized shape |
| `components/ai-elements/tool.tsx`, thread approval APIs | Approval state labels; Thread can route approval ownership | No app approval-response action/control found, consistent with R07 | Functional `ApprovalRequest` must call originating request/execution service and render pending/error/replay state; no claim of preserved existing working approval UI |
| `components/part/web-search.tsx`, `deep-research.tsx`, `research-task.tsx`, `sources.tsx` | Search sources, research progress/tasks/citations | Typed tool/data parts and message identity; stream handler clears selected research mode | Optional renderer/capability files; late completion cannot change another view's mode |
| `components/part/code-execution.tsx`, `sandbox.tsx`, `console.tsx`, `interactive-charts.tsx` | Execution output, console, charts | Tool outputs; artifact visibility; charts dynamically load implementation | Optional lazy companion; errors/retry confined to tool surface |
| `components/part/generate-image.tsx`, `generate-video.tsx`, `image-editor.tsx` | Media result/preview/download/error display | Tool/file URLs and upload/download services | Separate selected companions; video is disabled in resolved reference, not implicitly required by media UI |
| `components/suggested-actions.tsx`, `followup-suggestions.tsx` | Welcome and generated next prompts; populate/send interaction | Selected store, input model/tool, start-run actions | Functional suggestions target originating view/path; independently installable from search/research |
| `components/sidebar-history.tsx`, `sidebar-chats-list.tsx`, `sidebar-chat-item.tsx`, `chat-menu-items.tsx` | Saved list, pin/rename/delete, grouping/loading/navigation | `hooks/chat-sync-hooks.ts`: chat list and optimistic mutations/invalidation; route links | `ConversationHistory` owns queries and mutations; default navigation targets named view, optional URL adapter |
| `components/search-chats*.tsx`, `new-chat-button.tsx`, `keyboard-shortcuts.tsx` | Search dialog/filter, Cmd/Ctrl+K, new conversation | Existing history query and Next router; document-level shortcut listener | Workspace search/new-conversation controls; one workspace shortcut registration, not one per view |
| `components/sidebar-project*.tsx`, `project-home.tsx`, `project-*dialog.tsx` | Project list/create/edit/delete/instructions and project chats | Project tRPC routers, Query cache, Next navigation | Optional project capability and its history decoration |
| `components/share-button.tsx`, `clone-chat-button.tsx`, `hooks/use-shared-chat.ts`, `chat-header.tsx` | Visibility/share, public read, clone into own history | `chat.setVisibility`, `getPublicChat*`, `cloneSharedChat`; readonly state; Next route | Optional sharing with service and authorization; read-only behavior consistently applied to actions |
| `components/artifact-panel.tsx`, `artifact-actions.tsx`, `version-footer.tsx`, `toolbar.tsx`, `hooks/use-artifact.tsx` | Active document, revision traversal/diff, autosave, toolbars, stop/send, close | `document.getDocuments/getPublicDocuments/saveDocument`, Query, local dirty/version state, selected chat store, session | Workspace `DocumentPanel` receives exact revision reference and origin; runtime-targeted actions cannot infer a surrounding selected chat |
| `lib/artifacts/text/client.tsx`, `code/client.tsx`, `sheet/client.tsx`, `components/text-editor.tsx`, `code-editor.tsx`, `sheet-editor.tsx`, `diffview.tsx` | Text/code/sheet editing, suggestions, execution/export/copy and version UI | Current artifact definitions accept concrete tRPC/Query/store interfaces; editor libraries | Per-kind functional packages; browser document contract free of editor and database types |
| `components/part/document-tool.tsx`, `document-common.tsx`, `document-preview.tsx`, `read-document.tsx` | Tool cards/inline previews/open panel | Artifact setter; message ID; current panel falls back to latest revision when message match absent | Open `{documentId, revisionId, origin}`; exact-revision persistence belongs to M16, not an M04 invention |
| `components/data-stream-handler.tsx` | Processes visible-path document deltas and research completion | Reads shared selected messages; imports all artifact definitions; per-mount processed index | One runtime projection ingest; view-specific effects route explicitly; avoid processing same workspace effect twice in two views |
| `components/settings/*`, `sidebar-user-nav.tsx`, auth/upgrade components | Model/MCP/account/theme/usage interactions, auth and quota feedback | tRPC/session, Next routes, config | Selected capability UI/adapters; app-scope services, no mandatory account screens in a basic composer |

## Ownership and call flows

Application: selected integrations, model catalog, caller-aware query cache and runtime registry. Never process-global mutable state across server requests or users. Conversation: canonical ChatJS ancestry and execution mapping accessed through runtime registry; Eve owns execution. This is a resource, not necessarily another required React provider. Workspace: panel layout, active exact document revision and its command origin. View: conversation binding, cursor, composer draft/attachments/model/tool selection, scroll/edit presentation. A provider may remain one file while these ownership rules differ.

Current send: input provider → multimodal submission/parallel request specs → ApplicationThread → ChatSync/transport → `/api/chat` (plus provisional navigation and cache invalidation). Current reads: route/persistence queries → registry-owned runtime/store → selected-path fields → messages. Current stop: composer chooses active response and calls `chat.stopStream` plus runtime cancellation; several other controls still resolve selection implicitly. Current documents: tool/data parts → ArtifactProvider → panel queries/save → artifact editor. Current history: sidebar → chat-sync Query hooks → tRPC → DB. Preserve useful orchestration inside the shipped functional components/adapters.

The minimum extraction must change **all selected-path consumers together**: messages, message copy/lookup, sibling selection, parallel selection, status/error/retry, context usage, draft parent, suggestions and stream effects. Just adding a second context around `Messages` is insufficient. Commands capture a target when the control/request is created. Server-side ACL remains mandatory; caller-visible origin IDs are routing metadata, not authorization.

A document panel placed beside two views has no uniquely correct surrounding conversation context. Its open command records origin independently of currently active view. A toolbar can act on that origin or an explicitly chosen target. A historical document read must not silently become “latest”; current fallback in `artifact-panel.tsx` is a migration gap already consistent with R08/M16.

Navigation/unmount releases view subscriptions only. Explicit close-conversation/stop-all, if selected, are separate execution operations. Async sends/uploads include binding/draft generation; switching away and back cannot let an old result clear a new draft. Storage keys must include the chosen caller namespace and view/conversation binding if persistence is enabled. Files/attachments need their own lifecycle and cannot be blindly serialized as browser File objects. No universal persistence policy is proposed.

## Three concrete API alternatives

Illustrative TSX only. Names and exact paths are review candidates, not exports implemented by this spike. All alternatives can include functionality; the difference is the normal composition surface.

### A. Scoped functional components (recommended)

Generated app setup selects default adapters once. The developer then composes behavior-bearing children:

```tsx
// chat/setup.ts: generated from selected items; plain editable source
export const chat = createChatUI({
  services: createDefaultServices({ transport: createEveTransport({ baseUrl: "/api/chat" }) }),
  models: selectedModels,
  defaultModel: "fast", // inferred from selectedModels, not a global provider union
});

// chat/layout.tsx: user-owned composition
<chat.App>
  <chat.Workspace id="main">
    <ConversationHistory targetView="left" />
    <chat.View id="left" conversationId={conversationId}>
      <ConversationMessages />
      <Composer><ModelPicker /><ComposerAttachments /><ComposerSubmit /></Composer>
    </chat.View>
    <chat.View id="right" conversationId={conversationId}>
      <ConversationMessages />
      <Composer><ComposerSubmit /></Composer>
    </chat.View>
    <DocumentPanel />
  </chat.Workspace>
</chat.App>
```

Children inherit scope and execute their own behavior. `Composer` owns submission/error handling; `ModelPicker` updates this view; `ConversationHistory` fetches and handles mutations. A small `<Conversation />` convenience assembly can ship the same components with defaults. No handwritten onSubmit/onUpload/onVote wiring in ordinary use. The selected factory needs to carry project types into bindings without erasing them in a universal React context; the spike tests inference for the underlying service but does not prove the full factory's React typing.

Benefit: ordinary React composition and independently replaceable pieces. Cost: scope requirements and action eligibility need clear errors/types. An external component that expects extra services declares those requirements in its installable item; mounting it without its capability should fail setup/type validation, not silently render dead controls.

### B. Functional controller passed explicitly

```tsx
const left = useConversationView({ id: "left", conversationId });
const right = useConversationView({ id: "right", conversationId });
return <>
  <ConversationMessages view={left} />
  <Composer view={left} />
  <ExternalComposer view={right} />
  <DocumentPanel workspace={workspace} />
</>;
```

Components still include queries/mutations. Benefit: explicit targeting across portals and disconnected roots; strong inference follows the controller prop. Cost: repetitive props and easier accidental cross-view wiring. Useful optional adapter for advanced hosts, less attractive as the only normal API.

### C. Functional block with replaceable slots

```tsx
<Conversation
  viewId="left"
  conversationId={conversationId}
  components={{ Composer: ExternalComposer, MessageActions: TeamMessageActions }}
/>
```

Benefit: very short basic integration. Cost: rearranging composer/actions/panels across a workspace can turn the slots object into a new layout language. Good convenience over A, not the authoritative composition format. Avoid forcing each optional feature into a giant always-imported block or boolean switch.

## Services and portability

Prefer capability-sized imperative services beneath functional Query hooks, rather than one service interface requiring every backend or exposing tRPC types through every component:

```ts
type HistoryService = {
  list(input: { cursor?: string; projectId?: string }): Promise<HistoryPage>;
  rename(input: { conversationId: string; title: string }): Promise<void>;
  remove(input: { conversationId: string }): Promise<void>;
};
type DocumentService = {
  read(ref: { documentId: string; revisionId: string }): Promise<DocumentRevision>;
  save(input: { documentId: string; baseRevisionId: string; content: string }): Promise<DocumentRevision>;
};
// UI query adapter owns keys, pending/error state, optimistic updates and invalidation.
// Default service uses installed endpoints; an existing host replaces just this implementation.
```

Query keys include caller/cache namespace and resource/filter identity. Two views reading the same conversation share a resource cache; drafts never go into that cache. Logout/caller changes clear or replace caller cache. Injecting an implementation never relaxes server ownership checks. Model metadata and generated tool input/output types must be serializable/browser-safe; importing server-only registries via runtime values is not acceptable.

Default Next adapter uses current tRPC/navigation/auth/file routes during extraction; a future Eve adapter replaces execution integration through the minimum app's accepted seam. Vite supplies transport/navigation/auth adapters at app setup and uses React components without `next/navigation`, Next Image or Next dynamic imports. Electron can use the web service with the current auth bridge; no local-first promise follows. Keep plain `React.lazy`/Suspense boundaries in portable optional components and host image/link wrappers where necessary. A Vite/browser test remains required; a file free of Next imports alone is not proof.

## External functional component and heavyweight companion

```tsx
// installed from an external shadcn registry item into this project
import { TeamComposer } from "./components/team/team-composer";

<chat.View id="right" conversationId={conversationId}>
  <ConversationMessages />
  <TeamComposer />
</chat.View>
```

`TeamComposer` uses the public scoped composer binding (or explicit controller adapter), submits with bundled behavior, and owns any additional workflow query/error display. It can reuse AI Elements PromptInput or existing Lexical composition. Its registry item supplies source, dependencies and declared service requirements. An external URL chooses the source during installation; it is not runtime remote React evaluation. External alternatives should work for every installation option (layout, component, gateway, tool, service adapter), subject to their declared requirements. The CLI owns address resolution and installation validation.

```tsx
// tool-renderers.tsx: generated only for selected companions
const SheetResult = lazy(() => import("./tools/budget/sheet-result"));
export const budgetRenderer = defineToolRenderer(budgetContract, {
  render: props => (
    <ToolRendererBoundary origin={props.origin}>
      <Suspense fallback={<ToolPending />}><SheetResult {...props} /></Suspense>
    </ToolRendererBoundary>
  ),
});
```

The selected tool contract supplies precise payload types, not `ComponentType<Record<string, unknown>>` or a widened central union. The loader key uses the actual mounted tool name; R04 already found ambiguous fallback when mounted twice. Serialized replay input still needs schema validation. Required input needs generic functional fallback when a companion is absent/fails; hiding a component must not send approval. Keep an error boundary and retry local to the lazy surface. Do not create/load a hidden heavy component merely to hide it with CSS.

Current `ToolPart` imports all built-in renderers; `artifact-panel.tsx` and `data-stream-handler.tsx` import all three artifact definitions. Text editors and inline document previews contain dynamic imports, while code/sheet client definitions import editors eagerly. `interactive-charts.tsx` dynamically imports its implementation. Therefore current runtime feature flags and some dynamic imports do **not** establish omitted installation graphs or uniformly deferred heavy code.

## File and dependency compositions

Proposed manifests below are selection deltas, not claims of existing generated output. Exact upstream transitive dependencies come from the resolved registry JSON and lockfile; see upstream report. Shared prerequisites deduplicate through shadcn. Do not invent a second package/version manager.

```text
minimal/
  chat/setup.ts                  selected default runtime/service binding
  chat/layout.tsx                editable single view composition
  chat/runtime.ts                shared runtime access; no view cursor
  chat/view.tsx                  scoped store + projection + commands
  chat/services/execution.ts     selected transport adapter
  components/chat/messages.tsx
  components/chat/composer.tsx   basic functional composition
  components/ai-elements/...     only selected conversation/message/input items
  components/ui/...              their registry prerequisites
  server/...                     selected secure execution boundary (M07 ownership)

with-history/  (+ minimal)
  chat/services/history.ts
  chat/queries/history.ts
  components/chat/history.tsx
  server/history/...             selected persistence + authorized endpoints

compare-and-documents/  (+ selected conversation components)
  chat/layout.tsx                replace proposal: left, right, document panel
  chat/workspace.tsx
  components/chat/branch-actions.tsx
  components/documents/panel.tsx
  chat/services/documents.ts
  chat/queries/documents.ts
  documents/text/...             only if text selected

external-composer/  (replacement selection)
  components/team/team-composer.tsx
  chat/services/team-workflow.ts  only if its registry item needs it
  chat/layout.tsx                 imports installed TeamComposer

budget-sheet-tool/  (+ companion selection)
  tools/budget/contract.ts        browser-safe serialized schema
  tools/budget/tool.ts            Eve backend registration, server only
  tools/budget/sheet-result.tsx   lazy entry
  tools/budget/sheet-editor.tsx   heavy implementation
  chat/tool-renderers.tsx         selected loader registration
```

| Selection | Exclusive files/likely direct dependencies added | Omission behavior |
|---|---|---|
| Core functional chat | scoped bindings, execution adapter; React/React DOM, Zustand; selected shadcn/AI Elements prerequisites, AI SDK type/runtime needs according to adapter | No history UI, files, editors, MCP or model picker imports |
| Query-backed history | history service/hooks/UI/routes; `@tanstack/react-query`; tRPC dependencies only for chosen tRPC adapter; persistence dependencies from history selection | Composer remains functional without saved transcript navigation; ACL storage remains required separately |
| Model picker | model catalog/preferences hooks/UI; selected command/popover/checkbox components (`cmdk`, Radix prerequisites as resolved) | Fixed typed default model sends without catalog UI; server gateway still selected |
| Rich Lexical composer | Lexical input/plugin source; `lexical`, selected `@lexical/*` dependencies | Basic PromptInput composer need not install Lexical; full reference keeps its rich behavior |
| Attachments | upload-prep/queue/preview + files adapter/routes; `react-dropzone`, `browser-image-compression`, selected Files SDK/storage requirements | No upload code/deps; not just a disabled upload button |
| Branch/parallel actions | sibling/parallel functional components and projection commands | Controls and exclusive orchestration absent; shared tree representation may remain |
| Workspace resize layout | workspace/layout source, shadcn resizable; `react-resizable-panels` | Single-view layout needs no resize library |
| Text document | document service/panel + text/suggestion/diff files; selected Lexical modules, `diff` as required | No code/sheet editor imports |
| Code document | code editor/client/console; `codemirror`, selected `@codemirror/*`; execution service only if selected behavior needs it | CodeMirror absent when omitted |
| Sheet document/heavy result | sheet editor/renderer; `react-data-grid`, `papaparse` | These dependencies absent when omitted; installed companion imports implementation on demand |
| Interactive charts | charts lazy wrapper/implementation; `echarts-for-react` and resolved ECharts peer | Absent when omitted; chunk/network check still required |
| MCP controls | connector query/service/settings/generic metadata UI + selected server connector implementation | Not dragged in by core tool rendering or composer |
| External functional composer/layout/service | exact registry files/deps/requirements, generated local imports | Replacement does not automatically include the built-in alternative; installed contract checked for compatibility |

A composition can be two conversation views, a conversation plus documents, or three areas with any arrangement of those existing capabilities. File placement is the developer's editable React decision; installer only knows the conventional composition location and proposes a diff. Do not promise to round-trip arbitrary custom JSX.

## Staged plan and acceptance

1. Discuss A/B/C and the service granularity below. Keep ownership from #288 fixed. Select one normal consumer story and use the others only where justified.
2. Extract selected functional view binding around current runtime. Migrate projection consumers and explicit commands together; preserve current demo composition. Add mounted two-view checks for draft, branch, late completion, edit and origin controls. Scope workspace document selection and stream effects deliberately. Do not install an Eve private patch as a production dependency.
3. Extract core Composer/Messages/actions using current lower-level primitives, with default integration. Make optional attachments/model/history/feedback/MCP add their own files and hooks. Render a no-extra-wiring basic app and a custom external functional composer against the same scope.
4. Materialize two/three-panel sample compositions and one external selection with CLI owner. Inspect actual installed file/import/dependency graphs; no flags-only omission proof. Reuse R04/R09 resolver knowledge. Test missing service requirements and two mounted tool aliases.
5. Join accepted minimal Eve application adapter when ready. Test execution persistence, origin approval/cancel, close/reopen and concurrent views against the real server; server ACL failure states appear correctly. Branch migration remains under M10's supported-history gate.
6. Select a heavyweight renderer and measure initial vs first-use chunks/network, loading and failure/retry. Run a Vite host with injected services, and full reference parity from R07. Avoid rebuilding shadcn/AI Elements controls.

Key acceptance scenarios: same conversation in A/B with different paths/drafts/models; regenerate A while selecting B; upload A then switch/rebind before completion; stop/approve the originating execution from workspace while another view is active; close A without cancellation; open exact document revision without branch selection changes; history click targets named view; two queries deduplicate without caller data leakage; omission removes source/deps; external component works without custom submission wiring; missing heavyweight renderer preserves functional pending-input fallback.

## Written handoffs

CLI/selection owner: [selection handoff](m04-handoff-selection.md). Minimum-app owner: [runtime/service handoff](m04-handoff-minimal-app.md). These are review inputs with stable semantic needs; proposed UI names/files must not become speculative hard dependencies.

## Discussion prepared for Francisco

Recommended direction is A as the primary surface, C as an optional default assembly, and B as an escape hatch for disconnected roots. Default services are installed with the selected components; injection is an integration option, not obligatory consumer homework.

The consequential choice is **where normal customization happens**: compose functional children under scopes, or mainly replace slots on a whole Conversation block. The two-view examples above make the cost visible. A second choice is whether the first extractable Composer preserves Lexical by default or offers a basic AI Elements input as a separately named minimal selection. The full reference must keep current rich behavior whichever default the minimal installer uses. Neither choice is implemented in production here.

## Verification record

- `bun test research/framework-evolution/implementation/findings/m04-spike/scope.test.ts`: 5 pass, 17 assertions.
- Standalone fixture `tsc -p .../m04-spike/tsconfig.json`: pass, including negative inference cases.
- `bun test packages/thread/test apps/chat/lib/stores/zustand-thread-state.test.ts`: 73 pass, 225 assertions. These verify existing Thread/store contracts, not rendered multi-view behavior.
- `bun lint`: 4 successful tasks, all Turbo cache hits. `bun test:types`: 3 successful tasks, all Turbo cache hits. Research is outside those task inputs; fixture files also passed direct Biome check/format and standalone typecheck.
- Normal frozen install failed in existing `macos-alias` lifecycle (`node-gyp` missing `nopt` on Node 22.22.2). Frozen installation with scripts ignored succeeded; no lockfile change and no native/Electron validation claimed.
- No app source, production component API, migrations, deployment or publishing changes. The artifact index and proposals are research only.
