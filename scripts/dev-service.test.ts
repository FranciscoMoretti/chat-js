import { rejects } from "node:assert/strict";
import { expect, test } from "bun:test";

import { runDevService } from "./dev-service";

const NODE_VERSION_OUTPUT = "/opt/node/bin/node\n24.1.0\n";
const NODE_VERSION_COMMAND = [
  "-p",
  String.raw`process.execPath + '\n' + process.versions.node`,
];
const EVENT_STOP_BOOTOUT = 0;
const EVENT_STOP_PRINT = 1;
const EVENT_REMOVE = 2;

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

const runCommand = async (
  key: string,
  options: FixtureOptions
): Promise<string> => {
  if (key === `node ${NODE_VERSION_COMMAND.join(" ")}`) {
    return await Promise.resolve(options.nodeVersion ?? NODE_VERSION_OUTPUT);
  }
  if (
    (key.startsWith("launchctl bootout ") && options.loaded === false) ||
    (key.startsWith("launchctl print ") && options.loaded !== true)
  ) {
    throw new Error("not loaded");
  }
  if (key.startsWith("launchctl print ")) {
    return await Promise.resolve("service status");
  }
  if (
    key.startsWith("launchctl bootstrap ") &&
    options.failAt === "bootstrap"
  ) {
    throw new Error("bootstrap failed");
  }
  return await Promise.resolve("");
};

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
    run: async (file: string, args: readonly string[]): Promise<string> => {
      const key = `${file} ${args.join(" ")}`;
      events.push(`run:${key}`);
      return await runCommand(key, options);
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

test("start awaits setup, stops the existing service, then bootstraps", async (): Promise<void> => {
  const { events, operations } = fixture();
  await runDevService("start", operations, "darwin");
  const eventTrace: readonly unknown[] = events;
  expect(eventTrace).toEqual([
    expect.stringMatching(/^run:node /u),
    expect.stringMatching(/^mkdir:/u),
    expect.stringMatching(/^mkdir:/u),
    expect.stringMatching(/^write:.*:384$/u),
    expect.stringMatching(/^run:launchctl bootout /u),
    expect.stringMatching(/^run:launchctl print /u),
    expect.stringMatching(/^run:launchctl bootstrap /u),
    expect.stringMatching(/^log:Started /u),
  ]);
});
test("start leaves the current service alone when setup fails", async (): Promise<void> => {
  const { events, operations } = fixture({ failAt: "write" });

  await rejects(
    runDevService("start", operations, "darwin"),
    (reason: unknown) => {
      expect(() => {
        throw reason;
      }).toThrow("write failed");
      return true;
    }
  );
  expect(events.some((event) => event.startsWith("run:launchctl"))).toBe(false);
});
test("stop awaits launchd shutdown before removing the plist", async (): Promise<void> => {
  const { events, operations } = fixture({ loaded: false });
  await runDevService("stop", operations, "darwin");
  expect(events[EVENT_STOP_BOOTOUT]).toStartWith("run:launchctl bootout ");
  expect(events[EVENT_STOP_PRINT]).toStartWith("run:launchctl print ");
  expect(events[EVENT_REMOVE]).toStartWith("remove:");
});
test("rejects unsupported platforms before invoking service operations", async (): Promise<void> => {
  const { events, operations } = fixture();

  await rejects(
    runDevService("status", operations, "linux"),
    (reason: unknown) => {
      expect(() => {
        throw reason;
      }).toThrow("This local service uses macOS launchd.");
      return true;
    }
  );
  expect(events).toEqual([]);
});
