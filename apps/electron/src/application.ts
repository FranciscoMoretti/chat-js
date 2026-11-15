import {
  APP_NAME,
  APP_SCHEME,
  APP_URL,
  WINDOW_DEFAULTS,
  ELECTRON_AUTH_COOKIE_PREFIX,
} from "./config";
import {
  BrowserWindow,
  Menu,
  Tray,
  app,
  ipcMain,
  nativeImage,
  shell,
} from "electron";
import {
  hasSessionCookie,
  isBetterAuthCookieName,
  isSessionTokenCookieName,
} from "./lib/auth-cookies";
import type { IpcMainInvokeEvent, MenuItemConstructorOptions } from "electron";
import { electronAuthClient } from "./lib/auth-client";
import { parseAuthRequestOptions } from "./auth-request-options";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const APP_ORIGIN = new URL(APP_URL).origin;

const AUTH_FLOW_ID_INCREMENT = 1;
const AUTH_REFRESH_DELAY_MS = 250;
const AUTH_SESSION_POLL_INTERVAL_MS = 250;
const AUTH_SESSION_TIMEOUT_MS = 8000;
const COOKIE_NAME_START_INDEX = 0;
const COOKIE_SEPARATOR_LENGTH = 1;
const DEV_ENTRY_ARG_INDEX = 1;
const DEV_ENTRY_MIN_ARGS = 2;
const EMPTY_WINDOW_COUNT = 0;
const SQUIRREL_FIRST_RUN_DELAY_MS = 10_000;

// Disable GPU acceleration in WSL / headless environments to prevent D3D12 crashes.
const isWslOrHeadless =
  (process.env.WSL_DISTRO_NAME ?? "") !== "" ||
  (process.env.WSLENV ?? "") !== "";
