/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import userConfig from "@/chat.config";

import type { ActiveGatewayType } from "./ai/app-model-id";
import { applyDefaults } from "./config-schema";
import type { AiConfig, Config } from "./config-schema";
/* oxlint-enable sort-imports */

type ActiveAiConfig = Extract<AiConfig, { gateway: ActiveGatewayType }>;

/** Config with the `ai` field narrowed to the active gateway. */
type ActiveConfig = Omit<Config, "ai"> & { ai: ActiveAiConfig };

/* oxlint-disable import/no-named-export --
 * import/no-named-export (#527): Preserve the named config API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
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
/* oxlint-disable import/no-named-export --
 * import/no-named-export (#527): Preserve the named export from "./config-schema" API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type { Config } from "./config-schema";
/* oxlint-enable import/no-named-export */
