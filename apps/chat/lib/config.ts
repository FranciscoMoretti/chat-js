import userConfig from "@/chat.config";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ActiveGatewayType } from "./ai/app-model-id";
/* oxlint-enable sort-imports */
import { applyDefaults } from "./config-schema";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { AiConfig, Config } from "./config-schema";
/* oxlint-enable sort-imports */

type ActiveAiConfig = Extract<AiConfig, { gateway: ActiveGatewayType }>;

/** Config with the `ai` field narrowed to the active gateway. */
type ActiveConfig = Omit<Config, "ai"> & { ai: ActiveAiConfig };

/**
 * Parsed configuration with defaults applied.
 * Import this for runtime access to config values.
 *
 * @example
 * import { config } from "@/lib/config";
 * console.log(config.appName);
 */
export const config = applyDefaults(userConfig) as ActiveConfig;
export type { Config } from "./config-schema";
