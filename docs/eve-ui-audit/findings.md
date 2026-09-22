# Findings and verification catalog

Read with the [100-file catalog](catalog.md). The previous [summary audit](../eve-ui-parity-audit.md) remains historical; this catalog supersedes its coverage. Main is pinned to `4584f093`; EVE to `da78b23a`. No UI fixes were made during this audit.

For the subsequent fixes and verification, see [UI parity implementation](implementation.md).

## Prioritized findings

| ID | Priority | Trigger and difference from main | Evidence | Restore / retain decision |
| --- | --- | --- | --- | --- |
| H1 | P2 | Open owned chat: title dropdown, inline rename, pin/delete/share menu and project breadcrumb disappear; plain heading replaces them. | Source: deleted HeaderBreadcrumb vs RuntimeSlot header. | Restore view contract on logical chat metadata. |
| H2 | P2 | Mobile owned chat exposes standalone Share where main hid it; shared chat lacks Shared badge/tooltip. | Source: ChatHeader vs EveShareButton/EveSharedPage. | Restore responsive placement and shared indicator; keep branch-transcript sharing explicit. |
| H3 | P2 | Open/send a project chat: redirect to `/chat/<logicalId>` removes active project styling/backlink and project-aware deletion return target. | Source: project chat route, runtime open, pathname-based sidebar selection. | Resolve active project from metadata or preserve qualified routes. Stable logical IDs can support either. |
| P1 | P2 | Empty project: centered config/composer and explanatory card become top-aligned content, search field and generic history text. Header Docs/Git controls vanish. | Source + desktop/mobile matched project screenshots. | Reuse main project shell and empty/list views around EVE data. |
| P2 | P2 | Navigate to project: Next reports uncached data outside Suspense, threatening instant navigation. | Live Next MCP identifies `app/(chat)/project/[projectId]/page.tsx:22`; main session has no recorded errors. | Place auth/project/list boundary under appropriate suspense/cache policy. Do not suppress framework error blindly. |
| P3 | P2 | On `/project/<UUID>`, history interprets final UUID as conversation ID, executes failing `eve.get` lookups (both sidebar and project list mount this logic). | Source: EveHistoryList routeId/uuidPathSegment; live MCP reports repeated `eve.get` failures on exact project route. | Gate query with parsed chat route type, not UUID shape. |
| P4 | P2 | First project send: optimistic user bubble/composer appears inside project configuration/history page until admission completes. Main switches its chat surface on first submission. | Source: NewEveConversation busy branch nested in EveProjectHome; earlier optimistic project screenshot. Not recaptured under held admission here. | Preserve accepted optimistic message continuity while transitioning outer shell consistently. |
| S1 | P2 | Sidebar expanded/collapsed: Projects heading gone; New project remains in collapsed rail whereas main suppressed history body. Skeleton/sign-in composition differs. | Source + browser snapshots (EVE collapsed contains New project; main does not). | Restore grouping and responsive visibility, retain EVE guest history. |
| S2 | P2 | Cmd/Ctrl+K no longer opens chat search; sidebar search entry/dialog replaced by inline field. | Source: deleted SearchChatsButton owned keyboard handler; KeyboardShortcuts handles only new chat. | Restore modal/shortcut entry point over EVE search; search itself still exists. |
| S3 | P2 | Sidebar list loses Pinned/Today/Yesterday/7 days/30 days/Older headings and includes project chats. | Source: SidebarChatsList explicitly filtered projectId=null; EVE caller supplies no project filter. | Restore grouping/filter semantics; pinned-first DB order is already retained. |
| O1 | P2 | Rename/pin waits for server instead of updating immediately. Header identity cache may retain old title after list update; move/title settlement have similar invalidation boundary. | Source: main onMutate/rollback vs EVE onSuccess list invalidation + router.refresh; RuntimeSlot owns eve.get. Stale-title symptom not delayed-response reproduced here. | Shared optimistic logical-chat metadata cache updates with rollback and detail/list reconciliation. |
| O2 | P2 | Rename project from home waits for server; rename from sidebar remains optimistic. | Source: direct ProjectHome update mutation vs useRenameProject extraction. | Reuse consistent project mutation; do not claim icon/color optimism existed on main. |
| O3 | Intentional | Deleting chat family exposes cleanup/check/retry states instead of optimistic disappearance. | Source: EveDeleteDialog phases and native family deletion. | Keep truthful durable cleanup states; harmonize visual language without hiding uncertainty. |
| O4 | Intentional | Document draft updates locally, but version history waits for confirmed native revision rather than speculative cached revision. | Source: useDocumentDraft vs main useSaveDocument onMutate. | Preserve native revision authority and recovered drafts; show pending status in familiar location. |
| D1 | P2 | Document header loses Saving/Updated subtitle and version icons; save/helper rows and bottom navigation change density. Run moves below editor; helper toolbar becomes dropdown. | Source: main ArtifactPanel/ArtifactActions/Toolbar vs EVE panel/actions/helper/run. | Restore presentation while retaining native actions and errors. |
| D2 | P2 | Viewing an older document has no Restore this version or Back to latest version action. | Source: deleted VersionFooter; EVE only renders Previous/Next. | Restore explicit latest selection and create-new-revision restoration, never rewrite an old native revision. |
| D3 | P2 | Generate/edit document: no partial title/content panel preview; only Writing document… until result. | Source: main DocumentTool streaming updates vs EVE pending ref; EVE hides init document and passes idle editor status. | Project native partial tool input into non-authoritative preview with failure/cancel handling. |
| D4 | P2 | Last document in transcript no longer renders rich inline content preview/expand affordance; completed outputs are compact chips. | Source: deleted DocumentPreview, EVE only DocumentToolResult. | Restore main preview policy using shared editors and native revision reads. |
| D5 | P2 | Tool finishes writing while document panel is open: auto-open effect leaves visible artifact unchanged; an explicit old revision remains selected. | Source: current.isVisible short-circuit plus selectedRevisionId query. Needs live completion test to distinguish intentional historical selection from stale-follow defect. | Track follow-live vs intentionally selected historical revision explicitly. |
| D6 | P2 | Switch native branch in same logical chat: ArtifactProvider key changes and closes/resets panel. | Source: key=conversationId in EveArtifactLayout; main provider lives with chat. | Scope panel view to logical chat; keep access/action ownership native and revalidate availability. |

