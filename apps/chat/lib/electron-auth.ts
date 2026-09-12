import { config } from "@/lib/config";
import type { SocialAuthSignInOptions } from "@/lib/social-auth";

export const ELECTRON_AUTH_CLIENT_ID = "electron";
export const ELECTRON_AUTH_COOKIE_PREFIX = "better-auth";
export const ELECTRON_AUTH_CALLBACK_PATH = "/auth/callback";
export const ELECTRON_APP_SCHEME = config.appPrefix;
// @better-auth/electron uses `${scheme}:/...` for its synthetic Origin header
// and deep-link callback URLs. Keep the legacy `scheme://` form alongside it so
// existing packaged registrations continue to validate too.
export const ELECTRON_TRUSTED_ORIGINS = [
  `${ELECTRON_APP_SCHEME}:/`,
  `${ELECTRON_APP_SCHEME}://`,
] as const;

export const isDesktopAppEnabled = (): boolean => config.desktopApp.enabled;

export const isElectronRenderer = (): boolean =>
  isDesktopAppEnabled() &&
  typeof window !== "undefined" &&
  typeof window.requestAuth === "function";

type SearchParamValue = string | string[] | undefined;

export const toSearchParamRecord = (
  searchParams: Record<string, SearchParamValue>
): Record<string, string> => {
  const query: Record<string, string> = {};

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      query[key] = value;
      continue;
    }

    if (Array.isArray(value)) {
      const [firstValue] = value;
      if (firstValue) {
        query[key] = firstValue;
      }
    }
  }

  return query;
};

export const buildAuthPageHref = (
  pathname: string,
  searchParams: Record<string, SearchParamValue>
): string => {
  const query = new URLSearchParams(
    toSearchParamRecord(searchParams)
  ).toString();
  return query ? `${pathname}?${query}` : pathname;
};

export const isElectronTransferQuery = (
  query: Record<string, string>
): boolean => query.client_id === ELECTRON_AUTH_CLIENT_ID;

export const buildSocialAuthRequest = (
  query: Record<string, string>,
  origin?: string
): {
  callbackURL?: string;
  onRedirectToUrl?: (url: string) => void;
  signInOptions?: SocialAuthSignInOptions;
} => {
  const isElectronTransfer =
    isDesktopAppEnabled() && isElectronTransferQuery(query);
  const deviceLoginCallbackURL = origin
    ? new URL("/device-login", origin).toString()
    : "/device-login";

  if (isElectronTransfer) {
    return {
      callbackURL: deviceLoginCallbackURL,
      onRedirectToUrl: (url: string) => {
        globalThis.location?.assign(url);
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
