import { rejects } from "node:assert/strict";

import { commandSandbox, createDaytonaProvider } from "./sandbox";
import { describe, expect, mock, test } from "bun:test";
import { DaytonaNotFoundError } from "@daytona/sdk";
import type { DaytonaResource } from "./sandbox";

const NOT_FOUND_STATUS = 404;
const DELETE_TIMEOUT_SECONDS = 60;
const COMMAND_TIMEOUT_SECONDS = 300;
const FAILED_COMMAND_EXIT_CODE = 1;
const EXPECTED_DELETE_ATTEMPTS = 2;
type DaytonaClient = NonNullable<Parameters<typeof createDaytonaProvider>[1]>;

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

const resourceClient = (): DaytonaClient => {
  const sandbox = resource();
  return {
    create: mock<DaytonaClient["create"]>().mockResolvedValue(sandbox),
    get: mock<DaytonaClient["get"]>().mockResolvedValue(sandbox),
  };
};

describe("Daytona durable resource boundary", () => {
  test("creates a private ephemeral named resource with a wall-clock TTL", async () => {
    const create =
      mock<DaytonaClient["create"]>().mockResolvedValue(resource());
    const adapter = createDaytonaProvider(credentials, {
      ...resourceClient(),
      create,
    });
    await adapter.create("allocation-a", "python");
    expect(create.mock.calls).toEqual([
      [
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
      ],
    ]);
    expect(adapter.cleanup.provider.teamId).toBe("daytona:org-a");
    expect(adapter.cleanup.provider.projectId).toMatch(
      /^https:\/\/app.daytona.io\/api#[a-f0-9]{64}$/u
    );
    const rotated = createDaytonaProvider(
      { ...credentials, apiKey: "rotated-key" },
      resourceClient()
    );
    expect(rotated.cleanup.provider).not.toEqual(adapter.cleanup.provider);
  });

  test("refuses cross-organization cleanup and identity mismatches", async () => {
    const deleteResource =
      mock<DaytonaResource["delete"]>().mockResolvedValue();
    const foreign = resource({
      delete: deleteResource,
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
    expect(deleteResource).not.toHaveBeenCalled();
  });

  test("waits for deletion and then confirms provider absence", async () => {
    const deleting = Promise.withResolvers<boolean>();
    const deletion = Promise.withResolvers<boolean>();
    const deleteResource = mock<DaytonaResource["delete"]>(async () => {
      deleting.resolve(true);
      await deletion.promise;
    });
    const sandbox = resource({ delete: deleteResource });
    const get = mock<DaytonaClient["get"]>().mockResolvedValue(sandbox);
    const adapter = createDaytonaProvider(credentials, {
      create: mock<() => Promise<typeof sandbox>>().mockResolvedValue(sandbox),
      get,
    });
    const pending = adapter.cleanup.deleteAndConfirmAbsent("allocation-a");
    await deleting.promise;
    // Absence is published only once deletion can finish; no early confirmation.
    expect(get).toHaveBeenCalledTimes(1);
    get.mockRejectedValue(new DaytonaNotFoundError("gone", NOT_FOUND_STATUS));
    deletion.resolve(true);
    await pending;
    expect(get.mock.calls).toEqual([["allocation-a"], ["allocation-a"]]);
    expect(deleteResource.mock.calls).toEqual([[DELETE_TIMEOUT_SECONDS, true]]);
    expect(get.mock.invocationCallOrder.at(0)).toBeLessThan(
      deleteResource.mock.invocationCallOrder.at(0) ?? Infinity
    );
    expect(deleteResource.mock.invocationCallOrder.at(0)).toBeLessThan(
      get.mock.invocationCallOrder.at(1) ?? -Infinity
    );
    await adapter.cleanup.deleteAndConfirmAbsent("allocation-a");
  });

  test("does not mistake network errors or incomplete deletion for absence", async () => {
    const adapter = createDaytonaProvider(credentials, resourceClient());
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
      ...resourceClient(),
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
    const execute = mock<
      DaytonaResource["process"]["executeCommand"]
    >().mockResolvedValue({ exitCode: 1, result: "traceback" });
    const sandbox = commandSandbox(
      resource({
        process: {
          executeCommand: execute,
        },
      }),
      new AbortController().signal
    );
    const result = await sandbox.runCommand({
      args: ["-c", "print('hello'); # $(touch /tmp/escaped)"],
      cmd: "python3",
    });
    expect(execute.mock.calls).toEqual([
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
    const execute = mock<
      DaytonaResource["process"]["executeCommand"]
    >().mockResolvedValue({ exitCode: 0, result: "" });
    const controller = new AbortController();
    controller.abort();
    const sandbox = commandSandbox(
      resource({
        process: {
          executeCommand: execute,
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
    expect(execute).not.toHaveBeenCalled();
  });
});

test("a new provider session retries cleanup after restart without allocating", async () => {
  const deleting = Promise.withResolvers<boolean>();
  const deletion = Promise.withResolvers<boolean>();
  const deleteResource = mock<DaytonaResource["delete"]>()
    .mockRejectedValueOnce(new Error("transient delete failure"))
    .mockImplementation(async () => {
      deleting.resolve(true);
      await deletion.promise;
    });
  const sandbox = resource({ delete: deleteResource });
  const get = mock<DaytonaClient["get"]>().mockResolvedValue(sandbox);
  const client = {
    create: mock<() => Promise<DaytonaResource>>().mockRejectedValue(
      new Error("must not allocate during cleanup")
    ),
    get,
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
  expect(get).toHaveBeenCalledTimes(1);
  const pending = createDaytonaProvider(
    credentials,
    client
  ).cleanup.deleteAndConfirmAbsent("allocation-a");
  await deleting.promise;
  expect(get).toHaveBeenCalledTimes(EXPECTED_DELETE_ATTEMPTS);
  get.mockRejectedValue(new DaytonaNotFoundError("gone", NOT_FOUND_STATUS));
  deletion.resolve(true);
  await pending;
  expect(get.mock.calls).toEqual([
    ["allocation-a"],
    ["allocation-a"],
    ["allocation-a"],
  ]);
  expect(deleteResource).toHaveBeenCalledTimes(EXPECTED_DELETE_ATTEMPTS);
  expect(client.create).not.toHaveBeenCalled();
});

test("empty required credentials fail before provider allocation", () => {
  expect(() =>
    createDaytonaProvider(
      { ...credentials, organizationId: " " },
      resourceClient()
    )
  ).toThrow("DAYTONA_API_KEY and DAYTONA_ORGANIZATION_ID");
});
