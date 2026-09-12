import type { AiGatewayModel } from "@chat-js/gateways/models";

import { createModuleLogger } from "@/lib/logger";

import {
  models as fallbackModels,
  generatedForGateway,
} from "../models.generated";

const log = createModuleLogger("ai/gateways/fallback");

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
  return fallbackModels as unknown as AiGatewayModel[];
};
