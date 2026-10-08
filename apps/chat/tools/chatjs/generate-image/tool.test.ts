import { MockImageModelV3, MockLanguageModelV3 } from "ai/test";
import { beforeEach, expect, it, vi } from "vitest";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { generateImageResult } from "./schemas";
import { generateImageTool } from "./tool";
import { testToolContext } from "@/tests/helpers/eve-tool-context";
import { toolResultSchema } from "@/lib/eve/tool-result";

const mocks = vi.hoisted(() => ({
  catalog: vi.fn(),
  definition: vi.fn(),
  download: vi.fn(),
  image: vi.fn(),
  images: vi.fn(),
  languageModel: vi.fn(),
  text: vi.fn(),
  upload: vi.fn(),
}));
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve vi.mock's awaited sequencing and rejected-Promise behavior. */
vi.mock(import("ai"), async (original) => ({
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing (await original()) own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  ...(await original()),
  generateImage: mocks.image,
  generateText: mocks.text,
}));
/* oxlint-enable oxc/no-async-await */
vi.mock("@/lib/eve/tool-models", () => ({
  eveToolModelProvider: {
    createImageModel: (): MockImageModelV3 => new MockImageModelV3(),
    createLanguageModel: (id: string): MockLanguageModelV3 => {
      mocks.languageModel(id);
      return new MockLanguageModelV3();
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
vi.mock("@/lib/eve/tool-image-context", () => ({
  eveToolImageContext: { get: mocks.images },
}));
vi.mock(
  "@/lib/ai/active-gateway",
  (): { getActiveGateway: () => { fetchModels: typeof mocks.catalog } } => ({
    getActiveGateway: (): { fetchModels: typeof mocks.catalog } => ({
      fetchModels: mocks.catalog,
    }),
  })
);
vi.mock(
  "@/lib/ai/to-model-data",
  (): { toModelData: (value: unknown) => unknown } => ({
    toModelData: (value: unknown) => value,
  })
);
vi.mock("@/lib/config", () => ({
  config: {
    ai: { tools: { image: { default: "test-image" } } },
  },
}));
vi.mock("@/lib/file-storage", () => ({ downloadFile: mocks.download }));

vi.mock("@/lib/url", () => ({
  getBaseUrl: (): string => "https://example.com",
}));

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve execute's awaited sequencing and rejected-Promise behavior. */
const execute = async (
  context: ReadonlyNativeSurface<
    ReturnType<typeof testToolContext>
  > = testToolContext()
): Promise<ReturnType<typeof toolResultSchema.parse>> =>
  toolResultSchema.parse(
    await generateImageTool.execute({ prompt: "Blue sky" }, context)
  );
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): beforeEach preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
beforeEach(() => {
  vi.resetAllMocks();
  mocks.catalog.mockResolvedValue([
    { id: "test-image", pricing: { image: "0.04" } },
    { id: "selected", pricing: { input: "0.000001", output: "0.000002" } },
  ]);
  mocks.definition.mockResolvedValue({ output: { image: false } });
  mocks.image.mockResolvedValue({
    images: [{ base64: "aW1hZ2U=" }],
    usage: { inputTokens: 10, outputTokens: 20 },
  });
  mocks.upload.mockResolvedValue({
    fileId: "file",
    url: "/api/files/generated",
  });
  mocks.images.mockReturnValue({ attachments: [], lastGeneratedImage: null });
});
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable unicorn/no-null */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("uses native image context for editing and persists provider cost") uses first-call ordinal 1 as the fixture assertion target.
 */
it("uses native image context for editing and persists provider cost", async () => {
  mocks.images.mockReturnValue({
    attachments: [
      {
        mediaType: "image/png",
        type: "file",
        url: "data:image/png;base64,YXR0YWNobWVudA==",
      },
    ],
    lastGeneratedImage: {
      imageUrl: "data:image/png;base64,cHJldmlvdXM=",
      name: "previous",
    },
  });
  const result = await execute();
  expect(mocks.image).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      prompt: {
        images: [Buffer.from("previous"), Buffer.from("attachment")],
        text: "Blue sky",
      },
    })
  );
  expect(result).toMatchObject({
    output: { imageUrl: "/api/files/generated" },
    status: "success",
    usage: { costUsd: 0.04 },
  });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("generates from a prompt without edit images") uses first-call ordinal 1 as the fixture assertion target.
 */
it("generates from a prompt without edit images", async () => {
  await execute();
  expect(mocks.image).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({ prompt: "Blue sky" })
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */
/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): it("retains provider cost if authorized storage fails") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
it("retains provider cost if authorized storage fails", async () => {
  mocks.upload.mockRejectedValue(new Error("Private storage details"));
  expect(await execute()).toMatchObject({
    output: null,
    status: "error",
    usage: { costUsd: 0.04 },
  });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable unicorn/no-null */
/* oxlint-disable typescript/promise-function-async -- * typescript/promise-function-async (#606): it("forwards cancellation to EVE") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections. */
it("forwards cancellation to EVE", async () => {
  const controller = new AbortController();
  mocks.image.mockImplementation(
    ({
      abortSignal,
    }: {
      readonly abortSignal: Readonly<
        Pick<AbortSignal, "addEventListener" | "reason">
      >;
    }) => {
      const pending = Promise.withResolvers<never>();
      abortSignal.addEventListener(
        "abort",
        () => pending.reject(abortSignal.reason),
        { once: true }
      );
      return pending.promise;
    }
  );
  const result = execute(testToolContext({ abortSignal: controller.signal }));
  await vi.waitFor(() => expect(mocks.image).toHaveBeenCalledOnce());
  controller.abort();
  await expect(result).rejects.toBe(controller.signal.reason);
  expect(mocks.upload).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("uses the selected native model and accounts nested model tokens") uses 0.000011 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("uses the selected native model and accounts nested model tokens", async () => {
  mocks.definition.mockResolvedValue({
    apiModelId: "google/image",
    id: "selected",
    output: { image: true },
  });
  mocks.text.mockResolvedValue({
    files: [{ mediaType: "image/png", uint8Array: Buffer.from("image") }],
    usage: { inputTokens: 3, outputTokens: 4 },
  });
  const context = testToolContext();
  const current = {
    attributes: { modelId: "selected" },
    authenticator: "test",
    principalId: "owner",
    principalType: "user",
  };
  const result = await execute({
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing context own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...context,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing context.session own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    session: { ...context.session, auth: { current, initiator: current } },
  });
  expect(mocks.languageModel).toHaveBeenCalledWith("google/image");
  expect(result.usage.costUsd).toBeCloseTo(0.000011);
  expect(mocks.image).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it.each([   "http://127.0.0.1/private",   "https://attacker.example/image.png",   "https://attacker.'s awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */
it.each([
  "http://127.0.0.1/private",
  "https://attacker.example/image.png",
  "https://attacker.example/api/files/abcdefghijklmnopqrstuvwx.png",
])(
  "rejects an unapproved image URL %s before provider work",
  async (imageUrl) => {
    mocks.images.mockReturnValue({
      attachments: [],
      lastGeneratedImage: { imageUrl, name: "image" },
    });
    await expect(execute()).rejects.toThrow("Image editing only accepts");
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.image).not.toHaveBeenCalled();
  }
);
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("reads approved uploads directly from storage", async () => {
  mocks.images.mockReturnValue({
    attachments: [],
    lastGeneratedImage: {
      imageUrl: "/api/files/abcdefghijklmnopqrstuvwx.png",
      name: "image",
    },
  });
  mocks.download.mockResolvedValue(new Blob(["stored"]));
  await execute();
  expect(mocks.download).toHaveBeenCalledWith("abcdefghijklmnopqrstuvwx.png");
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("missing provider pricing stays unknown", async () => {
  mocks.catalog.mockRejectedValue(new Error("Catalog unavailable"));
  const result = await execute();
  expect(result.usage.costUsd).toBeUndefined();
});
/* oxlint-enable oxc/no-async-await */
it("accepts saved results without file IDs", () => {
  const saved = {
    imageUrl: "/api/files/abcdefghijklmnopqrstuvwx",
    prompt: "Example",
  };
  expect(generateImageResult.parse(saved)).toEqual(saved);
});
