import { rejects } from "node:assert/strict";

import { describe, expect, mock, test } from "bun:test";
import type { DaytonaResource } from "./sandbox";
import { executeInDaytona } from "./execution";

const ATTEMPTS_PER_CALL = 1;
const FIRST_PACKAGE_INSTALLATION = 1;

type CommandReceipt = Readonly<{ exitCode: number; result: string }>;
interface FixtureResource {
  delete: () => Promise<void>;
  readonly name: string;
  readonly organizationId: string;
  readonly process: { executeCommand: () => Promise<CommandReceipt> };
  readonly state: "started";
}
type Fixture = Readonly<{
  controller: AbortController;
  events: string[];
  ownership: {
    created: () => Promise<void>;
    release: () => Promise<void>;
    reserve: () => Promise<string>;
  };
  resource: FixtureResource;
  selected: {
    cleanup: {
      deleteAndConfirmAbsent: () => Promise<void>;
      readonly provider: Readonly<{ projectId: string; teamId: string }>;
    };
    create: () => Promise<FixtureResource>;
  };
}>;

const setup = (): Fixture => {
  const events: string[] = [];
  const controller = new AbortController();

  const resource = {
    delete: mock<() => Promise<void>>().mockReturnValue(Promise.resolve()),
    name: "allocation",
    organizationId: "org",
    process: {
      executeCommand:
        /* oxlint-disable eslint/require-await -- This Promise-returning provider fixture records invocation-time calls or changes cancellation/deletion state before settling; a precomputed settled mock would skip or move those effects. */
        async (): Promise<CommandReceipt> => {
          events.push("execute");
          return {
            exitCode: 0,
            result: '42\n__EXECUTION_STATUS__:{"success":true}\n',
          };
        },
      /* oxlint-enable eslint/require-await */
    },
    state: "started",
  } satisfies DaytonaResource;

  const selected = {
    cleanup: {
      deleteAndConfirmAbsent:
        /* oxlint-disable eslint/require-await -- This Promise-returning provider fixture records invocation-time calls or changes cancellation/deletion state before settling; a precomputed settled mock would skip or move those effects. */
        async (): Promise<void> => {
          events.push("delete");
        },
      /* oxlint-enable eslint/require-await */
      provider: { projectId: "api", teamId: "daytona:org" },
    },
    create:
      /* oxlint-disable eslint/require-await -- This Promise-returning provider fixture records invocation-time calls or changes cancellation/deletion state before settling; a precomputed settled mock would skip or move those effects. */
      async (): Promise<FixtureResource> => {
        events.push("create");
        return resource;
      },
    /* oxlint-enable eslint/require-await */
  };

  const ownership = {
    created:
      /* oxlint-disable eslint/require-await -- This Promise-returning provider fixture records invocation-time calls or changes cancellation/deletion state before settling; a precomputed settled mock would skip or move those effects. */
      async (): Promise<void> => {
        events.push("confirm");
      },
    /* oxlint-enable eslint/require-await */
    release:
      /* oxlint-disable eslint/require-await -- This Promise-returning provider fixture records invocation-time calls or changes cancellation/deletion state before settling; a precomputed settled mock would skip or move those effects. */
      async (): Promise<void> => {
        events.push("release");
      },
    /* oxlint-enable eslint/require-await */
    reserve:
      /* oxlint-disable eslint/require-await -- This Promise-returning provider fixture records invocation-time calls or changes cancellation/deletion state before settling; a precomputed settled mock would skip or move those effects. */
      async (): Promise<string> => {
        events.push("reserve");
        return "allocation";
      },
    /* oxlint-enable eslint/require-await */
  };

  return { controller, events, ownership, resource, selected };
};
const input = {
  code: "return 42",
  language: "javascript",
  title: "Answer",
} as const;

