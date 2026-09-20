# EVE UI parity audit

Compared fetched `origin/main` at `4584f093835f1667c010c8fc20c502fa3f2bde41` with controller commit `37905403` on 2026-09-20. This is a source-level audit, not a new browser or pixel-verification run. No UI fixes are included in this audit. The logical chat implementation and optimistic first send remain accepted.

## Findings

### Chat header — missing controls and project context

Main's `components/chat-header.tsx` and `components/header-breadcrumb.tsx` provide the project breadcrumb/icon/link, title dropdown, inline rename, pin, delete and share actions. The EVE runtime renders a plain title and adds a "New conversation" link in `components/eve/eve-runtime-provider.tsx:111`. The header shell's basic spacing was retained, but the interactive content was not. Main hides its standalone Share button on mobile; EVE does not apply that rule.

Restore those presentation and interaction contracts with logical chat identity for metadata mutations. Keep selected native branch identity explicit for sharing, since current EVE sharing operates on that branch's transcript.

### Project navigation loses its active context

`components/eve/eve-runtime-provider.tsx` always canonicalizes to `/chat/<chatId>`. `components/sidebar-projects.tsx` derives the active project only from the pathname. Sending from a project therefore drops its active sidebar marker. The new header also lacks a project backlink. Main uses project-qualified chat routes and resolved project metadata. A stable logical chat ID does not require losing project context: either preserve the project route shape or derive the selected project from the logical chat's metadata.

### Project home layout and empty/list states differ

Main's `components/project-home.tsx` centers the configuration and composer when the project has no chats, uses responsive container spacing, and renders `ProjectChats` with separators and a dedicated explanatory empty-state card. `components/eve/eve-project-home.tsx:65` uses a top-aligned section, a separate sidebar-toggle header, and the generic `EveHistoryList`. That adds a "Conversations" heading and search field, and changes the empty state to generic history copy. `ProjectConfig`, the project dialog, and `ProjectChatItem` are reused; restore their surrounding main layout instead of replacing those controls again.

### Sidebar structure, search entry point and collapsed state differ

Main's `SidebarHistory` wraps project entries in a labeled Projects group and renders chat date sections through `SidebarChatsList`. Its history wrapper hides content when the sidebar is collapsed and provides loading skeletons/sign-in UI. The EVE `app-sidebar.tsx:25` mounts a bare projects menu outside that wrapper: "New project" remains mounted in collapsed mode and loses the Projects heading. `SearchChatsButton` was removed, replaced by an inline history search field. `EveHistoryList` is flat rather than grouped by date. Guest history is supported by EVE, so restoring main's sign-in-only history gate would be a product regression; retain guest history while restoring the intended layout and collapsed behavior.

Project creation still uses `SidebarProjects` and `ProjectDetailsDialog`. Main already waited for creation success before closing/navigating and did not optimistically insert a project. EVE's `mutateAsync` and visible save-error handling are improvements, not evidence of lost creation optimism.

### Metadata optimism and cache coherence are incomplete

Main's `hooks/chat-sync-hooks.ts` optimistically renames/pins chats with rollback. `components/eve/eve-history-list.tsx:118` instead invalidates list queries after success and refreshes the router. It does not update/invalidate `trpc.eve.get`, which the long-lived runtime header now reads. A rename or generated-title update can therefore leave the header stale until that identity query refetches.

Main's project-page rename used the optimistic project hook. EVE's project page uses a direct mutation (`eve-project-home.tsx:55`) and waits for refetch. Sidebar project rename still uses `hooks/use-projects.ts` and retains optimistic name updates. Main's hook only patched the project name, so absence of optimistic icon/color updates is not a newly introduced regression.

Use shared logical-chat metadata mutations to patch all relevant list/detail caches and roll back on failure; reuse the project mutation contract on both surfaces. Do not use route refresh as the metadata synchronization mechanism.

### Document header and controls were rearranged

Main's `components/artifact-panel.tsx:398` shows the title with "Saving changes..." or a relative "Updated ..." subtitle. Its action area includes artifact-specific version actions; older revisions have a dedicated footer. EVE's `components/eve/eve-artifact-layout.tsx:265` omits the subtitle, adds a separate full-width save-status row plus assistant-action row, and always renders bottom Previous/Next controls. `eve-document-actions.tsx` contains only copy and the text diff toggle. This explains the changed header density and layout.

Restore the main header/action presentation while preserving EVE's draft recovery, error display and server-confirmed revision identities. Local draft contents do still update immediately through `use-document-draft.ts`; not all optimism was lost. Main optimistically appended a document cache revision on save; EVE waits for the confirmed revision while showing the local draft. A pending visual state can match main without inventing an authoritative EVE revision.

### Live document preview is missing; open revisions can remain stale

Main's `components/part/document-tool.tsx:37` sends partial title/content into the artifact panel during tool input streaming and opens the panel before completion. `components/eve/eve-document-tool.tsx:24` only remembers a pending tool call and renders "Writing document…" until a completed output. The panel explicitly excludes `documentId === "init"` and passes `status: "idle"` to its editors.

Additionally, a completed write leaves an already-visible artifact unchanged. Because the panel can be pinned to an explicit revision, invalidating document queries does not itself select the newly completed revision. Distinguish a user intentionally viewing history from following the live document; update the latter on tool completion. Verify creation and edits to an already-open document with a paused native stream before restoring live preview behavior.

### Artifact view lifetime is still branch-scoped

`components/eve/eve-artifact-layout.tsx:404` keys `ArtifactProvider` by native conversation ID. Switching versions/comparison slots in the new logical chat therefore resets the open document panel. The main artifact provider lives with the chat rather than each selected branch. Move view selection to the logical chat lifetime, while retaining the selected native execution as the authority for document access, actions, and ownership. Persisted draft keys need a deliberate ownership check before changing their scope.

## Suggested implementation order

1. Restore header/breadcrumb controls and shared optimistic metadata mutations.
2. Restore project layout, sidebar groups/search/collapsed behavior, and project active-state resolution. Retain guest history and existing recovery UI.
3. Restore document header/actions and logical-chat panel lifetime; then add live document preview with explicit pending versus confirmed revision states.

Verify desktop/mobile, empty/populated projects, slow and rejected metadata mutations, project first send, document create/edit streaming, old revision viewing, and document visibility across branch selection. Keep these UI parity fixes separate from the accepted controller commit.
