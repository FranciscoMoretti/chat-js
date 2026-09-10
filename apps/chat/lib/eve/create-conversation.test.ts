import { afterEach, expect, it, vi } from "vitest";
import { CreationRejected, requestConversation } from "./create-conversation";

const operation = {
  operationId: "00000000-0000-4000-8000-000000000001",
  message: "yo",
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("aborts a stalled creation without resending or changing its operation", async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener(
          "abort",
          () => reject(init.signal?.reason),
          { once: true }
        );
      })
  );
  vi.stubGlobal("fetch", fetchMock);
  const result = expect(requestConversation(operation)).rejects.toThrow(
    "timed out"
  );
  await vi.advanceTimersByTimeAsync(30_000);
  await result;
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0]?.[1].body).toBe(JSON.stringify(operation));
});

it("returns the existing binding on retry and clears its deadline", async () => {
  vi.useFakeTimers();
  const binding = { id: operation.operationId, sessionId: "session-test" };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(binding)));
  await expect(requestConversation(operation)).resolves.toEqual(binding);
  expect(vi.getTimerCount()).toBe(0);
});

it.each([
  400, 404,
])("distinguishes definitive rejection (%i) from uncertain creation", async (status) => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { error: "Unavailable", creationRejected: true },
          { status }
        )
      )
  );
  await expect(requestConversation(operation)).rejects.toBeInstanceOf(
    CreationRejected
  );
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ error: "Unresolved" }, { status: 409 })
      )
  );
  await expect(requestConversation(operation)).rejects.not.toBeInstanceOf(
    CreationRejected
  );
});
