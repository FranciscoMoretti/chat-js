import { MockVideoModelV4 } from "ai/test";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { beforeEach, expect, it, vi } from "vitest";
/* oxlint-enable sort-imports */

import { testToolContext } from "@/tests/helpers/eve-tool-context";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { generateVideoResult } from "./schemas";
/* oxlint-enable sort-imports */
import { generateVideoTool } from "./tool";

const mocks = vi.hoisted(() => ({
  definition: vi.fn(),
  generate: vi.fn(),
  model: vi.fn(),
  upload: vi.fn(),
}));
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve vi.mock's awaited sequencing and rejected-Promise behavior. */
vi.mock(import("ai"), async (original) => ({
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing (await original()) own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  ...(await original()),
  experimental_generateVideo: mocks.generate,
}));
/* oxlint-enable oxc/no-async-await */
vi.mock("@/lib/eve/tool-models", () => ({
  eveToolModelProvider: {
    createVideoModel: (id: string): MockVideoModelV4 => {
      mocks.model(id);
      return new MockVideoModelV4();
    },
    getModelDefinition: mocks.definition,
  },
}));
vi.mock(
  "@/lib/eve/generated-files",
  (): { eveGeneratedFileUploader: () => typeof mocks.upload } => ({
    eveGeneratedFileUploader: () => mocks.upload,
  })
);
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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...input, aspectRatio: "9:16", durationSeconds: 3 },
    {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing context own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...context,
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing context.session own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("uses configured defaults", async () => {
  await generateVideoTool.execute(input, testToolContext());
  expect(mocks.model).toHaveBeenCalledWith("default-video");
  expect(mocks.generate).toHaveBeenCalledWith(
    expect.objectContaining({ aspectRatio: "16:9", duration: 5 })
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): it("does not invent a charge when no video is returned") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
it("does not invent a charge when no video is returned", async () => {
  mocks.generate.mockResolvedValue({ video: null });
  await expect(
    generateVideoTool.execute(input, testToolContext())
  ).rejects.toThrow("No video generated");
  expect(mocks.upload).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable unicorn/no-null */
it("retains provider cost when storage fails", async () => {
  mocks.upload.mockRejectedValue(new Error("Storage unavailable"));
  expect(
    await generateVideoTool.execute(input, testToolContext())
  ).toMatchObject({ status: "error", usage: { costUsd: 0.5 } });
});
/* oxlint-enable oxc/no-async-await */
it("accepts saved results without file IDs", () => {
  const saved = {
    prompt: "Example",
    videoUrl: "/api/files/abcdefghijklmnopqrstuvwx",
  };
  expect(generateVideoResult.parse(saved)).toEqual(saved);
});

vi.mock(
  "@/lib/ai/active-gateway",
  (): { getActiveGateway: () => { fetchModels: () => never[] } } => ({
    getActiveGateway: (): { fetchModels: () => never[] } => ({
      fetchModels: (): never[] => [],
    }),
  })
);
