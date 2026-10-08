import { afterEach, expect, it, vi } from "vitest";

import { waitForEveCheckpoint } from "./checkpoint-readiness";

const request = vi.hoisted(() => vi.fn());
vi.mock("./server", () => ({ eveRequest: request }));
afterEach(() => {
  vi.useRealTimers();
  request.mockReset();
});
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("waits through source initialization and verifies exact checkpoint identity") uses 250, 2, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("waits through source initialization and verifies exact checkpoint identity", async () => {
  vi.useFakeTimers();
  request
    .mockResolvedValueOnce(
      Response.json({ code: "checkpoint_not_ready" }, { status: 404 })
    )
    .mockResolvedValueOnce(
      Response.json({
        beforeTurnId: "turn_0",
        ready: true,
        sessionId: "source",
      })
    );
  const ready = waitForEveCheckpoint("owner", "source", "turn_0");
  await vi.advanceTimersByTimeAsync(250);
  await ready;
  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls[0].slice(0, 2)).toEqual([
    "owner",
    "/eve/chat/v1/session/source/checkpoint?beforeTurnId=turn_0",
  ]);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("does not accept an unrelated source receipt or a generic not found") uses 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("does not accept an unrelated source receipt or a generic not found", async () => {
  request.mockResolvedValueOnce(
    Response.json({ beforeTurnId: "turn_0", ready: true, sessionId: "other" })
  );
  await expect(
    waitForEveCheckpoint("owner", "source", "turn_0")
  ).rejects.toThrow("Invalid source checkpoint");
  request.mockResolvedValueOnce(
    Response.json({ error: "Unknown route" }, { status: 404 })
  );
  await expect(
    waitForEveCheckpoint("owner", "source", "turn_0")
  ).rejects.toThrow("lookup is unavailable");
  expect(request).toHaveBeenCalledTimes(2);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */
/* oxlint-disable no-magic-numbers, typescript/promise-function-async --
 * no-magic-numbers (#517): it("times out without allocating or changing the requested checkpoint") uses 15_000, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/promise-function-async (#606): it("times out without allocating or changing the requested checkpoint") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
it("times out without allocating or changing the requested checkpoint", async () => {
  vi.useFakeTimers();
  request.mockImplementation(() =>
    Promise.resolve(
      Response.json({ code: "checkpoint_not_ready" }, { status: 404 })
    )
  );
  const pending = expect(
    waitForEveCheckpoint("owner", "source", "turn_0")
  ).rejects.toThrow("not ready");
  await vi.advanceTimersByTimeAsync(15_000);
  await pending;
  expect(
    request.mock.calls.every(
      (call: Readonly<(typeof request.mock.calls)[number]>) =>
        call[1] === "/eve/chat/v1/session/source/checkpoint?beforeTurnId=turn_0"
    )
  ).toBe(true);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, typescript/promise-function-async */

/* oxlint-disable no-magic-numbers, no-undefined --
 * no-magic-numbers (#517): it("requires the exact named checkpoint receipt and never falls back to a turn lookup uses 0, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): it("requires the exact named checkpoint receipt and never falls back to a turn lookup uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
it("requires the exact named checkpoint receipt and never falls back to a turn lookup", async () => {
  const checkpointId = crypto.randomUUID();
  const receipt = {
    beforeTurnId: "turn_1",
    checkpointId,
    ready: true,
    sessionId: "source",
  };
  request.mockResolvedValueOnce(Response.json(receipt));
  await waitForEveCheckpoint("owner", "source", "turn_1", checkpointId);
  expect(request.mock.calls[0].slice(0, 2)).toEqual([
    "owner",
    `/eve/chat/v1/session/source/checkpoint/${checkpointId}?beforeTurnId=turn_1`,
  ]);
  for (const invalid of [
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing receipt own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...receipt, checkpointId: crypto.randomUUID() },
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing receipt own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...receipt, checkpointId: undefined },
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing receipt own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...receipt, ready: false },
  ]) {
    request.mockResolvedValueOnce(Response.json(invalid));
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each case completes before the shared fixture or mock state is reused.
    await expect(
      waitForEveCheckpoint("owner", "source", "turn_1", checkpointId)
    ).rejects.toThrow("Invalid source checkpoint");
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it.each(["source_not_idle", "source_advanced"])'s awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, no-undefined */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it.each(["source_not_idle", "source_advanced"])("recognizes durable named checkpoint  uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it.each(["source_not_idle", "source_advanced"])(
  "recognizes durable named checkpoint rejection %s without polling",
  async (reason) => {
    request.mockResolvedValue(
      Response.json(
        { checkpointRejected: true, error: reason },
        { status: 409 }
      )
    );
    await expect(
      waitForEveCheckpoint("owner", "source", "turn_1", crypto.randomUUID())
    ).rejects.toMatchObject({ reason });
    expect(request).toHaveBeenCalledTimes(1);
  }
);
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it.each([   { checkpointRejected: true, error: "Identity conflict" },   { checkpointRejected: false,'s awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

it.each([
  { checkpointRejected: true, error: "Identity conflict" },
  { checkpointRejected: false, error: "source_advanced" },
  { error: "source_advanced" },
])(
  "keeps generic checkpoint failures ambiguous",
  async (
    body: Readonly<
      | { checkpointRejected: boolean; error: string }
      | { error: string; checkpointRejected?: undefined }
    >
  ) => {
    request.mockResolvedValue(Response.json(body, { status: 409 }));
    await expect(
      waitForEveCheckpoint("owner", "source", "turn_1", crypto.randomUUID())
    ).rejects.toThrow("lookup is unavailable");
  }
);
/* oxlint-enable oxc/no-async-await */
