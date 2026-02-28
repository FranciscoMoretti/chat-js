import { z } from "zod";
import { configSchema } from "../../../../apps/chat/lib/config-schema";
import type { AuthProvider, FeatureKey, Gateway } from "../types";
import type { Config } from "../../../../apps/chat/lib/config-schema";

function extractDescriptions(
  schema: z.ZodType,
  prefix = "",
  result: Map<string, string> = new Map()
): Map<string, string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let unwrapped: any = schema;
  while (
    unwrapped instanceof z.ZodDefault ||
    unwrapped instanceof z.ZodOptional
  ) {
    unwrapped = unwrapped._zod.def.innerType;
  }

  if (unwrapped.description && prefix) {
    result.set(prefix, unwrapped.description);
  }

  if (unwrapped instanceof z.ZodObject) {
    const shape = unwrapped._zod.def.shape;
    for (const [key, propSchema] of Object.entries(shape)) {
      const path = prefix ? `${prefix}.${key}` : key;
      extractDescriptions(propSchema as z.ZodType, path, result);
    }
  }

  return result;
}

const descriptions = extractDescriptions(configSchema);

const VALID_KEY_REGEX = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
const formatKey = (key: string) =>
  VALID_KEY_REGEX.test(key) ? key : JSON.stringify(key);

function formatValue(value: unknown, indent: number): string {
  const spaces = "  ".repeat(indent);
  const inner = "  ".repeat(indent + 1);

  if (value === null || value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (value.every((v) => typeof v === "string")) {
      return `[${value.map((v) => JSON.stringify(v)).join(", ")}]`;
    }
    return `[\n${value.map((v) => `${inner}${formatValue(v, indent + 1)}`).join(",\n")}\n${spaces}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    return `{\n${entries.map(([k, v]) => `${inner}${formatKey(k)}: ${formatValue(v, indent + 1)}`).join(",\n")},\n${spaces}}`;
  }

  return String(value);
}

function generateConfig(
  obj: Record<string, unknown>,
  indent: number,
  pathPrefix: string,
  descs: Map<string, string>
): string {
  const spaces = "  ".repeat(indent);

  return Object.entries(obj)
    .map(([key, value]) => {
      const path = pathPrefix ? `${pathPrefix}.${key}` : key;
      const desc = descs.get(path);
      const comment = desc ? ` // ${desc}` : "";

      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        const nested = generateConfig(
          value as Record<string, unknown>,
          indent + 1,
          path,
          descs
        );
        return `${spaces}${formatKey(key)}: {\n${nested}\n${spaces}},`;
      }

      return `${spaces}${formatKey(key)}: ${formatValue(value, indent)},${comment}`;
    })
    .join("\n");
}

export function buildConfigTs(input: {
  appName: string;
  appPrefix: string;
  appUrl: string;
  gateway: Gateway;
  features: Record<FeatureKey, boolean>;
  auth: Record<AuthProvider, boolean>;
}): string {
  const fullConfig: Omit<Config, "ai"> & { ai: { gateway: Gateway } } = {
    appPrefix: input.appPrefix,
    appName: input.appName,
    appDescription: "AI chat powered by ChatJS",
    appUrl: input.appUrl,
    organization: {
      name: "Your Organization",
      contact: {
        privacyEmail: "privacy@your-domain.com",
        legalEmail: "legal@your-domain.com",
      },
    },
    services: {
      hosting: "Vercel",
      aiProviders: ["OpenAI", "Anthropic", "Google"],
      paymentProcessors: [],
    },
    features: input.features,
    legal: {
      minimumAge: 13,
      governingLaw: "United States",
      refundPolicy: "no-refunds",
    },
    policies: {
      privacy: { title: "Privacy Policy" },
      terms: { title: "Terms of Service" },
    },
    authentication: input.auth,
    ai: { gateway: input.gateway },
    anonymous: {
      credits: 10,
      availableTools: [],
      rateLimit: {
        requestsPerMinute: 5,
        requestsPerMonth: 10,
      },
    },
    attachments: {
      maxBytes: 1048576,
      maxDimension: 2048,
      acceptedTypes: {
        "image/png": [".png"],
        "image/jpeg": [".jpg", ".jpeg"],
        "application/pdf": [".pdf"],
      },
    },
  };

  return `import { defineConfig } from "@/lib/config-schema";

/**
 * ChatJS Configuration
 *
 * Edit this file to customize your app.
 * @see https://chatjs.dev/docs/reference/config
 */
const config = defineConfig({
${generateConfig(fullConfig, 1, "", descriptions)}
});

export default config;
`;
}
