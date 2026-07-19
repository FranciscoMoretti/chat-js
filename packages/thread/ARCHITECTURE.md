# useThread Architecture

## Purpose

`useThread` is the React chat primitive exported by `@chatjs/thread/react`. It
keeps the standard AI SDK `useChat` interface for the selected conversation
path and adds a `tree` namespace for branching, navigation, and concurrent
responses.

One `useThread` call represents one threaded conversation. Branches and
parallel responses do not require additional hooks or mounted components.

```text
useThread
  -> ThreadChat
     -> message tree
     -> RunRecord A -> ThreadRunChat A -> ChatTransport
     -> RunRecord B -> ThreadRunChat B -> ChatTransport
```

The three layers have separate responsibilities:

- `useThread` is the public React interface.
- `ThreadChat` is the observable, tree-backed chat engine.
- `ThreadRunChat` is an internal AI SDK request engine for one response.

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
whether the cursor moves with the new user and assistant nodes; it defaults to
`true` when the resolved origin equals the active cursor and `false` otherwise.
This includes an explicit `from` whose value equals the current `cursorId`.

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

By default, `useThread` creates one `ThreadChat` and keeps it in a React ref:

```ts
const chatRef = useRef<ThreadChat | null>(null);
if (chatRef.current === null) {
	chatRef.current = new ThreadChat(options);
}
```

The same `ThreadChat` is used for the lifetime of that hook instance. Updated
callbacks and transports are applied to it without replacing its tree or
active runs.

An existing `ThreadChat` can also be supplied:

```ts
const threadChat = createThreadChat({ transport });

function useConversation() {
  return useThread({ chat: threadChat });
}
```

In this mode, `useThread` subscribes to the supplied engine instead of creating
one. This changes engine ownership, not the returned hook interface.

In both modes there is one mounted `useThread`. `ThreadRunChat` instances are
ordinary class instances created imperatively by `ThreadChat`; they are not
React hooks or components.

## ThreadChat State

`ThreadChat` is the canonical state owner. It stores:

- each message once, keyed by message ID
- one parent ID per message
- ordered child IDs per parent
- root message IDs
- the selected cursor
- run records and per-run status
- tool-call and approval ownership
- concurrency limits
- the immutable snapshot consumed by React

The selected linear history is derived from the tree:

```ts
messages = threadChat.getPath(cursorId);
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

`ThreadChat.id` identifies the complete threaded conversation. It has the same
role as AI SDK's `Chat.id`, remains stable as messages are added, and is sent to
the transport as `chatId` on every request.

Within that conversation, each `message.id` identifies one immutable tree node.
An assistant message ID also identifies the run that produces that node. A
branch does not have another stored ID: a message ID identifies its current
head, and following parent links identifies the complete root-to-head path.

`cursorId` is the mutable selection of one such head. A followed send attaches
the new user and assistant nodes beneath the selected head and advances the
cursor to those nodes. Starting from an earlier node creates siblings without
changing existing identities or ancestry.

Tree snapshots persist topology and cursor selection, but not `ThreadChat.id`.
Callers that restore a conversation associate the snapshot with its stable
conversation ID and supply that ID to the new `ThreadChat` instance.

## React Subscription

`useThread` subscribes to `ThreadChat` with `useSyncExternalStore`. A tree
mutation, cursor change, stream update, or run status change publishes a new
snapshot.

Subscription throttling is applied at the React boundary. It can reduce render
frequency without delaying writes to the canonical tree. Hidden branches keep
receiving stream updates even when their snapshots are not currently rendered.

## Run Model

Every assistant response has one `RunRecord`:

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

The assistant message ID is also the run ID. Requests, stream updates, stop
operations, reconnection, and the resulting assistant node therefore share one
stable identity.

`ThreadChat` creates a `ThreadRunChat` when `sendMessage`, `startRun`, or a
reconnection needs an AI SDK request lifecycle. Completed run records are
currently retained so their status and ownership information remain
addressable.

Starting multiple runs from the same user message creates assistant siblings.
Starting runs from separate leaves updates those branches concurrently. Each
run has independent status, error, request serialization, and cancellation.

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

The internal `ThreadChatState` presents one linear branch path to
`AbstractChat`. It writes accumulated assistant snapshots back to the reserved
assistant node in `ThreadChat`.

The supplied AI SDK `ChatTransport` remains the request and stream boundary.
The package does not define another transport protocol or manually parse
`UIMessageChunk` values. A delegating transport ensures new and reconnected
runs use the latest transport configured on `ThreadChat`.

Each request receives the selected linear path. Optional tree context is added
to `ChatRequestOptions.body`:

```ts
{
  assistantMessageId,
  tree: {
    assistantMessageId,
    cursorId,
    originCursorId,
    parentMessageId,
    pathIds,
    userMessageId,
  },
}
```

The transport can ignore this context when its server only needs linear
messages.

## Send Lifecycle

A normal `sendMessage` follows this sequence:

1. Resolve the origin from the active cursor or an explicit `tree.from` value.
2. Check concurrency limits and reject without mutating the tree when exceeded.
3. Create or update the user message under that origin.
4. Reserve an assistant message ID and add an assistant shell to the tree.
5. Create a `RunRecord` and its internal `ThreadRunChat`.
6. Send the selected path through the configured `ChatTransport`.
7. Commit each accumulated assistant snapshot to the reserved tree node.
8. Publish status, error, and finish events for that run.
9. Move the cursor with the run when `follow` is enabled.

`sendMessage` waits for the request and automatic follow-ups to finish, matching
the AI SDK contract. `tree.startRun` returns a handle immediately for callers
that need to start, inspect, or stop multiple responses independently.

## Status and Cancellation

Runs use the AI SDK `ChatStatus` values:

- `submitted`
- `streaming`
- `ready`
- `error`

`chat.status` is the selected path's `useChat`-compatible projection. Together
with `chat.messages` and `chat.error`, it always describes the active path and
never aggregates hidden branches.

`chat.tree.status` aggregates all runs with active work taking precedence:

1. `streaming` when any run is streaming
2. `submitted` when no run is streaming and any run is submitted
3. `error` when no run is active and any run has failed
4. `ready` otherwise

A run is included in `tree.activeRuns` while it is `submitted` or `streaming`.
Consumers that need to distinguish simultaneous states inspect `tree.runs`;
the aggregate is intentionally only a whole-tree activity projection.

Cancellation is scoped by run:

- `chat.stop()` stops the selected run.
- `chat.tree.stopRun(runId)` stops one explicit run.
- `chat.tree.stopAll()` stops every active run.

Stopping one response does not abort another response or change the selected
cursor.

## Tool Ownership

Tool output and approval APIs retain their standard `useChat` signatures.
`ThreadChat` indexes each tool call and approval ID to the run that emitted it,
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
restored message, `ThreadChat` lazily creates the owning branch's internal run
adapter before applying the mutation. Reconnection uses the same lazy adapter
creation. This preserves `useChat` tool behavior without eagerly retaining an
adapter for every historical assistant message.

## Concurrency

`ThreadChat` enforces optional limits before mutating the tree:

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
not leave optimistic user or assistant nodes behind.

## Package Boundary

`@chatjs/thread` owns:

- the `useThread` React contract
- tree topology and cursor projection
- run creation, registration, and cancellation
- stable assistant/run identity
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
bun --filter @chatjs/thread test
```
