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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (AUTH_PROVIDERS, BUILT_IN_TOOL_KEYS, CORE_FEATURE_KEYS, DOCUMENT_TYPE_KEYS, GATEWAYS); the enabled import/no-default-export convention rejects the default-export alternative. */
export {
  AUTH_PROVIDERS,
  BUILT_IN_TOOL_KEYS,
  CORE_FEATURE_KEYS,
  DOCUMENT_TYPE_KEYS,
  GATEWAYS,
};
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (AuthProvider, BuiltInToolKey, CoreFeatureKey, DocumentTypeKey, Gateway, PackageManager); the enabled import/no-default-export convention rejects the default-export alternative. */
export type {
  AuthProvider,
  BuiltInToolKey,
  CoreFeatureKey,
  DocumentTypeKey,
  Gateway,
  PackageManager,
};
/* oxlint-enable import/no-named-export */
