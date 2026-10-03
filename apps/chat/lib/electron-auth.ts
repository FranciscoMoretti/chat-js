import { config } from "@/lib/config";
import type { SocialAuthSignInOptions } from "@/lib/social-auth";

/* oxlint-disable import/exports-last, import/group-exports --
 * import/exports-last (#522): ELECTRON_AUTH_CLIENT_ID is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): ELECTRON_AUTH_CLIENT_ID stays exported at its declaration so its public contract is visible beside its implementation.
 */
export const ELECTRON_AUTH_CLIENT_ID = "electron";
/* oxlint-enable import/exports-last, import/group-exports */
/* oxlint-disable import/exports-last, import/group-exports --
 * import/exports-last (#522): ELECTRON_AUTH_COOKIE_PREFIX is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): ELECTRON_AUTH_COOKIE_PREFIX stays exported at its declaration so its public contract is visible beside its implementation.
 */
export const ELECTRON_AUTH_COOKIE_PREFIX = "better-auth";
/* oxlint-enable import/exports-last, import/group-exports */
/* oxlint-disable import/exports-last, import/group-exports --
 * import/exports-last (#522): ELECTRON_AUTH_CALLBACK_PATH is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): ELECTRON_AUTH_CALLBACK_PATH stays exported at its declaration so its public contract is visible beside its implementation.
 */
export const ELECTRON_AUTH_CALLBACK_PATH = "/auth/callback";
/* oxlint-enable import/exports-last, import/group-exports */
/* oxlint-disable import/exports-last, import/group-exports --
 * import/exports-last (#522): ELECTRON_APP_SCHEME is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): ELECTRON_APP_SCHEME stays exported at its declaration so its public contract is visible beside its implementation.
 */
export const ELECTRON_APP_SCHEME = config.appPrefix;
/* oxlint-enable import/exports-last, import/group-exports */
/* oxlint-disable import/exports-last, import/group-exports --
 * import/exports-last (#522): ELECTRON_TRUSTED_ORIGINS is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): ELECTRON_TRUSTED_ORIGINS stays exported at its declaration so its public contract is visible beside its implementation.
 */
// @better-auth/electron uses `${scheme}:/...` for its synthetic Origin header
// and deep-link callback URLs. Keep the legacy `scheme://` form alongside it so
// existing packaged registrations continue to validate too.
export const ELECTRON_TRUSTED_ORIGINS = [
  `${ELECTRON_APP_SCHEME}:/`,
  `${ELECTRON_APP_SCHEME}://`,
] as const;
/* oxlint-enable import/exports-last, import/group-exports */

/* oxlint-disable import/exports-last, import/group-exports --
 * import/exports-last (#522): isDesktopAppEnabled is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): isDesktopAppEnabled stays exported at its declaration so its public contract is visible beside its implementation.
 */
export const isDesktopAppEnabled = (): boolean => config.desktopApp.enabled;
/* oxlint-enable import/exports-last, import/group-exports */

/* oxlint-disable import/exports-last, import/group-exports --
 * import/exports-last (#522): isElectronRenderer is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): isElectronRenderer stays exported at its declaration so its public contract is visible beside its implementation.
 */
export const isElectronRenderer = (): boolean =>
  isDesktopAppEnabled() &&
  // oxlint-disable-next-line unicorn/prefer-global-this -- #572: This tests for a browser window; globalThis also exists during server rendering.
  typeof window !== "undefined" &&
  // oxlint-disable-next-line unicorn/prefer-global-this -- #572: Electron preload exposes this bridge through the augmented Window interface, not a cross-runtime global.
  typeof window.requestAuth === "function";
/* oxlint-enable import/exports-last, import/group-exports */

type SearchParamValue = string | string[] | undefined;

/* oxlint-disable import/group-exports, no-continue, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): toSearchParamRecord stays exported at its declaration so its public contract is visible beside its implementation.
 * no-continue (#515): toSearchParamRecord skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * typescript/prefer-readonly-parameter-types (#565): toSearchParamRecord accepts searchParams: Record<string, SearchParamValue>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable import/group-exports, no-continue, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): buildAuthPageHref stays exported at its declaration so its public contract is visible beside its implementation.
 * typescript/prefer-readonly-parameter-types (#565): buildAuthPageHref accepts searchParams: Record<string, SearchParamValue>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const buildAuthPageHref = (
  pathname: string,
  searchParams: Record<string, SearchParamValue>
): string => {
  const query = new URLSearchParams(
    toSearchParamRecord(searchParams)
  ).toString();
  return query ? `${pathname}?${query}` : pathname;
};
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): isElectronTransferQuery stays exported at its declaration so its public contract is visible beside its implementation.
 * typescript/prefer-readonly-parameter-types (#565): isElectronTransferQuery accepts query: Record<string, string>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const isElectronTransferQuery = (
  query: Record<string, string>
): boolean => query.client_id === ELECTRON_AUTH_CLIENT_ID;
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/group-exports (#523): buildSocialAuthRequest stays exported at its declaration so its public contract is visible beside its implementation.
 * typescript/prefer-readonly-parameter-types (#565): buildSocialAuthRequest accepts query: Record<string, string>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): buildSocialAuthRequest intentionally keeps the existing falsy-value behavior of origin; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
