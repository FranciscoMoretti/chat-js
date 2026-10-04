import { electronProxyClient } from "@better-auth/electron/proxy";
import { lastLoginMethodClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { config } from "@/lib/config";
import {
  ELECTRON_APP_SCHEME,
  ELECTRON_AUTH_CALLBACK_PATH,
  ELECTRON_AUTH_CLIENT_ID,
  ELECTRON_AUTH_COOKIE_PREFIX,
} from "@/lib/electron-auth";

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
  plugins: [
    lastLoginMethodClient(),
    ...(config.desktopApp.enabled ? [electronAuthPlugin] : []),
  ],
});

/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): Preserve the existing default export import contract; converting its consumers requires a public module API migration.
 */
export default authClient;
/* oxlint-enable import/no-default-export */
