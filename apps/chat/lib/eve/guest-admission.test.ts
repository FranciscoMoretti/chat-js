import {
  admitGuestCreation,
  guestRequestIpHash,
  settleGuestCreation,
} from "./guest-admission";
import { admitGuestResponseGroup } from "./guest-group-admission";
import { beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import type { assertEveFilesOwned } from "../db/eve-files";
import type { loadEveModelDefinition } from "./model-selection";

const mocks = vi.hoisted(() => ({
  commit: vi.fn(),
  env: {
    AUTH_SECRET: "fixture",
    NODE_ENV: "development",
    TRUSTED_CLIENT_IP_HEADER: undefined as string | undefined,
    VERCEL_URL: "",
  },
  existing: vi.fn(),
  files: vi.fn<typeof assertEveFilesOwned>(),
  group: vi.fn(),
  model: vi.fn<typeof loadEveModelDefinition>(),
  release: vi.fn(),
  reserve: vi.fn(),
  source: vi.fn(),
}));
vi.mock("../env", () => ({ env: mocks.env }));
vi.mock("../types/anonymous", () => ({
  ANONYMOUS_LIMITS: {
    AVAILABLE_MODELS: ["cheap", "other-cheap"],
    AVAILABLE_TOOLS: [],
    CREDITS: 10,
    RATE_LIMIT: { REQUESTS_PER_MINUTE: 5, REQUESTS_PER_MONTH: 10 },
    SESSION_DURATION: 60_000,
  },
}));
vi.mock("../db/eve-guests", () => ({
  commitEveGuestMessage: mocks.commit,
  readExistingEveGuestMessage: mocks.existing,
  releaseEveGuestCreation: mocks.release,
  reserveEveGuestMessage: mocks.reserve,
  reserveEveGuestMessages: mocks.group,
}));
vi.mock("../db/eve-response-groups", () => ({
  reserveEveResponseGroupInTransaction: vi.fn(),
}));
vi.mock("../db/eve-queries", () => ({
  getEveConversation: mocks.source,
}));
vi.mock("../db/eve-files", () => ({ assertEveFilesOwned: mocks.files }));
vi.mock("./model-selection", () => ({
  loadEveModelDefinition: mocks.model,
}));
const HASH = /^[0-9a-f]{64}$/u;
const principal = {
  kind: "guest",
  ownerId: "guest",
  state: "pending",
  tokenHash: "a".repeat(64),
} as const;
const input = {
  message: "hello",
  modelId: "cheap",
  operationId: crypto.randomUUID(),
};
const request = new Request("http://localhost/api/agent-conversations");
beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.NODE_ENV = "development";
  mocks.env.VERCEL_URL = "";
  mocks.env.TRUSTED_CLIENT_IP_HEADER = undefined;
  mocks.source.mockResolvedValue(null);
  mocks.existing.mockResolvedValue(null);
  mocks.files.mockResolvedValue();
  mocks.model.mockResolvedValue({
    apiModelId: "cheap",
    context_window: 1000,
    description: "Guest test model",
    id: "cheap",
    input: { audio: false, image: false, pdf: false, text: true, video: false },
    max_tokens: 1000,
    name: "Guest test model",
    object: "model",
    output: { audio: false, image: false, text: true, video: false },
    owned_by: "test",
    pricing: {},
    reasoning: false,
    toolCall: false,
    type: "language",
  });
  mocks.reserve.mockResolvedValue({
    reservationId: "attempt",
    status: "reserved",
  });
  mocks.group.mockResolvedValue({
    admission: { id: input.operationId },
    reservations: [],
    status: "admitted",
  });
});

const requestHash = (value: Readonly<typeof input>): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

