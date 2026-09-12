import type * as AI from "ai";
import { beforeEach, expect, it, vi } from "vitest";

import { CostAccumulator } from "@/lib/credits/cost-accumulator";

import { generateImageTool } from "./tool";

const mocks = vi.hoisted(() => ({
  downloadFile: vi.fn(),
  fetchModels: vi.fn(),
  generateImage: vi.fn(),
  generateText: vi.fn(),
  imageModel: vi.fn(),
  modelDefinition: vi.fn(),
  uploadFile: vi.fn(),
}));
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof AI>()),
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
    ai: { tools: { image: { default: "test-image", enabled: true } } },
  },
}));
vi.mock("@/lib/file-storage", () => ({
  downloadFile: mocks.downloadFile,
  uploadFile: mocks.uploadFile,
}));
vi.mock("@/lib/ai/models", () => ({
  fetchModels: mocks.fetchModels,
}));
vi.mock("@/lib/logger", () => ({
  createModuleLogger: () => ({ debug: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));
vi.mock("@/lib/url", () => ({ getBaseUrl: () => "https://example.com" }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchModels.mockResolvedValue([
    { id: "test-image", pricing: { image: "0.04" } },
  ]);
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
      context: {
        attachments: [
          {
            mediaType: "image/png",
            type: "file",
            url: "data:image/png;base64,YXR0YWNobWVudA==",
          },
        ],
        costAccumulator,
        lastGeneratedImage: {
          imageUrl: "data:image/png;base64,cHJldmlvdXM=",
          name: "previous.png",
        },
      },
      messages: [],
      toolCallId: "edit",
    }
  );
  expect(mocks.generateImage.mock.calls[0][0].prompt).toEqual({
    images: [Buffer.from("previous"), Buffer.from("attachment")],
    text: "Add clouds",
  });
  expect(mocks.uploadFile).toHaveBeenCalledWith(
    expect.any(String),
    Buffer.from("image"),
    "image/png"
  );
  expect(await costAccumulator.getTotalCost()).toBe(4);
  expect(costAccumulator.getEntries()).toEqual([
    {
      count: 1,
      modelId: "test-image",
      source: "generateImage-traditional",
      type: "image",
      usage: { inputTokens: 10, outputTokens: 20 },
    },
  ]);
});

it("generates without optional request services", async () => {
  if (!generateImageTool.execute) {
    throw new Error("Missing execution");
  }
  const result = await generateImageTool.execute(
    { prompt: "Blue sky" },
    { context: {}, messages: [], toolCallId: "new" }
  );
  expect(mocks.generateImage.mock.calls[0][0].prompt).toBe("Blue sky");
  expect(result).toEqual({
    imageUrl: "https://example.com/result.png",
    prompt: "Blue sky",
  });
});

it("uses the selected multimodal model from request context", async () => {
  mocks.modelDefinition.mockResolvedValue({
    apiModelId: "google/image-model",
    id: "google/image-model-reasoning",
    output: { image: true },
  });
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
      context: {
        costAccumulator,
        selectedModel: "google/image-model-reasoning",
      },
      messages: [],
      toolCallId: "selected",
    }
  );
  expect(mocks.imageModel).toHaveBeenCalledWith("google/image-model");
  expect(mocks.generateImage).not.toHaveBeenCalled();
  expect(costAccumulator.getEntries()).toEqual([
    {
      modelId: "google/image-model-reasoning",
      source: "generateImage-multimodal",
      type: "llm",
      usage: { inputTokens: 3, outputTokens: 4 },
    },
  ]);
});

it.each([
  "http://127.0.0.1/private",
  "https://attacker.example/image.png",
  "https://attacker.example/api/files/content?key=abcdefghijklmnopqrstuvwx.png",
])("rejects unapproved image URL %s", async (imageUrl) => {
  if (!generateImageTool.execute) {
    throw new Error("Missing execution");
  }
  await expect(
    generateImageTool.execute(
      { prompt: "Edit" },
      {
        context: { lastGeneratedImage: { imageUrl, name: "image" } },
        messages: [],
        toolCallId: "bad",
      }
    )
  ).rejects.toThrow("only accepts uploaded");
  expect(mocks.downloadFile).not.toHaveBeenCalled();
  expect(mocks.generateImage).not.toHaveBeenCalled();
});

it("reads uploaded images directly from storage", async () => {
  mocks.downloadFile.mockResolvedValue(new Blob(["stored"]));
  if (!generateImageTool.execute) {
    throw new Error("Missing execution");
  }
  await generateImageTool.execute(
    { prompt: "Edit" },
    {
      context: {
        lastGeneratedImage: {
          imageUrl: "/api/files/content?key=abcdefghijklmnopqrstuvwx.png",
          name: "image",
        },
      },
      messages: [],
      toolCallId: "stored",
    }
  );
  expect(mocks.downloadFile).toHaveBeenCalledWith(
    "abcdefghijklmnopqrstuvwx.png"
  );
});

it("finalizes known costs when the image pricing catalog is unavailable", async () => {
  mocks.fetchModels.mockRejectedValue(new Error("Catalog unavailable"));
  const accumulator = new CostAccumulator();
  accumulator.addImageCost("test-image", 1, {}, "generateImage");
  accumulator.addAPICost("otherTool", 5);
  expect(await accumulator.getTotalCost()).toBe(5);
  expect(accumulator.getEntries()).toHaveLength(2);
});
