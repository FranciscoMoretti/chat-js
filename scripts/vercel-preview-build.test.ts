import { expect, it } from "bun:test";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { runMaintainerBuild } from "./vercel-preview-build";

it("loads build orchestration before workspace dependencies are installed", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "preview-build-import-"));
  try {
    await Promise.all(
      ["vercel-preview-build.ts", "vercel-preview-environment.ts"].map(
        async (file) => {
          await copyFile(
            new URL(file, import.meta.url),
            path.join(directory, file)
          );
        }
      )
    );
    const child = Bun.spawn(
      [
        process.execPath,
        "--no-install",
        "--eval",
        'const { runMaintainerBuild } = await import("./vercel-preview-build.ts"); if (typeof runMaintainerBuild !== "function") throw new Error("Missing build operation");',
      ],
      { cwd: directory, stderr: "pipe", stdout: "pipe" }
    );
    const error = await new Response(child.stderr).text();
    expect(error).toBe("");
    expect(await child.exited).toBe(0);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

const preview = {
  CHATJS_PREVIEW_NEON_PROJECT_ID: "test",
  CHATJS_PREVIEW_PARENT_HOST: "ep-parent.eu.neon.tech",
  DATABASE_MIGRATION_URL: "postgres://wrong/db",
  DATABASE_URL: "postgres://user:password@ep-child-pooler.eu.neon.tech/db",
  DATABASE_URL_UNPOOLED: "postgres://user:password@ep-child.eu.neon.tech/db",
  NEON_PROJECT_ID: "test",
  VERCEL: "1",
  VERCEL_ENV: "preview",
};

const lockQuery =
  "SELECT pg_advisory_lock(hashtextextended('chatjs-preview-migrations', 0))";

const expectRejection = async (
  operation: Readonly<Promise<unknown>>,
  messageFragment: string
): Promise<void> => {
  try {
    await operation;
  } catch (error) {
    if (error instanceof Error && error.message.includes(messageFragment)) {
      return;
    }
    throw new Error(`Unexpected rejection: ${String(error)}`, { cause: error });
  }
  throw new Error("Expected the operation to reject.");
};
interface BuildHarness {
  commands: { command: string; env: NodeJS.ProcessEnv }[];
  events: string[];
  operations: {
    openDatabase: (url: string) => {
      close: () => Promise<void>;
      execute: (query: string) => Promise<void>;
    };
    run: (
      command: "db:migrate" | "build",
      env: Readonly<NodeJS.ProcessEnv>
    ) => Promise<void>;
  };
}
type BuildConnection = ReturnType<BuildHarness["operations"]["openDatabase"]>;
interface HarnessOptions {
  readonly failAt?: string;
  readonly cleanupFails?: boolean;
  readonly code?: string;
  readonly lockWait?: Readonly<Promise<void>>;
}
const harness = ({
  failAt,
  cleanupFails = false,
  code = "53000",
  lockWait = Promise.resolve(),
}: HarnessOptions = {}): BuildHarness => {
  const events: string[] = [];
  const commands: { command: string; env: NodeJS.ProcessEnv }[] = [];
  const step = (name: string): void => {
    events.push(name);
    if (name === failAt || (name === "close" && cleanupFails)) {
      throw Object.assign(new Error("postgres://user:secret@host/db"), {
        code,
      });
    }
  };
  return {
    commands,
    events,
    operations: {
      openDatabase: (url: string): BuildConnection => {
        expect(url).toBe(preview.DATABASE_URL_UNPOOLED);
        step("open");
        return {
          // oxlint-disable-next-line typescript/promise-function-async -- The Promise-only driver fixture records cleanup and injects failures that must not mask migration errors; its immediate close has no work to await under eslint/require-await.
          close: (): Promise<void> => {
            step("close");
            return Promise.resolve();
          },
          execute: async (query: string): Promise<void> => {
            step(query);

            if (query === lockQuery) {
              await lockWait;
            }
          },
        };
      },
      // oxlint-disable-next-line typescript/promise-function-async -- The Promise-only subprocess fixture records command/env and injects phase failures without launching a process; eslint/require-await rejects an immediate async callback.
      run: (
        command: "db:migrate" | "build",
        env: Readonly<NodeJS.ProcessEnv>
      ): Promise<void> => {
        commands.push({ command, env });
        step(command);
        return Promise.resolve();
      },
    },
  };
};

it("locks before migration, releases before build, and passes direct credentials to both commands", async (): Promise<void> => {
  const test = harness();
  await runMaintainerBuild(preview, test.operations);
  expect(test.events).toEqual([
    "open",
    "SELECT 1",
    "SET lock_timeout = 0",
    lockQuery,
    "db:migrate",
    "close",
    "build",
  ]);
  for (const { env } of test.commands) {
    expect(env.DATABASE_URL).toBe(preview.DATABASE_URL);
    expect(env.DATABASE_MIGRATION_URL).toBe(preview.DATABASE_URL_UNPOOLED);
  }
  expect(preview.DATABASE_MIGRATION_URL).toBe("postgres://wrong/db");
});
it.each(["production", "development"])(
  "only runs the normal build in %s",
  async (environment): Promise<void> => {
    const source = { ...preview, VERCEL_ENV: environment };
    const test = harness();
    await runMaintainerBuild(source, test.operations);
    expect(test.events).toEqual(["build"]);
    expect(test.commands[0].env).toEqual(source);
  }
);

it("rejects invalid configuration before opening a connection or invoking a command", async (): Promise<void> => {
  const test = harness();
  await expectRejection(
    runMaintainerBuild(
      { ...preview, CHATJS_PREVIEW_PARENT_HOST: "EP-CHILD.EU.NEON.TECH" },
      test.operations
    ),
    "during validation"
  );
  expect(test.events).toEqual([]);
});
it.each([
  ["open", "connection", false],
  ["SELECT 1", "connection", true],
  ["SET lock_timeout = 0", "lock acquisition", true],
  [lockQuery, "lock acquisition", true],
  ["db:migrate", "migration", true],
  ["close", "lock cleanup", true],
  ["build", "build", true],
])(
  "reports failure at %s without leaking credentials",
  async (step, phase, closes): Promise<void> => {
    // Also fail cleanup to prove it cannot hide an earlier failure.
    const test = harness({ cleanupFails: step === "db:migrate", failAt: step });
    const failure = await runMaintainerBuild(preview, test.operations).catch(
      (error: unknown) => error
    );
    expect(failure).toBeInstanceOf(Error);
    if (!(failure instanceof Error)) {
      throw new Error("Expected a build failure");
    }
    expect(failure.message).toBe(
      `Maintainer build failed during ${phase} (53000).`
    );
    expect(failure.cause).toBeUndefined();
    expect(failure.stack).not.toContain("postgres://");
    expect(test.events.includes("close")).toBe(closes);
    expect(test.events.includes("build")).toBe(step === "build");
  }
);
it("does not start migration until the advisory lock is acquired", async (): Promise<void> => {
  const { promise: pending, resolve: acquired }: PromiseWithResolvers<void> =
    Promise.withResolvers();
  const test = harness({ lockWait: pending });
  const build = runMaintainerBuild(preview, test.operations);
  await delay(0);
  expect(test.events).toContain(lockQuery);
  expect(test.commands).toEqual([]);
  acquired();
  await build;
  expect(
    test.commands.map(
      ({
        command,
      }: Readonly<Pick<(typeof test.commands)[number], "command">>): string =>
        command
    )
  ).toEqual(["db:migrate", "build"]);
});

it.each([
  ["ECONNREFUSED", " (ECONNREFUSED)"],
  ["55P03", " (55P03)"],
  ["SUBPROCESS_EXIT_1", " (SUBPROCESS_EXIT_1)"],
  [preview.DATABASE_URL, ""],
])(
  "only includes safe error codes: %s",
  async (code, suffix): Promise<void> => {
    const test = harness({ code, failAt: "SELECT 1" });
    await expectRejection(
      runMaintainerBuild(preview, test.operations),
      `Maintainer build failed during connection${suffix}.`
    );
  }
);
