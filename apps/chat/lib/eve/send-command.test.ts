import { ClientError } from "eve/client";
import { afterEach, expect, it, vi } from "vitest";

import { sendCommand } from "./send-command";

const busy = new ClientError(
  503,
  JSON.stringify({ code: "usage_reconciliation_busy", error: "Busy" })
);
afterEach(() => vi.useRealTimers());

it("retries an undispatched message through the same send closure", async () => {
  vi.useFakeTimers();
  const send = vi.fn().mockResolvedValue(undefined);
  const getError = vi.fn().mockReturnValueOnce(busy).mockReturnValue(undefined);
  const result = sendCommand(send, vi.fn(), false, getError);
  await vi.advanceTimersByTimeAsync(2000);
  await result;
  expect(send).toHaveBeenCalledTimes(2);
});

it("bounds busy retries and never retries ambiguous connection errors", async () => {
  vi.useFakeTimers();
  const send = vi.fn().mockRejectedValue(busy);
  const result = expect(
    sendCommand(send, vi.fn(), false, vi.fn())
  ).rejects.toBe(busy);
  await vi.advanceTimersByTimeAsync(30_000);
  await result;
  expect(send.mock.calls.length).toBeLessThanOrEqual(15);
  const ambiguous = vi.fn().mockRejectedValue(new Error("connection lost"));
  await expect(sendCommand(ambiguous, vi.fn(), false, vi.fn())).rejects.toThrow(
    "connection lost"
  );
  expect(ambiguous).toHaveBeenCalledOnce();
});
