/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { getVercelOidcTokenSync } from "@vercel/oidc";
import { APIError, Sandbox } from "@vercel/sandbox";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
/* oxlint-enable sort-imports */

/* oxlint-disable no-undefined --
 * no-undefined (#519): envMock uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
const envMock: {
  VERCEL_PROJECT_ID: string | undefined;
  VERCEL_SANDBOX_RUNTIME: string | undefined;
  VERCEL_SANDBOX_RUNTIME_PYTHON: string | undefined;
  VERCEL_SANDBOX_RUNTIME_JAVASCRIPT: string | undefined;
  VERCEL_TEAM_ID: string | undefined;
  VERCEL_TOKEN: string | undefined;
} = {
  VERCEL_PROJECT_ID: undefined,
  VERCEL_SANDBOX_RUNTIME: undefined,
  VERCEL_SANDBOX_RUNTIME_JAVASCRIPT: undefined,
  VERCEL_SANDBOX_RUNTIME_PYTHON: undefined,
  VERCEL_TEAM_ID: undefined,
  VERCEL_TOKEN: undefined,
};
/* oxlint-enable no-undefined */

vi.mock("@/lib/env", () => ({
  env: envMock,
}));

const jwt = (payload: unknown): string =>
  `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;

/* oxlint-disable no-undefined --
 * no-undefined (#519): beforeEach uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
beforeEach(() => {
  vi.stubEnv("VERCEL_OIDC_TOKEN", undefined);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: This sandbox fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  for (const key of Object.keys(envMock) as (keyof typeof envMock)[]) {
    envMock[key] = undefined;
  }
});
/* oxlint-enable no-undefined */

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): describe("getSandboxRuntime") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
describe("getSandboxRuntime", () => {
  it("uses Python defaults when no override is set", async () => {
    const { getSandboxRuntime } = await import("./execution-sandbox");

    expect(getSandboxRuntime("python")).toBe("python3.13");
  });

  it("uses JavaScript defaults when no override is set", async () => {
    const { getSandboxRuntime } = await import("./execution-sandbox");

    expect(getSandboxRuntime("javascript")).toBe("node22");
  });

  it("honors VERCEL_SANDBOX_RUNTIME_PYTHON override for python", async () => {
    envMock.VERCEL_SANDBOX_RUNTIME_PYTHON = "python3.12";
    const { getSandboxRuntime } = await import("./execution-sandbox");

    expect(getSandboxRuntime("python")).toBe("python3.12");
  });

  it("honors VERCEL_SANDBOX_RUNTIME_JAVASCRIPT override for javascript", async () => {
    envMock.VERCEL_SANDBOX_RUNTIME_JAVASCRIPT = "node20";
    const { getSandboxRuntime } = await import("./execution-sandbox");

    expect(getSandboxRuntime("javascript")).toBe("node20");
  });

  it("falls back to legacy VERCEL_SANDBOX_RUNTIME for python", async () => {
    envMock.VERCEL_SANDBOX_RUNTIME = "python3.11";
    const { getSandboxRuntime } = await import("./execution-sandbox");

    expect(getSandboxRuntime("python")).toBe("python3.11");
  });

  it("prefers VERCEL_SANDBOX_RUNTIME_PYTHON over legacy VERCEL_SANDBOX_RUNTIME", async () => {
    envMock.VERCEL_SANDBOX_RUNTIME_PYTHON = "python3.12";
    envMock.VERCEL_SANDBOX_RUNTIME = "python3.11";
    const { getSandboxRuntime } = await import("./execution-sandbox");

    expect(getSandboxRuntime("python")).toBe("python3.12");
  });

  it("does not use legacy VERCEL_SANDBOX_RUNTIME for javascript", async () => {
    envMock.VERCEL_SANDBOX_RUNTIME = "python3.11";
    const { getSandboxRuntime } = await import("./execution-sandbox");

    expect(getSandboxRuntime("javascript")).toBe("node22");
  });
});
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable max-lines-per-function, no-undefined, node/no-sync, oxc/no-async-await --
 * max-lines-per-function (#510): describe("resolveSandboxAuth") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-undefined (#519): describe("resolveSandboxAuth") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * node/no-sync (#538): describe("resolveSandboxAuth") uses getVercelOidcTokenSync() within its synchronous fixture setup contract; asynchronous conversion changes its callers and lifecycle.
 * oxc/no-async-await (#540): describe("resolveSandboxAuth") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
describe("resolveSandboxAuth", () => {
  it("resolves request-scoped OIDC credentials without an environment token", async () => {
    const token = jwt({ owner_id: "team", project_id: "project" });
    vi.stubEnv("VERCEL_OIDC_TOKEN", undefined);
    vi.stubGlobal(Symbol.for("@vercel/request-context"), {
      get: () => ({ headers: { "x-vercel-oidc-token": token } }),
    });
    expect(getVercelOidcTokenSync()).toBe(token);
    const { resolveSandboxAuth } = await import("./execution-sandbox");

    expect(resolveSandboxAuth()).toEqual({
      projectId: "project",
      teamId: "team",
      token,
    });
  });

  it("resolves the provider scope from an OIDC token", async () => {
    const token = jwt({ owner_id: "team", project_id: "project" });
    vi.stubEnv("VERCEL_OIDC_TOKEN", token);
    const { resolveSandboxAuth } = await import("./execution-sandbox");

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
    const { resolveSandboxAuth } = await import("./execution-sandbox");

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
    const { resolveSandboxAuth } = await import("./execution-sandbox");

    expect(() => resolveSandboxAuth()).toThrow("scope do not match");
  });

  it("rejects an incomplete JWT that could override configured scope", async () => {
    Object.assign(envMock, {
      VERCEL_PROJECT_ID: "project",
      VERCEL_TEAM_ID: "team",
      VERCEL_TOKEN: jwt({ owner_id: "other" }),
    });
    const { resolveSandboxAuth } = await import("./execution-sandbox");

    expect(() => resolveSandboxAuth()).toThrow(
      "Sandbox provider identity is unavailable."
    );
  });

  it("does not expose malformed token contents in errors", async () => {
    vi.stubEnv("VERCEL_OIDC_TOKEN", jwt({ private: "secret-payload" }));
    const { resolveSandboxAuth } = await import("./execution-sandbox");

    expect(() => resolveSandboxAuth()).toThrow(
      "Sandbox provider identity is unavailable."
    );
  });

  it("rejects missing credentials without leaking provider errors", async () => {
    const { resolveSandboxAuth } = await import("./execution-sandbox");

    expect(() => resolveSandboxAuth()).toThrow(
      "Sandbox provider identity is unavailable."
    );
  });

  it("uses each request's token for execution and cleanup instead of a stale environment token", async () => {
    vi.stubEnv(
      "VERCEL_OIDC_TOKEN",
      jwt({ owner_id: "stale", project_id: "stale" })
    );
    let token = jwt({ owner_id: "team", project_id: "first" });
    vi.stubGlobal(Symbol.for("@vercel/request-context"), {
      get: () => ({ headers: { "x-vercel-oidc-token": token } }),
    });
    const { resolveSandboxAuth, codeSandboxCleanupCapability } =
      await import("./execution-sandbox");

    expect(resolveSandboxAuth()).toEqual({
      projectId: "first",
      teamId: "team",
      token,
    });
    token = jwt({ owner_id: "team", project_id: "second" });
    expect(
      codeSandboxCleanupCapability.createCleanupSession().provider
    ).toEqual({
      projectId: "second",
      teamId: "team",
      token,
    });
  });
});
/* oxlint-enable max-lines-per-function, no-undefined, node/no-sync, oxc/no-async-await */

/* oxlint-disable max-statements, oxc/no-async-await, typescript/promise-function-async --
 * max-statements (#512): it("sandbox cleanup waits for terminal stop and propagates a failed confirmation") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-async-await (#540): it("sandbox cleanup waits for terminal stop and propagates a failed confirmation") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/promise-function-async (#606): it("sandbox cleanup waits for terminal stop and propagates a failed confirmation") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
it("sandbox cleanup waits for terminal stop and propagates a failed confirmation", async () => {
  const { cleanupSandbox } = await import("./execution-sandbox");
  const gate = Promise.withResolvers<never>();
  const stop = vi.fn<Sandbox["stop"]>(() => gate.promise);
  const log = { info: vi.fn(), warn: vi.fn() };
  const remove = vi.fn<Sandbox["delete"]>(() => Promise.resolve());
  const pending = cleanupSandbox({ delete: remove, stop }, log, "fixture");
  let settled = false;
  // oxlint-disable-next-line promise/prefer-await-to-then -- Observe cleanup settlement while keeping the stop confirmation pending for assertions.
  const observed = pending.finally(() => {
    settled = true;
  });
  const rejection = expect(observed).rejects.toThrow("stop unavailable");
  await Promise.resolve();
  expect(settled).toBe(false);
  expect(stop).toHaveBeenCalledWith({
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- #595: This sandbox fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
    signal: expect.any(AbortSignal),
  });
  gate.reject(new Error("stop unavailable"));
  await rejection;
  expect(log.info).not.toHaveBeenCalled();
  expect(log.warn).toHaveBeenCalledOnce();
  expect(remove).toHaveBeenCalledWith({
    deleteOrphanSnapshots: true,
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- #595: This sandbox fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
    signal: expect.any(AbortSignal),
  });
});
/* oxlint-enable max-statements, oxc/no-async-await, typescript/promise-function-async */

/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): it("creates disposable sandboxes rather than enabling the SDK persistence default") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
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

/* oxlint-disable max-statements, oxc/no-async-await, typescript/promise-function-async --
 * max-statements (#512): it("does not report successful cleanup until deletion has completed") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-async-await (#540): it("does not report successful cleanup until deletion has completed") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/promise-function-async (#606): it("does not report successful cleanup until deletion has completed") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
it("does not report successful cleanup until deletion has completed", async () => {
  const { cleanupSandbox } = await import("./execution-sandbox");
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
/* oxlint-enable max-statements, oxc/no-async-await, typescript/promise-function-async */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, oxc/no-async-await, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, unicorn/no-null --
 * max-lines-per-function (#510): describe("codeSandboxCleanupCapability") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): describe("codeSandboxCleanupCapability") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): describe("codeSandboxCleanupCapability") uses 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): describe("codeSandboxCleanupCapability") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): describe("codeSandboxCleanupCapability") accepts identity; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): describe("codeSandboxCleanupCapability") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * unicorn/no-null (#570): describe("codeSandboxCleanupCapability") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
describe("codeSandboxCleanupCapability", () => {
  it("deletes an exact disposable sandbox and confirms provider absence", async () => {
    Object.assign(envMock, {
      VERCEL_PROJECT_ID: "project",
      VERCEL_TEAM_ID: "team",
      VERCEL_TOKEN: "opaque",
    });
    const stop = vi.fn(() => Promise.resolve());
    const remove = vi.fn<Sandbox["delete"]>(() => Promise.resolve());
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: This sandbox fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
    const sandbox = Object.create(Sandbox.prototype, {
      delete: { value: remove },
      name: { value: "owned" },
      persistent: { value: false },
      stop: { value: stop },
    }) as Sandbox;
    const get = vi
      .spyOn(Sandbox, "get")
      .mockResolvedValueOnce(sandbox)
      .mockRejectedValueOnce(new APIError(new Response(null, { status: 404 })));
    try {
      const { codeSandboxCleanupCapability } =
        await import("./execution-sandbox");
      const cleanup = codeSandboxCleanupCapability.createCleanupSession();
      expect(cleanup.provider).toMatchObject({
        projectId: "project",
        teamId: "team",
      });
      await cleanup.deleteAndConfirmAbsent("owned");
      expect(get).toHaveBeenCalledTimes(2);
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
  ])("refuses unsafe sandbox identity %#", async (identity) => {
    Object.assign(envMock, {
      VERCEL_PROJECT_ID: "project",
      VERCEL_TEAM_ID: "team",
      VERCEL_TOKEN: "opaque",
    });
    const stop = vi.fn(() => Promise.resolve());
    const remove = vi.fn<Sandbox["delete"]>(() => Promise.resolve());
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: This sandbox fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
    const sandbox = Object.create(Sandbox.prototype, {
      delete: { value: remove },
      name: { value: identity.name },
      persistent: { value: identity.persistent },
      stop: { value: stop },
    }) as Sandbox;
    const get = vi.spyOn(Sandbox, "get").mockResolvedValue(sandbox);
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
  });
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, oxc/no-async-await, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, unicorn/no-null */

/* oxlint-disable max-lines -- #509: This sandbox.test.ts module keeps its existing fixture/scenario boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
