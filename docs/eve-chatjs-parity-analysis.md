# Translating ChatJS main's chat and thread model to the EVE branch

Research date: 2026-09-20. Discussion material, not an approved implementation plan.

## Scope and evidence

Behavioral reference: freshly fetched `origin/main`, commit `4584f093835f1667c010c8fc20c502fa3f2bde41`. Target: `codex/app-owned-branch-prototype`, HEAD `84c2e500b4f04ed6f4ccfa613a1a6a5367cd0df3`, including the existing uncommitted first-send runtime fix. This investigation adds research notes only; it does not change runtime, schema, or EVE fork code.

Read the companion [core thread investigation](chatjs-main-thread-semantics.md) for detailed, commit-pinned package semantics and regression-test evidence. This note concentrates on application behavior and translation to the migration branch. Sources below distinguish main facts, current EVE-branch facts, and recommendations. No claim about latest upstream EVE is made: the target is this branch's installed, patched EVE 0.61.0.

## Conclusion

Keep **one logical chat and one chat-scoped tree/controller**, with EVE sessions implementing independent execution continuations beneath it. One EVE session per branch remains a useful implementation rule, provided “branch” means an execution continuation with a parent prefix, not the identity of every selected message path.

A branch/session selector is insufficient to reproduce main. Main exposes logical messages, sibling choices at individual messages, a cursor that can point before a session's tail, independent live runs, and comparison slots that can contain several response attempts.

The previous local no-reload fix preserves an optimistic first-send transition but does not implement this architecture. Its registry stores creation descriptors and renders only the active `LiveConversation`, keyed by native session. It does not retain all chat execution controllers in background slots or provide a chat-wide message tree. [Current provider](../apps/chat/components/eve/eve-runtime-provider.tsx).

## Main's application behavior

### Identity and lifetime

Main creates one `ApplicationThread` with `id = chatId` and a Zustand-backed `ThreadState`. Normal runtime identity is `chat:<chatId>:thread:main`; the `main` suffix is not a branch ID. `ChatProviders` mounts `RuntimeSlots`, each running a `ChatSync` for its existing store/thread. The visible `ChatSystem` receives that same store/thread. Route changes do not make the rendered page the owner of execution. [M1], [M2], [M3].

A provisional chat gets its chat ID before the first network result. First send starts runs in the existing runtime and changes history to `/chat/<chatId>` or `/project/<projectId>/chat/<chatId>`. Persistence acknowledgment changes persistence state, not chat identity. Returning home allocates a fresh provisional identity. [M1], [M4].

The app's wrapper named `useChat` actually invokes `useThread` with the supplied `ApplicationThread`. Switching a supplied controller means observing a different runtime; normal sibling navigation never swaps it. Do not model every branch click as `useThread({id: branchId})`. [M5], [core investigation](chatjs-main-thread-semantics.md).

### Tree selection is not session selection

Main stores messages under a chat with `parentMessageId`. A selected transcript is the ancestry of one `cursorId`. There is no persisted branch row or branch ID in this model. Root siblings are valid, including edits to the first user message. [M6], [M7].

Sibling navigation chooses an adjacent sibling and then its last depth-first descendant leaf. It does not keep a remembered selection per parent. Selecting a comparison response uses the same descendant-selection behavior. The cursor can also target an intermediate message or null during editing. [M7].

Editing moves the cursor to the old user's parent and appends a fresh user node. The old subtree remains. Retry creates a new assistant sibling under the same user node, preserving the original response's model and comparison group/slot. Neither operation creates another chat. Sending after a selected response must use that selected ancestry, not an unrelated latest session tail. The server retrieves context by walking the submitted parent message's ancestry. [M8], [M9], [M10].

Branch selection clears transient data parts from the previous path and closes an artifact only when its owning message is no longer visible. It does not cancel background runs. Changing selected message IDs atomically updates the lookup index and visible projection, bypassing ordinary content throttling; otherwise user messages disappear for a frame. [M7], [M11].

### Runs and comparison choices

A user message is created once for a multi-model request. The primary run submits that node; secondary runs start from the same user node with `follow:false`. A run and comparison slot exist before an assistant message exists. Authenticated secondary requests wait for the primary user-persistence acknowledgment. That gate is a storage-specific mechanism; the required invariant is one durable logical user and recoverable, correlated candidate operations. [M12].

