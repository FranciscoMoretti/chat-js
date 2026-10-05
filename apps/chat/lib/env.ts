import { createEnv } from "@t3-oss/env-nextjs";

import { gatewayEnvVariables } from "./ai/gateway-model-defaults";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { clientEnvSchema, serverEnvSchema } from "./env-schema";
/* oxlint-enable sort-imports */
import { resolveEveEnvironment } from "./eve/environment";

/* oxlint-disable node/no-process-env -- node/no-process-env (#537): env reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior. */
const env = createEnv({
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
/* oxlint-enable node/no-process-env */

/* oxlint-disable node/no-process-env -- node/no-process-env (#537): gatewayEnv reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior. */
// Registry gateways declare their environment independently of the app schema.
const gatewayEnv = Object.fromEntries(
  gatewayEnvVariables.map((name) => [name, process.env[name]])
);
/* oxlint-enable node/no-process-env */
export { env, gatewayEnv };
