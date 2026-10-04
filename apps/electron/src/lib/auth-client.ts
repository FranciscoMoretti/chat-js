import { electronClient } from "@better-auth/electron/client";
import { storage } from "@better-auth/electron/storage";
import { createAuthClient } from "better-auth/client";
import { safeStorage } from "electron";

import {
  ELECTRON_AUTH_CALLBACK_PATH,
  ELECTRON_AUTH_CLIENT_ID,
  ELECTRON_AUTH_COOKIE_PREFIX,
} from "@/lib/electron-auth";

/* oxlint-disable import/no-relative-parent-imports -- the ../config import: The source and its build/scaffold consumers share this relative module layout; replacing it needs an alias contract in every consumer. */
import { APP_SCHEME, APP_URL } from "../config";
/* oxlint-enable import/no-relative-parent-imports */

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

/* oxlint-disable node/no-process-env -- electronAuthStorage: This process boundary owns environment loading/forwarding; consumers receive the resulting validated configuration. */
const electronAuthStorage =
  process.env.NODE_ENV === "production" ? storage() : memoryStorage();
/* oxlint-enable node/no-process-env */

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

export { electronAuthClient };
