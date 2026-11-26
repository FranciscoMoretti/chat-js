import { createGateway } from "@/integrations/providers/gateway";
import type { GatewayProvider } from "./gateways/registry";
import { config } from "@/lib/config";
import { createModuleLogger } from "@/lib/logger";
import { gatewayEnv } from "@/lib/env";

let activeGateway: GatewayProvider | null = null;

export const getActiveGateway = (): GatewayProvider => {
  activeGateway ??= createGateway({
    env: gatewayEnv,
    logger: createModuleLogger(`ai/gateways/${config.ai.gateway}`),
  });
  return activeGateway;
};