if (isWslOrHeadless) {
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

let currentAuthState: AuthRendererState = {
  message: null,
  status: "idle",
};

if (!gotSingleInstanceLock) {
  app.quit();
}

const registerProtocolClient = (): void => {
  if (process.defaultApp) {
    if (
      process.platform === "win32" &&
      process.argv.length >= DEV_ENTRY_MIN_ARGS
    ) {
      app.setAsDefaultProtocolClient(APP_SCHEME, process.execPath, [
        path.resolve(process.argv[DEV_ENTRY_ARG_INDEX]),
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

const getAuthErrorDetail = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const parseWebUrl = (url: string): URL | null => {
  const parsed = URL.parse(url);
  return parsed?.protocol === "https:" || parsed?.protocol === "http:"
    ? parsed
    : null;
};

const isAppUrl = (url: string): boolean =>
  parseWebUrl(url)?.origin === APP_ORIGIN;

const isAppMainFrame = (
  contents: Electron.WebContents,
  frame: Electron.WebFrameMain | null | undefined
): boolean =>
  frame !== null &&
  frame !== undefined &&
  frame === contents.mainFrame &&
  frame.origin === APP_ORIGIN &&
  isAppUrl(frame.url);

const assertAppAuthSender = ({
  sender,
  senderFrame,
}: IpcMainInvokeEvent): void => {
  if (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    sender !== mainWindow.webContents ||
    !isAppMainFrame(sender, senderFrame)
  ) {
    throw new Error("Untrusted sender for desktop auth IPC");
  }
};

const showMainWindow = (): void => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
};

const broadcastAuthState = (): void => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("chatjs:auth-state-changed", currentAuthState);
};

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
        if (options.visible && currentAuthOverlayMessage !== options.message) {
          return;
        }
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

const setAuthState = async (nextState: AuthRendererState): Promise<void> => {
  currentAuthState = nextState;
  broadcastAuthState();

  if (
    nextState.status === "idle" ||
    nextState.status === "timed-out" ||
    nextState.status === "error"
  ) {
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

const resetAuthFlow = async (): Promise<void> => {
  if (pendingAuthRefreshTimer) {
    clearTimeout(pendingAuthRefreshTimer);
    pendingAuthRefreshTimer = null;
  }

  isAuthFlowInProgress = false;
  currentAuthFlowId += AUTH_FLOW_ID_INCREMENT;

  await setAuthState({
    message: null,
    status: "idle",
  });
};

// Configure the SDK before readiness. The application handles deep links and
// registers its own IPC handlers so every auth invocation checks the sender.
electronAuthClient.setupMain({
  bridges: false,
  getWindow: () => mainWindow,
  scheme: false,
});

registerProtocolClient();

ipcMain.handle(
  "better-auth:requestAuth",
  async (event: IpcMainInvokeEvent, options: unknown): Promise<void> => {
    assertAppAuthSender(event);

    if (isAuthFlowInProgress) {
      showMainWindow();
      return;
    }

    isAuthFlowInProgress = true;
    currentAuthFlowId += AUTH_FLOW_ID_INCREMENT;

    await setAuthState({
      message: "Waiting for sign-in in your browser...",
      status: "awaiting-browser",
    });

    try {
      await electronAuthClient.requestAuth(parseAuthRequestOptions(options));
    } catch (error) {
      isAuthFlowInProgress = false;
      await setAuthState({
        detail: getAuthErrorDetail(error),
        message: "Couldn't open the browser sign-in flow.",
        status: "error",
      });
      throw error;
    }
  }
);

ipcMain.handle(
  "chatjs:cancel-auth-flow",
  async (event: IpcMainInvokeEvent): Promise<void> => {
    assertAppAuthSender(event);
    await resetAuthFlow();
  }
);
const syncAuthSessionCookies = async (
  win?: AuthSessionWindow | null
): Promise<void> => {
  const targetWindow = win ?? mainWindow;
  if (!targetWindow) {
    return;
  }
  const targetSession = targetWindow.webContents.session;

  const url = new URL(APP_URL);
  const existingCookies = await targetSession.cookies.get({ url: url.origin });

  await Promise.all(
    existingCookies
      .filter((cookie: Readonly<Electron.Cookie>): boolean =>
        isBetterAuthCookieName(cookie.name, ELECTRON_AUTH_COOKIE_PREFIX)
      )
      .map(async (cookie: Readonly<Electron.Cookie>): Promise<void> => {
        await targetSession.cookies.remove(url.origin, cookie.name);
      })
  );

  const cookieHeader = electronAuthClient.getCookie();

  if (!cookieHeader) {
    return;
  }

  const cookies = cookieHeader
    .split(/;\s*/u)
    .map((entry: string): Readonly<{ name: string; value: string }> | null => {
      const index = entry.indexOf("=");
      if (index < COOKIE_SEPARATOR_LENGTH) {
        return null;
      }

      return {
        name: entry.slice(COOKIE_NAME_START_INDEX, index),
        value: entry.slice(index + COOKIE_SEPARATOR_LENGTH),
      };
    })
    .filter((cookie) => cookie !== null)
    .filter((cookie: Readonly<{ name: string; value: string }>): boolean =>
      isBetterAuthCookieName(cookie.name, ELECTRON_AUTH_COOKIE_PREFIX)
    );

  await Promise.all(
    cookies.map(
      async (
        cookie: Readonly<{ name: string; value: string }>
      ): Promise<void> => {
        await targetSession.cookies.set({
          httpOnly: isSessionTokenCookieName(cookie.name),
          name: cookie.name,
          path: "/",
          secure: url.protocol === "https:",
          url: url.origin,
          value: cookie.value,
        });
      }
    )
  );
};

ipcMain.handle("better-auth:signOut", async (event: IpcMainInvokeEvent) => {
  assertAppAuthSender(event);
  const result = await electronAuthClient.signOut();
  await syncAuthSessionCookies();
  return result;
});
ipcMain.handle("better-auth:getUser", async (event: IpcMainInvokeEvent) => {
  assertAppAuthSender(event);
  const sessionResult = await electronAuthClient.getSession();
  const sessionData = sessionResult.data;
  if (!sessionData) {
    return null;
  }
  return sessionData.user ?? null;
});

const getAppAssetPath = (...segments: readonly string[]): string =>
  path.join(app.getAppPath(), ...segments);

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
      detail: getAuthErrorDetail(error),
      message: "We couldn't finish sign-in automatically.",
      status: "error",
    });
    return false;
  }
};

const waitForElectronSession = async (
  timeoutMs = AUTH_SESSION_TIMEOUT_MS
): Promise<boolean> => {
  const deadline = performance.now() + timeoutMs;
  // Use the same deadline for every request, including response body reads.
  const signal = AbortSignal.timeout(timeoutMs);

  while (!signal.aborted && performance.now() < deadline) {
    const cookieHeader = electronAuthClient.getCookie();
    const hasCookie = hasSessionCookie(cookieHeader);

    try {
      // oxlint-disable-next-line no-await-in-loop -- Poll sequentially until the native cookie and server session agree.
      const sessionResult = await electronAuthClient.getSession({
        fetchOptions: { signal },
      });
      const sessionData = sessionResult.data;
      const hasUser = Boolean(sessionData && sessionData.user);

      if (hasCookie && hasUser && performance.now() < deadline) {
        return true;
      }
    } catch (error) {
      if (signal.aborted) {
        return false;
      }
      console.warn("[electron-main] session check failed while waiting", error);
    }

    const remainingMs = deadline - performance.now();
    if (remainingMs <= 0) {
      break;
    }
    // oxlint-disable-next-line no-await-in-loop -- Back off between session polls rather than issue overlapping requests.
    await sleep(Math.min(AUTH_SESSION_POLL_INTERVAL_MS, remainingMs));
  }

  return false;
};

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
        if (authFlowId !== currentAuthFlowId) {
          return;
        }

        if (!ready) {
          isAuthFlowInProgress = false;
          await setAuthState({
            detail: "Please try the browser flow again.",
            message:
              "Still waiting for the desktop app to finish signing in...",
            status: "timed-out",
          });
          return;
        }

        await syncAuthSessionCookies(targetWindow);
        if (authFlowId !== currentAuthFlowId) {
          return;
        }
        isAuthFlowInProgress = false;
        await setAuthState({
          message: null,
          status: "idle",
        });
      } catch (error) {
        if (authFlowId !== currentAuthFlowId) {
          return;
        }
        console.error("[electron-main] auth refresh failed", error);
        isAuthFlowInProgress = false;
        await setAuthState({
          detail: getAuthErrorDetail(error),
          message: "Sign-in refresh failed.",
          status: "error",
        });
      }
    })();
    pendingAuthRefreshTimer = null;
  }, AUTH_REFRESH_DELAY_MS);
};

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

  win.webContents.on("will-navigate", (event) => {
    const destination = parseWebUrl(event.url);
    if (destination?.origin === APP_ORIGIN) {
      return;
    }
    event.preventDefault();

    // Connector authorization navigates directly from the app to the provider.
    if (destination && isAppMainFrame(win.webContents, event.initiator)) {
      void (async (): Promise<void> => {
        try {
          await shell.openExternal(destination.href);
        } catch (error) {
          console.warn("[electron-main] failed to open link in browser", error);
        }
      })();
    }
  });
  win.webContents.on("will-redirect", (event) => {
    if (event.isMainFrame && !isAppUrl(event.url)) {
      event.preventDefault();
    }
  });

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
        if (mainWindow) {
          mainWindow.show();
        }
        if (mainWindow) {
          mainWindow.focus();
        }
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
    if (mainWindow && mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      if (mainWindow) {
        mainWindow.show();
      }
      if (mainWindow) {
        mainWindow.focus();
      }
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

const setupAutoUpdater = async (): Promise<void> => {
  if (!app.isPackaged) {
    return;
  }

  try {
    if (
      process.platform === "win32" &&
      process.argv.includes("--squirrel-firstrun")
    ) {
      // Squirrel holds the updater lock briefly after installation. Only delay
      // the update check; the window and tray have already started normally.
      await sleep(SQUIRREL_FIRST_RUN_DELAY_MS);
    }
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

ipcMain.handle(
  "chatjs:sync-auth-session",
  async (event: IpcMainInvokeEvent): Promise<void> => {
    assertAppAuthSender(event);
    await syncAuthSessionCookies();
  }
);
ipcMain.handle("chatjs:get-auth-state", (event: IpcMainInvokeEvent) => {
  assertAppAuthSender(event);
  return currentAuthState;
});

void (async (): Promise<void> => {
  await app.whenReady();
  app.setName(APP_NAME);
  setupApplicationMenu();
  mainWindow = createWindow();
  tray = createTray();
  void setupAutoUpdater();

  app.on("activate", (): void => {
    if (BrowserWindow.getAllWindows().length === EMPTY_WINDOW_COUNT) {
      mainWindow = createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
})();

app.on("open-url", (_event: unknown, url): void => {
  void (async (): Promise<void> => {
    const didAuthenticate = await authenticateFromDeepLink(url);
    if (didAuthenticate) {
      scheduleAuthRefresh();
    }
  })();
});

app.on(
  "second-instance",
  (_event: unknown, commandLine: readonly string[]): void => {
    const deepLinkUrl = commandLine.find((value): boolean =>
      value.startsWith(`${APP_SCHEME}://`)
    );

    if (deepLinkUrl === undefined) {
      showMainWindow();
      return;
    }

    void (async (): Promise<void> => {
      const didAuthenticate = await authenticateFromDeepLink(deepLinkUrl);
      if (didAuthenticate) {
        scheduleAuthRefresh();
      }
    })();
  }
);
app.on("before-quit", (): void => {
  isQuitting = true;
  if (tray) {
    tray.destroy();
  }
});

app.on("window-all-closed", (): void => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
