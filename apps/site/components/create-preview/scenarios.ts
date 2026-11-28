import { previewModels, samplePrompt } from "./preview-data";
import type {
  ReadonlyEveMessage,
  ReadonlyEveMessagePart,
} from "../../../chat/lib/eve/readonly-message-types";
import { toolExamples } from "./tool-examples";
import type { DraftAttachment } from "../../../chat/lib/eve/draft";
import { sampleMessageId } from "./fixture-transport";

export const sampleAttachment = {
  name: "project-notes.md",
  contentType: "text/markdown",
  url: "data:text/markdown,Keep%20the%20scope%20small.",
};
const attachment: ReadonlyEveMessagePart = {
  type: "file",
  filename: sampleAttachment.name,
  mediaType: sampleAttachment.contentType,
  url: sampleAttachment.url,
};

const sampleUserId = "sample-user";

const sampleAnswer = (plugins: readonly string[], responseIndex: number) => {
  if (!plugins.includes("parallel-responses")) {
    return "# A small start. A great experience.\n\nStart with one useful conversation. Keep the interface clear, let people bring their context, and make every interaction feel considered.\n\n## Make it personal\n\nYour colors, your typography, your way of working.\n\n## Keep it simple\n\nA focused workspace that gets out of the way.\n\n```sh\nbunx chat-js@beta create my-chat\n```";
  }
  return responseIndex === 0
    ? "## Start with one conversation\n\nGive people one place to ask a question, add their context, and get a useful reply. Test that first exchange with three people before adding more features."
    : "## Build around one real task\n\nAsk someone to show you the last time they needed your app. Prototype just that task, then watch them try it again. What they reach for next can guide your second feature.";
};

