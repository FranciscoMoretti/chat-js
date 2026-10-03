import { expect, it } from "bun:test";

import { gatewayDefinitionSchema } from "@chat-js/gateways/definition";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { externalGatewayFixture } from "../../test/external-gateway";
/* oxlint-enable import/no-relative-parent-imports */
import { collectEnvChecklist } from "./env-checklist";
import {
  promptAssistantTools,
  promptCoreFeatures,
  promptObservability,
  promptDocumentTypes,
} from "./prompts";

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
it("uses external defaults and every environment group with --yes", async () => {
  const definition = externalGatewayFixture().root.meta.chatjs;
  definition.envRequirements = [
    { options: [["FIRST"]] },
    { options: [["SECOND"], ["ALTERNATE"]] },
  ];
  const coreFeatures = await promptCoreFeatures(true, definition);
  const documentTypes = await promptDocumentTypes(true, true);
  const { builtInTools } = await promptAssistantTools([], true);
  expect(coreFeatures.mcp).toBe(false);
  expect(coreFeatures.attachments).toBe(false);
  expect(await promptObservability(true)).toEqual([]);
  expect(documentTypes).toEqual({ code: true, sheet: true, text: true });
  expect(builtInTools.webSearch).toBe(false);
  const input = {
    auth: { github: false, google: false, vercel: false },
    builtInTools,
    coreFeatures,
    gateway: "acme",
  };
  const entries = collectEnvChecklist({
    ...input,
    gatewayRequirements: definition.envRequirements,
  });
  expect(entries.map((entry) => entry.vars)).toEqual(
    // oxlint-disable-next-line typescript/no-unsafe-argument -- This test deliberately supplies a partial mock or asymmetric matcher; runtime assertions verify the exercised contract.
    expect.arrayContaining(["FIRST", "SECOND", "ALTERNATE"])
  );
  expect(() => collectEnvChecklist(input)).not.toThrow();
  expect(() =>
    collectEnvChecklist({ ...input, gatewayRequirements: [] })
  ).not.toThrow();
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/max-statements */

it("rejects a default for media the gateway cannot support", () => {
  const definition = externalGatewayFixture().root.meta.chatjs;
  definition.capabilities.image = false;
  definition.defaults.tools.image = { default: "unsupported" };
  expect(gatewayDefinitionSchema.safeParse(definition).success).toBe(false);
});

it("defaults media tool installation selections to false with --yes", async () => {
  const { builtInTools } = await promptAssistantTools([], true);
  expect(builtInTools.imageGeneration).toBe(false);
  expect(builtInTools.videoGeneration).toBe(false);
});

it.each([true, false])(
  "honors an explicit MCP installation choice with --yes: %s",
  async (mcp) => {
    const definition = externalGatewayFixture().root.meta.chatjs;
    const features = await promptCoreFeatures(true, definition, mcp);
    expect(features.mcp).toBe(mcp);
  }
);
