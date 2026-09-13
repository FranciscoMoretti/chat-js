import { electronProxyClient } from "@better-auth/electron/proxy";
import { lastLoginMethodClient } from "better-auth/client/plugins";
import { nextCookies } from "better-auth/next-js";
import { createAuthClient } from "better-auth/react";

import { config } from "@/lib/config";
import {
  ELECTRON_APP_SCHEME,
  ELECTRON_AUTH_CALLBACK_PATH,
  ELECTRON_AUTH_CLIENT_ID,
  ELECTRON_AUTH_COOKIE_PREFIX,
} from "@/lib/electron-auth";

type AuthClientOptions = NonNullable<Parameters<typeof createAuthClient>[0]>;
type AuthClientPlugin = NonNullable<
  AuthClientOptions extends { plugins?: infer Plugins } ? Plugins : never
>[number];
type ElectronAuthClientExtension = {
  electron: {
    transferUser: (options: {
      fetchOptions?: {
        query?: Record<string, string>;
        onSuccess?: () => void;
        onError?: () => void;
      };
    }) => Promise<unknown>;
  };
  ensureElectronRedirect: () => ReturnType<typeof setInterval>;
};

const electronAuthPlugin = electronProxyClient({
  callbackPath: ELECTRON_AUTH_CALLBACK_PATH,
  clientID: ELECTRON_AUTH_CLIENT_ID,
  cookiePrefix: ELECTRON_AUTH_COOKIE_PREFIX,
  protocol: {
    scheme: ELECTRON_APP_SCHEME,
  },
}) as unknown as AuthClientPlugin;

// Better Auth auto-detects the base URL from window.location.origin on client
// and uses relative URLs for SSR, so we don't need to specify baseURL
const authClientBase = createAuthClient({
  plugins: [
    nextCookies(),
    lastLoginMethodClient(),
    ...(config.desktopApp.enabled ? [electronAuthPlugin] : []),
  ],
});

const authClient = authClientBase as typeof authClientBase &
  ElectronAuthClientExtension;

export default authClient;
