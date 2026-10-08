import type { EveMessagePart } from "eve/client";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { expect, it } from "vitest";
/* oxlint-enable sort-imports */

import { sharedEveMessages, sharedEvePart } from "./shared-messages";

it("shares transcript content without authorization challenges or runtime metadata", () => {
  const messages = sharedEveMessages([
    {
      data: { message: "Public question", sequence: 0, turnId: "turn" },
      meta: { at: "2026-09-10T00:00:00Z", id: "one" },
      type: "message.received",
    },
    {
      data: {
        description: "Connect",
        name: "connection",
        sequence: 1,
        stepIndex: 0,
        turnId: "turn",
        webhookUrl: "https://private.example/secret-code",
      },
      meta: { at: "2026-09-10T00:00:01Z", id: "two" },
      type: "authorization.required",
    },
  ]);
  const json = JSON.stringify(messages);
  expect(json).toContain("Public question");
  expect(json).toContain("An account connection was requested.");
  expect(json).not.toContain("secret-code");
  expect(json).not.toContain("webhookUrl");
  expect(
    messages.every(
      (message: Readonly<object>) => !Object.hasOwn(message, "metadata")
    )
  ).toBe(true);
});

it("retains clarification prompts and answers without their response identifiers", () => {
  const parts = sharedEvePart({
    input: {},
    output: {},
    state: "output-available",
    toolCallId: "call",
    toolMetadata: {
      eve: {
        inputRequest: {
          kind: "question",
          options: [{ id: "option-private", label: "Markdown" }],
          prompt: "Which format?",
          requestId: "secret-request",
        },
        inputResponse: {
          optionId: "option-private",
          requestId: "secret-request",
          text: "Use Markdown with examples",
        },
        kind: "tool-call",
        name: "ask_question",
      },
    },
    toolName: "ask_question",
    type: "dynamic-tool",
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
  "externalPaidTool",
])(
  "shared %s results retain the output without billing metadata",
  (toolName) => {
    const [part] = sharedEvePart({
      input: { code: "console.log(42)", language: "javascript", title: "Test" },
      output: {
        kind: "chatjs.tool-result",
        output: { chart: "", message: "42" },
        status: "success",
        usage: { costUsd: 0.05 },
        version: 1,
      },
      state: "output-available",
      toolCallId: "call",
      toolName,
      type: "dynamic-tool",
    });
    expect(JSON.stringify(part)).toContain('"message":"42"');
    expect(JSON.stringify(part)).not.toContain("costUsd");
    expect(JSON.stringify(part)).not.toContain("usage");
  }
);

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers --
 * max-lines-per-function (#510): it("removes owner approval and execution fields while preserving every tool status") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): it("removes owner approval and execution fields while preserving every tool status") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it("removes owner approval and execution fields while preserving every tool status") uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("removes owner approval and execution fields while preserving every tool status", () => {
  const base = {
    approval: { id: "owner-approval-secret", isAutomatic: true },
    futureRuntimeToken: "runtime-private",
    input: { question: "Published input" },
    stepIndex: 8,
    toolCallId: "display-call",
    toolName: "example",
  };
  const cases: Extract<EveMessagePart, { type: "dynamic-tool" }>[] = [
    {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing base own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...base,
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing base.approval own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      approval: { ...base.approval, approved: true },
      output: { answer: "Published result" },
      state: "output-available",
      type: "dynamic-tool",
    },
    {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing base own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...base,
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing base.approval own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      approval: { ...base.approval, approved: true },
      errorText: "Published failure",
      state: "output-error",
      type: "dynamic-tool",
    },
    {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing base own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...base,
      approval: {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing base.approval own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...base.approval,
        approved: false,
        reason: "Published reason",
      },
      state: "output-denied",
      type: "dynamic-tool",
    },
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing base own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...base, state: "approval-requested", type: "dynamic-tool" },
    {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing base own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...base,
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing base.approval own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      approval: { ...base.approval, approved: true },
      state: "approval-responded",
      type: "dynamic-tool",
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
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it.each([ { kind: "chatjs.tool-result", output: { message: "Unsupported version" }, s uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
    input: { code: "1 + 1" },
    output,
    state: "output-available",
    toolCallId: "call",
    toolName: "codeExecution",
    type: "dynamic-tool",
  });
  expect(parts[0]).toMatchObject({
    input: { code: "1 + 1" },
    state: "output-error",
  });
  expect(JSON.stringify(parts)).not.toContain("usage");
  expect(JSON.stringify(parts)).not.toContain("secret");
  expect(JSON.stringify(parts)).not.toContain("99");
});
/* oxlint-enable no-magic-numbers */

it("preserves streaming and partial published tool content without runtime fields", () => {
  const base = {
    input: { text: "partial" },
    stepIndex: 2,
    toolCallId: "call",
    toolName: "example",
  };
  const parts: Extract<EveMessagePart, { type: "dynamic-tool" }>[] = [
    {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing base own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...base,
      inputText: "partial input",
      state: "input-streaming",
      type: "dynamic-tool",
    },
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing base own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...base, state: "input-available", type: "dynamic-tool" },
    {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing base own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...base,
      output: "partial result",
      partial: true,
      state: "output-available",
      type: "dynamic-tool",
    },
  ];
  for (const part of parts) {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding expected excludes stepIndex from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    const { stepIndex: _stepIndex, ...expected } = part;
    expect(sharedEvePart(part)).toEqual([expected]);
  }
});

it("projects the original native model without private turn identities", () => {
  const messages = sharedEveMessages([
    {
      data: { message: "Question", sequence: 0, turnId: "turn_0" },
      meta: { at: "2026-09-12T00:00:00Z", id: "q" },
      type: "message.received",
    },
    {
      data: {
        modelId: "gateway/google/gemini-2.5-flash-lite",
        sequence: 1,
        stepIndex: 0,
        turnId: "turn_0",
      },
      meta: { at: "2026-09-12T00:00:00Z", id: "s" },
      type: "step.started",
    },
  ]);
  expect(
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading metadata from messages.find(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    messages.find(
      (message: { readonly role: string }) => message.role === "assistant"
    )?.metadata
  ).toEqual({ modelId: "gateway/google/gemini-2.5-flash-lite" });
  expect(JSON.stringify(messages)).not.toContain('"turnId"');
});
