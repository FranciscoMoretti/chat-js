import { beforeEach, expect, it, vi } from "vitest";

import { POST } from "./route";

const HTTP_STATUS = {
  badRequest: 400,
  forbidden: 403,
  ok: 200,
  serviceUnavailable: 503,
  unauthorized: 401,
};

const mocks = vi.hoisted(() => ({
  creation: vi.fn(),
  save: vi.fn(),
  session: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("@/lib/db/eve-queries", () => ({ getEveCreation: mocks.creation }));
vi.mock("@/lib/eve/save-copy-operation", () => ({
  saveEveCopyOperation: mocks.save,
}));
vi.mock("@/lib/env", () => ({ env: { APP_URL: "http://localhost:3790" } }));
const input = {
  modelId: "google/gemini-2.5-flash-lite",
  operationId: "d6b4be57-c67c-4231-b0ac-5a82a873c20a",
  sourceConversationId: "9d86c472-7b38-458d-9811-55078f3b04dc",
};
const request = (
  body: unknown = input,
  origin = "http://localhost:3790"
): Request =>
  new Request("http://localhost:3790/api/agent-conversation-copies", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", origin },
    method: "POST",
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ user: { id: "owner" } });
  mocks.save.mockResolvedValue({ id: input.operationId, sessionId: "native" });
});

it("requires login and same origin before copy work", async () => {
  mocks.session.mockResolvedValue(null);
  const resolvedResult2 = await POST(request());
  expect(resolvedResult2.status).toBe(HTTP_STATUS.unauthorized);
  mocks.session.mockResolvedValue({ user: { id: "owner" } });
  const resolvedResult3 = await POST(request(input, "https://foreign.example"));
  expect(resolvedResult3.status).toBe(HTTP_STATUS.forbidden);
  expect(mocks.save).not.toHaveBeenCalled();
});

it.each([
  { ...input, seed: { messages: [] } },
  { ...input, fork: {} },
  { ...input, sourceSessionId: "private" },
  { ...input, modelId: "x".repeat(3000) },
])(
  "rejects browser seeds, execution controls and oversized bodies: %p",
  async (body) => {
    const resolvedResult4 = await POST(request(body));
    expect(resolvedResult4.status).toBe(HTTP_STATUS.badRequest);
    expect(mocks.save).not.toHaveBeenCalled();
  }
);

it("canonicalizes operation coordinates and returns only the owned binding", async () => {
  const response = await POST(
    request({
      ...input,
      operationId: input.operationId.toUpperCase(),
      sourceConversationId: input.sourceConversationId.toUpperCase(),
    })
  );
  expect(response.status).toBe(HTTP_STATUS.ok);
  expect(mocks.save).toHaveBeenCalledWith(
    "owner",
    input,
    "http://localhost:3790"
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
});

it("decodes a valid copy request across UTF-8 byte boundaries", async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller): void {
      const bytes = new TextEncoder().encode(
        JSON.stringify({ ...input, modelId: "model-ñ" })
      );
      for (const byte of bytes) {
        controller.enqueue(Uint8Array.of(byte));
      }
      controller.close();
    },
  });
  const init = {
    body,
    duplex: "half",
    headers: request().headers,
    method: "POST",
  };
  const response = await POST(new Request(request().url, init));
  expect(response.status).toBe(HTTP_STATUS.ok);
  expect(mocks.save).toHaveBeenCalledWith(
    "owner",
    { ...input, modelId: "model-ñ" },
    "http://localhost:3790"
  );
  expect(body.locked).toBe(false);
});

it("cancels an oversized streamed request before reading another chunk", async () => {
  const cancel = vi.fn();
  let chunksRead = 0;
  const body = new ReadableStream<Uint8Array>(
    {
      cancel,
      pull(controller): void {
        chunksRead += 1;
        controller.enqueue(new Uint8Array(2049));
      },
    },
    { highWaterMark: 0 }
  );
  const init = {
    body,
    duplex: "half",
    headers: request().headers,
    method: "POST",
  };
  const response = await POST(new Request(request().url, init));
  expect(response.status).toBe(HTTP_STATUS.badRequest);
  expect(chunksRead).toBe(1);
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(body.locked).toBe(false);
  expect(mocks.save).not.toHaveBeenCalled();
});

it("releases a failed request stream and rejects its partial JSON", async () => {
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller): void {
        controller.error(new Error("Disconnected"));
      },
    },
    { highWaterMark: 0 }
  );
  const init = {
    body,
    duplex: "half",
    headers: request().headers,
    method: "POST",
  };
  const response = await POST(new Request(request().url, init));
  expect(response.status).toBe(HTTP_STATUS.badRequest);
  expect(body.locked).toBe(false);
  expect(mocks.save).not.toHaveBeenCalled();
});

it("retains ambiguous operations and exposes only an owned recovery location", async () => {
  mocks.save.mockRejectedValue(new Error("sensitive native failure"));
  mocks.creation.mockResolvedValue({
    creationKind: "copy",
    id: input.operationId,
    state: "uncertain",
  });
  const response = await POST(request());
  expect(response.status).toBe(HTTP_STATUS.serviceUnavailable);
  const body: unknown = await response.json();
  expect(body).toMatchObject({
    conversationId: input.operationId,
    retryable: true,
  });
  expect(JSON.stringify(body)).not.toContain("sensitive");
  expect(mocks.creation).toHaveBeenCalledWith("owner", input.operationId);
});

it("allows discarding the browser request only for a known unavailable operation", async () => {
  mocks.save.mockRejectedValue(new Error("rejected"));
  mocks.creation.mockResolvedValue({
    creationKind: "copy",
    id: input.operationId,
    state: "deleted",
  });
  const resolvedResult5 = await POST(request());
  expect(await resolvedResult5.json()).toMatchObject({
    retryable: false,
  });
  mocks.creation.mockRejectedValue(new Error("database unavailable"));
  const resolvedResult6 = await POST(request());
  expect(await resolvedResult6.json()).toMatchObject({
    retryable: true,
  });
});
