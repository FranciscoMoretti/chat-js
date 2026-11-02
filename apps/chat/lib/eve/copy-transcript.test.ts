import type { SessionStreamEvent } from "eve/client";
import {
  EveCopyNotReadyError,
  eveCopyResources,
  prepareEveCopyTranscript,
} from "./copy-transcript";
import { expect, it } from "vitest";
import type { EveCopySeed } from "./copy-seed";

const sourceFile = "aaaaaaaaaaaaaaaaaaaaaaaa.png";
const sourceUrl = `/api/files/${sourceFile}`;

const history = (messages: EveCopySeed["messages"]): SessionStreamEvent[] => [
  {
    data: {
      transcriptSeed: {
        attachments: "channel",
        messages: messages.map((message) => {
          if (message.role === "user") {
            return {
              ...message,
              parts: message.parts.map((part) =>
                part.type === "file"
                  ? {
                      ...part,
                      existingPath: "/workspace/.eve/attachments/note.pdf",
                    }
                  : part
              ),
            };
          }
          return {
            ...message,
            parts: message.parts.map((part) =>
              part.type === "file"
                ? {
                    ...part,
                    existingPath: "/workspace/.eve/attachments/note.pdf",
                  }
                : part
            ),
          };
        }),
      },
    },
    meta: {
      at: "2026-09-12T00:00:00Z",
      position: { line: 0, index: 0 },
      endOfLine: true,
    },
    type: "session.started",
  },
];
const admitted: SessionStreamEvent = {
  type: "delivery.admitted",
  data: { deliveryId: "new" },
  meta: {
    at: "2026-09-12T00:00:02Z",
    position: { line: 1, index: 0 },
    endOfLine: true,
  },
};

it("prepares exactly the public content without execution, approval or billing identities", () => {
  const events = history([
    {
      parts: [{ text: "Question", type: "text" }],
      role: "user",
    },
    {
      metadata: { turnId: "private-turn" },
      parts: [
        { text: "Visible reasoning", type: "reasoning" },
        {
          input: { prompt: "Image" },
          output: {
            kind: "chatjs.tool-result",
            output: { url: sourceUrl },
            status: "success",
            usage: { costUsd: 3 },
            version: 1,
          },
          state: "output-available",

          toolName: "generateImage",
          type: "dynamic-tool",
        },
        { text: "Answer", type: "text" },
      ],
      role: "assistant",
    },
  ]);
  const result = prepareEveCopyTranscript(events);
  const serialized = JSON.stringify(result.seed);
  expect(serialized).toContain("Visible reasoning");
  expect(serialized).toContain("Answer");
  expect(result.resources.fileKeys).toEqual([sourceFile]);
  for (const secret of [
    "source-user",
    "source-assistant",
    "private-turn",
    "private-call",
    "costUsd",
  ]) {
    expect(serialized).not.toContain(secret);
  }
  expect(prepareEveCopyTranscript(events).projectionHash).toBe(
    result.projectionHash
  );
});

it("preserves inline attachments and tool error or denial content without approval receipts", () => {
  const result = prepareEveCopyTranscript(
    history([
      {
        parts: [
          {
            filename: "note.pdf",
            mediaType: "application/pdf",
            type: "file",
            url: "data:application/pdf;base64,JVBERg==",
          },
        ],
        role: "user",
      },
      {
        parts: [
          {
            reason: "Declined",
            input: {},
            state: "output-denied",

            toolName: "confirm_note",
            type: "dynamic-tool",
          },
          {
            errorText: "Unavailable",
            input: {},
            state: "output-error",

            toolName: "readDocument",
            type: "dynamic-tool",
          },
        ],
        role: "assistant",
      },
    ])
  );
  expect(JSON.stringify(result.seed)).toContain(
    "data:application/pdf;base64,JVBERg=="
  );
  expect(JSON.stringify(result.seed)).toContain('"reason":"Declined"');
  expect(JSON.stringify(result.seed)).not.toContain("private-receipt");
});

