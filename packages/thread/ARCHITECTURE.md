# useThread Architecture

## Purpose

`@chat-js/thread` is the headless, framework-independent threaded conversation
engine. `@chat-js/thread/react` adapts that engine to React through `useThread`.
The hook keeps the standard AI SDK `useChat` interface for the selected
conversation path and adds a `tree` namespace for branching, navigation, and
concurrent responses.

One `useThread` call represents one threaded conversation. Branches and
parallel responses do not require additional hooks or mounted components.

```text
React adapter
  -> useThread
     -> supplied AbstractThread or default Thread

Headless core
  -> AbstractThread
     -> ThreadState
        -> message tree
        -> observable snapshots
     -> RunRecord A -> ThreadRunChat A -> ChatTransport
     -> RunRecord B -> ThreadRunChat B -> ChatTransport
```

The layers have separate responsibilities:

- `useThread` is the public React adapter.
- `Thread` is the default memory-backed `AbstractThread`.
- `AbstractThread` owns framework-independent thread and request orchestration.
- `ThreadState` owns the canonical observable tree state.
- `ThreadRunChat` is an internal AI SDK request engine for one response.

The core entry point does not import React. `AbstractThread.getSnapshot()` and
`AbstractThread.subscribe()` form the framework-neutral observable boundary.
React consumes it with `useSyncExternalStore`; future Vue, Svelte, or vanilla
adapters can consume the same boundary with their own lifecycle primitives.

## Compatibility Decision Rule

`useThread` is a strict behavioral superset of `useChat` on the selected path.
Before defining a lifecycle, status, tool, persistence, or callback behavior,
the implementation and tests for the supported `@ai-sdk/react` and `ai`
versions must be checked first.

- When `useChat` has an observable linear equivalent, `useThread` preserves
  that behavior and adds only the routing needed to apply it to the selected or
  owning branch.
- The package defines new semantics only when the behavior exists because of
  tree topology or multiple concurrent runs, such as cursor movement, sibling
  ordering, aggregate status, and run-specific cancellation.
- Compatibility concerns observable behavior, not incidental implementation
  mechanics. Internal construction, indexing, and subscription strategies may
  differ when the public lifecycle remains equivalent.

## React Surface

The normal usage is the same shape as `useChat`:

```ts
const chat = useThread({ transport });

chat.messages;
chat.status;
chat.error;
await chat.sendMessage({ text: "Continue" });
await chat.stop();
```

`UseThreadHelpers<TMessage>` extends `UseChatHelpers<TMessage>`. Existing chat
rendering and composer code can continue to use the top-level helpers. The
additional tree state and controls live under `chat.tree`:

```ts
chat.tree.cursorId;
chat.tree.getChildren(messageId);
chat.tree.getSiblings(messageId);
chat.tree.setCursor(messageId);
chat.tree.setActiveRun(runId);
chat.tree.startRun({ from: messageId });
chat.tree.stopRun(runId);
```

Branch origin and cursor following are per-operation options:

```ts
await chat.sendMessage(
	{ text: "Create a branch" },
	{ tree: { follow: false, from: messageId } },
);

await chat.tree.startRun({ follow: false, from: userMessageId });
```

`from` selects the node that receives the new user message. `follow` controls
whether the cursor selects the new user immediately and its assistant once
streaming begins; it defaults to `true` when the resolved origin equals the
active cursor and `false` otherwise. This includes an explicit `from` whose
value equals the current `cursorId`.

`setActiveRun(runId)` selects a request lifecycle directly. Before that run
has emitted a message, the active path remains at its origin. Once its first
message is written, the cursor follows it. This lets `chat.status`,
`chat.error`, and `chat.stop()` retain their `useChat` semantics for pending
concurrent runs without requiring optimistic message nodes.

Top-level fields always describe the selected path:

- `messages` is the root-to-cursor path.
- `status` and `error` belong to the selected run.
- `stop`, `regenerate`, and `resumeStream` target the selected run.
- `sendMessage` adds a user message at the cursor and follows its response.

Whole-conversation state is exposed through `tree`:

