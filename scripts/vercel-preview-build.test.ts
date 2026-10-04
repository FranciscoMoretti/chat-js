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

/* oxlint-disable eslint/max-params -- harness: Existing callers and library callbacks use this positional signature; changing it requires an API migration. */
/* oxlint-disable typescript/explicit-function-return-type -- harness: Keep contextual/generic inference for this SDK, callback or composite result; a new explicit type requires choosing its public shape. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- harness: The test intentionally exercises mutable SDK/fixture objects; deep-readonly parameters would change their assignability. */
/* oxlint-disable typescript/promise-function-async -- harness: Keep synchronous validation/throws and the original promise identity; adding async changes those observable boundaries. */
const harness = (
  failAt?: string,
  cleanupFails = false,
  code = "53000",
  lockWait = Promise.resolve()
) => {
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
      openDatabase: (url: string) => {
        expect(url).toBe(preview.DATABASE_URL_UNPOOLED);
        step("open");
        return {
          close: (): Promise<void> => {
            step("close");
            return Promise.resolve();
          },
          execute: (query: string): Promise<void> => {
            step(query);
            return query === lockQuery ? lockWait : Promise.resolve();
          },
        };
      },
      run: (
        command: "db:migrate" | "build",
        env: NodeJS.ProcessEnv
      ): Promise<void> => {
        commands.push({ command, env });
        step(command);
        return Promise.resolve();
      },
    },
  };
};
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-params */

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

/* oxlint-disable eslint/no-magic-numbers -- only runs the normal build in %s: Literal IDs, expected counts and timing bounds belong to this fixed scenario and its assertions. */
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
/* oxlint-enable eslint/no-magic-numbers */

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
    const test = harness(step, step === "db:migrate");
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
    expect(failure?.cause).toBeUndefined();
    expect(failure?.stack).not.toContain("postgres://");
    expect(test.events.includes("close")).toBe(closes);
    expect(test.events.includes("build")).toBe(step === "build");
  }
);

/* oxlint-disable eslint/no-undefined -- does not start migration until the advisory lock is acquired: The API distinguishes omitted/undefined values from null or a concrete result; preserve that sentinel. */
/* oxlint-disable eslint/no-magic-numbers -- does not start migration until the advisory lock is acquired: Literal IDs, expected counts and timing bounds belong to this fixed scenario and its assertions. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- does not start migration until the advisory lock is acquired: The test intentionally exercises mutable SDK/fixture objects; deep-readonly parameters would change their assignability. */
it("does not start migration until the advisory lock is acquired", async (): Promise<void> => {
  const { promise: pending, resolve: acquired } =
    Promise.withResolvers<undefined>();
  const test = harness(undefined, false, "53000", pending);
  const build = runMaintainerBuild(preview, test.operations);
  await delay(0);
  expect(test.events).toContain(lockQuery);
  expect(test.commands).toEqual([]);
  acquired(undefined);
  await build;
  expect(test.commands.map(({ command }): string => command)).toEqual([
    "db:migrate",
    "build",
  ]);
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/no-undefined */

it.each([
  ["ECONNREFUSED", " (ECONNREFUSED)"],
  ["55P03", " (55P03)"],
  ["SUBPROCESS_EXIT_1", " (SUBPROCESS_EXIT_1)"],
  [preview.DATABASE_URL, ""],
])(
  "only includes safe error codes: %s",
  async (code, suffix): Promise<void> => {
    const test = harness("SELECT 1", false, code);
    await expectRejection(
      runMaintainerBuild(preview, test.operations),
      `Maintainer build failed during connection${suffix}.`
    );
  }
);
