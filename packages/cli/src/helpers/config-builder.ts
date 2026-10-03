import type { GatewayDefinition } from "@chat-js/gateways/definition";
import { z } from "zod";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import {
  applyDefaults,
  configDescriptionSchema,
} from "../../../../apps/chat/lib/config-schema";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { builtInGateways } from "../registry/gateways";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import type { AuthProvider, CoreFeatureKey, Gateway } from "../types";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const defaultsFor = (input: {
  gateway: string;
  gatewayDefaults?: GatewayDefinition["defaults"];
}) => {
  const defaults =
    input.gatewayDefaults ??
    builtInGateways.find(
      (item): boolean => item.meta.chatjs.id === input.gateway
    )?.meta.chatjs.defaults;
  if (!defaults) {
    throw new Error(`Missing registry defaults for gateway ${input.gateway}`);
  }
  return defaults;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const extractDescriptions = (
  schema: z.ZodType,
  prefix = "",
  result = new Map<string, string>()
): Map<string, string> => {
  if (
    typeof schema.description === "string" &&
    schema.description !== "" &&
    prefix
  ) {
    result.set(prefix, schema.description);
  }

  if (schema instanceof z.ZodObject) {
    const { shape } = schema;
    for (const [key, propSchema] of Object.entries(shape)) {
      const path = prefix ? `${prefix}.${key}` : key;
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Configuration traversal supports heterogeneous Zod schemas and nested values; a stricter schema visitor would alter generated configuration support.
      extractDescriptions(propSchema as z.ZodType, path, result);
    }
  }

  if (schema instanceof z.ZodDiscriminatedUnion) {
    for (const option of schema.options.values()) {
      if (option instanceof z.ZodType) {
        extractDescriptions(option, prefix, result);
      }
    }
  }

  return result;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable eslint/max-statements */

const descriptions = extractDescriptions(configDescriptionSchema);

const VALID_KEY_REGEX = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/u;

/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
const formatKey = (key: string): string =>
  VALID_KEY_REGEX.test(key) ? key : JSON.stringify(key);
/* oxlint-enable eslint/no-ternary */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
    if (value.length === 0) {
      return "[]";
    }
    if (value.every((v) => typeof v === "string")) {
      return `[${value.map((v): string => JSON.stringify(v)).join(", ")}]`;
    }
    return `[\n${value
      .map((v): string => `${inner}${formatValue(v, indent + 1)}`)
      .join(",\n")}\n${spaces}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value).toSorted(([left], [right]): number =>
      left.localeCompare(right)
    );
    if (entries.length === 0) {
      return "{}";
    }
    return `{\n${entries
      .map(
        ([k, v]): string =>
          `${inner}${formatKey(k)}: ${formatValue(v, indent + 1)}`
      )
      .join(",\n")},\n${spaces}}`;
  }

  // oxlint-disable-next-line typescript/no-base-to-string -- Diagnostic formatting intentionally accepts arbitrary third-party values; changing their representation requires an error-output contract decision.
  return String(value);
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/id-length */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const generateConfig = (
  obj: Record<string, unknown>,
  indent: number,
  pathPrefix: string
): string => {
  const spaces = "  ".repeat(indent);

  return Object.entries(obj)
    .toSorted(([left], [right]): number => left.localeCompare(right))
    .map(([key, value]): string => {
      const path = pathPrefix ? `${pathPrefix}.${key}` : key;
      const desc = descriptions.get(path);
      const comment =
        typeof desc === "string" && desc !== "" ? `${spaces}// ${desc}\n` : "";

      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        const nested = generateConfig(
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Configuration traversal supports heterogeneous Zod schemas and nested values; a stricter schema visitor would alter generated configuration support.
          value as Record<string, unknown>,
          indent + 1,
          path
        );
        return `${comment}${spaces}${formatKey(key)}: {\n${nested}\n${spaces}},`;
      }

      return `${comment}${spaces}${formatKey(key)}: ${formatValue(value, indent)},`;
    })
    .join("\n");
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/no-ternary */

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const toConfigInput = (input: {
  appName: string;
  appPrefix: string;
  appUrl: string;
  withElectron: boolean;
  gateway: Gateway;
  gatewayDefaults?: GatewayDefinition["defaults"];
  coreFeatures: Record<CoreFeatureKey, boolean>;
  auth: Record<AuthProvider, boolean>;
}) => ({
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
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
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
