import type * as AI from "ai";
import { MockVideoModelV4 } from "ai/test";
import { beforeEach, expect, it, vi } from "vitest";

import { testToolContext } from "@/tests/helpers/eve-tool-context";

import { generateVideoResult } from "./schemas";
import { generateVideoTool } from "./tool";

const mocks = vi.hoisted(() => ({
  definition: vi.fn(),
  generate: vi.fn(),
  model: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("ai", async (original) => ({
  ...(await original<typeof AI>()),
  experimental_generateVideo: mocks.generate,
}));
vi.mock("@/lib/eve/tool-models", () => ({
  eveToolModelProvider: {
    createVideoModel: (id: string) => {
      mocks.model(id);
      return new MockVideoModelV4();
    },
    getModelDefinition: mocks.definition,
  },
}));
vi.mock("@/lib/eve/generated-files", () => ({
  eveGeneratedFileUploader: () => mocks.upload,
}));
vi.mock("@/lib/config", () => ({
  config: {
    ai: { tools: { video: { default: "default-video" } } },
  },
}));
const input = { prompt: "Ocean" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.definition.mockResolvedValue({ output: { video: false } });
  mocks.generate.mockResolvedValue({
    video: { mediaType: "video/mp4", uint8Array: Buffer.from("video") },
  });
  mocks.upload.mockResolvedValue({
    fileId: "file",
    url: "/api/files/generated",
  });
});
it("uses the native selected model, provider options, authorized storage and cost receipt", async () => {
  mocks.definition.mockResolvedValue({
    apiModelId: "selected",
    output: { video: true },
  });
  const context = testToolContext();
  const current = {
    attributes: { modelId: "selected-reasoning" },
    authenticator: "test",
    principalId: "owner",
    principalType: "user",
  };
  const result = await generateVideoTool.execute(
    { ...input, aspectRatio: "9:16", durationSeconds: 3 },
    {
      ...context,
      session: { ...context.session, auth: { current, initiator: current } },
    }
  );
  expect(mocks.definition).toHaveBeenCalledWith("selected-reasoning");
  expect(mocks.model).toHaveBeenCalledWith("selected");
  expect(mocks.generate).toHaveBeenCalledWith(
    expect.objectContaining({
      abortSignal: context.abortSignal,
      aspectRatio: "9:16",
      duration: 3,
    })
  );
  expect(mocks.upload).toHaveBeenCalledWith(
    expect.stringMatching(/\.mp4$/u),
    Buffer.from("video"),
    "video/mp4"
  );
  expect(result).toMatchObject({
    output: { videoUrl: "/api/files/generated" },
    status: "success",
    usage: { costUsd: 0.5 },
  });
});
it("uses configured defaults", async () => {
  await generateVideoTool.execute(input, testToolContext());
  expect(mocks.model).toHaveBeenCalledWith("default-video");
  expect(mocks.generate).toHaveBeenCalledWith(
    expect.objectContaining({ aspectRatio: "16:9", duration: 5 })
  );
});
it("does not invent a charge when no video is returned", async () => {
  mocks.generate.mockResolvedValue({ video: null });
  await expect(
    generateVideoTool.execute(input, testToolContext())
  ).rejects.toThrow("No video generated");
  expect(mocks.upload).not.toHaveBeenCalled();
});
it("retains provider cost when storage fails", async () => {
  mocks.upload.mockRejectedValue(new Error("Storage unavailable"));
  expect(
    await generateVideoTool.execute(input, testToolContext())
  ).toMatchObject({ status: "error", usage: { costUsd: 0.5 } });
});
it("accepts saved results without file IDs", () => {
  const saved = {
    prompt: "Example",
    videoUrl: "/api/files/abcdefghijklmnopqrstuvwx",
  };
  expect(generateVideoResult.parse(saved)).toEqual(saved);
});

vi.mock("@/lib/ai/active-gateway", () => ({
  getActiveGateway: () => ({ fetchModels: () => [] }),
}));
