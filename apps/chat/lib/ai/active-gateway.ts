import { config } from "@/lib/config";
import { gatewayEnv } from "@/lib/env";
import { createModuleLogger } from "@/lib/logger";

import { Gateway } from "./gateway";
import { getFallbackModels } from "./gateways/fallback-models";
import type { GatewayProvider } from "./gateways/registry";

let activeGateway: GatewayProvider | null = null;

export const getActiveGateway = (): GatewayProvider => {
  activeGateway ??= new Gateway({
    env: gatewayEnv,
    fetch: (input, init) =>
      fetch(input, { ...init, next: { revalidate: 3600 } }),
    getFallbackModels,
    logger: createModuleLogger(`ai/gateways/${config.ai.gateway}`),
  });
  return activeGateway;
};
