import { config } from "@/lib/config";

const anonConfig = config.anonymous;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ANONYMOUS_LIMITS); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export const ANONYMOUS_LIMITS = {
  AVAILABLE_MODELS: config.ai.anonymousModels,
  AVAILABLE_TOOLS: anonConfig.availableTools,
  CREDITS: anonConfig.credits,
  RATE_LIMIT: {
    REQUESTS_PER_MINUTE: anonConfig.rateLimit.requestsPerMinute,
    REQUESTS_PER_MONTH: anonConfig.rateLimit.requestsPerMonth,
  },
  // Max session time
  SESSION_DURATION: 2_147_483_647,
} as const;
/* oxlint-enable import/prefer-default-export, import/no-named-export */