it("requires a completed idle boundary before copying", () => {
  const events = history([
    { role: "user", parts: [{ type: "text", text: "Question" }] },
  ]);
  expect(() => prepareEveCopyTranscript([...events, admitted])).toThrow(
    EveCopyNotReadyError
  );
  const started: SessionStreamEvent = {
    type: "turn.started",
    data: { turnId: "turn", cause: { deliveryId: "new" }, follows: null },
    meta: { ...admitted.meta, position: { line: 2, index: 0 } },
  };
  expect(() =>
    prepareEveCopyTranscript([...events, admitted, started])
  ).toThrow(EveCopyNotReadyError);
});

it("does not mutate frozen inputs while collecting copy resources", () => {
  const value = Object.freeze({ nested: Object.freeze({ url: sourceUrl }) });
  expect(eveCopyResources(value).fileKeys).toEqual([sourceFile]);
});
it("retains model provenance in copies of copies without carrying private metadata", () => {
  const events = history([
    {
      parts: [{ text: "Question", type: "text" }],
      role: "user",
    },
    {
      modelId: "gateway/google/gemini-2.5-flash-lite",
      metadata: { result: "private-result" },
      parts: [{ text: "Answer", type: "text" }],
      role: "assistant",
    },
  ]);
  const copy = prepareEveCopyTranscript(events);
  expect(copy.seed.messages[1]).toEqual({
    modelId: "gateway/google/gemini-2.5-flash-lite",
    parts: [{ text: "Answer", type: "text" }],
    role: "assistant",
  });
  expect(JSON.stringify(copy.seed)).not.toContain("private-result");
});

it("preserves selected tools in copies without publishing unrelated custom metadata", () => {
  const result = prepareEveCopyTranscript(
    history([
      {
        metadata: {
          chatjs: {
            privateToken: "owner-only",
            selectedTool: "createTextDocument",
          },
          integration: { token: "integration-secret" },
        },
        parts: [{ text: "Create a document", type: "text" }],
        role: "user",
      },
    ])
  );
  expect(result.seed.messages[0]).toEqual({
    metadata: { chatjs: { selectedTool: "createTextDocument" } },
    parts: [{ text: "Create a document", type: "text" }],
    role: "user",
  });
});

it("preserves native seeded text tool results through the ChatJS shared-copy projection", () => {
  const messages: EveCopySeed["messages"] = [
    {
      parts: [{ text: "Read the file", type: "text" }],
      role: "user",
    },
    {
      parts: [
        {
          type: "dynamic-tool",
          toolName: "readFile",

          input: { path: "notes.txt" },
          state: "output-available",
          output: "plain text",
          outputType: "text",
        },
      ],
      role: "assistant",
    },
  ];
  const copied = prepareEveCopyTranscript(history(messages));
  expect(copied.seed.messages[1]?.parts[0]).toMatchObject({
    output: "plain text",
    outputType: "text",
    state: "output-available",
    type: "dynamic-tool",
  });
  expect(JSON.stringify(copied.seed)).not.toContain("original");
});

it("branches before an edited user message and rejects invalid boundaries", () => {
  const events = history([
    {
      role: "user",
      parts: [{ type: "text", text: "Original first" }],
    },
    {
      role: "assistant",
      parts: [{ type: "text", text: "Old answer" }],
    },
    {
      role: "user",
      parts: [{ type: "text", text: "Later prompt" }],
    },
  ]);
  expect(
    prepareEveCopyTranscript(events, [], "seed_message_0").seed.messages
  ).toEqual([]);
  const prefix = prepareEveCopyTranscript(events, [], "seed_message_2").seed
    .messages;
  expect(prefix.map((message) => message.role)).toEqual(["user", "assistant"]);
  expect(JSON.stringify(prefix)).not.toContain("Later prompt");
  expect(prepareEveCopyTranscript(events).seed.messages).toHaveLength(3);
  for (const invalid of ["missing", "seed_message_1"]) {
    expect(() => prepareEveCopyTranscript(events, [], invalid)).toThrow(
      "not a user message"
    );
  }
  expect(() =>
    prepareEveCopyTranscript([...events, admitted], [], "seed_message_0")
  ).toThrow(EveCopyNotReadyError);
});
