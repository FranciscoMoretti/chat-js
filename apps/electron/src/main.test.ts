import { beforeAll, expect, mock, test } from "bun:test";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import path from "node:path";
import { setImmediate } from "node:timers/promises";
import { Script } from "node:vm";

const nodeRequire = createRequire(import.meta.url);
const executable = String.raw`C:\Apps\My App\app-1.2.3\My App.exe`;
let entryPoint: Script;

beforeAll(async () => {
  const result = await Bun.build({
    entrypoints: [path.join(import.meta.dir, "main.ts")],
    external: ["electron"],
    format: "cjs",
    plugins: [
      {
        name: "observe-application-startup",
        setup(build) {
          build.onLoad({ filter: /[/\\]application\.ts$/u }, () => ({
            contents: "globalThis.startApplication();",
            loader: "js",
          }));
        },
      },
    ],
    target: "node",
  });
  expect(result.success).toBe(true);
  entryPoint = new Script(await result.outputs[0].text());
});

const launch = async (platform: NodeJS.Platform, args: readonly string[]) => {
  // ChildProcess exposes EventEmitter's API, which the startup handler uses.
  // oxlint-disable-next-line unicorn/prefer-event-target
  const updater = new EventEmitter();
  const quit = mock(() => {});
  const startApplication = mock(() => {});
  const spawn = mock(() => updater);

  entryPoint.runInNewContext({
    Buffer,
    console,
    module: { exports: {} },
    process: {
      argv: [executable, ...args],
      env: {},
      execPath: executable,
      platform,
      versions: process.versions,
    },
    require(id: string): unknown {
      switch (id) {
        case "electron": {
          return { app: { quit } };
        }
        case "child_process": {
          return { spawn };
        }
        case "path": {
          return path.win32;
        }
        default: {
          return nodeRequire(id);
        }
      }
    },
    startApplication,
  });
  // Let the bundled application's dynamic import finish.
  await setImmediate();
  return { quit, spawn, startApplication, updater };
};

test.each(["--squirrel-install", "--squirrel-updated", "--squirrel-uninstall"])(
  "%s completes shortcut work before quitting, without starting the app",
  async (event) => {
    const { quit, spawn, startApplication, updater } = await launch("win32", [
      event,
      "1.2.3",
    ]);
    const operation =
      event === "--squirrel-uninstall" ? "removeShortcut" : "createShortcut";
    expect(spawn).toHaveBeenCalledWith(
      String.raw`C:\Apps\My App\Update.exe`,
      [`--${operation}=My App.exe`],
      { detached: true }
    );
    expect(quit).not.toHaveBeenCalled();
    expect(startApplication).not.toHaveBeenCalled();
    updater.emit("close", 0);
    expect(quit).toHaveBeenCalledTimes(1);
    expect(startApplication).not.toHaveBeenCalled();
  }
);

test("obsolete installs quit without shortcut work or normal startup", async () => {
  const { quit, spawn, startApplication } = await launch("win32", [
    "--squirrel-obsolete",
    "1.2.3",
  ]);
  expect(quit).toHaveBeenCalledTimes(1);
  expect(spawn).not.toHaveBeenCalled();
  expect(startApplication).not.toHaveBeenCalled();
});

test.each([
  { name: "ordinary launch", args: [] },
  { name: "first launch after install", args: ["--squirrel-firstrun"] },
  { name: "auth callback", args: ["chatjs://auth/callback"] },
])("$name starts the Windows app", async ({ args }) => {
  const { quit, spawn, startApplication } = await launch("win32", args);
  expect(startApplication).toHaveBeenCalledTimes(1);
  expect(quit).not.toHaveBeenCalled();
  expect(spawn).not.toHaveBeenCalled();
});

test.each(["darwin", "linux"] as const)(
  "%s ignores Windows installer arguments",
  async (platform) => {
    const { quit, spawn, startApplication } = await launch(platform, [
      "--squirrel-install",
    ]);
    expect(startApplication).toHaveBeenCalledTimes(1);
    expect(quit).not.toHaveBeenCalled();
    expect(spawn).not.toHaveBeenCalled();
  }
);
