import { beforeEach, expect, test, vi } from "vitest";

import { GET } from "./[id]/route";
import { POST } from "./route";

const HTTP_STATUS = {
  forbidden: 403,
  notFound: 404,
  ok: 200,
  tooManyRequests: 429,
  unauthorized: 401,
};

const mocks = vi.hoisted(() => ({
  after: vi.fn<(callback: () => void | Promise<void>) => void>(),
  create: vi.fn(),
  get: vi.fn(),
  afterCreate: vi.fn(),
  principal: vi.fn(),
}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/eve/principal", () => ({
  resolveEvePrincipal: mocks.principal,
}));
vi.mock("@/lib/env", () => ({ env: { APP_URL: "http://localhost:3790" } }));
vi.mock("@/lib/eve/response-group", () => ({
  createEveResponseGroup: mocks.create,
}));
vi.mock("@/lib/chat-after-create", () => ({
  runChatAfterCreate: mocks.afterCreate,
}));
vi.mock("@/lib/db/eve-response-groups", () => ({
  getEveResponseGroup: mocks.get,
}));

const input = {
  message: "Compare",
  modelIds: ["a", "b"],
  operationId: "00000000-0000-4000-8000-000000000001",
};
const request = (origin = "http://localhost:3790"): Request =>
  new Request("http://localhost:3790/api/agent-response-groups", {
    body: JSON.stringify(input),
    headers: { origin },
    method: "POST",
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.principal.mockResolvedValue({ kind: "registered", ownerId: "owner" });
  mocks.create.mockResolvedValue({ candidates: [], id: input.operationId });
});

test("authenticates and checks origin before dispatching with server-owned identity", async () => {
  const resolvedResult1 = await POST(request("https://foreign.invalid"));
  expect(resolvedResult1.status).toBe(HTTP_STATUS.forbidden);
  expect(mocks.create).not.toHaveBeenCalled();
  const resolvedResult2 = await POST(request());
  expect(resolvedResult2.status).toBe(HTTP_STATUS.ok);
  expect(mocks.create).toHaveBeenCalledOnce();
  expect(mocks.create).toHaveBeenCalledWith("owner", input);
});

test("unauthenticated requests cannot create groups", async () => {
  mocks.principal.mockResolvedValue(null);
  const resolvedResult3 = await POST(request());
  expect(resolvedResult3.status).toBe(HTTP_STATUS.unauthorized);
});

test("reads only through the authenticated owner's scope and does not cache bindings", async () => {
  const params = Promise.resolve({ id: input.operationId });
  const resolvedResult5 = await GET(request(), { params });
  expect(resolvedResult5.status).toBe(HTTP_STATUS.notFound);
  expect(mocks.get).toHaveBeenCalledWith("owner", input.operationId);
  mocks.get.mockResolvedValue({ candidates: [], id: input.operationId });
  const resolvedResult6 = await GET(request(), { params });
  expect(resolvedResult6.headers.get("cache-control")).toBe(
    "private, no-store"
  );
});

test("schedules one plugin work for an initial comparison chat", async () => {
  mocks.create.mockResolvedValue({
    candidates: [
      {
        conversationId: "00000000-0000-4000-8000-000000000002",
        modelId: "a",
        operationId: input.operationId,
        sessionId: "session-a",
        state: "bound",
      },
      {
        conversationId: "00000000-0000-4000-8000-000000000003",
        modelId: "b",
        operationId: "00000000-0000-4000-8000-000000000004",
        sessionId: "session-b",
        state: "bound",
      },
    ],
    id: input.operationId,
  });

  const response = await POST(request());

  expect(response.status).toBe(HTTP_STATUS.ok);
  expect(mocks.after).toHaveBeenCalledOnce();
  const [[afterResponseCallback]] = mocks.after.mock.calls;
  await afterResponseCallback();
  expect(mocks.afterCreate).toHaveBeenCalledWith({
    conversationId: "00000000-0000-4000-8000-000000000002",
    message: "Compare",
    ownerId: "owner",
  });
});

test("does not retitle a forked comparison chat", async () => {
  mocks.create.mockResolvedValue({
    candidates: [
      {
        conversationId: "00000000-0000-4000-8000-000000000002",
        modelId: "a",
        operationId: input.operationId,
        sessionId: "session-a",
        state: "bound",
      },
    ],
    id: input.operationId,
  });
  const forked = new Request(
    "http://localhost:3790/api/agent-response-groups",
    {
      body: JSON.stringify({
        ...input,
        fork: {
          beforeTurnId: "turn_0",
          conversationId: "00000000-0000-4000-8000-000000000005",
        },
        forkKind: "comparison",
      }),
      headers: { origin: "http://localhost:3790" },
      method: "POST",
    }
  );

  await POST(forked);

  expect(mocks.after).not.toHaveBeenCalled();
});
