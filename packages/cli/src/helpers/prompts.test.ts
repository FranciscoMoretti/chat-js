import { expect, it, spyOn } from "bun:test";
import * as clack from "@clack/prompts";

import {
  promptAssistantTools,
  promptAuth,
  promptCoreFeatures,
  promptDocumentTypes,
  promptObservability,
} from "./prompts";
import { collectEnvChecklist } from "./env-checklist";
import { externalGatewayFixture } from "../../test/external-gateway";
import { gatewayDefinitionSchema } from "@chat-js/gateways/definition";
import {
  AUTH_PROVIDERS,
  BUILT_IN_TOOL_KEYS,
  CORE_FEATURE_KEYS,
  DOCUMENT_TYPE_KEYS,
} from "../types";

it("returns complete selections from interactive prompts in catalog order", async () => {
  const multiselect = spyOn(clack, "multiselect")
    .mockResolvedValueOnce(["github"])
    .mockResolvedValueOnce(["parallelResponses", "documents"])
    .mockResolvedValueOnce(["sheet"])
    .mockResolvedValueOnce(["deepResearch"]);

  try {
    const auth = await promptAuth(false);
    expect(auth).toEqual({ github: true, google: false, vercel: false });
    expect(Object.keys(auth)).toEqual([...AUTH_PROVIDERS]);

    const definition = externalGatewayFixture().root.meta.chatjs;
    const features = await promptCoreFeatures(false, true);
    expect(features).toEqual({
      attachments: false,
      documents: true,
      followupSuggestions: false,
      mcp: true,
      parallelResponses: true,
    });
    expect(Object.keys(features)).toEqual([...CORE_FEATURE_KEYS]);

    const documents = await promptDocumentTypes(false, true);
    expect(documents).toEqual({ code: false, sheet: true, text: false });
    expect(Object.keys(documents)).toEqual([...DOCUMENT_TYPE_KEYS]);

    const { builtInTools, installableTools } = await promptAssistantTools(
      [],
      false,
      definition
    );
    expect(builtInTools).toEqual({
      codeExecution: false,
      deepResearch: true,
      imageGeneration: false,
      urlRetrieval: false,
      videoGeneration: false,
      webSearch: true,
    });
    expect(Object.keys(builtInTools)).toEqual([...BUILT_IN_TOOL_KEYS]);
    expect(installableTools).toEqual([]);
  } finally {
    multiselect.mockRestore();
  }
});

it("uses external defaults and every environment group with --yes", async () => {
  const definition = externalGatewayFixture().root.meta.chatjs;
  definition.envRequirements = [
    { options: [["FIRST"]] },
    { options: [["SECOND"], ["ALTERNATE"]] },
  ];
  const coreFeatures = await promptCoreFeatures(true);
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
  definition.defaults.roles.image = "unsupported";
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

it("disables every document type when documents are not installed", async () => {
  expect(await promptDocumentTypes(true, false)).toEqual({
    code: false,
    sheet: false,
    text: false,
  });
});
it.each([true, false])(
  "honors an explicit MCP installation choice with --yes: %s",
  async (mcp) => {
    const features = await promptCoreFeatures(true, mcp);
    expect(features.mcp).toBe(mcp);
  }
);
