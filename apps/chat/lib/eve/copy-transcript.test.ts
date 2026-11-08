import type { SessionStreamEvent, SessionEvent } from "eve/client";
import {
  EveCopyNotReadyError,
  eveCopyResources,
  prepareEveCopyTranscript as capture,
} from "./copy-transcript";
import { expect, it } from "vitest";
import { nativeBranchHistory } from "./branch-history";
import type { EveCopySeed } from "./copy-seed";

const sourceFile = "aaaaaaaaaaaaaaaaaaaaaaaa.png";
const sourceUrl = `/api/files/${sourceFile}`;

const prepareEveCopyTranscript = (
  events: readonly SessionStreamEvent[],
  receipts: Parameters<typeof capture>[1] = [],
  before = events.some(
    (event) =>
      event.type === "delivery.consumed" && event.data.deliveryId === "import"
  )
    ? "import:user"
    : undefined
) => capture(events, receipts, before);
const meta = (line: number) => ({
  at: "2026-11-08T00:00:00Z",
  position: { line, index: 0 },
  endOfLine: true,
});
const history = (messages: EveCopySeed["messages"]): SessionStreamEvent[] => [
  { type: "session.started", meta: meta(0), data: {} },
  { type: "delivery.admitted", meta: meta(1), data: { deliveryId: "import" } },
  {
    type: "turn.started",
    meta: meta(2),
    data: {
      turnId: "import-turn",
      follows: null,
      cause: { deliveryId: "import" },
    },
  },
  {
    type: "delivery.consumed",
    meta: meta(3),
    data: {
      deliveryId: "import",
      turnId: "import-turn",
      parts: [{ kind: "text", text: "Continue" }],
      history: nativeBranchHistory({ messages }),
    },
  },
  {
    type: "turn.settled",
    meta: meta(4),
    data: { turnId: "import-turn", outcome: "completed" },
  },
];
const admitted: SessionStreamEvent = {
  type: "delivery.admitted",
  data: { deliveryId: "new" },
  meta: {
    at: "2026-09-12T00:00:02Z",
    position: { line: 6, index: 0 },
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
  const copy = prepareEveCopyTranscript(events, [
    {
      kind: "send",
      deliveryId: "import",
      selectedTool: null,
      history: [
        { role: "user" },
        { role: "assistant", modelId: "gateway/google/gemini-2.5-flash-lite" },
      ],
    },
  ]);
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
    ]),
    [
      {
        kind: "send",
        deliveryId: "import",
        selectedTool: null,
        history: [{ role: "user", selectedTool: "createTextDocument" }],
      },
    ]
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