- `messagesById`, `parentById`, `childrenByParentId`, and `rootIds`
- `cursorId` and path navigation
- `runs`, `activeRuns`, and aggregate `status`
- run-specific start, stop, and resume controls

## Hook Ownership

By default, `useThread` creates one `Thread` and keeps it in a React ref:

```ts
const threadRef = useRef<AbstractThread | null>(null);
if (threadRef.current === null) {
	threadRef.current = new Thread(options);
}
```

The same `Thread` is retained while its identity inputs remain unchanged.
Supplying a different external `thread` or a different defined `id` replaces
the controller, including its state and active runs. Otherwise, callback
wrappers read the latest React callbacks without replacing the retained
controller.

An existing `AbstractThread` can also be supplied. This includes both the
default `Thread` and custom subclasses:

```ts
const thread = createThread({ transport });

function useConversation() {
  return useThread({ thread });
}
```

In this mode, `useThread` subscribes to the supplied engine instead of creating
one. This changes engine ownership, not the returned hook interface.

In both modes there is one mounted `useThread`. `ThreadRunChat` instances are
ordinary class instances created imperatively by `AbstractThread`; they are
not React hooks or components.

## Thread State

`AbstractThread` receives a `ThreadState`, following the same separation as AI
SDK's `AbstractChat` and `ChatState`. `ThreadState` has a deliberately small
interface:

```ts
interface ThreadState<TMessage extends UIMessage> {
  getSnapshot(): ThreadStateSnapshot<TMessage>;
  update(
    updater: (
      snapshot: ThreadStateSnapshot<TMessage>
    ) => ThreadStateSnapshot<TMessage>,
  ): void;
  subscribe(listener: () => void): () => void;
}
```

`update` must invoke its updater exactly once and synchronously, commit the
returned snapshot before returning, and propagate updater or commit errors.
`AbstractThread` uses it as the atomic write boundary so interleaved streams
cannot read an old tree and overwrite a newer branch update. The controller is
the sole writer; external code navigates and mutates through `Thread` commands
rather than editing a snapshot directly.

A `ThreadState` instance belongs to one `AbstractThread` for its lifetime.
Applications retain and reuse that controller across framework remounts, just
as `useChat({ chat })` retains its supplied `Chat`. Reattaching the same state to
another controller is rejected because request handles, run ownership, and
abort controllers are intentionally controller-local.

The default `Thread` creates its own `MemoryThreadState`. A custom controller
can instead extend `AbstractThread` and supply another implementation:

```ts
const applicationStore = createStore(
  subscribeWithSelector(() => ({
    threadSnapshot: createThreadStateSnapshot<MyMessage>({ messages: [] }),
  })),
);

const state: ThreadState<MyMessage> = {
  getSnapshot: () => applicationStore.getState().threadSnapshot,
  subscribe: (listener) =>
    applicationStore.subscribe(
      (storeState) => storeState.threadSnapshot,
      () => listener(),
    ),
  update: (updater) => {
    applicationStore.setState((storeState) => ({
      threadSnapshot: updater(storeState.threadSnapshot),
    }));
  },
};

class ApplicationThread extends AbstractThread<MyMessage> {
  constructor(
    state: ThreadState<MyMessage>,
    transport: ChatTransport<MyMessage>,
  ) {
    super({ state, transport });
  }
}

const thread = new ApplicationThread(state, transport);
const chat = useThread({ thread });
```

This allows an application store to own observable state without moving
transport objects, promises, abort controllers, or internal run adapters into
that store. `createThreadStateSnapshot` is the supported initializer for a
custom adapter. The returned `ThreadStateSnapshot` should be the application's
canonical conversation value; linear `messages`, `status`, and `error` fields,
when retained for compatibility, are projections updated in the same atomic
store transaction rather than separate sources of truth.

`ThreadState` stores:

- each message once, keyed by message ID
- one parent ID per message
- ordered child IDs per parent
- root message IDs
- the selected cursor
- public run status and errors
- the selected path and aggregate projections
- the immutable snapshot consumed by React

`AbstractThread` stores operational state that cannot be serialized:

- `RunRecord` request handles
- tool-call and approval ownership
- concurrency limits
- active `ThreadRunChat` instances
- promises and abortable request lifecycles

