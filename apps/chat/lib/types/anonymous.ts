/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../config" dependency within this package instead of introducing an alias or barrel API.
 */
import { config } from "../config";
/* oxlint-enable import/no-relative-parent-imports */

const anonConfig = config.anonymous;

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
