import { beforeEach, expect, test, vi } from "vitest";

import { fetchChatModels } from "./app-models";
import type { ModelData } from "./model-data";
import { fetchModels } from "./models";
import { getDefaultWebChatModelId } from "./web-chat-models";

const modelSettings = vi.hoisted(
  (): { modelIds?: string[]; allowedModels?: string[] } => ({})
);

vi.mock("next/cache", () => ({
  unstable_cache: <Result>(operation: () => Result): (() => Result) =>
    operation,
}));
vi.mock("@/lib/config", () => ({
  config: {
    ai: {
      workflows: { chat: "openai/gpt-5-mini" },
      curatedDefaults: ["openai/gpt-5-mini"],
      disabledModels: ["fixture/disabled"],
      gateway: "vercel",
      providerOrder: ["preferred", "secondary"],
    },
  },
}));
vi.mock("@/integrations/chat/models", () => ({
  webModels: modelSettings,
}));
vi.mock("./models", () => ({
  fetchModels: vi.fn(),
}));

const baseModel: ModelData = {
  context_window: 128_000,
  description: "Catalog fixture",
  id: "fixture/base",
  input: { audio: false, image: false, pdf: false, text: true, video: false },
  max_tokens: 8192,
  name: "Fixture",
  object: "model",
  output: { audio: false, image: false, text: true, video: false },
  owned_by: "unlisted",
  pricing: {},
  reasoning: false,
  toolCall: true,
  type: "language",
};
const catalog: ModelData[] = [
  { ...baseModel, id: "fixture/new" },
  { ...baseModel, id: "fixture/known", owned_by: "secondary" },
  {
    ...baseModel,
    id: "openai/gpt-5-mini",
    owned_by: "preferred",
    reasoning: true,
  },
  { ...baseModel, id: "fixture/disabled", owned_by: "preferred" },
  { ...baseModel, id: "fixture/image", type: "image" },
  { ...baseModel, id: "fixture/last" },
];

beforeEach(() => {
  modelSettings.modelIds = undefined;
  modelSettings.allowedModels = undefined;
  vi.mocked(fetchModels).mockResolvedValue(catalog);
});

test.each([undefined, []])(
  "discovers chat models with modelIds %j",
  async (modelIds) => {
    modelSettings.modelIds = modelIds;
    const models = await fetchChatModels();
    expect(models.map((model: { readonly id: string }) => model.id)).toEqual([
      "openai/gpt-5-mini-reasoning",
      "openai/gpt-5-mini",
      "fixture/known",
      "fixture/new",
      "fixture/last",
    ]);
    expect(
      models.find(
        (model: { readonly id: string }) => model.id === "openai/gpt-5-mini"
      )
    ).toMatchObject({
      apiModelId: "openai/gpt-5-mini",
      reasoning: false,
    });
    expect(
      catalog.find(
        (model: { readonly id: string }) => model.id === "openai/gpt-5-mini"
      )
    ).toMatchObject({ reasoning: true });
  }
);

test("a populated modelIds list restricts the catalog and supplies a usable default", async () => {
  modelSettings.modelIds = ["fixture/new", "fixture/disabled", "fixture/image"];
  const models = await fetchChatModels();
  expect(models.map((model) => model.id)).toEqual(["fixture/new"]);
  expect(getDefaultWebChatModelId(models)).toBe("fixture/new");
});

test("older restrictions keep the configured default and their explicit alternatives", async () => {
  modelSettings.allowedModels = ["fixture/known"];
  const models = await fetchChatModels();
  expect(models.map((model) => model.id)).toEqual([
    "openai/gpt-5-mini",
    "fixture/known",
  ]);
});
