import pino, { type Logger, stdTimeFunctions } from "pino";
import userConfig from "@/chat.config";

const appBinding = userConfig.appPrefix || userConfig.appName || "chatjs";

// Structured stdout works in Next.js and Eve's bundled development runtime.
// Pino transports spawn a worker whose relative module path is not preserved
// in Eve's authored-module snapshots.
const logger: Logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
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
});

export function createModuleLogger(moduleName: string): Logger {
  return logger.child({ module: moduleName });
}
