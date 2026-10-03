import { ClientError } from "eve/client";
import { afterEach, expect, it, vi } from "vitest";

import { sendCommand } from "./send-command";

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): busy uses 503 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
const busy = new ClientError(
  503,
  JSON.stringify({ code: "usage_reconciliation_busy", error: "Busy" })
);
/* oxlint-enable no-magic-numbers */
afterEach(() => vi.useRealTimers());

/* oxlint-disable no-magic-numbers, no-undefined  --
 * no-magic-numbers (#517): it("retries an undispatched message through the same send closure") uses 2000, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): it("retries an undispatched message through the same send closure") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): it("retries an undispatched message through the same send closure") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
it("retries an undispatched message through the same send closure", async () => {
  vi.useFakeTimers();
  const send = vi.fn().mockResolvedValue(undefined);
  const getError = vi.fn().mockReturnValueOnce(busy).mockReturnValue(undefined);
  const result = sendCommand(send, vi.fn(), false, getError);
  await vi.advanceTimersByTimeAsync(2000);
  await result;
  expect(send).toHaveBeenCalledTimes(2);
});
/* oxlint-enable no-magic-numbers, no-undefined */

/* oxlint-disable no-magic-numbers  --
 * no-magic-numbers (#517): it("bounds busy retries and never retries ambiguous connection errors") uses 30_000, 15 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("bounds busy retries and never retries ambiguous connection errors") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
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
/* oxlint-enable no-magic-numbers */
