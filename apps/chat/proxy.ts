import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { config as appConfig } from "@/lib/config";
import { isPlaywrightTestEnvironment } from "@/lib/constants";

function isPublicApiRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/trpc") ||
    pathname === "/api/chat" ||
    pathname.startsWith("/api/chat/")
  );
}

function isMetadataRoute(pathname: string): boolean {
  return (
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt" ||
    pathname === "/manifest.webmanifest"
  );
}

function isPublicPage(pathname: string): boolean {
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
}

function isAuthPage(pathname: string): boolean {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    isDeviceLoginPage(pathname)
  );
}

function isDeviceLoginPage(pathname: string): boolean {
  return appConfig.desktopApp.enabled && pathname.startsWith("/device-login");
}

function getSafeReturnTo(url: URL): string | null {
  const returnTo = url.searchParams.get("returnTo");
  if (!returnTo?.startsWith("/") || returnTo.startsWith("//")) {
    return null;
  }
  return returnTo;
}

export async function proxy(req: NextRequest) {
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
}

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
