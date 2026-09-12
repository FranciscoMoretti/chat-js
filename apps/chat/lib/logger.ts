import pino, { stdTimeFunctions } from "pino";
import type { Logger } from "pino";

import userConfig from "@/chat.config";

const appBinding = userConfig.appPrefix || userConfig.appName || "chatjs";

// Prefer JSON in production; pretty in development.
// We also add base bindings so child loggers inherit app metadata.
const logger: Logger =
  process.env.NODE_ENV === "production"
    ? pino({
        level: "info",
        base: { app: appBinding },
        timestamp: stdTimeFunctions.isoTime,
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
      })
    : pino({
        level: "debug",
        base: { app: appBinding },
        timestamp: stdTimeFunctions.isoTime,
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
            singleLine: false,
          },
        },
      });

export const createModuleLogger = (moduleName: string): Logger =>
  logger.child({ module: moduleName });
