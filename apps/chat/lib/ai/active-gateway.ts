import { config } from "@/lib/config";
import { gatewayEnv } from "@/lib/env";
import { createModuleLogger } from "@/lib/logger";

import { Gateway } from "./gateway";
import { getFallbackModels } from "./gateways/fallback-models";
import type { GatewayProvider } from "./gateways/registry";

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): activeGateway preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
let activeGateway: GatewayProvider | null = null;
/* oxlint-enable unicorn/no-null */

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/promise-function-async  --
 * import/no-named-export (#527): Preserve the named getActiveGateway API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): getActiveGateway remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * oxc/no-rest-spread-properties (#543): getActiveGateway copies or separates ...init while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/prefer-readonly-parameter-types (#565): getActiveGateway accepts input; init; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): getActiveGateway preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
export const getActiveGateway = (): GatewayProvider => {
  activeGateway ??= new Gateway({
    env: gatewayEnv,
    fetch: (input, init): Promise<Response> =>
      fetch(input, { ...init, next: { revalidate: 3600 } }),
    getFallbackModels,
    logger: createModuleLogger(`ai/gateways/${config.ai.gateway}`),
  });
  return activeGateway;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
