/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { beforeEach, expect, it, vi } from "vitest";

import {
  admitGuestMessage,
  settleGuestMessage,
} from "./guest-message-admission";
import { EVE_MESSAGE_OPERATION_HEADER } from "./message-delivery";
/* oxlint-enable sort-imports */

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

/* oxlint-disable oxc/no-async-await, oxc/no-rest-spread-properties --
 * oxc/no-async-await (#540): it("requires an explicit operation and allowed model before charging") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it("requires an explicit operation and allowed model before charging") copies or separates ...input while preserving existing object ownership; mutating source objects is not equivalent.
 */
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
/* oxlint-enable oxc/no-async-await, oxc/no-rest-spread-properties */

/* oxlint-disable no-magic-numbers, oxc/no-async-await --
 * no-magic-numbers (#517): it("permits dispatch only for the first reservation and never marks replays as unsent uses 409 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("permits dispatch only for the first reservation and never marks replays as unsent sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
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
/* oxlint-enable no-magic-numbers, oxc/no-async-await */

/* oxlint-disable no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining, oxc/no-rest-spread-properties --
 * no-magic-numbers (#517): it("distinguishes content and destination in quota identity") uses 0, 3 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("distinguishes content and destination in quota identity") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): it("distinguishes content and destination in quota identity") handles optional mocks.reserve.mock.lastCall?.[0].requestHash without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * oxc/no-rest-spread-properties (#543): it("distinguishes content and destination in quota identity") copies or separates ...input while preserving existing object ownership; mutating source objects is not equivalent.
 */
it("distinguishes content and destination in quota identity", async () => {
  const hashes: unknown[] = [];
  for (const [sessionId, message] of [
    ["one", "hello"],
    ["two", "hello"],
    ["one", "changed"],
  ]) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each case completes before the shared fixture or mock state is reused.
    await admitGuestMessage(request, "owner", sessionId, { ...input, message });
    // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This guest-message-admission fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
    hashes.push(mocks.reserve.mock.lastCall?.[0].requestHash);
  }
  expect(new Set(hashes).size).toBe(3);
});
/* oxlint-enable no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining, oxc/no-rest-spread-properties */

/* oxlint-disable oxc/no-async-await, unicorn/no-null --
 * oxc/no-async-await (#540): it("retains quota on timeout/server failure and refunds only explicit native non-admi sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
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
/* oxlint-enable oxc/no-async-await, unicorn/no-null */
