import { createEnv } from "@t3-oss/env-nextjs";

import { gatewayEnvVariables } from "./ai/gateway-model-defaults";
import { clientEnvSchema, serverEnvSchema } from "./env-schema";
import { resolveEveEnvironment } from "./eve/environment";

export const env = createEnv({
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
export const gatewayEnv = Object.fromEntries(
  gatewayEnvVariables.map((name) => [name, process.env[name]])
);
