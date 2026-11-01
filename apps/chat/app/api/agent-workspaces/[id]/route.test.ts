import { beforeEach, expect, it, vi } from "vitest";
import { DELETE } from "./route";

const mocks = vi.hoisted(() => ({
  principal: vi.fn(),
  read: vi.fn(),
  cleanup: vi.fn(),
  provider: vi.fn(),
  files: vi.fn(),
}));
vi.mock("@/lib/eve/principal", () => ({
  resolveEvePrincipal: mocks.principal,
}));
vi.mock("@/lib/db/eve-workspaces", () => ({ readOwnedWorkspace: mocks.read }));
vi.mock("@/lib/eve/persistent-sandbox-store", () => ({
  cleanupWorkspaceIfUnused: mocks.cleanup,
}));
vi.mock("@/lib/eve/purge-files", () => ({
  purgeEveWorkspaceFiles: mocks.files,
}));
vi.mock("@/lib/sandbox/runtime", () => ({
  getPersistentSandboxProvider: mocks.provider,
}));
vi.mock("@/lib/env", () => ({ env: { APP_URL: "http://localhost:3790" } }));
const id = "9f12cf31-8b45-41ae-a174-59b5276f0fe4";
const context = { params: Promise.resolve({ id }) };
const request = (origin = "http://localhost:3790") =>
  new Request(`http://localhost:3790/api/agent-workspaces/${id}`, {
    method: "DELETE",
    headers: { origin },
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.principal.mockResolvedValue({ ownerId: "owner" });
  mocks.read.mockResolvedValue({ id, state: "active" });
});
it("requires same-origin authentication before workspace access", async () => {
  const foreign = await DELETE(request("https://foreign.example"), context);
  expect(foreign.status).toBe(403);
  expect(mocks.principal).not.toHaveBeenCalled();
  mocks.principal.mockResolvedValue(null);
  const unsigned = await DELETE(request(), context);
  expect(unsigned.status).toBe(401);
  expect(mocks.read).not.toHaveBeenCalled();
  expect(mocks.cleanup).not.toHaveBeenCalled();
});
it("hides foreign workspace IDs and rejects malformed IDs", async () => {
  mocks.read.mockResolvedValue(null);
  const missing = await DELETE(request(), context);
  expect(missing.status).toBe(404);
  expect(mocks.read).toHaveBeenCalledWith("owner", id);
  const invalid = await DELETE(request(), {
    params: Promise.resolve({ id: "invalid" }),
  });
  expect(invalid.status).toBe(400);
  expect(mocks.cleanup).not.toHaveBeenCalled();
});
it.each(["attached conversations", "uncertain allocation"])(
  "refuses deletion for %s without leaking internal details",
  async (reason) => {
    mocks.cleanup.mockRejectedValue(new Error(`private ${reason}`));
    const result = await DELETE(request(), context);
    expect(result.status).toBe(409);
    expect(await result.text()).not.toContain("private");
    expect(mocks.cleanup).toHaveBeenCalledWith(
      "owner",
      id,
      mocks.provider,
      true
    );
  }
);
it("deletes an empty workspace and allows replay without selecting a provider eagerly", async () => {
  const result = await DELETE(request(), context);
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({ workspaceId: id, status: "deleted" });
  expect(result.headers.get("cache-control")).toBe("no-store");
  expect(mocks.cleanup).toHaveBeenCalledWith("owner", id, mocks.provider, true);
  expect(mocks.provider).not.toHaveBeenCalled();
  expect(mocks.files).toHaveBeenCalledWith("owner", id);
});

it("keeps deletion retryable when original blob cleanup fails after sandbox cleanup", async () => {
  mocks.files.mockRejectedValueOnce(new Error("private storage failure"));
  const failed = await DELETE(request(), context);
  expect(failed.status).toBe(409);
  expect(await failed.text()).not.toContain("private");
  const retry = await DELETE(request(), context);
  expect(retry.status).toBe(200);
  expect(mocks.cleanup).toHaveBeenCalledTimes(2);
  expect(mocks.files).toHaveBeenCalledTimes(2);
});
