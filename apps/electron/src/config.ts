import { config } from "@/lib/config";

const APP_NAME = config.appName;

const APP_SCHEME = config.appPrefix;

const DEFAULT_DEV_APP_URL = "http://localhost:3000";
const EMPTY_URL_LENGTH = 0;

const resolveAppUrl = (
  environment: Readonly<
    Pick<NodeJS.ProcessEnv, "ELECTRON_APP_URL" | "NODE_ENV">
  >
): string => {
  const configuredUrl = environment.ELECTRON_APP_URL;
  if (
    typeof configuredUrl === "string" &&
    configuredUrl.length > EMPTY_URL_LENGTH
  ) {
    return configuredUrl;
  }

  if (environment.NODE_ENV === "production") {
    return config.appUrl;
  }
  return DEFAULT_DEV_APP_URL;
};

// Passing the process environment here preserves lazy NODE_ENV access in the fallback.
// oxlint-disable-next-line node/no-process-env -- Electron resolves its renderer URL at this process boundary; downstream consumers receive only APP_URL.
const APP_URL = resolveAppUrl(process.env);

const WINDOW_DEFAULTS = {
  height: 800,
  minHeight: 600,
  minWidth: 800,
  width: 1280,
} as const;
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (APP_NAME, APP_SCHEME, APP_URL, WINDOW_DEFAULTS); the enabled import/no-default-export convention rejects the default-export alternative. */
export { APP_NAME, APP_SCHEME, APP_URL, WINDOW_DEFAULTS };
/* oxlint-enable import/no-named-export */
