import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { ChatSDKError, isErrorCode } from "./ai/errors";
import { fetchWithErrorHandlers } from "./utils";

beforeEach((): void => {
  vi.stubGlobal("navigator", { onLine: true });
});
afterEach((): void => {
  vi.unstubAllGlobals();
});

test("HTTP error codes are narrowed before constructing SDK errors", async (): Promise<void> => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { cause: "invalid request", code: "bad_request:api" },
          { status: 400 }
        )
      )
  );
  await expect(
    fetchWithErrorHandlers("https://example.com")
  ).rejects.toMatchObject({
    cause: "invalid request",
    name: "ChatSDKError",
    statusCode: 400,
    surface: "api",
    type: "bad_request",
  });
  expect(isErrorCode("bad_request:api:extra")).toBe(false);
  expect(isErrorCode("bad_request:constructor")).toBe(false);
  expect(isErrorCode(false)).toBe(false);
});

test("hidden and malformed error envelopes have a safe public message", async (): Promise<void> => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ code: "", message: "Public failure" }, { status: 500 })
      )
  );
  await expect(fetchWithErrorHandlers("https://example.com")).rejects.toThrow(
    "Public failure"
  );
  vi.stubGlobal(
    "fetch",
    // oxlint-disable-next-line unicorn/no-null -- JSON null is a malformed HTTP envelope that this boundary must handle.
    vi.fn().mockResolvedValue(Response.json(null, { status: 500 }))
  );
  await expect(fetchWithErrorHandlers("https://example.com")).rejects.toThrow(
    "Something went wrong. Please try again later."
  );
});

test("valid error codes preserve their native split contract", (): void => {
  for (const type of [
    "bad_request",
    "unauthorized",
    "input_too_long",
    "forbidden",
    "not_found",
    "rate_limit",
    "offline",
  ] as const) {
    for (const surface of [
      "chat",
      "auth",
      "api",
      "stream",
      "database",
      "history",
      "vote",
      "document",
      "suggestions",
    ] as const) {
      const error = new ChatSDKError(`${type}:${surface}`);
      expect(error.type).toBe(type);
      expect(error.surface).toBe(surface);
      expect(isErrorCode(`${type}:${surface}`)).toBe(true);
    }
  }
});
