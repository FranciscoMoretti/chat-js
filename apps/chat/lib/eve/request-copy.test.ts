import { expect, it } from "vitest";

import { finishPendingEveCopy, preparePendingEveCopy } from "./request-copy";

it("retains the original operation and model across reload, isolates owners, and clears only matching confirmations", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
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