Every applicable user message renders its own response cards. Cards select a pending run before its response exists, then select the actual response/path. A slot shows its selected attempt when applicable, otherwise the latest attempt for that slot. Retrying a candidate does not manufacture a new model-choice slot. Same-model slots remain distinct by index. User edit siblings keep their version control; assistant siblings in a comparison use cards. [M7], [M13].

Selected run status/error and aggregate tree activity are distinct. Switching selection must not stop another run, let a late chunk steal the cursor, or make Stop cancel all branches. Tool/approval continuation must target the owning execution and preserve the assistant identity. See [core investigation](chatjs-main-thread-semantics.md).

### Reload and cross-tab expectations

Main fetches all messages in a chat, reconstructs the complete tree, and selects the newest message by creation timestamp for a cold hydration. That differs from rightmost-descendant sibling navigation. The in-memory cursor survives runtime reuse, but this path does not persist a user's cursor in a shared chat row. Main's resume path primarily resumes the selected partial assistant; do not claim that a cold reload automatically resumes every background run. [M3], [M6], [M14].

A globally persisted `activeBranchId`, a remembered selection per parent, a URL branch query, or resuming all background branches would be deliberate product choices rather than literal main parity. In particular, two tabs should not unexpectedly move each other's current cursor just because a server route read stores the last opened branch.

### Metadata, public sharing, copy, drafts

Main title, pin, project, ownership and visibility belong to Chat. Public chat reads return all chat messages; the shared view constructs a tree, and the shared-chat copy operation clones all messages with remapped IDs/documents. This is materially broader than sharing/copying one native session. [M6], [M15].

Main's ordinary composer persists text in a global localStorage `input` key; edit composers are local and keyed by edited message. Keeping a chat-scoped draft would be a sensible explicit improvement, not an existing main guarantee. Branch navigation within the same runtime should not force a composer remount merely to move selection. [M8], [M16].

## What the EVE branch already has, and where parity breaks

| Area | Current EVE branch | Consequence |
| --- | --- | --- |
| Logical identity | `EveChat` plus `EveConversation.chatId`, a unique native `sessionId`, parent/root/fork metadata | The database split already exists; a wholesale new schema is not automatically needed. |
| Shared metadata | Sidebar lists logical chats; forks reuse source `chatId`; initial comparison candidates share the group-derived chat ID | It is inaccurate to describe every branch as a separate DB chat. The main mismatch is controller, routing and tree projection. |
| Routes | Creation binding returns only conversation `id` and `sessionId`; fork/version/card navigation uses `/chat/<conversationId>` | Public route identity is overloaded with execution-branch identity. |
| Route resolution | Accepts either a chat or conversation ID; opening an exact conversation updates `EveChat.activeConversationId` | Reads have a global selection side effect unlike main's local cursor. |
| Tree | `projectEveMessageSiblingNavigation` infers version controls from fork lineage and the selected native transcript | Substantial existing logic to preserve, but not a complete chat-scoped graph of logical messages. |
| Session observation | `EveConversation` owns one `useEveAgent`; comparison renders one selected controller keyed by session | Unselected EVE workflows may continue server-side, but the app does not keep main's full live tree/run observation. Unmounting a view is not proof of server cancellation. |
| Comparison | One resolved response group is passed as presentation to one selected conversation; only selected candidate reports native status | Earlier groups on a shared prefix and unselected candidate live status need explicit chat-level handling. |
| UI gating | Version actions are disabled by the selected session's busy/approval state | Main can navigate independent paths while runs continue; inspect operation-specific gating rather than globally blocking navigation. |
| Public sharing | Visibility and transcript fetch are conversation/session scoped | Moving routes to chat IDs must not accidentally change which branches are public. |
| Recovery | Creation operation IDs, content hashes, uncertain outcomes, pending-message acknowledgments, checkpoint receipts | Preserve these stronger durability guarantees while changing the UI model. |

