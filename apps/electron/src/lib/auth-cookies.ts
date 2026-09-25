import { ELECTRON_AUTH_COOKIE_PREFIX } from "@/lib/electron-auth";

const isSessionTokenCookieName = (name: string): boolean =>
  name.endsWith(".session_token");

export const isBetterAuthCookieName = (name: string): boolean =>
  name.startsWith(ELECTRON_AUTH_COOKIE_PREFIX) ||
  name.startsWith(`__Secure-${ELECTRON_AUTH_COOKIE_PREFIX}`) ||
  isSessionTokenCookieName(name) ||
  name.endsWith(".session_data");

export const hasSessionCookie = (cookieHeader: string): boolean =>
  cookieHeader.split(";").some((entry) => {
    const index = entry.indexOf("=");
    return (
      index > 0 &&
      isSessionTokenCookieName(entry.slice(0, index).trim()) &&
      entry.slice(index + 1).trim().length > 0
    );
  });
