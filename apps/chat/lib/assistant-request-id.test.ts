import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { createAssistantRequestMessageId } from "./assistant-request-id";

const requestIdentity = {
  chatId: "019fc3c8-b88c-7771-a7c9-c3d12172ac00",
  parallelGroupId: "019fc3c8-c510-7664-b886-82966aeb94f2",
  parallelIndex: 1,
  requestId: "019fc3c8-d4bf-755c-939b-c3029b08c5d1",
  selectedModelId: "openai/gpt-5-nano",
  userMessageId: "019fc3c8-e02b-733c-9b52-43e4d7d343ef",
} as const;

describe("createAssistantRequestMessageId", () => {
  it("returns the same message ID when an HTTP request is replayed", () => {
    assert.equal(
      createAssistantRequestMessageId(requestIdentity),
      createAssistantRequestMessageId(requestIdentity)
    );
  });

  it("returns a new message ID for a new logical regeneration", () => {
    assert.notEqual(
      createAssistantRequestMessageId(requestIdentity),
      createAssistantRequestMessageId({
        ...requestIdentity,
        requestId: "019fc3c8-f0ee-722d-9c00-b4a5985693eb",
      })
    );
  });
});
