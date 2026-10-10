/* oxlint-disable typescript/await-thenable, typescript/no-confusing-void-expression -- Bun asynchronous rejection matchers are awaited even though their declaration exposes void. */
import { describe, expect, test } from "bun:test";
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
  /* oxlint-disable oxc/no-async-await, eslint/require-await, typescript/require-await -- DaytonaResource.delete and process.executeCommand are Promise-returning SDK methods; these fixtures resolve after recording their respective operations. */
  const resource = {
    delete: async (): Promise<void> => {
      // No external resource exists in this fixture.
    },
    name: "allocation",
    organizationId: "org",
    process: {
      executeCommand: async (): Promise<CommandReceipt> => {
        events.push("execute");
        return {
          exitCode: 0,
          result: '42\n__EXECUTION_STATUS__:{"success":true}\n',
        };
      },
    },
    state: "started",
  } satisfies DaytonaResource;
  /* oxlint-enable oxc/no-async-await, eslint/require-await, typescript/require-await */
  /* oxlint-disable oxc/no-async-await, eslint/require-await, typescript/require-await -- The selected provider exposes Promise-returning cleanup.deleteAndConfirmAbsent and create methods; these fixtures resolve after recording their operations. */
  const selected = {
    cleanup: {
      deleteAndConfirmAbsent: async (): Promise<void> => {
        events.push("delete");
      },
      provider: { projectId: "api", teamId: "daytona:org" },
    },
    create: async (): Promise<FixtureResource> => {
      events.push("create");
      return resource;
    },
  };
  /* oxlint-enable oxc/no-async-await, eslint/require-await, typescript/require-await */
  /* oxlint-disable oxc/no-async-await, eslint/require-await, typescript/require-await -- SandboxOwnership.reserve, created and release are Promise-returning transaction methods; these fixtures resolve after recording each operation. */
  const ownership = {
    created: async (): Promise<void> => {
      events.push("confirm");
    },
    release: async (): Promise<void> => {
      events.push("release");
    },
    reserve: async (): Promise<string> => {
      events.push("reserve");
      return "allocation";
    },
  };
  /* oxlint-enable oxc/no-async-await, eslint/require-await, typescript/require-await */
  return { controller, events, ownership, resource, selected };
};
const input = {
  code: "return 42",
  language: "javascript",
  title: "Answer",
} as const;

/* oxlint-disable eslint/max-lines-per-function -- This registration callback groups the daytona allocation lifecycle cases under one suite name and shared fixture. */
describe("Daytona allocation lifecycle", () => {
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. selected.create rejects with create reply lost, exercising ambiguous provider completion. */
  test("an ambiguous create remains reserved and cannot execute or release", async () => {
    const state = setup();
    // oxlint-disable-next-line eslint/require-await, typescript/require-await -- selected.create returns the provider's Promise; this fixture models a rejected create response.
    state.selected.create = async (): Promise<FixtureResource> => {
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. selected.create aborts the signal then resolves the late allocation. */
  test("cancellation during create deletes the eventual allocation without executing", async () => {
    const state = setup();
    // oxlint-disable-next-line eslint/require-await, typescript/require-await -- selected.create returns the provider's Promise while this fixture aborts and resolves a late allocation.
    state.selected.create = async (): Promise<FixtureResource> => {
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. resource.process.executeCommand aborts the signal then resolves late command output. */
  test("cancellation during a command deletes once and never returns its result", async () => {
    const state = setup();
    state.resource.process.executeCommand =
      // oxlint-disable-next-line eslint/require-await, typescript/require-await -- executeCommand returns the Daytona SDK's Promise while this fixture aborts and resolves late output.
      async (): Promise<CommandReceipt> => {
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. selected.cleanup.deleteAndConfirmAbsent rejects with delete failed. */
  test("failed deletion retains ownership for cleanup after restart", async () => {
    const state = setup();
    // oxlint-disable-next-line eslint/require-await, typescript/require-await -- deleteAndConfirmAbsent returns its declared Promise and this fixture tests rejection propagation.
    state.selected.cleanup.deleteAndConfirmAbsent = async (): Promise<void> => {
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. ownership.created rejects with database unavailable. */
  test("failed durable confirmation still deletes the known resource", async () => {
    const state = setup();
    // oxlint-disable-next-line eslint/require-await, typescript/require-await -- ownership.created returns its declared Promise and this fixture tests rejection propagation.
    state.ownership.created = async (): Promise<void> => {
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
  /* oxlint-enable oxc/no-async-await */
});

/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve rejectedMessage's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/max-statements -- Keep the deferred command, deletion barrier, cancellation and release assertions in one race regression test. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test.each([false, true])'s awaited sequencing and rejected-Promise behavior. resource.process.executeCommand resolves successive pip installation receipts selected by call count. */
/* oxlint-enable eslint/max-statements */

test.each([false, true])(
  "Python package failure preserves combined output (extra=%s)",
  async (extra) => {
    const state = setup();
    let calls = 0;
    state.resource.process.executeCommand =
      // oxlint-disable-next-line eslint/require-await, typescript/require-await -- executeCommand returns the Daytona SDK's Promise; this fixture resolves receipts based on invocation order.
      async (): Promise<CommandReceipt> => {
        calls += ATTEMPTS_PER_CALL;
        if (extra && calls === FIRST_PACKAGE_INSTALLATION) {
          return { exitCode: 0, result: "installed" };
        }
        return { exitCode: 1, result: "pip: no matching distribution" };
      };
    const result = await executeInDaytona(
      {
        // oxlint-disable-next-line no-ternary -- Keep code as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
/* oxlint-enable oxc/no-async-await */
