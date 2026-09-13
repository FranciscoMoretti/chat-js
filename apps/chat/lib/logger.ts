import pino, { stdTimeFunctions } from "pino";
import type { Logger } from "pino";

import userConfig from "@/chat.config";

const appBinding = userConfig.appPrefix || userConfig.appName || "chatjs";

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

export const createModuleLogger = (moduleName: string): Logger =>
  logger.child({ module: moduleName });
