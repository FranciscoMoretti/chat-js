import { APIError, Sandbox } from "@vercel/sandbox";
import type { Mock, MockInstance } from "vitest";
import { assert, describe, expect, it, vi } from "vitest";
import { setupSandboxTestEnvironment } from "./sandbox-test-environment";

const { envMock, configureSandboxCredentials } = setupSandboxTestEnvironment();

const LOOKUP_AND_CONFIRM_CALLS = 2;

const createCleanupFixture = (): {
  stop: Mock<Sandbox["stop"]>;
  log: { info: Mock; warn: Mock };
  remove: Mock<Sandbox["delete"]>;
} => {
  const stop = vi.fn<Sandbox["stop"]>();
  const log = { info: vi.fn(), warn: vi.fn() };
  const remove = vi.fn<Sandbox["delete"]>().mockResolvedValue();
  return { log, remove, stop };
};

const createStoppedSession = (): Awaited<ReturnType<Sandbox["stop"]>> => ({
  createdAt: 0,
  cwd: "/tmp",
  id: "session",
  memory: 128,
  region: "test",
  requestedAt: 0,
  status: "stopped",
  timeout: 30_000,
  updatedAt: 0,
  vcpus: 1,
});

const createSandboxFixture = (
  identity: Readonly<{ name: string; persistent: boolean }>
): {
  sandbox: Sandbox;
  stop: Mock<Sandbox["stop"]>;
  remove: Mock<Sandbox["delete"]>;
  get: MockInstance<typeof Sandbox.get>;
} => {
  configureSandboxCredentials();
  const stop = vi
    .fn<Sandbox["stop"]>()
    .mockResolvedValue(createStoppedSession());
  const remove = vi.fn<Sandbox["delete"]>().mockResolvedValue();
  const sandbox = new Sandbox({
    routes: [],
    sandbox: {
      createdAt: 0,
      currentSessionId: "session",
      name: identity.name,
      persistent: identity.persistent,
      status: "running",
      updatedAt: 0,
    },
  });
  vi.spyOn(sandbox, "delete").mockImplementation(remove);
  vi.spyOn(sandbox, "stop").mockImplementation(stop);
  const get = vi.spyOn(Sandbox, "get");
  return {
    get,
    remove,
    sandbox,
    stop,
  };
};

const runtimeScenarios: readonly Readonly<{
  language: "python" | "javascript";
  name: string;
  overrides: Readonly<Partial<typeof envMock>>;
  runtime: string;
}>[] = [
  {
    language: "python",
    name: "uses Python defaults when no override is set",
    overrides: {},
    runtime: "python3.13",
  },
  {
    language: "javascript",
    name: "uses JavaScript defaults when no override is set",
    overrides: {},
    runtime: "node22",
  },
  {
    language: "python",
    name: "honors VERCEL_SANDBOX_RUNTIME_PYTHON override for python",
    overrides: {
      VERCEL_SANDBOX_RUNTIME_PYTHON: "python3.12",
    },
    runtime: "python3.12",
  },
  {
    language: "javascript",
    name: "honors VERCEL_SANDBOX_RUNTIME_JAVASCRIPT override for javascript",
    overrides: {
      VERCEL_SANDBOX_RUNTIME_JAVASCRIPT: "node20",
    },
    runtime: "node20",
  },
  {
    language: "python",
    name: "falls back to legacy VERCEL_SANDBOX_RUNTIME for python",
    overrides: {
      VERCEL_SANDBOX_RUNTIME: "python3.11",
    },
    runtime: "python3.11",
  },
  {
    language: "python",
    name: "prefers VERCEL_SANDBOX_RUNTIME_PYTHON over legacy VERCEL_SANDBOX_RUNTIME",
    overrides: {
      VERCEL_SANDBOX_RUNTIME: "python3.11",
      VERCEL_SANDBOX_RUNTIME_PYTHON: "python3.12",
    },
    runtime: "python3.12",
  },
  {
    language: "javascript",
    name: "does not use legacy VERCEL_SANDBOX_RUNTIME for javascript",
    overrides: {
      VERCEL_SANDBOX_RUNTIME: "python3.11",
    },
    runtime: "node22",
  },
];

describe("getSandboxRuntime", () => {
  /* oxlint-disable oxc/no-async-await -- Await module loading after each row's environment overrides before asserting synchronous runtime selection. */
  it.each(runtimeScenarios)(
    "$name",
    async ({ language, overrides, runtime }) => {
      Object.assign(envMock, overrides);
      const { getSandboxRuntime } = await import("./execution-sandbox");
      expect(getSandboxRuntime(language)).toBe(runtime);
    }
  );
  /* oxlint-enable oxc/no-async-await */
});

/* oxlint-disable oxc/no-async-await -- Preserve the cleanup gate's explicit observation and rejection sequencing. */

