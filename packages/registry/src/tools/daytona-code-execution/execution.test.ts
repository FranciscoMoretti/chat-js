/* oxlint-disable eslint/max-lines-per-function -- This suite groups independent lifecycle races around the same ownership fixture. */
/* oxlint-disable eslint/require-await, typescript/require-await -- Asynchronous provider stubs intentionally settle immediately unless a scenario injects a lifecycle race. */
/* oxlint-disable typescript/await-thenable, typescript/no-confusing-void-expression -- Bun asynchronous rejection matchers are awaited even though their declaration exposes void. */
/* oxlint-disable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types -- Test fixture factories preserve inferred mutable state so each case can inject failures at the provider boundary. */
/* oxlint-disable eslint/no-magic-numbers -- Concrete SDK deadlines, status codes and expected counts are protocol assertions. */
import { describe, expect, test } from "bun:test";

import { executeInDaytona } from "./execution";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { DaytonaResource } from "./sandbox";
/* oxlint-enable sort-imports */

const setup = () => {
  const events: string[] = [];
  const controller = new AbortController();
  const resource = {
    delete: async () => {
      // No external resource exists in this fixture.
    },
    name: "allocation",
    organizationId: "org",
    process: {
      executeCommand: async () => {
        events.push("execute");
        return {
          exitCode: 0,
          result: '42\n__EXECUTION_STATUS__:{"success":true}\n',
        };
      },
    },
    state: "started",
  } satisfies DaytonaResource;
  const selected = {
    cleanup: {
      deleteAndConfirmAbsent: async () => {
        events.push("delete");
      },
      provider: { projectId: "api", teamId: "daytona:org" },
    },
    create: async () => {
      events.push("create");
      return resource;
    },
  };
  const ownership = {
    created: async () => {
      events.push("confirm");
    },
    release: async () => {
      events.push("release");
    },
    reserve: async () => {
      events.push("reserve");
      return "allocation";
    },
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
    state.selected.create = async () => {
      throw new Error("create reply lost");
    };
    await expect(
      executeInDaytona(
        input,
        state.selected,
        state.ownership,
        state.controller.signal
      )
    ).rejects.toThrow("create reply lost");
    expect(state.events).toEqual(["reserve"]);
  });
  test("cancellation during create deletes the eventual allocation without executing", async () => {
    const state = setup();
    state.selected.create = async () => {
      state.controller.abort();
      return state.resource;
    };
    await expect(
      executeInDaytona(
        input,
        state.selected,
        state.ownership,
        state.controller.signal
      )
    ).rejects.toThrow();
    expect(state.events).toEqual(["reserve", "delete", "confirm", "release"]);
  });
  test("cancellation during a command deletes once and never returns its result", async () => {
    const state = setup();
    state.resource.process.executeCommand = async () => {
      state.controller.abort();
      return { exitCode: 0, result: "late output" };
    };
    await expect(
      executeInDaytona(
        input,
        state.selected,
        state.ownership,
        state.controller.signal
      )
    ).rejects.toThrow();
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
    state.selected.cleanup.deleteAndConfirmAbsent = async () => {
      throw new Error("delete failed");
    };
    await expect(
      executeInDaytona(
        input,
        state.selected,
        state.ownership,
        state.controller.signal
      )
    ).rejects.toThrow("delete failed");
    expect(state.events).not.toContain("release");
  });
  test("failed durable confirmation still deletes the known resource", async () => {
    const state = setup();
    state.ownership.created = async () => {
      throw new Error("database unavailable");
    };
    await expect(
      executeInDaytona(
        input,
        state.selected,
        state.ownership,
        state.controller.signal
      )
    ).rejects.toThrow("database unavailable");
    expect(state.events).toEqual(["reserve", "create", "delete", "release"]);
  });
});

const rejectedMessage = async (pending: Promise<unknown>): Promise<string> => {
  try {
    await pending;
    return "completed";
  } catch (error) {
    return error instanceof Error ? error.message : "unknown";
  }
};

/* oxlint-disable eslint/max-statements -- Keep the deferred command, deletion barrier, cancellation and release assertions in one race regression test. */
test("cancellation settles even when the command never responds, after deletion confirms", async () => {
  const state = setup();
  const command = Promise.withResolvers<{ exitCode: number; result: string }>();
  const deletion = Promise.withResolvers<boolean>();
  const deleting = Promise.withResolvers<boolean>();
  state.resource.process.executeCommand = async () => {
    state.controller.abort();
    return await command.promise;
  };
  state.selected.cleanup.deleteAndConfirmAbsent = async () => {
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

/* oxlint-enable eslint/max-statements */

test.each([false, true])(
  "Python package failure preserves combined output (extra=%s)",
  async (extra) => {
    const state = setup();
    let calls = 0;
    state.resource.process.executeCommand = async () => {
      calls += 1;
      return extra && calls === 1
        ? { exitCode: 0, result: "installed" }
        : { exitCode: 1, result: "pip: no matching distribution" };
    };
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
