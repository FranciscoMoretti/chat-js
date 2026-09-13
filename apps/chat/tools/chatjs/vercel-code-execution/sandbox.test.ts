import { Sandbox } from "@vercel/sandbox";
import { beforeEach, describe, expect, it, vi } from "vitest";

const envMock: {
  VERCEL_OIDC_TOKEN: string | undefined;
  VERCEL_PROJECT_ID: string | undefined;
  VERCEL_SANDBOX_RUNTIME: string | undefined;
  VERCEL_SANDBOX_RUNTIME_PYTHON: string | undefined;
  VERCEL_SANDBOX_RUNTIME_JAVASCRIPT: string | undefined;
  VERCEL_TEAM_ID: string | undefined;
  VERCEL_TOKEN: string | undefined;
} = {
  VERCEL_OIDC_TOKEN: undefined,
  VERCEL_PROJECT_ID: undefined,
  VERCEL_SANDBOX_RUNTIME: undefined,
  VERCEL_SANDBOX_RUNTIME_JAVASCRIPT: undefined,
  VERCEL_SANDBOX_RUNTIME_PYTHON: undefined,
  VERCEL_TEAM_ID: undefined,
  VERCEL_TOKEN: undefined,
};

vi.mock("@/lib/env", () => ({
  env: envMock,
}));

const jwt = (payload: unknown) =>
  `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;

beforeEach(() => {
  for (const key of Object.keys(envMock) as (keyof typeof envMock)[]) {
    envMock[key] = undefined;
  }
});

describe("getSandboxRuntime", () => {
  it("uses Python defaults when no override is set", async () => {
    const { getSandboxRuntime } = await import("./sandbox");

    expect(getSandboxRuntime("python")).toBe("python3.13");
  });

  it("uses JavaScript defaults when no override is set", async () => {
    const { getSandboxRuntime } = await import("./sandbox");

    expect(getSandboxRuntime("javascript")).toBe("node22");
  });

  it("honors VERCEL_SANDBOX_RUNTIME_PYTHON override for python", async () => {
    envMock.VERCEL_SANDBOX_RUNTIME_PYTHON = "python3.12";
    const { getSandboxRuntime } = await import("./sandbox");

    expect(getSandboxRuntime("python")).toBe("python3.12");
  });

  it("honors VERCEL_SANDBOX_RUNTIME_JAVASCRIPT override for javascript", async () => {
    envMock.VERCEL_SANDBOX_RUNTIME_JAVASCRIPT = "node20";
    const { getSandboxRuntime } = await import("./sandbox");

    expect(getSandboxRuntime("javascript")).toBe("node20");
  });

  it("falls back to legacy VERCEL_SANDBOX_RUNTIME for python", async () => {
    envMock.VERCEL_SANDBOX_RUNTIME = "python3.11";
    const { getSandboxRuntime } = await import("./sandbox");

    expect(getSandboxRuntime("python")).toBe("python3.11");
  });

  it("prefers VERCEL_SANDBOX_RUNTIME_PYTHON over legacy VERCEL_SANDBOX_RUNTIME", async () => {
    envMock.VERCEL_SANDBOX_RUNTIME_PYTHON = "python3.12";
    envMock.VERCEL_SANDBOX_RUNTIME = "python3.11";
    const { getSandboxRuntime } = await import("./sandbox");

    expect(getSandboxRuntime("python")).toBe("python3.12");
  });

  it("does not use legacy VERCEL_SANDBOX_RUNTIME for javascript", async () => {
    envMock.VERCEL_SANDBOX_RUNTIME = "python3.11";
    const { getSandboxRuntime } = await import("./sandbox");

    expect(getSandboxRuntime("javascript")).toBe("node22");
  });
});

describe("resolveSandboxAuth", () => {
  it("resolves the provider scope from an OIDC token", async () => {
    const token = jwt({ owner_id: "team", project_id: "project" });
    envMock.VERCEL_OIDC_TOKEN = token;
    const { resolveSandboxAuth } = await import("./sandbox");

    expect(resolveSandboxAuth()).toEqual({
      projectId: "project",
      teamId: "team",
      token,
    });
  });

  it("pins explicitly configured opaque credentials", async () => {
    Object.assign(envMock, {
      VERCEL_PROJECT_ID: "project",
      VERCEL_TEAM_ID: "team",
      VERCEL_TOKEN: "opaque",
    });
    const { resolveSandboxAuth } = await import("./sandbox");

    expect(resolveSandboxAuth()).toEqual({
      projectId: "project",
      teamId: "team",
      token: "opaque",
    });
  });

  it("rejects a configured JWT whose scope disagrees with configuration", async () => {
    Object.assign(envMock, {
      VERCEL_PROJECT_ID: "project",
      VERCEL_TEAM_ID: "team",
      VERCEL_TOKEN: jwt({ owner_id: "other", project_id: "project" }),
    });
    const { resolveSandboxAuth } = await import("./sandbox");

    expect(() => resolveSandboxAuth()).toThrow("scope do not match");
  });

  it("rejects an incomplete JWT that could override configured scope", async () => {
    Object.assign(envMock, {
      VERCEL_PROJECT_ID: "project",
      VERCEL_TEAM_ID: "team",
      VERCEL_TOKEN: jwt({ owner_id: "other" }),
    });
    const { resolveSandboxAuth } = await import("./sandbox");

    expect(() => resolveSandboxAuth()).toThrow(
      "Sandbox provider identity is unavailable."
    );
  });

  it("does not expose malformed token contents in errors", async () => {
    envMock.VERCEL_OIDC_TOKEN = jwt({ private: "secret-payload" });
    const { resolveSandboxAuth } = await import("./sandbox");

    expect(() => resolveSandboxAuth()).toThrow(
      "Sandbox provider identity is unavailable."
    );
  });
});

it("sandbox cleanup waits for terminal stop and propagates a failed confirmation", async () => {
  const { cleanupSandbox } = await import("./sandbox");
  const gate = Promise.withResolvers<never>();
  const stop = vi.fn<Sandbox["stop"]>(() => gate.promise);
  const log = { info: vi.fn(), warn: vi.fn() };
  const remove = vi.fn<Sandbox["delete"]>(() => Promise.resolve());
  const pending = cleanupSandbox({ delete: remove, stop }, log, "fixture");
  let settled = false;
  const observed = pending.finally(() => {
    settled = true;
  });
  const rejection = expect(observed).rejects.toThrow("stop unavailable");
  await Promise.resolve();
  expect(settled).toBe(false);
  expect(stop).toHaveBeenCalledWith({
    signal: expect.any(AbortSignal),
  });
  gate.reject(new Error("stop unavailable"));
  await rejection;
  expect(log.info).not.toHaveBeenCalled();
  expect(log.warn).toHaveBeenCalledOnce();
  expect(remove).toHaveBeenCalledWith({
    deleteOrphanSnapshots: true,
    signal: expect.any(AbortSignal),
  });
});

it("creates disposable sandboxes rather than enabling the SDK persistence default", async () => {
  const { createSandbox } = await import("./sandbox");
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

it("does not report successful cleanup until deletion has completed", async () => {
  const { cleanupSandbox } = await import("./sandbox");
  const gate = Promise.withResolvers<undefined>();
  const stop = vi.fn<Sandbox["stop"]>();
  const remove = vi.fn<Sandbox["delete"]>(() => gate.promise);
  const log = { info: vi.fn(), warn: vi.fn() };
  const pending = cleanupSandbox({ delete: remove, stop }, log, "fixture");
  const rejected = expect(pending).rejects.toThrow("delete unavailable");
  await vi.waitFor(() => expect(remove).toHaveBeenCalledOnce());
  expect(log.info).not.toHaveBeenCalled();
  gate.reject(new Error("delete unavailable"));
  await rejected;
});
