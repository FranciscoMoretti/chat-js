import pino, { stdTimeFunctions } from "pino";
import type { Logger } from "pino";

import userConfig from "@/chat.config";

const appBinding = userConfig.appPrefix || userConfig.appName || "chatjs";

/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): logger reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
// Structured stdout works in Next.js and Eve's bundled development runtime.
// Pino transports spawn a worker whose relative module path is not preserved
// in Eve's authored-module snapshots.
const logger: Logger = pino({
  base: { app: appBinding },
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  redact: {
    paths: [
      "password",
      "headers.authorization",
      "headers.cookie",
      "cookies",
      "token",
    ],
    remove: false,
  },
  timestamp: stdTimeFunctions.isoTime,
});
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (createModuleLogger); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable node/no-process-env */

export const createModuleLogger = (moduleName: string): Logger =>
  logger.child({ module: moduleName });
/* oxlint-enable import/prefer-default-export, import/no-named-export */
