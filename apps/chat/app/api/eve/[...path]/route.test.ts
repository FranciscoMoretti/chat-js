/* oxlint-disable eslint/sort-keys -- This assertion fixes the durable metadata wire order. */
import { beforeEach, expect, test, vi } from "vitest";

import { EVE_MESSAGE_OPERATION_HEADER } from "@/lib/eve/message-delivery";
import { EveUsageReconciliationBusyError } from "@/lib/eve/usage-reconciliation-busy";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  bound: vi.fn(),
  reserve: vi.fn(),
  rejectAdmission: vi.fn(),
  claim: vi.fn(),
  settle: vi.fn(),
  canSpend: vi.fn(),
  eveRequest: vi.fn(),
  guestAdmission: vi.fn(),
  prepare: vi.fn(),
  principal: vi.fn(),
  reconcile: vi.fn(),
  referenceFiles: vi.fn(),
}));

vi.mock("@/lib/db/queries", () => ({
  reserveEveSubmission: mocks.reserve,
  rejectEveSubmissionAdmission: mocks.rejectAdmission,
  claimEveSubmission: mocks.claim,
  settleEveSubmission: mocks.settle,
}));
vi.mock("@/lib/eve/submission-projection", () => ({
  projectEveSubmissionStream: vi.fn(),
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
  admitGuestMessage: mocks.guestAdmission,
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
/* oxlint-disable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types --
 * typescript/explicit-function-return-type (#560): Keep request's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): request accepts headers: Record<string, string> = {}; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */

beforeEach(() => {
  vi.resetAllMocks();
  mocks.reserve.mockResolvedValue({ state: "pending" });
  mocks.claim.mockResolvedValue(true);
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

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("requires a message operation ID before dispatch") uses 400 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("stamps the validated operation into server-owned durable metadata") uses 202 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("keeps a busy admission retryable without dispatching or rejecting its message") uses 503 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
/* oxlint-enable no-magic-numbers */

// oxlint-disable-next-line no-magic-numbers -- Assert the native explicit non-admission status and its durable classification.
test("records explicit native non-admission without treating interruption as rejection", async () => {
  mocks.eveRequest.mockResolvedValue(
    Response.json({ code: "session_not_active" }, { status: 409 })
  );
  await POST(request({ [EVE_MESSAGE_OPERATION_HEADER]: operationId }), {
    params: Promise.resolve({ path: ["v1", "session", "native"] }),
  });
  expect(mocks.rejectAdmission).toHaveBeenCalledExactlyOnceWith(
    "owner",
    operationId
  );
});

// oxlint-disable-next-line no-magic-numbers -- A replay response describes the original guest reservation, not rejection of that operation.
test("does not mark a concurrent guest reservation replay rejected", async () => {
  mocks.principal.mockResolvedValue({ kind: "guest", ownerId: "owner" });
  mocks.guestAdmission.mockResolvedValue(
    Response.json({ code: "chatjs_message_operation_exists" }, { status: 409 })
  );
  await POST(request({ [EVE_MESSAGE_OPERATION_HEADER]: operationId }), {
    params: Promise.resolve({ path: ["v1", "session", "native"] }),
  });
  expect(mocks.settle).not.toHaveBeenCalled();
  expect(mocks.claim).not.toHaveBeenCalled();
});
