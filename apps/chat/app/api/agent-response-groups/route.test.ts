import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  create: vi.fn(),
  enabled: vi.fn(),
  get: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("@/lib/env", () => ({ env: { APP_URL: "http://localhost:3790" } }));
vi.mock("@/lib/eve/availability", () => ({ isEveEnabled: mocks.enabled }));
vi.mock("@/lib/eve/response-group", () => ({
  createEveResponseGroup: mocks.create,
}));
vi.mock("@/lib/db/eve-response-groups", () => ({
  getEveResponseGroup: mocks.get,
}));

import { GET } from "./[id]/route";
import { POST } from "./route";

const input = {
  operationId: "00000000-0000-4000-8000-000000000001",
  message: "Compare",
  modelIds: ["a", "b"],
};
function request(origin = "http://localhost:3790") {
  return new Request("http://localhost:3790/api/agent-response-groups", {
    method: "POST",
    headers: { origin },
    body: JSON.stringify(input),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.enabled.mockReturnValue(true);
  mocks.session.mockResolvedValue({ user: { id: "owner" } });
  mocks.create.mockResolvedValue({ id: input.operationId, candidates: [] });
});
test("authenticates and checks origin before dispatching with server-owned identity", async () => {
  expect((await POST(request("https://foreign.invalid"))).status).toBe(403);
  expect(mocks.create).not.toHaveBeenCalled();
  expect((await POST(request())).status).toBe(200);
  expect(mocks.create).toHaveBeenCalledExactlyOnceWith("owner", input);
});
test("unauthenticated or disabled requests cannot create groups", async () => {
  mocks.session.mockResolvedValue(null);
  expect((await POST(request())).status).toBe(401);
  mocks.enabled.mockReturnValue(false);
  expect((await POST(request())).status).toBe(404);
  expect(mocks.create).not.toHaveBeenCalled();
});
test("reads only through the authenticated owner's scope and does not cache bindings", async () => {
  const params = Promise.resolve({ id: input.operationId });
  expect((await GET(request(), { params })).status).toBe(404);
  expect(mocks.get).toHaveBeenCalledWith("owner", input.operationId);
  mocks.get.mockResolvedValue({ id: input.operationId, candidates: [] });
  expect((await GET(request(), { params })).headers.get("cache-control")).toBe(
    "private, no-store"
  );
});
