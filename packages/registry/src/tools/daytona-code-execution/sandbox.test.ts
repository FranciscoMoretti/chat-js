/* oxlint-disable typescript/await-thenable, typescript/no-confusing-void-expression -- Bun asynchronous rejection matchers are awaited even though their declaration exposes void. */
import { commandSandbox, createDaytonaProvider } from "./sandbox";
import { describe, expect, test } from "bun:test";
import type { CreateSandboxFromSnapshotParams } from "@daytona/sdk";
import { DaytonaNotFoundError } from "@daytona/sdk";
import type { DaytonaResource } from "./sandbox";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

const ATTEMPTS_PER_CALL = 1;
const NOT_FOUND_STATUS = 404;
const DELETE_TIMEOUT_SECONDS = 60;
const COMMAND_TIMEOUT_SECONDS = 300;
const FAILED_COMMAND_EXIT_CODE = 1;
const FIRST_DELETE_ATTEMPT = 1;
const EXPECTED_DELETE_ATTEMPTS = 2;

const credentials = { apiKey: "test-only", organizationId: "org-a" };
/* oxlint-disable oxc/no-async-await, eslint/require-await, typescript/require-await -- DaytonaResource.delete and process.executeCommand are Promise-returning SDK methods; these fixtures settle after the recorded operation. */
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
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing overrides own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  ...overrides,
});
/* oxlint-enable oxc/no-async-await, eslint/require-await, typescript/require-await */
/* oxlint-disable eslint/max-lines-per-function -- This registration callback groups the daytona durable resource boundary cases under one suite name and shared fixture. */
describe("Daytona durable resource boundary", () => {
  /* oxlint-disable oxc/no-async-await, eslint/require-await, typescript/require-await -- DaytonaClient.create and get are Promise-returning SDK methods; each fixture resolves the resource for this scenario. */
  test("creates a private ephemeral named resource with a wall-clock TTL", async () => {
    const calls: unknown[] = [];
    const adapter = createDaytonaProvider(credentials, {
      create: async (
        params: ReadonlyNativeSurface<CreateSandboxFromSnapshotParams>,
        options?: Readonly<{ timeout?: number }>
      ) => {
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
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing credentials own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      { ...credentials, apiKey: "rotated-key" },
      { create: async () => resource(), get: async () => resource() }
    );
    expect(rotated.cleanup.provider).not.toEqual(adapter.cleanup.provider);
  });
  /* oxlint-enable oxc/no-async-await, eslint/require-await, typescript/require-await */
  /* oxlint-disable oxc/no-async-await, eslint/require-await, typescript/require-await -- DaytonaResource.delete and DaytonaClient.create/get retain their Promise contracts while this scenario verifies identity rejection. */
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
  /* oxlint-enable oxc/no-async-await, eslint/require-await, typescript/require-await */
  /* oxlint-disable oxc/no-async-await, eslint/require-await, typescript/require-await -- DaytonaResource.delete and DaytonaClient.create/get retain their Promise contracts while this scenario records deletion and confirms absence. */
  test("waits for deletion and then confirms provider absence", async () => {
    const calls: unknown[] = [];
    let deleted = false;
    const sandbox = resource({
      delete: async (
        ...args: Readonly<Parameters<DaytonaResource["delete"]>>
      ) => {
        calls.push(args);
        deleted = true;
      },
    });
    const adapter = createDaytonaProvider(credentials, {
      create: async () => sandbox,
      get: async () => {
        calls.push("get");
        if (deleted) {
          throw new DaytonaNotFoundError("gone", NOT_FOUND_STATUS);
        }
        return sandbox;
      },
    });
    await adapter.cleanup.deleteAndConfirmAbsent("allocation-a");
    expect(calls).toEqual(["get", [DELETE_TIMEOUT_SECONDS, true], "get"]);
    await adapter.cleanup.deleteAndConfirmAbsent("allocation-a");
  });
  /* oxlint-enable oxc/no-async-await, eslint/require-await, typescript/require-await */
  /* oxlint-disable oxc/no-async-await, eslint/require-await, typescript/require-await -- DaytonaClient.create/get retain their Promise contracts while this scenario verifies retained resources and provider errors. */
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
  /* oxlint-enable oxc/no-async-await, eslint/require-await, typescript/require-await */
  /* oxlint-disable oxc/no-async-await, eslint/require-await, typescript/require-await -- DaytonaResource.process.executeCommand retains the SDK's Promise contract while this scenario records its failing receipt. */
  test("quotes source as one shell argument, enforces timeout and preserves output once", async () => {
    const calls: unknown[] = [];
    const sandbox = commandSandbox(
      resource({
        process: {
          executeCommand: async (
            ...args: ReadonlyNativeSurface<
              Parameters<DaytonaResource["process"]["executeCommand"]>
            >
          ) => {
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
        COMMAND_TIMEOUT_SECONDS,
      ],
    ]);
    expect(await result.stdout()).toBe("traceback");
    expect(await result.stderr()).toBe("");
    expect(result.exitCode).toBe(FAILED_COMMAND_EXIT_CODE);
  });
  /* oxlint-enable oxc/no-async-await, eslint/require-await, typescript/require-await */
  /* oxlint-disable oxc/no-async-await, eslint/require-await, typescript/require-await -- DaytonaResource.process.executeCommand retains the SDK's Promise contract while this scenario verifies an aborted command is not started. */
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
  /* oxlint-enable oxc/no-async-await, eslint/require-await, typescript/require-await */
});

/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-disable oxc/no-async-await, eslint/require-await, typescript/require-await -- DaytonaResource.delete and DaytonaClient.create/get retain their Promise contracts while this scenario verifies retry and rejection behavior. */
test("a new provider session retries cleanup after restart without allocating", async () => {
  let deleted = false;
  let attempts = 0;
  const sandbox = resource({
    delete: async () => {
      attempts += ATTEMPTS_PER_CALL;
      if (attempts === FIRST_DELETE_ATTEMPT) {
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
        throw new DaytonaNotFoundError("gone", NOT_FOUND_STATUS);
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
  expect(attempts).toBe(EXPECTED_DELETE_ATTEMPTS);
  expect(deleted).toBe(true);
});
/* oxlint-enable oxc/no-async-await, eslint/require-await, typescript/require-await */
test("empty required credentials fail before provider allocation", () => {
  /* oxlint-disable oxc/no-async-await, eslint/require-await, typescript/require-await -- DaytonaClient.create/get return the provider's Promise contract for the invalid-credential boundary fixture. */
  expect(() =>
    createDaytonaProvider(
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing credentials own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      { ...credentials, organizationId: " " },
      {
        create: async () => resource(),
        get: async () => resource(),
      }
    )
  ).toThrow("DAYTONA_API_KEY and DAYTONA_ORGANIZATION_ID");
  /* oxlint-enable oxc/no-async-await, eslint/require-await, typescript/require-await */
});
