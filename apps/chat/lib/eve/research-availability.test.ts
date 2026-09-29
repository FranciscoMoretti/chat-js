import { generateText, tool, wrapLanguageModel } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";

import { testToolContext } from "../../tests/helpers/eve-tool-context";
import { researchAvailabilityMiddleware } from "./research-availability";

const mocks = vi.hoisted(() => {
  const tools: { webSearch?: object } = { webSearch: {} };
  return {
    features: {
      deepResearch: { enabled: true },
      documents: { enabled: true, types: { text: true } },
    },
    tools,
  };
});
vi.mock("../config", () => ({ config: { ai: { tools: mocks.features } } }));
vi.mock("../../tools/chatjs/tools", () => ({ tools: mocks.tools }));
beforeEach(() => {
  mocks.tools.webSearch = {};
  mocks.features.deepResearch.enabled = true;
  mocks.features.documents.enabled = true;
  mocks.features.documents.types.text = true;
});
it.each([
  "automatic",
  "selected",
  "other-tool",
  "disabled",
  "no-documents",
  "no-text",
  "guest",
  "anonymous",
  "uninstalled",
])("offers research only when available: %s", async (scenario) => {
  if (scenario === "uninstalled") {
    delete mocks.tools.webSearch;
  }
  mocks.features.deepResearch.enabled = scenario !== "disabled";
  mocks.features.documents.enabled = scenario !== "no-documents";
  mocks.features.documents.types.text = scenario !== "no-text";
  const principal = {
    attributes: {
      ...(scenario === "guest" ? { chatjsGuest: "true" } : {}),
      ...(scenario === "selected" ? { selectedTool: "deepResearch" } : {}),
      ...(scenario === "other-tool" ? { selectedTool: "webSearch" } : {}),
    },
    authenticator: "test",
    principalId: "owner",
    principalType: "user",
  };
  const { session } = testToolContext();
  const provider = new MockLanguageModelV3({
    doGenerate: () => Promise.reject(new Error("provider reached")),
  });
  const definition = tool({ inputSchema: z.object({}) });
  await expect(
    generateText({
      maxRetries: 0,
      model: wrapLanguageModel({
        middleware: researchAvailabilityMiddleware({
          ...session,
          auth: {
            current: principal,
            initiator: scenario === "anonymous" ? null : principal,
          },
        }),
        model: provider,
      }),
      prompt: "Research",
      tools: { deepResearch: definition, webSearch: definition },
    })
  ).rejects.toThrow("provider reached");
  const names = provider.doGenerateCalls[0].tools?.map((entry) => entry.name);
  expect(names).toEqual(
    ["automatic", "selected"].includes(scenario)
      ? ["deepResearch", "webSearch"]
      : ["webSearch"]
  );
});
