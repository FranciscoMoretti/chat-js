import type { AiGatewayModel } from "@chat-js/gateways/models";
import type { ModelData } from "./model-data";
import type { ReadonlyAiGatewayModel } from "./to-model-data";

import { config } from "@/lib/config";
import { createModuleLogger } from "@/lib/logger";
import { getActiveGateway } from "./active-gateway";
import { toModelData } from "./to-model-data";
import { unstable_cache } from "next/cache";

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

export const fetchModels = unstable_cache(
  async (): Promise<ModelData[]> => {
    const models = await fetchModelsRaw();
    return models.map((model: ReadonlyAiGatewayModel) => toModelData(model));
  },
  [`ai-gateway-models-${config.ai.gateway}`],
  {
    revalidate: 3600,
    tags: ["ai-gateway-models"],
  }
);
