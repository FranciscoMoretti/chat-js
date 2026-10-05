/* oxlint-disable eslint/max-lines-per-function -- The suite groups independent provider boundary tests sharing one typed fixture. */
/* oxlint-disable eslint/require-await, typescript/require-await -- Asynchronous provider stubs intentionally settle immediately unless a scenario injects a lifecycle race. */
/* oxlint-disable typescript/await-thenable, typescript/no-confusing-void-expression -- Bun asynchronous rejection matchers are awaited even though their declaration exposes void. */
/* oxlint-disable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types -- Test fixture factories preserve inferred mutable state so each case can inject failures at the provider boundary. */
/* oxlint-disable eslint/no-magic-numbers -- Concrete SDK deadlines, status codes and expected counts are protocol assertions. */
import { describe, expect, test } from "bun:test";

import { DaytonaNotFoundError } from "@daytona/sdk";

import { commandSandbox, createDaytonaProvider } from "./sandbox";
import type { DaytonaResource } from "./sandbox";

const credentials = { apiKey: "test-only", organizationId: "org-a" };
const resource = (
  overrides: Partial<DaytonaResource> = {}
): DaytonaResource => ({
  delete: async () => {
    // No external resource exists in this fixture.
  },
  name: "allocation-a",
  organizationId: "org-a",
  process: { executeCommand: async () => ({ exitCode: 0, result: "ok" }) },
  state: "started",
  ...overrides,
});

describe("Daytona durable resource boundary", () => {
  test("creates a private ephemeral named resource with a wall-clock TTL", async () => {
    const calls: unknown[] = [];
    const adapter = createDaytonaProvider(credentials, {
      create: async (params, options) => {
        calls.push(params, options);
        return resource();
      },
      get: async () => resource(),
    });
    await adapter.create("allocation-a", "python");
    expect(calls).toEqual([
      {
        autoStopInterval: 10,
        ephemeral: true,
        labels: { "chatjs-allocation": "allocation-a" },
        language: "python",
        name: "allocation-a",
        public: false,
        ttlMinutes: 10,
      },
      { timeout: 60 },
    ]);
    expect(adapter.cleanup.provider.teamId).toBe("daytona:org-a");
    expect(adapter.cleanup.provider.projectId).toMatch(
      /^https:\/\/app.daytona.io\/api#[a-f0-9]{64}$/u
    );
    const rotated = createDaytonaProvider(
      { ...credentials, apiKey: "rotated-key" },
      { create: async () => resource(), get: async () => resource() }
    );
    expect(rotated.cleanup.provider).not.toEqual(adapter.cleanup.provider);
  });

  test("refuses cross-organization cleanup and identity mismatches", async () => {
    let deleted = false;
    const foreign = resource({
      delete: async () => {
        deleted = true;
      },
      organizationId: "org-b",
    });
    const adapter = createDaytonaProvider(credentials, {
      create: async () => foreign,
      get: async () => foreign,
    });
    await expect(
      adapter.cleanup.deleteAndConfirmAbsent("allocation-a")
    ).rejects.toThrow("identity");
    await expect(adapter.create("allocation-a", "javascript")).rejects.toThrow(
      "identity"
    );
    expect(deleted).toBe(false);
  });

  test("waits for deletion and then confirms provider absence", async () => {
    const calls: unknown[] = [];
    let deleted = false;
    const sandbox = resource({
      delete: async (...args) => {
        calls.push(args);
        deleted = true;
      },
    });
    const adapter = createDaytonaProvider(credentials, {
      create: async () => sandbox,
      get: async () => {
        calls.push("get");
        if (deleted) {
          throw new DaytonaNotFoundError("gone", 404);
        }
        return sandbox;
      },
    });
    await adapter.cleanup.deleteAndConfirmAbsent("allocation-a");
    expect(calls).toEqual(["get", [60, true], "get"]);
    await adapter.cleanup.deleteAndConfirmAbsent("allocation-a");
  });

  test("does not mistake network errors or incomplete deletion for absence", async () => {
    const adapter = createDaytonaProvider(credentials, {
      create: async () => resource(),
      get: async () => resource(),
    });
    await expect(
      adapter.cleanup.deleteAndConfirmAbsent("allocation-a")
    ).rejects.toThrow("remains");
    const unavailable = createDaytonaProvider(credentials, {
      create: async () => resource(),
      get: async () => {
        throw new Error("network");
      },
    });
    await expect(
      unavailable.cleanup.deleteAndConfirmAbsent("allocation-a")
    ).rejects.toThrow("network");
  });

  test("quotes source as one shell argument, enforces timeout and preserves output once", async () => {
    const calls: unknown[] = [];
    const sandbox = commandSandbox(
      resource({
        process: {
          executeCommand: async (...args) => {
            calls.push(args);
            return { exitCode: 1, result: "traceback" };
          },
        },
      }),
      new AbortController().signal
    );
    const result = await sandbox.runCommand({
      args: ["-c", "print('hello'); # $(touch /tmp/escaped)"],
      cmd: "python3",
    });
    expect(calls).toEqual([
      [
        String.raw`'python3' '-c' 'print('\''hello'\''); # $(touch /tmp/escaped)'`,
        "/tmp",
        {},
        300,
      ],
    ]);
    expect(await result.stdout()).toBe("traceback");
    expect(await result.stderr()).toBe("");
    expect(result.exitCode).toBe(1);
  });

  test("aborted calls cannot start a command", async () => {
    let executed = false;
    const controller = new AbortController();
    controller.abort();
    const sandbox = commandSandbox(
      resource({
        process: {
          executeCommand: async () => {
            executed = true;
            return { exitCode: 0, result: "" };
          },
        },
      }),
      controller.signal
    );
    await expect(
      sandbox.runCommand({ args: [], cmd: "node" })
    ).rejects.toThrow();
    expect(executed).toBe(false);
  });
});

test("a new provider session retries cleanup after restart without allocating", async () => {
  let deleted = false;
  let attempts = 0;
  const sandbox = resource({
    delete: async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("transient delete failure");
      }
      deleted = true;
    },
  });
  const client = {
    create: async (): Promise<DaytonaResource> => {
      throw new Error("must not allocate during cleanup");
    },
    get: async (): Promise<DaytonaResource> => {
      if (deleted) {
        throw new DaytonaNotFoundError("gone", 404);
      }
      return sandbox;
    },
  };
  await expect(
    createDaytonaProvider(credentials, client).cleanup.deleteAndConfirmAbsent(
      "allocation-a"
    )
  ).rejects.toThrow("transient delete failure");
  await createDaytonaProvider(
    credentials,
    client
  ).cleanup.deleteAndConfirmAbsent("allocation-a");
  expect(attempts).toBe(2);
  expect(deleted).toBe(true);
});

test("empty required credentials fail before provider allocation", () => {
  expect(() =>
    createDaytonaProvider(
      { ...credentials, organizationId: " " },
      {
        create: async () => resource(),
        get: async () => resource(),
      }
    )
  ).toThrow("DAYTONA_API_KEY and DAYTONA_ORGANIZATION_ID");
});