it("does not trust arbitrary forwarded headers or alternate IP spellings for quota", () => {
  const forged = new Request(request, {
    headers: { "x-vercel-forwarded-for": "192.0.2.1" },
  });
  expect(guestRequestIpHash(forged)).toBe(guestRequestIpHash(request));
  mocks.env.NODE_ENV = "production";
  expect(() => guestRequestIpHash(forged)).toThrow("Trusted client address");
  mocks.env.VERCEL_URL = "app.vercel.app";
  const digest = (address: string): string =>
    guestRequestIpHash(
      new Request(request, { headers: { "x-vercel-forwarded-for": address } })
    );
  expect(digest("2001:0DB8:0:0:0:0:0:1")).toBe(digest("2001:db8::1"));
  expect(digest("::ffff:192.0.2.1")).toBe(digest("192.0.2.1"));
  expect(() => digest("192.0.2.1, 192.0.2.2")).toThrow();
  expect(() => digest("fe80::1%eth0")).toThrow();
});

it("self-hosted guest quotas use only the configured proxy header", () => {
  mocks.env.NODE_ENV = "production";
  mocks.env.TRUSTED_CLIENT_IP_HEADER = "x-real-ip";
  const headers = {
    "x-forwarded-for": "198.51.100.2",
    "x-real-ip": "192.0.2.1",
  };
  const hash = guestRequestIpHash(new Request(request, { headers }));
  expect(
    guestRequestIpHash(
      new Request(request, {
        headers: { ...headers, "x-forwarded-for": "203.0.113.3" },
      })
    )
  ).toBe(hash);
  expect(() =>
    guestRequestIpHash(
      new Request(request, {
        headers: { "x-forwarded-for": "192.0.2.1" },
      })
    )
  ).toThrow("Trusted client address");
  expect(() =>
    guestRequestIpHash(
      new Request(request, {
        headers: { "x-real-ip": "192.0.2.1, 198.51.100.2" },
      })
    )
  ).toThrow("Trusted client address");
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
      fork: { conversationId: crypto.randomUUID() },
    })
  ).toBeInstanceOf(Response);
  expect(mocks.reserve).not.toHaveBeenCalled();
  mocks.files.mockRejectedValue(new Error("not owned"));
  expect(await admitGuestCreation(request, principal, input)).toBeInstanceOf(
    Response
  );
  expect(mocks.reserve).not.toHaveBeenCalled();
});

it("checks a comparison's shared ownership once and each distinct guest model before reserving", async () => {
  const sourceId = crypto.randomUUID();
  mocks.source.mockResolvedValue({ sessionId: "source", state: "bound" });
  await expect(
    admitGuestResponseGroup(request, principal, {
      fork: { conversationId: sourceId },
      message: input.message,
      modelIds: ["cheap", "other-cheap", "cheap"],
      operationId: input.operationId,
    })
  ).resolves.toEqual({
    group: { id: input.operationId },
    reservations: [],
  });
  expect(mocks.source).toHaveBeenCalledExactlyOnceWith("guest", sourceId);
  expect(mocks.files).toHaveBeenCalledExactlyOnceWith("guest", []);
  expect(mocks.model.mock.calls).toEqual([["cheap"], ["other-cheap"]]);
  expect(mocks.group).toHaveBeenCalledWith(
    [
      expect.objectContaining({
        ipHash: guestRequestIpHash(request),
        ownerId: "guest",
      }),
      expect.objectContaining({
        ipHash: guestRequestIpHash(request),
        ownerId: "guest",
      }),
      expect.objectContaining({
        ipHash: guestRequestIpHash(request),
        ownerId: "guest",
      }),
    ],
    expect.any(Object),
    expect.any(Function)
  );
});

