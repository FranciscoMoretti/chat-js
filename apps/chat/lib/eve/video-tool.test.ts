import { expect, test, vi } from "vitest";
import { generateVideoOutput } from "../../tools/platform/generate-video.schemas";
import { executeEvePlatformTool } from "./platform-tools";

const provider = vi.hoisted(() => ({
  generate: vi.fn(),
  upload: vi.fn(),
  enabled: true,
}));
vi.mock("../env", () => ({ env: {} }));
vi.mock("../config", () => ({
  config: {
    ai: {
      tools: {
        video: {
          get enabled() {
            return provider.enabled;
          },
          default: "test/video",
        },
        image: { enabled: false },
        webSearch: { enabled: false },
        codeExecution: { enabled: false },
      },
    },
  },
}));
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  experimental_generateVideo: provider.generate,
}));
vi.mock("../ai/active-gateway", () => ({
  getActiveGateway: () => ({
    createVideoModel: (id: string) => id,
    fetchModels: async () => [
      { id: "selected/video", output: { video: true } },
    ],
  }),
}));
vi.mock("../ai/to-model-data", () => ({
  toModelData: (model: unknown) => model,
}));
vi.mock("../file-storage", () => ({ uploadFile: provider.upload }));

const context = {
  callId: "video-test",
  abortSignal: new AbortController().signal,
};
const input = { prompt: "A tree in the wind" };

test("native video uses the selected model and persists its upload with the provider charge", async () => {
  provider.generate.mockResolvedValue({
    video: { uint8Array: new Uint8Array([1]), mediaType: "video/mp4" },
  });
  provider.upload.mockResolvedValue({
    url: "/api/files/content?key=abcdefghijklmnopqrstuvwx.mp4",
  });
  const results = await Array.fromAsync(
    executeEvePlatformTool(
      "generateVideo",
      input,
      context,
      [],
      "selected/video"
    )
  );
  expect(provider.generate).toHaveBeenLastCalledWith(
    expect.objectContaining({
      model: "selected/video",
      abortSignal: expect.any(AbortSignal),
    })
  );
  expect(generateVideoOutput.safeParse(results.at(-1)?.output).success).toBe(
    true
  );
  expect(results.at(-1)).toMatchObject({
    output: {
      videoUrl: "/api/files/content?key=abcdefghijklmnopqrstuvwx.mp4",
      prompt: input.prompt,
    },
    usage: { costUsd: 0.5 },
  });
});

test("upload failure retains the provider charge in the native result", async () => {
  provider.generate.mockResolvedValue({
    video: { uint8Array: new Uint8Array([1]), mediaType: "video/mp4" },
  });
  provider.upload.mockRejectedValue(new Error("Upload unavailable"));
  const results = await Array.fromAsync(
    executeEvePlatformTool("generateVideo", input, context, [])
  );
  expect(results.at(-1)).toMatchObject({
    output: { error: expect.any(String) },
    usage: { costUsd: 0.5 },
  });
});

test("disabled video cannot execute an already advertised tool", async () => {
  provider.enabled = false;
  provider.generate.mockClear();
  try {
    await expect(
      executeEvePlatformTool("generateVideo", input, context, []).next()
    ).rejects.toThrow("unavailable");
    expect(provider.generate).not.toHaveBeenCalled();
  } finally {
    provider.enabled = true;
  }
});

test("aborting a native video request reaches the provider", async () => {
  const started = Promise.withResolvers<AbortSignal>();
  provider.generate.mockImplementation(
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
  const result = executeEvePlatformTool(
    "generateVideo",
    input,
    { ...context, abortSignal: controller.signal },
    []
  ).next();
  const rejected = expect(result).rejects.toThrow();
  const signal = await started.promise;
  controller.abort();
  await rejected;
  expect(signal.aborted).toBe(true);
});
