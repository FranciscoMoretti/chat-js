/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
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
/* oxlint-enable sort-imports */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): AuthClientOptions uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
type AuthClientOptions = NonNullable<Parameters<typeof createAuthClient>[0]>;
/* oxlint-enable no-magic-numbers */
type AuthClientPlugin = NonNullable<
  AuthClientOptions extends { plugins?: infer Plugins } ? Plugins : never
>[number];
/* oxlint-disable typescript/consistent-type-definitions, typescript/prefer-readonly-parameter-types --
 * typescript/consistent-type-definitions (#559): ElectronAuthClientExtension preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 * typescript/prefer-readonly-parameter-types (#565): ElectronAuthClientExtension accepts options: { fetchOptions?: { query?: Record<string, string>; onSuccess?: () => ; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable typescript/consistent-type-definitions, typescript/prefer-readonly-parameter-types */

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: The Electron adapter bridges installed Better Auth plugin and client types; changing it requires coordinated authentication API verification.
const electronAuthPlugin = electronProxyClient({
  callbackPath: ELECTRON_AUTH_CALLBACK_PATH,
  clientID: ELECTRON_AUTH_CLIENT_ID,
  cookiePrefix: ELECTRON_AUTH_COOKIE_PREFIX,
  protocol: {
    scheme: ELECTRON_APP_SCHEME,
  },
}) as unknown as AuthClientPlugin;

/* oxlint-disable no-ternary --
 * no-ternary (#518): authClientBase derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 */
// Better Auth auto-detects the base URL from window.location.origin on client
// and uses relative URLs for SSR, so we don't need to specify baseURL
const authClientBase = createAuthClient({
  plugins: [
    nextCookies(),
    lastLoginMethodClient(),
    ...(config.desktopApp.enabled ? [electronAuthPlugin] : []),
  ],
});
/* oxlint-enable no-ternary */

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: The Electron adapter bridges installed Better Auth plugin and client types; changing it requires coordinated authentication API verification.
const authClient = authClientBase as typeof authClientBase &
  ElectronAuthClientExtension;

/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): Preserve the existing default export import contract; converting its consumers requires a public module API migration.
 */
export default authClient;
/* oxlint-enable import/no-default-export */
