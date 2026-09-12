import * as path from "node:path";

import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  type MenuItemConstructorOptions,
  nativeImage,
  shell,
  Tray,
} from "electron";

import { ELECTRON_AUTH_COOKIE_PREFIX } from "@/lib/electron-auth";

import { APP_NAME, APP_SCHEME, APP_URL, WINDOW_DEFAULTS } from "./config";
import { electronAuthClient } from "./lib/auth-client";

function isSquirrelStartupEvent(): boolean {
  if (process.platform !== "win32") {
    return false;
  }

  return process.argv.some((arg) => arg.startsWith("--squirrel-"));
}

if (isSquirrelStartupEvent()) {
  app.quit();
}

// Disable GPU acceleration in WSL / headless environments to prevent D3D12 crashes.
if (process.env.WSL_DISTRO_NAME || process.env.WSLENV) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-software-rasterizer");
}

let isQuitting = false;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let pendingAuthRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let currentAuthOverlayMessage: string | null = null;
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

let currentAuthState: AuthRendererState = {
  status: "idle",
  message: null,
};

if (!gotSingleInstanceLock) {
  app.quit();
}

function registerProtocolClient(): void {
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
}

function broadcastAuthState(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("chatjs:auth-state-changed", currentAuthState);
}

async function resetAuthFlow(): Promise<void> {
  if (pendingAuthRefreshTimer) {
    clearTimeout(pendingAuthRefreshTimer);
    pendingAuthRefreshTimer = null;
  }

  isAuthFlowInProgress = false;
  currentAuthFlowId += 1;

  await setAuthState({
    status: "idle",
    message: null,
  });
}

async function setAuthState(nextState: AuthRendererState): Promise<void> {
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
      visible: true,
      message: nextState.message,
    });
    return;
  }

  await setAuthOverlay(mainWindow, { visible: false });
}