/* oxlint-disable max-statements -- Stop-gate failure assertions cover pending state, exact SDK options, rejection, warning, and deletion; keep these oracles in the test. */
it("sandbox cleanup waits for terminal stop and propagates a failed confirmation", async () => {
  const { cleanupSandbox } = await import("./execution-sandbox");
  const gate = Promise.withResolvers<never>();
  const { stop, log, remove } = createCleanupFixture();
  stop.mockReturnValue(gate.promise);
  const pending = cleanupSandbox({ delete: remove, stop }, log, "fixture");
  let settled = false;
  // oxlint-disable-next-line promise/prefer-await-to-then -- Observe cleanup settlement while keeping the stop confirmation pending for assertions.
  const observed = pending.finally(() => {
    settled = true;
  });
  const rejection = expect(observed).rejects.toThrow("stop unavailable");
  await Promise.resolve();
  expect(settled).toBe(false);
  expect(stop).toHaveBeenCalledOnce();
  const [[stopOptions]] = stop.mock.calls;
  assert(stopOptions);
  expect(stopOptions.signal).toBeInstanceOf(AbortSignal);
  expect(stopOptions).toEqual({ signal: stopOptions.signal });
  gate.reject(new Error("stop unavailable"));
  await rejection;
  expect(log.info).not.toHaveBeenCalled();
  expect(log.warn).toHaveBeenCalledOnce();
  expect(remove).toHaveBeenCalledOnce();
  const [[deleteOptions]] = remove.mock.calls;
  assert(deleteOptions);
  expect(deleteOptions).toEqual({
    deleteOrphanSnapshots: true,
    signal: deleteOptions.signal,
  });
  expect(deleteOptions.signal).toBeInstanceOf(AbortSignal);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements */

it("creates disposable sandboxes rather than enabling the SDK persistence default", async () => {
  const { createSandbox } = await import("./execution-sandbox");
  const create = vi
    .spyOn(Sandbox, "create")
    .mockRejectedValueOnce(new Error("fixture"));
  try {
    await expect(createSandbox("node22")).rejects.toThrow("fixture");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ persistent: false, runtime: "node22" })
    );
  } finally {
    create.mockRestore();
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("does not report successful cleanup until deletion has completed", async () => {
  const { cleanupSandbox } = await import("./execution-sandbox");
  const gate = Promise.withResolvers<undefined>();
  const { stop, log, remove } = createCleanupFixture();
  remove.mockReturnValue(gate.promise);
  const pending = cleanupSandbox({ delete: remove, stop }, log, "fixture");
  const rejected = expect(pending).rejects.toThrow("delete unavailable");
  await vi.waitFor(() => expect(remove).toHaveBeenCalledOnce());
  expect(log.info).not.toHaveBeenCalled();
  gate.reject(new Error("delete unavailable"));
  await rejected;
});
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-statements -- Keep provider identity, absence confirmation and stop/delete call assertions in this end-to-end cleanup case. */
it("codeSandboxCleanupCapability deletes an exact disposable sandbox and confirms provider absence", async () => {
  const { sandbox, stop, remove, get } = createSandboxFixture({
    name: "owned",
    persistent: false,
  });
  /* oxlint-disable unicorn/no-null -- An empty provider 404 response confirms sandbox absence. */
  get
    .mockResolvedValueOnce(sandbox)
    .mockRejectedValueOnce(new APIError(new Response(null, { status: 404 })));
  /* oxlint-enable unicorn/no-null */
  try {
    const { codeSandboxCleanupCapability } =
      await import("./execution-sandbox");
    const cleanup = codeSandboxCleanupCapability.createCleanupSession();
    expect(cleanup.provider).toMatchObject({
      projectId: "project",
      teamId: "team",
    });
    await cleanup.deleteAndConfirmAbsent("owned");
    expect(get).toHaveBeenCalledTimes(LOOKUP_AND_CONFIRM_CALLS);
    expect(get).toHaveBeenCalledWith(
      expect.objectContaining({ name: "owned", resume: false })
    );
    expect(stop).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
  } finally {
    get.mockRestore();
  }
});
/* oxlint-enable max-statements */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it.each([     { name: "foreign", persistent: false },     { name: "owned", persistent: true },   ])'s awaited sequencing and rejected-Promise behavior. */
it.each([
  { name: "foreign", persistent: false },
  { name: "owned", persistent: true },
])(
  "codeSandboxCleanupCapability refuses unsafe sandbox identity %#",
  async (identity: Readonly<{ name: string; persistent: boolean }>) => {
    const { sandbox, stop, remove, get } = createSandboxFixture(identity);
    get.mockResolvedValue(sandbox);
    try {
      const { codeSandboxCleanupCapability } =
        await import("./execution-sandbox");
      const cleanup = codeSandboxCleanupCapability.createCleanupSession();
      await expect(cleanup.deleteAndConfirmAbsent("owned")).rejects.toThrow(
        "identity or persistence"
      );
      expect(stop).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
    } finally {
      get.mockRestore();
    }
  }
);
/* oxlint-enable oxc/no-async-await */
