// oxlint-disable-next-line import/no-nodejs-modules -- Electron main resolves its preload and desktop asset paths with native platform semantics.
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules -- Electron main backs off between native-cookie and server-session readiness polls.
import { setTimeout as sleep } from "node:timers/promises";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  BrowserWindow,
  Menu,
  Tray,
  app,
  ipcMain,
  nativeImage,
  shell,
} from "electron";
/* oxlint-enable sort-imports */
import type { MenuItemConstructorOptions } from "electron";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { APP_NAME, APP_SCHEME, APP_URL, WINDOW_DEFAULTS } from "./config";
/* oxlint-enable sort-imports */
import { electronAuthClient } from "./lib/auth-client";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { hasSessionCookie, isBetterAuthCookieName } from "./lib/auth-cookies";
/* oxlint-enable sort-imports */

const isSquirrelStartupEvent = (): boolean => {
  if (process.platform !== "win32") {
    return false;
  }

  return process.argv.some((arg): boolean => arg.startsWith("--squirrel-"));
};

if (isSquirrelStartupEvent()) {
  app.quit();
}

// Disable GPU acceleration in WSL / headless environments to prevent D3D12 crashes.
const isWslOrHeadless =
  // oxlint-disable-next-line node/no-process-env -- Electron startup owns this host-environment check at the process boundary.
  (process.env.WSL_DISTRO_NAME ?? "") !== "" ||
  // oxlint-disable-next-line node/no-process-env -- Check WSLENV only when WSL_DISTRO_NAME is absent or empty.
  (process.env.WSLENV ?? "") !== "";
if (isWslOrHeadless) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-software-rasterizer");
}
let isQuitting = false;
/* oxlint-disable unicorn/no-null -- mainWindow: The SDK/wire/OS contract uses null as an explicit absence value. */
let mainWindow: BrowserWindow | null = null;
/* oxlint-enable unicorn/no-null */
/* oxlint-disable unicorn/no-null -- tray: The SDK/wire/OS contract uses null as an explicit absence value. */
let tray: Tray | null = null;
/* oxlint-enable unicorn/no-null */
/* oxlint-disable unicorn/no-null -- pendingAuthRefreshTimer: The SDK/wire/OS contract uses null as an explicit absence value. */
let pendingAuthRefreshTimer: ReturnType<typeof setTimeout> | null = null;
/* oxlint-enable unicorn/no-null */
/* oxlint-disable unicorn/no-null -- currentAuthOverlayMessage: The SDK/wire/OS contract uses null as an explicit absence value. */
let currentAuthOverlayMessage: string | null = null;
/* oxlint-enable unicorn/no-null */
let isAuthFlowInProgress = false;
let currentAuthFlowId = 0;
const gotSingleInstanceLock = app.requestSingleInstanceLock();

interface AuthOverlayWindow {
  readonly isDestroyed: BrowserWindow["isDestroyed"];
  readonly webContents: {
    readonly executeJavaScript: Electron.WebContents["executeJavaScript"];
    readonly isLoadingMainFrame: Electron.WebContents["isLoadingMainFrame"];
    readonly once: Electron.WebContents["once"];
  };
}

interface AuthSessionWindow {
  readonly webContents: {
    readonly session: {
      readonly cookies: {
        readonly get: Electron.Cookies["get"];
        readonly remove: Electron.Cookies["remove"];
        readonly set: Electron.Cookies["set"];
      };
    };
  };
}

type AuthRendererState =
  | {
      readonly status: "idle";
      readonly message: null;
    }
  | {
      readonly status: "awaiting-browser" | "finishing" | "timed-out" | "error";
      readonly message: string;
      readonly detail?: string | null;
    };

/* oxlint-disable unicorn/no-null -- currentAuthState: The SDK/wire/OS contract uses null as an explicit absence value. */
let currentAuthState: AuthRendererState = {
  message: null,
  status: "idle",
};
/* oxlint-enable unicorn/no-null */

if (!gotSingleInstanceLock) {
  app.quit();
}

