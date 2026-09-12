import { electronClient } from "@better-auth/electron/client";
import { storage } from "@better-auth/electron/storage";
import { createAuthClient } from "better-auth/client";
import { safeStorage } from "electron";

import {
  ELECTRON_AUTH_CALLBACK_PATH,
  ELECTRON_AUTH_CLIENT_ID,
  ELECTRON_AUTH_COOKIE_PREFIX,
} from "@/lib/electron-auth";

import { APP_SCHEME, APP_URL } from "../config";

if (process.env.NODE_ENV !== "production") {
  Object.defineProperty(safeStorage, "isEncryptionAvailable", {
    configurable: true,
    value: () => false,
  });
}

const memoryStorage = () => {
  const store = new Map<string, string>();

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
};

const electronAuthStorage =
  process.env.NODE_ENV === "production" ? storage() : memoryStorage();

export const authClient = createAuthClient({
  baseURL: APP_URL,
  plugins: [
    electronClient({
      callbackPath: ELECTRON_AUTH_CALLBACK_PATH,
      clientID: ELECTRON_AUTH_CLIENT_ID,
      cookiePrefix: ELECTRON_AUTH_COOKIE_PREFIX,
      protocol: {
        scheme: APP_SCHEME,
      },
      signInURL: `${APP_URL}/device-login`,
      storage: electronAuthStorage,
      // `as any`: @better-auth/electron does not export a typed Storage union
      // compatible with both `storage()` and our in-memory shim, and the
      // plugin's inferred return type leaks through to createAuthClient.
    }) as unknown as Parameters<typeof createAuthClient>[0]["plugins"][number],
  ],
});

export type ElectronAuthClient = typeof authClient & {
  authenticate: (data: { token: string }) => Promise<unknown>;
  getCookie: () => string;
  getSession: () => Promise<{ data?: { user?: unknown | null } | null }>;
  requestAuth: (options?: { provider?: string }) => Promise<void>;
  signOut: () => Promise<unknown>;
  setupMain: (cfg?: {
    getWindow?: () => Electron.BrowserWindow | null;
    scheme?: boolean;
  }) => void;
};

export const electronAuthClient = authClient as ElectronAuthClient;
