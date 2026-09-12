import { describe, expect, it } from "bun:test";

import { GATEWAYS } from "../types";
import type { BuiltInToolKey, Gateway } from "../types";
import { buildConfigTs } from "./config-builder";

function buildConfigFor(
  gateway: Gateway,
  builtInTools: Record<BuiltInToolKey, boolean>
) {
  return buildConfigTs({
    appName: "Contract Test",
    appPrefix: "contract-test",
    appUrl: "http://localhost:3000",
    withElectron: false,
    gateway,
    coreFeatures: {
      attachments: true,
      parallelResponses: true,
      documents: true,
      mcp: true,
      followupSuggestions: true,
    },
    documentTypes: {
      text: true,
      code: true,
      sheet: true,
    },
    builtInTools,
    auth: {
      google: true,
      github: true,
      vercel: true,
    },
  });
}

describe("scaffold contracts", () => {
  it("builds valid configs for the high-risk built-in tool matrix", () => {
    const allBuiltIns = {
      webSearch: true,
      urlRetrieval: true,
      deepResearch: true,
      codeExecution: true,
      imageGeneration: true,
      videoGeneration: true,
    } satisfies Record<BuiltInToolKey, boolean>;

    for (const gateway of GATEWAYS) {
      const output = buildConfigFor(gateway, allBuiltIns);
      expect(output).toContain(`gateway: ${JSON.stringify(gateway)}`);
    }

    const openaiCompatible = buildConfigFor("openai-compatible", allBuiltIns);
    expect(openaiCompatible).toContain('default: "gpt-image-1"');
    expect(openaiCompatible).toMatch(/video:\s*\{\s*enabled:\s*false,/mu);

    const litellm = buildConfigFor("litellm", allBuiltIns);
    expect(litellm).toContain('chat: "openai/gpt-4o-mini"');
    expect(litellm).toMatch(/image:\s*\{\s*enabled:\s*false,/mu);
    expect(litellm).toMatch(/video:\s*\{\s*enabled:\s*false,/mu);
  });
});
