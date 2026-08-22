import type { DataUIPart } from "ai";
import { describe, expect, it } from "vitest";
import type { ChatMessage, CustomUIDataTypes } from "@/lib/ai/types";
import { isDataPartOnMessagePath } from "./data-stream";

function messageWithDataPart(part: ChatMessage["parts"][number]): ChatMessage {
  return {
    id: "assistant-1",
    metadata: {
      activeStreamId: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      parentMessageId: "user-1",
      selectedModel: "openai/gpt-5-mini",
    },
    parts: [part],
    role: "assistant",
  };
}

describe("isDataPartOnMessagePath", () => {
  it("accepts selected-path data and rejects a hidden branch part", () => {
    const selectedPart = {
      id: "selected-update",
      type: "data-researchUpdate",
      data: {
        timestamp: 1,
        title: "Research complete",
        toolCallId: "tool-1",
        type: "completed",
      },
    } satisfies ChatMessage["parts"][number];
    const hiddenPart = {
      ...selectedPart,
      id: "hidden-update",
    } satisfies ChatMessage["parts"][number];
    const messages = [messageWithDataPart(selectedPart)];

    expect(isDataPartOnMessagePath(selectedPart, messages)).toBe(true);
    expect(isDataPartOnMessagePath(hiddenPart, messages)).toBe(false);
  });

  it("matches id-less data parts by their typed payload", () => {
    const selectedPart: DataUIPart<CustomUIDataTypes> = {
      type: "data-researchUpdate",
      data: {
        timestamp: 1,
        title: "Research complete",
        toolCallId: "tool-1",
        type: "completed",
      },
    };
    const otherPart: DataUIPart<CustomUIDataTypes> = {
      type: "data-researchUpdate",
      data: {
        timestamp: 2,
        title: "Research complete",
        toolCallId: "tool-1",
        type: "completed",
      },
    };
    const messages = [messageWithDataPart(selectedPart)];

    expect(isDataPartOnMessagePath(selectedPart, messages)).toBe(true);
    expect(isDataPartOnMessagePath(otherPart, messages)).toBe(false);
  });

  it("falls back to the payload when only the streamed part has an id", () => {
    const data = {
      timestamp: 1,
      title: "Research complete",
      toolCallId: "tool-1",
      type: "completed",
    } satisfies CustomUIDataTypes["researchUpdate"];
    const persistedPart: DataUIPart<CustomUIDataTypes> = {
      type: "data-researchUpdate",
      data,
    };
    const streamedPart: DataUIPart<CustomUIDataTypes> = {
      id: "stream-update",
      type: "data-researchUpdate",
      data,
    };

    expect(
      isDataPartOnMessagePath(streamedPart, [
        messageWithDataPart(persistedPart),
      ])
    ).toBe(true);
  });
});
