import { Gateway } from "./gateway";
import type { GatewayProvider } from "./gateways/registry";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { config } from "@/lib/config";
import { createModuleLogger } from "@/lib/logger";
import { gatewayEnv } from "@/lib/env";
import { getFallbackModels } from "./gateways/fallback-models";

let activeGateway: GatewayProvider | null = null;

export const getActiveGateway = (): GatewayProvider => {
  activeGateway ??= new Gateway({
    env: gatewayEnv,
    fetch: async (
      input: string | ReadonlyNativeSurface<URL | Request>,

      init
    ): Promise<Response> =>
      await fetch(input, { ...init, next: { revalidate: 3600 } }),
    getFallbackModels,
    logger: createModuleLogger(`ai/gateways/${config.ai.gateway}`),
  });
  return activeGateway;
};
