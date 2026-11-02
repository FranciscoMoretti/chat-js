import { expect, it } from "vitest";
import { sharedEveMessages, sharedEvePart } from "./shared-messages";
import type { EveMessageDisplayReceipt } from "./message-display";
import type { EveMessagePart, SessionStreamEvent } from "eve/client";

type ToolPart = Extract<EveMessagePart, { type: "tool" }>;
const tool = {
  type: "tool",
  kind: "tool",
  callId: "display-call",
  name: "example",
  label: "Example",
  stepIndex: 8,
} as const;
const meta = (line: number) => ({
  at: "2026-11-02T00:00:00Z",
  position: { line, index: 0 },
  endOfLine: true,
});
const input: SessionStreamEvent[] = [
  { type: "session.started", data: {}, meta: meta(0) },
  { type: "delivery.admitted", data: { deliveryId: "known" }, meta: meta(1) },
  {
    type: "turn.started",
    data: { turnId: "turn", cause: { deliveryId: "known" }, follows: null },
    meta: meta(2),
  },
  {
    type: "delivery.consumed",
    data: {
      deliveryId: "known",
      turnId: "turn",
      parts: [{ kind: "text", text: "Public question" }],
    },
    scope: { turnId: "turn" },
    meta: meta(3),
  },
];
it("shares transcript content without authorization challenges or runtime metadata", () => {
  const messages = sharedEveMessages([
    ...input,
    {
      type: "interaction.opened",
      scope: { turnId: "turn" },
      meta: meta(4),
      data: {
        interactionId: "secret-request",
        subject: { turnId: "turn" },
        request: {
          kind: "sign-in",
          prompt: "Connect",
          signIn: {
            name: "connection",
            url: "https://private.example/secret-code",
          },
        },
      },
    },
  ]);
  const json = JSON.stringify(messages);
  expect(json).toContain("Public question");
  expect(json).toContain("An account connection was requested.");
  expect(json).not.toContain("secret-code");
  expect(json).not.toContain("secret-request");
  expect(messages.every((message) => !Object.hasOwn(message, "metadata"))).toBe(
    true
  );
});
it.each([
  {
    text: "Use Markdown with examples",
    expected: "Use Markdown with examples",
  },
  { text: undefined, expected: "Markdown" },
])("retains clarification answers: $expected", ({ text, expected }) => {
  const parts = sharedEvePart({
    ...tool,
    input: {},
    output: {},
    state: "completed",
    interaction: {
      interactionId: "secret-request",
      turnId: "private-turn",
      stepIndex: 0,
      status: "settled",
      outcome: "accepted",
      request: {
        kind: "question",
        options: [{ id: "option-private", label: "Markdown" }],
        prompt: "Which format?",
      },
      answer: {
        interactionId: "secret-request",
        optionId: "option-private",
        ...(text === undefined ? {} : { text }),
      },
    },
  });
  const json = JSON.stringify(parts);
  expect(json).toContain("Which format?");
  expect(json).toContain(`Response: ${expected}`);
  expect(json).not.toContain("secret-request");
  expect(json).not.toContain("option-private");
});
it.each([
  "codeExecution",
  "webSearch",
  "runCodeDocument",
  "generateVideo",
  "generateImage",
  "deepResearch",
  "externalPaidTool",
])("shared %s results retain the output without billing metadata", (name) => {
  const [part] = sharedEvePart({
    ...tool,
    name,
    input: { code: "console.log(42)", language: "javascript", title: "Test" },
    output: {
      kind: "chatjs.tool-result",
      output: { chart: "", message: "42" },
      status: "success",
      usage: { costUsd: 0.05 },
      version: 1,
    },
    state: "completed",
  });
  expect(JSON.stringify(part)).toContain('"message":"42"');
  expect(JSON.stringify(part)).not.toContain("costUsd");
  expect(JSON.stringify(part)).not.toContain("usage");
});
it("removes owner approval and execution fields while preserving every tool status", () => {
  const base = {
    ...tool,
    futureRuntimeToken: "runtime-private",
    input: { question: "Published input" },
    interaction: {
      interactionId: "owner-approval-secret",
      turnId: "private-turn",
      stepIndex: 8,
      status: "open" as const,
      request: { kind: "approval" as const, prompt: "Approve?" },
    },
  };
  const cases: ToolPart[] = [
    { ...base, output: { answer: "Published result" }, state: "completed" },
    {
      ...base,
      error: { code: "failed", message: "Published failure" },
      state: "failed",
    },
    { ...base, state: "rejected" },
    { ...base, state: "requested" },
    { ...base, state: "running" },
  ];
  for (const part of cases) {
    const parts = sharedEvePart(part);
    const json = JSON.stringify(parts);
    expect(json).toContain("Published input");
    expect(parts[0]).toMatchObject({ state: part.state, stepIndex: 0 });
    expect(json).not.toContain("owner-approval-secret");
    expect(json).not.toContain("private-turn");
    expect(json).not.toContain("runtime-private");
    if (part.state === "completed") {
      expect(parts[0]).toMatchObject({ output: part.output });
    }
    if (part.state === "failed") {
      expect(parts[0]).toMatchObject({ error: part.error });
    }
  }
});
it.each([
  {
    kind: "chatjs.tool-result",
    output: { message: "Unsupported version" },
    status: "success",
    usage: { costUsd: 99 },
    version: 2,
  },
  {
    kind: "chatjs.tool-result",
    status: "success",
    usage: { costUsd: 99 },
    version: 1,
  },
  {
    kind: "chatjs.tool-result",
    output: "Unrecognized envelope",
    privateRuntimeToken: "secret",
    usage: { costUsd: 99 },
  },
])("does not expose malformed platform result envelopes", (output: unknown) => {
  const parts = sharedEvePart({
    ...tool,
    input: { code: "1 + 1" },
    output,
    state: "completed",
  });
  expect(parts[0]).toMatchObject({ input: { code: "1 + 1" }, state: "failed" });
  expect(JSON.stringify(parts)).not.toContain("usage");
  expect(JSON.stringify(parts)).not.toContain("secret");
  expect(JSON.stringify(parts)).not.toContain("99");
});
it("preserves streaming and partial published tool content without runtime fields", () => {
  const parts: ToolPart[] = [
    { ...tool, inputText: "partial input", state: "streaming" },
    { ...tool, input: { text: "partial" }, state: "requested" },
    {
      ...tool,
      input: { text: "partial" },
      output: "partial result",
      state: "running",
    },
  ];
  for (const part of parts) {
    expect(sharedEvePart(part)).toEqual([{ ...part, stepIndex: 0 }]);
  }
});
it("projects the original native model without private turn identities", () => {
  const messages = sharedEveMessages([
    ...input,
    {
      type: "model.requested",
      data: { runId: "run", owner: { turnId: "turn" } },
      scope: { turnId: "turn" },
      meta: meta(4),
    },
    {
      type: "model.started",
      data: {
        modelId: "gateway/google/gemini-2.5-flash-lite",
        runId: "run",
        attempt: 0,
      },
      scope: { turnId: "turn" },
      meta: meta(5),
    },
    {
      type: "content.completed",
      data: {
        partId: "reply",
        runId: "run",
        kind: "text",
        phase: "reply",
        value: "Answer",
      },
      scope: { turnId: "turn" },
      meta: meta(6),
    },
  ]);
  expect(
    messages.find((message) => message.role === "assistant")?.metadata
  ).toEqual({ modelId: "gateway/google/gemini-2.5-flash-lite" });
  expect(JSON.stringify(messages)).not.toContain('"turnId"');
});
it("shares display-safe tool selection only through an exact known delivery", () => {
  const receipt = {
    kind: "send",
    deliveryId: "known",
    selectedTool: "webSearch",
  } satisfies EveMessageDisplayReceipt;
  expect(sharedEveMessages(input, [receipt])[0]?.metadata).toEqual({
    custom: { chatjs: { selectedTool: "webSearch" } },
  });
  expect(
    sharedEveMessages(input, [{ ...receipt, deliveryId: "other" }])[0]?.metadata
  ).toBeUndefined();
  expect(JSON.stringify(sharedEveMessages(input, [receipt]))).not.toContain(
    "deliveryId"
  );
});
