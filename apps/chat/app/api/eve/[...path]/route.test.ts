/* oxlint-disable eslint/max-classes-per-file -- Independent native client and dispatch error doubles. */
import { beforeEach, expect, test, vi } from "vitest";
import type * as EveClient from "eve/client";

import { EVE_MESSAGE_OPERATION_HEADER } from "@/lib/eve/message-delivery";
import { EveUsageReconciliationBusyError } from "@/lib/eve/usage-reconciliation-busy";

import { EveWorkspaceBusyError } from "@/lib/db/eve-workspace-turns";

import { GET, POST } from "./route";

const HTTP_STATUS = {
  accepted: 202,
  badRequest: 400,
  serviceUnavailable: 503,
};

const mocks = vi.hoisted(() => ({
  admit: vi.fn(),
  dispatch: vi.fn(),
  release: vi.fn(),
  bound: vi.fn(),
  canSpend: vi.fn(),
  eveRequest: vi.fn(),
  prepare: vi.fn(),
  principal: vi.fn(),
  reconcile: vi.fn(),
  referenceFiles: vi.fn(),
  snapshot: vi.fn(),
}));

vi.mock("eve/client", async (original) => ({
  ...(await original<typeof EveClient>()),
  Client: class {
    sessions = { attach: () => ({ snapshot: mocks.snapshot }) };
  },
}));
vi.mock("@/lib/eve/connection-options", () => ({
  getEveConnectionOptions: () => ({}),
}));

