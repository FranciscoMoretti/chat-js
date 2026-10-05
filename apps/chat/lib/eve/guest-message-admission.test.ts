import { beforeEach, expect, it, vi } from "vitest";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import {
  admitGuestMessage,
  settleGuestMessage,
} from "./guest-message-admission";
/* oxlint-enable sort-imports */
import { EVE_MESSAGE_OPERATION_HEADER } from "./message-delivery";

const mocks = vi.hoisted(() => ({
  commit: vi.fn(),
  release: vi.fn(),
  reserve: vi.fn(),
}));
vi.mock("../db/eve-guests", () => ({
  commitEveGuestMessage: mocks.commit,
  releaseEveGuestMessage: mocks.release,
  reserveEveGuestMessage: mocks.reserve,
}));
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): vi.mock("./guest-admission") uses 64 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
vi.mock("./guest-admission", () => ({
  guestRequestIpHash: (): string => "a".repeat(64),
}));
/* oxlint-enable no-magic-numbers */
vi.mock("../types/anonymous", () => ({
  ANONYMOUS_LIMITS: {
    AVAILABLE_MODELS: ["cheap"],
    AVAILABLE_TOOLS: [],
    RATE_LIMIT: { REQUESTS_PER_MINUTE: 5, REQUESTS_PER_MONTH: 10 },
  },
}));
const input = { message: "hello", modelId: "cheap" };
const admission = {
  operationId: crypto.randomUUID(),
  reservationId: crypto.randomUUID(),
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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...input,
      modelId: "premium",
    })
  ).toBeInstanceOf(Response);
  expect(mocks.reserve).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("permits dispatch only for the first reservation and never marks replays as unsent uses 409 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("permits dispatch only for the first reservation and never marks replays as unsent", async () => {
  expect(await admitGuestMessage(request, "owner", "native", input)).toEqual(
    admission
  );
  for (const status of ["replay", "conflict"]) {
    mocks.reserve.mockResolvedValue({
      reservationId: admission.reservationId,
      status,
    });
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each case completes before the shared fixture or mock state is reused.
    const repeated = await admitGuestMessage(request, "owner", "native", input);
    expect(repeated).toBeInstanceOf(Response);
    if (!(repeated instanceof Response)) {
      throw new Error("Expected reconnect response");
    }
    expect(repeated.status).toBe(409);
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each case completes before the shared fixture or mock state is reused.
    expect(await repeated.json()).toMatchObject({
      code: "chatjs_message_operation_exists",
    });
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("distinguishes content and destination in quota identity") uses 0, 3 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("distinguishes content and destination in quota identity", async () => {
  const hashes: unknown[] = [];
  for (const [sessionId, message] of [
    ["one", "hello"],
    ["two", "hello"],
    ["one", "changed"],
  ]) {
    // oxlint-disable-next-line eslint/no-await-in-loop, oxc/no-rest-spread-properties -- Each case completes before the shared fixture or mock state is reused. Rest/spread: Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    await admitGuestMessage(request, "owner", sessionId, { ...input, message });
    // oxlint-disable-next-line typescript/no-unsafe-member-access, oxc/no-optional-chaining -- #597: This guest-message-admission fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. Optional chain: Keep the existing nullish guard when reading 0 from mocks.reserve.mock.lastCall; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    hashes.push(mocks.reserve.mock.lastCall?.[0].requestHash);
  }
  expect(new Set(hashes).size).toBe(3);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): it("retains quota on timeout/server failure and refunds only explicit native non-admi preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable unicorn/no-null */
