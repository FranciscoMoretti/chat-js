import { expect, it } from "bun:test";
import { setTimeout as delay } from "node:timers/promises";

import { formatBuildFailure, runMaintainerBuild } from "./vercel-preview-build";

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

const harness = (failAt?: string, cleanupFails = false) => {
  const events: string[] = [];
  const commands: { command: string; env: NodeJS.ProcessEnv }[] = [];
  const step = (name: string) => {
    events.push(name);
    if (name === failAt || (name === "close" && cleanupFails)) {
      throw Object.assign(new Error("postgres://user:secret@host/db"), {
        code: "53000",
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
            return Promise.resolve();
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
const lockQuery =
  "SELECT pg_advisory_lock(hashtextextended('chatjs-preview-migrations', 0))";

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
  ["SELECT 1", "connection"],
  [lockQuery, "lock acquisition"],
  ["db:migrate", "migration"],
])(
  "closes the lock and never builds after failure at %s",
  async (step, phase) => {
    const test = harness(step);
    await expect(runMaintainerBuild(preview, test.operations)).rejects.toThrow(
      `during ${phase} (53000)`
    );
    expect(test.events.at(-1)).toBe("close");
    expect(test.events).not.toContain("build");
  }
);

it("preserves migration failure when closing the connection also fails", async () => {
  const test = harness("db:migrate", true);
  await expect(runMaintainerBuild(preview, test.operations)).rejects.toThrow(
    "during migration"
  );
});

it.each([
  ["close", "lock cleanup"],
  ["build", "build"],
  ["open", "connection"],
])("identifies failure at %s", async (step, phase) => {
  const test = harness(step);
  await expect(runMaintainerBuild(preview, test.operations)).rejects.toThrow(
    `during ${phase} (53000)`
  );
});

it("does not start migration until the advisory lock is acquired", async () => {
  const test = harness();
  const { promise: pending, resolve: acquired } =
    Promise.withResolvers<undefined>();
  const baseOpen = test.operations.openDatabase;
  test.operations.openDatabase = (url) => {
    const connection = baseOpen(url);
    const { execute } = connection;
    connection.execute = async (query) => {
      await execute(query);
      if (query === lockQuery) {
        await pending;
      }
    };
    return connection;
  };
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

it("logs a safe code without messages, URLs, details or arbitrary code text", () => {
  expect(
    formatBuildFailure("connection", {
      code: "ECONNREFUSED",
      detail: preview.DATABASE_URL,
      message: preview.DATABASE_URL,
    })
  ).toBe("Maintainer build failed during connection (ECONNREFUSED).");
  expect(
    formatBuildFailure("connection", {
      code: preview.DATABASE_URL,
      message: preview.DATABASE_URL,
    })
  ).toBe("Maintainer build failed during connection.");
  expect(formatBuildFailure("lock acquisition", { code: "55P03" })).toContain(
    "55P03"
  );
  expect(formatBuildFailure("build", { code: "SUBPROCESS_EXIT_1" })).toContain(
    "SUBPROCESS_EXIT_1"
  );
  expect(
    formatBuildFailure(
      "validation",
      new Error("Preview database postgres://user:secret@host")
    )
  ).toBe("Maintainer build failed during validation.");
});

it("discarded provider errors cannot leak through a cause or stack", async () => {
  const test = harness("SELECT 1");
  try {
    await runMaintainerBuild(preview, test.operations);
    throw new Error("Expected connection failure");
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    if (error instanceof Error) {
      expect(error.cause).toBeUndefined();
      expect(error.stack).not.toContain("postgres://");
      expect(error.message).toBe(
        "Maintainer build failed during connection (53000)."
      );
    }
  }
});
