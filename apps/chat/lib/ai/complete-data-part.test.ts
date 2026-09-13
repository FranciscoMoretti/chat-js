import { describe, expect, it, vi } from "vitest";

import { gatewayModelDefaults } from "@/lib/ai/gateway-model-defaults";
import type { ChatMessage } from "@/lib/ai/types";

import { completeDataPart, parseAppendedMessage } from "./complete-data-part";

const message = ({
  id,
  parentMessageId,
  role = "assistant",
}: {
  id: string;
  parentMessageId: string | null;
  role?: ChatMessage["role"];
}): ChatMessage => ({
  id,
  metadata: {
    activeStreamId: null,
    createdAt: new Date(),
    isPrimaryParallel: null,
    parallelGroupId: null,
    parallelIndex: null,
    parentMessageId,
    selectedModel: gatewayModelDefaults.workflows.chat,
  },
  parts: [{ text: id, type: "text" }],
  role,
});

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
          providerMetadata: {
            test: { createdAt: "leave-as-string" },
          },
          text: "complete",
          type: "text",
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
        data: JSON.stringify(input),
        type: "data-appendMessage",
      },
      thread: { upsertMessage },
    });

    expect(upsertMessage).toHaveBeenCalledExactlyOnceWith(input, "user");
  });
});
