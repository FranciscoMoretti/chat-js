import pino, { stdTimeFunctions } from "pino";
import type { Logger } from "pino";

import userConfig from "@/chat.config";

const appBinding = userConfig.appPrefix || userConfig.appName || "chatjs";

/* oxlint-disable no-ternary, node/no-process-env --
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
/* oxlint-enable no-ternary, node/no-process-env */

/* oxlint-disable import/no-named-export, import/prefer-default-export --
 * import/no-named-export (#527): Preserve the named createModuleLogger API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): createModuleLogger remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 */
export const createModuleLogger = (moduleName: string): Logger =>
  logger.child({ module: moduleName });
/* oxlint-enable import/no-named-export, import/prefer-default-export */
