import { aiConfigSchema, applyDefaults, defineConfig } from "./config-schema";

import { expect, test } from "vitest";
import { gatewayModelDefaults, gatewayType } from "./ai/gateway-model-defaults";

test("partial tool and workflow overrides retain required sibling defaults", () => {
  const input = defineConfig({
    ai: {
      gateway: gatewayType,
      tools: { followupSuggestions: { enabled: true } },
      workflows: { title: gatewayModelDefaults.workflows.chat },
    },
  });
  const config = applyDefaults(input);
  expect(config.ai.tools.followupSuggestions).toEqual({
    enabled: true,
    default: gatewayModelDefaults.roles.fast,
  });
  expect(config.ai.workflows).toMatchObject({
    chat: gatewayModelDefaults.workflows.chat,
    title: gatewayModelDefaults.workflows.chat,
  });
  expect(input).toHaveProperty("ai.tools", {
    followupSuggestions: { enabled: true },
  });
  expect(defineConfig(input)).toBe(input);
});

test("readonly config inputs preserve selections without changing the source", () => {
  const input = {
    ai: {
      curatedDefaults: [gatewayModelDefaults.workflows.title],
      gateway: gatewayType,
      tools: { followupSuggestions: { enabled: true } },
    },
  } as const;
  const config = applyDefaults(input);
  expect(config.ai.curatedDefaults).toEqual([
    gatewayModelDefaults.workflows.title,
  ]);
  expect(config.ai.tools.followupSuggestions).toEqual({
    default: gatewayModelDefaults.roles.fast,
    enabled: true,
  });
  expect(input.ai.tools.followupSuggestions).toEqual({ enabled: true });
});

test.each(["image", "video"])(
  "rejects empty %s model IDs at the configuration boundary",
  (kind) => {
    const config = applyDefaults(defineConfig({}));
    const invalid = {
      ...config.ai,
      tools: { ...config.ai.tools, [kind]: { default: "" } },
    };
    expect(aiConfigSchema.safeParse(invalid).success).toBe(false);
  }
);

test("rejects empty workflow model IDs at the configuration boundary", () => {
  const config = applyDefaults(defineConfig({}));
  expect(
    aiConfigSchema.safeParse({
      ...config.ai,
      workflows: { ...config.ai.workflows, chat: "" },
    }).success
  ).toBe(false);
});
