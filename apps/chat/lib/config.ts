import type { AiConfig, Config } from "./config-schema";

import type { ActiveGatewayType } from "./ai/app-model-id";
import { applyDefaults } from "./config-schema";
import userConfig from "@/chat.config";

type ActiveAiConfig = Extract<AiConfig, { gateway: ActiveGatewayType }>;

/** Config with the `ai` field narrowed to the active gateway. */
type ActiveConfig = Omit<Config, "ai"> & { ai: ActiveAiConfig };

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (config); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/**
 * Parsed configuration with defaults applied.
 * Import this for runtime access to config values.
 *
 * @example
 * import { config } from "@/lib/config";
 * console.log(config.appName);
 */
export const config = applyDefaults(userConfig) as ActiveConfig;
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (Config); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { Config } from "./config-schema";
/* oxlint-enable import/no-named-export */
