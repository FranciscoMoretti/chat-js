# M04 → minimal app: runtime/service handoff

Read [exploration](m04-functional-ui.md). UI API names remain tentative.

Semantic needs, independent of React API spelling:

- One shared conversation resource/canonical ancestry and execution mapping, independently selected by multiple view cursors. View removal releases subscriptions and never cancels execution.
- Explicit command targets for send parent, regenerate message, stop execution, approval request and tool result. Return resulting message/execution identities so only the initiating view can follow when still on the same binding/path. No global selected-run helper in the browser service contract.
- Event-derived execution status/error/required input by origin. Replay and live events must not double-apply workspace effects. Transport reconnect attaches to existing work.
- Default installed adapter provides real functionality. Hosts may inject equivalent services. React components should not need to import Next, tRPC server routers, database records or Eve internal wire types.
- Browser IDs route commands but never authorize them. Owner/conversation/session ACL storage remains mandatory even without saved-history UI. UI query namespaces also isolate caller data; they do not replace ACLs.
- History/document/files are independent selected services. Document references include exact immutable revision + origin; save consumes base revision and returns persisted successor. Do not default historical document access to latest.
- Main ai 7.0.93 and prototype Eve ai 7.0.84 remain separate pinned proofs. No UI dependency on the private seed patch or a one-branch/one-session assumption. Distributed create-once remains an execution integration gate.

The local headless spike uses a recording service to test target preservation and late-response guards, not an implementation of your server contract. Continue your minimal linear implementation without importing its illustrative API names. Join against your accepted concrete service boundary later.

## M07 return handoff reviewed (2026-09-06)

Inspected source at commit `b4f11884`, worktree `/Users/fran/.codex/worktrees/7f9a/chat-js`, without modifying it. Source evidence: `examples/minimal-next/lib/projection.ts`, `lib/note-contract.ts`, `app/chat.tsx`; reported integration evidence: `research/framework-evolution/implementation/findings/m07.md` at that commit. Browser/provider results below are M07's reported evidence, not reruns by M04.

- `useEveAgent<ProjectData>` plus `projectReducer` supplies a concrete public linear execution/projection seam. Explicit generic avoids the default EveMessageData overload. Reuse the hook's subscription cleanup; do not recreate cleanup logic. For two views of one conversation, retain the session attachment in the shared runtime scope and expose independent projections/drafts beneath it; mounting the whole sample Conversation twice is not the scoped-runtime proof.
- `ProjectMessage` extends Eve message data with validated `ConfirmedNote[]`; it is not cast into AI SDK UIMessage. `noteOutput.safeParse` validates only output-available parts whose mounted name is exactly `confirm_note`. This is concrete evidence for browser-safe project-local inference and serialized validation.
- Pending inputs are keyed by `requestId`, added on `input.requested`, removed only on `input.resolved`. A successful response HTTP call or hidden control must not clear authoritative pending state. Functional controls should show local submitting/error state separately and retain their bound session/request target.
- M07 reports real browser approval surviving both Next/Eve restart, followed by typed output. This closes a bounded linear browser approval/replay gap; it does not establish two-view UI behavior or historical branches.
- Cancel acceptance is cooperative; the active model step may finish before `turn.cancelled`. Functional UI must distinguish requesting cancellation from durable cancellation, preserve output and permit replay/reconnect. Do not equate closing an HTTP stream with stopping Eve work.
- Approval continuation can emit an empty Eve turn ID. Do not force the illustrative M04 `executionId: string` to mean a nonempty Eve turn ID or manufacture an ID. Use the concrete bound session/request handles for supported commands; preserve missing turn identity in projection. Exact public multi-run target shape remains an integration decision.
- M07's single provisional `chatjs.pending-create` key is sample-local. Multiple independent provisional composers need operation records scoped to caller/view/draft binding. Preserve fail-closed unresolved reservations; UI must not offer a fresh create as transparent retry after uncertain creation.
- Sample continuation submission clears its draft before `snapshot.send` settles. Extraction should retain failed submitted content or restore it without overwriting newer typing; reuse the snapshot/version guard investigated here. This is an extraction requirement, not a production change requested in M07.

This handoff supplies a candidate adapter implementation after the composition discussion. No need to invent a new Eve service layer before adapting these supported calls, and no dependency on the private historical-seeding patch.

## Later M07 cancellation handoff

The whole-codebase [plan](../plans/m04-composable-ui-plan.md) now uses **688c7e94**, including `lib/send-turn.ts`: after accepted cancellation, the next command performs supported public catch-up so its newly accepted response renders without manual Reconnect. The flag belongs to the shared originating runtime, not whichever composer is visible. A07 separately verifies targeted cancellation, cooperative durable state and post-cancellation response delivery. M08 compatibility variants are pinned to earlier b4f11884 and must not be quoted as validation of this later behavior.