vi.mock("@/lib/db/eve-dispatch", () => ({
  dispatchEveOnce: async (
    input: unknown,
    dispatch: () => Promise<{ sessionId: string; deliveryId: string }>
  ) => {
    mocks.dispatch(input);
    return await dispatch();
  },
  EveDispatchUnknownError: class extends Error {},
}));
vi.mock("@/integrations/billing", () => ({
  billing: { canSpend: mocks.canSpend, debit: undefined },
}));
vi.mock("@/lib/db/eve-files", () => ({
  referenceEveFiles: mocks.referenceFiles,
}));
vi.mock("@/lib/db/eve-queries", () => ({
  getBoundEveConversationForSession: mocks.bound,
}));
vi.mock("@/lib/env", () => ({ env: { APP_URL: "http://localhost:3790" } }));
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
const request = (
  headers: Readonly<Record<string, string>> = {},
  turnPolicy?: string,
  message: unknown = "original"
): Request =>
  new Request("http://localhost:3790/api/eve/v1/session/native", {
    body: JSON.stringify({
      message,
      modelId: "model",
      selectedTool: "generateImage",
      turnPolicy,
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
      {
        sessionId: "native",
        deliveryId: "accepted-delivery",
        status: "accepted",
      },
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

test("forwards steering through admission for the exact native session", async () => {
  const response = await POST(
    request({ [EVE_MESSAGE_OPERATION_HEADER]: operationId }, "steer"),
    { params: Promise.resolve({ path: ["v1", "session", "native"] }) }
  );

  expect(response.status).toBe(200);
  expect(mocks.canSpend).toHaveBeenCalledExactlyOnceWith("owner");
  expect(mocks.dispatch.mock.calls[0]?.[0]).toMatchObject({
    steerSessionId: "native",
    intent: { turnPolicy: "steer" },
  });
  expect(mocks.eveRequest.mock.calls[0]?.slice(0, 3)).toEqual([
    "owner",
    "/eve/chat/v1/session/native",
    expect.objectContaining({
      body: JSON.stringify({ message: "prepared", turnPolicy: "steer" }),
    }),
  ]);
  expect(mocks.eveRequest.mock.calls[0]?.slice(3)).toEqual([
    undefined,
    undefined,
  ]);
});

test("keeps app correlation out of the native message body", async () => {
  const response = await POST(
    request({ [EVE_MESSAGE_OPERATION_HEADER]: operationId }),
    { params: Promise.resolve({ path: ["v1", "session", "native"] }) }
  );

  expect(response.status).toBe(200);
  expect(mocks.eveRequest).toHaveBeenCalledExactlyOnceWith(
    "owner",
    "/eve/chat/v1/session/native",
    expect.objectContaining({
      body: JSON.stringify({
        message: "prepared",
      }),
      method: "POST",
    }),
    "model",
    "generateImage"
  );
});

test("validates steer attachments against the active model", async () => {
  const events: EveClient.SessionStreamEvent[] = [
    {
      type: "session.started",
      data: {},
      meta: {
        at: "2026-11-23T00:00:00Z",
        position: { line: 0, index: 0 },
        endOfLine: true,
      },
    },
    {
      type: "turn.started",
      data: {
        turnId: "turn-1",
        follows: null,
        cause: { deliveryId: "initial" },
      },
      meta: {
        at: "2026-11-23T00:00:00Z",
        position: { line: 1, index: 0 },
        endOfLine: true,
      },
    },
    {
      type: "model.started",
      data: { modelId: "openai/gpt-5-mini", runId: "run-1", attempt: 0 },
      scope: { turnId: "turn-1", runId: "run-1" },
      meta: {
        at: "2026-11-23T00:00:00Z",
        position: { line: 2, index: 0 },
        endOfLine: true,
      },
    },
  ];
  mocks.snapshot.mockResolvedValue({ events });
  const file = {
    type: "file",
    data: "/api/files/abcdefghijklmnopqrstuvwx.pdf",
    filename: "invoice.pdf",
    mediaType: "application/pdf",
  };
  const headers = { [EVE_MESSAGE_OPERATION_HEADER]: operationId };
  const context = {
    params: Promise.resolve({ path: ["v1", "session", "native"] }),
  };
  const accepted = await POST(request(headers, "steer", [file]), context);
  expect(accepted.status).toBe(200);
  expect(mocks.prepare).toHaveBeenCalledExactlyOnceWith(
    [file],
    "openai/gpt-5-mini"
  );

  mocks.snapshot.mockResolvedValue({ events: events.slice(0, 2) });
  const rejected = await POST(request(headers, "steer", [file]), context);
  expect(rejected.status).toBe(HTTP_STATUS.badRequest);
  expect(await rejected.json()).toMatchObject({
    error: "Wait for the active model before sending attachments.",
  });
  expect(mocks.eveRequest).toHaveBeenCalledTimes(1);
});

test("relays a definite native steer refusal as a rejected message", async () => {
  mocks.eveRequest.mockResolvedValue(
    Response.json(
      {
        ok: false,
        code: "session_not_active",
        error: "The session is no longer active.",
      },
      { status: 409 }
    )
  );
  const response = await POST(
    request({ [EVE_MESSAGE_OPERATION_HEADER]: operationId }, "steer"),
    {
      params: Promise.resolve({ path: ["v1", "session", "native"] }),
    }
  );
  expect(response.status).toBe(HTTP_STATUS.badRequest);
  expect(await response.json()).toMatchObject({
    code: "chatjs_command_rejected",
    error: "The session is no longer active.",
  });
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

vi.mock("@/lib/db/eve-workspace-turns", () => ({
  EveWorkspaceBusyError: vi.fn(),
}));

test.each([true, false])(
  "distinguishes pre-dispatch workspace rejection from transport failure: %s",
  async (busy) => {
    if (busy) {
      mocks.dispatch.mockImplementation(() => {
        throw new EveWorkspaceBusyError();
      });
    } else {
      mocks.eveRequest.mockRejectedValue(new Error("reply lost"));
    }
    const response = await POST(
      request({ [EVE_MESSAGE_OPERATION_HEADER]: operationId }),
      {
        params: Promise.resolve({ path: ["v1", "session", "native"] }),
      }
    );
    expect(response.status).toBe(busy ? 409 : 502);
  }
);
