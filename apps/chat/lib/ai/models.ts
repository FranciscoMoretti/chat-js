import type { AiGatewayModel } from "@chat-js/gateways/models";
import { unstable_cache } from "next/cache";

import { config } from "@/lib/config";
import { createModuleLogger } from "@/lib/logger";

import { getActiveGateway } from "./active-gateway";
import type { ModelData } from "./model-data";
import { toModelData } from "./to-model-data";

const log = createModuleLogger("ai/models");

const fetchModelsRaw = async (): Promise<AiGatewayModel[]> => {
  const activeGateway = getActiveGateway();

  log.debug({ gateway: activeGateway.type }, "Fetching models from gateway");

  try {
    const models = await activeGateway.fetchModels();
    log.info(
      { gateway: activeGateway.type, modelCount: models.length },
      "Successfully fetched models from gateway"
    );
    return models;
  } catch (error) {
    log.error(
      { err: error, gateway: activeGateway.type },
      "Error fetching models from gateway"
    );
    throw error;
  }
};

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): fetchModels accepts model; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const fetchModels = unstable_cache(
  async (): Promise<ModelData[]> => {
    const models = await fetchModelsRaw();
    return models.map((model) => toModelData(model));
  },
  [`ai-gateway-models-${config.ai.gateway}`],
  {
    revalidate: 3600,
    tags: ["ai-gateway-models"],
  }
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
