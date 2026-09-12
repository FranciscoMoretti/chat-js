import { beforeEach, describe, expect, it, vi } from "vitest";

const envMock: {
  VERCEL_SANDBOX_RUNTIME: string | undefined;
  VERCEL_SANDBOX_RUNTIME_PYTHON: string | undefined;
  VERCEL_SANDBOX_RUNTIME_JAVASCRIPT: string | undefined;
} = {
  VERCEL_SANDBOX_RUNTIME: undefined,
  VERCEL_SANDBOX_RUNTIME_JAVASCRIPT: undefined,
  VERCEL_SANDBOX_RUNTIME_PYTHON: undefined,
};

vi.mock("@/lib/env", () => ({
  env: envMock,
}));

describe("getSandboxRuntime", () => {
  beforeEach(() => {
    envMock.VERCEL_SANDBOX_RUNTIME = undefined;
    envMock.VERCEL_SANDBOX_RUNTIME_PYTHON = undefined;
    envMock.VERCEL_SANDBOX_RUNTIME_JAVASCRIPT = undefined;
  });

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