The selected linear history is derived from the tree:

```ts
messages = threadState.getSnapshot().messages;
```

Changing the cursor selects another root-to-node path. It does not delete
descendants, reorder siblings, or stop responses on hidden branches.

Tree mutations enforce these invariants:

- message IDs are unique within the tree
- a non-root message has an existing parent
- an existing message cannot move to another parent
- parent links cannot form cycles
- replacing or restoring the tree cannot occur while runs are active

## Identity and Continuity

`Thread.id` identifies the complete threaded conversation. It has the same
role as AI SDK's `Chat.id`, remains stable as messages are added, and is sent to
the transport as `chatId` on every request.

Within that conversation, each `message.id` identifies one immutable tree node.
Each run has a separate stable ID identifying its request lifecycle. A run is
present while submitted even though no assistant message exists yet, then binds
to the assistant ID produced by AI SDK's stream reducer. A message ID identifies
a branch head, and following parent links identifies the complete root-to-head
path.

`cursorId` is the mutable selection of one such head. A followed send attaches
the new user beneath the selected head, then attaches and selects the assistant
when AI SDK first publishes it. Starting from an earlier node creates siblings
without changing existing identities or ancestry.

Tree snapshots persist topology and cursor selection, but not `Thread.id`.
Callers that restore a conversation associate the snapshot with its stable
conversation ID and supply that ID to the new `Thread` instance.

## React Subscription

`useThread` subscribes to an `AbstractThread` with `useSyncExternalStore`. A
tree mutation, cursor change, stream update, or run status change publishes a
new snapshot through the controller's framework-neutral `subscribe()` method.

Subscription throttling is applied at the React boundary. It can reduce render
frequency without delaying writes to the canonical tree. Hidden branches keep
receiving stream updates even when their snapshots are not currently rendered.

## Run Model

Every assistant response lifecycle has one `RunRecord`:

```ts
type RunRecord<TMessage extends UIMessage> = {
  aborted: boolean;
  chat: ThreadRunChat<TMessage>;
  error: Error | undefined;
  finished: Promise<void>;
  spec: ThreadRunSpec;
  status: ChatStatus;
};
```

Run IDs and response message IDs are deliberately separate. Multiple runs can
be submitted before any response message exists, so each run needs a stable
identity immediately for status, cancellation, and ownership. Its response
message ID remains unknown until AI SDK first publishes the response and may
then come from the server. Message-based helpers resolve the run associated with
that node after this binding occurs.

`AbstractThread` creates a `ThreadRunChat` when `sendMessage`, `startRun`, or a
reconnection needs an AI SDK request lifecycle. Completed run records are
currently retained so their status and ownership information remain
addressable.

Starting multiple runs from the same user message creates assistant siblings.
Starting runs from separate leaves updates those branches concurrently. Each
run has independent status, error, request serialization, and cancellation.
Automatic tool continuations remain in the same run and update the same
assistant response node.

A new independent response requires a non-assistant response parent. AI SDK
interprets an assistant message at the end of a request as the response to
continue, not as the parent of another response. Therefore, a bare `startRun`
from an assistant message is rejected.

The `useChat`-compatible `sendMessage` surface keeps AI SDK's continuation
semantics. Calling `sendMessage()` on a selected assistant continues that node,
and passing an explicit assistant message attaches and streams into that same
message ID. Neither operation creates a child response under the assistant.
Applications create a branch below an assistant by attaching a new input
message and generating from that input.

This is a `Thread` live-run invariant, not a `MessageTree` invariant. The
tree remains role-agnostic so persisted, restored, or server-created data may
contain assistant-to-assistant edges.

Reconnection does not create response topology. It reactivates the existing
assistant node, so its parent may have any role or be `null`. Resume checks
concurrency capacity but does not apply the new-response parent-role rule,
matching AI SDK's `resumeStream` behavior over the current message history.

## AI SDK Integration

`ThreadRunChat` extends AI SDK's `AbstractChat` for one run. It reuses AI SDK
behavior for:

