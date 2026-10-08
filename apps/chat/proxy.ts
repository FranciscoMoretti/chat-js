import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { config as appConfig } from "@/lib/config";
/* oxlint-enable sort-imports */
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

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): getSafeReturnTo preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const getSafeReturnTo = (
  url: Readonly<{ searchParams: Readonly<{ get: URLSearchParams["get"] }> }>
): string | null => {
  const returnTo = url.searchParams.get("returnTo");
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading startsWith from returnTo; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  if (returnTo?.startsWith("/") !== true || returnTo.startsWith("//")) {
    return null;
  }
  return returnTo;
};
/* oxlint-enable unicorn/no-null */
type ReadonlyRedirectUrl = Readonly<
  Omit<URL, "searchParams"> & { searchParams: Readonly<URLSearchParams> }
>;

const resolvePageResponse = ({
  isDeviceLoginRoute,
  isLoggedIn,
  pathname,
  returnTo,
  url,
}: {
  readonly isDeviceLoginRoute: boolean;
  readonly isLoggedIn: boolean;
  readonly pathname: string;
  readonly returnTo: string | null;
  readonly url: ReadonlyRedirectUrl;
}): NextResponse | undefined => {
  if (isLoggedIn && isAuthPage(pathname) && !isDeviceLoginRoute) {
    return NextResponse.redirect(new URL(returnTo ?? "/", url));
  }

  if (isAuthPage(pathname) || isPublicPage(pathname)) {
    // oxlint-disable-next-line typescript/consistent-return -- Public/authentication pages pass through; protected pages may produce a native redirect response.
    return;
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", url));
  }
};
/* oxlint-disable import/no-named-export -- Next discovers the named proxy entrypoint; app guidance and import/no-default-export also require named exports. */
/* oxlint-disable oxc/no-async-await -- Await the native session lookup before resolving page access or producing its response. */

// oxlint-disable-next-line import/group-exports -- #711: Next.js 16.3 needs inline config for matcher extraction, so this named entrypoint remains a separate export; one-var rejects a combined declaration.
export const proxy = async (
  req: Readonly<{
    headers: Readonly<Headers>;
    nextUrl: ReadonlyRedirectUrl;
  }>
): Promise<NextResponse | undefined> => {
  const url = req.nextUrl;
  const { pathname } = url;

  if (
    isPublicApiRoute(pathname) ||
    isMetadataRoute(pathname) ||
    isPlaywrightTestEnvironment
  ) {
    // API/metadata and anonymous Playwright requests never reach session I/O.
    return;
  }

  const session = await auth.api.getSession({ headers: req.headers });
  // oxlint-disable-next-line oxc/no-optional-chaining -- The session may be absent; retain one guarded user access after the native session lookup.
  const isLoggedIn = Boolean(session?.user);
  const isDeviceLoginRoute = isDeviceLoginPage(pathname);
  const returnTo = getSafeReturnTo(url);

  // oxlint-disable-next-line typescript/consistent-return -- Metadata/public API and fixture requests pass through; page requests may produce the native redirect response.
  return resolvePageResponse({
    isDeviceLoginRoute,
    isLoggedIn,
    pathname,
    returnTo,
    url,
  });
};
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (config); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */

// oxlint-disable-next-line import/group-exports -- #711: Next.js 16.3 extractExportedConstValue reads inline export const config; a grouped clause drops the matcher. one-var rejects combining it with proxy.
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
/* oxlint-enable import/no-named-export */
