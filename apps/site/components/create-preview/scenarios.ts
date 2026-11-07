import type {
  ReadonlyEveMessage,
  ReadonlyEveMessagePart,
} from "../../../chat/lib/eve/readonly-message-types";
import { sampleDocument } from "./preview-documents";
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
        text: "Help me build a small app people will love.",
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
        text: "# A small start. A great experience.\n\nStart with one useful conversation. Keep the interface clear, let people bring their context, and make every interaction feel considered.\n\n## Make it personal\n\nYour colors, your typography, your way of working.\n\n## Keep it simple\n\nA focused workspace that gets out of the way.\n\n```sh\nbunx @chat-js/cli@beta create my-chat\n```\n\nReady when you are.",
      },
    ],
  },
];
const tools: readonly ReadonlyEveMessage[] = [
  {
    id: "tools-user",
    role: "user",
    parts: [
      { type: "text", state: "done", text: "Research a plan for my app." },
    ],
  },
  {
    id: sampleMessageId,
    metadata: { modelId: "openai/gpt-5-nano" },
    role: "assistant",
    parts: [
      {
        type: "reasoning",
        state: "done",
        text: "Start by reviewing the project notes, then gather sources.",
      },
      {
        type: "dynamic-tool",
        toolCallId: "notes",
        toolName: "Reviewing project notes",
        state: "output-available",
        input: { file: "project-notes.md" },
        output: { summary: "Keep the scope small." },
      },
      {
        type: "dynamic-tool",
        toolCallId: "search",
        toolName: "Search unavailable",
        state: "output-error",
        input: { query: "app design" },
        errorText:
          "This is a sample error state. No external tool runs in the preview.",
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
                  text: "Select tools in the App panel to preview their states.",
                },
              ],
            },
          ]
        : [
            tools[0],
            {
              ...tools[1],
              parts: [...selectedTools]
                .filter((name) => !name.startsWith("edit"))
                .map((toolName, index): ReadonlyEveMessagePart =>
                  toolName === "createTextDocument"
                    ? {
                        type: "dynamic-tool",
                        toolCallId: `sample-tool-${index}`,
                        toolName,
                        state: "output-available",
                        input: { title: sampleDocument.title },
                        output: sampleDocument,
                      }
                    : {
                        type: "dynamic-tool",
                        toolCallId: `sample-tool-${index}`,
                        toolName,
                        state: "output-error",
                        input: {},
                        errorText:
                          "This is a sample error state. No external tool runs in the preview.",
                      }
                ),
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
