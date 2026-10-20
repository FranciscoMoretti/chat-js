import { beforeEach, expect, it, vi } from "vitest";

import { DELETE, GET } from "./route";

const HTTP_STATUS = {
  accepted: 202,
  badRequest: 400,
  conflict: 409,
  forbidden: 403,
  notFound: 404,
  ok: 200,
  serviceUnavailable: 503,
  unauthorized: 401,
};

const mocks = vi.hoisted(() => ({
  env: {
    APP_URL: "http://localhost:3790",
    EVE_INTERNAL_ORIGIN: "http://localhost:4000",
    WORKFLOW_POSTGRES_URL: "postgresql://localhost/test",
  },
  principal: vi.fn(),
  remove: vi.fn(),
  state: vi.fn(),
}));
vi.mock("@/lib/eve/principal", () => ({
  resolveEvePrincipal: mocks.principal,
}));
vi.mock("@/lib/db/eve-deletion", () => ({ getEveDeletionState: mocks.state }));
vi.mock("@/lib/eve/delete-local-conversation", () => ({
  deleteLocalEveConversationFamily: mocks.remove,
}));
vi.mock("@/lib/env", () => ({ env: mocks.env }));
const id = "5c57c1d6-5540-4c6d-9d03-064a33528a5d";
const context = { params: Promise.resolve({ id }) };
const request = (
  method = "DELETE",
  origin = "http://localhost:3790"
): Request =>
  new Request(`http://localhost:3790/api/agent-conversations/${id}`, {
    headers: { origin },
    method,
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.env.WORKFLOW_POSTGRES_URL = "postgresql://localhost/test";
  mocks.env.EVE_INTERNAL_ORIGIN = "http://localhost:4000";
  mocks.principal.mockResolvedValue({ kind: "registered", ownerId: "owner" });
  mocks.state.mockResolvedValue({ rootId: id, state: "bound" });
  mocks.remove.mockResolvedValue({ rootId: id });
});

it("runs owner-authorized family deletion with a server-controlled worker root", async () => {
  const response = await DELETE(request(), context);
  expect(response.status).toBe(HTTP_STATUS.ok);
  expect(await response.json()).toEqual({ rootId: id, status: "deleted" });
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(mocks.remove).toHaveBeenCalledWith("owner", id, process.cwd());
});

it("hides unavailable and foreign bindings without cleanup", async () => {
  mocks.state.mockResolvedValue(null);
  const resolvedResult2 = await DELETE(request(), context);
  expect(resolvedResult2.status).toBe(HTTP_STATUS.notFound);
  expect(mocks.state).toHaveBeenCalledWith("owner", id);
  expect(mocks.remove).not.toHaveBeenCalled();
});

it("requires login and valid coordinates", async () => {
  mocks.principal.mockResolvedValue(null);
  const resolvedResult3 = await DELETE(request(), context);
  expect(resolvedResult3.status).toBe(HTTP_STATUS.unauthorized);
  mocks.principal.mockResolvedValue({ kind: "registered", ownerId: "owner" });
  const resolvedResult4 = await DELETE(request(), {
    params: Promise.resolve({ id: "invalid" }),
  });
  expect(resolvedResult4.status).toBe(HTTP_STATUS.badRequest);
  expect(mocks.remove).not.toHaveBeenCalled();
});

it("rejects cross-origin mutation before any cleanup", async () => {
  const resolvedResult6 = await DELETE(
    request("DELETE", "https://foreign.example"),
    context
  );
  expect(resolvedResult6.status).toBe(HTTP_STATUS.forbidden);
  expect(mocks.remove).not.toHaveBeenCalled();
});

it("refuses unsupported provider configuration before revoking access", async () => {
  mocks.env.WORKFLOW_POSTGRES_URL = "postgresql://remote.example/db";
  const resolvedResult7 = await DELETE(request(), context);
  expect(resolvedResult7.status).toBe(HTTP_STATUS.serviceUnavailable);
  mocks.env.WORKFLOW_POSTGRES_URL = "postgresql://localhost/test";
  mocks.env.EVE_INTERNAL_ORIGIN = "https://remote.example";
  const resolvedResult8 = await DELETE(request(), context);
  expect(resolvedResult8.status).toBe(HTTP_STATUS.serviceUnavailable);
  expect(mocks.remove).not.toHaveBeenCalled();
});

it("reports pending erasure without leaking internal failure details", async () => {
  mocks.remove.mockRejectedValue(new Error("private provider details"));
  mocks.state
    .mockResolvedValueOnce({ rootId: id, state: "bound" })
    .mockResolvedValue({ rootId: id, state: "deleting" });
  const response = await DELETE(request(), context);
  expect(response.status).toBe(HTTP_STATUS.accepted);
  expect(await response.json()).toMatchObject({
    retryRequired: true,
    status: "pending",
  });
});

it("does not call an unstarted operation pending", async () => {
  mocks.remove.mockRejectedValue(new Error("creation unsettled"));
  const resolvedResult9 = await DELETE(request(), context);
  expect(resolvedResult9.status).toBe(HTTP_STATUS.conflict);
});

it("returns completed tombstones idempotently and GET never resumes cleanup", async () => {
  mocks.state.mockResolvedValue({ rootId: id, state: "deleted" });
  const resolvedResult10 = await DELETE(request(), context);
  expect(await resolvedResult10.json()).toEqual({
    rootId: id,
    status: "deleted",
  });
  const resolvedResult11 = await GET(request("GET"), context);
  expect(await resolvedResult11.json()).toEqual({
    rootId: id,
    status: "deleted",
  });
  mocks.state.mockResolvedValue({ rootId: id, state: "deleting" });
  const resolvedResult12 = await GET(request("GET"), context);
  expect(await resolvedResult12.json()).toEqual({
    rootId: id,
    status: "pending",
  });
  expect(mocks.remove).not.toHaveBeenCalled();
});
