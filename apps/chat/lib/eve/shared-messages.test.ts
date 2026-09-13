import type { EveMessagePart } from "eve/client";
import { expect, it } from "vitest";

import { sharedEveMessages, sharedEvePart } from "./shared-messages";

it("shares transcript content without authorization challenges or runtime metadata", () => {
  const messages = sharedEveMessages([
    {
      type: "message.received",
      meta: { id: "one", at: "2026-09-10T00:00:00Z" },
      data: { message: "Public question", sequence: 0, turnId: "turn" },
    },
    {
      type: "authorization.required",
      meta: { id: "two", at: "2026-09-10T00:00:01Z" },
      data: {
        description: "Connect",
        sequence: 1,
        stepIndex: 0,
        turnId: "turn",
        name: "connection",
        webhookUrl: "https://private.example/secret-code",
      },
    },
  ]);
  const json = JSON.stringify(messages);
  expect(json).toContain("Public question");
  expect(json).toContain("An account connection was requested.");
  expect(json).not.toContain("secret-code");
  expect(json).not.toContain("webhookUrl");
  expect(messages.every((message) => !Object.hasOwn(message, "metadata"))).toBe(
    true
  );
});

it("retains clarification prompts and answers without their response identifiers", () => {
  const parts = sharedEvePart({
    type: "dynamic-tool",
    toolCallId: "call",
    toolName: "ask_question",
    state: "output-available",
    input: {},
    output: {},
    toolMetadata: {
      eve: {
        kind: "tool-call",
        name: "ask_question",
        inputRequest: {
          requestId: "secret-request",
          kind: "question",
          prompt: "Which format?",
          options: [{ id: "option-private", label: "Markdown" }],
        },
        inputResponse: {
          requestId: "secret-request",
          optionId: "option-private",
          text: "Use Markdown with examples",
        },
      },
    },
  });
  const json = JSON.stringify(parts);
  expect(json).toContain("Which format?");
  expect(json).toContain("Use Markdown with examples");
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
])(
  "shared %s results retain the output without billing metadata",
  (toolName) => {
    const [part] = sharedEvePart({
      type: "dynamic-tool",
      toolName,
      toolCallId: "call",
      state: "output-available",
      input: { title: "Test", language: "javascript", code: "console.log(42)" },
      output: {
        kind: "chatjs.platform-result",
        version: 1,
        output: { message: "42", chart: "" },
        usage: { costUsd: 0.05 },
      },
    });
    expect(JSON.stringify(part)).toContain('"message":"42"');
    expect(JSON.stringify(part)).not.toContain("costUsd");
    expect(JSON.stringify(part)).not.toContain("usage");
  }
);

it("removes owner approval and execution fields while preserving every tool status", () => {
  const base = {
    toolCallId: "display-call",
    toolName: "example",
    input: { question: "Published input" },
    stepIndex: 8,
    futureRuntimeToken: "runtime-private",
    approval: { id: "owner-approval-secret", isAutomatic: true },
  };
  const cases: Extract<EveMessagePart, { type: "dynamic-tool" }>[] = [
    {
      ...base,
      type: "dynamic-tool",
      state: "output-available",
      output: { answer: "Published result" },
      approval: { ...base.approval, approved: true },
    },
    {
      ...base,
      type: "dynamic-tool",
      state: "output-error",
      errorText: "Published failure",
      approval: { ...base.approval, approved: true },
    },
    {
      ...base,
      type: "dynamic-tool",
      state: "output-denied",
      approval: {
        ...base.approval,
        approved: false,
        reason: "Published reason",
      },
    },
    { ...base, type: "dynamic-tool", state: "approval-requested" },
    {
      ...base,
      type: "dynamic-tool",
      state: "approval-responded",
      approval: { ...base.approval, approved: true },
    },
  ];
  for (const part of cases) {
    const parts = sharedEvePart(part);
    const json = JSON.stringify(parts);
    expect(json).toContain("Published input");
    expect(parts[0]).toMatchObject({ state: part.state });
    expect(json).not.toContain("owner-approval-secret");
    expect(json).not.toContain("isAutomatic");
    expect(json).not.toContain("stepIndex");
    expect(json).not.toContain("runtime-private");
    if (part.state === "output-available") {
      expect(parts[0]).toMatchObject({ output: part.output });
    }
    if (part.state === "output-error") {
      expect(parts[0]).toMatchObject({ errorText: part.errorText });
    }
    if (part.state === "output-denied") {
      expect(parts[0]).toMatchObject({
        approval: { reason: part.approval.reason },
      });
    }
  }
});

it.each([
  {
    kind: "chatjs.platform-result",
    version: 2,
    output: { message: "Unsupported version" },
    usage: { costUsd: 99 },
  },
  { kind: "chatjs.platform-result", version: 1, usage: { costUsd: 99 } },
  {
    output: "Unrecognized envelope",
    privateRuntimeToken: "secret",
    usage: { costUsd: 99 },
  },
])("does not expose malformed platform result envelopes", (output) => {
  const parts = sharedEvePart({
    type: "dynamic-tool",
    toolCallId: "call",
    toolName: "codeExecution",
    state: "output-available",
    input: { code: "1 + 1" },
    output,
  });
  expect(parts[0]).toMatchObject({
    state: "output-error",
    input: { code: "1 + 1" },
  });
  expect(JSON.stringify(parts)).not.toContain("usage");
  expect(JSON.stringify(parts)).not.toContain("secret");
  expect(JSON.stringify(parts)).not.toContain("99");
});

it("preserves streaming and partial published tool content without runtime fields", () => {
  const base = {
    toolName: "example",
    toolCallId: "call",
    input: { text: "partial" },
    stepIndex: 2,
  };
  const parts: Extract<EveMessagePart, { type: "dynamic-tool" }>[] = [
    {
      ...base,
      type: "dynamic-tool",
      state: "input-streaming",
      inputText: "partial input",
    },
    { ...base, type: "dynamic-tool", state: "input-available" },
    {
      ...base,
      type: "dynamic-tool",
      state: "output-available",
      output: "partial result",
      partial: true,
    },
  ];
  for (const part of parts) {
    const { stepIndex: _stepIndex, ...expected } = part;
    expect(sharedEvePart(part)).toEqual([expected]);
  }
});

it("projects the original native model without private turn identities", () => {
  const messages = sharedEveMessages([
    {
      type: "message.received",
      meta: { id: "q", at: "2026-09-12T00:00:00Z" },
      data: { message: "Question", sequence: 0, turnId: "turn_0" },
    },
    {
      type: "step.started",
      meta: { id: "s", at: "2026-09-12T00:00:00Z" },
      data: {
        sequence: 1,
        stepIndex: 0,
        turnId: "turn_0",
        modelId: "gateway/google/gemini-2.5-flash-lite",
      },
    },
  ]);
  expect(
    messages.find((message) => message.role === "assistant")?.metadata
  ).toEqual({ modelId: "gateway/google/gemini-2.5-flash-lite" });
  expect(JSON.stringify(messages)).not.toContain('"turnId"');
});
