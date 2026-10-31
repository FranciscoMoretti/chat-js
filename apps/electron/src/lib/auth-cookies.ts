const isSessionTokenCookieName = (name: string): boolean =>
  name.endsWith(".session_token");

const isBetterAuthCookieName = (name: string, cookiePrefix: string): boolean =>
  name.startsWith(cookiePrefix) ||
  name.startsWith(`__Secure-${cookiePrefix}`) ||
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
export { hasSessionCookie, isBetterAuthCookieName };
