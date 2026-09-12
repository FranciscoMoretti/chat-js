import type { DataUIPart } from "ai";
import { describe, expect, it } from "vitest";

import { gatewayModelDefaults } from "@/lib/ai/gateway-model-defaults";
import type { ChatMessage, CustomUIDataTypes } from "@/lib/ai/types";

import { isDataPartOnMessagePath } from "./data-stream";

const messageWithDataPart = (
  part: ChatMessage["parts"][number]
): ChatMessage => ({
  id: "assistant-1",
  metadata: {
    activeStreamId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    parentMessageId: "user-1",
    selectedModel: gatewayModelDefaults.workflows.chat,
  },
  parts: [part],
  role: "assistant",
});
describe("isDataPartOnMessagePath", () => {
  it("accepts selected-path data and rejects a hidden branch part", () => {
    const selectedPart = {
      data: {
        timestamp: 1,
        title: "Research complete",
        toolCallId: "tool-1",
        type: "completed",
      },
      id: "selected-update",
      type: "data-researchUpdate",
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
      data: {
        timestamp: 1,
        title: "Research complete",
        toolCallId: "tool-1",
        type: "completed",
      },
      type: "data-researchUpdate",
    };
    const otherPart: DataUIPart<CustomUIDataTypes> = {
      data: {
        timestamp: 2,
        title: "Research complete",
        toolCallId: "tool-1",
        type: "completed",
      },
      type: "data-researchUpdate",
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
      data,
      type: "data-researchUpdate",
    };
    const streamedPart: DataUIPart<CustomUIDataTypes> = {
      data,
      id: "stream-update",
      type: "data-researchUpdate",
    };
    expect(
      isDataPartOnMessagePath(streamedPart, [
        messageWithDataPart(persistedPart),
      ])
    ).toBe(true);
  });
});
