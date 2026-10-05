/* oxlint-disable eslint/max-lines-per-function -- The suite groups independent provider boundary tests sharing one typed fixture. */
/* oxlint-disable eslint/require-await, typescript/require-await -- Asynchronous provider stubs intentionally settle immediately unless a scenario injects a lifecycle race. */
/* oxlint-disable typescript/await-thenable, typescript/no-confusing-void-expression -- Bun asynchronous rejection matchers are awaited even though their declaration exposes void. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Fixture callbacks retain mutable SDK state so each case can inject lifecycle races or provider failures. */
/* oxlint-disable eslint/no-magic-numbers -- Concrete SDK deadlines, status codes and expected counts are protocol assertions. */
import { describe, expect, test } from "bun:test";

import { DaytonaNotFoundError } from "@daytona/sdk";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { commandSandbox, createDaytonaProvider } from "./sandbox";
/* oxlint-enable sort-imports */
import type { DaytonaResource } from "./sandbox";

const credentials = { apiKey: "test-only", organizationId: "org-a" };
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve resource's required Promise and rejection contract. DaytonaResource.delete resolves void without external resource deletion. DaytonaResource.process.executeCommand resolves an SDK command receipt. */
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
/* oxlint-enable oxc/no-async-await */
describe("Daytona durable resource boundary", () => {
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. DaytonaClient.create records parameters then resolves a resource. DaytonaClient.get resolves a resource. DaytonaClient create/get callbacks resolve a resource for credential rotation. */
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
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing credentials own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      { ...credentials, apiKey: "rotated-key" },
      { create: async () => resource(), get: async () => resource() }
    );
    expect(rotated.cleanup.provider).not.toEqual(adapter.cleanup.provider);
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. DaytonaResource.delete resolves after setting the foreign-resource deleted flag. DaytonaClient.create resolves the foreign organization resource. DaytonaClient.get resolves the foreign organization resource. */
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. DaytonaResource.delete records arguments then resolves after setting deleted. DaytonaClient.create resolves the resource being deleted. DaytonaClient.get resolves the resource before deletion and rejects with DaytonaNotFoundError afterwards. */
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. DaytonaClient.create resolves the retained resource. DaytonaClient.get resolves a retained resource to prove cleanup refusal. DaytonaClient.create resolves a resource before network failure. DaytonaClient.get rejects with network failure. */
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. DaytonaResource.process.executeCommand records arguments then resolves the failing command receipt. */
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. DaytonaResource.process.executeCommand resolves after setting executed. */
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
  /* oxlint-enable oxc/no-async-await */
});

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. DaytonaResource.delete rejects on first attempt and resolves after later deletion. DaytonaClient.create rejects to prove cleanup never allocates. DaytonaClient.get resolves before deletion and rejects with DaytonaNotFoundError after deletion. */
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
/* oxlint-enable oxc/no-async-await */
test("empty required credentials fail before provider allocation", () => {
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve expect(() =>     createDaytonaProvider(       { ...credentials, organizationId: " " },       {      's required Promise and rejection contract. DaytonaClient.create resolves a resource for request cancellation. DaytonaClient.get resolves a resource for request cancellation. */
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
  /* oxlint-enable oxc/no-async-await */
});
