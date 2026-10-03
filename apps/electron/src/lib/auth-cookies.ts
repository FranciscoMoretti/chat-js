import { ELECTRON_AUTH_COOKIE_PREFIX } from "@/lib/electron-auth";

const isSessionTokenCookieName = (name: string): boolean =>
  name.endsWith(".session_token");

const isBetterAuthCookieName = (name: string): boolean =>
  name.startsWith(ELECTRON_AUTH_COOKIE_PREFIX) ||
  name.startsWith(`__Secure-${ELECTRON_AUTH_COOKIE_PREFIX}`) ||
  isSessionTokenCookieName(name) ||
  name.endsWith(".session_data");

/* oxlint-disable eslint/no-magic-numbers -- hasSessionCookie: Zero rejects empty cookie names/values and index + 1 skips the single equals delimiter; these offsets define the cookie-header parser. */
const hasSessionCookie = (cookieHeader: string): boolean =>
  cookieHeader.split(";").some((entry) => {
    const index = entry.indexOf("=");
    return (
      index > 0 &&
      isSessionTokenCookieName(entry.slice(0, index).trim()) &&
      entry.slice(index + 1).trim().length > 0
    );
  });
/* oxlint-enable eslint/no-magic-numbers */
export { hasSessionCookie, isBetterAuthCookieName };
