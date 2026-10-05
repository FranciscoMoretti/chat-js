import type { GatewayDefinition } from "@chat-js/gateways/definition";
import { z } from "zod";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import {
  applyDefaults,
  configDescriptionSchema,
} from "../../../../apps/chat/lib/config-schema";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { builtInGateways } from "../registry/gateways";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import type { AuthProvider, CoreFeatureKey, Gateway } from "../types";
/* oxlint-enable import/no-relative-parent-imports */
import type { ReadonlyInput } from "./readonly-input";

const defaultsFor = (
  input: ReadonlyInput<{
    gateway: string;
    gatewayDefaults?: GatewayDefinition["defaults"];
  }>
): ReadonlyInput<GatewayDefinition["defaults"]> => {
  const defaults =
    input.gatewayDefaults ??
    builtInGateways.find(
      (item: ReadonlyInput<(typeof builtInGateways)[number]>): boolean =>
        item.meta.chatjs.id === input.gateway
    )?.meta.chatjs.defaults;
  if (!defaults) {
    throw new Error(`Missing registry defaults for gateway ${input.gateway}`);
  }
  return defaults;
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
        visit(property, prefix === "" ? key : `${prefix}.${key}`);
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

const formatKey = (key: string): string =>
  VALID_KEY_REGEX.test(key) ? key : JSON.stringify(key);

const compareEntryKeys = (
  [left]: readonly [string, unknown],
  [right]: readonly [string, unknown]
): number => left.localeCompare(right);

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
const formatValue = (value: unknown, indent: number): string => {
  const spaces = "  ".repeat(indent);
  const inner = "  ".repeat(indent + 1);

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

  // oxlint-disable-next-line typescript/no-base-to-string -- Diagnostic formatting intentionally accepts arbitrary third-party values; changing their representation requires an error-output contract decision.
  return String(value);
};
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const generateConfig = (
  obj: object,
  indent: number,
  pathPrefix: string
): string => {
  const spaces = "  ".repeat(indent);

  return Object.entries(obj)
    .toSorted(compareEntryKeys)
    .map(([key, value]: readonly [string, unknown]): string => {
      const path = pathPrefix ? `${pathPrefix}.${key}` : key;
      const desc = descriptions.get(path);
      const comment =
        typeof desc === "string" && desc !== "" ? `${spaces}// ${desc}\n` : "";

      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        const nested = generateConfig(value, indent + 1, path);
        return `${comment}${spaces}${formatKey(key)}: {\n${nested}\n${spaces}},`;
      }

      return `${comment}${spaces}${formatKey(key)}: ${formatValue(value, indent)},`;
    })
    .join("\n");
};
/* oxlint-enable eslint/no-magic-numbers */

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

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const buildConfigTs = (input: {
  appName: string;
  appPrefix: string;
  appUrl: string;
  withElectron: boolean;
  gateway: Gateway;
  gatewayDefaults?: GatewayDefinition["defaults"];
  coreFeatures: Record<CoreFeatureKey, boolean>;
  auth: Record<AuthProvider, boolean>;
}): string => {
  const partial = toConfigInput(input);
  const { ai, ...appConfig } = partial;
  const defaults = defaultsFor(input);
  const toolOverrides: Record<string, object> = ai.tools;
  const tools = Object.fromEntries(
    Object.entries(defaults.tools).map(([name, value]) => [
      name,
      { ...value, ...toolOverrides[name] },
    ])
  );
  const fullConfig = {
    ...applyDefaults(appConfig),
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
