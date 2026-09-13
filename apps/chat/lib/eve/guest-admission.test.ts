import { beforeEach, expect, it, vi } from "vitest";
import {
  admitGuestCreation,
  guestRequestIpHash,
  settleGuestCreation,
} from "./guest-admission";

const mocks = vi.hoisted(() => ({
  source: vi.fn(),
  creation: vi.fn(),
  reserve: vi.fn(),
  commit: vi.fn(),
  release: vi.fn(),
  files: vi.fn(),
  env: { NODE_ENV: "development", VERCEL_URL: "", AUTH_SECRET: "fixture" },
}));
vi.mock("../env", () => ({ env: mocks.env }));
vi.mock("../types/anonymous", () => ({
  ANONYMOUS_LIMITS: {
    AVAILABLE_MODELS: ["cheap"],
    AVAILABLE_TOOLS: [],
    CREDITS: 10,
    SESSION_DURATION: 60_000,
    RATE_LIMIT: { REQUESTS_PER_MINUTE: 5, REQUESTS_PER_MONTH: 10 },
  },
}));
vi.mock("../db/eve-guests", () => ({
  reserveEveGuestMessage: mocks.reserve,
  commitEveGuestMessage: mocks.commit,
  releaseEveGuestMessage: mocks.release,
}));
vi.mock("../db/eve-queries", () => ({
  getEveConversation: mocks.source,
  getEveCreation: mocks.creation,
}));
vi.mock("../db/eve-files", () => ({ assertEveFilesOwned: mocks.files }));
vi.mock("./model-selection", () => ({ loadEveModelDefinition: vi.fn() }));
const HASH = /^[0-9a-f]{64}$/;
const principal = {
  kind: "guest",
  ownerId: "guest",
  tokenHash: "a".repeat(64),
  state: "pending",
} as const;
const input = {
  modelId: "cheap",
  operationId: crypto.randomUUID(),
  message: "hello",
};
const request = new Request("http://localhost/api/agent-conversations");
beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.NODE_ENV = "development";
  mocks.env.VERCEL_URL = "";
  mocks.source.mockResolvedValue(undefined);
  mocks.creation.mockResolvedValue(undefined);
  mocks.files.mockResolvedValue(undefined);
  mocks.reserve.mockResolvedValue({
    status: "reserved",
    reservationId: "attempt",
  });
});

it("does not trust arbitrary forwarded headers or alternate IP spellings for quota", () => {
  const forged = new Request(request, {
    headers: { "x-vercel-forwarded-for": "192.0.2.1" },
  });
  expect(guestRequestIpHash(forged)).toBe(guestRequestIpHash(request));
  mocks.env.NODE_ENV = "production";
  expect(() => guestRequestIpHash(forged)).toThrow("Trusted client address");
  mocks.env.VERCEL_URL = "app.vercel.app";
  const digest = (address: string) =>
    guestRequestIpHash(
      new Request(request, { headers: { "x-vercel-forwarded-for": address } })
    );
  expect(digest("2001:0DB8:0:0:0:0:0:1")).toBe(digest("2001:db8::1"));
  expect(digest("::ffff:192.0.2.1")).toBe(digest("192.0.2.1"));
  expect(() => digest("192.0.2.1, 192.0.2.2")).toThrow();
  expect(() => digest("fe80::1%eth0")).toThrow();
});

it("checks guest policy and ownership before reserving account/quota", async () => {
  const denied = await admitGuestCreation(request, principal, {
    ...input,
    modelId: "premium",
  });
  expect(denied).toBeInstanceOf(Response);
  expect(mocks.reserve).not.toHaveBeenCalled();
  expect(
    await admitGuestCreation(request, principal, {
      ...input,
      fork: { conversationId: crypto.randomUUID(), beforeTurnId: "turn_0" },
    })
  ).toBeInstanceOf(Response);
  expect(mocks.reserve).not.toHaveBeenCalled();
  mocks.files.mockRejectedValue(new Error("not owned"));
  expect(await admitGuestCreation(request, principal, input)).toBeInstanceOf(
    Response
  );
  expect(mocks.reserve).not.toHaveBeenCalled();
});

it("binds quota to the complete creation intent and retains native operation replays", async () => {
  expect(await admitGuestCreation(request, principal, input)).toEqual({
    status: "reserved",
    reservationId: "attempt",
  });
  expect(mocks.reserve).toHaveBeenCalledWith(
    expect.objectContaining({
      ownerId: "guest",
      operationId: input.operationId,
      requestHash: expect.stringMatching(HASH),
      requestsPerMinute: 5,
    }),
    expect.objectContaining({
      tokenHash: principal.tokenHash,
      messageLimit: 10,
    })
  );
  mocks.reserve.mockResolvedValue({
    status: "replay",
    reservationId: "attempt",
  });
  expect(await admitGuestCreation(request, principal, input)).toEqual({
    status: "replay",
    reservationId: "attempt",
  });
});

it("refunds only explicit rejection, keeps ambiguous reservations, and commits success", async () => {
  for (const response of [
    new Response(null, { status: 502 }),
    Response.json({ error: "unresolved" }, { status: 409 }),
  ]) {
    await settleGuestCreation(response, "guest", input.operationId, "attempt");
  }
  expect(mocks.release).not.toHaveBeenCalled();
  await settleGuestCreation(
    Response.json({ creationRejected: true }, { status: 400 }),
    "guest",
    input.operationId,
    "attempt"
  );
  expect(mocks.release).toHaveBeenCalledExactlyOnceWith(
    "guest",
    input.operationId,
    "attempt"
  );
  await settleGuestCreation(
    Response.json({ id: "conversation" }),
    "guest",
    input.operationId,
    "attempt"
  );
  expect(mocks.commit).toHaveBeenCalledExactlyOnceWith(
    "guest",
    input.operationId,
    "attempt"
  );
});

it("does not refund an accepted or unresolved operation rejected after deletion", async () => {
  mocks.creation.mockResolvedValue({
    state: "deleted",
    sessionId: "native-session",
  });
  await settleGuestCreation(
    Response.json({ creationRejected: true }, { status: 404 }),
    "guest",
    input.operationId,
    "attempt"
  );
  expect(mocks.release).not.toHaveBeenCalled();
  mocks.creation.mockResolvedValue({ state: "reserved", sessionId: null });
  await settleGuestCreation(
    Response.json({ creationRejected: true }, { status: 409 }),
    "guest",
    input.operationId,
    "attempt"
  );
  expect(mocks.release).not.toHaveBeenCalled();
});
