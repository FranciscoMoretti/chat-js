import { getMessageText } from "@chat-js/thread";
/* oxlint-disable eslint/sort-imports -- the @chat-js/thread import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
import type { MessageTreeSnapshot } from "@chat-js/thread";
/* oxlint-enable eslint/sort-imports */
import type { UseThreadHelpers } from "@chat-js/thread/react";
/* oxlint-disable eslint/sort-imports -- the ai import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/exports-last -- PlaygroundMetadata: The declaration is an existing named entrypoint used by consumers; its colocated export makes that boundary explicit. */
/* oxlint-disable import/group-exports -- PlaygroundMetadata: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable import/no-named-export -- PlaygroundMetadata: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
export interface PlaygroundMetadata {
  activeStreamId: string | null;
  createdAt: string;
  title?: string;
}
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable import/exports-last -- PlaygroundMessage: The declaration is an existing named entrypoint used by consumers; its colocated export makes that boundary explicit. */
/* oxlint-disable import/group-exports -- PlaygroundMessage: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable import/no-named-export -- PlaygroundMessage: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
export type PlaygroundMessage = UIMessage<PlaygroundMetadata>;
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */
/* oxlint-disable import/exports-last -- PlaygroundChat: The declaration is an existing named entrypoint used by consumers; its colocated export makes that boundary explicit. */
/* oxlint-disable import/group-exports -- PlaygroundChat: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable import/no-named-export -- PlaygroundChat: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
export type PlaygroundChat = UseThreadHelpers<PlaygroundMessage>;
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

interface StreamBody {
  responseLabel?: string;
}

/* oxlint-disable import/exports-last -- LayoutNode: The declaration is an existing named entrypoint used by consumers; its colocated export makes that boundary explicit. */
/* oxlint-disable import/group-exports -- LayoutNode: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable import/no-named-export -- LayoutNode: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
/* oxlint-disable eslint/id-length -- LayoutNode: The local index/OS/library binding retains its conventional API notation. */
export interface LayoutNode {
  depth: number;
  id: string;
  x: number;
  y: number;
}
/* oxlint-enable eslint/id-length */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable unicorn/no-null -- createMessage: The SDK/wire/OS contract uses null as an explicit absence value. */
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
/* oxlint-enable unicorn/no-null */

/* oxlint-disable unicorn/no-null -- initialNodes: The SDK/wire/OS contract uses null as an explicit absence value. */
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
/* oxlint-enable unicorn/no-null */

/* oxlint-disable import/exports-last -- initialTree: The declaration is an existing named entrypoint used by consumers; its colocated export makes that boundary explicit. */
/* oxlint-disable import/group-exports -- initialTree: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable import/no-named-export -- initialTree: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
export const initialTree: MessageTreeSnapshot<PlaygroundMessage> = {
  cursorId: "msg_05a",
  nodes: initialNodes,
  version: 1,
};
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable oxc/no-async-await -- delay: Await sequencing preserves this operation's dependent I/O and error propagation. */
/* oxlint-disable oxc/no-optional-chaining -- delay: The guarded lookup intentionally permits missing SDK/state fields; preserve one evaluation of the existing optional access. */
/* oxlint-disable eslint/no-undefined -- delay: The API distinguishes omitted/undefined values from null or a concrete result; preserve that sentinel. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- delay: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
const delay = async (ms: number, signal?: AbortSignal): Promise<void> => {
  signal?.throwIfAborted();
  const { promise, resolve, reject } = Promise.withResolvers<undefined>();
  const abort = new AbortController();
  const timeout = setTimeout((): void => {
    abort.abort();
    resolve(undefined);
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable oxc/no-async-await */

const RESPONSE_NUMBER_PATTERN = /\d+/u;

/* oxlint-disable import/group-exports -- createPlaygroundTransport: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable eslint/max-statements -- createPlaygroundTransport: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
/* oxlint-disable import/no-named-export -- createPlaygroundTransport: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
/* oxlint-disable eslint/max-lines-per-function -- createPlaygroundTransport: The operation keeps its validation, ordered side effects and cleanup in one scope. */
/* oxlint-disable unicorn/no-null -- createPlaygroundTransport: The SDK/wire/OS contract uses null as an explicit absence value. */
/* oxlint-disable eslint/no-magic-numbers -- createPlaygroundTransport: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
/* oxlint-disable oxc/no-optional-chaining -- createPlaygroundTransport: The guarded lookup intentionally permits missing SDK/state fields; preserve one evaluation of the existing optional access. */
/* oxlint-disable eslint/no-ternary -- createPlaygroundTransport: The expression preserves the existing fallback/derived-value contract within this operation. */
/* oxlint-disable oxc/no-async-await -- createPlaygroundTransport: Await sequencing preserves this operation's dependent I/O and error propagation. */
/* oxlint-disable typescript/promise-function-async -- createPlaygroundTransport: Keep synchronous validation/throws and the original promise identity; adding async changes those observable boundaries. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- createPlaygroundTransport: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
/* oxlint-disable typescript/strict-boolean-expressions -- createPlaygroundTransport: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
export const createPlaygroundTransport =
  (): ChatTransport<PlaygroundMessage> => ({
    reconnectToStream: () => Promise.resolve(null),
    sendMessages: ({
      abortSignal,
      body,
      messages,
    }: Parameters<ChatTransport<PlaygroundMessage>["sendMessages"]>[0]) => {
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
          async start(controller): Promise<void> {
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
                // oxlint-disable-next-line no-await-in-loop -- Stream words in order with a separate cancellable delay for each token.
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
    },
  });
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable import/no-named-export */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- buildTreeLayout: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable import/no-named-export -- buildTreeLayout: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
/* oxlint-disable typescript/explicit-module-boundary-types -- buildTreeLayout: The exported SDK/composite API preserves inferred relationships; an explicit boundary type requires a public contract decision. */
/* oxlint-disable typescript/explicit-function-return-type -- buildTreeLayout: Keep contextual/generic inference for this SDK, callback or composite result; a new explicit type requires choosing its public shape. */
/* oxlint-disable eslint/init-declarations -- buildTreeLayout: Assignment occurs only after branch-specific validation; eager initialization would hide definite-assignment guarantees. */
/* oxlint-disable eslint/no-magic-numbers -- buildTreeLayout: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
/* oxlint-disable eslint/id-length -- buildTreeLayout: The local index/OS/library binding retains its conventional API notation. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- buildTreeLayout: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/id-length */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
