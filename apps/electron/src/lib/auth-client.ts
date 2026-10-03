import { electronClient } from "@better-auth/electron/client";
import { storage } from "@better-auth/electron/storage";
/* oxlint-disable eslint/sort-imports -- the better-auth/client import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
import { createAuthClient } from "better-auth/client";
/* oxlint-enable eslint/sort-imports */
import { safeStorage } from "electron";

/* oxlint-disable eslint/sort-imports -- the @/lib/electron-auth import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
import {
  ELECTRON_AUTH_CALLBACK_PATH,
  ELECTRON_AUTH_CLIENT_ID,
  ELECTRON_AUTH_COOKIE_PREFIX,
} from "@/lib/electron-auth";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable eslint/sort-imports -- the ../config import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
/* oxlint-disable import/no-relative-parent-imports -- the ../config import: The source and its build/scaffold consumers share this relative module layout; replacing it needs an alias contract in every consumer. */
import { APP_SCHEME, APP_URL } from "../config";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable node/no-process-env -- auth-client.ts: This process boundary owns environment loading/forwarding; consumers receive the resulting validated configuration. */
if (process.env.NODE_ENV !== "production") {
  Object.defineProperty(safeStorage, "isEncryptionAvailable", {
    configurable: true,
    value: (): boolean => false,
  });
}
/* oxlint-enable node/no-process-env */

/* oxlint-disable typescript/explicit-function-return-type -- memoryStorage: Keep contextual/generic inference for this SDK, callback or composite result; a new explicit type requires choosing its public shape. */
/* oxlint-disable unicorn/no-null -- memoryStorage: The SDK/wire/OS contract uses null as an explicit absence value. */
const memoryStorage = () => {
  const store = new Map<string, unknown>();

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: unknown): void => {
      store.set(key, value);
    },
  };
};
/* oxlint-enable unicorn/no-null */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable eslint/no-ternary -- electronAuthStorage: The expression preserves the existing fallback/derived-value contract within this operation. */
/* oxlint-disable node/no-process-env -- electronAuthStorage: This process boundary owns environment loading/forwarding; consumers receive the resulting validated configuration. */
const electronAuthStorage =
  process.env.NODE_ENV === "production" ? storage() : memoryStorage();
/* oxlint-enable node/no-process-env */
/* oxlint-enable eslint/no-ternary */

/* oxlint-disable import/group-exports -- authClient: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable import/no-named-export -- authClient: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
export const authClient = createAuthClient({
  baseURL: APP_URL,
  plugins: [
    electronClient({
      callbackPath: ELECTRON_AUTH_CALLBACK_PATH,
      clientID: ELECTRON_AUTH_CLIENT_ID,
      // The server namespaces core session cookies in local development.
      cookiePrefix: [ELECTRON_AUTH_COOKIE_PREFIX, "chatjs-dev-"],
      protocol: {
        scheme: APP_SCHEME,
      },
      signInURL: `${APP_URL}/device-login`,
      storage: electronAuthStorage,
    }),
  ],
});
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/no-named-export -- ElectronAuthClient: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- ElectronAuthClient: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
export type ElectronAuthClient = typeof authClient & {
  authenticate: (data: { token: string }) => Promise<unknown>;
  getCookie: () => string;
  getSession: () => Promise<{ data?: { user?: unknown } | null }>;
  requestAuth: (options?: { provider?: string }) => Promise<void>;
  signOut: () => Promise<unknown>;
  setupMain: (cfg?: {
    getWindow?: () => Electron.BrowserWindow | null;
    scheme?: boolean;
  }) => void;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable import/no-named-export */

/* oxlint-disable import/group-exports -- electronAuthClient: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable import/no-named-export -- electronAuthClient: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
export const electronAuthClient: ElectronAuthClient = authClient;
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
