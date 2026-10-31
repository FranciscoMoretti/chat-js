import type { AuthenticationIntegration } from "@/lib/authentication-contracts";
import {
  ELECTRON_AUTH_CLIENT_ID,
  ELECTRON_AUTH_COOKIE_PREFIX,
} from "./protocol";
import { ELECTRON_APP_SCHEME } from "./electron-auth";
import type { AuthContext } from "better-auth";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { electron } from "@better-auth/electron";

const plugin = electron({
  clientID: ELECTRON_AUTH_CLIENT_ID,
  cookiePrefix: ELECTRON_AUTH_COOKIE_PREFIX,
});

// Better Auth matches custom trusted origins by prefix. Electron sends one
// exact synthetic origin; validate it before the plugin promotes the header.
const electronAuthPlugin = {
  ...plugin,

  async onRequest(
    request: ReadonlyNativeSurface<Request>,

    context: AuthContext
  ): Promise<{ response: Response } | { request: Request } | undefined> {
    const origin = request.headers.get("origin");
    const electronOrigin = request.headers.get("electron-origin");
    const expectedOrigin = `${ELECTRON_APP_SCHEME}:/`;
    if (
      (electronOrigin !== null && electronOrigin !== expectedOrigin) ||
      ((origin ?? "").startsWith(`${ELECTRON_APP_SCHEME}:`) &&
        origin !== expectedOrigin)
    ) {
      return {
        response: new Response("Invalid Electron origin", { status: 403 }),
      };
    }
    return await plugin.onRequest(request, context);
  },
};

export const desktopAuth = {
  plugins: [electronAuthPlugin],
  trustedOrigins: [`${ELECTRON_APP_SCHEME}:/`],
  isAuthRoute: (url) =>
    url.pathname === "/device-login" ||
    ((url.pathname === "/login" || url.pathname === "/register") &&
      url.searchParams.get("client_id") === ELECTRON_AUTH_CLIENT_ID),
} satisfies AuthenticationIntegration;
export { electronAuthPlugin };
