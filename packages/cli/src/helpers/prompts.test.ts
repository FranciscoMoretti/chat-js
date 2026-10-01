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
  definition.envRequirements = [
    { options: [["FIRST"]] },
    { options: [["SECOND"], ["ALTERNATE"]] },
  ];
  const coreFeatures = await promptCoreFeatures(true, definition);
  const documentTypes = await promptDocumentTypes(true, true, definition);
  const { builtInTools } = await promptAssistantTools([], true, definition);
  expect(coreFeatures.mcp).toBe(false);
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
  definition.defaults.tools.image = { default: "unsupported" };
  expect(gatewayDefinitionSchema.safeParse(definition).success).toBe(false);
});

it("keeps unconfigured media tools disabled with --yes", async () => {
  const definition = externalGatewayFixture().root.meta.chatjs;
  definition.capabilities.image = false;
  definition.capabilities.video = false;
  definition.defaults.tools.image = {};
  definition.defaults.tools.video = {};
  const { builtInTools } = await promptAssistantTools([], true, definition);
  expect(builtInTools.imageGeneration).toBe(false);
  expect(builtInTools.videoGeneration).toBe(false);
});