describe("Daytona allocation lifecycle", () => {
  test("executes exact source only after ownership confirmation and cleans before release", async () => {
    const state = setup();
    const result = await executeInDaytona(
      input,
      state.selected,
      state.ownership,
      state.controller.signal
    );
    expect(result.message).toContain("42");
    expect(state.events).toEqual([
      "reserve",
      "create",
      "confirm",
      "execute",
      "delete",
      "release",
    ]);
  });
  test("an ambiguous create remains reserved and cannot execute or release", async () => {
    const state = setup();

    state.selected.create = mock<
      () => Promise<FixtureResource>
    >().mockRejectedValue(new Error("create reply lost"));
    await rejects(
      executeInDaytona(
        input,
        state.selected,
        state.ownership,
        state.controller.signal
      ),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow("create reply lost");
        return true;
      }
    );
    expect(state.events).toEqual(["reserve"]);
  });
  test("cancellation during create deletes the eventual allocation without executing", async () => {
    const state = setup();

    state.selected.create =
      /* oxlint-disable eslint/require-await -- This Promise-returning provider fixture records invocation-time calls or changes cancellation/deletion state before settling; a precomputed settled mock would skip or move those effects. */
      async (): Promise<FixtureResource> => {
        state.controller.abort();
        return state.resource;
      };
    /* oxlint-enable eslint/require-await */
    await rejects(
      executeInDaytona(
        input,
        state.selected,
        state.ownership,
        state.controller.signal
      ),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow();
        return true;
      }
    );
    expect(state.events).toEqual(["reserve", "delete", "confirm", "release"]);
  });
  test("cancellation during a command deletes once and never returns its result", async () => {
    const state = setup();
    state.resource.process.executeCommand =
      /* oxlint-disable eslint/require-await -- This Promise-returning provider fixture records invocation-time calls or changes cancellation/deletion state before settling; a precomputed settled mock would skip or move those effects. */
      async (): Promise<CommandReceipt> => {
        state.controller.abort();
        return { exitCode: 0, result: "late output" };
      };
    /* oxlint-enable eslint/require-await */
    await rejects(
      executeInDaytona(
        input,
        state.selected,
        state.ownership,
        state.controller.signal
      ),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow();
        return true;
      }
    );
    expect(state.events).toEqual([
      "reserve",
      "create",
      "confirm",
      "delete",
      "release",
    ]);
  });
  test("failed deletion retains ownership for cleanup after restart", async () => {
    const state = setup();

    state.selected.cleanup.deleteAndConfirmAbsent = mock<
      () => Promise<void>
    >().mockRejectedValue(new Error("delete failed"));
    await rejects(
      executeInDaytona(
        input,
        state.selected,
        state.ownership,
        state.controller.signal
      ),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow("delete failed");
        return true;
      }
    );
    expect(state.events).not.toContain("release");
  });
  test("failed durable confirmation still deletes the known resource", async () => {
    const state = setup();

    state.ownership.created = mock<() => Promise<void>>().mockRejectedValue(
      new Error("database unavailable")
    );
    await rejects(
      executeInDaytona(
        input,
        state.selected,
        state.ownership,
        state.controller.signal
      ),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow("database unavailable");
        return true;
      }
    );
    expect(state.events).toEqual(["reserve", "create", "delete", "release"]);
  });
});

const rejectedMessage = async (
  pending: Readonly<Promise<unknown>>
): Promise<string> => {
  try {
    await pending;
    return "completed";
  } catch (error) {
    if (error instanceof Error) {
      return error.message;
    }
    return "unknown";
  }
};
test("cancellation settles even when the command never responds, after deletion confirms", async () => {
  const state = setup();
  const command = Promise.withResolvers<{ exitCode: number; result: string }>();
  const deletion = Promise.withResolvers<boolean>();
  const deleting = Promise.withResolvers<boolean>();
  state.resource.process.executeCommand = async (): Promise<CommandReceipt> => {
    state.controller.abort();
    return await command.promise;
  };
  state.selected.cleanup.deleteAndConfirmAbsent = async (): Promise<void> => {
    state.events.push("delete");
    deleting.resolve(true);
    await deletion.promise;
  };
  const pending = executeInDaytona(
    input,
    state.selected,
    state.ownership,
    state.controller.signal
  );
  const rejected = rejectedMessage(pending);
  await deleting.promise;
  expect(state.events).not.toContain("release");
  deletion.resolve(true);
  expect(await rejected).toContain("cancelled");
  expect(state.events).toContain("release");
});

test.each([false, true])(
  "Python package failure preserves combined output (extra=%s)",
  async (extra) => {
    const state = setup();
    let calls = 0;
    state.resource.process.executeCommand =
      /* oxlint-disable eslint/require-await -- This Promise-returning provider fixture records invocation-time calls or changes cancellation/deletion state before settling; a precomputed settled mock would skip or move those effects. */
      async (): Promise<CommandReceipt> => {
        calls += ATTEMPTS_PER_CALL;
        if (extra && calls === FIRST_PACKAGE_INSTALLATION) {
          return { exitCode: 0, result: "installed" };
        }
        return { exitCode: 1, result: "pip: no matching distribution" };
      };
    /* oxlint-enable eslint/require-await */
    const result = await executeInDaytona(
      {
        code: extra ? "!pip install missing-package\nprint(42)" : "print(42)",
        language: "python",
        title: "test",
      },
      state.selected,
      state.ownership,
      state.controller.signal
    );
    expect(result.message).toContain("pip: no matching distribution");
    expect(state.events).toContain("release");
  }
);
