# @chatjs/thread

Build branching AI SDK conversations without mounting one `useChat` hook per
branch.

`useThread` preserves the `useChat` interface for the selected path and adds a
`tree` namespace for navigation, sibling responses, concurrent runs, and
run-specific cancellation.

## Package Layers

`@chatjs/thread` is the headless core. It exports the framework-independent
`AbstractThread`, default memory-backed `Thread`, `ThreadState` contract, tree
management, and stream orchestration.

`@chatjs/thread/react` is the React adapter. It exports `useThread` and owns
React subscriptions, render throttling, and hook lifecycle behavior. The core
entry point does not import React.

`AbstractThread` exposes `getSnapshot()` and `subscribe()`, so future Vue,
Svelte, or vanilla adapters can observe the same controller without changing
the core.

## Install

For the headless core:

```bash
bun add @chatjs/thread ai
```

For React:

```bash
bun add @chatjs/thread ai @ai-sdk/react react
```

## Use

```tsx
import { useThread } from "@chatjs/thread/react";
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
branch.

Regeneration is currently rejected when both the target and its parent are
assistant messages. AI SDK currently continues the assistant parent in that
case instead of creating a replacement for the requested target; see
`ARCHITECTURE.md` for the upstream blocker.

The selected path is a projection of the complete tree:

```ts
chat.tree.cursorId;
chat.tree.getChildren(messageId);
chat.tree.getSiblings(messageId);
chat.tree.setCursor(messageId);
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
import { createThread } from "@chatjs/thread";

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
} from "@chatjs/thread";
import type { UIMessage } from "ai";
import { subscribeWithSelector } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

const applicationStore = createStore(
  subscribeWithSelector(() => ({
    threadSnapshot: createThreadStateSnapshot<UIMessage>({ messages }),
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
  constructor(state: ThreadState<UIMessage>) {
    super({ state, transport });
  }
}

const thread = new ApplicationThread(applicationThreadState);
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
  transport,
});
```

The snapshot contains ordered nodes, parent IDs, and the selected cursor.
Active requests, abort controllers, errors, and run adapters are runtime state
and are not serialized.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for lifecycle, identity, status, and
AI SDK compatibility decisions.
