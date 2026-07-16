# @chatjs/thread

Build branching AI chats without giving up the `useChat` API.

`@chatjs/thread` turns a linear AI SDK conversation into a message tree. Users
can edit an earlier message, compare multiple responses, move between branches,
and keep streams running on branches that are not currently visible.

```tsx
const chat = useThread({ transport });

chat.messages; // The selected conversation path, just like useChat
chat.tree.setCursor(messageId); // Select any point in the tree
await chat.sendMessage({ text: "Try another direction" }); // Branch from it
```

The package is headless. It owns message topology and request lifecycles, while
your application owns the conversation UI, branch controls, and persistence.

## Why useThread?

- **A familiar migration path.** `useThread` is assignable to AI SDK's
  `UseChatHelpers`. Existing chat rendering and composer code can keep using
  `messages`, `sendMessage`, `regenerate`, `stop`, `status`, and `error`.
- **Branch from any message.** Move a cursor to an earlier node and send as
  usual. Existing descendants are preserved as another branch.
- **Run branches concurrently.** Every response has an isolated AI SDK request
  lifecycle. Switching branches does not abort streams on hidden branches.
- **Keep AI SDK behavior.** `ThreadChat` uses the caller's `ChatTransport` and
  AI SDK's request orchestration, including tools, approvals, data parts,
  automatic follow-ups, cancellation, and reconnection.
- **Bring your own UI and storage.** The public tree is plain messages, IDs, and
  edges. No component library or database model is imposed.

## Installation

Install the package and its AI SDK peer dependencies:

```bash
bun add @chatjs/thread ai @ai-sdk/react
```

Or copy the source into an application with the ChatJS shadcn registry:

```bash
bunx shadcn@latest add FranciscoMoretti/chat-js/thread#main
```

The optional registry demo includes an application-owned conversation and tree
UI:

```bash
bunx shadcn@latest add FranciscoMoretti/chat-js/thread-demo#main
```

## Quick start

Use the same transport you would pass to `useChat`:

```tsx
"use client";

import { DefaultChatTransport } from "ai";
import { useThread } from "@chatjs/thread/react";
import { useState } from "react";

const transport = new DefaultChatTransport({ api: "/api/chat" });

export function Chat() {
  const [input, setInput] = useState("");
  const chat = useThread({ transport });

  return (
    <main>
      {chat.messages.map((message) => (
        <article key={message.id}>
          <strong>{message.role}</strong>
          {message.parts.map((part, index) =>
            part.type === "text" ? <p key={index}>{part.text}</p> : null
          )}
        </article>
      ))}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!input.trim()) return;
          chat.sendMessage({ text: input });
          setInput("");
        }}
      >
        <input
          onChange={(event) => setInput(event.target.value)}
          value={input}
        />
        <button disabled={chat.status !== "ready"} type="submit">
          Send
        </button>
      </form>
    </main>
  );
}
```

At the top level, the hook behaves like a normal linear chat. The difference is
that `messages` is a projection of the tree from its root to `tree.cursorId`.

## The mental model

`ThreadChat` stores every message once and records its parent:

```text
user: Plan a launch
└── assistant: Start with architecture
    └── user: Make it technical
        ├── assistant: Define service-level indicators  <- selected cursor
        └── assistant: Use staged environments
```

There are three distinct concepts:

1. **Tree:** all messages and parent-child relationships.
2. **Cursor:** the last message in the path currently shown by `chat.messages`.
3. **Run:** one assistant request, with its own status, error, and abort
   controller.

Moving the cursor only changes the visible path. It does not delete descendants
or stop active runs.

## Create a branch

Select the message to continue from, then call `sendMessage` normally:

```ts
chat.tree.setCursor(messageId);
await chat.sendMessage({ text: "Explore a different approach" });
```

The new user message becomes a child of `messageId`, followed by its assistant
response. Because `sendMessage` follows the selected cursor by default, the new
branch becomes the active conversation.

This is also the edit-message pattern. Editing is an application-level action:
select the edited message's parent and send the replacement as a new message.
The original message and its descendants remain available.

```ts
chat.tree.setCursorToParentOf(originalUserMessageId);
await chat.sendMessage({
  id: crypto.randomUUID(),
  role: "user",
  parts: [{ type: "text", text: editedText }],
});
```

