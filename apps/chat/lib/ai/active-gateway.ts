import { Gateway } from "./gateway";
import type { GatewayProvider } from "./gateways/registry";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { config } from "@/lib/config";
import { createModuleLogger } from "@/lib/logger";
import { gatewayEnv } from "@/lib/env";
import { getFallbackModels } from "./gateways/fallback-models";

// oxlint-disable-next-line unicorn/no-null -- Module-local null marks an adapter not yet created; lazy initialization reuses the existing provider on later calls.
let activeGateway: GatewayProvider | null = null;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (getActiveGateway); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export const getActiveGateway = (): GatewayProvider => {
  activeGateway ??= new Gateway({
    env: gatewayEnv,
    // oxlint-disable-next-line typescript/promise-function-async -- Forward the original native Request and RequestInit objects; readonly header tuples are not assignable to HeadersInit without conversion. Return the original fetch promise without async adoption.
    fetch: (
      input: string | ReadonlyNativeSurface<URL | Request>,

      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the original native RequestInit/fetch tuple; readonly header tuples are rejected by the native request receiver.
      init
    ): Promise<Response> =>
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing init own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      fetch(input, { ...init, next: { revalidate: 3600 } }),
    getFallbackModels,
    logger: createModuleLogger(`ai/gateways/${config.ai.gateway}`),
  });
  return activeGateway;
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
