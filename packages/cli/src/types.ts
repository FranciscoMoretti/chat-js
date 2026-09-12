import { builtInGateways } from "./registry/gateways";

export type PackageManager = "bun" | "npm" | "pnpm" | "yarn";
export const GATEWAYS = builtInGateways.map((item) => item.meta.chatjs.id);
export type Gateway = string;

export const AUTH_PROVIDERS = ["google", "github", "vercel"] as const;

export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export const CORE_FEATURE_KEYS = [
  "attachments",
  "parallelResponses",
  "documents",
  "mcp",
  "followupSuggestions",
] as const;

export type CoreFeatureKey = (typeof CORE_FEATURE_KEYS)[number];

export const DOCUMENT_TYPE_KEYS = ["text", "code", "sheet"] as const;

export type DocumentTypeKey = (typeof DOCUMENT_TYPE_KEYS)[number];

export const BUILT_IN_TOOL_KEYS = [
  "webSearch",
  "urlRetrieval",
  "deepResearch",
  "codeExecution",
  "imageGeneration",
  "videoGeneration",
] as const;

export type BuiltInToolKey = (typeof BUILT_IN_TOOL_KEYS)[number];
