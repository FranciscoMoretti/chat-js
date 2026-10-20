import { beforeEach, expect, it, vi } from "vitest";

const installed = vi.hoisted(() => ({ persistent: false }));
const calls = vi.hoisted(() => ({ register: vi.fn(), provider: vi.fn() }));
vi.mock("../sandbox/provider", () => ({
  get supportsPersistentSandbox() {
    return installed.persistent;
  },
}));
vi.mock("../sandbox/runtime", () => ({
  getSandboxProvider: calls.provider,
  getPersistentSandboxProvider: calls.provider,
}));
vi.mock("../env", () => ({ env: { NODE_ENV: "development" } }));
vi.mock("../db/eve-queries", () => ({ readEveSessionMapping: vi.fn() }));
vi.mock("./persistent-sandbox-store", () => ({
  registerPersistentSession: calls.register,
  readPersistentIdentity: vi.fn(),
}));
const { createAppSandboxEnvironment } = await import("./sandbox-environment");
const { registerAppSandboxSession } = await import("./persistent-sandbox");
beforeEach(() => {
  vi.clearAllMocks();
});

it("an installation without persistent support does not resolve credentials or require a supervisor lease", async () => {
  installed.persistent = false;
  expect(createAppSandboxEnvironment().provider).toBe(
    "chatjs-sandbox-disabled"
  );
  await registerAppSandboxSession({
    session: {
      id: "session",
      auth: { initiator: null, current: null },
      turn: { id: "turn", sequence: 0 },
    },
  });
  expect(calls.provider).not.toHaveBeenCalled();
  expect(calls.register).not.toHaveBeenCalled();
});
it("selects the installed persistent provider without resolving credentials at import time", () => {
  installed.persistent = true;
  expect(createAppSandboxEnvironment().provider).toBe("chatjs-persistent");
  expect(calls.provider).not.toHaveBeenCalled();
});

vi.mock("@/lib/eve/workspace-attachments", () => ({
  resolveWorkspaceSeedAttachments: vi.fn(),
}));
