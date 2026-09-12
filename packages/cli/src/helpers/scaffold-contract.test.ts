import { describe, expect, it } from "bun:test";

import { GATEWAYS } from "../types";
import type { BuiltInToolKey, Gateway } from "../types";
import { buildConfigTs } from "./config-builder";

const buildConfigFor = (
  gateway: Gateway,
  builtInTools: Record<BuiltInToolKey, boolean>
): string =>
  buildConfigTs({
    appName: "Contract Test",
    appPrefix: "contract-test",
    appUrl: "http://localhost:3000",
    auth: {
      github: true,
      google: true,
      vercel: true,
    },
    builtInTools,
    coreFeatures: {
      attachments: true,
      documents: true,
      followupSuggestions: true,
      mcp: true,
      parallelResponses: true,
    },
    documentTypes: {
      code: true,
      sheet: true,
      text: true,
    },
    gateway,
    withElectron: false,
  });

describe("scaffold contracts", () => {
  it("builds valid configs for the high-risk built-in tool matrix", () => {
    const allBuiltIns = {
      codeExecution: true,
      deepResearch: true,
      imageGeneration: true,
      urlRetrieval: true,
      videoGeneration: true,
      webSearch: true,
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
