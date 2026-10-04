import { electron } from "@better-auth/electron";
import type { AuthContext } from "better-auth";

import {
  ELECTRON_APP_SCHEME,
  ELECTRON_AUTH_CLIENT_ID,
  ELECTRON_AUTH_COOKIE_PREFIX,
} from "./electron-auth";

const plugin = electron({
  clientID: ELECTRON_AUTH_CLIENT_ID,
  cookiePrefix: ELECTRON_AUTH_COOKIE_PREFIX,
});

// Better Auth matches custom trusted origins by prefix. Electron sends one
// exact synthetic origin; validate it before the plugin promotes the header.
const electronAuthPlugin = {
  ...plugin,
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
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
};

export { electronAuthPlugin };
