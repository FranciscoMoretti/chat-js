import type { SocialAuthSignInOptions } from "@/lib/social-auth";
import { config } from "@/lib/config";

const ELECTRON_AUTH_CLIENT_ID = "electron";

const ELECTRON_AUTH_COOKIE_PREFIX = "better-auth";

const ELECTRON_AUTH_CALLBACK_PATH = "/auth/callback";

const ELECTRON_APP_SCHEME = config.appPrefix;

// @better-auth/electron sends this synthetic Origin for the current protocol.
const ELECTRON_TRUSTED_ORIGINS = [`${ELECTRON_APP_SCHEME}:/`] as const;

const isDesktopAppEnabled = (): boolean => config.desktopApp.enabled;

const isElectronRenderer = (): boolean =>
  isDesktopAppEnabled() &&
  typeof window !== "undefined" &&
  typeof window.requestAuth === "function";

type SearchParamValue = string | readonly string[] | undefined;

const toSearchParamRecord = (
  searchParams: Readonly<Record<string, SearchParamValue>>
): Record<string, string> => {
  const query: Record<string, string> = {};

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      query[key] = value;
    } else if (typeof value === "object") {
      const [firstValue] = value;
      if (typeof firstValue === "string" && firstValue !== "") {
        query[key] = firstValue;
      }
    }
  }

  return query;
};

const isElectronTransferQuery = (
  query: Readonly<Record<string, string>>
): boolean => query.client_id === ELECTRON_AUTH_CLIENT_ID;

const buildSocialAuthRequest = (
  query: Readonly<Record<string, string>>,
  origin?: string
): {
  callbackURL?: string;
  onRedirectToUrl?: (url: string) => void;
  signInOptions?: SocialAuthSignInOptions;
} => {
  const isElectronTransfer =
    isDesktopAppEnabled() && isElectronTransferQuery(query);
  const deviceLoginCallbackURL =
    typeof origin === "string" && origin !== ""
      ? new URL("/device-login", origin).toString()
      : "/device-login";

  if (isElectronTransfer) {
    return {
      callbackURL: deviceLoginCallbackURL,
      onRedirectToUrl: (url: string): void => {
        const { location } = globalThis;
        if (typeof location === "object" && location !== null) {
          location.assign(url);
        }
      },
      signInOptions: {
        disableRedirect: true,
        errorCallbackURL: deviceLoginCallbackURL,
        newUserCallbackURL: deviceLoginCallbackURL,
      },
    };
  }

  return {
    callbackURL: query.returnTo,
  };
};

export {
  ELECTRON_AUTH_CLIENT_ID,
  ELECTRON_AUTH_COOKIE_PREFIX,
  ELECTRON_AUTH_CALLBACK_PATH,
  ELECTRON_APP_SCHEME,
  ELECTRON_TRUSTED_ORIGINS,
  isDesktopAppEnabled,
  isElectronRenderer,
  toSearchParamRecord,
  isElectronTransferQuery,
  buildSocialAuthRequest,
};
