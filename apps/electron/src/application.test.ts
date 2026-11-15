import { beforeAll, expect, mock, test } from "bun:test";
import { EventEmitter, once } from "node:events";
import { createRequire } from "node:module";
import path from "node:path";
import { setImmediate } from "node:timers/promises";
import { Script } from "node:vm";

const nodeRequire = createRequire(import.meta.url);
const appUrl = "https://chat.example.test";
const token = "signed=token";
const cookieName = "__Secure-chatjs-dev-123.session_token";
const user = { id: "test-user" };
let application: Script;

beforeAll(async () => {
  const result = await Bun.build({
    entrypoints: [path.join(import.meta.dir, "application.ts")],
    external: ["electron", "update-electron-app"],
    plugins: [
      {
        name: "application-test-dependencies",
        setup(build) {
          build.onResolve(
            { filter: /^\.\/(?:config|lib\/auth-client)$/u },
            ({ path: request }) => ({
              external: true,
              path: request,
            })
          );
        },
      },
    ],
    format: "cjs",
    target: "node",
  });
  expect(result.success).toBe(true);
  application = new Script(await result.outputs[0].text());
});

const launch = async () => {
  // Electron emitters use EventEmitter's API.
  // oxlint-disable-next-line unicorn/prefer-event-target
  const app = Object.assign(new EventEmitter(), {
    getAppPath: () => import.meta.dir,
    requestSingleInstanceLock: () => true,
    setAsDefaultProtocolClient: () => true,
    setName: () => {},
    whenReady: async () => {},
  });
  const frame = { origin: appUrl, url: appUrl };
  const cookies = {
    // oxlint-disable-next-line typescript/promise-function-async -- The mock returns an already resolved promise.
    get: mock(() => Promise.resolve([])),
    set: mock(async (_cookie: Electron.CookiesSetDetails) => {}),
  };
  // oxlint-disable-next-line unicorn/prefer-event-target
  const contents = Object.assign(new EventEmitter(), {
    executeJavaScript: mock(async (_script: string) => {}),
    isLoadingMainFrame: mock(() => false),
    mainFrame: frame,
    openDevTools: () => {},
    send: () => {},
    session: { cookies },
    setWindowOpenHandler: () => {},
  });
  // oxlint-disable-next-line unicorn/prefer-event-target
  const win = Object.assign(new EventEmitter(), {
    focus: mock(() => {}),
    hide: mock(() => {}),
    isDestroyed: () => false,
    isMinimized: mock(() => false),
    loadURL: async () => {},
    removeMenu: () => {},
    restore: mock(() => {}),
    show: mock(() => {}),
    webContents: contents,
  });
  const authClient = {
    authenticate: mock(async () => {}),
    getCookie: () => `${cookieName}=${token}; chatjs.state=state`,
    getSession: mock(
      // oxlint-disable-next-line typescript/promise-function-async -- The mock returns an already resolved promise.
      (_options?: { fetchOptions: { signal: AbortSignal } }) =>
        Promise.resolve({ data: { user } })
    ),
    requestAuth: mock(async () => {}),
    setupMain: mock(() => {}),
    signOut: mock(async () => {}),
  };
  type Invoke = (event: unknown, options?: unknown) => unknown;
  const handlers = new Map<string, Invoke>();
  const electron = {
    app,
    // oxlint-disable-next-line eslint/prefer-arrow-callback -- Electron calls the mock with new.
    BrowserWindow: mock(function BrowserWindow() {
      return win;
    }),
    ipcMain: {
      handle(channel: string, handler: Invoke) {
        handlers.set(channel, handler);
      },
    },
    Menu: { buildFromTemplate: () => ({}) },
    nativeImage: { createFromPath: () => ({ resize: () => ({}) }) },
    // oxlint-disable-next-line eslint/prefer-arrow-callback -- Electron calls the mock with new.
    Tray: mock(function Tray() {
      return { on() {}, setContextMenu() {}, setToolTip() {} };
    }),
  };
  const abort = new AbortController();
  const startDeadline = mock(() => abort.signal);
  const timers: (() => void)[] = [];
  application.runInNewContext({
    AbortSignal: { timeout: startDeadline },
    console,
    module: { exports: {} },
    performance,
    process: { env: {}, platform: "win32" },
    require(id: string): unknown {
      switch (id) {
        case "electron": {
          return electron;
        }
        case "./config": {
          return {
            APP_NAME: "Test Chat",
            APP_SCHEME: "chatjs",
            APP_URL: appUrl,
            ELECTRON_AUTH_COOKIE_PREFIX: "chatjs",
          };
        }
        case "./lib/auth-client": {
          return { electronAuthClient: authClient };
        }
        default: {
          return nodeRequire(id);
        }
      }
    },
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- Capture Electron main timers for deterministic tests.
    setTimeout(callback: () => void) {
      timers.push(callback);
    },
    URL,
  });
  await setImmediate();
  const trusted = { sender: contents, senderFrame: frame };
  const invoke = async (channel: string, event: unknown = trusted) => {
    const handler = handlers.get(channel);
    if (!handler) {
      throw new Error(`Missing IPC handler: ${channel}`);
    }
    return await Promise.resolve(handler(event));
  };
  return {
    abort,
    app,
    authClient,
    contents,
    cookies,
    frame,
    handlers,
    invoke,
    startDeadline,
    timers,
    trusted,
    win,
  };
};

