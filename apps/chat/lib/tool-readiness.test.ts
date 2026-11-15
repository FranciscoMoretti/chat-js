import { expect, it } from "vitest";
import { inspectToolConfiguration } from "./tool-readiness";
import type { ToolRequirements } from "./tool-readiness";

const providers = {
  gateway: [{ options: [["MODEL_KEY"]] }],
  storage: [{ options: [["STORAGE_KEY"]] }],
};
const tool = (overrides: Partial<ToolRequirements> = {}): ToolRequirements => ({
  id: "test",
  envRequirements: [],
  requiresTools: [],
  requiresGateway: false,
  requiresStorage: false,
  ...overrides,
});
it("checks alternative credentials and dependencies without exposing their values", () => {
  const tools = {
    search: tool({
      id: "search",
      envRequirements: [{ options: [["SEARCH_KEY"], ["USER", "TOKEN"]] }],
    }),
    research: tool({
      requiresTools: ["search"],
      requiresStorage: true,
      requiresGateway: true,
    }),
  };
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    USER: "private-user",
    MODEL_KEY: "secret-model-key",
    STORAGE_KEY: "secret-storage-key",
  };
  expect(inspectToolConfiguration("research", tools, providers, env)).toEqual([
    "search: SEARCH_KEY or USER + TOKEN",
  ]);
  expect(
    inspectToolConfiguration("research", tools, providers, {
      ...env,
      TOKEN: "secret-token",
    })
  ).toEqual([]);
  expect(
    inspectToolConfiguration("research", tools, providers, {
      ...env,
      SEARCH_KEY: "secret-search-key",
    })
  ).toEqual([]);
  expect(env).not.toHaveProperty("TOKEN");
});
it("fails closed for absent dependencies and cycles", () => {
  expect(
    inspectToolConfiguration(
      "runner",
      { runner: tool({ requiresTools: ["absent"] }) },
      providers,
      { NODE_ENV: "test" }
    )
  ).toEqual(["Required capability absent is not installed."]);
  expect(
    inspectToolConfiguration(
      "cycle",
      { cycle: tool({ requiresTools: ["cycle"] }) },
      providers,
      { NODE_ENV: "test" }
    )
  ).toEqual(["Capability dependency cycle at cycle."]);
});
