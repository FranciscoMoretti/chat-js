import { expect, it } from "bun:test";
import { setTimeout as delay } from "node:timers/promises";

import { runMaintainerBuild } from "./vercel-preview-build";

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

const harness = (
  failAt?: string,
  cleanupFails = false,
  code = "53000",
  lockWait = Promise.resolve()
) => {
  const events: string[] = [];
  const commands: { command: string; env: NodeJS.ProcessEnv }[] = [];
  const step = (name: string) => {
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
      openDatabase: (url: string) => {
        expect(url).toBe(preview.DATABASE_URL_UNPOOLED);
        step("open");
        return {
          close: () => {
            step("close");
            return Promise.resolve();
          },
          execute: (query: string) => {
            step(query);
            return query === lockQuery ? lockWait : Promise.resolve();
          },
        };
      },
      run: (command: "db:migrate" | "build", env: NodeJS.ProcessEnv) => {
        commands.push({ command, env });
        step(command);
        return Promise.resolve();
      },
    },
  };
};

it("locks before migration, releases before build, and passes direct credentials to both commands", async () => {
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
  async (environment) => {
    const source = { ...preview, VERCEL_ENV: environment };
    const test = harness();
    await runMaintainerBuild(source, test.operations);
    expect(test.events).toEqual(["build"]);
    expect(test.commands[0].env).toEqual(source);
  }
);

it("rejects invalid configuration before opening a connection or invoking a command", async () => {
  const test = harness();
  await expect(
    runMaintainerBuild(
      { ...preview, CHATJS_PREVIEW_PARENT_HOST: "EP-CHILD.EU.NEON.TECH" },
      test.operations
    )
  ).rejects.toThrow("during validation");
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
  async (step, phase, closes) => {
    // Also fail cleanup to prove it cannot hide an earlier failure.
    const test = harness(step, step === "db:migrate");
    const failure = await runMaintainerBuild(preview, test.operations).catch(
      (error: Error) => error
    );
    expect(failure).toBeInstanceOf(Error);
    expect(failure?.message).toBe(
      `Maintainer build failed during ${phase} (53000).`
    );
    expect(failure?.cause).toBeUndefined();
    expect(failure?.stack).not.toContain("postgres://");
    expect(test.events.includes("close")).toBe(closes);
    expect(test.events.includes("build")).toBe(step === "build");
  }
);

it("does not start migration until the advisory lock is acquired", async () => {
  const { promise: pending, resolve: acquired } =
    Promise.withResolvers<undefined>();
  const test = harness(undefined, false, "53000", pending);
  const build = runMaintainerBuild(preview, test.operations);
  await delay(0);
  expect(test.events).toContain(lockQuery);
  expect(test.commands).toEqual([]);
  acquired(undefined);
  await build;
  expect(test.commands.map(({ command }) => command)).toEqual([
    "db:migrate",
    "build",
  ]);
});

it.each([
  ["ECONNREFUSED", " (ECONNREFUSED)"],
  ["55P03", " (55P03)"],
  ["SUBPROCESS_EXIT_1", " (SUBPROCESS_EXIT_1)"],
  [preview.DATABASE_URL, ""],
])("only includes safe error codes: %s", async (code, suffix) => {
  const test = harness("SELECT 1", false, code);
  await expect(runMaintainerBuild(preview, test.operations)).rejects.toThrow(
    `Maintainer build failed during connection${suffix}.`
  );
});