- request status and cancellation
- UI message stream reduction
- serialized request updates
- metadata and data schemas
- `onData`, `onToolCall`, `onFinish`, and `onError`
- tool output and approval mutation
- `sendAutomaticallyWhen`
- regeneration and reconnection

The internal `ThreadRunState` presents one run-local linear branch path to
`AbstractChat`. AI SDK may truncate that local path for regeneration without
deleting nodes from the canonical tree. The state writes accumulated assistant
snapshots into `Thread` when AI SDK publishes the streaming response.

`ThreadRunChat` does not insert a synthetic response into that path. AI SDK
creates the provisional assistant response using its normal last-message rules
and a generated response ID reserved by the run. The first unbound request
clears its transport `messageId`, matching `useChat.sendMessage(input)`; after
the response is bound, automatic follow-up requests carry that assistant ID and
continue the same node.

The supplied AI SDK `ChatTransport` remains the request and stream boundary.
The package does not define another transport protocol or manually parse
`UIMessageChunk` values. A delegating transport ensures new and reconnected
runs use the latest transport configured on `Thread`.

Each request receives the selected linear path. `ChatRequestOptions` are passed
to the configured transport unchanged; tree controls never leak into the
application request body.

As in AI SDK's `AbstractChat`, a submitted response remains private streaming
state until the first stream write. A server-provided `messageId` in the AI SDK
`start` chunk replaces the provisional ID before publication, so the tree only
ever observes the canonical assistant node. Runs reserve an internal sibling
position so concurrent streams remain ordered by creation rather than arrival.

## Send Lifecycle

A normal `sendMessage` follows this sequence:

1. Resolve the origin from the active cursor or an explicit `tree.from` value.
2. Validate that the response parent is not an assistant and check concurrency
   limits, rejecting without mutating the tree when either condition fails.
3. Create or update the user message under that origin.
4. Create a stable run ID and reserve its sibling position without adding a
   placeholder message.
5. Create a `RunRecord` and its internal `ThreadRunChat`.
6. Send the selected path through the configured `ChatTransport`.
7. Let AI SDK apply a server response ID from the start chunk when provided.
8. Insert the assistant node on AI SDK's first write and update it thereafter.
9. Publish status, error, and finish events for that run.
10. Move the cursor with the run when `follow` is enabled.

`sendMessage` waits for the request and automatic follow-ups to finish, matching
the AI SDK contract. `tree.startRun` returns a handle immediately for callers
that need to start, inspect, or stop multiple responses independently.
The handle's `finished` property always reads the run's current request promise,
including a later request started by `resumeRun`.

As in AI SDK, expected transport and stream failures resolve after publishing
`error` status. Unexpected application or state-layer exceptions that escape
`AbstractChat` reject `sendMessage`, `resumeRun`, and the corresponding
`finished` promise.

## Regeneration

`regenerate({ messageId })` invokes `AbstractChat.regenerate` inside an isolated
run adapter. The transport therefore receives AI SDK's native
`regenerate-message` trigger and target `messageId`.

AI SDK truncates only the adapter's linear request path. The canonical tree
retains the target response, then inserts the streamed replacement beside it
using the run's reserved sibling order. A root assistant regenerates into
another root. The cursor follows the replacement on its first write only when
it still points to the regeneration target, so navigation during submission or
streaming is not overwritten.

AI SDK 6.0.244 and later initialize fresh response state for regeneration.
This allows a response whose parent is also an assistant to regenerate without
mutating that shared parent. For `[user, assistant A, assistant B]`, regenerating
`assistant B` preserves both existing messages and creates a replacement sibling
under `assistant A`.

## Reconnection with AI SDK 7

SDK 7 initializes fresh response state for resume as well as regeneration.
A reconnect beginning with `start` replays the complete response and replaces its
canonical content. For continuations without `start`, the run adapter supplies
its canonical assistant ID/metadata and seeds its saved parts into the SDK's
response object once. Subsequent tool and approval updates share those restored
parts. The path is refreshed before reconnecting, and a missing stream preserves
an existing run error until explicitly cleared.

## Status and Cancellation

Runs use the AI SDK `ChatStatus` values:

- `submitted`
- `streaming`
- `ready`
- `error`

