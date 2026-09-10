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
