import type * as AI from "ai";
import { beforeEach, expect, it, vi } from "vitest";

import { CostAccumulator } from "@/lib/credits/cost-accumulator";

import { generateVideoTool } from "./tool";

const MP4_EXTENSION = /\.mp4$/u;

const mocks = vi.hoisted(() => ({
  generateVideo: vi.fn(),
  getVideoModel: vi.fn(),
  model: vi.fn(),
  uploadFile: vi.fn(),
}));
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof AI>()),
  experimental_generateVideo: mocks.generateVideo,
}));
vi.mock("@/lib/ai/app-models", () => ({ getAppModelDefinition: mocks.model }));
vi.mock("@/lib/ai/providers", () => ({ getVideoModel: mocks.getVideoModel }));
vi.mock("@/lib/config", () => ({
  config: {
    ai: { tools: { video: { default: "default-video", enabled: true } } },
  },
}));
vi.mock("@/lib/file-storage", () => ({ uploadFile: mocks.uploadFile }));
vi.mock("@/lib/logger", () => ({
  createModuleLogger: () => ({ debug: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.model.mockResolvedValue({ output: { video: false } });
  mocks.generateVideo.mockResolvedValue({
    video: { mediaType: "video/mp4", uint8Array: Buffer.from("video") },
  });
  mocks.uploadFile.mockResolvedValue({
    url: "/api/files/content?key=generated",
  });
  mocks.getVideoModel.mockReturnValue("sdk-model");
});

it("uses the selected model's provider ID and records the existing estimate", async () => {
  mocks.model.mockResolvedValue({
    apiModelId: "selected",
    id: "selected-reasoning",
    output: { video: true },
  });
  const costAccumulator = new CostAccumulator();
  if (!generateVideoTool.execute) {
    throw new Error("Missing execution");
  }
  const result = await generateVideoTool.execute(
    { aspectRatio: "9:16", durationSeconds: 3, prompt: "Ocean" },
    {
      context: { costAccumulator, selectedModel: "selected-reasoning" },
      messages: [],
      toolCallId: "video",
    }
  );
  expect(mocks.model).toHaveBeenCalledWith("selected-reasoning");
  expect(mocks.getVideoModel).toHaveBeenCalledWith("selected");
  expect(mocks.generateVideo).toHaveBeenCalledWith(
    expect.objectContaining({
      aspectRatio: "9:16",
      duration: 3,
      prompt: "Ocean",
    })
  );
  expect(mocks.uploadFile).toHaveBeenCalledWith(
    expect.stringMatching(MP4_EXTENSION),
    Buffer.from("video"),
    "video/mp4"
  );
  expect(result).toEqual({
    prompt: "Ocean",
    videoUrl: "/api/files/content?key=generated",
  });
  expect(await costAccumulator.getTotalCost()).toBe(50);
});

it("works without optional request services", async () => {
  if (!generateVideoTool.execute) {
    throw new Error("Missing execution");
  }
  await generateVideoTool.execute(
    { prompt: "Ocean" },
    { context: {}, messages: [], toolCallId: "video" }
  );
  expect(mocks.getVideoModel).toHaveBeenCalledWith("default-video");
  expect(mocks.generateVideo).toHaveBeenCalledWith(
    expect.objectContaining({ aspectRatio: "16:9", duration: 5 })
  );
});

it("does not upload or charge when no video is generated", async () => {
  mocks.generateVideo.mockResolvedValue({ video: null });
  const costAccumulator = new CostAccumulator();
  if (!generateVideoTool.execute) {
    throw new Error("Missing execution");
  }
  await expect(
    generateVideoTool.execute(
      { prompt: "Ocean" },
      { context: { costAccumulator }, messages: [], toolCallId: "video" }
    )
  ).rejects.toThrow("No video generated");
  expect(mocks.uploadFile).not.toHaveBeenCalled();
  expect(costAccumulator.hasEntries()).toBe(false);
});

it("retains provider cost when storage upload fails", async () => {
  mocks.uploadFile.mockRejectedValue(new Error("Storage unavailable"));
  const costAccumulator = new CostAccumulator();
  if (!generateVideoTool.execute) {
    throw new Error("Missing execution");
  }
  await expect(
    generateVideoTool.execute(
      { prompt: "Ocean" },
      { context: { costAccumulator }, messages: [], toolCallId: "video" }
    )
  ).rejects.toThrow("Storage unavailable");
  expect(await costAccumulator.getTotalCost()).toBe(50);
});
