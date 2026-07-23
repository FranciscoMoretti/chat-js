import assert from "node:assert/strict";
import { describe, it } from "vitest";
import type { ChatMessage } from "@/lib/ai/types";
import {
  clearResponseActiveStream,
  isPendingResponseStream,
} from "./stop-response";

function createMessage(id: string, activeStreamId: string | null): ChatMessage {
  return {
    id,
    metadata: {
      activeStreamId,
      createdAt: new Date(0),
      isPrimaryParallel: null,
      parallelGroupId: null,
      parallelIndex: null,
      parentMessageId: null,
      selectedModel: "openai/gpt-5-nano",
      selectedTool: undefined,
    },
    parts: [],
    role: "assistant",
  };
}

describe("stop response", () => {
  it("optimistically marks only the selected response as inactive", () => {
    const selected = createMessage("selected", "stream-1");
    const sibling = createMessage("sibling", "stream-2");

    const messages = clearResponseActiveStream(
      [selected, sibling],
      selected.id
    );

    assert.equal(messages[0]?.metadata.activeStreamId, null);
    assert.equal(messages[1], sibling);
  });

  it("distinguishes queued responses without server rows", () => {
    assert.equal(isPendingResponseStream("pending:response-1"), true);
    assert.equal(isPendingResponseStream("stream-1"), false);
    assert.equal(isPendingResponseStream(null), false);
  });
});
