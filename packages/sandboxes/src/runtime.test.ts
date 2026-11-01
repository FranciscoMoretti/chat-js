import { describe, expect, it, vi } from "vitest";
import { withSandbox } from "./runtime";
import type { SandboxProvider } from "./provider";

const fixture = () => {
  const events: string[] = [];
  const controller = new AbortController();
  const provider: SandboxProvider = {
    scope: { providerId: "test", accountId: "account", scopeId: "scope" },
    create: vi.fn<SandboxProvider["create"]>(async ({ name }) => {
      events.push("create");
      return await Promise.resolve({ name, runCommand: vi.fn() });
    }),
    deleteAndConfirmAbsent: vi.fn(async () => {
      events.push("delete");
      await Promise.resolve();
    }),
  };
  const ownership = {
    reserve: vi.fn(async () => {
      events.push("reserve");
      return await Promise.resolve("allocation");
    }),
    created: vi.fn(async () => {
      events.push("created");
      await Promise.resolve();
    }),
    release: vi.fn(async () => {
      events.push("release");
      await Promise.resolve();
    }),
  };
  return { events, provider, ownership, controller };
};

describe("sandbox ownership lifecycle", () => {
  it("reserves before create and releases only after verified cleanup", async () => {
    const f = fixture();
    const result = await withSandbox(
      f.provider,
      {
        ownership: f.ownership,
        runtime: "javascript",
        signal: f.controller.signal,
      },
      async () => {
        f.events.push("execute");
        return await Promise.resolve(42);
      }
    );
    expect(result).toBe(42);
    expect(f.events).toEqual([
      "reserve",
      "create",
      "created",
      "execute",
      "delete",
      "release",
    ]);
  });
  it("retains uncertain creation instead of interpreting absence as cleanup", async () => {
    const f = fixture();
    vi.mocked(f.provider.create).mockRejectedValue(
      new Error("connection lost")
    );
    await expect(
      withSandbox(
        f.provider,
        {
          ownership: f.ownership,
          runtime: "python",
          signal: f.controller.signal,
        },
        vi.fn()
      )
    ).rejects.toThrow("connection lost");
    expect(f.ownership.release).not.toHaveBeenCalled();
    expect(f.provider.deleteAndConfirmAbsent).not.toHaveBeenCalled();
  });
  it("retains ownership on failed cleanup", async () => {
    const f = fixture();
    vi.mocked(f.provider.deleteAndConfirmAbsent).mockRejectedValue(
      new Error("still exists")
    );
    await expect(
      withSandbox(
        f.provider,
        {
          ownership: f.ownership,
          runtime: "python",
          signal: f.controller.signal,
        },
        async () => await Promise.resolve(42)
      )
    ).rejects.toThrow("still exists");
    expect(f.ownership.release).not.toHaveBeenCalled();
  });
  it("cancellation starts cleanup once and never returns a successful result", async () => {
    const f = fixture();
    await expect(
      withSandbox(
        f.provider,
        {
          ownership: f.ownership,
          runtime: "python",
          signal: f.controller.signal,
        },
        async () => {
          f.controller.abort();
          return await Promise.resolve(42);
        }
      )
    ).rejects.toThrow();
    expect(f.provider.deleteAndConfirmAbsent).toHaveBeenCalledTimes(1);
    expect(f.ownership.release).toHaveBeenCalledTimes(1);
  });
  it("retains uncertain ownership when creation returns a different identity", async () => {
    const f = fixture();
    vi.mocked(f.provider.create).mockResolvedValue({
      name: "other",
      runCommand: vi.fn(),
    });
    const execute = vi.fn();
    await expect(
      withSandbox(
        f.provider,
        {
          ownership: f.ownership,
          runtime: "python",
          signal: f.controller.signal,
        },
        execute
      )
    ).rejects.toThrow("identity");
    expect(execute).not.toHaveBeenCalled();
    expect(f.ownership.release).not.toHaveBeenCalled();
  });
  it("cleans up cancellation that arrives while creation is in flight", async () => {
    const f = fixture();
    vi.mocked(f.provider.create).mockImplementation(async ({ name }) => {
      f.controller.abort();
      return await Promise.resolve({ name, runCommand: vi.fn() });
    });
    const execute = vi.fn();
    await expect(
      withSandbox(
        f.provider,
        {
          ownership: f.ownership,
          runtime: "python",
          signal: f.controller.signal,
        },
        execute
      )
    ).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
    expect(f.provider.deleteAndConfirmAbsent).toHaveBeenCalledTimes(1);
    expect(f.ownership.release).toHaveBeenCalledTimes(1);
  });
  it("does not report success when cancellation arrives during cleanup", async () => {
    const f = fixture();
    vi.mocked(f.provider.deleteAndConfirmAbsent).mockImplementation(
      async () => {
        f.controller.abort();
        await Promise.resolve();
      }
    );
    await expect(
      withSandbox(
        f.provider,
        {
          ownership: f.ownership,
          runtime: "python",
          signal: f.controller.signal,
        },
        async () => await Promise.resolve(42)
      )
    ).rejects.toThrow();
    expect(f.ownership.release).toHaveBeenCalledTimes(1);
  });
  it("cleans up when recording creation fails", async () => {
    const f = fixture();
    f.ownership.created.mockRejectedValue(new Error("database unavailable"));
    const execute = vi.fn();
    await expect(
      withSandbox(
        f.provider,
        {
          ownership: f.ownership,
          runtime: "python",
          signal: f.controller.signal,
        },
        execute
      )
    ).rejects.toThrow("database unavailable");
    expect(execute).not.toHaveBeenCalled();
    expect(f.provider.deleteAndConfirmAbsent).toHaveBeenCalledTimes(1);
  });
});
