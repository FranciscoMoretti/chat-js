import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/lib/ai/types";
import { mergeCompletedMessageIntoVisiblePath } from "./use-complete-data-part";

function message({
  id,
  parentMessageId,
}: {
  id: string;
  parentMessageId: string | null;
}): ChatMessage {
  return {
    id,
    role: "assistant",
    parts: [{ type: "text", text: id }],
    metadata: {
      activeStreamId: null,
      createdAt: new Date(),
      isPrimaryParallel: null,
      parallelGroupId: null,
      parallelIndex: null,
      parentMessageId,
      selectedModel: "openai/gpt-4o-mini",
    },
  };
}

describe("mergeCompletedMessageIntoVisiblePath", () => {
  it("does not attach a completion from a hidden sibling branch", () => {
    const visibleUser = message({ id: "visible-user", parentMessageId: null });
    const visibleAssistant = message({
      id: "visible-assistant",
      parentMessageId: visibleUser.id,
    });
    const hiddenCompletion = message({
      id: "hidden-assistant",
      parentMessageId: "hidden-user",
    });

    expect(
      mergeCompletedMessageIntoVisiblePath(
        [visibleUser, visibleAssistant],
        hiddenCompletion
      )
    ).toBeNull();
  });

  it("replaces an existing partial message without changing its position", () => {
    const user = message({ id: "user", parentMessageId: null });
    const partial = message({ id: "assistant", parentMessageId: user.id });
    const completed = {
      ...partial,
      parts: [{ type: "text" as const, text: "complete" }],
    };

    expect(
      mergeCompletedMessageIntoVisiblePath([user, partial], completed)
    ).toEqual([user, completed]);
  });
});
