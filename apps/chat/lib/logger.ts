import pino, { stdTimeFunctions } from "pino";
import type { Logger } from "pino";

import userConfig from "@/chat.config";

const appBinding = userConfig.appPrefix || userConfig.appName || "chatjs";
// Prefer JSON in production; pretty in development.
// We also add base bindings so child loggers inherit app metadata.
const logger: Logger =
  process.env.NODE_ENV === "production"
    ? pino({
        base: { app: appBinding },
        level: "info",
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
      })
    : pino({
        base: { app: appBinding },
        level: "debug",
        timestamp: stdTimeFunctions.isoTime,
        transport: {
          options: {
            colorize: true,
            ignore: "pid,hostname",
            singleLine: false,
            translateTime: "SYS:standard",
          },
          target: "pino-pretty",
        },
      });
export const createModuleLogger = (moduleName: string): Logger =>
  logger.child({ module: moduleName });
