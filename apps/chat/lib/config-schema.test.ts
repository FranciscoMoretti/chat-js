import { expect, test } from "vitest";

import { applyDefaults, defineConfig } from "./config-schema";

test("partial tool and workflow overrides retain required sibling defaults", () => {
  const input = defineConfig({
    ai: {
      gateway: "vercel",
      tools: { deepResearch: { allowClarification: false } },
      workflows: { title: "openai/gpt-5-mini" },
    },
  });
  const config = applyDefaults(input);
  expect(config.ai.tools.deepResearch).toMatchObject({
    allowClarification: false,
    defaultModel: "google/gemini-2.5-flash-lite",
    finalReportModel: "google/gemini-3-flash",
  });
  expect(config.ai.tools.code.edits).toBe("openai/gpt-5-mini");
  expect(config.ai.workflows).toMatchObject({
    chat: "google/gemini-2.5-flash-lite",
    title: "openai/gpt-5-mini",
  });
  expect(input.ai.tools).toEqual({
    deepResearch: { allowClarification: false },
  });
  expect(defineConfig(input)).toBe(input);
});

test("readonly config inputs preserve selections without changing the source", () => {
  const input = {
    ai: {
      curatedDefaults: ["openai/gpt-5-mini"],
      gateway: "vercel",
      tools: { followupSuggestions: { enabled: true } },
    },
  } as const;
  const config = applyDefaults(input);
  expect(config.ai.curatedDefaults).toEqual(["openai/gpt-5-mini"]);
  expect(config.ai.tools.followupSuggestions).toEqual({
    default: "google/gemini-2.5-flash-lite",
    enabled: true,
  });
  expect(input.ai.tools.followupSuggestions).toEqual({ enabled: true });
});
