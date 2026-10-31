import type { EveMessage, SessionStreamEvent } from "eve/client";
import {
  EveCopyNotReadyError,
  eveCopyResources,
  prepareEveCopyTranscript,
} from "./copy-transcript";
import { expect, it } from "vitest";
import type { ReadonlyEveMessagePart } from "./readonly-message-types";

const sourceFile = "aaaaaaaaaaaaaaaaaaaaaaaa.png";
const sourceUrl = `/api/files/${sourceFile}`;

const history = (
  messages: readonly Readonly<
    Omit<EveMessage, "parts"> & {
      readonly parts: readonly ReadonlyEveMessagePart[];
    }
  >[]
): SessionStreamEvent[] => [
  {
    data: { messages },
    meta: { at: "2026-09-12T00:00:00Z", id: "seed-event" },
    type: "history.seeded",
  },
  {
    data: { continuationToken: "source-token", wait: "next-user-message" },
    meta: { at: "2026-09-12T00:00:01Z", id: "idle-event" },
    type: "session.waiting",
  },
];

it("prepares exactly the public content without execution, approval or billing identities", () => {
  const events = history([
    {
      id: "source-user",
      parts: [{ text: "Question", type: "text" }],
      role: "user",
    },
    {
      id: "source-assistant",
      metadata: { turnId: "private-turn" },
      parts: [
        { state: "done", text: "Visible reasoning", type: "reasoning" },
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
          toolCallId: "private-call",
          toolName: "generateImage",
          type: "dynamic-tool",
        },
        { state: "done", text: "Answer", type: "text" },
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
        id: "user",
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
        id: "answer",
        parts: [
          {
            approval: {
              approved: false,
              id: "private-receipt",
              reason: "Declined",
            },
            input: {},
            state: "output-denied",
            toolCallId: "denied-call",
            toolName: "confirm_note",
            type: "dynamic-tool",
          },
          {
            errorText: "Unavailable",
            input: {},
            state: "output-error",
            toolCallId: "error-call",
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

it.each<EveMessage["parts"][number]>([
  { state: "streaming", text: "Partial", type: "text" },
  {
    input: {},
    state: "input-available",
    toolCallId: "call",
    toolName: "tool",
    type: "dynamic-tool",
  },
  {
    input: {},
    output: {},
    partial: true,
    state: "output-available",
    toolCallId: "call",
    toolName: "tool",
    type: "dynamic-tool",
  },
  {
    approval: { id: "private" },
    input: {},
    state: "approval-requested",
    toolCallId: "call",
    toolName: "tool",
    type: "dynamic-tool",
  },
])(
  "refuses incomplete visible parts rather than dropping them",
  (part: ReadonlyEveMessagePart) => {
    expect(() =>
      prepareEveCopyTranscript(
        history([{ id: "answer", parts: [part], role: "assistant" }])
      )
    ).toThrow(EveCopyNotReadyError);
  }
);

it("requires a durable idle boundary, including when a new turn has no assistant text yet", () => {
  const events = history([
    {
      id: "question",
      parts: [{ text: "Question", type: "text" }],
      role: "user",
    },
  ]);
  expect(() => prepareEveCopyTranscript(events.slice(0, 1))).toThrow(
    EveCopyNotReadyError
  );
  const received: SessionStreamEvent = {
    data: { message: "Next question", sequence: 1, turnId: "turn_1" },
    meta: { at: "2026-09-12T00:00:02Z", id: "new" },
    type: "message.received",
  };
  expect(() => prepareEveCopyTranscript([...events, received])).toThrow(
    EveCopyNotReadyError
  );
});

it("does not mutate frozen inputs while collecting copy resources", () => {
  const value = Object.freeze({ nested: Object.freeze({ url: sourceUrl }) });
  expect(eveCopyResources(value).fileKeys).toEqual([sourceFile]);
});
it("retains model provenance in copies of copies without carrying private metadata", () => {
  const events = history([
    {
      id: "seed_message_0",
      parts: [{ text: "Question", type: "text" }],
      role: "user",
    },
    {
      id: "seed_message_1",
      metadata: {
        modelId: "gateway/google/gemini-2.5-flash-lite",
        result: "private-result",
      },
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
        id: "source-user",
        metadata: {
          custom: {
            chatjs: {
              privateToken: "owner-only",
              selectedTool: "createTextDocument",
            },
            integration: { token: "integration-secret" },
          },
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
  const messages: EveMessage[] = [
    {
      id: "seed_message_0",
      parts: [{ text: "Read the file", type: "text" }],
      role: "user",
    },
    {
      id: "seed_message_1",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "readFile",
          toolCallId: "seed_tool_0",
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
      id: "first",
      role: "user",
      parts: [{ type: "text", text: "Original first" }],
    },
    {
      id: "answer",
      role: "assistant",
      parts: [{ type: "text", text: "Old answer", state: "done" }],
    },
    {
      id: "later",
      role: "user",
      parts: [{ type: "text", text: "Later prompt" }],
    },
  ]);
  expect(prepareEveCopyTranscript(events, [], "first").seed.messages).toEqual(
    []
  );
  const prefix = prepareEveCopyTranscript(events, [], "later").seed.messages;
  expect(prefix.map((message) => message.role)).toEqual(["user", "assistant"]);
  expect(JSON.stringify(prefix)).not.toContain("Later prompt");
  expect(prepareEveCopyTranscript(events).seed.messages).toHaveLength(3);
  for (const invalid of ["missing", "answer"]) {
    expect(() => prepareEveCopyTranscript(events, [], invalid)).toThrow(
      "not a user message"
    );
  }
  expect(() =>
    prepareEveCopyTranscript(events.slice(0, 1), [], "first")
  ).toThrow(EveCopyNotReadyError);
});
