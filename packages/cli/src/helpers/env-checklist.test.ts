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

  it("keeps required, gateway, feature, and authentication entries ordered", () => {
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
        documents: false,
        followupSuggestions: false,
        mcp: true,
        parallelResponses: false,
      },
      gateway: "litellm",
    });

    expect(entries.map((entry) => entry.vars)).toEqual([
      "AUTH_SECRET",
      "DATABASE_URL",
      "LITELLM_BASE_URL",
      "MCP_ENCRYPTION_KEY",
      "AUTH_GITHUB_ID + AUTH_GITHUB_SECRET",
    ]);
  });

  it("keeps installable requirements with an empty description", () => {
    const entries = collectEnvChecklist({
      auth: { github: false, google: false, vercel: false },
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
        documents: false,
        followupSuggestions: false,
        mcp: false,
        parallelResponses: false,
      },
      gateway: "vercel",
      installableToolEnvRequirements: [
        { description: "", options: [["CUSTOM_TOKEN"]] },
      ],
    });

    expect(entries.some((entry) => entry.vars === "CUSTOM_TOKEN")).toBe(true);
  });
});
