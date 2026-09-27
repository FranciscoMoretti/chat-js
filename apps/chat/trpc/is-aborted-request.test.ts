import { TRPCClientError } from "@trpc/client";
import { expect, it } from "vitest";

import { isAbortedRequest } from "./is-aborted-request";

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