To display sibling controls:

```ts
const siblings = chat.tree.getSiblings(messageId);
const index = siblings.findIndex((message) => message.id === messageId);

function showSibling(offset: number) {
  const sibling = siblings[index + offset];
  if (sibling) chat.tree.setCursor(sibling.id);
}
```

## Request parallel responses

`sendMessage` intentionally keeps the AI SDK completion contract: its promise
resolves when the request and automatic tool follow-ups finish. Use
`tree.startRun` when you need an immediate run handle or multiple responses.

First add a user message and start its primary response:

```ts
const primary = await chat.tree.startRun({
  message: { text: "Give me three implementation plans" },
  follow: true,
});
```

Then start more assistant responses from the same user node:

```ts
const alternativeA = await chat.tree.startRun({
  from: primary.getSnapshot()?.userMessageId,
  follow: false,
});

const alternativeB = await chat.tree.startRun({
  from: primary.getSnapshot()?.userMessageId,
  follow: false,
});

await Promise.all([
  primary.finished,
  alternativeA.finished,
  alternativeB.finished,
]);
```

`follow: false` leaves the cursor where it is while the response streams into
the tree. Each returned handle can be inspected or stopped independently:

```ts
primary.id;
primary.assistantMessageId;
primary.getSnapshot();
await primary.stop();
```

Set concurrency limits when creating the hook:

```ts
const chat = useThread({
  transport,
  concurrency: {
    maxActiveRuns: 4,
    maxActiveRunsPerMessage: 3,
  },
});
```

## Active path versus whole tree

The top-level API always describes the selected path and selected run:

```ts
chat.messages;
chat.status;
chat.error;
await chat.stop();
chat.clearError();
await chat.resumeStream();
```

Whole-tree state and controls live under `tree`:

```ts
chat.tree.cursorId;
chat.tree.status;
chat.tree.activeRuns;
chat.tree.runs;

chat.tree.messagesById;
chat.tree.parentById;
chat.tree.childrenByParentId;
chat.tree.rootIds;

chat.tree.getMessage(messageId);
chat.tree.getParent(messageId);
chat.tree.getChildren(messageId);
chat.tree.getSiblings(messageId);
chat.tree.getLeaves(messageId);
chat.tree.getPath(messageId);
```

`chat.status` uses AI SDK's `submitted`, `streaming`, `ready`, and `error`
states for the selected path. `chat.tree.status` aggregates every run. A run is
included in `activeRuns` while it is `submitted` or `streaming`.

Target a specific run without moving the cursor:

```ts
const run = chat.tree.getRun(runId);
const messageRun = chat.tree.getRunForMessage(assistantMessageId);

await chat.tree.stopRun(runId);
await chat.tree.stopRunForMessage(assistantMessageId);
await chat.tree.resumeRun(runId);
await chat.tree.stopAll();
```

## Migrating from useChat

For a conventional chat component, the initial migration is usually an import
change:

```diff
- import { useChat } from "@ai-sdk/react";
+ import { useThread } from "@chatjs/thread/react";

- const chat = useChat({ transport });
+ const chat = useThread({ transport });
```

`UseThreadHelpers<TMessage>` extends `UseChatHelpers<TMessage>`. These standard
helpers retain their normal signatures:

- `messages`, `sendMessage`, and `setMessages`
- `status`, `error`, `stop`, and `clearError`
- `regenerate` and `resumeStream`
- `addToolOutput`, `addToolResult`, and `addToolApprovalResponse`

There are two tree-specific behavioral details:

- Top-level state refers to the selected path, not every active branch.
- `setMessages` reconciles the selected path. Truncating it moves the cursor
  backward without deleting hidden descendants; changing its suffix creates a
  branch. A message ID cannot be reused under a different parent.

## Tools and approvals

Tool outputs and approval responses use the standard `useChat` signatures.
`ThreadChat` records which run emitted each tool call or approval ID and routes
the response back to that run, even when another branch is selected.

Tool call and approval IDs must be unique across active runs.

## Persistence

Save the complete tree rather than only `chat.messages`:

```ts
const snapshot = chat.tree.getSnapshot();
await saveThread(snapshot);
```

