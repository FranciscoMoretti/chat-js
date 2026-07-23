# @chatjs/thread

Build branching AI SDK conversations without mounting one `useChat` hook per
branch.

`useThread` preserves the `useChat` interface for the selected path and adds a
`tree` namespace for navigation, sibling responses, concurrent runs, and
run-specific cancellation.

## Install

```bash
bun add @chatjs/thread ai @ai-sdk/react
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

await Promise.all([first.finished, second.finished]);
```

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

`Thread` extends the framework-independent `AbstractThread`. It accepts an
optional `ThreadState` implementation for integration with an application
state container:

```ts
import { MemoryThreadState, Thread } from "@chatjs/thread";

const state = new MemoryThreadState({ messages: initialMessages });
const thread = new Thread({ state, transport });
```

`ThreadState.update` invokes its updater exactly once, synchronously and
atomically. The controller must remain the only writer so concurrent streams
cannot overwrite each other.

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
