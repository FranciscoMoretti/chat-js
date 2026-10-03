/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../models.generated" dependency within this package instead of introducing an alias or barrel API.
 */
import type { AiGatewayModel } from "@chat-js/gateways/models";

import { createModuleLogger } from "@/lib/logger";

import {
  models as fallbackModels,
  generatedForGateway,
} from "../models.generated";
/* oxlint-enable import/no-relative-parent-imports */

const log = createModuleLogger("ai/gateways/fallback");

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns --
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns */
