import { expect, it } from "bun:test";

import {
  promptAssistantTools,
  promptCoreFeatures,
  promptDocumentTypes,
  promptObservability,
} from "./prompts";
import { collectEnvChecklist } from "./env-checklist";
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { externalGatewayFixture } from "../../test/external-gateway";
/* oxlint-enable import/no-relative-parent-imports */
import { gatewayDefinitionSchema } from "@chat-js/gateways/definition";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve the test's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
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
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...input,
    gatewayRequirements: definition.envRequirements,
  });
  expect(entries.map((entry: { readonly vars: string }) => entry.vars)).toEqual(
    // oxlint-disable-next-line typescript/no-unsafe-argument -- This test deliberately supplies a partial mock or asymmetric matcher; runtime assertions verify the exercised contract.
    expect.arrayContaining(["FIRST", "SECOND", "ALTERNATE"])
  );
  expect(() => collectEnvChecklist(input)).not.toThrow();
  expect(() =>
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    collectEnvChecklist({ ...input, gatewayRequirements: [] })
  ).not.toThrow();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-statements */

it("rejects a default for media the gateway cannot support", () => {
  const definition = externalGatewayFixture().root.meta.chatjs;
  definition.capabilities.image = false;
  definition.defaults.tools.image = { default: "unsupported" };
  expect(gatewayDefinitionSchema.safeParse(definition).success).toBe(false);
});

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve the test's awaited sequencing and rejected-Promise behavior. */
it("defaults media tool installation selections to false with --yes", async () => {
  const { builtInTools } = await promptAssistantTools(
    [],
    true,
    externalGatewayFixture().root.meta.chatjs
  );
  expect(builtInTools.imageGeneration).toBe(false);
  expect(builtInTools.videoGeneration).toBe(false);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it.each([true, false])'s awaited sequencing and rejected-Promise behavior. */
it.each([true, false])(
  "honors an explicit MCP installation choice with --yes: %s",
  async (mcp) => {
    const definition = externalGatewayFixture().root.meta.chatjs;
    const features = await promptCoreFeatures(true, definition, mcp);
    expect(features.mcp).toBe(mcp);
  }
);
/* oxlint-enable oxc/no-async-await */
