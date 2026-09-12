import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateImage: vi.fn(),
  generateText: vi.fn(),
  modelDefinition: vi.fn(),
  imageModel: vi.fn(),
  uploadFile: vi.fn(),
  downloadFile: vi.fn(),
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
vi.mock("@/lib/file-storage", () => ({
  uploadFile: mocks.uploadFile,
  downloadFile: mocks.downloadFile,
}));
vi.mock("@/lib/ai/models", () => ({
  fetchModels: async () => [{ id: "test-image", pricing: { image: "0.04" } }],
}));
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
  expect(await costAccumulator.getTotalCost()).toBe(4);
  expect(costAccumulator.getEntries()).toEqual([
    {
      type: "image",
      count: 1,
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
  mocks.modelDefinition.mockResolvedValue({
    id: "google/image-model-reasoning",
    apiModelId: "google/image-model",
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
      toolCallId: "selected",
      messages: [],
      context: {
        selectedModel: "google/image-model-reasoning",
        costAccumulator,
      },
    }
  );
  expect(mocks.imageModel).toHaveBeenCalledWith("google/image-model");
  expect(mocks.generateImage).not.toHaveBeenCalled();
  expect(costAccumulator.getEntries()).toEqual([
    {
      type: "llm",
      modelId: "google/image-model-reasoning",
      usage: { inputTokens: 3, outputTokens: 4 },
      source: "generateImage-multimodal",
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
        toolCallId: "bad",
        messages: [],
        context: { lastGeneratedImage: { imageUrl, name: "image" } },
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
      toolCallId: "stored",
      messages: [],
      context: {
        lastGeneratedImage: {
          imageUrl: "/api/files/content?key=abcdefghijklmnopqrstuvwx.png",
          name: "image",
        },
      },
    }
  );
  expect(mocks.downloadFile).toHaveBeenCalledWith(
    "abcdefghijklmnopqrstuvwx.png"
  );
});
