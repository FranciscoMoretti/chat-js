import { config } from "@/lib/config";

export const APP_NAME = config.appName;
export const APP_SCHEME = config.appPrefix;
const DEFAULT_DEV_APP_URL = "http://localhost:3000";

export const APP_URL =
  process.env.ELECTRON_APP_URL ||
  (process.env.NODE_ENV === "production" ? config.appUrl : DEFAULT_DEV_APP_URL);

export const WINDOW_DEFAULTS = {
  width: 1280,
  height: 800,
  minWidth: 800,
  minHeight: 600,
} as const;
