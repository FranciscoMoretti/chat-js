import { expect, test } from "bun:test";

import { runDevService } from "./dev-service";

const NODE_VERSION_OUTPUT = "/opt/node/bin/node\n24.1.0\n";
const NODE_VERSION_COMMAND = [
  "-p",
  String.raw`process.execPath + '\n' + process.versions.node`,
];
const EVENT_NODE_VERSION = 0;
const EVENT_SETUP_DIRECTORY = 1;
const EVENT_LOG_DIRECTORY = 2;
const EVENT_PLIST_WRITE = 3;
const EVENT_BOOTOUT = 4;
const EVENT_PRINT = 5;
const EVENT_BOOTSTRAP = 6;
const EVENT_START_LOG = 7;
const EVENT_STOP_BOOTOUT = 0;
const EVENT_STOP_PRINT = 1;
const EVENT_REMOVE = 2;
const EVENT_KIND_SEGMENT = 0;

interface FixtureOptions {
  readonly failAt?: string;
  readonly nodeVersion?: string;
  readonly loaded?: boolean;
}

interface Fixture {
  readonly events: string[];
  readonly operations: {
    readonly log: (message: string) => void;
    readonly mkdir: (path: string) => Promise<void>;
    readonly removeFile: (path: string) => Promise<void>;
    readonly run: (file: string, args: readonly string[]) => Promise<string>;
    readonly wait: () => Promise<void>;
    readonly writeFile: (
      path: string,
      data: string,
      mode: number
    ) => Promise<void>;
  };
}

// oxlint-disable-next-line eslint/max-lines-per-function -- Keep the fake operation adapter together so its side-effect log mirrors the service interface.
const fixture = (options: FixtureOptions = {}): Fixture => {
  const events: string[] = [];
  const operations = {
    log: (message: string): void => {
      events.push(`log:${message}`);
    },
    mkdir: async (path: string): Promise<void> => {
      events.push(`mkdir:${path}`);
      if (options.failAt === "mkdir") {
        throw new Error("mkdir failed");
      }
      await Promise.resolve();
    },
    removeFile: async (path: string): Promise<void> => {
      events.push(`remove:${path}`);
      await Promise.resolve();
    },
    // oxlint-disable-next-line eslint/max-statements -- This subprocess mock maps each distinct command to its observable test behavior.
    run: async (file: string, args: readonly string[]): Promise<string> => {
      const key = `${file} ${args.join(" ")}`;
      events.push(`run:${key}`);
      if (key === `node ${NODE_VERSION_COMMAND.join(" ")}`) {
        return await Promise.resolve(
          options.nodeVersion ?? NODE_VERSION_OUTPUT
        );
      }
      if (key.startsWith("launchctl bootout ") && options.loaded === false) {
        throw new Error("not loaded");
      }
      if (key.startsWith("launchctl print ")) {
        if (options.loaded === true) {
          return await Promise.resolve("service status");
        }
        throw new Error("not loaded");
      }
      if (
        key.startsWith("launchctl bootstrap ") &&
        options.failAt === "bootstrap"
      ) {
        throw new Error("bootstrap failed");
      }
      return await Promise.resolve("");
    },
    wait: async (): Promise<void> => {
      events.push("wait");
      await Promise.resolve();
    },
    writeFile: async (
      path: string,
      _data: string,
      mode: number
    ): Promise<void> => {
      events.push(`write:${path}:${mode}`);
      if (options.failAt === "write") {
        throw new Error("write failed");
      }
      await Promise.resolve();
    },
  };
  return { events, operations };
};

// oxlint-disable-next-line eslint/max-statements -- The assertions cover the complete required service side-effect sequence.
test("start awaits setup, stops the existing service, then bootstraps", async (): Promise<void> => {
  const { events, operations } = fixture();
  await runDevService("start", operations, "darwin");
  expect(events.map((event) => event.split(":")[EVENT_KIND_SEGMENT])).toEqual([
    "run",
    "mkdir",
    "mkdir",
    "write",
    "run",
    "run",
    "run",
    "log",
  ]);
  expect(events[EVENT_BOOTOUT]?.startsWith("run:launchctl bootout ")).toBe(
    true
  );
  expect(events[EVENT_PRINT]?.startsWith("run:launchctl print ")).toBe(true);
  expect(events[EVENT_BOOTSTRAP]?.startsWith("run:launchctl bootstrap ")).toBe(
    true
  );
  expect(events[EVENT_PLIST_WRITE]?.endsWith(":384")).toBe(true);
  expect(events[EVENT_NODE_VERSION]?.startsWith("run:node ")).toBe(true);
  expect(events[EVENT_SETUP_DIRECTORY]?.startsWith("mkdir:")).toBe(true);
  expect(events[EVENT_LOG_DIRECTORY]?.startsWith("mkdir:")).toBe(true);
  expect(events[EVENT_START_LOG]?.startsWith("log:Started ")).toBe(true);
});

test("start leaves the current service alone when setup fails", async (): Promise<void> => {
  const { events, operations } = fixture({ failAt: "write" });
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Bun's promise matcher declarations expose a void return.
  await expect(runDevService("start", operations, "darwin")).rejects.toThrow(
    "write failed"
  );
  expect(events.some((event) => event.startsWith("run:launchctl"))).toBe(false);
});

test("stop awaits launchd shutdown before removing the plist", async (): Promise<void> => {
  const { events, operations } = fixture({ loaded: false });
  await runDevService("stop", operations, "darwin");
  expect(events[EVENT_STOP_BOOTOUT]?.startsWith("run:launchctl bootout ")).toBe(
    true
  );
  expect(events[EVENT_STOP_PRINT]?.startsWith("run:launchctl print ")).toBe(
    true
  );
  expect(events[EVENT_REMOVE]?.startsWith("remove:")).toBe(true);
});

test("rejects unsupported platforms before invoking service operations", async (): Promise<void> => {
  const { events, operations } = fixture();
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Bun's promise matcher declarations expose a void return.
  await expect(runDevService("status", operations, "linux")).rejects.toThrow(
    "This local service uses macOS launchd."
  );
  expect(events).toEqual([]);
});
