import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  save: vi.fn(),
  creation: vi.fn(),
  enabled: true,
}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("@/lib/db/eve-queries", () => ({ getEveCreation: mocks.creation }));
vi.mock("@/lib/eve/save-copy-operation", () => ({
  saveEveCopyOperation: mocks.save,
}));
vi.mock("@/lib/eve/availability", () => ({
  isEveEnabled: () => mocks.enabled,
}));
vi.mock("@/lib/env", () => ({ env: { APP_URL: "http://localhost:3790" } }));
const input = {
  sourceConversationId: "9d86c472-7b38-458d-9811-55078f3b04dc",
  operationId: "d6b4be57-c67c-4231-b0ac-5a82a873c20a",
  modelId: "google/gemini-2.5-flash-lite",
};
function request(body: unknown = input, origin = "http://localhost:3790") {
  return new Request("http://localhost:3790/api/agent-conversation-copies", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.enabled = true;
  mocks.session.mockResolvedValue({ user: { id: "owner" } });
  mocks.save.mockResolvedValue({ id: input.operationId, sessionId: "native" });
});
it("requires login, same origin and the migration flag before copy work", async () => {
  mocks.enabled = false;
  expect((await POST(request())).status).toBe(404);
  mocks.enabled = true;
  mocks.session.mockResolvedValue(null);
  expect((await POST(request())).status).toBe(401);
  mocks.session.mockResolvedValue({ user: { id: "owner" } });
  expect((await POST(request(input, "https://foreign.example"))).status).toBe(
    403
  );
  expect(mocks.save).not.toHaveBeenCalled();
});
it("rejects browser seeds, execution controls and oversized bodies", async () => {
  for (const body of [
    { ...input, seed: { messages: [] } },
    { ...input, fork: {} },
    { ...input, sourceSessionId: "private" },
    { ...input, modelId: "x".repeat(3000) },
  ]) {
    expect((await POST(request(body))).status).toBe(400);
  }
  expect(mocks.save).not.toHaveBeenCalled();
});
it("canonicalizes operation coordinates and returns only the owned binding", async () => {
  const response = await POST(
    request({
      ...input,
      sourceConversationId: input.sourceConversationId.toUpperCase(),
      operationId: input.operationId.toUpperCase(),
    })
  );
  expect(response.status).toBe(200);
  expect(mocks.save).toHaveBeenCalledWith(
    "owner",
    input,
    "http://localhost:3790"
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("retains ambiguous operations and exposes only an owned recovery location", async () => {
  mocks.save.mockRejectedValue(new Error("sensitive native failure"));
  mocks.creation.mockResolvedValue({
    id: input.operationId,
    creationKind: "copy",
    state: "uncertain",
  });
  const response = await POST(request());
  expect(response.status).toBe(503);
  const body = await response.json();
  expect(body).toMatchObject({
    retryable: true,
    conversationId: input.operationId,
  });
  expect(JSON.stringify(body)).not.toContain("sensitive");
  expect(mocks.creation).toHaveBeenCalledWith("owner", input.operationId);
});
it("allows discarding the browser request only for a known unavailable operation", async () => {
  mocks.save.mockRejectedValue(new Error("rejected"));
  mocks.creation.mockResolvedValue({
    id: input.operationId,
    creationKind: "copy",
    state: "deleted",
  });
  expect(await (await POST(request())).json()).toMatchObject({
    retryable: false,
  });
  mocks.creation.mockRejectedValue(new Error("database unavailable"));
  expect(await (await POST(request())).json()).toMatchObject({
    retryable: true,
  });
});
