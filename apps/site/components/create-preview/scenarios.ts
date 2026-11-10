import { samplePrompt } from "./preview-data";
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

const conversation: readonly ReadonlyEveMessage[] = [
  {
    id: "sample-user",
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
    id: sampleMessageId,
    metadata: { modelId: "openai/gpt-5-nano" },
    role: "assistant",
    parts: [
      {
        type: "text",
        state: "done",
        text: "# A small start. A great experience.\n\nStart with one useful conversation. Keep the interface clear, let people bring their context, and make every interaction feel considered.\n\n## Make it personal\n\nYour colors, your typography, your way of working.\n\n## Keep it simple\n\nA focused workspace that gets out of the way.\n\n```sh\nbunx chat-js@alpha create my-chat\n```\n\nReady when you are.",
      },
    ],
  },
];
/** Native message data only. Rendering belongs to the scaffold's transcript. */
export const sceneMessages = (
  item: string,
  uploads: boolean,
  selectedTools: ReadonlySet<string> = new Set()
): readonly ReadonlyEveMessage[] => {
  let messages = conversation;
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
                  text: "Select AI tools to preview their examples.",
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
  if (!uploads || messages.length === 0) {
    return messages;
  }
  return messages.map((message, index) =>
    index === 0
      ? { ...message, parts: [...message.parts, attachment] }
      : message
  );
};

export const submittedMessages = (
  entries: readonly {
    text: string;
    attachments: readonly Readonly<DraftAttachment>[];
  }[],
  gateway: string | undefined
): readonly ReadonlyEveMessage[] =>
  entries.flatMap((entry, index): ReadonlyEveMessage[] => [
    {
      id: `preview-user-${index}`,
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
    },
    {
      id: `preview-assistant-${index}`,
      role: "assistant",
      parts: [
        {
          type: "text",
          state: "done",
          text: `This is a local preview. Your generated app connects to ${gateway ?? "your gateway"} to answer your messages.`,
        },
      ],
    },
  ]);