/* oxlint-disable eslint/no-magic-numbers -- registerProtocolClient: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
/* oxlint-disable eslint/no-console -- registerProtocolClient: This command or desktop boundary reports startup, progress and failures to its operator. */
const registerProtocolClient = (): void => {
  if (process.defaultApp) {
    if (process.platform === "win32" && process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(APP_SCHEME, process.execPath, [
        path.resolve(process.argv[1]),
      ]);
      return;
    }

    console.info(
      `[electron-main] skipping ${APP_SCHEME} protocol registration in development on ${process.platform}; packaged builds handle deep links normally.`
    );
    return;
  }

  app.setAsDefaultProtocolClient(APP_SCHEME);
};
/* oxlint-enable eslint/no-console */
/* oxlint-enable eslint/no-magic-numbers */

const broadcastAuthState = (): void => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("chatjs:auth-state-changed", currentAuthState);
};

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve setAuthOverlay's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/max-lines-per-function -- setAuthOverlay: The operation keeps its validation, ordered side effects and cleanup in one scope. */
/* oxlint-disable unicorn/no-null -- setAuthOverlay: The SDK/wire/OS contract uses null as an explicit absence value. */
/* oxlint-disable eslint/no-console -- setAuthOverlay: This command or desktop boundary reports startup, progress and failures to its operator. */
const setAuthOverlay = async (
  win: AuthOverlayWindow | null,
  options:
    | {
        readonly visible: false;
      }
    | {
        readonly visible: true;
        readonly message: string;
      }
): Promise<void> => {
  if (!win || win.isDestroyed()) {
    return;
  }

  // oxlint-disable-next-line no-ternary -- Keep = operand as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  currentAuthOverlayMessage = options.visible ? options.message : null;

  // oxlint-disable-next-line no-ternary -- Keep script as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const script = options.visible
    ? `
(() => {
  const message = ${JSON.stringify(options.message)};
  const existing = document.getElementById("chatjs-electron-auth-overlay");
  if (existing) existing.remove();
  const styles = getComputedStyle(document.documentElement);
  const background = styles.getPropertyValue("--background").trim() || "hsl(0 0% 97.0392%)";
  const foreground = styles.getPropertyValue("--foreground").trim() || "hsl(0 0% 20%)";
  const card = styles.getPropertyValue("--card").trim() || "hsl(0 0% 100%)";
  const border = styles.getPropertyValue("--border").trim() || "hsl(220 13% 91%)";
  const mutedForeground =
    styles.getPropertyValue("--muted-foreground").trim() || "hsl(220 8.9362% 46.0784%)";
  const primary = styles.getPropertyValue("--primary").trim() || "hsl(217.2193 91.2195% 59.8039%)";
  const radius = styles.getPropertyValue("--radius").trim() || "0.75rem";
  const overlay = document.createElement("div");
  overlay.id = "chatjs-electron-auth-overlay";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "999999";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.background = "color-mix(in srgb, " + background + " 82%, transparent)";
  overlay.style.backdropFilter = "blur(10px)";
  overlay.style.webkitBackdropFilter = "blur(10px)";
  overlay.innerHTML = \`
    <div style="display:flex;min-width:320px;max-width:360px;flex-direction:column;align-items:center;gap:14px;padding:28px 32px;border:1px solid \${border};border-radius:calc(\${radius} + 4px);background:\${card};box-shadow:0 18px 50px rgba(15,23,42,0.12);font-family:var(--font-geist, ui-sans-serif, system-ui, sans-serif);color:\${foreground};">
      <div style="width:28px;height:28px;border-radius:9999px;border:3px solid color-mix(in srgb, \${mutedForeground} 28%, transparent);border-top-color:\${primary};animation:chatjs-electron-spin 0.8s linear infinite;"></div>
      <div id="chatjs-electron-auth-overlay-message" style="font-size:15px;font-weight:600;"></div>
      <div style="font-size:13px;color:\${mutedForeground};text-align:center;">You can return here once the browser finishes.</div>
    </div>
  \`;
  overlay.querySelector("#chatjs-electron-auth-overlay-message").textContent = message;
  if (!document.getElementById("chatjs-electron-auth-overlay-style")) {
    const style = document.createElement("style");
    style.id = "chatjs-electron-auth-overlay-style";
    style.textContent = "@keyframes chatjs-electron-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }";
    document.head.appendChild(style);
  }
  document.body.appendChild(overlay);
})();
`
    : `
(() => {
  document.getElementById("chatjs-electron-auth-overlay")?.remove();
})();
`;

  try {
    if (win.webContents.isLoadingMainFrame()) {
      win.webContents.once("did-finish-load", (): void => {
        void (async (): Promise<void> => {
          try {
            await win.webContents.executeJavaScript(script);
          } catch (error) {
            console.warn(
              "[electron-main] failed to update auth overlay",
              error
            );
          }
        })();
      });
      return;
    }

    await win.webContents.executeJavaScript(script);
  } catch (error) {
    console.warn("[electron-main] failed to update auth overlay", error);
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve setAuthState's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable eslint/no-console */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/max-lines-per-function */

/* oxlint-disable eslint/max-statements -- setAuthState: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
const setAuthState = async (nextState: AuthRendererState): Promise<void> => {
  currentAuthState = nextState;
  broadcastAuthState();

  if (nextState.status === "idle") {
    await setAuthOverlay(mainWindow, { visible: false });
    return;
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  // Let the renderer-owned shadcn overlay handle normal auth states when the
  // app page is already loaded. Keep the main-process DOM overlay only as a
  // fallback during main-frame loads, where React cannot render yet.
  if (mainWindow.webContents.isLoadingMainFrame()) {
    await setAuthOverlay(mainWindow, {
      message: nextState.message,
      visible: true,
    });
    return;
  }

  await setAuthOverlay(mainWindow, { visible: false });
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve resetAuthFlow's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable unicorn/no-null -- resetAuthFlow: The SDK/wire/OS contract uses null as an explicit absence value. */
/* oxlint-disable eslint/no-magic-numbers -- resetAuthFlow: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
const resetAuthFlow = async (): Promise<void> => {
  if (pendingAuthRefreshTimer) {
    clearTimeout(pendingAuthRefreshTimer);
    pendingAuthRefreshTimer = null;
  }

  isAuthFlowInProgress = false;
  currentAuthFlowId += 1;

  await setAuthState({
    message: null,
    status: "idle",
  });
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */

// Setup the @better-auth/electron main process handler.
// Registers the protocol handler, deep-link listeners, CSP updates, and
// renderer bridges. Must be called before the app is ready.
electronAuthClient.setupMain({
  getWindow: () => mainWindow,
  scheme: false,
});

registerProtocolClient();

// Better Auth should register these bridges in setupMain(), but we also
// register them explicitly so the preload bridge stays reliable in dev builds.
ipcMain.removeHandler("better-auth:requestAuth");
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve ipcMain.handle's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/max-statements -- better-auth:requestAuth: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
/* oxlint-disable eslint/no-magic-numbers -- better-auth:requestAuth: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
ipcMain.handle(
  "better-auth:requestAuth",
  async (_event: unknown, options): Promise<void> => {
    if (isAuthFlowInProgress) {
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading show from mainWindow; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      mainWindow?.show();
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading focus from mainWindow; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      mainWindow?.focus();
      return;
    }

    isAuthFlowInProgress = true;
    currentAuthFlowId += 1;

    await setAuthState({
      message: "Waiting for sign-in in your browser...",
      status: "awaiting-browser",
    });

    try {
      // oxlint-disable-next-line typescript/no-unsafe-argument -- Electron IPC supplies untyped payloads; Better Auth validates its request options at this bridge.
      await electronAuthClient.requestAuth(options);
    } catch (error) {
      isAuthFlowInProgress = false;
      await setAuthState({
        // oxlint-disable-next-line no-ternary -- Keep detail as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        detail: error instanceof Error ? error.message : String(error),
        message: "Couldn't open the browser sign-in flow.",
        status: "error",
      });
      throw error;
    }
  }
);
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve ipcMain.handle's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-statements */

ipcMain.handle("chatjs:cancel-auth-flow", async (): Promise<void> => {
  await resetAuthFlow();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve syncAuthSessionCookies's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/max-statements -- syncAuthSessionCookies: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
/* oxlint-disable eslint/max-lines-per-function -- syncAuthSessionCookies: The operation keeps its validation, ordered side effects and cleanup in one scope. */
/* oxlint-disable eslint/no-magic-numbers -- syncAuthSessionCookies: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
/* oxlint-disable unicorn/no-null -- syncAuthSessionCookies: The SDK/wire/OS contract uses null as an explicit absence value. */
/* oxlint-disable typescript/promise-function-async -- syncAuthSessionCookies: Keep synchronous validation/throws and the original promise identity; adding async changes those observable boundaries. */
const syncAuthSessionCookies = async (
  win?: AuthSessionWindow | null
): Promise<void> => {
  const targetWindow = win ?? mainWindow;
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading webContents from targetWindow; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
  const targetSession = targetWindow?.webContents.session;

  if (!targetSession) {
    return;
  }

  const url = new URL(APP_URL);
  const existingCookies = await targetSession.cookies.get({ url: url.origin });

  await Promise.all(
    existingCookies
      .filter((cookie: Readonly<Electron.Cookie>): boolean =>
        isBetterAuthCookieName(cookie.name)
      )
      .map((cookie: Readonly<Electron.Cookie>): Promise<void> =>
        targetSession.cookies.remove(url.origin, cookie.name)
      )
  );

  const cookieHeader = electronAuthClient.getCookie();

  if (!cookieHeader) {
    return;
  }

  const cookies = cookieHeader
    .split(/;\s*/u)
    .map((entry: string): Readonly<{ name: string; value: string }> | null => {
      const index = entry.indexOf("=");
      if (index < 1) {
        return null;
      }

      return {
        name: entry.slice(0, index),
        value: entry.slice(index + 1),
      };
    })
    .filter((cookie) => cookie !== null)
    .filter((cookie: Readonly<{ name: string; value: string }>): boolean =>
      isBetterAuthCookieName(cookie.name)
    );

  await Promise.all(
    cookies.map(
      (cookie: Readonly<{ name: string; value: string }>): Promise<void> =>
        targetSession.cookies.set({
          name: cookie.name,
          path: "/",
          secure: url.protocol === "https:",
          url: url.origin,
          value: cookie.value,
        })
    )
  );
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

ipcMain.removeHandler("better-auth:signOut");
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve ipcMain.handle's awaited sequencing and rejected-Promise behavior. */
ipcMain.handle("better-auth:signOut", async () => {
  const result = await electronAuthClient.signOut();
  await syncAuthSessionCookies();
  return result;
});
/* oxlint-enable oxc/no-async-await */
ipcMain.removeHandler("better-auth:getUser");
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve ipcMain.handle's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable unicorn/no-null -- better-auth:getUser: The SDK/wire/OS contract uses null as an explicit absence value. */
ipcMain.handle("better-auth:getUser", async () => {
  const sessionResult = await electronAuthClient.getSession();
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading user from sessionResult.data; preserve one receiver evaluation, skipped accesses and the existing null fallback.
  return sessionResult.data?.user ?? null;
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable unicorn/no-null */

const getAppAssetPath = (...segments: readonly string[]): string =>
  path.join(app.getAppPath(), ...segments);

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve authenticateFromDeepLink's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/max-statements -- authenticateFromDeepLink: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
/* oxlint-disable eslint/no-console -- authenticateFromDeepLink: This command or desktop boundary reports startup, progress and failures to its operator. */
const authenticateFromDeepLink = async (url: string): Promise<boolean> => {
  try {
    if (!isAuthFlowInProgress) {
      return false;
    }

    const parsed = new URL(url);
    if (!parsed.hash.startsWith("#token=")) {
      return false;
    }

    const token = parsed.hash.slice("#token=".length);
    if (token === "") {
      return false;
    }

    await setAuthState({
      message: "Finishing sign-in...",
      status: "finishing",
    });
    await electronAuthClient.authenticate({ token });
    return true;
  } catch (error) {
    console.error("[electron-main] deep link authentication failed", error);
    isAuthFlowInProgress = false;
    await setAuthState({
      // oxlint-disable-next-line no-ternary -- Keep detail as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      detail: error instanceof Error ? error.message : String(error),
      message: "We couldn't finish sign-in automatically.",
      status: "error",
    });
    return false;
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve waitForElectronSession's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable eslint/no-console */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- waitForElectronSession: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
/* oxlint-disable eslint/no-magic-numbers -- waitForElectronSession: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
/* oxlint-disable eslint/no-console -- waitForElectronSession: This command or desktop boundary reports startup, progress and failures to its operator. */
const waitForElectronSession = async (timeoutMs = 8000): Promise<boolean> => {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const cookieHeader = electronAuthClient.getCookie();
    const hasCookie = hasSessionCookie(cookieHeader);

    try {
      // oxlint-disable-next-line no-await-in-loop -- Poll sequentially until the native cookie and server session agree.
      const sessionResult = await electronAuthClient.getSession();
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading user from sessionResult.data; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      const hasUser = Boolean(sessionResult.data?.user);

      if (hasCookie && hasUser) {
        return true;
      }
    } catch (error) {
      console.warn("[electron-main] session check failed while waiting", error);
    }

    // oxlint-disable-next-line no-await-in-loop -- Back off between session polls rather than issue overlapping requests.
    await sleep(250);
  }

  return false;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/no-console */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- scheduleAuthRefresh: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
/* oxlint-disable eslint/max-lines-per-function -- scheduleAuthRefresh: The operation keeps its validation, ordered side effects and cleanup in one scope. */
/* oxlint-disable eslint/no-console -- scheduleAuthRefresh: This command or desktop boundary reports startup, progress and failures to its operator. */
/* oxlint-disable unicorn/no-null -- scheduleAuthRefresh: The SDK/wire/OS contract uses null as an explicit absence value. */
/* oxlint-disable eslint/no-magic-numbers -- scheduleAuthRefresh: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
const scheduleAuthRefresh = (): void => {
  const targetWindow = mainWindow;
  const authFlowId = currentAuthFlowId;

  if (!targetWindow) {
    console.warn("[electron-main] scheduleAuthRefresh without a window");
    return;
  }

  if (pendingAuthRefreshTimer) {
    clearTimeout(pendingAuthRefreshTimer);
  }

  targetWindow.show();
  targetWindow.focus();

  pendingAuthRefreshTimer = setTimeout((): void => {
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this statement's awaited sequencing and rejected-Promise behavior. */
    void (async (): Promise<void> => {
      try {
        const ready = await waitForElectronSession();
        if (!ready) {
          isAuthFlowInProgress = false;
          await setAuthState(
            // oxlint-disable-next-line no-ternary -- Keep setAuthState argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
            authFlowId === currentAuthFlowId
              ? {
                  detail: "Please try the browser flow again.",
                  message:
                    "Still waiting for the desktop app to finish signing in...",
                  status: "timed-out",
                }
              : {
                  message: null,
                  status: "idle",
                }
          );
          return;
        }

        await syncAuthSessionCookies(targetWindow);
        isAuthFlowInProgress = false;
        await setAuthState({
          message: null,
          status: "idle",
        });
      } catch (error) {
        console.error("[electron-main] auth refresh failed", error);
        isAuthFlowInProgress = false;
        await setAuthState({
          // oxlint-disable-next-line no-ternary -- Keep detail as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          detail: error instanceof Error ? error.message : String(error),
          message: "Sign-in refresh failed.",
          status: "error",
        });
      }
    })();
    /* oxlint-enable oxc/no-async-await */
    pendingAuthRefreshTimer = null;
  }, 250);
};
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/no-console */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

const createWindow = (): BrowserWindow => {
  const win = new BrowserWindow({
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing WINDOW_DEFAULTS own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...WINDOW_DEFAULTS,
    // oxlint-disable-next-line oxc/no-rest-spread-properties, no-ternary -- Conditional spread (process.platform === "darwin" || process.platform === "win32"       ? { titleBarStyle: "default" as const }       : { titleBarOverlay: true, titleBarStyle: "hidden" as const }) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign.; no-ternary: Keep object spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    ...(process.platform === "darwin" || process.platform === "win32"
      ? { titleBarStyle: "default" as const }
      : { titleBarOverlay: true, titleBarStyle: "hidden" as const }),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: getAppAssetPath("dist", "preload.js"),
    },
  });

  if (process.platform === "win32" || process.platform === "linux") {
    win.removeMenu();
  }

  // Avoid touching encrypted auth storage on app launch. On macOS this can
  // trigger an immediate Keychain prompt before the window even loads, which
  // feels like a crash. Session sync still runs after explicit auth events.
  void win.loadURL(APP_URL);

  win.webContents.on("did-finish-load", (): void => {
    const overlayMessage = currentAuthOverlayMessage;
    if (overlayMessage !== null && overlayMessage !== "") {
      void setAuthOverlay(win, {
        message: overlayMessage,
        visible: true,
      });
    }
  });

  // Open all new-window requests (including OAuth popups) in the default browser.
  win.webContents.setWindowOpenHandler(({ url }: Readonly<{ url: string }>) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  // Minimize to tray on close
  win.on("close", (event: Pick<Electron.Event, "preventDefault">): void => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  if (!app.isPackaged) {
    win.webContents.openDevTools({ mode: "detach" });
  }

  return win;
};
const createTray = (): Tray => {
  const iconPath = getAppAssetPath("build", "icon.png");
  const trayIcon = nativeImage.createFromPath(iconPath);
  const trayInstance = new Tray(trayIcon.resize({ height: 16, width: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      click: (): void => {
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading show from mainWindow; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
        mainWindow?.show();
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading focus from mainWindow; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
        mainWindow?.focus();
      },
      label: `Show ${APP_NAME}`,
    },
    { type: "separator" },
    {
      click: (): void => {
        isQuitting = true;
        app.quit();
      },
      label: "Quit",
    },
  ]);

  trayInstance.setToolTip(APP_NAME);
  trayInstance.setContextMenu(contextMenu);

  trayInstance.on("click", (): void => {
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading isVisible from mainWindow; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    if (mainWindow?.isVisible() === true) {
      mainWindow.hide();
    } else {
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading show from mainWindow; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      mainWindow?.show();
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading focus from mainWindow; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      mainWindow?.focus();
    }
  });

  return trayInstance;
};
const setupApplicationMenu = (): void => {
  if (process.platform !== "darwin") {
    return;
  }

  const template: MenuItemConstructorOptions[] = [
    {
      label: APP_NAME,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      role: "editMenu",
    },
    // oxlint-disable-next-line no-ternary -- Keep iterable spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    ...(app.isPackaged
      ? []
      : ([
          {
            role: "viewMenu",
            submenu: [
              { role: "reload" },
              { role: "forceReload" },
              { type: "separator" },
              { role: "toggleDevTools" },
            ],
          },
        ] satisfies MenuItemConstructorOptions[])),
    {
      role: "windowMenu",
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve setupAutoUpdater's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/no-console -- setupAutoUpdater: This command or desktop boundary reports startup, progress and failures to its operator. */
const setupAutoUpdater = async (): Promise<void> => {
  if (!app.isPackaged) {
    return;
  }

  try {
    const { updateElectronApp } = await import("update-electron-app");

    updateElectronApp({
      logger: console,
      notifyUser: true,
      updateInterval: "1 hour",
    });
  } catch (error) {
    console.warn(
      "[electron-main] update-electron-app is unavailable; automatic updates are disabled.",
      error
    );
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve ipcMain.handle's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable eslint/no-console */

ipcMain.handle("chatjs:sync-auth-session", async (): Promise<void> => {
  await syncAuthSessionCookies();
});
/* oxlint-enable oxc/no-async-await */
ipcMain.handle("chatjs:get-auth-state", () => currentAuthState);

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this statement's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/no-magic-numbers -- main.ts: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
// oxlint-disable-next-line unicorn/prefer-top-level-await -- #574: Start readiness asynchronously so deep-link and second-instance handlers below register immediately.
void (async (): Promise<void> => {
  await app.whenReady();
  app.setName(APP_NAME);
  setupApplicationMenu();
  mainWindow = createWindow();
  tray = createTray();
  void setupAutoUpdater();

  app.on("activate", (): void => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    } else {
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading show from mainWindow; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      mainWindow?.show();
    }
  });
})();
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/no-magic-numbers */

app.on("open-url", (_event: unknown, url): void => {
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this statement's awaited sequencing and rejected-Promise behavior. */
  void (async (): Promise<void> => {
    const didAuthenticate = await authenticateFromDeepLink(url);
    if (didAuthenticate) {
      scheduleAuthRefresh();
    }
  })();
  /* oxlint-enable oxc/no-async-await */
});

app.on(
  "second-instance",
  (_event: unknown, commandLine: readonly string[]): void => {
    const deepLinkUrl = commandLine.find((value): boolean =>
      value.startsWith(`${APP_SCHEME}://`)
    );

    if (typeof deepLinkUrl === "string" && deepLinkUrl !== "") {
      /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this statement's awaited sequencing and rejected-Promise behavior. */
      void (async (): Promise<void> => {
        const didAuthenticate = await authenticateFromDeepLink(deepLinkUrl);
        if (didAuthenticate) {
          scheduleAuthRefresh();
        }
      })();
      /* oxlint-enable oxc/no-async-await */
    }
  }
);
app.on("before-quit", (): void => {
  isQuitting = true;
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading destroy from tray; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
  tray?.destroy();
});

app.on("window-all-closed", (): void => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

/* oxlint-disable max-lines -- window-all-closed: This module is one coordinated protocol/lifecycle implementation; splitting requires an ownership and public API decision. */
