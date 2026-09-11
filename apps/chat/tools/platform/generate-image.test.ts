import { beforeEach, expect, test, vi } from "vitest";
import { executeEveTool } from "../../lib/eve/adapt-tool";
import { executeEvePlatformTool } from "../../lib/eve/platform-tools";
import { generateImageTool } from "./generate-image";

const mocks = vi.hoisted(() => ({
  generateImage: vi.fn(),
  generateText: vi.fn(),
  download: vi.fn(),
  upload: vi.fn(),
  enabled: true,
}));
vi.mock("ai", async (original) => ({
  ...(await original<typeof import("ai")>()),
  generateImage: mocks.generateImage,
  generateText: mocks.generateText,
}));
vi.mock("../../lib/env", () => ({ env: {} }));
vi.mock("../../lib/config", () => ({
  config: {
    ai: {
      tools: {
        codeExecution: { enabled: false },
        video: { enabled: false },
        webSearch: { enabled: false },
        image: {
          get enabled() {
            return mocks.enabled;
          },
          default: "test/dedicated",
        },
      },
    },
  },
}));
vi.mock("../../lib/ai/active-gateway", () => ({
  getActiveGateway: () => ({
    fetchModels: async () => [
      {
        id: "test/multimodal",
        type: "language",
        output: { image: true },
        pricing: { input: "0.0001", output: "0.0002" },
      },
    ],
    createLanguageModel: (id: string) => id,
    createImageModel: (id: string) => id,
  }),
}));
vi.mock("../../lib/ai/to-model-data", () => ({
  toModelData: (model: unknown) => model,
}));
vi.mock("../../lib/file-storage", () => ({
  downloadFile: mocks.download,
  uploadFile: mocks.upload,
}));
const imageUrl = "/api/files/content?key=abcdefghijklmnopqrstuvwx.png";
const context = {
  callId: "image-test",
  abortSignal: new AbortController().signal,
};
const input = { prompt: "Make the sky blue" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enabled = true;
  mocks.download.mockResolvedValue(
    new File(["saved-reference"], "reference.png", { type: "image/png" })
  );
  mocks.upload.mockResolvedValue({ url: imageUrl });
  mocks.generateImage.mockResolvedValue({
    images: [{ base64: "aW1hZ2U=" }],
    usage: { inputTokens: 4, outputTokens: 8 },
  });
  mocks.generateText.mockResolvedValue({
    files: [{ mediaType: "image/png", uint8Array: new Uint8Array([1]) }],
    usage: { inputTokens: 4, outputTokens: 8 },
  });
});

test.each([
  "test/multimodal",
  undefined,
])("image edits send storage bytes to %s rather than a localhost URL", async (selectedModel) => {
  const cost = { addLLMCost: vi.fn() };
  const definition = generateImageTool({
    selectedModel,
    costAccumulator: cost,
    lastGeneratedImage: { imageUrl, name: "reference.png" },
    attachments: [
      {
        type: "file",
        mediaType: "image/png",
        url: "data:image/png;base64,YXR0YWNobWVudA==",
      },
    ],
  });
  const results = await Array.fromAsync(
    executeEveTool(definition, input, context, [])
  );
  expect(mocks.download).toHaveBeenCalledWith("abcdefghijklmnopqrstuvwx.png");
  const images = [Buffer.from("saved-reference"), Buffer.from("attachment")];
  if (selectedModel) {
    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: selectedModel,
        abortSignal: context.abortSignal,
        messages: [
          {
            role: "user",
            content: [
              ...images.map((image) => ({ type: "image", image })),
              {
                type: "text",
                text: `Based on the provided image(s), ${input.prompt}`,
              },
            ],
          },
        ],
      })
    );
  } else {
    expect(mocks.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        abortSignal: context.abortSignal,
        prompt: { text: input.prompt, images },
      })
    );
  }
  expect(results).toEqual([{ imageUrl, prompt: input.prompt }]);
  expect(cost.addLLMCost).toHaveBeenCalledOnce();
});

test.each([
  "test/multimodal",
  undefined,
])("upload failure keeps usage from %s", async (selectedModel) => {
  const cost = { addLLMCost: vi.fn() };
  mocks.upload.mockRejectedValue(new Error("Upload failed"));
  await expect(
    executeEveTool(
      generateImageTool({ selectedModel, costAccumulator: cost }),
      input,
      context,
      []
    ).next()
  ).rejects.toThrow("Upload failed");
  expect(cost.addLLMCost).toHaveBeenCalledWith(
    selectedModel ?? "test/dedicated",
    expect.objectContaining({ inputTokens: 4, outputTokens: 8 }),
    expect.any(String)
  );
});

test("disabled image generation cannot use a selected multimodal model", async () => {
  mocks.enabled = false;
  await expect(
    executeEveTool(
      generateImageTool({ selectedModel: "test/multimodal" }),
      input,
      context,
      []
    ).next()
  ).rejects.toThrow("not enabled");
  expect(mocks.generateText).not.toHaveBeenCalled();
});

test("reference loading refuses arbitrary network URLs", async () => {
  await expect(
    executeEveTool(
      generateImageTool({
        lastGeneratedImage: {
          imageUrl: "http://127.0.0.1/private",
          name: "reference",
        },
      }),
      input,
      context,
      []
    ).next()
  ).rejects.toThrow("ChatJS image upload");
  expect(mocks.generateImage).not.toHaveBeenCalled();
});

test("cancelling image generation aborts the provider request", async () => {
  const started = Promise.withResolvers<AbortSignal>();
  mocks.generateImage.mockImplementation(
    ({ abortSignal }: { abortSignal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        started.resolve(abortSignal);
        abortSignal.addEventListener(
          "abort",
          () => reject(abortSignal.reason),
          { once: true }
        );
      })
  );
  const controller = new AbortController();
  const running = executeEveTool(
    generateImageTool(),
    input,
    { ...context, abortSignal: controller.signal },
    []
  ).next();
  const rejected = expect(running).rejects.toThrow();
  const signal = await started.promise;
  controller.abort();
  await rejected;
  expect(signal.aborted).toBe(true);
  expect(mocks.upload).not.toHaveBeenCalled();
});

test("native image results include nested provider cost and keep output when pricing is unknown", async () => {
  const known = await Array.fromAsync(
    executeEvePlatformTool(
      "generateImage",
      input,
      context,
      [],
      "test/multimodal"
    )
  );
  expect(known.at(-1)).toMatchObject({
    output: { imageUrl, prompt: input.prompt },
    usage: { costUsd: 0.002 },
  });
  const unknown = await Array.fromAsync(
    executeEvePlatformTool("generateImage", input, context, [])
  );
  expect(unknown.at(-1)?.output).toEqual({ imageUrl, prompt: input.prompt });
  expect(unknown.at(-1)?.usage.costUsd).toBeUndefined();
});

vi.mock("../../lib/eve/generated-files", () => ({
  eveGeneratedFileUploader: () => mocks.upload,
}));
