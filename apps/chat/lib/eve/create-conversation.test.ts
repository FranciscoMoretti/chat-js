import { afterEach, expect, it, vi } from "vitest";

import {
  CreationRejectedError,
  requestConversation,
} from "./create-conversation";

const operation = {
  message: "yo",
  operationId: "00000000-0000-4000-8000-000000000001",
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * no-magic-numbers (#517): it("aborts a stalled creation without resending or changing its operation") uses 30_000, 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): it("aborts a stalled creation without resending or changing its operation") accepts init: RequestInit; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): it("aborts a stalled creation without resending or changing its operation") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
it("aborts a stalled creation without resending or changing its operation", async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn(
    (_url: string, init: RequestInit) =>
      // oxlint-disable-next-line promise/avoid-new -- Bridge the timer or abort callback to the awaited operation.
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener(
          "abort",
          // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- #603: This test deliberately injects a non-Error failure to verify rejection and abort handling for arbitrary provider reasons.
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
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("returns the existing binding on retry and clears its deadline") uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("returns the existing binding on retry and clears its deadline", async () => {
  vi.useFakeTimers();
  const binding = { id: operation.operationId, sessionId: "session-test" };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(binding)));
  await expect(requestConversation(operation)).resolves.toEqual(binding);
  expect(vi.getTimerCount()).toBe(0);
});
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it.each([400, 404])("distinguishes definitive rejection (%i) from uncertain creation" uses 400, 404 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it.each([400, 404])(
  "distinguishes definitive rejection (%i) from uncertain creation",
  async (status) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { creationRejected: true, error: "Unavailable" },
            { status }
          )
        )
    );
    await expect(requestConversation(operation)).rejects.toBeInstanceOf(
      CreationRejectedError
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
      CreationRejectedError
    );
  }
);
/* oxlint-enable no-magic-numbers */

it("identifies a missing project only on a definitive rejection", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json(
        {
          code: "project_not_found",
          creationRejected: true,
          error: "Project not found",
        },
        { status: 404 }
      )
    )
  );
  await expect(requestConversation(operation)).rejects.toMatchObject({
    projectUnavailable: true,
  });
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { creationRejected: true, error: "Invalid model" },
          { status: 400 }
        )
      )
  );
  await expect(requestConversation(operation)).rejects.toMatchObject({
    projectUnavailable: false,
  });
});

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): it("automatically retries busy creation with the same operation identity") uses 2000, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): it("automatically retries busy creation with the same operation identity") accepts [, init]; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
it("automatically retries busy creation with the same operation identity", async () => {
  vi.useFakeTimers();
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json(
        { code: "usage_reconciliation_busy", error: "Busy" },
        { status: 503 }
      )
    )
    .mockResolvedValueOnce(
      Response.json({ id: operation.operationId, sessionId: "session" })
    );
  vi.stubGlobal("fetch", fetchMock);
  const result = requestConversation(operation);
  await vi.advanceTimersByTimeAsync(2000);
  await expect(result).resolves.toMatchObject({ sessionId: "session" });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  // oxlint-disable-next-line typescript/no-unsafe-return, typescript/no-unsafe-member-access -- #598: This create-conversation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #597: This create-conversation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(fetchMock.mock.calls.map(([, init]) => init.body)).toEqual([
    JSON.stringify(operation),
    JSON.stringify(operation),
  ]);
});
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */
