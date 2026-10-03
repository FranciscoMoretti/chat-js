/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { createEnv } from "@t3-oss/env-nextjs";

import { gatewayEnvVariables } from "./ai/gateway-model-defaults";
import { clientEnvSchema, serverEnvSchema } from "./env-schema";
import { resolveEveEnvironment } from "./eve/environment";
/* oxlint-enable sort-imports */

/* oxlint-disable import/group-exports, import/no-named-export, no-ternary, node/no-process-env, oxc/no-rest-spread-properties --
 * import/group-exports (#523): env stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named env API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-ternary (#518): env derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * node/no-process-env (#537): env reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 * oxc/no-rest-spread-properties (#543): env copies or separates ...(typeof window === "undefined" ? resolveEveEnvironment(process.env) : {}) while preserving existing object ownership; mutating source objects is not equivalent.
 */
export const env = createEnv({
  client: clientEnvSchema,
  experimental__runtimeEnv: {
    // oxlint-disable-next-line unicorn/prefer-global-this -- #572: This tests for a browser window; globalThis also exists during server rendering.
    ...(typeof window === "undefined"
      ? resolveEveEnvironment(process.env)
      : {}),
    NEXT_PUBLIC_REACT_QUERY_DEVTOOLS:
      process.env.NEXT_PUBLIC_REACT_QUERY_DEVTOOLS,
    NEXT_PUBLIC_REACT_SCAN: process.env.NEXT_PUBLIC_REACT_SCAN,
  },
  server: serverEnvSchema,
});
/* oxlint-enable import/group-exports, import/no-named-export, no-ternary, node/no-process-env, oxc/no-rest-spread-properties */

/* oxlint-disable import/group-exports, import/no-named-export, node/no-process-env --
 * import/group-exports (#523): gatewayEnv stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named gatewayEnv API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * node/no-process-env (#537): gatewayEnv reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
// Registry gateways declare their environment independently of the app schema.
export const gatewayEnv = Object.fromEntries(
  gatewayEnvVariables.map((name) => [name, process.env[name]])
);
/* oxlint-enable import/group-exports, import/no-named-export, node/no-process-env */
