import {
  ELECTRON_AUTH_CALLBACK_PATH,
  ELECTRON_AUTH_CLIENT_ID,
  ELECTRON_AUTH_COOKIE_PREFIX,
} from "./protocol";
import { ELECTRON_APP_SCHEME } from "./electron-auth";
import { createAuthClient } from "better-auth/react";
import { electronProxyClient } from "@better-auth/electron/proxy";
import { lastLoginMethodClient } from "better-auth/client/plugins";

const electronAuthPlugin = electronProxyClient({
  callbackPath: ELECTRON_AUTH_CALLBACK_PATH,
  clientID: ELECTRON_AUTH_CLIENT_ID,
  cookiePrefix: ELECTRON_AUTH_COOKIE_PREFIX,
  protocol: {
    scheme: ELECTRON_APP_SCHEME,
  },
});

// Better Auth auto-detects the base URL from window.location.origin on client
// and uses relative URLs for SSR, so we don't need to specify baseURL
const authClient = createAuthClient({
  plugins: [lastLoginMethodClient(), electronAuthPlugin],
});

export default authClient;
