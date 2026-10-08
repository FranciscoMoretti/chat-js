import { afterEach, expect, it, vi } from "vitest";
import {
  finishPendingEveCopy,
  preparePendingEveCopy,
  requestEveCopy,
} from "./request-copy";

it("retains the original operation and model across reload, isolates owners, and clears only matching confirmations", () => {
  const values = new Map<string, string>();
  const storage = {
    // oxlint-disable-next-line unicorn/no-null -- The browser Storage.getItem contract returns null for missing entries.
    getItem: (key: string): string | null => values.get(key) ?? null,
    removeItem: (key: string): void => {
      values.delete(key);
    },
    setItem: (key: string, value: string): void => {
      values.set(key, value);
    },
  };
  const source = crypto.randomUUID();
  const first = preparePendingEveCopy(
    storage,
    "owner",
    source.toUpperCase(),
    "google/gemini-2.5-flash-lite"
  );
  expect(
    preparePendingEveCopy(storage, "owner", source, "different-model")
  ).toEqual(first);
  expect(
    preparePendingEveCopy(storage, "other", source, "different-model")
      .operationId
  ).not.toBe(first.operationId);
  finishPendingEveCopy(storage, "owner", {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing first own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...first,
    operationId: crypto.randomUUID(),
  });
  expect(
    preparePendingEveCopy(storage, "owner", source, "different-model")
  ).toEqual(first);
  finishPendingEveCopy(storage, "owner", first);
  expect(
    preparePendingEveCopy(storage, "owner", source, "different-model")
      .operationId
  ).not.toBe(first.operationId);
});

const copyInput = {
  modelId: "test/model",
  operationId: crypto.randomUUID(),
  sourceConversationId: crypto.randomUUID(),
};

afterEach((): void => {
  vi.restoreAllMocks();
});

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("preserves a server rejection's recovery identity and retryability", async () => {
  const conversationId = crypto.randomUUID();
  const response = Response.json(
    {
      conversationId,
      error: "Copy rejected",
      retryable: false,
    },
    { status: 400 }
  );
  vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
  await expect(requestEveCopy(copyInput)).rejects.toMatchObject({
    conversationId,
    message: "Copy rejected",
    retryable: false,
  });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("keeps malformed server failures retryable", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("invalid JSON", { status: 500 })
  );
  await expect(requestEveCopy(copyInput)).rejects.toMatchObject({
    message: "Unable to save. Sign in and retry the same copy.",
    retryable: true,
  });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("distinguishes an expired request from a network failure", async () => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network failure"));
  await expect(requestEveCopy(copyInput)).rejects.toMatchObject({
    message: "Saving is unconfirmed. Retry to recover the same copy.",
  });
  const controller = new AbortController();
  controller.abort();
  vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
  await expect(requestEveCopy(copyInput)).rejects.toMatchObject({
    message:
      "Saving is taking longer than expected. Retry to recover the same copy.",
  });
});
/* oxlint-enable oxc/no-async-await */
