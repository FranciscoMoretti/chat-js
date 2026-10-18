import { APIError, Sandbox } from "@vercel/sandbox";
import type { Mock, MockInstance } from "vitest";
import { assert, describe, expect, it, vi } from "vitest";
import { setupSandboxTestEnvironment } from "./sandbox-test-environment";

const { configureSandboxCredentials } = setupSandboxTestEnvironment();

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

const imageScenarios: readonly Readonly<{
  language: "python" | "javascript";
  name: string;
  overrides: Readonly<Record<string, string>>;
  image: string;
}>[] = [
  {
    language: "python",
    name: "uses the managed Python image by default",
    overrides: {},
    image: "vercel/sandbox/python:3.14",
  },
  {
    language: "javascript",
    name: "uses the managed Node 22 image by default",
    overrides: {},
    image: "vercel/sandbox/node:22",
  },
  {
    language: "python",
    name: "honors the Python image override independently",
    overrides: {
      VERCEL_SANDBOX_IMAGE_JAVASCRIPT: "vercel/sandbox/node:24",
      VERCEL_SANDBOX_IMAGE_PYTHON: "team/project/python@sha256:fixture",
    },
    image: "team/project/python@sha256:fixture",
  },
  {
    language: "javascript",
    name: "honors the JavaScript image override independently",
    overrides: {
      VERCEL_SANDBOX_IMAGE_JAVASCRIPT: "vercel/sandbox/node:24",
      VERCEL_SANDBOX_IMAGE_PYTHON: "vercel/sandbox/python:3.14",
    },
    image: "vercel/sandbox/node:24",
  },
];

describe("getSandboxImage", () => {
  it("rejects an empty image override before provisioning", async () => {
    vi.stubEnv("VERCEL_SANDBOX_IMAGE_PYTHON", "");
    const { getSandboxImage } = await import("./adapter");
    expect(() => getSandboxImage("python")).toThrow();
  });
  it.each(imageScenarios)("$name", async ({ language, overrides, image }) => {
    for (const [name, value] of Object.entries(overrides)) {
      vi.stubEnv(name, value);
    }
    const { getSandboxImage } = await import("./adapter");
    expect(getSandboxImage(language)).toBe(image);
  });
});

it("sandbox cleanup waits for terminal stop and propagates a failed confirmation", async () => {
  const { cleanupSandbox } = await import("./adapter");
  const gate = Promise.withResolvers<never>();
  const { stop, log, remove } = createCleanupFixture();
  stop.mockReturnValue(gate.promise);
  const pending = cleanupSandbox({ delete: remove, stop }, log, "fixture");
  let settled = false;
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

it("creates an image-backed disposable sandbox with its scope and resource bounds", async () => {
  const { createSandbox } = await import("./adapter");
  const create = vi
    .spyOn(Sandbox, "create")
    .mockRejectedValueOnce(new Error("fixture"));
  const { signal } = new AbortController();
  const auth = { projectId: "project", teamId: "team", token: "opaque" };
  try {
    await expect(
      createSandbox("vercel/sandbox/node:22", signal, "owned", auth)
    ).rejects.toThrow("fixture");
    expect(create).toHaveBeenCalledExactlyOnceWith({
      ...auth,
      image: "vercel/sandbox/node:22",
      name: "owned",
      persistent: false,
      resources: { vcpus: 2 },
      signal,
      timeout: 300_000,
    });
  } finally {
    create.mockRestore();
  }
});

it.each(["python", "javascript"] as const)(
  "serializes the %s image through the installed SDK v3 create API",
  async (language) => {
    configureSandboxCredentials();
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      Response.json({
        routes: [],
        sandbox: {
          createdAt: 0,
          currentSessionId: "session",
          image: "vercel/sandbox/image@sha256:fixture",
          name: "owned",
          persistent: false,
          status: "running",
          updatedAt: 0,
        },
        session: { ...createStoppedSession(), status: "running" },
      })
    );
    vi.stubGlobal("fetch", fetch);
    const { createSandbox, getSandboxImage } = await import("./adapter");
    const { signal } = new AbortController();
    const image = getSandboxImage(language);
    const sandbox = await createSandbox(image, signal, "owned");
    expect(sandbox.name).toBe("owned");
    expect(sandbox.persistent).toBe(false);
    expect(sandbox.image).toBe("vercel/sandbox/image@sha256:fixture");
    expect(fetch).toHaveBeenCalledOnce();
    const [[url, options]] = fetch.mock.calls;
    expect(url).toBe("https://vercel.com/api/v3/sandboxes?teamId=team");
    assert(options);
    expect(options.method).toBe("POST");
    expect(options.headers).toMatchObject({ Authorization: "Bearer opaque" });
    expect(options.signal).toBe(signal);
    assert(typeof options.body === "string");
    expect(JSON.parse(options.body)).toEqual({
      image,
      name: "owned",
      persistent: false,
      ports: [],
      projectId: "project",
      resources: { vcpus: 2 },
      timeout: 300_000,
    });
  }
);

it("does not report successful cleanup until deletion has completed", async () => {
  const { cleanupSandbox } = await import("./adapter");
  const gate = Promise.withResolvers<undefined>();
  const { stop, log, remove } = createCleanupFixture();
  remove.mockReturnValue(gate.promise);
  const pending = cleanupSandbox({ delete: remove, stop }, log, "fixture");
  const rejected = expect(pending).rejects.toThrow("delete unavailable");
  await vi.waitFor(() => {
    expect(remove).toHaveBeenCalledOnce();
  });
  expect(log.info).not.toHaveBeenCalled();
  gate.reject(new Error("delete unavailable"));
  await rejected;
});

it("createCleanupSession deletes an exact disposable sandbox and confirms provider absence", async () => {
  const { sandbox, stop, remove, get } = createSandboxFixture({
    name: "owned",
    persistent: false,
  });
  get
    .mockResolvedValueOnce(sandbox)
    .mockRejectedValueOnce(new APIError(new Response(null, { status: 404 })));
  try {
    const { createCleanupSession } = await import("./adapter");
    const cleanup = createCleanupSession();
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
it.each([
  { name: "foreign", persistent: false },
  { name: "owned", persistent: true },
])(
  "createCleanupSession refuses unsafe sandbox identity %#",
  async (identity: Readonly<{ name: string; persistent: boolean }>) => {
    const { sandbox, stop, remove, get } = createSandboxFixture(identity);
    get.mockResolvedValue(sandbox);
    try {
      const { createCleanupSession } = await import("./adapter");
      const cleanup = createCleanupSession();
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