Sources: [schema](../apps/chat/lib/db/schema.ts), [queries and creation/deletion](../apps/chat/lib/db/eve-queries.ts), [creation contract](../apps/chat/lib/eve/contracts.ts), [fork controller](../apps/chat/components/eve/use-eve-fork.ts), [version navigation](../apps/chat/components/eve/eve-message-versions.tsx), [comparison controller](../apps/chat/components/eve/eve-comparison-conversation.tsx), [native controller](../apps/chat/components/eve/eve-conversation.tsx), [lineage projection and tests](../apps/chat/lib/eve/fork-source.ts), [response-group lookup](../apps/chat/lib/db/eve-response-groups.ts), [public transcript](../apps/chat/lib/eve/public-conversation.ts), [delivery correlation](../apps/chat/lib/eve/message-delivery.ts).

## Proposed translation: three distinct responsibilities

```text
App registry keyed by owner + chatId
  Chat controller
    logical message graph + cursor + selected execution
    response groups / ordered slots / attempts
    drafts and view coordination
    EVE session observers and command dispatch
      branch A -> session S1 -> many sequential native turns
      branch B -> session S2 -> many sequential native turns
      branch C -> session S3 -> many sequential native turns
```

1. **ChatJS owns product identity and navigation.** Chat IDs, logical message/node identities, parent edges, cursor, response groups/slots, app annotations, and stable sidebar/project routing.
2. **EVE owns native execution and transcript contents.** Native sessions, turns, tool/approval execution, replay and native continuation checkpoints. A native turn ID is session scoped, not a global app message ID or an entire app branch.
3. **The translation module owns correspondence.** Resolve logical selection into the correct session and immutable continuation point; project native content into the chat graph; correlate optimistic operations with durable acceptance; route events without stealing selection.

A small app-facing interface might expose `selectMessage`, `selectSibling`, `send`, `editUserMessage`, `regenerateResponse`, `selectResponseSlot`, and `stopExecution`, plus a subscribed tree snapshot. This is illustrative, not a requirement to create a new generic framework. Reuse existing ChatJS selectors/views where their contracts fit. The public thread package exports `ThreadState`/snapshot types and `createThreadStateSnapshot`, but not its internal `MessageTree` class; do not quietly deep-import internals. `AbstractThread` currently drives AI SDK per-run transports, so directly substituting EVE sessions underneath it needs a real adapter design, not an ID rename. [M5], [M17].

### The required identity mapping

Consider an original session with `U1 -> A1 -> U2 -> A2`:

```text
Chat C
U1 -> A1 -> U2  -> A2          original session S1
          |     -> A2-retry    retry session S2
          -> U2-edit -> A2-edit  edited session S3
```

The retry preserves logical `U2`; the edit creates logical `U2-edit`. Both sessions preserve the same logical `U1` and `A1`. The EVE implementation forks before a user turn and resubmits a user message for both operations, so the retry's reissued native user must explicitly map to the existing logical user while the edit's user must not. Equal content cannot decide identity. [Current fork creation](../apps/chat/lib/eve/create-conversation-operation.ts), [fork intent](../apps/chat/components/eve/use-eve-fork.ts).

Native assistant IDs such as `turn_1:assistant` can repeat in different sessions. Native inherited events may represent shared logical prefix nodes, while imported histories use `seed_message_N` and restart native turns. Simply prefixing every native ID with the current session ID would incorrectly duplicate shared nodes; simply using turn IDs would collide alternatives. A correspondence can be represented by app logical nodes plus native bindings/prefix references, with explicit aliases for retry and comparison user messages. Whether to materialize every binding or derive inherited bindings from lineage should be decided against concrete fixtures. [Native reducer](../apps/chat/node_modules/eve/dist/src/client/message-reducer.js), [import/native fork projection](../apps/chat/lib/eve/fork-source.ts).

This can be a durable **identity/lineage index** with disposable content projections. It need not become a second authoritative model transcript. Display events are appropriate inputs for display, not a replacement source for reconstructing model history and checkpoint state. The existing [app-owned branching research](upstream-drafts/eve-app-owned-branching-prototype.md) makes the same distinction; its older upstream capability audit is historical and is not treated here as current-release evidence.

### Session per branch does not mean session per turn

