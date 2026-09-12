import { expect, it } from "bun:test";

import { gatewayDefinitionSchema } from "@chat-js/gateways/definition";

import { externalGatewayFixture } from "../../test/external-gateway";
import { collectEnvChecklist } from "./env-checklist";
import {
  promptAssistantTools,
  promptCoreFeatures,
  promptDocumentTypes,
} from "./prompts";

it("uses external defaults and every environment group with --yes", async () => {
  const definition = externalGatewayFixture().root.meta.chatjs;
  definition.defaults.tools.documents.types = {
    code: true,
    sheet: false,
    text: false,
  };
  definition.defaults.tools.mcp.enabled = true;
  definition.defaults.tools.webSearch.enabled = true;
  definition.envRequirements = [
    { options: [["FIRST"]] },
    { options: [["SECOND"], ["ALTERNATE"]] },
  ];
  const coreFeatures = await promptCoreFeatures(true, definition);
  const documentTypes = await promptDocumentTypes(true, true, definition);
  const { builtInTools } = await promptAssistantTools([], true, definition);
  expect(coreFeatures.mcp).toBe(true);
  expect(documentTypes).toEqual({ code: true, sheet: false, text: false });
  expect(builtInTools.webSearch).toBe(true);
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
    expect.arrayContaining(["FIRST", "SECOND", "ALTERNATE"])
  );
  expect(() => collectEnvChecklist(input)).not.toThrow();
  expect(() =>
    collectEnvChecklist({ ...input, gatewayRequirements: [] })
  ).not.toThrow();
});

it("rejects a default for media the gateway cannot support", () => {
  const definition = externalGatewayFixture().root.meta.chatjs;
  definition.capabilities.image = false;
  definition.defaults.tools.image = { default: "unsupported", enabled: false };
  expect(gatewayDefinitionSchema.safeParse(definition).success).toBe(false);
});

it("enables web search when external defaults enable deep research", async () => {
  const definition = externalGatewayFixture().root.meta.chatjs;
  definition.defaults.tools.webSearch.enabled = false;
  definition.defaults.tools.deepResearch.enabled = true;
  const { builtInTools } = await promptAssistantTools([], true, definition);
  expect(builtInTools.deepResearch).toBe(true);
  expect(builtInTools.webSearch).toBe(true);
});

it("keeps unconfigured media tools disabled with --yes", async () => {
  const definition = externalGatewayFixture().root.meta.chatjs;
  definition.capabilities.image = false;
  definition.capabilities.video = false;
  definition.defaults.tools.image = { enabled: false };
  definition.defaults.tools.video = { enabled: false };
  const { builtInTools } = await promptAssistantTools([], true, definition);
  expect(builtInTools.imageGeneration).toBe(false);
  expect(builtInTools.videoGeneration).toBe(false);
});
