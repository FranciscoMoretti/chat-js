import { rejects } from "node:assert/strict";

import { commandSandbox, createDaytonaProvider } from "./sandbox";
import { describe, expect, mock, test } from "bun:test";
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

const resource = (
  overrides: Partial<DaytonaResource> = {}
): DaytonaResource => ({
  delete: mock<() => Promise<void>>().mockReturnValue(Promise.resolve()),
  name: "allocation-a",
  organizationId: "org-a",
  process: {
    executeCommand: mock<
      DaytonaResource["process"]["executeCommand"]
    >().mockResolvedValue({ exitCode: 0, result: "ok" }),
  },
  state: "started",
  ...overrides,
});

// oxlint-disable-next-line eslint/require-await -- Provider create/get require a Promise and must construct a fresh resource for each invocation rather than share a precomputed fixture.
const freshResource = async (): Promise<DaytonaResource> => resource();

describe("Daytona durable resource boundary", () => {
  test("creates a private ephemeral named resource with a wall-clock TTL", async () => {
    const calls: unknown[] = [];
    const adapter = createDaytonaProvider(credentials, {
      create:
        /* oxlint-disable eslint/require-await -- This Promise-returning provider fixture records invocation-time calls or changes cancellation/deletion state before settling; a precomputed settled mock would skip or move those effects. */
        async (
          params: ReadonlyNativeSurface<CreateSandboxFromSnapshotParams>,
          options?: Readonly<{ timeout?: number }>
        ) => {
          calls.push(params, options);
          return resource();
        },
      /* oxlint-enable eslint/require-await */
      get: freshResource,
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
      { create: freshResource, get: freshResource }
    );
    expect(rotated.cleanup.provider).not.toEqual(adapter.cleanup.provider);
  });

  test("refuses cross-organization cleanup and identity mismatches", async () => {
    let deleted = false;
    const foreign = resource({
      delete:
        /* oxlint-disable eslint/require-await -- This Promise-returning provider fixture records invocation-time calls or changes cancellation/deletion state before settling; a precomputed settled mock would skip or move those effects. */
        async () => {
          deleted = true;
        },
      /* oxlint-enable eslint/require-await */
      organizationId: "org-b",
    });
    const adapter = createDaytonaProvider(credentials, {
      create: mock<() => Promise<typeof foreign>>().mockResolvedValue(foreign),
      get: mock<() => Promise<typeof foreign>>().mockResolvedValue(foreign),
    });
    await rejects(
      adapter.cleanup.deleteAndConfirmAbsent("allocation-a"),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow("identity");
        return true;
      }
    );
    await rejects(
      adapter.create("allocation-a", "javascript"),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow("identity");
        return true;
      }
    );
    expect(deleted).toBe(false);
  });

  test("waits for deletion and then confirms provider absence", async () => {
    const calls: unknown[] = [];
    let deleted = false;
    const sandbox = resource({
      delete:
        /* oxlint-disable eslint/require-await -- This Promise-returning provider fixture records invocation-time calls or changes cancellation/deletion state before settling; a precomputed settled mock would skip or move those effects. */
        async (...args: Readonly<Parameters<DaytonaResource["delete"]>>) => {
          calls.push(args);
          deleted = true;
        },
      /* oxlint-enable eslint/require-await */
    });
    const adapter = createDaytonaProvider(credentials, {
      create: mock<() => Promise<typeof sandbox>>().mockResolvedValue(sandbox),
      get:
        /* oxlint-disable eslint/require-await -- The provider get callback must inspect current deletion state and asynchronously reject after the recorded delete, not precompute an earlier result. */
        async () => {
          calls.push("get");
          if (deleted) {
            throw new DaytonaNotFoundError("gone", NOT_FOUND_STATUS);
          }
          return sandbox;
        },
      /* oxlint-enable eslint/require-await */
    });
    await adapter.cleanup.deleteAndConfirmAbsent("allocation-a");
    expect(calls).toEqual(["get", [DELETE_TIMEOUT_SECONDS, true], "get"]);
    await adapter.cleanup.deleteAndConfirmAbsent("allocation-a");
  });

  test("does not mistake network errors or incomplete deletion for absence", async () => {
    const adapter = createDaytonaProvider(credentials, {
      create: freshResource,
      get: freshResource,
    });
    await rejects(
      adapter.cleanup.deleteAndConfirmAbsent("allocation-a"),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow("remains");
        return true;
      }
    );
    const unavailable = createDaytonaProvider(credentials, {
      create: freshResource,
      get: mock<() => Promise<never>>().mockRejectedValue(new Error("network")),
    });
    await rejects(
      unavailable.cleanup.deleteAndConfirmAbsent("allocation-a"),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow("network");
        return true;
      }
    );
  });

  test("quotes source as one shell argument, enforces timeout and preserves output once", async () => {
    const calls: unknown[] = [];
    const sandbox = commandSandbox(
      resource({
        process: {
          executeCommand:
            /* oxlint-disable eslint/require-await -- This Promise-returning provider fixture records invocation-time calls or changes cancellation/deletion state before settling; a precomputed settled mock would skip or move those effects. */
            async (
              ...args: ReadonlyNativeSurface<
                Parameters<DaytonaResource["process"]["executeCommand"]>
              >
            ) => {
              calls.push(args);
              return { exitCode: 1, result: "traceback" };
            },
          /* oxlint-enable eslint/require-await */
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

  test("aborted calls cannot start a command", async () => {
    let executed = false;
    const controller = new AbortController();
    controller.abort();
    const sandbox = commandSandbox(
      resource({
        process: {
          executeCommand:
            /* oxlint-disable eslint/require-await -- This Promise-returning provider fixture records invocation-time calls or changes cancellation/deletion state before settling; a precomputed settled mock would skip or move those effects. */
            async () => {
              executed = true;
              return { exitCode: 0, result: "" };
            },
          /* oxlint-enable eslint/require-await */
        },
      }),
      controller.signal
    );
    await rejects(
      sandbox.runCommand({ args: [], cmd: "node" }),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow();
        return true;
      }
    );
    expect(executed).toBe(false);
  });
});

test("a new provider session retries cleanup after restart without allocating", async () => {
  let deleted = false;
  let attempts = 0;
  const sandbox = resource({
    delete:
      /* oxlint-disable eslint/require-await -- This Promise-returning provider fixture records invocation-time calls or changes cancellation/deletion state before settling; a precomputed settled mock would skip or move those effects. */
      async () => {
        attempts += ATTEMPTS_PER_CALL;
        if (attempts === FIRST_DELETE_ATTEMPT) {
          throw new Error("transient delete failure");
        }
        deleted = true;
      },
    /* oxlint-enable eslint/require-await */
  });
  const client = {
    create: mock<() => Promise<DaytonaResource>>().mockRejectedValue(
      new Error("must not allocate during cleanup")
    ),
    get:
      /* oxlint-disable eslint/require-await -- The provider get callback must inspect current deletion state and asynchronously reject after the recorded delete, not precompute an earlier result. */
      async (): Promise<DaytonaResource> => {
        if (deleted) {
          throw new DaytonaNotFoundError("gone", NOT_FOUND_STATUS);
        }
        return sandbox;
      },
    /* oxlint-enable eslint/require-await */
  };
  await rejects(
    createDaytonaProvider(credentials, client).cleanup.deleteAndConfirmAbsent(
      "allocation-a"
    ),
    (reason: unknown) => {
      expect(() => {
        throw reason;
      }).toThrow("transient delete failure");
      return true;
    }
  );
  await createDaytonaProvider(
    credentials,
    client
  ).cleanup.deleteAndConfirmAbsent("allocation-a");
  expect(attempts).toBe(EXPECTED_DELETE_ATTEMPTS);
  expect(deleted).toBe(true);
});

test("empty required credentials fail before provider allocation", () => {
  expect(() =>
    createDaytonaProvider(
      { ...credentials, organizationId: " " },
      {
        create: freshResource,
        get: freshResource,
      }
    )
  ).toThrow("DAYTONA_API_KEY and DAYTONA_ORGANIZATION_ID");
});
