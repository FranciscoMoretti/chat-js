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
  admit: vi.fn(),
  after: vi.fn<(callback: () => void | Promise<void>) => void>(),
  create: vi.fn(),
  get: vi.fn(),
  persistTitle: vi.fn(),
  principal: vi.fn(),
}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/eve/principal", () => ({
  resolveEvePrincipal: mocks.principal,
}));
vi.mock("@/lib/eve/guest-group-admission", () => ({
  admitGuestResponseGroup: mocks.admit,
}));
vi.mock("@/lib/env", () => ({ env: { APP_URL: "http://localhost:3790" } }));
vi.mock("@/lib/eve/response-group", () => ({
  createEveResponseGroup: mocks.create,
}));
vi.mock("@/lib/eve/conversation-title", () => ({
  persistGeneratedEveConversationTitle: mocks.persistTitle,
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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable no-undefined -- Assert the omitted optional third argument in the adapter call explicitly. */
test("authenticates and checks origin before dispatching with server-owned identity", async () => {
  const resolvedResult1 = await POST(request("https://foreign.invalid"));
  expect(resolvedResult1.status).toBe(HTTP_STATUS.forbidden);
  expect(mocks.create).not.toHaveBeenCalled();
  const resolvedResult2 = await POST(request());
  expect(resolvedResult2.status).toBe(HTTP_STATUS.ok);
  expect(mocks.create).toHaveBeenCalledExactlyOnceWith(
    "owner",
    input,
    undefined
  );
});
/* oxlint-enable no-undefined */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable unicorn/no-null -- The principal mock uses null for the unauthenticated state. */
test("unauthenticated requests cannot create groups", async () => {
  mocks.principal.mockResolvedValue(null);
  const resolvedResult3 = await POST(request());
  expect(resolvedResult3.status).toBe(HTTP_STATUS.unauthorized);
});
/* oxlint-enable unicorn/no-null */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */

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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable max-statements, unicorn/no-null -- Keep this ordered admission and response contract together; Response(null) models an empty upstream rejection body. */
test("guest comparisons cannot dispatch without successful batch admission", async () => {
  mocks.principal.mockResolvedValue({
    kind: "guest",
    ownerId: "guest",
    tokenHash: "hash",
  });
  mocks.admit.mockResolvedValue(
    new Response(null, { status: HTTP_STATUS.tooManyRequests })
  );
  const resolvedResult7 = await POST(request());
  expect(resolvedResult7.status).toBe(HTTP_STATUS.tooManyRequests);
  expect(mocks.create).not.toHaveBeenCalled();
  const reservations = [
    { operationId: input.operationId, reservationId: "quota" },
  ];
  mocks.admit.mockResolvedValue(reservations);
  const resolvedResult8 = await POST(request());
  expect(resolvedResult8.status).toBe(HTTP_STATUS.ok);
  expect(mocks.create).toHaveBeenCalledExactlyOnceWith(
    "guest",
    input,
    reservations
  );
  await GET(request(), { params: Promise.resolve({ id: input.operationId }) });
  expect(mocks.get).toHaveBeenCalledWith("guest", input.operationId);
});
/* oxlint-enable max-statements, unicorn/no-null */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */

test("schedules one title generation for an initial comparison chat", async () => {
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
  expect(mocks.persistTitle).toHaveBeenCalledWith({
    conversationId: "00000000-0000-4000-8000-000000000002",
    message: "Compare",
    ownerId: "owner",
  });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */

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
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
/* oxlint-enable oxc/no-async-await */
