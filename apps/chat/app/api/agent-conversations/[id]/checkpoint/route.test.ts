import { beforeEach, expect, it, vi } from "vitest";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  principal: vi.fn(),
  read: vi.fn(),
  ready: vi.fn(),
  source: vi.fn(),
}));
vi.mock("@/lib/eve/principal", () => ({
  resolveEvePrincipal: mocks.principal,
}));
vi.mock("@/lib/db/eve-queries", () => ({ getEveConversation: mocks.source }));
vi.mock("@/lib/env", () => ({ env: { APP_URL: "http://localhost:3790" } }));
vi.mock("@/lib/eve/server", () => ({ eveRequest: mocks.capture }));
vi.mock("@/lib/eve/checkpoint-readiness", () => ({
  readEveCheckpoint: mocks.read,
  waitForEveCheckpoint: mocks.ready,
}));
const id = "87c09cfc-acad-4b71-8ff4-e799f383ac98";
const input = {
  beforeTurnId: "turn_1",
  checkpointId: "8f644d88-b2df-48b3-8c25-922e9ba31f30",
};
const context = { params: Promise.resolve({ id }) };
const request = (origin = "http://localhost:3790", body: unknown = input) =>
  new Request(`${origin}/api/agent-conversations/${id}/checkpoint`, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", origin },
    method: "POST",
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.principal.mockResolvedValue({ kind: "registered", ownerId: "owner" });
  mocks.source.mockResolvedValue({
    sessionId: "native-source",
    state: "bound",
  });
  mocks.read.mockResolvedValue(false);
  mocks.capture.mockResolvedValue(
    Response.json({ status: "accepted" }, { status: 202 })
  );
});
it("requires authentication, same origin and bound ownership before native access", async () => {
  mocks.principal.mockResolvedValueOnce(null);
  const resolvedResult1 = await POST(request(), context);
  expect(resolvedResult1.status).toBe(401);
  const resolvedResult2 = await POST(
    request("https://foreign.invalid"),
    context
  );
  expect(resolvedResult2.status).toBe(403);
  expect(mocks.source).not.toHaveBeenCalled();
  mocks.source.mockResolvedValueOnce(undefined);
  const resolvedResult3 = await POST(request(), context);
  expect(resolvedResult3.status).toBe(404);
  expect(mocks.source).toHaveBeenCalledWith("owner", id);
  expect(mocks.capture).not.toHaveBeenCalled();
});
it("rejects malformed coordinates before looking up the source", async () => {
  const resolvedResult4 = await POST(
    request(undefined, { ...input, beforeTurnId: "turn_-1" }),
    context
  );
  expect(resolvedResult4.status).toBe(400);
  expect(mocks.source).not.toHaveBeenCalled();
  expect(mocks.capture).not.toHaveBeenCalled();
});
it("returns readiness only after the matching immutable checkpoint is available", async () => {
  const response = await POST(request(), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({
    conversationId: id,
    ready: true,
    ...input,
  });
  expect(mocks.capture.mock.calls[0].slice(0, 2)).toEqual([
    "owner",
    "/eve/v1/session/native-source/checkpoint",
  ]);
  expect(JSON.parse(mocks.capture.mock.calls[0][2].body)).toEqual(input);
  expect(mocks.ready).toHaveBeenCalledWith(
    "owner",
    "native-source",
    input.beforeTurnId,
    input.checkpointId
  );
});
it("keeps uncertain capture retryable using the exact same coordinates", async () => {
  mocks.ready.mockRejectedValueOnce(new Error("pending"));
  const resolvedResult5 = await POST(request(), context);
  expect(resolvedResult5.status).toBe(409);
  const resolvedResult6 = await POST(request(), context);
  expect(resolvedResult6.status).toBe(200);
  expect(
    mocks.capture.mock.calls.map((call) => JSON.parse(call[2].body))
  ).toEqual([input, input]);
});

it("recovers an existing receipt without sending another native command", async () => {
  mocks.read.mockResolvedValue(true);
  const resolvedResult7 = await POST(request(), context);
  expect(resolvedResult7.status).toBe(200);
  expect(mocks.capture).not.toHaveBeenCalled();
  expect(mocks.ready).not.toHaveBeenCalled();
});

it.each([
  { stage: "read", target: () => mocks.read },
  { stage: "ready", target: () => mocks.ready },
])(
  "returns exact durable rejection coordinates from $stage",
  async ({ stage, target }) => {
    const { CheckpointRejectedError } =
      await import("@/lib/eve/checkpoint-rejection");
    target().mockRejectedValueOnce(
      new CheckpointRejectedError("source_advanced")
    );
    const response = await POST(request(), context);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      checkpointRejected: true,
      conversationId: id,
      reason: "source_advanced",
      ...input,
    });
    if (stage === "read") {
      expect(mocks.capture).not.toHaveBeenCalled();
    }
  }
);
