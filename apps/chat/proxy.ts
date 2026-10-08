import type { NextRequest } from "next/server";
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

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * typescript/prefer-readonly-parameter-types (#565): getSafeReturnTo accepts url: URL; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): getSafeReturnTo intentionally keeps the existing falsy-value behavior of returnTo?.startsWith("/"); distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): getSafeReturnTo preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const getSafeReturnTo = (url: URL): string | null => {
  const returnTo = url.searchParams.get("returnTo");
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading startsWith from returnTo; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  if (!returnTo?.startsWith("/") || returnTo.startsWith("//")) {
    return null;
  }
  return returnTo;
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (proxy); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve proxy's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types --
 * max-statements (#512): proxy keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/explicit-function-return-type (#560): Keep proxy's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep proxy's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): proxy accepts req: NextRequest; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
// oxlint-disable-next-line import/group-exports -- #711: Next.js 16.3 needs inline config for matcher extraction, so this named entrypoint remains a separate export; one-var rejects a combined declaration.
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading user from session; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (config); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

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
