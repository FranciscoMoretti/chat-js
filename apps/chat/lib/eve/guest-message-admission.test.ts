import {
  admitGuestMessage,
  settleGuestMessage,
} from "./guest-message-admission";
import { beforeEach, expect, it, vi } from "vitest";
import { EVE_MESSAGE_OPERATION_HEADER } from "./message-delivery";
import { randomUUID } from "node:crypto";
import type { reserveEveGuestMessage } from "@/lib/db/eve-guests";

const mocks = vi.hoisted(() => ({
  commit: vi.fn(),
  release: vi.fn(),
  reserve: vi.fn<typeof reserveEveGuestMessage>(),
}));
vi.mock("../db/eve-guests", () => ({
  commitEveGuestMessage: mocks.commit,
  releaseEveGuestMessage: mocks.release,
  reserveEveGuestMessage: mocks.reserve,
}));
vi.mock("./guest-admission", () => ({
  guestRequestIpHash: (): string => "a".repeat(64),
}));
vi.mock("../types/anonymous", () => ({
  ANONYMOUS_LIMITS: {
    AVAILABLE_MODELS: ["cheap"],
    AVAILABLE_TOOLS: [],
    RATE_LIMIT: { REQUESTS_PER_MINUTE: 5, REQUESTS_PER_MONTH: 10 },
  },
}));
const input = { message: "hello", modelId: "cheap" };
const admission = {
  operationId: randomUUID(),
  reservationId: randomUUID(),
};
const request = new Request("http://localhost/api/eve/v1/session/native", {
  headers: { [EVE_MESSAGE_OPERATION_HEADER]: admission.operationId },
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.reserve.mockResolvedValue({
    reservationId: admission.reservationId,
    status: "reserved",
  });
});

it("requires an explicit operation and allowed model before charging", async () => {
  const missing = await admitGuestMessage(
    new Request(request.url),
    "owner",
    "native",
    input
  );
  expect(missing).toBeInstanceOf(Response);
  expect(mocks.reserve).not.toHaveBeenCalled();
  expect(
    await admitGuestMessage(request, "owner", "native", {
      ...input,
      modelId: "premium",
    })
  ).toBeInstanceOf(Response);
  expect(mocks.reserve).not.toHaveBeenCalled();
});
it("permits dispatch only for the first reservation and never marks replays as unsent", async () => {
  expect(await admitGuestMessage(request, "owner", "native", input)).toEqual(
    admission
  );
  const repeatedResults: Awaited<ReturnType<typeof reserveEveGuestMessage>>[] =
    [
      { reservationId: admission.reservationId, status: "replay" },
      { status: "conflict" },
    ];
  for (const result of repeatedResults) {
    mocks.reserve.mockResolvedValue(result);
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each case reconfigures the shared reserve mock or reads its lastCall hash; finish admission and JSON assertions before reusing that mutable fixture.
    const repeated = await admitGuestMessage(request, "owner", "native", input);
    expect(repeated).toBeInstanceOf(Response);
    if (!(repeated instanceof Response)) {
      throw new Error("Expected reconnect response");
    }
    expect(repeated.status).toBe(409);
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each case reconfigures the shared reserve mock or reads its lastCall hash; finish admission and JSON assertions before reusing that mutable fixture.
    expect(await repeated.json()).toMatchObject({
      code: "chatjs_message_operation_exists",
    });
  }
});

it("distinguishes content and destination in quota identity", async () => {
  const hashes: unknown[] = [];
  for (const [sessionId, message] of [
    ["one", "hello"],
    ["two", "hello"],
    ["one", "changed"],
  ]) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each case reconfigures the shared reserve mock or reads its lastCall hash; finish admission and JSON assertions before reusing that mutable fixture.
    await admitGuestMessage(request, "owner", sessionId, { ...input, message });
    hashes.push(mocks.reserve.mock.lastCall?.[0].requestHash);
  }
  expect(new Set(hashes).size).toBe(3);
});

it("retains quota on timeout/server failure and refunds only explicit native non-admission", async () => {
  await settleGuestMessage(
    new Response(null, { status: 502 }),
    "owner",
    admission
  );
  await settleGuestMessage(
    Response.json({ error: "unknown" }, { status: 409 }),
    "owner",
    admission
  );
  expect(mocks.release).not.toHaveBeenCalled();
  await settleGuestMessage(
    Response.json({ code: "session_not_active" }, { status: 409 }),
    "owner",
    admission
  );
  expect(mocks.release).toHaveBeenCalledExactlyOnceWith(
    "owner",
    admission.operationId,
    admission.reservationId
  );
  await settleGuestMessage(
    new Response(null, { status: 202 }),
    "owner",
    admission
  );
  expect(mocks.commit).toHaveBeenCalledExactlyOnceWith(
    "owner",
    admission.operationId,
    admission.reservationId
  );
});
