import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import type { MessageTreeSnapshot } from "@chat-js/thread";
import type { UseThreadHelpers } from "@chat-js/thread/react";
import { getMessageText } from "@chat-js/thread";

interface PlaygroundMetadata {
  readonly activeStreamId: string | null;
  readonly createdAt: string;
  readonly title?: string;
}

type PlaygroundMessage = UIMessage<PlaygroundMetadata>;

type PlaygroundChat = UseThreadHelpers<PlaygroundMessage>;

type PlaygroundTransportMessage = Parameters<typeof getMessageText>[0] &
  Readonly<Pick<PlaygroundMessage, "metadata">>;

type PlaygroundTransportInput = Readonly<{
  abortSignal: Readonly<AbortSignal> | undefined;
  body?: Readonly<StreamBody>;
  messages: readonly PlaygroundTransportMessage[];
}>;

interface StreamBody {
  responseLabel?: string;
}

interface LayoutNode {
  readonly depth: number;
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

type TreeLayout = Readonly<{
  height: number;
  nodes: readonly LayoutNode[];
  positions: ReadonlyMap<string, LayoutNode>;
  width: number;
}>;

const createMessage = ({
  id,
  role,
  text,
  title,
}: {
  readonly id: string;
  readonly role: "assistant" | "user";
  readonly text: string;
  readonly title: string;
}): PlaygroundMessage => ({
  id,
  metadata: {
    activeStreamId: null,
    createdAt: new Date().toISOString(),
    title,
  },
  parts: [{ text, type: "text" }],
  role,
});

const initialNodes = [
  {
    message: createMessage({
      id: "msg_01",
      role: "user",
      text: "Plan a production launch.",
      title: "Initial prompt",
    }),
    parentId: null,
  },
  {
    message: createMessage({
      id: "msg_02",
      role: "assistant",
      text: "Start with architecture, rollout, and observability as separate workstreams.",
      title: "Initial answer",
    }),
    parentId: "msg_01",
  },
  {
    message: createMessage({
      id: "msg_03",
      role: "user",
      text: "Make the plan technical.",
      title: "Follow-up",
    }),
    parentId: "msg_02",
  },
  {
    message: createMessage({
      id: "msg_04a",
      role: "assistant",
      text: "Use staged environments, immutable builds, and progressive traffic shifting.",
      title: "Deployment branch",
    }),
    parentId: "msg_03",
  },
  {
    message: createMessage({
      id: "msg_05a",
      role: "user",
      text: "Add the deployment sequence.",
      title: "Deployment follow-up",
    }),
    parentId: "msg_04a",
  },
  {
    message: createMessage({
      id: "msg_04b",
      role: "assistant",
      text: "Define service-level indicators before rollout and attach alerts to user impact.",
      title: "Observability branch",
    }),
    parentId: "msg_03",
  },
  {
    message: createMessage({
      id: "msg_05b",
      role: "user",
      text: "Focus on monitoring first.",
      title: "Observability follow-up",
    }),
    parentId: "msg_04b",
  },
] satisfies MessageTreeSnapshot<PlaygroundMessage>["nodes"];

const initialTree: MessageTreeSnapshot<PlaygroundMessage> = {
  cursorId: "msg_05a",
  nodes: initialNodes,
  version: 1,
};

const delay = async (
  ms: number,
  signal?: Readonly<AbortSignal>
): Promise<void> => {
  signal?.throwIfAborted();
  const { promise, resolve, reject }: PromiseWithResolvers<void> =
    Promise.withResolvers();
  const abort = new AbortController();
  const timeout = setTimeout((): void => {
    abort.abort();
    resolve();
  }, ms);
  const onAbort = (): void => {
    clearTimeout(timeout);
    reject(new DOMException("Aborted", "AbortError"));
  };
  signal?.addEventListener("abort", onAbort, {
    once: true,
    signal: abort.signal,
  });
  await promise;
};

const RESPONSE_NUMBER_PATTERN = /\d+/u;

const createPlaygroundTransport = (): ChatTransport<PlaygroundMessage> => ({
  // oxlint-disable-next-line typescript/promise-function-async -- The demo has no reconnectable backend stream; this no-work transport result has no asynchronous operation to await.
  reconnectToStream: () => Promise.resolve(null),
  // oxlint-disable-next-line typescript/promise-function-async -- Stream construction and its initial enqueues happen synchronously; awaiting token production here would postpone returning the streaming body.
  sendMessages: ({ abortSignal, body, messages }: PlaygroundTransportInput) => {
    const requestBody: StreamBody | undefined = body;
    const responseLabel = requestBody?.responseLabel ?? "Assistant";
    const streamId = crypto.randomUUID();
    const userMessage = messages.at(-1);
    const prompt = userMessage ? getMessageText(userMessage) : "this branch";
    const response = `${responseLabel}: Let’s explore "${prompt}". Start with a small release that people can try immediately. Show one clear workflow, collect feedback from real integrations, and use it to decide what to improve next. This response has its own stream: you can explore another branch, stop a sibling, or return here without losing any of this progress.`;
    const words = response.split(" ");
    // Different cadences make independent streams easy to follow in the demo.
    const responseNumber = Number(
      RESPONSE_NUMBER_PATTERN.exec(responseLabel)?.[0] ?? 1
    );
    const tokenDelay = 140 + (responseNumber % 3) * 35;

    return Promise.resolve(
      new ReadableStream<UIMessageChunk<PlaygroundMetadata>>({
        async start(
          controller: Readonly<
            ReadableStreamDefaultController<UIMessageChunk<PlaygroundMetadata>>
          >
        ): Promise<void> {
          try {
            controller.enqueue({
              messageMetadata: {
                activeStreamId: streamId,
                createdAt: new Date().toISOString(),
                title: responseLabel,
              },
              type: "start",
            });
            controller.enqueue({ id: "text", type: "text-start" });

            for (const [index, word] of words.entries()) {
              // oxlint-disable-next-line eslint/no-await-in-loop -- Each visible word is emitted only after its cancellable delay; concurrency would collapse streaming cadence and enqueue words after abort.
              await delay(tokenDelay, abortSignal);
              controller.enqueue({
                delta: index === 0 ? word : ` ${word}`,
                id: "text",
                type: "text-delta",
              });
            }

            controller.enqueue({ id: "text", type: "text-end" });
            controller.enqueue({
              finishReason: "stop",
              messageMetadata: {
                activeStreamId: null,
                createdAt: new Date().toISOString(),
                title: responseLabel,
              },
              type: "finish",
            });
            controller.close();
          } catch (error) {
            if (abortSignal?.aborted === true) {
              controller.enqueue({
                finishReason: "stop",
                messageMetadata: {
                  activeStreamId: null,
                  createdAt: new Date().toISOString(),
                  title: responseLabel,
                },
                type: "finish",
              });
              controller.close();
              return;
            }
            controller.error(error);
          }
        },
      })
    );
  },
});

const buildTreeLayout = ({
  childrenByParentId,
  rootIds,
}: {
  readonly childrenByParentId: Readonly<Record<string, readonly string[]>>;
  readonly rootIds: readonly string[];
}): TreeLayout => {
  const positions = new Map<string, LayoutNode>();
  let nextLeaf = 0;
  let maxDepth = 0;

  const visit = (id: string, depth: number): number => {
    maxDepth = Math.max(maxDepth, depth);
    const children = childrenByParentId[id] ?? [];
    let column: number;

    if (children.length === 0) {
      column = nextLeaf;
      nextLeaf += 1;
    } else {
      const childColumns = children.map((childId): number =>
        visit(childId, depth + 1)
      );
      column =
        childColumns.reduce(
          (total, childColumn): number => total + childColumn,
          0
        ) / childColumns.length;
    }

    positions.set(id, { depth, id, x: column * 164 + 92, y: depth * 122 + 64 });
    return column;
  };

  for (const rootId of rootIds) {
    visit(rootId, 0);
    nextLeaf += 1;
  }

  return {
    height: Math.max(420, (maxDepth + 1) * 122 + 48),
    nodes: [...positions.values()],
    positions,
    width: Math.max(430, Math.max(0, nextLeaf - 2) * 164 + 184),
  };
};
export { buildTreeLayout, createPlaygroundTransport, initialTree };
export type {
  LayoutNode,
  PlaygroundChat,
  PlaygroundMessage,
  PlaygroundMetadata,
};