Ordinary append at a branch's current tail should reuse its session. Selecting an earlier logical node does not rewind a mutable session. A subsequent send from that prefix must resolve/create a fork instead of appending after later messages. An execution branch has a growing head; a cursor can point anywhere on its visible path. Keep cursor identity separate from branch identity.

Pending creation and pending response execution also exist before a session or assistant message is bound. Reserve logical identities/order before dispatch; do not reorder choices by response arrival. Keep operation ID, app execution identity, response slot and native session/turn correspondence distinct. Retrying an ambiguous create must reuse its operation; intentionally regenerating an answer must create a new attempt.

### Checkpoint and resource correctness remain separate

A selected message is not automatically a forkable checkpoint. Preserve the current checks for ready native prefixes, imported boundaries, unresolved tools, documents and sandbox state. Main's UI tree does not prove a provider filesystem snapshot is ready. A new app controller should expose pending/unavailable branch creation without losing the original view or replaying old tool effects. This investigation did not revalidate provider snapshot atomicity. [Checkpoint readiness](../apps/chat/lib/eve/checkpoint-readiness.ts), [installed checkpoint restore](../apps/chat/node_modules/eve/eve-patched-dist-src-execution-restore-session-checkpoint.js), [document history](../apps/chat/lib/eve/document-history.ts).

## Migration order and acceptance contract

Proposed order, not yet implemented:

1. Define canonical chat, node, cursor, execution and native-binding contracts. Make root creation return explicit `chatId`, branch identity and session binding rather than ambiguous `id`. Keep the existing recovery operation intact.
2. Build a chat-wide lineage/content projection and prove edit/retry/comparison identity using existing native forks. Handle repeated native IDs and imported seeds first. Do not begin by renaming every `conversationId` indiscriminately.
3. Move session observation out of route-owned views into a chat controller registry. Separate running-session observation from rendering; cache or lazily load settled alternatives, but keep active operations observable. The UI should consume the shared graph and selected path.
4. Reconnect existing sibling, response-card, artifact and composer behavior. Remove branch-driven route navigation and make `/chat/C` and `/project/P/chat/C` canonical. Handle existing branch URLs via explicit compatibility resolution/redirect, not permanently ambiguous identity.
5. Audit chat-level mutations, public sharing/copy, selection persistence, guest identity and deletion. Retain branch-scoped artifacts/execution resources where appropriate. Decide intentional differences before claiming parity.

Minimum acceptance scenarios:

- First send retains chat/node IDs through optimistic, accepted and streamed states; no document reload or one-frame missing row.
- Edit first and earlier user messages; keep old subtrees and create user siblings under the correct parent.
- Retry an old assistant; retain one user node and original descendants, add one assistant alternative using the original model/tool metadata.
- Return to a sibling with nested descendants and select the same rightmost path as main; separately verify the cold-hydration default.
- Compare two models, including repeated models; select a candidate before its first chunk and reverse response-arrival order.
- Retry one comparison slot; preserve the group/slot and access to the selected older attempt where main exposes it.
- Create a later comparison on a chosen response; earlier user-message cards remain correctly addressable.
- Switch branch or chat while output streams; background updates cannot steal selection or lose their own status. Stop affects only its intended execution.
- Resolve a tool approval/continuation without turning it into regeneration or updating another branch's node.
- Replay a session, inherit a prefix, import a copied seed, and fork again without duplicate user rows, ID collisions or replayed prior tools.
- Two tabs select different paths without cross-tab cursor theft; late creation/stream responses remain associated with their original operation.
- Preserve project routes, one sidebar entry, metadata scope, artifact visibility, draft behavior, owner checks, deletion fencing and guest recovery.
- Explicitly test the chosen public sharing/copy scope; main's all-tree behavior and the current EVE branch's session-only behavior are different.

## Decisions worth discussing before implementation

- Exact main selection semantics versus remembered cursor after reload. Recommendation: match main first, make persistence an explicit later decision.
- Whole-chat sharing/copy versus a selected-path share. Main uses the whole tree; the EVE branch currently narrows it. Route refactoring must not silently broaden publication.
- Retain the thread package's presentation contracts through an EVE adapter versus extract a smaller execution-independent state interface. Recommendation: retain the behavioral contracts and reusable views; do not make the AI SDK run registry and EVE session store competing authorities.
- Materialized logical-node binding index versus lineage-derived bindings. Recommendation: prototype both on the same nested edit/retry/import fixtures; require deterministic identity and native transcript authority in either design.
- Limits for branch creation while approvals, hooks, tool jobs or resource writers are active. Navigation can remain available even when a particular mutation needs a settled checkpoint.

