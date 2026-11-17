import { beforeEach, expect, it, vi } from "vitest";
import { DELETE } from "./route";

const mocks = vi.hoisted(() => ({
  principal: vi.fn(),
  read: vi.fn(),
  cleanup: vi.fn(),
}));
vi.mock("@/lib/eve/principal", () => ({
  resolveEvePrincipal: mocks.principal,
}));
vi.mock("@/lib/db/eve-workspaces", () => ({ readOwnedWorkspace: mocks.read }));
vi.mock("@/lib/db/eve-workspace-deletion", () => ({
  cleanupWorkspaceIfUnused: mocks.cleanup,
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
it.each(["attached conversations", "pending operation"])(
  "refuses deletion for %s without leaking internal details",
  async (reason) => {
    mocks.cleanup.mockRejectedValue(new Error(`private ${reason}`));
    const result = await DELETE(request(), context);
    expect(result.status).toBe(409);
    expect(await result.text()).not.toContain("private");
    expect(mocks.cleanup).toHaveBeenCalledWith("owner", id, true);
  }
);
it("deletes an empty workspace and allows replay", async () => {
  const result = await DELETE(request(), context);
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({ workspaceId: id, status: "deleted" });
  expect(result.headers.get("cache-control")).toBe("no-store");
  expect(mocks.cleanup).toHaveBeenCalledWith("owner", id, true);
});
