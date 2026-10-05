import { config } from "@/lib/config";
import { gatewayEnv } from "@/lib/env";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { createModuleLogger } from "@/lib/logger";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Gateway } from "./gateway";
/* oxlint-enable sort-imports */
import { getFallbackModels } from "./gateways/fallback-models";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { GatewayProvider } from "./gateways/registry";
/* oxlint-enable sort-imports */

// oxlint-disable-next-line unicorn/no-null -- Module-local null marks an adapter not yet created; lazy initialization reuses the existing provider on later calls.
let activeGateway: GatewayProvider | null = null;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (getActiveGateway); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export const getActiveGateway = (): GatewayProvider => {
  activeGateway ??= new Gateway({
    env: gatewayEnv,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types, typescript/promise-function-async -- Forward the native fetch Request/RequestInit contract and original promise directly; wrapping in async changes promise identity and synchronous argument-error timing.
    fetch: (input, init): Promise<Response> =>
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing init own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      fetch(input, { ...init, next: { revalidate: 3600 } }),
    getFallbackModels,
    logger: createModuleLogger(`ai/gateways/${config.ai.gateway}`),
  });
  return activeGateway;
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
