import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { config as appConfig } from "@/lib/config";
import { isPlaywrightTestEnvironment } from "@/lib/constants";

const EVE_CHAT_PAGE = /^\/chat\/[^/]+$/u;

const isPublicApiRoute = (pathname: string): boolean =>
  // Eve routes enforce their own gateway authentication in the worker.
  pathname.startsWith("/eve/") ||
  pathname.startsWith("/api/auth") ||
  pathname.startsWith("/api/trpc");

const isMetadataRoute = (pathname: string): boolean =>
  pathname === "/sitemap.xml" ||
  pathname === "/robots.txt" ||
  pathname === "/manifest.webmanifest";

const isPublicPage = (pathname: string): boolean => {
  // EVE pages resolve registered/guest principals and enforce conversation ownership.
  if (EVE_CHAT_PAGE.test(pathname)) {
    return true;
  }
  if (pathname === "/") {
    return true;
  }
  return (
    pathname.startsWith("/models") ||
    pathname.startsWith("/compare") ||
    pathname.startsWith("/share/") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms")
  );
};

const isDeviceLoginPage = (pathname: string): boolean =>
  appConfig.desktopApp.enabled && pathname.startsWith("/device-login");

const isAuthPage = (pathname: string): boolean =>
  pathname.startsWith("/login") ||
  pathname.startsWith("/register") ||
  isDeviceLoginPage(pathname);

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * typescript/prefer-readonly-parameter-types (#565): getSafeReturnTo accepts url: URL; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): getSafeReturnTo intentionally keeps the existing falsy-value behavior of returnTo?.startsWith("/"); distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): getSafeReturnTo preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const getSafeReturnTo = (url: URL): string | null => {
  const returnTo = url.searchParams.get("returnTo");
  if (!returnTo?.startsWith("/") || returnTo.startsWith("//")) {
    return null;
  }
  return returnTo;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable import/group-exports, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): Next.js statically discovers the proxy entrypoint and inline config matcher; retain their declaration exports together (#619).
 * max-statements (#512): proxy keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/explicit-function-return-type (#560): Keep proxy's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep proxy's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): proxy accepts req: NextRequest; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const proxy = async (req: NextRequest) => {
  const url = req.nextUrl;
  const { pathname } = url;

  if (isPublicApiRoute(pathname) || isMetadataRoute(pathname)) {
    return;
  }

  if (isPlaywrightTestEnvironment) {
    // Playwright CI runs the app anonymously and should never reach session I/O.
    return;
  }

  const session = await auth.api.getSession({ headers: req.headers });
  const isLoggedIn = Boolean(session?.user);
  const isDeviceLoginRoute = isDeviceLoginPage(pathname);
  const returnTo = getSafeReturnTo(url);

  if (isLoggedIn && isAuthPage(pathname) && !isDeviceLoginRoute) {
    // oxlint-disable-next-line typescript/consistent-return -- #580: proxy has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
    return NextResponse.redirect(new URL(returnTo ?? "/", url));
  }

  if (isAuthPage(pathname) || isPublicPage(pathname)) {
    return;
  }

  if (!isLoggedIn) {
    // oxlint-disable-next-line typescript/consistent-return -- #580: proxy has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
    return NextResponse.redirect(new URL("/login", url));
  }
};
/* oxlint-enable import/group-exports, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports --
 * import/group-exports (#523): Next.js extractExportedConstValue requires inline export const config to discover this proxy matcher (#619).
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, opengraph-image (favicon and og image)
     * - manifest files (.json, .webmanifest)
     * - Images and other static assets (.svg, .png, .jpg, .jpeg, .gif, .webp, .ico)
     * - models
     * - compare
     * - docs (Blume documentation)
     */
    "/((?!api|docs|_next/static|_next/image|favicon.ico|opengraph-image|manifest|models|compare|privacy|terms|.*[.](?:svg|png|jpg|jpeg|gif|webp|ico|json|webmanifest)$).*)",
  ],
};
/* oxlint-enable import/group-exports */
