import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { config as appConfig } from "@/lib/config";
import { isPlaywrightTestEnvironment } from "@/lib/constants";
import { env } from "@/lib/env";
import { getRegisteredSession } from "@/lib/registered-session";

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

const getSafeReturnTo = (url: URL): string | null => {
  const returnTo = url.searchParams.get("returnTo");
  if (!returnTo?.startsWith("/") || returnTo.startsWith("//")) {
    return null;
  }
  return returnTo;
};

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

  if (env.CHATJS_GUEST_ONLY) {
    return pathname === "/"
      ? undefined
      : NextResponse.redirect(new URL("/", url));
  }

  const session = await getRegisteredSession(req.headers);
  const isLoggedIn = !!session?.user;
  const isDeviceLoginRoute = isDeviceLoginPage(pathname);
  const returnTo = getSafeReturnTo(url);

  if (isLoggedIn && isAuthPage(pathname) && !isDeviceLoginRoute) {
    return NextResponse.redirect(new URL(returnTo ?? "/", url));
  }

  if (isAuthPage(pathname) || isPublicPage(pathname)) {
    return;
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", url));
  }
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
    "/((?!api|docs|_next/static|_next/image|favicon.ico|opengraph-image|manifest|models|compare|privacy|terms|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|webmanifest)$).*)",
  ],
};
