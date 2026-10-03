/* oxlint-disable import/no-nodejs-modules -- the node:path import: Electron main/preload and packaging code requires this Node API at the desktop boundary. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- the node:timers/promises import: Electron main/preload and packaging code requires this Node API at the desktop boundary. */
import { setTimeout as sleep } from "node:timers/promises";
/* oxlint-enable import/no-nodejs-modules */

import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  shell,
  Tray,
} from "electron";
import type { MenuItemConstructorOptions } from "electron";

import { APP_NAME, APP_SCHEME, APP_URL, WINDOW_DEFAULTS } from "./config";
import { electronAuthClient } from "./lib/auth-client";
import { hasSessionCookie, isBetterAuthCookieName } from "./lib/auth-cookies";

const isSquirrelStartupEvent = (): boolean => {
  if (process.platform !== "win32") {
    return false;
  }

  return process.argv.some((arg): boolean => arg.startsWith("--squirrel-"));
};

if (isSquirrelStartupEvent()) {
  app.quit();
}

/* oxlint-disable node/no-process-env -- main.ts: This process boundary owns environment loading/forwarding; consumers receive the resulting validated configuration. */
/* oxlint-disable typescript/strict-boolean-expressions -- main.ts: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
// Disable GPU acceleration in WSL / headless environments to prevent D3D12 crashes.
if (process.env.WSL_DISTRO_NAME || process.env.WSLENV) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-software-rasterizer");
}
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable node/no-process-env */

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

