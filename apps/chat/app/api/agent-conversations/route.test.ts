import { beforeEach, expect, test, vi } from "vitest";

import { POST } from "./route";

const HTTP_STATUS = {
  badRequest: 400,
  notFound: 404,
  ok: 200,
  serviceUnavailable: 503,
};

const mocks = vi.hoisted(() => ({
  admit: vi.fn(),
  after: vi.fn<(callback: () => void | Promise<void>) => void>(),
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

const request = (): Request =>
  new Request("http://localhost:3790/api/agent-conversations", {
    body: JSON.stringify(input),
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3790",
    },
    method: "POST",
  });
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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */

test("keeps a terminal creation response ambiguous when its refund is refused", async () => {
  mocks.create.mockResolvedValue(
    Response.json(
      { creationRejected: true, error: "terminal" },
      { status: HTTP_STATUS.badRequest }
    )
  );
  mocks.settle.mockResolvedValue(false);

  const response = await POST(request());

  expect(response.status).toBe(HTTP_STATUS.serviceUnavailable);
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */

test("preserves authoritative deletion when its committed quota cannot be refunded", async () => {
  mocks.create.mockResolvedValue(
    Response.json(
      {
        code: "conversation_deleted",
        creationRejected: true,
        error: "This conversation has been deleted.",
      },
      { status: HTTP_STATUS.notFound }
    )
  );
  mocks.settle.mockResolvedValue(false);

  const response = await POST(request());

  expect(response.status).toBe(HTTP_STATUS.notFound);
  expect(await response.json()).toMatchObject({
    code: "conversation_deleted",
    creationRejected: true,
  });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */

test("defers root title generation until after the creation response", async () => {
  mocks.create.mockResolvedValue(
    Response.json({
      id: "00000000-0000-4000-8000-000000000002",
      sessionId: "session",
    })
  );

  const response = await POST(request());

  expect(response.status).toBe(HTTP_STATUS.ok);
  expect(mocks.persistTitle).not.toHaveBeenCalled();
  expect(mocks.after).toHaveBeenCalledOnce();
  const [[afterResponseCallback]] = mocks.after.mock.calls;
  await afterResponseCallback();
  expect(mocks.persistTitle).toHaveBeenCalledWith({
    conversationId: "00000000-0000-4000-8000-000000000002",
    message: "hello",
    ownerId: "guest",
  });
});
/* oxlint-enable oxc/no-async-await */
