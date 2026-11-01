import type { Route } from "next";

/** Plugin routes are discovered at runtime, outside Next's static route union. */
// oxlint-disable-next-line no-control-regex -- Reject control characters in runtime plugin navigation.
const unsafeRouteCharacters = /[\\\u0000-\u0020]/u;
const isInternalRoute = (href: string): href is Route =>
  href.startsWith("/") &&
  !href.startsWith("//") &&
  !unsafeRouteCharacters.test(href);

export const pluginRoute = (href: string): Route => {
  if (!isInternalRoute(href)) {
    throw new Error("Plugin navigation must use an internal path.");
  }
  return href;
};
