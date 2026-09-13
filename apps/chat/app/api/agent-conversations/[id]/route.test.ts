import { beforeEach, expect, it, vi } from "vitest";
import { DELETE, GET } from "./route";

const mocks = vi.hoisted(() => ({
  principal: vi.fn(),
  state: vi.fn(),
  remove: vi.fn(),
  unacceptedCopy: vi.fn(),
  removeCopy: vi.fn(),
  enabled: true,
  env: {
    APP_URL: "http://localhost:3790",
    WORKFLOW_POSTGRES_URL: "postgresql://localhost/test",
    EVE_INTERNAL_ORIGIN: "http://localhost:4000",
  },
}));
vi.mock("@/lib/eve/principal", () => ({
  resolveEvePrincipal: mocks.principal,
}));
vi.mock("@/lib/db/eve-deletion", () => ({ getEveDeletionState: mocks.state }));
vi.mock("@/lib/db/eve-copy-journal", () => ({
  isUnacceptedEveCopy: mocks.unacceptedCopy,
}));
vi.mock("@/lib/eve/delete-unaccepted-copy", () => ({
  deleteUnacceptedEveCopy: mocks.removeCopy,
}));
vi.mock("@/lib/eve/delete-local-conversation", () => ({
  deleteLocalEveConversationFamily: mocks.remove,
}));
vi.mock("@/lib/eve/availability", () => ({
  isEveEnabled: () => mocks.enabled,
}));
vi.mock("@/lib/env", () => ({ env: mocks.env }));
const id = "5c57c1d6-5540-4c6d-9d03-064a33528a5d";
const context = { params: Promise.resolve({ id }) };
const request = (method = "DELETE", origin = "http://localhost:3790") =>
  new Request(`http://localhost:3790/api/agent-conversations/${id}`, {
    method,
    headers: { origin },
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.enabled = true;
  mocks.env.WORKFLOW_POSTGRES_URL = "postgresql://localhost/test";
  mocks.env.EVE_INTERNAL_ORIGIN = "http://localhost:4000";
  mocks.principal.mockResolvedValue({ kind: "registered", ownerId: "owner" });
  mocks.state.mockResolvedValue({ rootId: id, state: "bound" });
  mocks.remove.mockResolvedValue({ rootId: id });
});
it("cleans an unaccepted copy with never-dispatched proof instead of native retirement", async () => {
  mocks.unacceptedCopy.mockResolvedValue(true);
  mocks.env.WORKFLOW_POSTGRES_URL = "postgresql://remote.example/db";
  expect((await DELETE(request(), context)).status).toBe(200);
  expect(mocks.removeCopy).toHaveBeenCalledWith("owner", id);
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("runs owner-authorized family deletion with a server-controlled worker root", async () => {
  const response = await DELETE(request(), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "deleted", rootId: id });
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(mocks.remove).toHaveBeenCalledWith("owner", id, process.cwd());
});
it("hides unavailable and foreign bindings without cleanup", async () => {
  mocks.state.mockResolvedValue(undefined);
  expect((await DELETE(request(), context)).status).toBe(404);
  expect(mocks.state).toHaveBeenCalledWith("owner", id);
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("requires login, valid coordinates and the feature flag", async () => {
  mocks.principal.mockResolvedValue(null);
  expect((await DELETE(request(), context)).status).toBe(401);
  mocks.principal.mockResolvedValue({ kind: "registered", ownerId: "owner" });
  expect(
    (await DELETE(request(), { params: Promise.resolve({ id: "invalid" }) }))
      .status
  ).toBe(400);
  mocks.enabled = false;
  expect((await GET(request("GET"), context)).status).toBe(404);
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("rejects cross-origin mutation before any cleanup", async () => {
  expect(
    (await DELETE(request("DELETE", "https://foreign.example"), context)).status
  ).toBe(403);
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("refuses unsupported provider configuration before revoking access", async () => {
  mocks.env.WORKFLOW_POSTGRES_URL = "postgresql://remote.example/db";
  expect((await DELETE(request(), context)).status).toBe(503);
  mocks.env.WORKFLOW_POSTGRES_URL = "postgresql://localhost/test";
  mocks.env.EVE_INTERNAL_ORIGIN = "https://remote.example";
  expect((await DELETE(request(), context)).status).toBe(503);
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("reports pending erasure without leaking internal failure details", async () => {
  mocks.remove.mockRejectedValue(new Error("private provider details"));
  mocks.state
    .mockResolvedValueOnce({ rootId: id, state: "bound" })
    .mockResolvedValue({ rootId: id, state: "deleting" });
  const response = await DELETE(request(), context);
  expect(response.status).toBe(202);
  expect(await response.json()).toMatchObject({
    status: "pending",
    retryRequired: true,
  });
});
it("does not call an unstarted operation pending", async () => {
  mocks.remove.mockRejectedValue(new Error("creation unsettled"));
  expect((await DELETE(request(), context)).status).toBe(409);
});
it("returns completed tombstones idempotently and GET never resumes cleanup", async () => {
  mocks.state.mockResolvedValue({ rootId: id, state: "deleted" });
  expect(await (await DELETE(request(), context)).json()).toEqual({
    status: "deleted",
    rootId: id,
  });
  expect(await (await GET(request("GET"), context)).json()).toEqual({
    status: "deleted",
    rootId: id,
  });
  mocks.state.mockResolvedValue({ rootId: id, state: "deleting" });
  expect(await (await GET(request("GET"), context)).json()).toEqual({
    status: "pending",
    rootId: id,
  });
  expect(mocks.remove).not.toHaveBeenCalled();
});
