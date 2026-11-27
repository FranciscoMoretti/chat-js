import type { authProviders } from "../../registry/installation";
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

type AuthProvider = (typeof authProviders)[number];

const CORE_FEATURE_KEYS = [
  "attachments",
  "parallelResponses",
  "mcp",
  "projects",
  "feedback",
  "followupSuggestions",
] as const;

type CoreFeatureKey = (typeof CORE_FEATURE_KEYS)[number];

export { authProviders as AUTH_PROVIDERS } from "../../registry/installation";
export { CORE_FEATURE_KEYS, GATEWAYS };
export type { AuthProvider, CoreFeatureKey, Gateway, PackageManager };
