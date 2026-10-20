import { GUEST_POLICY } from "../eve/session-policy";
import { config } from "@/lib/config";

const anonConfig = config.anonymous;
const availableModels: readonly string[] = [GUEST_POLICY.modelId];
const availableTools: readonly string[] = [];

export const ANONYMOUS_LIMITS = {
  AVAILABLE_MODELS: availableModels,
  AVAILABLE_TOOLS: availableTools,
  CREDITS: anonConfig.credits,
  RATE_LIMIT: {
    REQUESTS_PER_MINUTE: anonConfig.rateLimit.requestsPerMinute,
    REQUESTS_PER_MONTH: anonConfig.rateLimit.requestsPerMonth,
  },
  // Max session time
  SESSION_DURATION: 2_147_483_647,
} as const;
