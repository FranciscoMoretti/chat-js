import { expect, it } from "vitest";

import { finishPendingEveCopy, preparePendingEveCopy } from "./request-copy";

/* oxlint-disable typescript/explicit-function-return-type, unicorn/no-null  --
 * oxc/no-rest-spread-properties (#543): it("retains the original operation and model across reload, isolates owners, and clea copies or separates ...first while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/explicit-function-return-type (#560): Keep it("retains the original operation and model across reload, isolates owners, and clea's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * unicorn/no-null (#570): it("retains the original operation and model across reload, isolates owners, and clea preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
it("retains the original operation and model across reload, isolates owners, and clears only matching confirmations", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
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
/* oxlint-enable typescript/explicit-function-return-type, unicorn/no-null */
