import { beforeEach, expect, test, vi } from "vitest";

import { EVE_MESSAGE_OPERATION_HEADER } from "@/lib/eve/message-delivery";
import { EveUsageReconciliationBusyError } from "@/lib/eve/usage-reconciliation-busy";

import { GET, POST } from "./route";

const HTTP_STATUS = {
  accepted: 202,
  badRequest: 400,
  serviceUnavailable: 503,
};

const mocks = vi.hoisted(() => ({
  bound: vi.fn(),
  canSpend: vi.fn(),
  eveRequest: vi.fn(),
  prepare: vi.fn(),
  principal: vi.fn(),
  reconcile: vi.fn(),
  referenceFiles: vi.fn(),
}));

vi.mock("@/lib/db/credits", () => ({ canSpend: mocks.canSpend }));
vi.mock("@/lib/db/eve-files", () => ({
  referenceEveFiles: mocks.referenceFiles,
}));
vi.mock("@/lib/db/eve-queries", () => ({
  getBoundEveConversationForSession: mocks.bound,
}));
vi.mock("@/lib/env", () => ({ env: { APP_URL: "http://localhost:3790" } }));
vi.mock("@/lib/eve/guest-message-admission", () => ({
  admitGuestMessage: vi.fn(),
  settleGuestMessage: vi.fn(),
}));
vi.mock("@/lib/eve/model-selection", () => ({
  loadEveModelDefinition: vi.fn(),
}));
vi.mock("@/lib/eve/prepare-message", () => ({
  prepareEveMessage: mocks.prepare,
}));
vi.mock("@/lib/eve/principal", () => ({
  resolveEvePrincipal: mocks.principal,
}));
vi.mock("@/lib/eve/reconcile-usage", () => ({
  reconcileEveOwnerUsage: mocks.reconcile,
}));
vi.mock("@/lib/eve/server", () => ({ eveRequest: mocks.eveRequest }));

const operationId = "00000000-0000-4000-8000-000000000001";
const request = (headers: Readonly<Record<string, string>> = {}): Request =>
  new Request("http://localhost:3790/api/eve/v1/session/native", {
    body: JSON.stringify({
      message: "original",
      modelId: "model",
      selectedTool: "createTextDocument",
    }),
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3790",
      ...headers,
    },
    method: "POST",
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.bound.mockResolvedValue({ id: "conversation" });
  mocks.canSpend.mockResolvedValue(true);
  mocks.prepare.mockResolvedValue("prepared");
  mocks.principal.mockResolvedValue({ kind: "registered", ownerId: "owner" });
  mocks.eveRequest.mockResolvedValue(
    Response.json(
      { sessionId: "native", status: "accepted" },
      {
        headers: { "x-eve-session-id": "native" },
        status: HTTP_STATUS.accepted,
      }
    )
  );
});

test("requires a message operation ID before dispatch", async () => {
  const response = await POST(request(), {
    params: Promise.resolve({ path: ["v1", "session", "native"] }),
  });

  expect(response.status).toBe(HTTP_STATUS.badRequest);
  expect(await response.json()).toMatchObject({
    code: "chatjs_command_rejected",
  });
  expect(mocks.eveRequest).not.toHaveBeenCalled();
});

test("stamps the validated operation into server-owned durable metadata", async () => {
  const response = await POST(
    request({ [EVE_MESSAGE_OPERATION_HEADER]: operationId }),
    { params: Promise.resolve({ path: ["v1", "session", "native"] }) }
  );

  expect(response.status).toBe(HTTP_STATUS.accepted);
  expect(mocks.eveRequest).toHaveBeenCalledExactlyOnceWith(
    "owner",
    "/eve/chat/v1/session/native",
    expect.objectContaining({
      body: JSON.stringify({
        message: "prepared",
        messageMetadata: {
          chatjs: {
            selectedTool: "createTextDocument",
            operationId,
          },
        },
      }),
      method: "POST",
    }),
    "model",
    "createTextDocument"
  );
});

test("keeps a busy admission retryable without dispatching or rejecting its message", async () => {
  mocks.reconcile.mockRejectedValue(new EveUsageReconciliationBusyError());
  const response = await POST(
    request({ [EVE_MESSAGE_OPERATION_HEADER]: operationId }),
    {
      params: Promise.resolve({ path: ["v1", "session", "native"] }),
    }
  );
  expect(response.status).toBe(HTTP_STATUS.serviceUnavailable);
  expect(response.headers.get("Retry-After")).toBe("2");
  expect(await response.json()).toMatchObject({
    code: "usage_reconciliation_busy",
    retryable: true,
  });
  expect(mocks.eveRequest).not.toHaveBeenCalled();
});

test("still rejects a known insufficient balance before dispatch", async () => {
  mocks.canSpend.mockResolvedValue(false);
  const response = await POST(
    request({ [EVE_MESSAGE_OPERATION_HEADER]: operationId }),
    {
      params: Promise.resolve({ path: ["v1", "session", "native"] }),
    }
  );
  expect(response.status).toBe(402);
  expect(await response.json()).toMatchObject({
    error: "Insufficient credits",
  });
  expect(mocks.eveRequest).not.toHaveBeenCalled();
});

test("forwards bounded history with the owner and browser cancellation signal", async () => {
  const controller = new AbortController();
  const incoming = new Request(
    "http://localhost:3790/api/eve/v1/session/native/stream?follow=false&startIndex=3&streamControlVersion=1",
    { signal: controller.signal }
  );
  const response = await GET(incoming, {
    params: Promise.resolve({ path: ["v1", "session", "native", "stream"] }),
  });
  expect(response.status).toBe(202);
  expect(mocks.bound).toHaveBeenCalledExactlyOnceWith("owner", "native");
  // oxlint-disable unicorn/no-useless-undefined -- Preserve the five-argument mock contract, including the absent model and selected tool.
  expect(mocks.eveRequest).toHaveBeenCalledExactlyOnceWith(
    "owner",
    "/eve/chat/v1/session/native/stream?follow=false&startIndex=3&streamControlVersion=1",
    expect.objectContaining({ method: "GET", signal: incoming.signal }),
    undefined,
    undefined
  );
  // oxlint-enable unicorn/no-useless-undefined
  expect(mocks.prepare).not.toHaveBeenCalled();
  expect(mocks.canSpend).not.toHaveBeenCalled();
});

test.each([
  "follow=true",
  "follow=0",
  "follow=false&follow=false",
  "startIndex=-1",
  "startIndex=1000000000000",
  "includeTailIndex=0",
  "streamControlVersion=2",
  "unknown=1",
])("rejects unsupported stream query %s before dispatch", async (query) => {
  const response = await GET(
    new Request(
      `http://localhost:3790/api/eve/v1/session/native/stream?${query}`
    ),
    { params: Promise.resolve({ path: ["v1", "session", "native", "stream"] }) }
  );
  expect(response.status).toBe(400);
  expect(mocks.eveRequest).not.toHaveBeenCalled();
});
