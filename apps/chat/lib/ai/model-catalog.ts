import type { ModelData } from "./model-data";
import type { ReadonlyAiGatewayModel } from "./to-model-data";
import { getActiveGateway } from "./active-gateway";
import { toModelData } from "./to-model-data";

import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("ai/models");
export const discoverModels = async (): Promise<ModelData[]> => {
  const activeGateway = getActiveGateway();

  log.debug({ gateway: activeGateway.type }, "Fetching models from gateway");

  try {
    const models = await activeGateway.fetchModels();
    log.info(
      { gateway: activeGateway.type, modelCount: models.length },
      "Successfully fetched models from gateway"
    );
    return models.map((model: ReadonlyAiGatewayModel) => toModelData(model));
  } catch (error) {
    log.error(
      { err: error, gateway: activeGateway.type },
      "Error fetching models from gateway"
    );
    throw error;
  }
};

// EVE also runs outside Next.js, where the framework data cache is unavailable.
const MODEL_CATALOG_TTL_MS = 3_600_000;
let catalog: { expires: number; models: ModelData[] } | undefined;
let loading: Promise<ModelData[]> | undefined;

export const loadModelCatalog = async (): Promise<readonly ModelData[]> => {
  if (catalog && catalog.expires > Date.now()) {
    return catalog.models;
  }
  if (loading) {
    return await loading;
  }
  loading = discoverModels();
  try {
    const models = await loading;
    catalog = { expires: Date.now() + MODEL_CATALOG_TTL_MS, models };
    return models;
  } finally {
    loading = undefined;
  }
};