P2 means a user-facing parity regression or behavior needing a deliberate product decision, not a security severity. O3/O4 should **not** be reverted mechanically. H/P/S/D findings mostly predate the accepted controller; that controller exposes new cache/lifetime interactions (notably O1/D6).

## Optimistic interaction matrix

| Operation | Main | EVE now | Audit verdict |
| --- | --- | --- | --- |
| Create project | Wait for server, then close/navigate | Same; awaits errors explicitly | Retained. Do not invent missing optimism. |
| Rename project, sidebar | Immediate cached name + rollback | Same extracted hook | Retained. |
| Rename project, page | Optimistic project-list name | Wait + invalidate | O2. Main detail still had refetch dependency. |
| Project icon/color | No optimistic patch in main rename hook | Wait for server | Existing limitation, not a new loss. |
| Save instructions | Pending then invalidate/close | Same plus disabled controls/error | Retain improvement. |
| Delete project | Wait for result | Wait; prevent accidental dismissal/error shown | Retain improvement. |
| Rename chat | Patch list/detail + rollback | Wait for list invalidation | O1. |
| Pin chat | Patch cached lists + rollback | Wait for list invalidation | O1. |
| Delete chat | Optimistic list removal + rollback | Native family cleanup state | O3 intentional. |
| First chat message | Optimistic message | Implemented and previously verified | Accepted; outer project shell P4 remains. |
| Edit document text | Immediate editor content; debounced save | Immediate draft; debounced native save | Immediate editing retained. |
| Save document revision | Speculative cached version + rollback | Only confirmed revision; local draft retained | O4 intentional; align visible status, not native authority. |
| Generate document | Partial title/content preview | Wait for completed result | D3. |
| Restore old revision | Explicit new save action | No UI action | D2. |

## Screenshot evidence

Captures use actual applications at exact source revisions, not mock screenshots. Main is a detached worktree at `/Users/fran/code/chat-js-main-ui-audit` on port 3070, with isolated local `chatjs_main_ui_audit` database. EVE runs the accepted worktree on port 3060 with existing local `chatjs_logical_test`. Both use separate browser sessions, development-login Dev User, dark theme, and a newly created empty project named **Parity audit**, default icon/color, no instructions or chats.

Desktop viewport: **1440×1000**; project captures target the `main` element after collapsing sidebar (1392×1000). Mobile viewport: **390×844**, main content capture. Dialog captures target `[role="dialog"]`, with identical name and enabled Create. React Scan outline rendering was disabled before final dialog captures. Development badges/toolbars remain at page edges in project captures; exclude them from layout conclusions. Account credit balances/history differ and are excluded by crops. Selected model differs (main GPT-5 mini, EVE Gemini 2.5 Flash Lite); this is a preference/data mismatch, not asserted as a migration regression. No numerical full-page pixel-diff percentage is claimed.

| Scenario | Main | EVE | Inspected difference |
| --- | --- | --- | --- |
| Create project dialog | [main](screenshots/main-create-project.png) | [EVE](screenshots/eve-create-project.png) | Same title, subtitle, input/picker and action geometry. Shared dialog is preserved. |
| Empty project, desktop | [main](screenshots/main-empty-project.png) | [EVE](screenshots/eve-empty-project.png) | Main title roughly y=435 vs EVE y=67; main empty-state card replaced by heading/search/plain copy. Missing upper-right header links in EVE. |
| Empty project, mobile | [main](screenshots/main-empty-project-mobile.png) | [EVE](screenshots/eve-empty-project-mobile.png) | Centering, gutters, empty-state presentation and header composition compared at same width; see images. |

Main project URL: `/project/01a0bee0-224d-7237-819e-cc8e9d77ccac`. EVE project URL: `/project/01a0bedf-ea58-730b-9f12-aba8a7819efe`. Both projects were created through the UI; screenshots captured after heading/composer and empty state were ready. Neither project contains user/customer data.

No matched document/header screenshots were generated: native/main transcript and revision fixtures differ. Those findings are explicitly source-based. No hosted UI Verify pass is claimed. The optional `before-and-after` compositor is not installed; raw inspected images are provided directly instead of installing a global tool or publishing screenshots to an external service.

## Verification still required before fixing/claiming parity

- Slow/rejected rename and pin responses: immediate list/header agreement and rollback.
- Empty/populated project desktop/mobile, icon picker, instructions error, deletion, and project first-send transition.
- Expanded/collapsed/mobile sidebar, guest and registered states, date groups, search shortcut/results and pagination.
- Text/code/sheet pending document creation, already-open edit, cancellation, error, old version restoration, draft recovery, read-only share, and branch switching.
- Main/EVE document captures with equivalent seeded revisions and paused native streams. Source parity is not sufficient to call those browser-verified.

The [changed-path inventory](changed-paths.tsv) includes every changed path under components/hooks/providers/chat routes/artifact definitions, explicitly marking uncataloged paths outside the targeted audit. Settings, research/media/tool renderers, full composer parity, and execution/backend internals are **not** certified by this catalog. This scope is broader and more traceable than the previous summary without claiming unperformed verification.
