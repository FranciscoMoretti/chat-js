import { expect, it, spyOn } from "bun:test";
import * as clack from "@clack/prompts";

import { promptAuth } from "./prompts";
import { collectEnvChecklist } from "./env-checklist";
import { externalGatewayFixture } from "../../test/external-gateway";
import { gatewayDefinitionSchema } from "../../../registry/src/gateways/definition";
import { AUTH_PROVIDERS } from "../types";

it("opens Authentication with the current selections", async () => {
  const multiselect = spyOn(clack, "multiselect").mockResolvedValue(["vercel"]);
  try {
    const auth = await promptAuth(["google"]);
    expect(multiselect.mock.calls[0]?.[0].initialValues).toEqual(["google"]);
    expect(
      multiselect.mock.calls[0]?.[0].options.map((option) => option.value)
    ).toEqual([...AUTH_PROVIDERS]);
    expect(auth).toEqual(["vercel"]);
  } finally {
    multiselect.mockRestore();
  }
});

it("uses external defaults and every environment group with --yes", () => {
  const definition = externalGatewayFixture().root.meta.chatjs;
  definition.envRequirements = [
    { options: [["FIRST"]] },
    { options: [["SECOND"], ["ALTERNATE"]] },
  ];
  const coreFeatures = {
    attachments: false,
    followupSuggestions: false,
    feedback: false,
    mcp: false,
    projects: false,
    parallelResponses: true,
  };
  const input = {
    auth: { github: false, google: false, vercel: false },
    coreFeatures,
    gateway: "acme",
  };
  const entries = collectEnvChecklist({
    ...input,
    gatewayRequirements: definition.envRequirements,
  });
  const variables = entries.flatMap(({ requirements }) =>
    requirements.flatMap(({ options }) => options.flat())
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