Restore it when creating the hook:

```ts
const chat = useThread({
  initialTree: savedSnapshot,
  transport,
});
```

Snapshots contain serializable message and topology state:

```ts
type MessageTreeSnapshot<TMessage> = {
  version: 1;
  cursorId: string | null;
  messagesById: Record<string, TMessage>;
  parentById: Record<string, string | null>;
  childrenByParentId: Record<string, string[]>;
  rootIds: string[];
};
```

Runs are request-lifecycle state and are not persisted in the tree snapshot.
Resumable assistant messages can be restored and resumed through
`resumeStream` or `tree.resumeRun`.

## Transport and server integration

`useThread` accepts AI SDK `ChatTransport` implementations directly. It does
not define another transport protocol or parse stream chunks itself.

Every request includes branch context in its body while preserving your custom
request body fields:

```ts
{
  assistantMessageId,
  tree: {
    assistantMessageId,
    cursorId,
    originCursorId,
    parentMessageId,
    pathIds,
    userMessageId
  }
}
```

Servers that only need a linear model history can ignore this metadata; the
transport still receives the selected path. Persist the IDs when the server
also needs to reconstruct branches or associate streams with message nodes.

For resumable HTTP streams, reconnect by assistant message ID using AI SDK's
native transport hook. Your server can resolve that stable message identity to
an infrastructure-specific stream ID:

```ts
const transport = new DefaultChatTransport({
  api: "/api/chat",
  prepareReconnectToStreamRequest({ body, id }) {
    const messageId = body?.assistantMessageId;
    return {
      api: `/api/chat/${id}/stream?messageId=${messageId}`,
    };
  },
});
```

## Externally owned ThreadChat

Create `ThreadChat` outside React when it must outlive a component or be shared
with application infrastructure:

```tsx
import { createThreadChat } from "@chatjs/thread";
import { useThread } from "@chatjs/thread/react";

const threadChat = createThreadChat({ transport });

function Chat() {
  const chat = useThread({ chat: threadChat });
  // ...
}
```

This is the instance-level equivalent of supplying an externally owned chat to
`useChat`.

## How it works

`ThreadChat` uses a canonical tree plus one isolated AI SDK chat engine per
active request:

```text
useThread
  └── ThreadChat
      ├── message tree (nodes, edges, cursor)
      ├── run registry
      │   ├── run A -> AI SDK AbstractChat -> ChatTransport
      │   ├── run B -> AI SDK AbstractChat -> ChatTransport
      │   └── run C -> AI SDK AbstractChat -> ChatTransport
      └── React subscription snapshot
```

`ThreadChat` owns tree topology, cursor selection, run identity, and
concurrency policy. Each run owns one AI SDK request lifecycle and abort
controller. All runs use the caller-provided transport.

This design matters because one linear `useChat` instance has one active
message array and request lifecycle. Replacing that array during branch
navigation can abort, reconnect, or misroute an in-flight response. Isolated
runs continue writing to their reserved assistant nodes regardless of which
path is visible.

The implementation deliberately reuses AI SDK's `AbstractChat` orchestration
instead of maintaining a custom stream reducer. That preserves standard stream
parts, tools, approvals, callbacks, automatic sends, cancellation, and resume
behavior while the package adds tree ownership around it.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the ownership model, evaluated
alternatives, and the differential coverage behind this decision.

## Exports

React APIs are exported from `@chatjs/thread/react`:

```ts
useThread;
type UseThreadOptions;
type UseThreadHelpers;
type TreeHelpers;
```

Chat engine APIs and types are exported from `@chatjs/thread`:

```ts
createThreadChat;
ThreadChat;
getMessageText;
ROOT_PARENT_ID;

type MessageTreeSnapshot;
type ThreadConcurrency;
type ThreadEvent;
type ThreadRun;
type ThreadRunHandle;
type ThreadChatOptions;
type ThreadStartRunOptions;
type TreeSendOptions;
type ThreadStateSnapshot;
```

## Scope

The package does not include chat components, branch controls, tree diagrams,
storage adapters, or server routes. Those remain application concerns because
their design and persistence requirements vary substantially. The package
provides the headless state and controls needed to build them.

## License

Apache-2.0
