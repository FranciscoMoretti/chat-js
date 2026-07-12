import { z } from "zod";
import {
  applyDefaults,
  configDescriptionSchema,
  type ConfigInput,
} from "../../../../apps/chat/lib/config-schema";
import { GATEWAY_MODEL_DEFAULTS } from "../../../../apps/chat/lib/ai/gateway-model-defaults";
import type {
  AuthProvider,
  BuiltInToolKey,
  CoreFeatureKey,
  DocumentTypeKey,
  Gateway,
} from "../types";

function extractDescriptions(
  schema: z.ZodType,
  prefix = "",
  result: Map<string, string> = new Map(),
): Map<string, string> {
  if (schema.description && prefix) {
    result.set(prefix, schema.description);
  }

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    for (const [key, propSchema] of Object.entries(shape)) {
      const path = prefix ? `${prefix}.${key}` : key;
      extractDescriptions(propSchema as z.ZodType, path, result);
    }
  }

  if (schema instanceof z.ZodDiscriminatedUnion) {
    for (const option of schema.options.values()) {
      extractDescriptions(option, prefix, result);
    }
  }

  return result;
}

const descriptions = extractDescriptions(configDescriptionSchema);

const VALID_KEY_REGEX = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

const formatKey = (key: string) =>
  VALID_KEY_REGEX.test(key) ? key : JSON.stringify(key);

function formatValue(value: unknown, indent: number): string {
  const spaces = "  ".repeat(indent);
  const inner = "  ".repeat(indent + 1);

  if (value === null || value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    return Number.isInteger(value) && Math.abs(value) >= 10_000
      ? value.toLocaleString("en-US").replaceAll(",", "_")
      : String(value);
  }
  if (typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (value.every((item) => typeof item === "string")) {
      const inline = `[${value.map((item) => JSON.stringify(item)).join(", ")}]`;
      if (spaces.length + inline.length <= 80) return inline;
    }
    return `[\n${value
      .map((v) => `${inner}${formatValue(v, indent + 1)},`)
      .join("\n")}\n${spaces}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    return `{\n${entries
      .map(
        ([k, v]) => `${inner}${formatKey(k)}: ${formatValue(v, indent + 1)}`
      )
      .join(",\n")},\n${spaces}}`;
  }

  return String(value);
}

function generateConfig(
  obj: Record<string, unknown>,
  indent: number,
  pathPrefix: string
): string {
  const spaces = "  ".repeat(indent);

  return Object.entries(obj)
    .map(([key, value]) => {
      const path = pathPrefix ? `${pathPrefix}.${key}` : key;
      const desc = descriptions.get(path);
      const comment = desc ? ` // ${desc}` : "";

      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        const nested = generateConfig(
          value as Record<string, unknown>,
          indent + 1,
          path
        );
        return `${spaces}${formatKey(key)}: {\n${nested}\n${spaces}},${comment}`;
      }

      return `${spaces}${formatKey(key)}: ${formatValue(
        value,
        indent
      )},${comment}`;
    })
    .join("\n");
}

function toConfigInput(input: {
  appName: string;
  appPrefix: string;
  appUrl: string;
  withElectron: boolean;
  gateway: Gateway;
  coreFeatures: Record<CoreFeatureKey, boolean>;
  documentTypes: Record<DocumentTypeKey, boolean>;
  builtInTools: Record<BuiltInToolKey, boolean>;
  auth: Record<AuthProvider, boolean>;
}): ConfigInput {
  const gatewayToolDefaults = GATEWAY_MODEL_DEFAULTS[input.gateway].tools;
  const hasImageDefault =
    typeof (gatewayToolDefaults.image as { default?: unknown }).default ===
    "string";
  const hasVideoDefault =
    typeof (gatewayToolDefaults.video as { default?: unknown }).default ===
    "string";

  return {
    appName: input.appName,
    appPrefix: input.appPrefix,
    appUrl: input.appUrl,
    features: {
      attachments: input.coreFeatures.attachments,
      parallelResponses: input.coreFeatures.parallelResponses,
    },
    authentication: input.auth,
    desktopApp: {
      enabled: input.withElectron,
    },
    ai: {
      gateway: input.gateway,
      tools: {
        mcp: { enabled: input.coreFeatures.mcp },
        followupSuggestions: { enabled: input.coreFeatures.followupSuggestions },
        documents: {
          enabled: input.coreFeatures.documents,
          types: input.documentTypes,
        },
        webSearch: { enabled: input.builtInTools.webSearch },
        urlRetrieval: { enabled: input.builtInTools.urlRetrieval },
        deepResearch: { enabled: input.builtInTools.deepResearch },
        codeExecution: { enabled: input.builtInTools.codeExecution },
        image: {
          enabled: input.builtInTools.imageGeneration && hasImageDefault,
        },
        video: {
          enabled: input.builtInTools.videoGeneration && hasVideoDefault,
        },
      },
    },
  } as ConfigInput;
}

export function buildConfigTs(input: {
  appName: string;
  appPrefix: string;
  appUrl: string;
  withElectron: boolean;
  gateway: Gateway;
  coreFeatures: Record<CoreFeatureKey, boolean>;
  documentTypes: Record<DocumentTypeKey, boolean>;
  builtInTools: Record<BuiltInToolKey, boolean>;
  auth: Record<AuthProvider, boolean>;
}): string {
  const fullConfig = applyDefaults(toConfigInput(input));

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

export default config;
`;
}
