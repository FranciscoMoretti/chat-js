/* oxlint-disable eslint/sort-keys -- This assertion fixes the durable metadata wire order. */
import { beforeEach, expect, test, vi } from "vitest";

import { EVE_MESSAGE_OPERATION_HEADER } from "@/lib/eve/message-delivery";
import { EveUsageReconciliationBusyError } from "@/lib/eve/usage-reconciliation-busy";

import { POST } from "./route";

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
const request = (headers: Record<string, string> = {}) =>
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
      { headers: { "x-eve-session-id": "native" }, status: 202 }
    )
  );
});

test("requires a message operation ID before dispatch", async () => {
  const response = await POST(request(), {
    params: Promise.resolve({ path: ["v1", "session", "native"] }),
  });

  expect(response.status).toBe(400);
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

  expect(response.status).toBe(202);
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
  expect(response.status).toBe(503);
  expect(response.headers.get("Retry-After")).toBe("2");
  expect(await response.json()).toMatchObject({
    code: "usage_reconciliation_busy",
    retryable: true,
  });
  expect(mocks.eveRequest).not.toHaveBeenCalled();
});