## Verification performed

Read main application flows, core library and regression tests; compared current EVE schema/controllers/lineage helpers and the installed native reducer/checkpoint implementation. `git diff origin/main -- packages/thread` shows identical source/tests, with only package dependency ranges changed. Ran `bun test ./packages/thread/test` in this checkout: **68 pass, 0 fail, 206 assertions**. These tests ran with this checkout's installed dependencies, not a separately installed main lockfile. They validate core semantics, not EVE browser parity. No new browser or provider tests were run for this research turn. Existing local implementation edits from the prior turn remain untouched.

## Main source index (commit-pinned)

[M1]: https://github.com/FranciscoMoretti/chat-js/blob/4584f093835f1667c010c8fc20c502fa3f2bde41/apps/chat/lib/app-chat-runtime.ts
[M2]: https://github.com/FranciscoMoretti/chat-js/blob/4584f093835f1667c010c8fc20c502fa3f2bde41/apps/chat/app/(chat)/chat-providers.tsx
[M3]: https://github.com/FranciscoMoretti/chat-js/blob/4584f093835f1667c010c8fc20c502fa3f2bde41/apps/chat/app/(chat)/chat-route-host.tsx
[M4]: https://github.com/FranciscoMoretti/chat-js/blob/4584f093835f1667c010c8fc20c502fa3f2bde41/apps/chat/lib/start-provisional-chat.ts
[M5]: https://github.com/FranciscoMoretti/chat-js/blob/4584f093835f1667c010c8fc20c502fa3f2bde41/apps/chat/lib/stores/base/use-chat.ts
[M6]: https://github.com/FranciscoMoretti/chat-js/blob/4584f093835f1667c010c8fc20c502fa3f2bde41/apps/chat/lib/db/schema.ts
[M7]: https://github.com/FranciscoMoretti/chat-js/blob/4584f093835f1667c010c8fc20c502fa3f2bde41/apps/chat/lib/stores/hooks-threads.ts
[M8]: https://github.com/FranciscoMoretti/chat-js/blob/4584f093835f1667c010c8fc20c502fa3f2bde41/apps/chat/components/multimodal-input.tsx
[M9]: https://github.com/FranciscoMoretti/chat-js/blob/4584f093835f1667c010c8fc20c502fa3f2bde41/apps/chat/components/retry-button.tsx
[M10]: https://github.com/FranciscoMoretti/chat-js/blob/4584f093835f1667c010c8fc20c502fa3f2bde41/apps/chat/app/(chat)/api/chat/get-thread-up-to-message-id.ts
[M11]: https://github.com/FranciscoMoretti/chat-js/blob/4584f093835f1667c010c8fc20c502fa3f2bde41/apps/chat/lib/stores/with-thread-state.ts
[M12]: https://github.com/FranciscoMoretti/chat-js/blob/4584f093835f1667c010c8fc20c502fa3f2bde41/apps/chat/lib/parallel-chat-requests.ts
[M13]: https://github.com/FranciscoMoretti/chat-js/blob/4584f093835f1667c010c8fc20c502fa3f2bde41/apps/chat/components/parallel-response-cards.tsx
[M14]: https://github.com/FranciscoMoretti/chat-js/blob/4584f093835f1667c010c8fc20c502fa3f2bde41/apps/chat/hooks/use-chat-system-initial-state.ts
[M15]: https://github.com/FranciscoMoretti/chat-js/blob/4584f093835f1667c010c8fc20c502fa3f2bde41/apps/chat/trpc/routers/chat.router.ts
[M16]: https://github.com/FranciscoMoretti/chat-js/blob/4584f093835f1667c010c8fc20c502fa3f2bde41/apps/chat/providers/chat-input-provider.tsx
[M17]: https://github.com/FranciscoMoretti/chat-js/blob/4584f093835f1667c010c8fc20c502fa3f2bde41/packages/thread/src/index.ts
