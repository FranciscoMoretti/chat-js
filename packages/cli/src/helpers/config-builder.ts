import type { GatewayDefinition } from "@chat-js/gateways/definition";
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { builtInGateways } from "#cli/registry/gateways";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { AuthProvider, CoreFeatureKey, Gateway } from "#cli/types";
/* oxlint-enable sort-imports */

import {
  applyDefaults,
  configDescriptionSchema,
  // oxlint-disable-next-line import/no-relative-parent-imports -- This shared registry or app schema is outside the CLI package and is bundled into its published executable.
} from "../../../../apps/chat/lib/config-schema";
import type { ReadonlyInput } from "./readonly-input";

const defaultsFor = (
  input: ReadonlyInput<{
    gateway: string;
    gatewayDefaults?: GatewayDefinition["defaults"];
  }>
): ReadonlyInput<GatewayDefinition["defaults"]> => {
  const defaults =
    input.gatewayDefaults ??
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading meta from builtInGateways.find(...); preserve one receiver evaluation, skipped accesses and the existing builtInGateways.find(       (item: ReadonlyInput<(typeof builtInGateways)[number]>): boolean =>         item.meta.chatjs.id === input.gateway     )?.meta.chatjs.defaults fallback.
    builtInGateways.find(
      (item: ReadonlyInput<(typeof builtInGateways)[number]>): boolean =>
        item.meta.chatjs.id === input.gateway
    )?.meta.chatjs.defaults;
  if (!defaults) {
    throw new Error(`Missing registry defaults for gateway ${input.gateway}`);
  }
  return defaults;
};

const configPropertyPath = (prefix: string, key: string): string => {
  if (prefix === "") {
    return key;
  }
  return `${prefix}.${key}`;
};

const extractDescriptions = (schema: unknown): ReadonlyMap<string, string> => {
  const result = new Map<string, string>();
  const visit = (node: unknown, prefix: string): void => {
    if (!(node instanceof z.ZodType)) {
      return;
    }
    if (
      typeof node.description === "string" &&
      node.description !== "" &&
      prefix !== ""
    ) {
      result.set(prefix, node.description);
    }

    if (node instanceof z.ZodObject) {
      for (const [key, property] of Object.entries(node.shape)) {
        visit(property, configPropertyPath(prefix, key));
      }
    }
    if (node instanceof z.ZodDiscriminatedUnion) {
      for (const option of node.options.values()) {
        visit(option, prefix);
      }
    }
  };
  visit(schema, "");
  return result;
};

const descriptions = extractDescriptions(configDescriptionSchema);

const VALID_KEY_REGEX = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/u;

const formatKey = (key: string): string => {
  if (VALID_KEY_REGEX.test(key)) {
    return key;
  }
  return JSON.stringify(key);
};

const compareEntryKeys = (
  [left]: readonly [string, unknown],
  [right]: readonly [string, unknown]
): number => left.localeCompare(right);

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const formatValue = (value: unknown, indent: number): string => {
  const spaces = "  ".repeat(indent);
  const inner = "  ".repeat(indent + 1);

  // oxlint-disable-next-line eslint/no-undefined -- Missing config values serialize as the TypeScript undefined token; unicorn/no-typeof-undefined requires the direct comparison.
  if (value === null || value === undefined) {
    return "undefined";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    Math.abs(value) >= 10_000
  ) {
    return String(value).replaceAll(/\d(?=(?:\d{3})+$)/gu, "$&_");
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    const values: readonly unknown[] = value;
    if (values.length === 0) {
      return "[]";
    }
    if (values.every((entry) => typeof entry === "string")) {
      return `[${values.map((entry): string => JSON.stringify(entry)).join(", ")}]`;
    }
    return `[\n${values
      .map((entry): string => `${inner}${formatValue(entry, indent + 1)}`)
      .join(",\n")}\n${spaces}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value).toSorted(compareEntryKeys);
    if (entries.length === 0) {
      return "{}";
    }
    return `{\n${entries
      .map(
        ([key, entry]: readonly [string, unknown]): string =>
          `${inner}${formatKey(key)}: ${formatValue(entry, indent + 1)}`
      )
      .join(",\n")},\n${spaces}}`;
  }

  // oxlint-disable-next-line typescript/no-base-to-string -- Objects and arrays are handled above; remaining symbols or callable config values preserve the existing source serializer fallback.
  return String(value);
};
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-statements */

const generateConfig = (
  obj: object,
  indent: number,
  pathPrefix: string
): string => {
  const spaces = "  ".repeat(indent);

  return Object.entries(obj)
    .toSorted(compareEntryKeys)
    .map(([key, value]: readonly [string, unknown]): string => {
      const path = configPropertyPath(pathPrefix, key);
      const desc = descriptions.get(path);
      let comment = "";
      if (typeof desc === "string" && desc !== "") {
        comment = `${spaces}// ${desc}\n`;
      }

      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        // oxlint-disable-next-line eslint/no-magic-numbers -- Each nested configuration object advances indentation by exactly one level.
        const nested = generateConfig(value, indent + 1, path);
        return `${comment}${spaces}${formatKey(key)}: {\n${nested}\n${spaces}},`;
      }

      return `${comment}${spaces}${formatKey(key)}: ${formatValue(value, indent)},`;
    })
    .join("\n");
};

