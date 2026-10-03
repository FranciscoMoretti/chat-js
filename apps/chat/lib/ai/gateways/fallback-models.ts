/* oxlint-disable import/no-relative-parent-imports, sort-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../models.generated" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import type { AiGatewayModel } from "@chat-js/gateways/models";

import { createModuleLogger } from "@/lib/logger";

import {
  models as fallbackModels,
  generatedForGateway,
} from "../models.generated";
/* oxlint-enable import/no-relative-parent-imports, sort-imports */

const log = createModuleLogger("ai/gateways/fallback");

/* oxlint-disable import/no-named-export, import/prefer-default-export, jsdoc/require-param, jsdoc/require-returns --
 * import/no-named-export (#527): Preserve the named getFallbackModels API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): getFallbackModels remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * jsdoc/require-param (#534): getFallbackModels's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): getFallbackModels's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 */
/**
 * Returns fallback models only if the snapshot was generated for the
 * requested gateway. When there's a mismatch the snapshot contains model
 * IDs from a different provider, so returning them would cause resolution
 * errors — an empty array is safer.
 */
export const getFallbackModels = (
  gateway: string
): readonly AiGatewayModel[] => {
  if (generatedForGateway !== gateway) {
    log.warn(
      { actual: generatedForGateway, expected: gateway },
      "Fallback snapshot was generated for a different gateway, skipping. Run `bun fetch:models` to regenerate."
    );
    return [];
  }
  return fallbackModels;
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, jsdoc/require-param, jsdoc/require-returns */
