import { describe, expect, it } from "bun:test";

import { coreFeatureEnvRequirements } from "./config-requirements";
import { collectEnvChecklist } from "./env-checklist";

/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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

    expect(
      entries.filter((entry) => entry.vars === "MCP_ENCRYPTION_KEY")
    ).toHaveLength(1);
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */

/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
it("includes every installed MCP requirement and preserves combined and alternative groups", () => {
  const previous = coreFeatureEnvRequirements.mcp;
  coreFeatureEnvRequirements.mcp = [
    { description: "First", options: [["MCP_ENCRYPTION_KEY"]] },
    { description: "Second", options: [["TEAM", "TOKEN"], ["OIDC_TOKEN"]] },
  ];
  try {
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
        mcp: true,
        parallelResponses: false,
      },
      gateway: "openai",
      gatewayRequirements: [],
      installableToolEnvRequirements: [
        { description: "Registry label", options: [["MCP_ENCRYPTION_KEY"]] },
        {
          description: "Reordered alternatives",
          options: [["OIDC_TOKEN"], ["TOKEN", "TEAM"]],
        },
      ],
    });
    expect(
      entries.filter((entry) => entry.vars === "MCP_ENCRYPTION_KEY")
    ).toHaveLength(1);
    expect(entries.map((entry) => entry.vars)).toEqual(
      // oxlint-disable-next-line typescript/no-unsafe-argument -- This test deliberately supplies a partial mock or asymmetric matcher; runtime assertions verify the exercised contract.
      expect.arrayContaining([
        "MCP_ENCRYPTION_KEY",
        "TEAM + TOKEN",
        "OIDC_TOKEN",
      ])
    );
    expect(
      entries.filter((entry) => entry.oneOfGroup === "TEAM+TOKEN|OIDC_TOKEN")
    ).toHaveLength(2);
  } finally {
    coreFeatureEnvRequirements.mcp = previous;
  }
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
