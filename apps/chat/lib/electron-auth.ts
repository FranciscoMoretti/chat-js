import { config } from "@/lib/config";
import type { SocialAuthSignInOptions } from "@/lib/social-auth";

const ELECTRON_AUTH_CLIENT_ID = "electron";

const ELECTRON_AUTH_COOKIE_PREFIX = "better-auth";

const ELECTRON_AUTH_CALLBACK_PATH = "/auth/callback";

const ELECTRON_APP_SCHEME = config.appPrefix;

// @better-auth/electron uses `${scheme}:/...` for its synthetic Origin header
// and deep-link callback URLs. Keep the legacy `scheme://` form alongside it so
// existing packaged registrations continue to validate too.
const ELECTRON_TRUSTED_ORIGINS = [
  `${ELECTRON_APP_SCHEME}:/`,
  `${ELECTRON_APP_SCHEME}://`,
] as const;

const isDesktopAppEnabled = (): boolean => config.desktopApp.enabled;

const isElectronRenderer = (): boolean =>
  isDesktopAppEnabled() &&
  // oxlint-disable-next-line unicorn/prefer-global-this -- #572: This tests for a browser window; globalThis also exists during server rendering.
  typeof window !== "undefined" &&
  // oxlint-disable-next-line unicorn/prefer-global-this -- #572: Electron preload exposes this bridge through the augmented Window interface, not a cross-runtime global.
  typeof window.requestAuth === "function";

type SearchParamValue = string | string[] | undefined;

/* oxlint-disable no-continue, typescript/prefer-readonly-parameter-types --
 * no-continue (#515): toSearchParamRecord skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * typescript/prefer-readonly-parameter-types (#565): toSearchParamRecord accepts searchParams: Record<string, SearchParamValue>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const toSearchParamRecord = (
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
/* oxlint-enable no-continue, typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): buildAuthPageHref accepts searchParams: Record<string, SearchParamValue>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const buildAuthPageHref = (
  pathname: string,
  searchParams: Record<string, SearchParamValue>
): string => {
  const query = new URLSearchParams(
    toSearchParamRecord(searchParams)
  ).toString();
  return query ? `${pathname}?${query}` : pathname;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */

const isElectronTransferQuery = (
  query: Readonly<Record<string, string>>
): boolean => query.client_id === ELECTRON_AUTH_CLIENT_ID;

/* oxlint-disable typescript/strict-boolean-expressions --
 * typescript/strict-boolean-expressions (#610): buildSocialAuthRequest intentionally keeps the existing falsy-value behavior of origin; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
  const deviceLoginCallbackURL = origin
    ? new URL("/device-login", origin).toString()
    : "/device-login";

  if (isElectronTransfer) {
    return {
      callbackURL: deviceLoginCallbackURL,
      onRedirectToUrl: (url: string): void => {
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
/* oxlint-enable typescript/strict-boolean-expressions */

export {
  ELECTRON_AUTH_CLIENT_ID,
  ELECTRON_AUTH_COOKIE_PREFIX,
  ELECTRON_AUTH_CALLBACK_PATH,
  ELECTRON_APP_SCHEME,
  ELECTRON_TRUSTED_ORIGINS,
  isDesktopAppEnabled,
  isElectronRenderer,
  toSearchParamRecord,
  buildAuthPageHref,
  isElectronTransferQuery,
  buildSocialAuthRequest,
};
