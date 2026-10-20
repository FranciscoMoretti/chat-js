# Shared conversation workspaces

A conversation owns history; a ChatJS workspace owns its persistent sandbox and retained original uploads. New conversations reserve a workspace. Forks retain the source workspace and initialize a new native EVE history through the selected boundary. Files, installed packages and running sandbox state are not rewound. Research children inherit the parent sandbox through EVE's existing `defineParentSandbox` interface.

## Access and dispatch

Guest and account sessions use main's single agent runtime. Disposable guests remain text-only and bypass account workspace registration; their authenticated policy and cleanup stay in the guest-runtime tables. Account sessions retain the workspace ownership and attachment checks described below.

Workspace IDs never authorize access. Conversation membership, workspace ownership and native session binding are checked together. The gateway's trusted reservation identity allows initial sandbox access before the create response is recorded. Public sharing exposes history only; another account cannot fork into the owner's workspace. Historical forks inherit file permissions and document revisions only from their selected history, so publishing an early fork does not expose later source attachments or document revisions.

An owner-family lock followed by a workspace advisory/row lock protects capture, admission and deletion. The minimal dispatch journal and workspace's active operation are committed together before native dispatch. Only one top-level operation may run per workspace. Approval waits and active descendants keep the reservation. Cancellation acknowledgement is not completion. Unreadable sessions or lost create/send responses retain the reservation and never trigger an automatic resend. Known native receipt/turn completion allows release; stale observations cannot release a newer operation. Development shutdown preserves allocations for fenced workspaces and detaches the stopped worker lease. Restart resumes the same allocation and reconciles native evidence without clearing uncertainty or redispatching.

Comparison candidates sharing a workspace run sequentially. The originating browser automatically advances only candidates the server positively classified as never dispatched (`waiting`). It removes this permission before each request; a lost reply stops automatic progression. Ordinary independent conversations have separate workspaces.

## Attachments

Uploaded originals remain immutable in authenticated app storage. The workspace attachment catalog records original identity, digest and observed native attachment paths. The app provider resolves registered attachment reads against those original bytes; ordinary filesystem reads and writes use the mutable sandbox. Editing or deleting a working copy does not change history or restore the working file.

Imported history still needs new native attachment references. The companion EVE change verifies an authorized original against its existing workspace path and builds native metadata without writing another file. Paths alone are insufficient. T1 remains; T2 retains native reference validation and model hydration, while destination allocation and duplicate staging are removed. Generated/inline seed files without a retained original identity and observed workspace path are rejected.

## Deletion

Deleting a conversation ID retires that member only. Deleting the sidebar chat ID retires the group. A surviving member retains the workspace and original uploads, including originals no longer referenced by surviving history. The final conversation triggers confirmed sandbox deletion and original-file cleanup. Incomplete cleanup remains retryable; unresolved delivery prevents destructive cleanup.

`DELETE /api/agent-workspaces/:id` is owner-authorized and only accepts an empty workspace with no unresolved work. It does not cascade-delete active conversations. Storage failures retain cleanup state for retry. Identity tombstones and accounting remain.

## Adoption

Migration 0019 intentionally requires empty conversation/sandbox state. It refuses populated state rather than inventing workspace ownership or importing uncertain deliveries. No live migration was performed.

The app branch depends on the companion EVE shared-path seed contract and the resource-provider retirement in EVE #14. The published `@chat-js/eve@0.80.1-chatjs.2` does not contain these changes. Local verification uses an external candidate archive; no archive or vendored package belongs in this diff. A separately authorized versioned package release and dependency update are required before merge. No deployment or publication is authorized here.

## Verification matrix

| Contract | Verification |
| --- | --- |
| Shared ownership, empty/text-only cleanup, active-writer protection | PostgreSQL provider tests |
| Original deletion preserves fork; final deletion removes catalog-only originals | PostgreSQL/native lifecycle deletion tests, external resources doubled |
| Concurrent admission, unknown delivery, cancellation, stale release, seed-only idle | PostgreSQL dispatch gate tests and terminal-evidence unit tests |
| Immutable originals, owner checks and retired-member denial | PostgreSQL attachment catalog test |
| Public historical fork excludes later files/document revisions; captured seed replay preserves fencing | Four PostgreSQL capture/access regressions |
| Seed PNG/PDF metadata and no duplicate writes | EVE seed integration and turn-step regressions |
| Waiting comparison progression and lost-reply fencing | Chromium component interaction tests |
| Branching notices, private workspace access and single-member deletion | Chat route captures on desktop/mobile in light/dark |
| Real model image/PDF, shared file edits, historical boundaries, deletion and restart | Two live Playwright scenarios passed: image/PDF reuse, shared mutations, boundary exclusion, original deletion, actual supervisor restart, and simultaneous sibling HTTP sends (one accepted, one conflict) |

The live acceptance environment uses disposable local PostgreSQL, an external EVE candidate, the app-owned sandbox provider and private local filesystem-backed original storage. Available Blob credentials identify a public store, so this run does not certify Vercel Blob private-store configuration. Captured logs, storage contents, screenshots and package archives stay outside the implementation diff.

After merging main at `56acb8ff5` (including the unified agent runtime), the full app unit suite passed 1,167 tests, all nine type-check tasks and lint passed, and 28 PostgreSQL workspace/guest-cleanup regressions passed against freshly applied migrations through 0019. Registry checks passed, including 182 browser tests, and 36 hosting/supervisor tests passed. The external EVE candidate included main's workflow-identity dependency patch for this verification; the earlier live model/sandbox runs above predate this main refresh and were not repeated.

A subsequent browser pass on the refreshed branch used real model responses and a fresh local database: the disposable guest flow passed (including unauthorized stream denial and reload), and the account branching regression passed edits at first/middle/last boundaries, regeneration, version navigation, reload, two-tab updates and lost-creation-response recovery. It exposed a receipt-refresh race after streaming acknowledgement cleared the pending operation; receipt refresh now targets the sent operation explicitly, and the browser regression rejects the observed disabled-query console error. Seven scoped Chromium route/component tests, the 1,167 app unit tests, lint and all nine type-check tasks passed. Next.js reported no compilation or current browser-session errors. Remote visual baseline comparison was unavailable without a UI Verify project key.

**Remaining browser-discovered gap:** the installed `code-execution` tool still allocates and closes a separate sandbox per call (`tools/chatjs/code-execution/tool.ts`). A real browser request to create/read `/workspace/branch-verification.txt` failed because that directory was absent there. The earlier shared-file acceptance scenario writes through the persistent provider directly; it does not prove that model-invoked code tools share workspace files or installed packages. This tool integration must be addressed before claiming the full shared-environment product behavior. Image/PDF upload, provider restart and shared-resource deletion were not rerun in this subsequent browser pass.
