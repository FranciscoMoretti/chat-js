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

const getSafeReturnTo = (
  url: Readonly<{ searchParams: Readonly<{ get: URLSearchParams["get"] }> }>
): string => {
  const returnTo = url.searchParams.get("returnTo");
  if (returnTo?.startsWith("/") !== true || returnTo.startsWith("//")) {
    return "/";
  }
  return returnTo;
};
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
  readonly returnTo: string;
  readonly url: ReadonlyRedirectUrl;
}): NextResponse | undefined => {
  if (isLoggedIn && isAuthPage(pathname) && !isDeviceLoginRoute) {
    return NextResponse.redirect(new URL(returnTo, url));
  }

  if (isAuthPage(pathname) || isPublicPage(pathname)) {
    return undefined;
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", url));
  }
  return undefined;
};

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
    return undefined;
  }

  const session = await auth.api.getSession({ headers: req.headers });
  const isLoggedIn = Boolean(session?.user);
  const isDeviceLoginRoute = isDeviceLoginPage(pathname);
  const returnTo = getSafeReturnTo(url);

  return resolvePageResponse({
    isDeviceLoginRoute,
    isLoggedIn,
    pathname,
    returnTo,
    url,
  });
};

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
