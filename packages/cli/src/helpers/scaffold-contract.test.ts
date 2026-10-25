import { describe, expect, it } from "bun:test";

import { GATEWAYS } from "#cli/types";
import type { Gateway } from "#cli/types";

import { buildConfigTs } from "./config-builder";

const buildConfigFor = (gateway: Gateway): string =>
  buildConfigTs({
    appName: "Contract Test",
    appPrefix: "contract-test",
    appUrl: "http://localhost:3000",
    auth: {
      github: true,
      google: true,
      vercel: true,
    },
    coreFeatures: {
      attachments: true,
      documents: true,
      followupSuggestions: true,
      feedback: false,
      mcp: true,
      projects: false,
      parallelResponses: true,
    },
    gateway,
    withElectron: false,
  });

describe("scaffold contracts", () => {
  it("builds valid configs without tool presence switches for every gateway", () => {
    for (const gateway of GATEWAYS) {
      const output = buildConfigFor(gateway);
      expect(output).toContain(`gateway: ${JSON.stringify(gateway)}`);
      for (const removed of [
        "documents",
        "codeExecution",
        "urlRetrieval",
        "webSearch",
      ]) {
        expect(output).not.toContain(`${removed}: {`);
      }
      expect(output).not.toContain("maxSearchQueries:");
      expect(output).toContain("followupSuggestions: {");
      expect(output).toContain("parallelResponses: true");
    }

    const openaiCompatible = buildConfigFor("openai-compatible");
    expect(openaiCompatible).not.toContain('default: "gpt-image-1"');
    expect(openaiCompatible).not.toMatch(/video:\s*\{[^}]*enabled:/mu);

    const litellm = buildConfigFor("litellm");
    expect(litellm).toContain('chat: "openai/gpt-4o-mini"');
    expect(litellm).not.toMatch(/image:\s*\{[^}]*enabled:/mu);
    expect(litellm).not.toMatch(/video:\s*\{[^}]*enabled:/mu);
  });
});
