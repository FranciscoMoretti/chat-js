import { expect, it } from "bun:test";

import {
  promptAssistantTools,
  promptCoreFeatures,
  promptDocumentTypes,
  promptObservability,
} from "./prompts";
import { collectEnvChecklist } from "./env-checklist";
import { externalGatewayFixture } from "../../test/external-gateway";
import { gatewayDefinitionSchema } from "@chat-js/gateways/definition";

it("uses external defaults and every environment group with --yes", async () => {
  const definition = externalGatewayFixture().root.meta.chatjs;
  definition.envRequirements = [
    { options: [["FIRST"]] },
    { options: [["SECOND"], ["ALTERNATE"]] },
  ];
  const coreFeatures = await promptCoreFeatures(true, definition);
  const documentTypes = await promptDocumentTypes(true, true);
  const { builtInTools } = await promptAssistantTools(
    [],
    true,
    externalGatewayFixture().root.meta.chatjs
  );
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
  const variables = entries.map(
    (entry: { readonly vars: string }) => entry.vars
  );
  for (const required of ["FIRST", "SECOND", "ALTERNATE"]) {
    expect(variables).toContain(required);
  }
  expect(() => collectEnvChecklist(input)).not.toThrow();
  expect(() =>
    collectEnvChecklist({ ...input, gatewayRequirements: [] })
  ).not.toThrow();
});

it("rejects a default for media the gateway cannot support", () => {
  const definition = externalGatewayFixture().root.meta.chatjs;
  definition.capabilities.image = false;
  definition.defaults.tools.image = { default: "unsupported" };
  expect(gatewayDefinitionSchema.safeParse(definition).success).toBe(false);
});

it("defaults media tool installation selections to false with --yes", async () => {
  const { builtInTools } = await promptAssistantTools(
    [],
    true,
    externalGatewayFixture().root.meta.chatjs
  );
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