async function setAuthOverlay(
  win: BrowserWindow | null,
  options:
    | {
        visible: false;
      }
    | {
        visible: true;
        message: string;
      }
): Promise<void> {
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
      win.webContents.once("did-finish-load", () => {
        win.webContents.executeJavaScript(script).catch((error) => {
          console.warn("[electron-main] failed to update auth overlay", error);
        });
      });
      return;
    }

    await win.webContents.executeJavaScript(script);
  } catch (error) {
    console.warn("[electron-main] failed to update auth overlay", error);
  }
}

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
ipcMain.handle("better-auth:requestAuth", async (_event, options) => {
  if (isAuthFlowInProgress) {
    mainWindow?.show();
    mainWindow?.focus();
    return;
  }

  isAuthFlowInProgress = true;
  currentAuthFlowId += 1;

  await setAuthState({
    status: "awaiting-browser",
    message: "Waiting for sign-in in your browser...",
  });

  try {
    await electronAuthClient.requestAuth(options);
  } catch (error) {
    isAuthFlowInProgress = false;
    await setAuthState({
      status: "error",
      message: "Couldn't open the browser sign-in flow.",
      detail: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
});

ipcMain.handle("chatjs:cancel-auth-flow", async () => {
  await resetAuthFlow();
});

ipcMain.removeHandler("better-auth:signOut");
ipcMain.handle("better-auth:signOut", async () => {
  const result = await electronAuthClient.signOut();
  await syncAuthSessionCookies();
  return result;
});

ipcMain.removeHandler("better-auth:getUser");
ipcMain.handle("better-auth:getUser", async () => {
  const sessionResult = await electronAuthClient.getSession();
  return sessionResult.data?.user ?? null;
});

function getAppAssetPath(...segments: string[]): string {
  return path.join(app.getAppPath(), ...segments);
}

function isBetterAuthCookieName(name: string): boolean {
  return (
    name.startsWith(ELECTRON_AUTH_COOKIE_PREFIX) ||
    name.startsWith(`__Secure-${ELECTRON_AUTH_COOKIE_PREFIX}`) ||
    name.endsWith("session_token") ||
    name.endsWith("session_data")
  );
}

async function syncAuthSessionCookies(
  win?: BrowserWindow | null
): Promise<void> {
  const targetWindow = win ?? mainWindow;
  const targetSession = targetWindow?.webContents.session;

  if (!targetSession) {
    return;
  }

  const url = new URL(APP_URL);
  const existingCookies = await targetSession.cookies.get({ url: url.origin });

  await Promise.all(
    existingCookies
      .filter((cookie) => isBetterAuthCookieName(cookie.name))
      .map((cookie) => targetSession.cookies.remove(url.origin, cookie.name))
  );

  const cookieHeader = electronAuthClient.getCookie();

  if (!cookieHeader) {
    return;
  }

  const cookies = cookieHeader
    .split(/;\s*/)
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
    .filter((cookie: { name: string; value: string }) =>
      isBetterAuthCookieName(cookie.name)
    );

  await Promise.all(
    cookies.map((cookie: { name: string; value: string }) =>
      targetSession.cookies.set({
        name: cookie.name,
        path: "/",
        secure: url.protocol === "https:",
        url: url.origin,
        value: cookie.value,
      })
    )
  );
}

function hasSessionCookie(cookieHeader: string): boolean {
  return /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/.test(
    cookieHeader
  );
}

async function authenticateFromDeepLink(url: string): Promise<boolean> {
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
      status: "finishing",
      message: "Finishing sign-in...",
    });
    await electronAuthClient.authenticate({ token });
    return true;
  } catch (error) {
    console.error("[electron-main] deep link authentication failed", error);
    isAuthFlowInProgress = false;
    await setAuthState({
      status: "error",
      message: "We couldn't finish sign-in automatically.",
      detail: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function waitForElectronSession(timeoutMs = 8_000): Promise<boolean> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const cookieHeader = electronAuthClient.getCookie();
    const hasCookie = hasSessionCookie(cookieHeader);

    try {
      const sessionResult = await electronAuthClient.getSession();
      const hasUser = !!sessionResult.data?.user;

      if (hasCookie && hasUser) {
        return true;
      }
    } catch (error) {
      console.warn("[electron-main] session check failed while waiting", error);
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return false;
}

function scheduleAuthRefresh(): void {
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

  pendingAuthRefreshTimer = setTimeout(() => {
    void waitForElectronSession()
      .then(async (ready) => {
        if (!ready) {
          isAuthFlowInProgress = false;
          if (authFlowId === currentAuthFlowId) {
            await setAuthState({
              status: "timed-out",
              message:
                "Still waiting for the desktop app to finish signing in...",
              detail: "Please try the browser flow again.",
            });
          } else {
            await setAuthState({
              status: "idle",
              message: null,
            });
          }
          return;
        }

        await syncAuthSessionCookies(targetWindow);
        isAuthFlowInProgress = false;
        await setAuthState({
          status: "idle",
          message: null,
        });
      })
      .catch((error) => {
        console.error("[electron-main] auth refresh failed", error);
        isAuthFlowInProgress = false;
        void setAuthState({
          status: "error",
          message: "Sign-in refresh failed.",
          detail: error instanceof Error ? error.message : String(error),
        });
      });
    pendingAuthRefreshTimer = null;
  }, 250);
}

async function createWindow(): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    ...WINDOW_DEFAULTS,
    ...(process.platform === "darwin" || process.platform === "win32"
      ? { titleBarStyle: "default" as const }
      : { titleBarStyle: "hidden" as const, titleBarOverlay: true }),
    webPreferences: {
      preload: getAppAssetPath("dist", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.platform === "win32" || process.platform === "linux") {
    win.removeMenu();
  }

  // Avoid touching encrypted auth storage on app launch. On macOS this can
  // trigger an immediate Keychain prompt before the window even loads, which
  // feels like a crash. Session sync still runs after explicit auth events.
  win.loadURL(APP_URL);

  win.webContents.on("did-finish-load", () => {
    if (currentAuthOverlayMessage) {
      void setAuthOverlay(win, {
        visible: true,
        message: currentAuthOverlayMessage,
      });
    }
  });

  // Open all new-window requests (including OAuth popups) in the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Minimize to tray on close
  win.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  if (!app.isPackaged) {
    win.webContents.openDevTools({ mode: "detach" });
  }

  return win;
}

function createTray(): Tray {
  const iconPath = getAppAssetPath("build", "icon.png");
  const trayIcon = nativeImage.createFromPath(iconPath);
  const t = new Tray(trayIcon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Show ${APP_NAME}`,
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  t.setToolTip(APP_NAME);
  t.setContextMenu(contextMenu);

  t.on("click", () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });

  return t;
}

function setupApplicationMenu(): void {
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
    ...(!app.isPackaged
      ? ([
          {
            role: "viewMenu",
            submenu: [
              { role: "reload" },
              { role: "forceReload" },
              { type: "separator" },
              { role: "toggleDevTools" },
            ],
          },
        ] satisfies MenuItemConstructorOptions[])
      : []),
    {
      role: "windowMenu",
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function setupAutoUpdater(): void {
  if (!app.isPackaged) {
    return;
  }

  try {
    const { updateElectronApp } = require("update-electron-app") as {
      updateElectronApp: (options?: {
        logger?: Pick<typeof console, "error" | "log" | "warn">;
        notifyUser?: boolean;
        updateInterval?: string;
      }) => void;
    };

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
}

ipcMain.handle("chatjs:sync-auth-session", async () => {
  await syncAuthSessionCookies();
});

ipcMain.handle("chatjs:get-auth-state", () => currentAuthState);

app.whenReady().then(async () => {
  app.setName(APP_NAME);
  setupApplicationMenu();
  mainWindow = await createWindow();
  tray = createTray();
  setupAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow().then((window) => {
        mainWindow = window;
      });
    } else {
      mainWindow?.show();
    }
  });
});

app.on("open-url", (_event, url) => {
  void authenticateFromDeepLink(url).then((didAuthenticate) => {
    if (didAuthenticate) {
      scheduleAuthRefresh();
    }
  });
});

app.on("second-instance", (_event, commandLine) => {
  const deepLinkUrl = commandLine.find((value) =>
    value.startsWith(`${APP_SCHEME}://`)
  );

  if (deepLinkUrl) {
    void authenticateFromDeepLink(deepLinkUrl).then((didAuthenticate) => {
      if (didAuthenticate) {
        scheduleAuthRefresh();
      }
    });
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  tray?.destroy();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
