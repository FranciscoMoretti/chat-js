import { describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/lib/ai/types";
import { completeDataPart, parseAppendedMessage } from "./complete-data-part";

function message({
  id,
  parentMessageId,
  role = "assistant",
}: {
  id: string;
  parentMessageId: string | null;
  role?: ChatMessage["role"];
}): ChatMessage {
  return {
    id,
    role,
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

describe("parseAppendedMessage", () => {
  it("parses and validates a serialized chat message", async () => {
    const input = message({ id: "assistant", parentMessageId: "user" });

    await expect(parseAppendedMessage(JSON.stringify(input))).resolves.toEqual(
      input
    );
  });

  it("only revives the metadata createdAt field", async () => {
    const input: ChatMessage = {
      ...message({ id: "assistant", parentMessageId: "user" }),
      parts: [
        {
          type: "text",
          text: "complete",
          providerMetadata: {
            test: { createdAt: "leave-as-string" },
          },
        },
      ],
    };

    await expect(parseAppendedMessage(JSON.stringify(input))).resolves.toEqual(
      input
    );
  });

  it("rejects malformed or structurally invalid messages", async () => {
    await expect(parseAppendedMessage("{")).resolves.toBeNull();
    await expect(
      parseAppendedMessage(JSON.stringify({ id: "assistant" }))
    ).resolves.toBeNull();
  });
});

describe("completeDataPart", () => {
  it("reconciles a persisted completion as one tree node", async () => {
    const input = message({ id: "assistant", parentMessageId: "user" });
    const upsertMessage = vi.fn();

    await completeDataPart({
      dataPart: {
        type: "data-appendMessage",
        data: JSON.stringify(input),
      },
      thread: { upsertMessage },
    });

    expect(upsertMessage).toHaveBeenCalledExactlyOnceWith(input, "user");
  });
});
