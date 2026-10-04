/* oxlint-disable eslint/max-lines-per-function -- This suite groups independent lifecycle races around the same ownership fixture. */
/* oxlint-disable eslint/require-await, typescript/require-await -- Asynchronous provider stubs intentionally settle immediately unless a scenario injects a lifecycle race. */
/* oxlint-disable typescript/await-thenable, typescript/no-confusing-void-expression -- Bun asynchronous rejection matchers are awaited even though their declaration exposes void. */
/* oxlint-disable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types -- Test fixture factories preserve inferred mutable state so each case can inject failures at the provider boundary. */
/* oxlint-disable eslint/no-magic-numbers -- Concrete SDK deadlines, status codes and expected counts are protocol assertions. */
import { describe, expect, test } from "bun:test";

import { executeInDaytona } from "./execution";
import type { DaytonaResource } from "./sandbox";

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
