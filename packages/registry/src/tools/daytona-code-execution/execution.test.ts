import { rejects } from "node:assert/strict";

import { describe, expect, mock, test } from "bun:test";
import type { DaytonaResource } from "./sandbox";
import { executeInDaytona } from "./execution";

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
  events: readonly string[];
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
  const controller = new AbortController();
  const execute = mock<() => Promise<CommandReceipt>>().mockResolvedValue({
    exitCode: 0,
    result: '42\n__EXECUTION_STATUS__:{"success":true}\n',
  });
  const deleteResource = mock<() => Promise<void>>().mockResolvedValue();
  const created = mock<() => Promise<void>>().mockResolvedValue();
  const release = mock<() => Promise<void>>().mockResolvedValue();
  const reserve = mock<() => Promise<string>>().mockResolvedValue("allocation");

  const resource = {
    delete: mock<() => Promise<void>>().mockReturnValue(Promise.resolve()),
    name: "allocation",
    organizationId: "org",
    process: {
      executeCommand: execute,
    },
    state: "started",
  } satisfies DaytonaResource;
  const create =
    mock<() => Promise<FixtureResource>>().mockResolvedValue(resource);

  const selected = {
    cleanup: {
      deleteAndConfirmAbsent: deleteResource,
      provider: { projectId: "api", teamId: "daytona:org" },
    },
    create,
  };

  const ownership = {
    created,
    release,
    reserve,
  };

  const recorded = [
    { event: "reserve", operation: reserve },
    { event: "create", operation: create },
    { event: "confirm", operation: created },
    { event: "execute", operation: execute },
    { event: "delete", operation: deleteResource },
    { event: "release", operation: release },
  ];
  return {
    controller,
    get events() {
      return recorded
        .flatMap(({ event, operation }) =>
          operation.mock.invocationCallOrder.map((order) => ({ event, order }))
        )
        .toSorted((left, right) => left.order - right.order)
        .map(({ event }) => event);
    },
    ownership,
    resource,
    selected,
  };
};
const input = {
  code: "return 42",
  language: "javascript",
  title: "Answer",
} as const;

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

    const creating = Promise.withResolvers<boolean>();
    const allocation = Promise.withResolvers<FixtureResource>();
    state.selected.create = async (): Promise<FixtureResource> => {
      creating.resolve(true);
      return await allocation.promise;
    };
    const pending = executeInDaytona(
      input,
      state.selected,
      state.ownership,
      state.controller.signal
    );
    const rejected = rejectedMessage(pending);
    await creating.promise;
    state.controller.abort(new Error("create cancelled"));
    expect(state.events).toEqual(["reserve"]);
    allocation.resolve(state.resource);
    expect(await rejected).toBe("create cancelled");
    expect(state.events).toEqual(["reserve", "delete", "confirm", "release"]);
  });
  test("cancellation during a command deletes once and never returns its result", async () => {
    const state = setup();
    const executing = Promise.withResolvers<boolean>();
    const command = Promise.withResolvers<CommandReceipt>();
    state.resource.process.executeCommand =
      async (): Promise<CommandReceipt> => {
        executing.resolve(true);
        return await command.promise;
      };
    const pending = executeInDaytona(
      input,
      state.selected,
      state.ownership,
      state.controller.signal
    );
    const rejected = rejectedMessage(pending);
    await executing.promise;
    state.controller.abort();
    command.resolve({ exitCode: 0, result: "late output" });
    expect(await rejected).toContain("cancelled");
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
    const execute = mock<() => Promise<CommandReceipt>>();
    if (extra) {
      execute.mockResolvedValueOnce({ exitCode: 0, result: "installed" });
    }
    execute.mockResolvedValue({
      exitCode: 1,
      result: "pip: no matching distribution",
    });
    state.resource.process.executeCommand = execute;
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