`chat.status` is the selected path's `useChat`-compatible projection. Together
with `chat.messages` and `chat.error`, it always describes the active path and
never aggregates hidden branches.

`chat.tree.status` aggregates current activity across all runs:

1. `streaming` when any run is streaming
2. `submitted` when no run is streaming and any run is submitted
3. `ready` otherwise

A run is included in `tree.activeRuns` while it is `submitted` or `streaming`.
Historical failures remain available on their entries in `tree.runs`, but do not
affect the aggregate after activity finishes. Consumers that need to distinguish
simultaneous or historical states inspect `tree.runs`; the aggregate is
intentionally only a whole-tree activity projection and has no aggregate error
object.

Cancellation is scoped by run:

- `chat.stop()` stops the selected run.
- `chat.tree.stopRun(runId)` stops one explicit run.
- `chat.tree.stopAll()` stops every active run.

Stopping one response does not abort another response or change the selected
cursor.

## Tool Ownership

Tool output and approval APIs retain their standard `useChat` signatures.
`Thread` indexes each tool call and approval ID to the run that emitted it,
then routes subsequent mutations back to that run's `ThreadRunChat`.

Tool-call and approval IDs must be unique across all retained, addressable
runs. This prevents a delayed result or a result submitted while viewing one
branch from being applied to another.

## Persistence Boundary

`chat.tree.getSnapshot()` returns the serializable tree state:

```ts
type MessageTreeNode<TMessage> = {
  message: TMessage;
  parentId: string | null;
};

type MessageTreeSnapshot<TMessage> = {
  version: 1;
  cursorId: string | null;
  nodes: MessageTreeNode<TMessage>[];
};
```

`nodes` is the canonical ordered representation. Each message ID appears once,
parents appear before their children, and `parentId: null` identifies a root.
For nodes with the same parent, relative array order defines sibling order;
relative root-node order defines root order. `cursorId` is either `null` or the
ID of one listed message.

`messagesById`, `parentById`, `childrenByParentId`, and `rootIds` are derived
runtime indexes exposed through `chat.tree`; they are not independently
serialized sources of truth. Restoration validates the node invariants while
building those indexes.

The snapshot can be supplied later as `initialTree`. Active request objects,
abort controllers, and `ThreadRunChat` instances are not serialized.
Restoration rebuilds tool-call and approval ownership from the serialized
assistant messages. When a standard tool-output or approval helper targets a
restored message, `Thread` lazily creates the owning branch's internal run
adapter before applying the mutation. Reconnection uses the same lazy adapter
creation. This preserves `useChat` tool behavior without eagerly retaining an
adapter for every historical assistant message.

## Concurrency

`Thread` enforces optional limits before mutating the tree:

```ts
useThread({
  concurrency: {
    maxActiveRuns: 8,
    maxActiveRunsPerMessage: 4,
  },
  transport,
});
```

`maxActiveRuns` limits the complete conversation. `maxActiveRunsPerMessage`
limits assistant siblings generated from one user message. A rejected run does
not leave an extra user message behind.

## Package Boundary

`@chat-js/thread` owns:

- the `useThread` React contract
- tree topology and cursor projection
- run creation, registration, and cancellation
- stable run identity and server-owned assistant identity
- routing tool and approval mutations to their owning runs
- adaptation between the tree and AI SDK's linear `AbstractChat`

AI SDK owns the behavior of each request lifecycle and message stream. The
caller supplies the transport and decides how snapshots are stored or rendered.
The package does not include conversation components, branch controls, storage
adapters, or server routes.

## Required Guarantees

The package integration suite must verify that:

- rich text, reasoning, tool, and data output matches `@ai-sdk/react`'s `Chat`
  for the same stream
- concurrent streams update separate leaves
- hidden branches continue receiving interleaved updates
- cursor changes do not reorder or duplicate messages
- stopping one run does not abort another
- tool output and approvals route to their owning run
- restored pending tools accept output before stream reconnection
- finish callbacks receive the committed assistant path
- transport replacement applies to resumed runs

Run the package coverage with:

```bash
bun --filter @chat-js/thread test
```
