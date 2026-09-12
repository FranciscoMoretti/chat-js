import { getMessageText } from "@chat-js/thread";
import type { MessageTreeSnapshot } from "@chat-js/thread";
import type { UseThreadHelpers } from "@chat-js/thread/react";
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

export interface PlaygroundMetadata {
  activeStreamId: string | null;
  createdAt: string;
  title?: string;
}

export type PlaygroundMessage = UIMessage<PlaygroundMetadata>;
export type PlaygroundChat = UseThreadHelpers<PlaygroundMessage>;

interface StreamBody {
  responseLabel?: string;
}

export interface LayoutNode {
  depth: number;
  id: string;
  x: number;
  y: number;
}

const createMessage = ({
  id,
  role,
  text,
  title,
}: {
  id: string;
  role: "assistant" | "user";
  text: string;
  title: string;
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

export const initialTree: MessageTreeSnapshot<PlaygroundMessage> = {
  cursorId: "msg_05a",
  nodes: initialNodes,
  version: 1,
};

const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const onAbort = () => {
      clearTimeout(timeout);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });

const RESPONSE_NUMBER_PATTERN = /\d+/u;

export class PlaygroundTransport implements ChatTransport<PlaygroundMessage> {
  sendMessages({
    abortSignal,
    body,
    messages,
  }: Parameters<ChatTransport<PlaygroundMessage>["sendMessages"]>[0]) {
    const requestBody = body as StreamBody | undefined;
    const responseLabel = requestBody?.responseLabel ?? "Assistant";
    const streamId = crypto.randomUUID();
    const userMessage = messages.at(-1);
    const prompt = userMessage ? getMessageText(userMessage) : "this branch";
    const response = `${responseLabel}: Let’s explore "${prompt}". Start with a small release that people can try immediately. Show one clear workflow, collect feedback from real integrations, and use it to decide what to improve next. This response has its own stream: you can explore another branch, stop a sibling, or return here without losing any of this progress.`;
    const words = response.split(" ");
    // Different cadences make independent streams easy to follow in the demo.
    const responseNumber = Number(
      responseLabel.match(RESPONSE_NUMBER_PATTERN)?.[0] ?? 1
    );
    const tokenDelay = 140 + (responseNumber % 3) * 35;

    return Promise.resolve(
      new ReadableStream<UIMessageChunk<PlaygroundMetadata>>({
        async start(controller) {
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
            if (abortSignal?.aborted) {
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
  }

  reconnectToStream() {
    return Promise.resolve(null);
  }
}

export const buildTreeLayout = ({
  childrenByParentId,
  rootIds,
}: {
  childrenByParentId: Record<string, string[]>;
  rootIds: string[];
}) => {
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
      const childColumns = children.map((childId) => visit(childId, depth + 1));
      column =
        childColumns.reduce((total, childColumn) => total + childColumn, 0) /
        childColumns.length;
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
