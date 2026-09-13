import { beforeEach, expect, test, vi } from "vitest";

import { GET } from "./[id]/route";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  admit: vi.fn(),
  create: vi.fn(),
  enabled: vi.fn(),
  get: vi.fn(),
  principal: vi.fn(),
}));
vi.mock("@/lib/eve/principal", () => ({
  resolveEvePrincipal: mocks.principal,
}));
vi.mock("@/lib/eve/guest-group-admission", () => ({
  admitGuestResponseGroup: mocks.admit,
}));
vi.mock("@/lib/env", () => ({ env: { APP_URL: "http://localhost:3790" } }));
vi.mock("@/lib/eve/availability", () => ({ isEveEnabled: mocks.enabled }));
vi.mock("@/lib/eve/response-group", () => ({
  createEveResponseGroup: mocks.create,
}));
vi.mock("@/lib/db/eve-response-groups", () => ({
  getEveResponseGroup: mocks.get,
}));

const input = {
  message: "Compare",
  modelIds: ["a", "b"],
  operationId: "00000000-0000-4000-8000-000000000001",
};
const request = (origin = "http://localhost:3790") =>
  new Request("http://localhost:3790/api/agent-response-groups", {
    body: JSON.stringify(input),
    headers: { origin },
    method: "POST",
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.enabled.mockReturnValue(true);
  mocks.principal.mockResolvedValue({ kind: "registered", ownerId: "owner" });
  mocks.create.mockResolvedValue({ candidates: [], id: input.operationId });
});
test("authenticates and checks origin before dispatching with server-owned identity", async () => {
  const resolvedResult1 = await POST(request("https://foreign.invalid"));
  expect(resolvedResult1.status).toBe(403);
  expect(mocks.create).not.toHaveBeenCalled();
  const resolvedResult2 = await POST(request());
  expect(resolvedResult2.status).toBe(200);
  expect(mocks.create).toHaveBeenCalledExactlyOnceWith(
    "owner",
    input,
    undefined
  );
});
test("unauthenticated or disabled requests cannot create groups", async () => {
  mocks.principal.mockResolvedValue(null);
  const resolvedResult3 = await POST(request());
  expect(resolvedResult3.status).toBe(401);
  mocks.enabled.mockReturnValue(false);
  const resolvedResult4 = await POST(request());
  expect(resolvedResult4.status).toBe(404);
  expect(mocks.create).not.toHaveBeenCalled();
});
test("reads only through the authenticated owner's scope and does not cache bindings", async () => {
  const params = Promise.resolve({ id: input.operationId });
  const resolvedResult5 = await GET(request(), { params });
  expect(resolvedResult5.status).toBe(404);
  expect(mocks.get).toHaveBeenCalledWith("owner", input.operationId);
  mocks.get.mockResolvedValue({ candidates: [], id: input.operationId });
  const resolvedResult6 = await GET(request(), { params });
  expect(resolvedResult6.headers.get("cache-control")).toBe(
    "private, no-store"
  );
});

test("guest comparisons cannot dispatch without successful batch admission", async () => {
  mocks.principal.mockResolvedValue({
    kind: "guest",
    ownerId: "guest",
    tokenHash: "hash",
  });
  mocks.admit.mockResolvedValue(new Response(null, { status: 429 }));
  const resolvedResult7 = await POST(request());
  expect(resolvedResult7.status).toBe(429);
  expect(mocks.create).not.toHaveBeenCalled();
  const reservations = [
    { operationId: input.operationId, reservationId: "quota" },
  ];
  mocks.admit.mockResolvedValue(reservations);
  const resolvedResult8 = await POST(request());
  expect(resolvedResult8.status).toBe(200);
  expect(mocks.create).toHaveBeenCalledExactlyOnceWith(
    "guest",
    input,
    reservations
  );
  await GET(request(), { params: Promise.resolve({ id: input.operationId }) });
  expect(mocks.get).toHaveBeenCalledWith("guest", input.operationId);
});
