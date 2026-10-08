import { electron } from "@better-auth/electron";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { AuthContext } from "better-auth";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import {
  ELECTRON_APP_SCHEME,
  ELECTRON_AUTH_CLIENT_ID,
  ELECTRON_AUTH_COOKIE_PREFIX,
} from "./electron-auth";
/* oxlint-enable sort-imports */

const plugin = electron({
  clientID: ELECTRON_AUTH_CLIENT_ID,
  cookiePrefix: ELECTRON_AUTH_COOKIE_PREFIX,
});

// Better Auth matches custom trusted origins by prefix. Electron sends one
// exact synthetic origin; validate it before the plugin promotes the header.
const electronAuthPlugin = {
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing plugin own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  ...plugin,
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve onRequest's awaited sequencing and rejected-Promise behavior. */

  async onRequest(
    request: ReadonlyNativeSurface<Request>,

    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the native Better Auth context to plugin.onRequest; readonly allowedHosts is rejected by the receiving AuthContext contract.
    context: AuthContext
  ): Promise<{ response: Response } | { request: Request } | undefined> {
    const origin = request.headers.get("origin");
    const electronOrigin = request.headers.get("electron-origin");
    const expectedOrigin = `${ELECTRON_APP_SCHEME}:/`;
    if (
      (electronOrigin !== null && electronOrigin !== expectedOrigin) ||
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading startsWith from origin; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      (origin?.startsWith(`${ELECTRON_APP_SCHEME}:`) === true &&
        origin !== expectedOrigin)
    ) {
      return {
        response: new Response("Invalid Electron origin", { status: 403 }),
      };
    }
    return await plugin.onRequest(request, context);
  },
  /* oxlint-enable oxc/no-async-await */
};

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (electronAuthPlugin); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { electronAuthPlugin };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
