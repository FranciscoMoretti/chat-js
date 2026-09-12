import { describe, expect, it } from "bun:test";

import { collectEnvChecklist } from "./env-checklist";

describe("collectEnvChecklist", () => {
  it("uses the LiteLLM base URL as the gateway requirement", () => {
    const entries = collectEnvChecklist({
      auth: {
        github: true,
        google: false,
        vercel: false,
      },
      builtInTools: {
        codeExecution: false,
        deepResearch: false,
        imageGeneration: false,
        urlRetrieval: false,
        videoGeneration: false,
        webSearch: false,
      },
      coreFeatures: {
        attachments: false,
        documents: true,
        followupSuggestions: false,
        mcp: false,
        parallelResponses: true,
      },
      gateway: "litellm",
      installableToolEnvRequirements: [],
    });

    expect(entries.some((entry) => entry.vars === "LITELLM_BASE_URL")).toBe(
      true
    );
    expect(entries.some((entry) => entry.vars === "LITELLM_API_KEY")).toBe(
      false
    );
  });

  it("uses selected retrieval credentials without requiring Firecrawl", () => {
    const entries = collectEnvChecklist({
      auth: {
        github: true,
        google: false,
        vercel: false,
      },
      builtInTools: {
        codeExecution: false,
        deepResearch: false,
        imageGeneration: false,
        urlRetrieval: true,
        videoGeneration: false,
        webSearch: false,
      },
      coreFeatures: {
        attachments: false,
        documents: true,
        followupSuggestions: false,
        mcp: false,
        parallelResponses: true,
      },
      gateway: "vercel",
      installableToolEnvRequirements: [
        {
          description: "PAGE_TOKEN",
          options: [["PAGE_TOKEN"]],
        },
      ],
    });

    expect(entries.some((entry) => entry.vars === "PAGE_TOKEN")).toBe(true);
    expect(entries.some((entry) => entry.vars.includes("FIRECRAWL"))).toBe(
      false
    );
  });
});