it("captures imported messages and the completed native answer without a boundary", () => {
  const imported: EveCopySeed["messages"] = [
    { role: "user", parts: [{ type: "text", text: "Old question" }] },
    { role: "assistant", parts: [{ type: "text", text: "Old answer" }] },
  ];
  const local: SessionEvent[] = [
    {
      type: "model.requested",
      scope: { turnId: "import-turn" },
      data: { runId: "native-run", owner: { turnId: "import-turn" } },
    },
    {
      type: "model.started",
      scope: { turnId: "import-turn" },
      data: { runId: "native-run", attempt: 0, modelId: "fixture" },
    },
    {
      type: "content.completed",
      scope: { turnId: "import-turn", runId: "native-run" },
      data: {
        runId: "native-run",
        partId: "reply",
        kind: "text",
        phase: "reply",
        value: "Native answer",
      },
    },
    {
      type: "model.settled",
      scope: { turnId: "import-turn", runId: "native-run" },
      data: {
        runId: "native-run",
        generationId: "native-generation",
        outcome: "completed",
        finishReason: "stop",
      },
    },
    {
      type: "turn.settled",
      data: { turnId: "import-turn", outcome: "completed", reply: ["reply"] },
    },
    {
      type: "delivery.settled",
      data: { deliveryId: "import", turnId: "import-turn", outcome: "handled" },
    },
  ];
  const prefix = history(imported).slice(0, -1);
  const events = [
    ...prefix,
    ...local.map((event, index) => ({
      ...event,
      meta: meta(prefix.length + index),
    })),
  ];
  expect(capture(events, []).seed.messages).toEqual([
    ...imported,
    { role: "user", parts: [{ type: "text", text: "Continue" }] },
    {
      role: "assistant",
      modelId: "fixture",
      parts: [{ type: "text", text: "Native answer" }],
    },
  ]);
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
    prepareEveCopyTranscript(events, [], "import:imported:0").seed.messages
  ).toEqual([]);
  const prefix = prepareEveCopyTranscript(events, [], "import:imported:2").seed
    .messages;
  expect(prefix.map((message) => message.role)).toEqual(["user", "assistant"]);
  expect(JSON.stringify(prefix)).not.toContain("Later prompt");
  expect(prepareEveCopyTranscript(events).seed.messages).toHaveLength(3);
  for (const invalid of ["missing", "import:imported:1"]) {
    expect(() => prepareEveCopyTranscript(events, [], invalid)).toThrow(
      "not a user message"
    );
  }
  expect(() =>
    prepareEveCopyTranscript([...events, admitted], [], "import:imported:0")
  ).toThrow(EveCopyNotReadyError);
});

it("copies native completed calls without carrying execution identities", () => {
  const native: SessionEvent[] = [
    { type: "session.started", data: {} },
    { type: "delivery.admitted", data: { deliveryId: "source-user" } },
    {
      type: "turn.started",
      data: {
        turnId: "private-turn",
        follows: null,
        cause: { deliveryId: "source-user" },
      },
    },
    {
      type: "delivery.consumed",
      data: {
        turnId: "private-turn",
        deliveryId: "source-user",
        parts: [{ kind: "text", text: "Question" }],
      },
    },
    {
      type: "model.started",
      scope: { turnId: "private-turn" },
      data: { runId: "source-assistant", attempt: 0, modelId: "fixture" },
    },
    {
      type: "call.requested",
      scope: { turnId: "private-turn", runId: "source-assistant" },
      data: {
        callId: "private-call",
        owner: { runId: "source-assistant" },
        capability: { kind: "tool", name: "wordCount" },
        input: { text: "hello" },
      },
    },
    {
      type: "call.settled",
      scope: { turnId: "private-turn", runId: "source-assistant" },
      data: {
        callId: "private-call",
        outcome: "completed",
        output: { words: 1 },
      },
    },
    {
      type: "delivery.settled",
      data: {
        deliveryId: "source-user",
        turnId: "private-turn",
        outcome: "handled",
      },
    },
    {
      type: "turn.settled",
      data: { turnId: "private-turn", outcome: "completed" },
    },
  ];
  const events = native.map((event, index) => ({
    ...event,
    meta: {
      at: "2026-11-02T00:00:00Z",
      position: { line: index, index: 0 },
      endOfLine: true,
    },
  }));
  const copy = prepareEveCopyTranscript(events, [
    {
      kind: "send",
      deliveryId: "import",
      selectedTool: null,
      history: [
        { role: "user" },
        { role: "assistant", modelId: "gateway/google/gemini-2.5-flash-lite" },
      ],
    },
  ]);
  expect(copy.seed.messages[1]?.parts).toContainEqual({
    type: "dynamic-tool",
    toolName: "wordCount",
    input: { text: "hello" },
    state: "output-available",
    output: { words: 1 },
  });
  for (const id of [
    "source-user",
    "source-assistant",
    "private-turn",
    "private-call",
  ]) {
    expect(JSON.stringify(copy.seed)).not.toContain(id);
  }
  for (const boundary of [4, 5, 6, 7, 8]) {
    expect(() => prepareEveCopyTranscript(events.slice(0, boundary))).toThrow(
      EveCopyNotReadyError
    );
  }
});
