import { builtInGateways } from "./registry/gateways";

type PackageManager = "bun" | "npm" | "pnpm" | "yarn";

const GATEWAYS = builtInGateways.map(
  (
    item: Readonly<{
      meta: Readonly<{
        chatjs: Readonly<{
          id: (typeof builtInGateways)[number]["meta"]["chatjs"]["id"];
        }>;
      }>;
    }>
  ) => item.meta.chatjs.id
);

type Gateway = string;

const AUTH_PROVIDERS = ["google", "github", "vercel"] as const;

type AuthProvider = (typeof AUTH_PROVIDERS)[number];

const CORE_FEATURE_KEYS = [
  "attachments",
  "parallelResponses",
  "documents",
  "mcp",
  "followupSuggestions",
] as const;

type CoreFeatureKey = (typeof CORE_FEATURE_KEYS)[number];

const DOCUMENT_TYPE_KEYS = ["text", "code", "sheet"] as const;

type DocumentTypeKey = (typeof DOCUMENT_TYPE_KEYS)[number];

const BUILT_IN_TOOL_KEYS = [
  "webSearch",
  "urlRetrieval",
  "deepResearch",
  "codeExecution",
  "imageGeneration",
  "videoGeneration",
] as const;

type BuiltInToolKey = (typeof BUILT_IN_TOOL_KEYS)[number];
export {
  AUTH_PROVIDERS,
  BUILT_IN_TOOL_KEYS,
  CORE_FEATURE_KEYS,
  DOCUMENT_TYPE_KEYS,
  GATEWAYS,
};
export type {
  AuthProvider,
  BuiltInToolKey,
  CoreFeatureKey,
  DocumentTypeKey,
  Gateway,
  PackageManager,
};
