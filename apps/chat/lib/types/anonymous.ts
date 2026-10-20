import { GUEST_POLICY } from "../eve/session-policy";
import { config } from "@/lib/config";

const anonConfig = config.anonymous;

export const ANONYMOUS_LIMITS = {
  AVAILABLE_MODELS: [GUEST_POLICY.modelId] as readonly string[],
  AVAILABLE_TOOLS: [] as readonly string[],
  CREDITS: anonConfig.credits,
  RATE_LIMIT: {
    REQUESTS_PER_MINUTE: anonConfig.rateLimit.requestsPerMinute,
    REQUESTS_PER_MONTH: anonConfig.rateLimit.requestsPerMonth,
  },
  // Max session time
  SESSION_DURATION: 2_147_483_647,
} as const;
