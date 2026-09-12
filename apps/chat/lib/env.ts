import { createEnv } from "@t3-oss/env-nextjs";

import { gatewayEnvVariables } from "./ai/gateway-model-defaults";
import { serverEnvSchema } from "./env-schema";

export const env = createEnv({
  server: serverEnvSchema,
  client: {},
  experimental__runtimeEnv: {},
});

// Registry gateways declare their environment independently of the app schema.
export const gatewayEnv = Object.fromEntries(
  gatewayEnvVariables.map((name) => [name, process.env[name]])
);
