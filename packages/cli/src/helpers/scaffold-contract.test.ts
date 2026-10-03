import { describe, expect, it } from "bun:test";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { GATEWAYS } from "../types";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import type { Gateway } from "../types";
/* oxlint-enable import/no-relative-parent-imports */
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
      mcp: true,
      parallelResponses: true,
    },
    gateway,
    withElectron: false,
  });

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
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
      expect(output).toContain("maxSearchQueries: 2");
      expect(output).toContain("followupSuggestions: {");
      expect(output).toContain("parallelResponses: true");
    }

    const openaiCompatible = buildConfigFor("openai-compatible");
    expect(openaiCompatible).toContain('default: "gpt-image-1"');
    expect(openaiCompatible).not.toMatch(/video:\s*\{[^}]*enabled:/mu);

    const litellm = buildConfigFor("litellm");
    expect(litellm).toContain('chat: "openai/gpt-4o-mini"');
    expect(litellm).not.toMatch(/image:\s*\{[^}]*enabled:/mu);
    expect(litellm).not.toMatch(/video:\s*\{[^}]*enabled:/mu);
  });
});
/* oxlint-enable eslint/max-statements */
