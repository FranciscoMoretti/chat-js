import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enabled: vi.fn(),
  principal: vi.fn(),
  admit: vi.fn(),
  create: vi.fn(),
  settle: vi.fn(),
}));
vi.mock("@/lib/env", () => ({
  env: { APP_URL: "http://localhost:3790" },
}));
vi.mock("@/lib/eve/availability", () => ({ isEveEnabled: mocks.enabled }));
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

import { POST } from "./route";

const input = {
  operationId: "00000000-0000-4000-8000-000000000001",
  message: "hello",
  modelId: "cheap",
};

function request() {
  return new Request("http://localhost:3790/api/agent-conversations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3790",
    },
    body: JSON.stringify(input),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.enabled.mockReturnValue(true);
  mocks.principal.mockResolvedValue({
    kind: "guest",
    ownerId: "guest",
    tokenHash: "hash",
  });
  mocks.admit.mockResolvedValue({
    status: "replay",
    reservationId: "reservation",
  });
});

test("keeps a terminal creation response ambiguous when its refund is refused", async () => {
  mocks.create.mockResolvedValue(
    Response.json(
      { error: "terminal", creationRejected: true },
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

test("preserves authoritative deletion when its committed quota cannot be refunded", async () => {
  mocks.create.mockResolvedValue(
    Response.json(
      {
        error: "This conversation has been deleted.",
        creationRejected: true,
        code: "conversation_deleted",
      },
      { status: 404 }
    )
  );
  mocks.settle.mockResolvedValue(false);

  const response = await POST(request());

  expect(response.status).toBe(404);
  expect(await response.json()).toMatchObject({
    creationRejected: true,
    code: "conversation_deleted",
  });
});
