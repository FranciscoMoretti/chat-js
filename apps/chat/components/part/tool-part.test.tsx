import { expect, it, vi } from "vitest";

const renderers = vi.hoisted(() => ({
  "tool-codeExecution": () => null,
  "tool-webSearch": () => null,
}));
vi.mock("@/lib/ai/tool-renderer-registry", () => ({
  isInstalledToolType: (type: string) => Object.hasOwn(renderers, type),
  toolRendererRegistry: renderers,
}));
vi.mock("./deep-research", () => ({ DeepResearch: () => null }));
vi.mock("./document-tool", () => ({ DocumentTool: () => null }));
vi.mock("./generate-image", () => ({ GenerateImage: () => null }));
vi.mock("./generate-video", () => ({ GenerateVideo: () => null }));
vi.mock("./read-document", () => ({ ReadDocument: () => null }));

import { ToolPart } from "./tool-part";

it.each(["tool-codeExecution", "tool-webSearch"] as const)(
  "routes %s through the installed item's renderer",
  (type) => {
    const element = ToolPart({
      isReadonly: false,
      messageId: "test-message",
      part: {
        type,
        toolCallId: "test-call",
        state: "input-streaming",
        input: {},
      },
    });
    expect(element?.type).toBe(renderers[type]);
  }
);
