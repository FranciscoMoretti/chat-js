import { APP_SCHEME, APP_URL } from "../config";
import {
  ELECTRON_AUTH_CALLBACK_PATH,
  ELECTRON_AUTH_CLIENT_ID,
  ELECTRON_AUTH_COOKIE_PREFIX,
} from "@/lib/electron-auth";
import { createAuthClient } from "better-auth/client";
import { electronClient } from "@better-auth/electron/client";
import { safeStorage } from "electron";
import { storage } from "@better-auth/electron/storage";

if (process.env.NODE_ENV !== "production") {
  Object.defineProperty(safeStorage, "isEncryptionAvailable", {
    configurable: true,
    value: (): boolean => false,
  });
}
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

const electronAuthStorage =
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

export { electronAuthClient };
