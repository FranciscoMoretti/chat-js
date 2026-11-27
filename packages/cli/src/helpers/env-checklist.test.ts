import { describe, expect, it } from "bun:test";

import { collectEnvChecklist, formatEnvChecklist } from "./env-checklist";
import { coreFeatureEnvRequirements } from "./config-requirements";

const requiredMcpEncryptionKeyCount = 1;
const names = (sections: ReturnType<typeof collectEnvChecklist>): string[] =>
  sections.flatMap(({ requirements }) =>
    requirements.flatMap(({ options }) => options.flat())
  );

describe("collectEnvChecklist", () => {
  it("uses the LiteLLM base URL as the gateway requirement", () => {
    const entries = collectEnvChecklist({
      auth: {
        github: true,
        google: false,
        vercel: false,
      },
      coreFeatures: {
        attachments: false,
        followupSuggestions: false,
        feedback: false,
        mcp: false,
        projects: false,
        parallelResponses: true,
      },
      gateway: "litellm",
      installableToolEnvRequirements: [],
    });

    expect(names(entries)).toContain("LITELLM_BASE_URL");
    expect(names(entries)).not.toContain("LITELLM_API_KEY");
  });

  it("uses selected retrieval credentials without requiring Firecrawl", () => {
    const entries = collectEnvChecklist({
      auth: {
        github: true,
        google: false,
        vercel: false,
      },
      coreFeatures: {
        attachments: false,
        followupSuggestions: false,
        feedback: false,
        mcp: false,
        projects: false,
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

    expect(names(entries)).toContain("PAGE_TOKEN");
    expect(names(entries).some((name) => name.includes("FIRECRAWL"))).toBe(
      false
    );
  });

  it("keeps required, gateway, plugin, and authentication entries ordered", () => {
    const entries = collectEnvChecklist({
      auth: {
        github: true,
        google: false,
        vercel: false,
      },
      coreFeatures: {
        attachments: false,
        followupSuggestions: false,
        feedback: false,
        mcp: true,
        projects: false,
        parallelResponses: false,
      },
      gateway: "litellm",
    });

    expect(
      names(entries).filter((name) => name === "MCP_ENCRYPTION_KEY")
    ).toHaveLength(requiredMcpEncryptionKeyCount);
    expect(entries.map(({ title }) => title)).toEqual([
      "App secrets",
      "Database",
      "Model gateway",
      "Sign-in",
      "Selected plugins and tools",
    ]);
    expect(names(entries)).toEqual([
      "AUTH_SECRET",
      "EVE_GATEWAY_SECRET",
      "DATABASE_URL",
      "LITELLM_BASE_URL",
      "AUTH_GITHUB_ID",
      "AUTH_GITHUB_SECRET",
      "MCP_ENCRYPTION_KEY",
    ]);
  });

  it("keeps installable requirements with an empty description", () => {
    const entries = collectEnvChecklist({
      auth: { github: false, google: false, vercel: false },
      coreFeatures: {
        attachments: false,
        followupSuggestions: false,
        feedback: false,
        mcp: false,
        projects: false,
        parallelResponses: false,
      },
      gateway: "vercel",
      installableToolEnvRequirements: [
        { description: "", options: [["CUSTOM_TOKEN"]] },
      ],
    });

    expect(names(entries)).toContain("CUSTOM_TOKEN");
  });
});

it("includes every installed MCP requirement and preserves combined and alternative groups", () => {
  const previous = coreFeatureEnvRequirements.mcp;
  coreFeatureEnvRequirements.mcp = [
    { description: "First", options: [["MCP_ENCRYPTION_KEY"]] },
    { description: "Second", options: [["TEAM", "TOKEN"], ["OIDC_TOKEN"]] },
  ];
  try {
    const entries = collectEnvChecklist({
      auth: { github: false, google: false, vercel: false },
      coreFeatures: {
        attachments: false,
        followupSuggestions: false,
        feedback: false,
        mcp: true,
        projects: false,
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
    const featureRequirements = entries.find(
      ({ title }) => title === "Selected plugins and tools"
    )?.requirements;
    expect(featureRequirements?.map(({ options }) => options)).toEqual([
      [["MCP_ENCRYPTION_KEY"]],
      [["TEAM", "TOKEN"], ["OIDC_TOKEN"]],
    ]);
  } finally {
    coreFeatureEnvRequirements.mcp = previous;
  }
});

it("keeps each credential set together and puts secret generation under App secrets", () => {
  const sections = collectEnvChecklist({
    auth: { github: true, google: false, vercel: false },
    coreFeatures: {
      attachments: false,
      followupSuggestions: false,
      feedback: false,
      mcp: false,
      parallelResponses: false,
      projects: false,
    },
    gateway: "vercel",
    storageRequirements: [
      {
        options: [
          ["BLOB_READ_WRITE_TOKEN"],
          ["VERCEL_OIDC_TOKEN", "BLOB_STORE_ID"],
        ],
      },
    ],
  });
  const formatted = formatEnvChecklist(sections);
  expect(formatted).toContain(
    [
      "  App secrets",
      "    AUTH_SECRET",
      "    EVE_GATEWAY_SECRET",
      "    Run openssl rand -base64 32 twice. Use a different value for each secret.",
    ].join("\n")
  );
  expect(formatted).toContain(
    [
      "  File storage (choose one)",
      "      BLOB_READ_WRITE_TOKEN",
      "    or",
      "      VERCEL_OIDC_TOKEN",
      "      BLOB_STORE_ID",
    ].join("\n")
  );
  expect(formatted).toContain(
    "  Sign-in\n    AUTH_GITHUB_ID\n    AUTH_GITHUB_SECRET"
  );
});
