import { expect, it, vi } from "vitest";

import { ToolPart } from "./tool-part";

const renderers = vi.hoisted(() => ({
  "tool-codeExecution": () => null,
  "tool-generateImage": () => null,
  "tool-generateVideo": () => null,
  "tool-webSearch": () => null,
}));
const renderInstalledTool = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/tool-renderer-registry", () => ({
  isInstalledToolType: (type: string) => Object.hasOwn(renderers, type),
  renderInstalledTool,
  toolRendererRegistry: renderers,
}));
vi.mock("./deep-research", () => ({ DeepResearch: () => null }));
vi.mock("./document-tool", () => ({ DocumentTool: () => null }));
vi.mock("./read-document", () => ({ ReadDocument: () => null }));

it.each([
  "tool-codeExecution",
  "tool-webSearch",
  "tool-generateImage",
  "tool-generateVideo",
] as const)("routes %s through the installed item's renderer", (type) => {
  ToolPart({
    isReadonly: false,
    messageId: "test-message",
    part: {
      input: {},
      state: "input-streaming",
      toolCallId: "test-call",
      type,
    },
  });
  expect(renderInstalledTool).toHaveBeenCalledWith(type, {
    isReadonly: false,
    messageId: "test-message",
    tool: expect.objectContaining({ type }),
  });
});
