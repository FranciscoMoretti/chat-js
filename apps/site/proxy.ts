import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Blume dev pages reference Vite modules outside /docs. Let Vite serve them
// directly, including Astro's unmodified bare query flags and its HMR client.
export const proxy = (request: NextRequest) => {
  const docsUrl = process.env.NEXT_PUBLIC_CHATJS_DOCS_URL;
  if (process.env.NODE_ENV === "development" && docsUrl !== undefined) {
    const { pathname, search } = new URL(request.url);
    // Next normalizes bare flags like `?astro&lang.ts` to empty values.
    const viteQuery = search.replaceAll(/[=](?=&|$)/gu, "");
    return NextResponse.redirect(new URL(pathname + viteQuery, docsUrl));
  }
  return NextResponse.next();
};

export const config = {
  matcher: ["/@vite/:path*", "/@id/:path*", "/@fs/:path*", "/src/:path*"],
};
