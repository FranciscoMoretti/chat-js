import { beforeEach, expect, test, vi } from "vitest";

import { fetchChatModels, getDefaultEnabledModels } from "./app-models";
import type { ModelData } from "./model-data";
import { fetchModels } from "./models";

vi.mock("next/cache", () => ({
  unstable_cache: <Result>(operation: () => Result): (() => Result) =>
    operation,
}));
vi.mock("@/lib/config", () => ({
  config: {
    ai: {
      curatedDefaults: ["openai/gpt-5-mini"],
      disabledModels: ["fixture/disabled"],
      gateway: "vercel",
      providerOrder: ["preferred", "secondary"],
    },
  },
}));
vi.mock("./models.generated", () => ({
  generatedForGateway: "vercel",
  models: [{ id: "openai/gpt-5-mini" }, { id: "fixture/known" }],
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

beforeEach(() => vi.mocked(fetchModels).mockResolvedValue(catalog));

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("chat catalogs preserve reasoning variants, disabled filtering, and provider order", async () => {
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
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("readonly catalogs enable curated reasoning variants and newly discovered IDs", async () => {
  const models = Object.freeze(await fetchChatModels());
  const enabled = getDefaultEnabledModels(models);
  expect([...enabled]).toEqual([
    "openai/gpt-5-mini",
    "openai/gpt-5-mini-reasoning",
    "fixture/new",
    "fixture/last",
  ]);
});
/* oxlint-enable oxc/no-async-await */
