/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../config" dependency within this package instead of introducing an alias or barrel API.
 */
import { config } from "../config";
/* oxlint-enable import/no-relative-parent-imports */

const anonConfig = config.anonymous;

/* oxlint-disable import/no-named-export, import/prefer-default-export --
 * import/no-named-export (#527): Preserve the named ANONYMOUS_LIMITS API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): ANONYMOUS_LIMITS remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 */
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
/* oxlint-enable import/no-named-export, import/prefer-default-export */
