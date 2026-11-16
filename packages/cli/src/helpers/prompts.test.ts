import { expect, it, spyOn } from "bun:test";
import * as clack from "@clack/prompts";

import {
  promptAssistantTools,
  promptSandbox,
  promptAuth,
  promptCoreFeatures,
} from "./prompts";
import { collectEnvChecklist } from "./env-checklist";
import { externalGatewayFixture } from "../../test/external-gateway";
import { gatewayDefinitionSchema } from "@chat-js/gateways/definition";
import {
  AUTH_PROVIDERS,
  BUILT_IN_TOOL_KEYS,
  CORE_FEATURE_KEYS,
} from "../types";

it("returns complete selections from interactive prompts in catalog order", async () => {
  const multiselect = spyOn(clack, "multiselect")
    .mockResolvedValueOnce(["github"])
    .mockResolvedValueOnce(["parallelResponses"])
    .mockResolvedValueOnce(["deepResearch"]);

  try {
    const auth = await promptAuth(false);
    expect(auth).toEqual({ github: true, google: false, vercel: false });
    expect(Object.keys(auth)).toEqual([...AUTH_PROVIDERS]);

    const definition = externalGatewayFixture().root.meta.chatjs;
    const plugins = await promptCoreFeatures(false, true);
    expect(plugins).toEqual({
      attachments: false,
      followupSuggestions: false,
      feedback: false,
      mcp: true,
      projects: false,
      parallelResponses: true,
    });
    expect(Object.keys(plugins)).toEqual([...CORE_FEATURE_KEYS]);

    const { builtInTools, installableTools } = await promptAssistantTools(
      [],
      false,
      definition
    );
    expect(builtInTools).toEqual({
      deepResearch: true,
      imageGeneration: false,
      videoGeneration: false,
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
  expect(coreFeatures.mcp).toBe(false);
  expect(coreFeatures.attachments).toBe(false);
  const input = {
    auth: { github: false, google: false, vercel: false },
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
it.each([true, false])(
  "honors an explicit MCP installation choice with --yes: %s",
  async (mcp) => {
    const plugins = await promptCoreFeatures(true, mcp);
    expect(plugins.mcp).toBe(mcp);
  }
);

it("offers native environments and defaults noninteractive creation to Automatic", async () => {
  const select = spyOn(clack, "select").mockResolvedValue("vercel");
  try {
    expect(await promptSandbox(false)).toBe("vercel");
    expect(
      select.mock.calls[0]?.[0].options.map((option) => option.value)
    ).toEqual(["default", "vercel", "docker", "just-bash"]);
    expect(await promptSandbox(true)).toBe("default");
  } finally {
    select.mockRestore();
  }
});