test("main-frame navigation and redirects stay on the configured app origin", async () => {
  const { contents } = await launch();
  for (const event of ["will-navigate", "will-redirect"]) {
    const preventDefault = mock(() => {});
    contents.emit(event, {
      isMainFrame: true,
      preventDefault,
      url: `${appUrl}/chat`,
    });
    expect(preventDefault).not.toHaveBeenCalled();
    contents.emit(event, {
      isMainFrame: true,
      preventDefault,
      url: `${appUrl}.other.test/`,
    });
    expect(preventDefault).toHaveBeenCalledTimes(1);
  }
});

test("only the app's trusted main frame can use auth IPC", async () => {
  const { authClient, contents, frame, handlers, invoke, trusted } =
    await launch();
  expect(authClient.setupMain).toHaveBeenCalledWith(
    expect.objectContaining({ bridges: false })
  );
  expect(handlers.has("better-auth:authenticate")).toBe(false);
  const channels = [
    "better-auth:getUser",
    "better-auth:requestAuth",
    "better-auth:signOut",
    "chatjs:sync-auth-session",
    "chatjs:cancel-auth-flow",
    "chatjs:get-auth-state",
  ];
  const assertUntrusted = async (event: unknown = trusted) => {
    await Promise.all(
      channels.map(async (channel) => {
        const rejection: unknown = await invoke(channel, event).catch(
          (error: unknown) => error
        );
        expect(rejection).toHaveProperty(
          "message",
          "Untrusted sender for desktop auth IPC"
        );
      })
    );
  };
  await assertUntrusted({ ...trusted, sender: {} });
  await assertUntrusted({ ...trusted, senderFrame: { ...frame } });
  await assertUntrusted({ ...trusted, senderFrame: null });
  frame.url = "https://other.example.test";
  await assertUntrusted({ sender: contents, senderFrame: frame });
  frame.url = appUrl;
  frame.origin = "null";
  await assertUntrusted();
  frame.origin = appUrl;
  expect(authClient.getSession).not.toHaveBeenCalled();
  expect(authClient.requestAuth).not.toHaveBeenCalled();
  expect(authClient.signOut).not.toHaveBeenCalled();
  expect(await invoke("better-auth:getUser")).toEqual(user);
});

test("cookie sync preserves the full session token and makes it HttpOnly", async () => {
  const { cookies, invoke } = await launch();
  await invoke("chatjs:sync-auth-session");
  expect(cookies.set).toHaveBeenCalledWith({
    httpOnly: true,
    name: cookieName,
    path: "/",
    secure: true,
    url: appUrl,
    value: token,
  });
  expect(cookies.set).toHaveBeenCalledWith(
    expect.objectContaining({
      httpOnly: false,
      name: "chatjs.state",
    })
  );
});

test("a stalled session check reaches the polling deadline and allows another sign-in", async () => {
  const { abort, app, authClient, contents, invoke, startDeadline, timers } =
    await launch();
  authClient.getSession.mockImplementationOnce(async (options) => {
    if (!options) {
      throw new Error("Missing polling deadline");
    }
    await once(options.fetchOptions.signal, "abort");
    throw new Error("Deadline exceeded");
  });

  await invoke("better-auth:requestAuth");
  contents.isLoadingMainFrame.mockReturnValue(true);
  app.emit("second-instance", {}, [
    "chat.exe",
    "chatjs://auth/callback#token=first",
  ]);
  await setImmediate();
  timers.shift()?.();
  expect(authClient.authenticate).toHaveBeenCalledWith({ token: "first" });
  expect(startDeadline).toHaveBeenCalledWith(8000);
  expect(authClient.getSession).toHaveBeenCalledWith({
    fetchOptions: { signal: abort.signal },
  });
  abort.abort();
  await setImmediate();
  expect(await invoke("chatjs:get-auth-state")).toMatchObject({
    status: "timed-out",
  });

  contents.executeJavaScript.mockClear();
  contents.isLoadingMainFrame.mockReturnValue(false);
  contents.emit("did-finish-load");
  expect(contents.executeJavaScript).toHaveBeenCalledTimes(1);
  expect(contents.executeJavaScript.mock.calls[0]?.[0]).toContain("?.remove()");

  await invoke("better-auth:requestAuth");
  expect(authClient.requestAuth).toHaveBeenCalledTimes(2);
  expect(await invoke("chatjs:get-auth-state")).toMatchObject({
    status: "awaiting-browser",
  });
});

test("an ordinary second launch restores a minimized or tray-hidden window", async () => {
  const { app, win } = await launch();
  const preventDefault = mock(() => {});
  win.emit("close", { preventDefault });
  expect(preventDefault).toHaveBeenCalled();
  expect(win.hide).toHaveBeenCalled();
  app.emit("second-instance", {}, ["chat.exe"]);
  expect(win.show).toHaveBeenCalledTimes(1);
  expect(win.focus).toHaveBeenCalledTimes(1);
  expect(win.restore).not.toHaveBeenCalled();

  win.isMinimized.mockReturnValue(true);
  app.emit("second-instance", {}, ["chat.exe"]);
  expect(win.restore).toHaveBeenCalledTimes(1);
  expect(win.show).toHaveBeenCalledTimes(2);
  expect(win.focus).toHaveBeenCalledTimes(2);
});
