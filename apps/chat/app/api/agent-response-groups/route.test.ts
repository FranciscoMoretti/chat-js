import { beforeEach, expect, test, vi } from "vitest";

import { GET } from "./[id]/route";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  admit: vi.fn(),
  after: vi.fn(),
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
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep request's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
const request = (origin = "http://localhost:3790") =>
  new Request("http://localhost:3790/api/agent-response-groups", {
    body: JSON.stringify(input),
    headers: { origin },
    method: "POST",
  });
/* oxlint-enable typescript/explicit-function-return-type */
beforeEach(() => {
  vi.resetAllMocks();
  mocks.principal.mockResolvedValue({ kind: "registered", ownerId: "owner" });
  mocks.create.mockResolvedValue({ candidates: [], id: input.operationId });
});
/* oxlint-disable no-magic-numbers, no-undefined  --
 * no-magic-numbers (#517): test("authenticates and checks origin before dispatching with server-owned identity") uses 403, 200 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("authenticates and checks origin before dispatching with server-owned identity") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): test("authenticates and checks origin before dispatching with server-owned identity") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
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
/* oxlint-enable no-magic-numbers, no-undefined */
/* oxlint-disable no-magic-numbers, unicorn/no-null  --
 * no-magic-numbers (#517): test("unauthenticated requests cannot create groups") uses 401 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("unauthenticated requests cannot create groups") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * unicorn/no-null (#570): test("unauthenticated requests cannot create groups") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
test("unauthenticated requests cannot create groups", async () => {
  mocks.principal.mockResolvedValue(null);
  const resolvedResult3 = await POST(request());
  expect(resolvedResult3.status).toBe(401);
});
/* oxlint-enable no-magic-numbers, unicorn/no-null */
/* oxlint-disable no-magic-numbers  --
 * no-magic-numbers (#517): test("reads only through the authenticated owner's scope and does not cache bindings" uses 404 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("reads only through the authenticated owner's scope and does not cache bindings" sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
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
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-statements, no-magic-numbers, unicorn/no-null  --
 * max-statements (#512): test("guest comparisons cannot dispatch without successful batch admission") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("guest comparisons cannot dispatch without successful batch admission") uses 429, 200 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("guest comparisons cannot dispatch without successful batch admission") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * unicorn/no-null (#570): test("guest comparisons cannot dispatch without successful batch admission") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable max-statements, no-magic-numbers, unicorn/no-null */

/* oxlint-disable no-magic-numbers  --
 * no-magic-numbers (#517): test("schedules one title generation for an initial comparison chat") uses 200, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("schedules one title generation for an initial comparison chat") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): test("schedules one title generation for an initial comparison chat") handles optional mocks.after.mock.calls[0]?.[0]() without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 */
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

  expect(response.status).toBe(200);
  expect(mocks.after).toHaveBeenCalledOnce();
  // oxlint-disable-next-line typescript/no-unsafe-call -- #596: This route fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  await mocks.after.mock.calls[0]?.[0]();
  expect(mocks.persistTitle).toHaveBeenCalledWith({
    conversationId: "00000000-0000-4000-8000-000000000002",
    message: "Compare",
    ownerId: "owner",
  });
});
/* oxlint-enable no-magic-numbers */

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
