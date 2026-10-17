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
  { requestId: "request", optionId: "approve" },
  { requestId: "request", optionId: "cancel" },
  { requestId: "request", text: "answer" },
  { requestId: "request", optionId: "other", text: "answer" },
  { requestId: "request" },
  { requestId: "request", text: "" },
])("preserves the existing input response shape %j", (response) => {
  expect(
    responseSchema().safeParse({ inputResponses: [response] }).success
  ).toBe(true);
});

test.each([
  { requestId: "" },
  { requestId: 1 },
  { requestId: "request", optionId: null },
  { requestId: "request", text: 1 },
  { requestId: "request", responder: "owner" },
  { requestId: "request", approval: true },
])("rejects malformed or authority-bearing input response %j", (response) => {
  expect(
    responseSchema().safeParse({ inputResponses: [response] }).success
  ).toBe(false);
});

test("keeps input responses bounded and separate from message commands", () => {
  const schema = responseSchema();
  expect(schema.safeParse({ inputResponses: [] }).success).toBe(false);
  expect(
    schema.safeParse({
      inputResponses: Array.from({ length: 17 }, () => ({
        requestId: "request",
      })),
    }).success
  ).toBe(false);
  expect(
    schema.safeParse({
      inputResponses: [{ requestId: "request" }],
      message: "hello",
    }).success
  ).toBe(false);
});
