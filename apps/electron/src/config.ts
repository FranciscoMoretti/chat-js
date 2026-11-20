import branding from "../branding.json";
import { app } from "electron";

const ELECTRON_AUTH_CLIENT_ID = branding.auth.clientId;
const ELECTRON_AUTH_CALLBACK_PATH = branding.auth.callbackPath;
const ELECTRON_AUTH_COOKIE_PREFIX = branding.auth.cookiePrefix;

const APP_NAME = branding.appName;

const APP_SCHEME = branding.appPrefix;

const DEFAULT_DEV_APP_URL = "http://localhost:3000";
const defaultAppUrl = app.isPackaged ? branding.appUrl : DEFAULT_DEV_APP_URL;
const configuredAppUrl = process.env.ELECTRON_APP_URL;
const APP_URL =
  configuredAppUrl !== undefined && configuredAppUrl !== ""
    ? configuredAppUrl
    : defaultAppUrl;

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