it("does not reserve a comparison when any model, source, or attachment is unavailable", async () => {
  const groupInput = {
    message: input.message,
    modelIds: ["cheap", "premium"],
    operationId: input.operationId,
  };
  expect(
    await admitGuestResponseGroup(request, principal, groupInput)
  ).toBeInstanceOf(Response);
  expect(mocks.model).not.toHaveBeenCalled();
  expect(mocks.group).not.toHaveBeenCalled();

  mocks.model.mockRejectedValueOnce(new Error("model unavailable"));
  expect(
    await admitGuestResponseGroup(request, principal, {
      ...groupInput,
      modelIds: ["other-cheap", "cheap"],
    })
  ).toBeInstanceOf(Response);
  expect(mocks.group).not.toHaveBeenCalled();

  expect(
    await admitGuestResponseGroup(request, principal, {
      ...groupInput,
      modelIds: ["cheap", "cheap"],
      fork: { conversationId: crypto.randomUUID() },
    })
  ).toBeInstanceOf(Response);
  expect(mocks.group).not.toHaveBeenCalled();

  mocks.files.mockRejectedValueOnce(new Error("attachment not owned"));
  expect(
    await admitGuestResponseGroup(request, principal, {
      ...groupInput,
      modelIds: ["cheap", "cheap"],
    })
  ).toBeInstanceOf(Response);
  expect(mocks.group).not.toHaveBeenCalled();
});
it("binds quota to the complete creation intent and retains native operation replays", async () => {
  expect(await admitGuestCreation(request, principal, input)).toEqual({
    reservationId: "attempt",
    status: "reserved",
  });
  const requestHashMatcher: unknown = expect.stringMatching(HASH);
  expect(mocks.reserve).toHaveBeenCalledWith(
    expect.objectContaining({
      operationId: input.operationId,
      ownerId: "guest",
      requestHash: requestHashMatcher,
      requestsPerMinute: 5,
    }),
    expect.objectContaining({
      messageLimit: 10,
      tokenHash: principal.tokenHash,
    })
  );
  mocks.reserve.mockResolvedValue({
    reservationId: "attempt",
    status: "replay",
  });
  expect(await admitGuestCreation(request, principal, input)).toEqual({
    reservationId: "attempt",
    status: "replay",
  });
});
it("recovers an active durable reservation without repeating volatile validation", async () => {
  mocks.existing.mockResolvedValue({
    requestHash: requestHash(input),
    reservationId: "durable",
    state: "committed",
  });
  mocks.model.mockRejectedValue(new Error("catalog unavailable"));
  mocks.files.mockRejectedValue(new Error("files unavailable"));
  expect(await admitGuestCreation(request, principal, input)).toEqual({
    reservationId: "durable",
    status: "replay",
  });
  expect(mocks.model).not.toHaveBeenCalled();
  expect(mocks.files).not.toHaveBeenCalled();
  expect(mocks.reserve).not.toHaveBeenCalled();
});
it("rejects changed replay content before volatile validation", async () => {
  mocks.existing.mockResolvedValue({
    requestHash: requestHash(input),
    reservationId: "durable",
    state: "reserved",
  });
  const response = await admitGuestCreation(request, principal, {
    ...input,
    message: "changed",
  });
  expect(response).toBeInstanceOf(Response);
  if (!(response instanceof Response)) {
    throw new Error("Expected a conflict response.");
  }
  expect(response.status).toBe(409);
  expect(mocks.model).not.toHaveBeenCalled();
  expect(mocks.files).not.toHaveBeenCalled();
  expect(mocks.reserve).not.toHaveBeenCalled();
});

it("runs full validation before reusing a released operation", async () => {
  mocks.existing.mockResolvedValue({
    requestHash: requestHash(input),
    reservationId: "released",
    state: "released",
  });
  expect(await admitGuestCreation(request, principal, input)).toEqual({
    reservationId: "attempt",
    status: "reserved",
  });
  expect(mocks.model).toHaveBeenCalledWith(input.modelId);
  expect(mocks.files).toHaveBeenCalled();
  expect(mocks.reserve).toHaveBeenCalled();
});
it("refunds only explicit rejection, keeps ambiguous reservations, and commits success", async () => {
  await Promise.all(
    [
      new Response(null, { status: 502 }),
      Response.json({ error: "unresolved" }, { status: 409 }),
    ].map(async (response) => {
      await settleGuestCreation(
        response,
        "guest",
        input.operationId,
        "attempt"
      );
    })
  );
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

it("propagates the atomic refund decision when a creation already exists", async () => {
  mocks.release.mockResolvedValue(false);
  expect(
    await settleGuestCreation(
      Response.json({ creationRejected: true }, { status: 404 }),
      "guest",
      input.operationId,
      "attempt"
    )
  ).toBe(false);
  expect(mocks.commit).not.toHaveBeenCalled();
});
