import userConfig from "@/chat.config";
import { installedDocumentKinds } from "@/tools/chatjs/installed-features";

import type { ActiveGatewayType } from "./ai/app-model-id";
import { applyDefaults } from "./config-schema";
import type { AiConfig, Config } from "./config-schema";

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
for (const kind of ["text", "code", "sheet"] as const) {
  config.ai.tools.documents.types[kind] &&= installedDocumentKinds.has(kind);
}
config.ai.tools.documents.enabled &&= installedDocumentKinds.size > 0;

export type { Config } from "./config-schema";
