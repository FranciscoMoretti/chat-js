import { afterEach, expect, it, vi } from "vitest";

import { waitForEveCheckpoint } from "./checkpoint-readiness";

const request = vi.hoisted(() => vi.fn());
vi.mock("./server", () => ({ eveRequest: request }));
// Advance the test clock for the server timer while keeping polling sequential.
vi.mock("node:timers/promises", () => ({
  setTimeout: vi.advanceTimersByTimeAsync,
}));
afterEach(() => {
  vi.useRealTimers();
  request.mockReset();
});
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
  await ready;
  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls[0].slice(0, 2)).toEqual([
    "owner",
    "/eve/chat/v1/session/source/checkpoint?beforeTurnId=turn_0",
  ]);
});
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
it("times out without allocating or changing the requested checkpoint", async () => {
  vi.useFakeTimers();
  // oxlint-disable-next-line typescript/promise-function-async -- Every checkpoint poll consumes a fresh Response body, so a static resolved Response cannot be reused; the Promise-only request fixture has no work to await under eslint/require-await.
  request.mockImplementation(() =>
    Promise.resolve(
      Response.json({ code: "checkpoint_not_ready" }, { status: 404 })
    )
  );
  const pending = expect(
    waitForEveCheckpoint("owner", "source", "turn_0")
  ).rejects.toThrow("not ready");
  await pending;
  expect(
    request.mock.calls.every(
      (call: Readonly<(typeof request.mock.calls)[number]>) =>
        call[1] === "/eve/chat/v1/session/source/checkpoint?beforeTurnId=turn_0"
    )
  ).toBe(true);
});

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
});

it.each([
  { checkpointId: crypto.randomUUID() },
  { checkpointId: undefined },
  { ready: false },
])("rejects an invalid named checkpoint receipt %j", async (invalid) => {
  const checkpointId = crypto.randomUUID();
  request.mockResolvedValueOnce(
    Response.json({
      beforeTurnId: "turn_1",
      checkpointId,
      ready: true,
      sessionId: "source",
      ...invalid,
    })
  );
  await expect(
    waitForEveCheckpoint("owner", "source", "turn_1", checkpointId)
  ).rejects.toThrow("Invalid source checkpoint");
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0].slice(0, 2)).toEqual([
    "owner",
    `/eve/chat/v1/session/source/checkpoint/${checkpointId}?beforeTurnId=turn_1`,
  ]);
});

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
