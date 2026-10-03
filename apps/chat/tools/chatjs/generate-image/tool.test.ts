/* oxlint-disable import/no-namespace  --
 * import/no-namespace (#528): The AI namespace is the consumed SDK/module interface; renaming all member references requires changing that import contract.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import type * as AI from "ai";
import { MockImageModelV3, MockLanguageModelV3 } from "ai/test";
import { beforeEach, expect, it, vi } from "vitest";

import { toolResultSchema } from "@/lib/eve/tool-result";
import { testToolContext } from "@/tests/helpers/eve-tool-context";

import { generateImageResult } from "./schemas";
import { generateImageTool } from "./tool";
/* oxlint-enable import/no-namespace */

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
vi.mock("ai", async (original) => ({
  ...(await original<typeof AI>()),
  generateImage: mocks.image,
  generateText: mocks.text,
}));
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("@/lib/eve/tool-models")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("@/lib/eve/tool-models", () => ({
  eveToolModelProvider: {
    createImageModel: () => new MockImageModelV3(),
    createLanguageModel: (id: string) => {
      mocks.languageModel(id);
      return new MockLanguageModelV3();
    },
    getModelDefinition: mocks.definition,
  },
}));
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("@/lib/eve/generated-files")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("@/lib/eve/generated-files", () => ({
  eveGeneratedFileUploader: () => mocks.upload,
}));
/* oxlint-enable typescript/explicit-function-return-type */
vi.mock("@/lib/eve/tool-image-context", () => ({
  eveToolImageContext: { get: mocks.images },
}));
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("@/lib/ai/active-gateway")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("@/lib/ai/active-gateway", () => ({
  getActiveGateway: () => ({ fetchModels: mocks.catalog }),
}));
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("@/lib/ai/to-model-data")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("@/lib/ai/to-model-data", () => ({
  toModelData: (value: unknown) => value,
}));
/* oxlint-enable typescript/explicit-function-return-type */
vi.mock("@/lib/config", () => ({
  config: {
    ai: { tools: { image: { default: "test-image" } } },
  },
}));
vi.mock("@/lib/file-storage", () => ({ downloadFile: mocks.download }));

vi.mock("@/lib/url", () => ({
  getBaseUrl: (): string => "https://example.com",
}));

/* oxlint-disable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types  --
 * oxc/no-async-await (#540): execute sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep execute's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): execute accepts context = testToolContext(); deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
const execute = async (context = testToolContext()) =>
  toolResultSchema.parse(
    await generateImageTool.execute({ prompt: "Blue sky" }, context)
  );
/* oxlint-enable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */
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
/* oxlint-enable unicorn/no-null */
/* oxlint-disable no-magic-numbers  --
 * no-magic-numbers (#517): it("uses native image context for editing and persists provider cost") uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("uses native image context for editing and persists provider cost") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
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
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This tool fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(mocks.image.mock.calls[0][0].prompt).toEqual({
    images: [Buffer.from("previous"), Buffer.from("attachment")],
    text: "Blue sky",
  });
  expect(result).toMatchObject({
    output: { imageUrl: "/api/files/generated" },
    status: "success",
    usage: { costUsd: 0.04 },
  });
});
/* oxlint-enable no-magic-numbers */
/* oxlint-disable no-magic-numbers  --
 * no-magic-numbers (#517): it("generates from a prompt without edit images") uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("generates from a prompt without edit images") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
it("generates from a prompt without edit images", async () => {
  await execute();
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This tool fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(mocks.image.mock.calls[0][0].prompt).toBe("Blue sky");
});
/* oxlint-enable no-magic-numbers */
/* oxlint-disable unicorn/no-null  --
 * oxc/no-async-await (#540): it("retains provider cost if authorized storage fails") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
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
/* oxlint-enable unicorn/no-null */
/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/promise-function-async  --
 * oxc/no-async-await (#540): it("forwards cancellation to EVE") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): it("forwards cancellation to EVE") accepts { abortSignal }: { abortSignal: AbortSignal }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): it("forwards cancellation to EVE") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
it("forwards cancellation to EVE", async () => {
  const controller = new AbortController();
  mocks.image.mockImplementation(
    ({ abortSignal }: { abortSignal: AbortSignal }) => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
/* oxlint-disable no-magic-numbers  --
 * no-magic-numbers (#517): it("uses the selected native model and accounts nested model tokens") uses 0.000011 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("uses the selected native model and accounts nested model tokens") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it("uses the selected native model and accounts nested model tokens") copies or separates ...context; ...context.session while preserving existing object ownership; mutating source objects is not equivalent.
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
    ...context,
    session: { ...context.session, auth: { current, initiator: current } },
  });
  expect(mocks.languageModel).toHaveBeenCalledWith("google/image");
  expect(result.usage.costUsd).toBeCloseTo(0.000011);
  expect(mocks.image).not.toHaveBeenCalled();
});
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
it("missing provider pricing stays unknown", async () => {
  mocks.catalog.mockRejectedValue(new Error("Catalog unavailable"));
  const result = await execute();
  expect(result.usage.costUsd).toBeUndefined();
});
it("accepts saved results without file IDs", () => {
  const saved = {
    imageUrl: "/api/files/abcdefghijklmnopqrstuvwx",
    prompt: "Example",
  };
  expect(generateImageResult.parse(saved)).toEqual(saved);
});
