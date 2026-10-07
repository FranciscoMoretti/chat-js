import { ELECTRON_AUTH_COOKIE_PREFIX } from "@/lib/electron-auth";

const isSessionTokenCookieName = (name: string): boolean =>
  name.endsWith(".session_token");

const isBetterAuthCookieName = (name: string): boolean =>
  name.startsWith(ELECTRON_AUTH_COOKIE_PREFIX) ||
  name.startsWith(`__Secure-${ELECTRON_AUTH_COOKIE_PREFIX}`) ||
  isSessionTokenCookieName(name) ||
  name.endsWith(".session_data");

const COOKIE_HEADER_SEPARATOR = ";";
const COOKIE_VALUE_SEPARATOR = "=";
const COOKIE_NAME_START_INDEX = 0;
const COOKIE_SEPARATOR_LENGTH = 1;
const EMPTY_COOKIE_VALUE_LENGTH = 0;

const hasSessionCookie = (cookieHeader: string): boolean =>
  cookieHeader.split(COOKIE_HEADER_SEPARATOR).some((entry) => {
    const index = entry.indexOf(COOKIE_VALUE_SEPARATOR);
    return (
      index > COOKIE_NAME_START_INDEX &&
      isSessionTokenCookieName(
        entry.slice(COOKIE_NAME_START_INDEX, index).trim()
      ) &&
      entry.slice(index + COOKIE_SEPARATOR_LENGTH).trim().length >
        EMPTY_COOKIE_VALUE_LENGTH
    );
  });
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (hasSessionCookie, isBetterAuthCookieName); the enabled import/no-default-export convention rejects the default-export alternative. */
export { hasSessionCookie, isBetterAuthCookieName };
/* oxlint-enable import/no-named-export */
