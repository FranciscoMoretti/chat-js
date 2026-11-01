import branding from "../branding.json";

const ELECTRON_AUTH_CLIENT_ID = branding.auth.clientId;
const ELECTRON_AUTH_CALLBACK_PATH = branding.auth.callbackPath;
const ELECTRON_AUTH_COOKIE_PREFIX = branding.auth.cookiePrefix;

const APP_NAME = branding.appName;

const APP_SCHEME = branding.appPrefix;

const DEFAULT_DEV_APP_URL = "http://localhost:3000";
const EMPTY_URL_LENGTH = 0;

const resolveAppUrl = (
  environment: Readonly<
    Partial<Pick<NodeJS.ProcessEnv, "ELECTRON_APP_URL" | "NODE_ENV">>
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
    return branding.appUrl;
  }
  return DEFAULT_DEV_APP_URL;
};

// Passing the process environment here preserves lazy NODE_ENV access in the fallback.
const APP_URL = resolveAppUrl(process.env);

const WINDOW_DEFAULTS = {
  height: 800,
  minHeight: 600,
  minWidth: 800,
  width: 1280,
} as const;
export {
  APP_NAME,
  APP_SCHEME,
  APP_URL,
  WINDOW_DEFAULTS,
  ELECTRON_AUTH_CLIENT_ID,
  ELECTRON_AUTH_CALLBACK_PATH,
  ELECTRON_AUTH_COOKIE_PREFIX,
};
