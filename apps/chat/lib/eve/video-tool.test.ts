import type * as AI from "ai";
import { expect, test, vi } from "vitest";

import { executeEvePlatformTool } from "./platform-tools";

const provider = vi.hoisted(() => ({
  enabled: true,
  generate: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("../env", () => ({ env: {} }));
vi.mock("../config", () => ({
  config: {
    ai: {
      disabledModels: [],
      tools: {
        codeExecution: { enabled: false },
        image: { enabled: false },
        video: {
          default: "test/video",
          get enabled() {
            return provider.enabled;
          },
        },
        webSearch: { enabled: false },
      },
    },
  },
}));
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof AI>()),
  experimental_generateVideo: provider.generate,
}));
vi.mock("../ai/active-gateway", () => ({
  getActiveGateway: () => ({
    createVideoModel: (id: string) => id,
    fetchModels: () =>
      Promise.resolve([
        {
          id: "selected/video",
          output: { text: true, video: true },
          type: "language",
        },
      ]),
  }),
}));
vi.mock("../ai/to-model-data", () => ({
  toModelData: (model: unknown) => model,
}));
vi.mock("../file-storage", () => ({ uploadFile: provider.upload }));

const context = {
  abortSignal: new AbortController().signal,
  callId: "video-test",
};
const input = { prompt: "A tree in the wind" };

test("native video uses the selected model and persists its upload with the provider charge", async () => {
  provider.generate.mockResolvedValue({
    video: { mediaType: "video/mp4", uint8Array: new Uint8Array([1]) },
  });
  provider.upload.mockResolvedValue({
    fileId: "abcdefghijklmnopqrstuvwx.mp4",
    url: "/api/files/abcdefghijklmnopqrstuvwx.mp4",
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
      abortSignal: expect.any(AbortSignal),
      model: "selected/video",
    })
  );
  expect(results.at(-1)).toMatchObject({
    output: {
      prompt: input.prompt,
      videoUrl: "/api/files/abcdefghijklmnopqrstuvwx.mp4",
    },
    usage: { costUsd: 0.5 },
  });
});

test("upload failure retains the provider charge in the native result", async () => {
  provider.generate.mockResolvedValue({
    video: { mediaType: "video/mp4", uint8Array: new Uint8Array([1]) },
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
    ({ abortSignal }: { abortSignal: AbortSignal }) => {
      const pending = Promise.withResolvers<never>();
      started.resolve(abortSignal);
      abortSignal.addEventListener(
        "abort",
        () => pending.reject(abortSignal.reason),
        { once: true }
      );
      return pending.promise;
    }
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

vi.mock("./generated-files", () => ({
  eveGeneratedFileUploader: () => provider.upload,
}));

vi.mock("./code-sandbox-ownership", () => ({
  eveCodeSandboxOwnership: () => {
    throw new Error("Unexpected code sandbox in this tool test");
  },
}));
