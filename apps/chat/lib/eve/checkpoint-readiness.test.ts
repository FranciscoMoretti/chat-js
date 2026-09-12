import { afterEach, expect, it, vi } from "vitest";
import { waitForEveCheckpoint } from "./checkpoint-readiness";

const request = vi.hoisted(() => vi.fn());
vi.mock("./server", () => ({ eveRequest: request }));
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
        ready: true,
        sessionId: "source",
        beforeTurnId: "turn_0",
      })
    );
  const ready = waitForEveCheckpoint("owner", "source", "turn_0");
  await vi.advanceTimersByTimeAsync(250);
  await ready;
  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls[0].slice(0, 2)).toEqual([
    "owner",
    "/eve/v1/session/source/checkpoint?beforeTurnId=turn_0",
  ]);
});
it("does not accept an unrelated source receipt or a generic not found", async () => {
  request.mockResolvedValueOnce(
    Response.json({ ready: true, sessionId: "other", beforeTurnId: "turn_0" })
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
      (call) =>
        call[1] === "/eve/v1/session/source/checkpoint?beforeTurnId=turn_0"
    )
  ).toBe(true);
});
