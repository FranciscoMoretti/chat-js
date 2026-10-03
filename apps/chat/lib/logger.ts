import pino, { stdTimeFunctions } from "pino";
import type { Logger } from "pino";

import userConfig from "@/chat.config";

const appBinding = userConfig.appPrefix || userConfig.appName || "chatjs";

/* oxlint-disable node/no-process-env  --
 * no-ternary (#518): logger derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
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
/* oxlint-enable node/no-process-env */

export const createModuleLogger = (moduleName: string): Logger =>
  logger.child({ module: moduleName });
