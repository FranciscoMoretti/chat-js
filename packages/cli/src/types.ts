import { builtInGateways } from "./registry/gateways";

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export type PackageManager = "bun" | "npm" | "pnpm" | "yarn";
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const GATEWAYS = builtInGateways.map((item) => item.meta.chatjs.id);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export type Gateway = string;
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export const AUTH_PROVIDERS = ["google", "github", "vercel"] as const;
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export const CORE_FEATURE_KEYS = [
  "attachments",
  "parallelResponses",
  "documents",
  "mcp",
  "followupSuggestions",
] as const;
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export type CoreFeatureKey = (typeof CORE_FEATURE_KEYS)[number];
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export const DOCUMENT_TYPE_KEYS = ["text", "code", "sheet"] as const;
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export type DocumentTypeKey = (typeof DOCUMENT_TYPE_KEYS)[number];
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export const BUILT_IN_TOOL_KEYS = [
  "webSearch",
  "urlRetrieval",
  "deepResearch",
  "codeExecution",
  "imageGeneration",
  "videoGeneration",
] as const;
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export type BuiltInToolKey = (typeof BUILT_IN_TOOL_KEYS)[number];
/* oxlint-enable import/group-exports */
