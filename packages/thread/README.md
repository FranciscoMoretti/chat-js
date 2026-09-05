# @chat-js/thread

Build branching AI SDK conversations without mounting one `useChat` hook per
branch.

`useThread` preserves the `useChat` interface for the selected path and adds a
`tree` namespace for navigation, sibling responses, concurrent runs, and
run-specific cancellation.

## Package Layers

`@chat-js/thread` is the headless core. It exports the framework-independent
`AbstractThread`, default memory-backed `Thread`, `ThreadState` contract, tree
management, and stream orchestration.

`@chat-js/thread/react` is the React adapter. It exports `useThread` and owns
React subscriptions, render throttling, and hook lifecycle behavior. The core
entry point does not import React.

`AbstractThread` exposes `getSnapshot()` and `subscribe()`, so future Vue,
Svelte, or vanilla adapters can observe the same controller without changing
the core.

## Install

For the headless core:

```bash
bun add @chat-js/thread ai@^7.0.93
```

For React:

```bash
bun add @chat-js/thread ai@^7.0.93 @ai-sdk/react@^4.0.96 react
```

## Use

```tsx
import { useThread } from "@chat-js/thread/react";
import { DefaultChatTransport } from "ai";

function Conversation() {
  const chat = useThread({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  return (
    <>
      {chat.messages.map((message) => (
        <div key={message.id}>{message.role}</div>
      ))}

      <button
        type="button"
        onClick={() => chat.sendMessage({ text: "Continue" })}
      >
        Send
      </button>
    </>
  );
}
```

Existing rendering and composer code can continue using:

```ts
chat.messages;
chat.status;
chat.error;
chat.sendMessage();
chat.regenerate();
chat.stop();
```

As in `useChat`, `sendMessage()` with no input continues a selected assistant
message in place. Passing an explicit assistant message also streams into that
same message ID. `regenerate({ messageId })` uses AI SDK's native regeneration
request and stores the replacement as a sibling, preserving the original
branch. Assistant-to-assistant targets regenerate the same way: the original
node stays, and the replacement is inserted beside it.

The selected path is a projection of the complete tree:

```ts
chat.tree.cursorId;
chat.tree.getChildren(messageId);
chat.tree.getSiblings(messageId);
chat.tree.setCursor(messageId);
```

Branch from an earlier node with the same `sendMessage` helper:

```ts
await chat.sendMessage(
  { text: "Create a branch" },
  { tree: { follow: false, from: messageId } },
);
```

Start independent responses without mounting another hook:

```ts
const first = await chat.tree.startRun({ from: messageId });
const second = await chat.tree.startRun({
  follow: false,
  from: messageId,
});

// Focus a run even before it has produced a response message.
chat.tree.setActiveRun(second.id);
await chat.stop();

await Promise.all([first.finished, second.finished]);
```

Selecting a pending run keeps `chat.messages` on its origin path until the
first response message arrives. The cursor then follows that response, while
the top-level `status`, `error`, and `stop()` helpers target the selected run.

Each run has independent status, error, stream state, and cancellation:

```ts
await chat.tree.stopRun(second.id);
await chat.tree.stopAll();
```

## External Ownership

By default, `useThread` creates and retains a `Thread` for the hook lifetime.
Create the controller yourself when it must outlive a particular component:

```ts
import { createThread } from "@chat-js/thread";
import { DefaultChatTransport } from "ai";

const transport = new DefaultChatTransport({ api: "/api/chat" });
const thread = createThread({ transport });

function Conversation() {
  const chat = useThread({ thread });
  // ...
}
```

`Thread` extends the framework-independent `AbstractThread` and owns its
in-memory state. To integrate another state container, create an
`AbstractThread` subclass that supplies a `ThreadState`:

```ts
import {
  AbstractThread,
  createThreadStateSnapshot,
  type ThreadState,
} from "@chat-js/thread";
import {
  type ChatTransport,
  DefaultChatTransport,
  type UIMessage,
} from "ai";
import { subscribeWithSelector } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

const transport = new DefaultChatTransport({ api: "/api/chat" });

const applicationStore = createStore(
  subscribeWithSelector(() => ({
    threadSnapshot: createThreadStateSnapshot<UIMessage>({ messages: [] }),
  })),
);

const applicationThreadState: ThreadState<UIMessage> = {
  getSnapshot: () => applicationStore.getState().threadSnapshot,
  subscribe: (listener) =>
    applicationStore.subscribe(
      (state) => state.threadSnapshot,
      () => listener(),
    ),
  update: (updater) => {
    applicationStore.setState((state) => ({
      threadSnapshot: updater(state.threadSnapshot),
    }));
  },
};

class ApplicationThread extends AbstractThread<UIMessage> {
  constructor(
    state: ThreadState<UIMessage>,
    transport: ChatTransport<UIMessage>,
  ) {
    super({ state, transport });
  }
}

const thread = new ApplicationThread(applicationThreadState, transport);
const chat = useThread({ thread });
```

`ThreadState.update` invokes its updater exactly once, synchronously and
atomically. The controller must remain the only writer so concurrent streams
cannot overwrite each other. `createThreadStateSnapshot` initializes the full
tree, index, selected-path, status, and run projection required by a custom
adapter; the application store then keeps that snapshot as its canonical
conversation state.

Framework adapters observe the controller through:

```ts
const snapshot = thread.getSnapshot();
const unsubscribe = thread.subscribe(() => {
  render(thread.getSnapshot());
});
```

These methods are framework-neutral. React's `useThread` consumes them through
`useSyncExternalStore`; other adapters can provide their own subscription
integration.

## Persistence

Persist the serializable message tree, not the live controller:

```ts
const snapshot = chat.tree.getSnapshot();

const restored = useThread({
  id: conversationId,
  initialTree: snapshot,
  resume: true,
  transport: new DefaultChatTransport({ api: "/api/chat" }),
});
```

The snapshot is `{ version: 1, cursorId, nodes }`. `nodes` is the ordered
message list with parent IDs; runtime indexes such as `messagesById` are not
serialized. Active requests, abort controllers, errors, and run adapters are
runtime state. `resume: true` (or `resumeStream()`) reconstructs a run for the
selected assistant. `tree.resumeRun(runId)` only works for runs still in the
live registry.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for lifecycle, identity, status, and
AI SDK compatibility decisions.
