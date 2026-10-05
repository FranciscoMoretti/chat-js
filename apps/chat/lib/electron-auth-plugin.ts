import { electron } from "@better-auth/electron";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { AuthContext } from "better-auth";
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
  ...plugin,
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve onRequest's awaited sequencing and rejected-Promise behavior. */
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Better Auth owns and mutates the native request context. */
  async onRequest(
    request: Request,
    context: AuthContext
  ): Promise<{ response: Response } | { request: Request } | undefined> {
    const origin = request.headers.get("origin");
    const electronOrigin = request.headers.get("electron-origin");
    const expectedOrigin = `${ELECTRON_APP_SCHEME}:/`;
    if (
      (electronOrigin !== null && electronOrigin !== expectedOrigin) ||
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
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
};

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (electronAuthPlugin); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { electronAuthPlugin };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