const conversation = (
  plugins: readonly string[],
  responseIndex: number
): readonly ReadonlyEveMessage[] => [
  {
    id: sampleUserId,
    role: "user",
    parts: [
      {
        type: "text",
        state: "done",
        text: samplePrompt,
      },
    ],
  },
  {
    id:
      responseIndex === 0
        ? sampleMessageId
        : `${sampleMessageId}-${responseIndex}`,
    metadata: { modelId: previewModels[responseIndex].id },
    role: "assistant",
    parts: [
      {
        type: "text",
        state: "done",
        text: [
          sampleAnswer(plugins, responseIndex),
          plugins.includes("streamdown-mermaid") &&
            "Start with one path through the app.\n\n```mermaid\nflowchart LR\n  Ask --> Reply --> FollowUp[Follow up]\n```",
          plugins.includes("streamdown-math") &&
            "Measure how often a first visit leads to a conversation.\n\n$$\nA = \\frac{\\text{new users who send a message}}{\\text{new users}}\n$$",
          "Ready when you are.",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
  },
];
/** Native message data only. Rendering belongs to the scaffold's transcript. */
export const sceneMessages = (
  item: string,
  plugins: readonly string[],
  selectedTools: ReadonlySet<string> = new Set(),
  responseIndex = 0
): readonly ReadonlyEveMessage[] => {
  let messages = conversation(plugins, responseIndex);
  if (item === "preview") {
    messages = [];
  } else if (item === "preview-tools") {
    messages =
      selectedTools.size === 0
        ? [
            {
              id: "no-tools",
              role: "assistant",
              parts: [
                {
                  type: "text",
                  state: "done",
                  text: "Select tools in the Agent tab to preview their examples.",
                },
              ],
            },
          ]
        : [
            {
              id: "tools-user",
              role: "user",
              parts: [
                {
                  type: "text",
                  state: "done",
                  text: "Show me what my selected tools can do.",
                },
              ],
            },
            {
              id: sampleMessageId,
              metadata: { modelId: "openai/gpt-5-nano" },
              role: "assistant",
              parts: [
                {
                  type: "text",
                  state: "done",
                  text: "Sample results for your selected tools. No external services are called.",
                },
                ...[...selectedTools]
                  .filter((name) => !name.startsWith("edit"))
                  .map((name): ReadonlyEveMessagePart => {
                    const example = toolExamples[name];
                    if (example === undefined) {
                      return {
                        type: "text",
                        state: "done",
                        text: `A preview example for ${name} is not available yet.`,
                      };
                    }
                    return {
                      type: "tool",
                      kind: "tool",
                      stepIndex: 0,
                      callId: `sample-tool-${name}`,
                      name,
                      state: "completed",
                      ...example,
                    };
                  }),
              ],
            },
          ];
  }
  if (!plugins.includes("attachment-uploads") || messages.length === 0) {
    return messages;
  }
  return messages.map((message, index) =>
    index === 0
      ? { ...message, parts: [...message.parts, attachment] }
      : message
  );
};

export interface PreviewSubmission {
  id: number;
  parentReplyId: string | null;
  text: string;
  modelIds: readonly string[];
  attachments: readonly Readonly<DraftAttachment>[];
}

export type PreviewEdit = Pick<PreviewSubmission, "id" | "text" | "modelIds">;

const submittedPrompt = (entry: PreviewSubmission): ReadonlyEveMessage => ({
  id: `preview-user-${entry.id}`,
  role: "user",
  parts: [
    ...(entry.text
      ? [
          {
            type: "text" as const,
            state: "done" as const,
            text: entry.text,
          },
        ]
      : []),
    ...entry.attachments.map((file): ReadonlyEveMessagePart => ({
      type: "file",
      filename: file.name,
      mediaType: file.contentType,
      url: file.url,
    })),
  ],
});

const submittedAnswer = (
  entry: PreviewEdit,
  gateway: string | undefined,
  index: number
): ReadonlyEveMessage => {
  const modelId = entry.modelIds[index];
  const modelName =
    previewModels.find((model) => model.id === modelId)?.name ?? modelId;
  return {
    id:
      index === 0
        ? `preview-assistant-${entry.id}`
        : `preview-assistant-${entry.id}-${index}`,
    metadata: { modelId },
    role: "assistant",
    parts: [
      {
        type: "text",
        state: "done",
        text:
          entry.modelIds.length > 1
            ? `This is sample response ${index + 1} from ${modelName}. Your generated app connects to ${gateway ?? "your gateway"} for live replies.`
            : `This is a local preview. Your generated app connects to ${gateway ?? "your gateway"} to answer your messages.`,
      },
    ],
  };
};

export const previewConversation = ({
  item,
  plugins,
  tools,
  gateway,
  submissions,
  selections,
  edits = {},
}: {
  item: string;
  plugins: readonly string[];
  tools: ReadonlySet<string>;
  gateway?: string;
  submissions: readonly PreviewSubmission[];
  selections: Readonly<Record<string, number>>;
  edits?: Readonly<Partial<Record<string, PreviewEdit>>>;
}) => {
  const parallel = plugins.includes("parallel-responses");
  const groups = new Map<string, readonly string[]>();
  const selected = parallel ? selections : {};
  const messages: ReadonlyEveMessage[] = [];
  const appendTurn = (
    prompt: ReadonlyEveMessage,
    reply: ReadonlyEveMessage,
    models: readonly string[]
  ) => {
    const edit = edits[prompt.id];
    let answer = reply;
    if (edit) {
      messages.push({
        ...prompt,
        parts: [
          { type: "text", state: "done", text: edit.text },
          ...prompt.parts.filter((part) => part.type === "file"),
        ],
      });
      answer = submittedAnswer(edit, gateway, selected[prompt.id] ?? 0);
    } else {
      messages.push(prompt);
    }
    const ids = edit?.modelIds ?? models;
    if (parallel && ids.length > 1) {
      groups.set(prompt.id, ids);
    }
    messages.push(answer);
    return answer.id;
  };

  const seed = sceneMessages(
    item,
    plugins,
    tools,
    edits[sampleUserId] ? 0 : (selected[sampleUserId] ?? 0)
  );
  let replyId: string | null = null;
  const prompt = seed.at(0);
  const reply = seed.at(1);
  if (prompt?.role === "user" && reply) {
    const id = appendTurn(
      prompt,
      reply,
      item === "preview-02" ? previewModels.map((model) => model.id) : []
    );
    if (item === "preview-02" || edits[prompt.id]) {
      replyId = id;
    }
  } else {
    messages.push(...seed);
  }
  for (const entry of submissions) {
    if (entry.parentReplyId === replyId) {
      const user = submittedPrompt(entry);
      const assistant = submittedAnswer(entry, gateway, selected[user.id] ?? 0);
      replyId = appendTurn(user, assistant, entry.modelIds);
    }
  }
  return { groups, messages, replyId };
};
