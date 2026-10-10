import { expect, it } from "vitest";
import { TRPCClientError } from "@trpc/client";

import { isAbortedRequest } from "./is-aborted-request";

/* oxlint-disable unicorn/max-nested-calls --
 * unicorn/max-nested-calls (#568): it("recognizes wrapped fetch cancellation without hiding real transport failures") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
it("recognizes wrapped fetch cancellation without hiding real transport failures", () => {
  expect(
    isAbortedRequest(
      TRPCClientError.from(
        new DOMException("signal is aborted without reason", "AbortError")
      )
    )
  ).toBe(true);
  expect(
    isAbortedRequest(TRPCClientError.from(new TypeError("Failed to fetch")))
  ).toBe(false);
  expect(
    isAbortedRequest(TRPCClientError.from(new Error("Unauthorized")))
  ).toBe(false);
  expect(
    isAbortedRequest(
      TRPCClientError.from(new DOMException("Timed out", "TimeoutError"))
    )
  ).toBe(false);
  expect(isAbortedRequest({ message: "AbortError" })).toBe(false);
});
/* oxlint-enable unicorn/max-nested-calls */
