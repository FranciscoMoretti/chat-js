import { clientEnvSchema, serverEnvSchema } from "./env-schema";

import { createEnv } from "@t3-oss/env-nextjs";
import { gatewayEnvVariables } from "./ai/gateway-model-defaults";
import { resolveEveEnvironment } from "./eve/environment";

const env = createEnv({
  client: clientEnvSchema,
  experimental__runtimeEnv: {
    ...(typeof window === "undefined"
      ? resolveEveEnvironment(process.env)
      : {}),
    NEXT_PUBLIC_REACT_QUERY_DEVTOOLS:
      process.env.NEXT_PUBLIC_REACT_QUERY_DEVTOOLS,
    NEXT_PUBLIC_REACT_SCAN: process.env.NEXT_PUBLIC_REACT_SCAN,
  },
  server: serverEnvSchema,
});

// Registry gateways declare their environment independently of the app schema.
const gatewayEnv = Object.fromEntries(
  gatewayEnvVariables.map((name) => [name, process.env[name]])
);
export { env, gatewayEnv };
