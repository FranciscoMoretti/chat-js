# UI parity implementation

Restores the audited ChatJS main UI contracts around the accepted logical-chat controller. Reference main: `4584f093835f1667c010c8fc20c502fa3f2bde41`. Implementation base: `da78b23ae977ecafb997d36eb12b3c861b8057e1` on `francisco/eve-logical-chat`.

The [100-file audit](catalog.md) and [findings](findings.md) describe the pre-fix snapshot. This file records the subsequent fixes; it does not retroactively change the baseline evidence.

## Finding disposition

| Findings | Implementation |
| --- | --- |
| H1–H3 | Logical title menu, inline rename, pin/delete/share, project breadcrumb and deletion return; responsive Share; shared breadcrumb/badge; InternalLink semantics. |
| P1–P4 | Main project shell/card/config/header; Suspense boundary; parsed chat routes prevent project UUID lookups; first submission hides project config/history while retaining the optimistic message/composer. |
| S1–S3 | Projects/Chats headings, collapsed visibility, history skeleton; Cmd/Ctrl+K search with creation-date groups; pinned/activity-date sidebar groups; project chats excluded from general sidebar history. |
| O1–O2 | Chat rename/pin update loaded list and branch-detail caches with field-specific rollback. Background title refetch respects pending metadata mutations. Project rename updates list and detail. |
| O3–O4 | Intentionally retain durable native deletion and confirmed native revisions with recoverable local drafts. No speculative authoritative transcript/revision copy. |
| D1–D2 | Main document header action order, outline controls, save status, helper toolbar, restore-as-new-revision and Back to latest. |
| D3–D5 | Partial generation preview; rich latest text/code/sheet preview; historical selection remains pinned; live completion follows native revision. Native replay is excluded from auto-open. |
| D6 | Artifact view survives branch switching within a logical chat. Reads, saves, results and Stop remain bound to the original native owner. Helpers cannot dispatch through a different selected branch. |

## Verification

