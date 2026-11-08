import { expect, test } from "vitest";
import { parseSessionRequest } from "./request-policy";

const responseSchema = () => {
  const request = parseSessionRequest("/eve/v1/session/native", "POST");
  if (request === null) {
    throw new Error("Expected the session command schema");
  }
  return request.schema;
};

test.each([
  { interactionId: "request", optionId: "approve" },
  { interactionId: "request", optionId: "cancel" },
  { interactionId: "request", text: "answer" },
  { interactionId: "request", optionId: "other", text: "answer" },
  { interactionId: "request" },
  { interactionId: "request", text: "" },
])("preserves the native answer shape %j", (response) => {
  expect(responseSchema().safeParse({ answers: [response] }).success).toBe(
    true
  );
});

test.each([
  { interactionId: "" },
  { interactionId: 1 },
  { interactionId: "request", optionId: null },
  { interactionId: "request", text: 1 },
  { interactionId: "request", responder: "owner" },
  { interactionId: "request", approval: true },
])("rejects malformed or authority-bearing input response %j", (response) => {
  expect(responseSchema().safeParse({ answers: [response] }).success).toBe(
    false
  );
});

test("keeps input responses bounded and separate from message commands", () => {
  const schema = responseSchema();
  expect(schema.safeParse({ answers: [] }).success).toBe(false);
  expect(
    schema.safeParse({
      answers: Array.from({ length: 17 }, () => ({
        interactionId: "request",
      })),
    }).success
  ).toBe(false);
  expect(
    schema.safeParse({
      answers: [{ interactionId: "request" }],
      message: "hello",
    }).success
  ).toBe(false);
});