type AuthRendererState =
  | {
      status: "idle";
      message: null;
    }
  | {
      status: "awaiting-browser" | "finishing" | "timed-out" | "error";
      message: string;
      detail?: string | null;
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

/* oxlint-disable eslint/max-lines-per-function -- setAuthOverlay: The operation keeps its validation, ordered side effects and cleanup in one scope. */
/* oxlint-disable unicorn/no-null -- setAuthOverlay: The SDK/wire/OS contract uses null as an explicit absence value. */
/* oxlint-disable eslint/no-console -- setAuthOverlay: This command or desktop boundary reports startup, progress and failures to its operator. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- setAuthOverlay: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
const setAuthOverlay = async (
  win: BrowserWindow | null,
  options:
    | {
        visible: false;
      }
    | {
        visible: true;
        message: string;
      }
): Promise<void> => {
  if (!win || win.isDestroyed()) {
    return;
  }

  currentAuthOverlayMessage = options.visible ? options.message : null;

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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-console */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/max-lines-per-function */

/* oxlint-disable eslint/max-statements -- setAuthState: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- setAuthState: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
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
/* oxlint-disable eslint/max-statements -- better-auth:requestAuth: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
/* oxlint-disable eslint/no-magic-numbers -- better-auth:requestAuth: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- better-auth:requestAuth: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
ipcMain.handle(
  "better-auth:requestAuth",
  async (_event, options): Promise<void> => {
    if (isAuthFlowInProgress) {
      mainWindow?.show();
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
        detail: error instanceof Error ? error.message : String(error),
        message: "Couldn't open the browser sign-in flow.",
        status: "error",
      });
      throw error;
    }
  }
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-statements */

ipcMain.handle("chatjs:cancel-auth-flow", async (): Promise<void> => {
  await resetAuthFlow();
});

/* oxlint-disable eslint/max-statements -- syncAuthSessionCookies: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
/* oxlint-disable eslint/max-lines-per-function -- syncAuthSessionCookies: The operation keeps its validation, ordered side effects and cleanup in one scope. */
/* oxlint-disable eslint/no-magic-numbers -- syncAuthSessionCookies: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
/* oxlint-disable unicorn/no-null -- syncAuthSessionCookies: The SDK/wire/OS contract uses null as an explicit absence value. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- syncAuthSessionCookies: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
/* oxlint-disable typescript/promise-function-async -- syncAuthSessionCookies: Keep synchronous validation/throws and the original promise identity; adding async changes those observable boundaries. */
const syncAuthSessionCookies = async (
  win?: BrowserWindow | null
): Promise<void> => {
  const targetWindow = win ?? mainWindow;
  const targetSession = targetWindow?.webContents.session;

  if (!targetSession) {
    return;
  }

  const url = new URL(APP_URL);
  const existingCookies = await targetSession.cookies.get({ url: url.origin });

  await Promise.all(
    existingCookies
      .filter((cookie): boolean => isBetterAuthCookieName(cookie.name))
      .map((cookie): Promise<void> =>
        targetSession.cookies.remove(url.origin, cookie.name)
      )
  );

  const cookieHeader = electronAuthClient.getCookie();

  if (!cookieHeader) {
    return;
  }

  const cookies = cookieHeader
    .split(/;\s*/u)
    .map((entry: string) => {
      const index = entry.indexOf("=");
      if (index < 1) {
        return null;
      }

      return {
        name: entry.slice(0, index),
        value: entry.slice(index + 1),
      };
    })
    .filter(
      (cookie): cookie is { name: string; value: string } => cookie !== null
    )
    .filter((cookie: { name: string; value: string }): boolean =>
      isBetterAuthCookieName(cookie.name)
    );

  await Promise.all(
    cookies.map((cookie: { name: string; value: string }): Promise<void> =>
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
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

ipcMain.removeHandler("better-auth:signOut");
ipcMain.handle("better-auth:signOut", async () => {
  const result = await electronAuthClient.signOut();
  await syncAuthSessionCookies();
  return result;
});

ipcMain.removeHandler("better-auth:getUser");
/* oxlint-disable unicorn/no-null -- better-auth:getUser: The SDK/wire/OS contract uses null as an explicit absence value. */
ipcMain.handle("better-auth:getUser", async () => {
  const sessionResult = await electronAuthClient.getSession();
  return sessionResult.data?.user ?? null;
});
/* oxlint-enable unicorn/no-null */

const getAppAssetPath = (...segments: readonly string[]): string =>
  path.join(app.getAppPath(), ...segments);

/* oxlint-disable eslint/max-statements -- authenticateFromDeepLink: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
/* oxlint-disable unicorn/no-null -- authenticateFromDeepLink: The SDK/wire/OS contract uses null as an explicit absence value. */
/* oxlint-disable eslint/no-console -- authenticateFromDeepLink: This command or desktop boundary reports startup, progress and failures to its operator. */
/* oxlint-disable typescript/strict-boolean-expressions -- authenticateFromDeepLink: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
const authenticateFromDeepLink = async (url: string): Promise<boolean> => {
  try {
    if (!isAuthFlowInProgress) {
      return false;
    }

    const parsed = new URL(url);
    const token = parsed.hash.startsWith("#token=")
      ? parsed.hash.slice("#token=".length)
      : null;

    if (!token) {
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
      detail: error instanceof Error ? error.message : String(error),
      message: "We couldn't finish sign-in automatically.",
      status: "error",
    });
    return false;
  }
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable eslint/no-console */
/* oxlint-enable unicorn/no-null */
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
    void (async (): Promise<void> => {
      try {
        const ready = await waitForElectronSession();
        if (!ready) {
          isAuthFlowInProgress = false;
          await setAuthState(
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
          detail: error instanceof Error ? error.message : String(error),
          message: "Sign-in refresh failed.",
          status: "error",
        });
      }
    })();
    pendingAuthRefreshTimer = null;
  }, 250);
};
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/no-console */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable typescript/strict-boolean-expressions -- createWindow: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- createWindow: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
const createWindow = (): BrowserWindow => {
  const win = new BrowserWindow({
    ...WINDOW_DEFAULTS,
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
    if (currentAuthOverlayMessage) {
      void setAuthOverlay(win, {
        message: currentAuthOverlayMessage,
        visible: true,
      });
    }
  });

  // Open all new-window requests (including OAuth popups) in the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  // Minimize to tray on close
  win.on("close", (event): void => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/strict-boolean-expressions */

/* oxlint-disable eslint/id-length -- createTray: The local index/OS/library binding retains its conventional API notation. */
/* oxlint-disable typescript/strict-boolean-expressions -- createTray: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
const createTray = (): Tray => {
  const iconPath = getAppAssetPath("build", "icon.png");
  const trayIcon = nativeImage.createFromPath(iconPath);
  const t = new Tray(trayIcon.resize({ height: 16, width: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      click: (): void => {
        mainWindow?.show();
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

  t.setToolTip(APP_NAME);
  t.setContextMenu(contextMenu);

  t.on("click", (): void => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });

  return t;
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable eslint/id-length */

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
/* oxlint-enable eslint/no-console */

ipcMain.handle("chatjs:sync-auth-session", async (): Promise<void> => {
  await syncAuthSessionCookies();
});

ipcMain.handle("chatjs:get-auth-state", () => currentAuthState);

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
      mainWindow?.show();
    }
  });
})();
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- open-url: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
app.on("open-url", (_event, url): void => {
  void (async (): Promise<void> => {
    const didAuthenticate = await authenticateFromDeepLink(url);
    if (didAuthenticate) {
      scheduleAuthRefresh();
    }
  })();
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- second-instance: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
/* oxlint-disable typescript/strict-boolean-expressions -- second-instance: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
app.on("second-instance", (_event, commandLine): void => {
  const deepLinkUrl = commandLine.find((value): boolean =>
    value.startsWith(`${APP_SCHEME}://`)
  );

  if (deepLinkUrl) {
    void (async (): Promise<void> => {
      const didAuthenticate = await authenticateFromDeepLink(deepLinkUrl);
      if (didAuthenticate) {
        scheduleAuthRefresh();
      }
    })();
  }
});
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

app.on("before-quit", (): void => {
  isQuitting = true;
  tray?.destroy();
});

app.on("window-all-closed", (): void => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

/* oxlint-disable max-lines -- window-all-closed: This module is one coordinated protocol/lifecycle implementation; splitting requires an ownership and public API decision. */
