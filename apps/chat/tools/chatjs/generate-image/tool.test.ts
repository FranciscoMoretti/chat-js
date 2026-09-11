import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateImage: vi.fn(),
  generateText: vi.fn(),
  modelDefinition: vi.fn(),
  imageModel: vi.fn(),
  uploadFile: vi.fn(),
}));
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateImage: mocks.generateImage,
  generateText: mocks.generateText,
}));
vi.mock("@/lib/ai/app-models", () => ({
  getAppModelDefinition: mocks.modelDefinition,
}));
vi.mock("@/lib/ai/providers", () => ({
  getImageModel: () => "image-model",
  getMultimodalImageModel: mocks.imageModel,
}));
vi.mock("@/lib/config", () => ({
  config: {
    ai: { tools: { image: { enabled: true, default: "test-image" } } },
  },
}));
vi.mock("@/lib/file-storage", () => ({ uploadFile: mocks.uploadFile }));
vi.mock("@/lib/logger", () => ({
  createModuleLogger: () => ({ debug: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/url", () => ({ getBaseUrl: () => "https://example.com" }));

import { CostAccumulator } from "@/lib/credits/cost-accumulator";
import { generateImageTool } from "./tool";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.modelDefinition.mockResolvedValue({ output: { image: false } });
  mocks.generateImage.mockResolvedValue({
    images: [{ base64: "aW1hZ2U=" }],
    usage: { inputTokens: 10, outputTokens: 20 },
  });
  mocks.uploadFile.mockResolvedValue({ url: "https://example.com/result.png" });
});

it("uses request attachments and prior image for editing and records model usage", async () => {
  const costAccumulator = new CostAccumulator();
  if (!generateImageTool.execute) {
    throw new Error("Missing execution");
  }
  await generateImageTool.execute(
    { prompt: "Add clouds" },
    {
      toolCallId: "edit",
      messages: [],
      context: {
        costAccumulator,
        attachments: [
          {
            type: "file",
            mediaType: "image/png",
            url: "data:image/png;base64,YXR0YWNobWVudA==",
          },
        ],
        lastGeneratedImage: {
          imageUrl: "data:image/png;base64,cHJldmlvdXM=",
          name: "previous.png",
        },
      },
    }
  );
  expect(mocks.generateImage.mock.calls[0][0].prompt).toEqual({
    text: "Add clouds",
    images: [Buffer.from("previous"), Buffer.from("attachment")],
  });
  expect(mocks.uploadFile).toHaveBeenCalledWith(
    expect.any(String),
    Buffer.from("image"),
    "image/png"
  );
  expect(costAccumulator.getEntries()).toEqual([
    {
      type: "llm",
      modelId: "test-image",
      usage: { inputTokens: 10, outputTokens: 20 },
      source: "generateImage-traditional",
    },
  ]);
});

it("generates without optional request services", async () => {
  if (!generateImageTool.execute) {
    throw new Error("Missing execution");
  }
  const result = await generateImageTool.execute(
    { prompt: "Blue sky" },
    { toolCallId: "new", messages: [], context: {} }
  );
  expect(mocks.generateImage.mock.calls[0][0].prompt).toBe("Blue sky");
  expect(result).toEqual({
    imageUrl: "https://example.com/result.png",
    prompt: "Blue sky",
  });
});

it("uses the selected multimodal model from request context", async () => {
  mocks.modelDefinition.mockResolvedValue({ output: { image: true } });
  mocks.imageModel.mockReturnValue("selected-model");
  mocks.generateText.mockResolvedValue({
    files: [{ mediaType: "image/png", uint8Array: Buffer.from("image") }],
    usage: { inputTokens: 3, outputTokens: 4 },
  });
  const costAccumulator = new CostAccumulator();
  if (!generateImageTool.execute) {
    throw new Error("Missing execution");
  }
  await generateImageTool.execute(
    { prompt: "Blue sky" },
    {
      toolCallId: "selected",
      messages: [],
      context: { selectedModel: "google/image-model", costAccumulator },
    }
  );
  expect(mocks.imageModel).toHaveBeenCalledWith("google/image-model");
  expect(mocks.generateImage).not.toHaveBeenCalled();
  expect(costAccumulator.getEntries()).toEqual([
    {
      type: "llm",
      modelId: "google/image-model",
      usage: { inputTokens: 3, outputTokens: 4 },
      source: "generateImage-multimodal",
    },
  ]);
});