- `bun lint`: passed, including docs doctor.
- `bun test:types`: passed across all 7 workspace tasks.
- EVE unit suite plus fork hook: **66 files / 343 tests passed**.
- **15 distinct browser scenarios passed**, across the full suite and focused reruns after fixes. Full run passed 13/15; subsequent native document and project lifecycle runs closed the two remaining failures. Final project/optimistic run: 5/5. Native document recovery run: both document scenarios passed. Replay/ownership fixture, native execution/billing, header/metadata, comparison, logical navigation and project route scenarios passed in their corresponding runs.
- Final real browser: new-chat header, project desktop/mobile and populated search inspected. Next MCP returned empty config/session errors. CDP first-send checks confirmed no new document requests or missing optimistic message, including guest/registered Back and Forward.
- Hosted UI Verify **did not pass**: build [01a0bf49](https://uiverify.ai/builds/01a0bf49-3a1c-7ec1-9549-48a0de31b507) failed before processing any screenshots (`processed=0`, `total=0`, no changed/failed stories). Local browser checks and manually inspected screenshots are the visual evidence; no hosted pixel-diff approval is claimed.

The verification found and fixed four additional regressions: replayed native partial tools auto-opening historical documents; editor remount/focus loss when switching from an explicit saved revision to uncached latest; project rename rollback erasing the attempted name; unnecessary title-only RSC refresh interfering with guest Back navigation. Tests retained the original recovery/focus/navigation assertions. Other test updates corrected obsolete UI labels/output-tab assumptions and used stable chat URLs instead of generated titles.

Run the complete suite from the repository root:

```sh
bun x dotenv -e .env.worktree.local -e .env.local -- bun run worktree-env chat -- sh -c 'cd apps/chat && bun x playwright test --config playwright.eve-ui-parity.config.ts'
```

Playwright fixtures require the `apps/chat` working directory. Keep the local app running on its assigned worktree port. The suite uses the isolated local test database and includes real native model/tool runs.

### Screenshot evidence

| View | Final EVE evidence | Comparison basis |
| --- | --- | --- |
| Empty project desktop | [fixed](fixed-screenshots/eve-empty-project.png) | [main](screenshots/main-empty-project.png), same project fields/theme/1440×1000 viewport and main crop |
| Empty project mobile | [fixed](fixed-screenshots/eve-empty-project-mobile.png) | [main](screenshots/main-empty-project-mobile.png), same 390×844 viewport |
| Header menu | [desktop](fixed-screenshots/header-desktop.png), [mobile](fixed-screenshots/header-mobile.png) | Main source geometry and live delayed/rejected metadata tests |
| Shared header | [mobile](fixed-screenshots/shared-header-mobile.png) | Main shared breadcrumb/badge source and actual public route |
| Sidebar search | [loaded results](fixed-screenshots/sidebar-search.png) | Main grouped search source; actual loaded query results |
| Populated project | [fixed](fixed-screenshots/project-populated.png) | Actual created chat after rename/instructions/reload |
| Native document | [mobile text](fixed-screenshots/document-mobile.png), [code](fixed-screenshots/document-code.png) | Source-matching controls, native saved revisions and retained focus |

Only the empty-project captures are paired main/EVE fixtures. Model choice remains a user-preference difference (GPT-5 mini vs Gemini 2.5 Flash Lite). Development overlays remain near image edges and are excluded from layout conclusions. No pixel-equality percentage is claimed.

The browser suite includes delayed/rejected metadata requests, first-send CDP document-request counts and message continuity, native execution and billing, revision/history/error recovery, sharing, projects, and comparison branches. Isolated component fixtures cover partial replay/live transitions and original-session ownership; native browser tests cover real reload and server persistence.

## Scope boundaries

Keep the accepted logical-chat controller and EVE execution authority. No controller/store redesign, schema migration, dependency upgrade, or fork publication belongs to this UI fix. Existing local package installation remains unchanged.

The UI families are independent review boundaries: headers/metadata, projects/sidebar, and documents. Provider/route changes are limited to their required UI wiring: metadata identity/refresh; project Suspense; native owner/status/Stop/replay callbacks. Shared artifact state gains native owner, follow-live and preview-call identity solely to preserve document lifetime and revision selection. Document body extraction reuses existing editors. The database list/detail DTO adds existing metadata columns, not a new data model.

The local `chatjs_logical_test` database default timezone was changed from Europe/London to UTC and the development server restarted. Timestamp-without-timezone defaults had made newly created records appear an hour in the future. Existing records were left intact; this is environment setup, not a UI date clamp.

## File-by-file implementation inventory

| File | Reason kept |
| --- | --- |
| [apps/chat/app/(chat)/project/[projectId]/page.tsx](<../../apps/chat/app/(chat)/project/[projectId]/page.tsx>) | Wiring: isolate request-time project auth/data beneath Suspense. |
| [apps/chat/components/app-sidebar.tsx](../../apps/chat/components/app-sidebar.tsx) | Behavior: groups, collapsed behavior, skeleton and owner-scoped search. |
| [apps/chat/components/eve/eve-artifact-layout.tsx](../../apps/chat/components/eve/eve-artifact-layout.tsx) | Behavior: logical lifetime, original-session ownership, revision restore/follow-live, header/status/Stop. |
| [apps/chat/components/eve/eve-chat-header.tsx](../../apps/chat/components/eve/eve-chat-header.tsx) | Behavior: main header menu/breadcrumb using logical metadata. |
| [apps/chat/components/eve/eve-conversation.tsx](../../apps/chat/components/eve/eve-conversation.tsx) | Wiring: original native agent messages/status/cancel and replay state. |
| [apps/chat/components/eve/eve-deletion-provider.tsx](../../apps/chat/components/eve/eve-deletion-provider.tsx) | Wiring: return to the owning project after deletion. |
| [apps/chat/components/eve/eve-document-actions.tsx](../../apps/chat/components/eve/eve-document-actions.tsx) | Behavior: main header ordering, comparison toggle, navigation and copy. |
| [apps/chat/components/eve/eve-document-assistant-actions.tsx](../../apps/chat/components/eve/eve-document-assistant-actions.tsx) | Behavior: main floating helper affordances and original-session Stop. |
| [apps/chat/components/eve/eve-document-body.tsx](../../apps/chat/components/eve/eve-document-body.tsx) | Behavior: shared native document panel/inline body using existing text/code/sheet editors. |
| [apps/chat/components/eve/eve-document-context.tsx](../../apps/chat/components/eve/eve-document-context.tsx) | Wiring: native owner and replay state for tool renderers. |
| [apps/chat/components/eve/eve-document-preview.tsx](../../apps/chat/components/eve/eve-document-preview.tsx) | Behavior: rich latest preview with main geometry and historical/live selection. |
| [apps/chat/components/eve/eve-document-run.tsx](../../apps/chat/components/eve/eve-document-run.tsx) | Wiring: separate header Run from native output while keeping source/revision checks. |
| [apps/chat/components/eve/eve-document-tool.tsx](../../apps/chat/components/eve/eve-document-tool.tsx) | Behavior: partial preview, live completion, replay suppression and historical-chip selection. |
| [apps/chat/components/eve/eve-history-list.tsx](../../apps/chat/components/eve/eve-history-list.tsx) | Behavior: parsed routes, pinned/date groups, project rows and metadata optimism; no title-only RSC refresh. |
| [apps/chat/components/eve/eve-history.tsx](../../apps/chat/components/eve/eve-history.tsx) | Wiring: general history excludes project-owned chats. |
| [apps/chat/components/eve/eve-messages.tsx](../../apps/chat/components/eve/eve-messages.tsx) | Wiring: identify latest document preview in projected messages. |
| [apps/chat/components/eve/eve-move-project-dialog.tsx](../../apps/chat/components/eve/eve-move-project-dialog.tsx) | Wiring: invalidate identity after moving a chat. |
| [apps/chat/components/eve/eve-project-home.tsx](../../apps/chat/components/eve/eve-project-home.tsx) | Behavior: main project shell and optimistic first-send transition. |
| [apps/chat/components/eve/eve-runtime-provider.tsx](../../apps/chat/components/eve/eve-runtime-provider.tsx) | Wiring: metadata-aware header and native title refetch guard. |
| [apps/chat/components/eve/eve-search-chats.tsx](../../apps/chat/components/eve/eve-search-chats.tsx) | Behavior: scoped search modal, keyboard shortcut, date groups and pagination. |
| [apps/chat/components/eve/eve-share-dialog.tsx](../../apps/chat/components/eve/eve-share-dialog.tsx) | Wiring: responsive trigger styling and reusable menu content. |
| [apps/chat/components/eve/eve-shared-page.tsx](../../apps/chat/components/eve/eve-shared-page.tsx) | Behavior: shared breadcrumb and Shared badge. |
| [apps/chat/components/eve/new-eve-conversation.tsx](../../apps/chat/components/eve/new-eve-conversation.tsx) | Wiring: report pending/recovery state without remounting composer. |
| [apps/chat/components/eve/use-document-draft.ts](../../apps/chat/components/eve/use-document-draft.ts) | Behavior: restore old contents through a new native save with latest revision precondition. |
| [apps/chat/components/eve/use-eve-metadata-mutations.ts](../../apps/chat/components/eve/use-eve-metadata-mutations.ts) | Behavior: coordinated optimistic rename/pin and reconciliation. |
| [apps/chat/components/part/document-common.tsx](../../apps/chat/components/part/document-common.tsx) | Wiring: retain native artifact owner/revision/follow-live through shared chip. |
| [apps/chat/components/sidebar-projects.tsx](../../apps/chat/components/sidebar-projects.tsx) | Behavior: project highlighting from canonical chat identity. |
| [apps/chat/hooks/use-projects.ts](../../apps/chat/hooks/use-projects.ts) | Behavior: optimistic project-detail rename with rollback. |
| [apps/chat/lib/artifacts/types.ts](../../apps/chat/lib/artifacts/types.ts) | Wiring: native owner, follow-live and active preview-call view state. |
| [apps/chat/lib/db/eve-queries.ts](../../apps/chat/lib/db/eve-queries.ts) | Wiring: existing project/pin identity and logical creation date in DTOs. |
| [apps/chat/lib/eve/optimistic-metadata.test.ts](../../apps/chat/lib/eve/optimistic-metadata.test.ts) | Test: paginated lists, branch aliases and overlapping rollback. |
| [apps/chat/lib/eve/optimistic-metadata.ts](../../apps/chat/lib/eve/optimistic-metadata.ts) | Behavior: list/detail patch and field-specific rollback; pending mutation guard. |
| [apps/chat/playwright.eve-ui-parity.config.ts](../../apps/chat/playwright.eve-ui-parity.config.ts) | Test: combined local parity regression suite with failure traces. |
| [apps/chat/tests/eve-artifact-query.fixture.ts](../../apps/chat/tests/eve-artifact-query.fixture.ts) | Test: UI contract, failure/recovery, native ownership or visual capture for the corresponding feature. |
| [apps/chat/tests/eve-document-auto-open.e2e.ts](../../apps/chat/tests/eve-document-auto-open.e2e.ts) | Test: UI contract, failure/recovery, native ownership or visual capture for the corresponding feature. |
| [apps/chat/tests/eve-document-auto-open.fixture.tsx](../../apps/chat/tests/eve-document-auto-open.fixture.tsx) | Test: UI contract, failure/recovery, native ownership or visual capture for the corresponding feature. |
| [apps/chat/tests/eve-document-run.e2e.ts](../../apps/chat/tests/eve-document-run.e2e.ts) | Test: UI contract, failure/recovery, native ownership or visual capture for the corresponding feature. |
| [apps/chat/tests/eve-document-tools.e2e.ts](../../apps/chat/tests/eve-document-tools.e2e.ts) | Test: UI contract, failure/recovery, native ownership or visual capture for the corresponding feature. |
| [apps/chat/tests/eve-header-parity.e2e.ts](../../apps/chat/tests/eve-header-parity.e2e.ts) | Test: UI contract, failure/recovery, native ownership or visual capture for the corresponding feature. |
| [apps/chat/tests/eve-optimistic-create.e2e.ts](../../apps/chat/tests/eve-optimistic-create.e2e.ts) | Test: UI contract, failure/recovery, native ownership or visual capture for the corresponding feature. |
| [apps/chat/tests/eve-project-ui.e2e.ts](../../apps/chat/tests/eve-project-ui.e2e.ts) | Test: UI contract, failure/recovery, native ownership or visual capture for the corresponding feature. |
| [apps/chat/components/project-details-dialog.tsx](../../apps/chat/components/project-details-dialog.tsx) | Behavior: initialize on open; preserve attempted name/icon/color during optimistic updates and rejected saves. |
| [apps/chat/components/eve/eve-chat-page.tsx](../../apps/chat/components/eve/eve-chat-page.tsx) | Behavior: blank new-chat header matches main; remove redundant New conversation action. Recovery keeps its explanatory title. |