const toConfigInput = (
  input: ReadonlyInput<{
    appName: string;
    appPrefix: string;
    appUrl: string;
    withElectron: boolean;
    gateway: Gateway;
    gatewayDefaults?: GatewayDefinition["defaults"];
    coreFeatures: Record<CoreFeatureKey, boolean>;
    auth: Record<AuthProvider, boolean>;
  }>
): {
  ai: {
    gateway: Gateway;
    tools: { followupSuggestions: { enabled: boolean } };
  };
  appName: string;
  appPrefix: string;
  appUrl: string;
  authentication: Readonly<Record<AuthProvider, boolean>>;
  desktopApp: { enabled: boolean };
  features: { parallelResponses: boolean };
} => ({
  ai: {
    gateway: input.gateway,
    tools: {
      followupSuggestions: {
        enabled: input.coreFeatures.followupSuggestions,
      },
    },
  },
  appName: input.appName,
  appPrefix: input.appPrefix,
  appUrl: input.appUrl,
  authentication: input.auth,
  desktopApp: {
    enabled: input.withElectron,
  },
  features: {
    parallelResponses: input.coreFeatures.parallelResponses,
  },
});

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (buildConfigTs); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
export const buildConfigTs = (
  input: ReadonlyInput<{
    appName: string;
    appPrefix: string;
    appUrl: string;
    withElectron: boolean;
    gateway: Gateway;
    gatewayDefaults?: GatewayDefinition["defaults"];
    coreFeatures: Record<CoreFeatureKey, boolean>;
    auth: Record<AuthProvider, boolean>;
  }>
): string => {
  const partial = toConfigInput(input);
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding appConfig excludes ai from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  const { ai, ...appConfig } = partial;
  const defaults = defaultsFor(input);
  const toolOverrides: Record<string, object> = ai.tools;
  const tools = Object.fromEntries(
    Object.entries(defaults.tools).map(
      ([name, value]: readonly [
        string,
        ReadonlyInput<(typeof defaults.tools)[keyof typeof defaults.tools]>,
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing value own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement. Keep the existing toolOverrides[name] own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ]) => [name, { ...value, ...toolOverrides[name] }]
    )
  );
  const fullConfig = {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing applyDefaults(appConfig) own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...applyDefaults(appConfig),
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing defaults own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement. Keep the existing ai own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ai: { ...defaults, ...ai, tools },
  };

  return `import { defineConfig } from "@/lib/config-schema";

/**
 * ChatJS Configuration
 *
 * Edit this file to customize your app.
 * @see https://chatjs.dev/docs/reference/config
 */
const config = defineConfig({
${generateConfig(fullConfig, 1, "")}
});

// oxlint-disable-next-line import/no-default-export -- The app configuration loader imports this single configuration object as the module default.
export default config;
`;
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable eslint/no-magic-numbers */
