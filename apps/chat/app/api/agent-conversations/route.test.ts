import { beforeEach, expect, test, vi } from "vitest";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  admit: vi.fn(),
  after: vi.fn(),
  create: vi.fn(),
  persistTitle: vi.fn(),
  principal: vi.fn(),
  settle: vi.fn(),
}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/env", () => ({
  env: { APP_URL: "http://localhost:3790" },
}));
vi.mock("@/lib/eve/principal", () => ({
  resolveEvePrincipal: mocks.principal,
}));
vi.mock("@/lib/eve/guest-admission", () => ({
  admitGuestCreation: mocks.admit,
  settleGuestCreation: mocks.settle,
}));
vi.mock("@/lib/eve/create-conversation-operation", () => ({
  createEveConversationOperation: mocks.create,
}));
vi.mock("@/lib/eve/conversation-title", () => ({
  persistGeneratedEveConversationTitle: mocks.persistTitle,
}));

const input = {
  message: "hello",
  modelId: "cheap",
  operationId: "00000000-0000-4000-8000-000000000001",
};

/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep request's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
const request = () =>
  new Request("http://localhost:3790/api/agent-conversations", {
    body: JSON.stringify(input),
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3790",
    },
    method: "POST",
  });
/* oxlint-enable typescript/explicit-function-return-type */

beforeEach(() => {
  vi.resetAllMocks();
  mocks.principal.mockResolvedValue({
    kind: "guest",
    ownerId: "guest",
    tokenHash: "hash",
  });
  mocks.admit.mockResolvedValue({
    reservationId: "reservation",
    status: "replay",
  });
});

/* oxlint-disable no-magic-numbers, oxc/no-async-await --
 * no-magic-numbers (#517): test("keeps a terminal creation response ambiguous when its refund is refused") uses 503 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("keeps a terminal creation response ambiguous when its refund is refused") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
test("keeps a terminal creation response ambiguous when its refund is refused", async () => {
  mocks.create.mockResolvedValue(
    Response.json(
      { creationRejected: true, error: "terminal" },
      { status: 400 }
    )
  );
  mocks.settle.mockResolvedValue(false);

  const response = await POST(request());

  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    error: "Creation is unresolved. Retry the saved operation to recover it.",
  });
  expect(mocks.settle).toHaveBeenCalledWith(
    expect.any(Response),
    "guest",
    input.operationId,
    "reservation"
  );
});
/* oxlint-enable no-magic-numbers, oxc/no-async-await */

/* oxlint-disable no-magic-numbers, oxc/no-async-await --
 * no-magic-numbers (#517): test("preserves authoritative deletion when its committed quota cannot be refunded") uses 404 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("preserves authoritative deletion when its committed quota cannot be refunded") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
test("preserves authoritative deletion when its committed quota cannot be refunded", async () => {
  mocks.create.mockResolvedValue(
    Response.json(
      {
        code: "conversation_deleted",
        creationRejected: true,
        error: "This conversation has been deleted.",
      },
      { status: 404 }
    )
  );
  mocks.settle.mockResolvedValue(false);

  const response = await POST(request());

  expect(response.status).toBe(404);
  expect(await response.json()).toMatchObject({
    code: "conversation_deleted",
    creationRejected: true,
  });
});
/* oxlint-enable no-magic-numbers, oxc/no-async-await */

/* oxlint-disable no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining --
 * no-magic-numbers (#517): test("defers root title generation until after the creation response") uses 200, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("defers root title generation until after the creation response") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): test("defers root title generation until after the creation response") handles optional mocks.after.mock.calls[0]?.[0]() without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 */
test("defers root title generation until after the creation response", async () => {
  mocks.create.mockResolvedValue(
    Response.json({
      id: "00000000-0000-4000-8000-000000000002",
      sessionId: "session",
    })
  );

  const response = await POST(request());

  expect(response.status).toBe(200);
  expect(mocks.persistTitle).not.toHaveBeenCalled();
  expect(mocks.after).toHaveBeenCalledOnce();
  // oxlint-disable-next-line typescript/no-unsafe-call -- #596: This route fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  await mocks.after.mock.calls[0]?.[0]();
  expect(mocks.persistTitle).toHaveBeenCalledWith({
    conversationId: "00000000-0000-4000-8000-000000000002",
    message: "hello",
    ownerId: "guest",
  });
});
/* oxlint-enable no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining */
