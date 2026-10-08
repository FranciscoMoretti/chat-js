/* oxlint-disable import/no-relative-parent-imports -- The ../config module is shared by the desktop build and scaffold with this relative layout. */
import { APP_SCHEME, APP_URL } from "../config";
/* oxlint-enable import/no-relative-parent-imports */
import {
  ELECTRON_AUTH_CALLBACK_PATH,
  ELECTRON_AUTH_CLIENT_ID,
  ELECTRON_AUTH_COOKIE_PREFIX,
} from "@/lib/electron-auth";
import { createAuthClient } from "better-auth/client";
import { electronClient } from "@better-auth/electron/client";
import { safeStorage } from "electron";
import { storage } from "@better-auth/electron/storage";

// oxlint-disable-next-line node/no-process-env -- This Electron process boundary chooses its local auth-storage mode from NODE_ENV.
if (process.env.NODE_ENV !== "production") {
  Object.defineProperty(safeStorage, "isEncryptionAvailable", {
    configurable: true,
    value: (): boolean => false,
  });
}
/* oxlint-disable unicorn/no-null -- memoryStorage: The SDK/wire/OS contract uses null as an explicit absence value. */
const memoryStorage = (): {
  getItem: (key: string) => unknown;
  setItem: (key: string, value: unknown) => void;
} => {
  const store = new Map<string, unknown>();

  return {
    getItem: (key: string): unknown => store.get(key) ?? null,
    setItem: (key: string, value: unknown): void => {
      store.set(key, value);
    },
  };
};
/* oxlint-enable unicorn/no-null */

const electronAuthStorage =
  // oxlint-disable-next-line no-ternary, node/no-process-env -- Keep lazy storage selection at the auth process boundary; no-ternary conflicts with the pinned unicorn/prefer-ternary rule for if/else assignment.
  process.env.NODE_ENV === "production" ? storage() : memoryStorage();

const electronAuthClient = createAuthClient({
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

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (electronAuthClient); the enabled import/no-default-export convention rejects the default-export alternative. */
export { electronAuthClient };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
