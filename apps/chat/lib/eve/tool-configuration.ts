import { toolRequirements } from "../../chatjs/generated/tool-requirements";
import { gatewayEnvRequirements } from "../../chatjs/providers/gateway-defaults";
import { storageEnvRequirements } from "../../chatjs/providers/storage-options";
import { inspectToolConfiguration } from "../tool-readiness";

export const missingToolConfiguration = (
  name: string,
  environment: Readonly<NodeJS.ProcessEnv> = process.env
): string[] =>
  Object.hasOwn(toolRequirements, name)
    ? inspectToolConfiguration(
        name,
        toolRequirements,
        {
          gateway: gatewayEnvRequirements,
          storage: storageEnvRequirements,
        },
        environment
      )
    : [];

export const assertToolConfigured = (name: string): void => {
  const missing = missingToolConfiguration(name);
  if (missing.length > 0) {
    throw new Error(
      `Capability ${name} is unavailable. Configure ${missing.join("; ")} in .env.local, then run chat-js setup.`
    );
  }
};
