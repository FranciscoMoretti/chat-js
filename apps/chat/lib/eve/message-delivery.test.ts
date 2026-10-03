import type { MessageStreamEvent } from "eve/client";
import { describe, expect, it } from "vitest";

import {
  eveMessageDelivery,
  eveMessageDeliveryMetadata,
} from "./message-delivery";

/* oxlint-disable typescript/explicit-function-return-type, unicorn/no-null --
 * typescript/explicit-function-return-type (#560): Keep memoryStorage's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * unicorn/no-null (#570): memoryStorage preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string): void => {
      values.delete(key);
    },
    setItem: (key: string, value: string): void => {
      values.set(key, value);
    },
  };
};
/* oxlint-enable typescript/explicit-function-return-type, unicorn/no-null */

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): received preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
const received = (
  message: string,
  operationId: string
): MessageStreamEvent => ({
  data: {
    message,
    metadata: eveMessageDeliveryMetadata(operationId, null),
    sequence: 1,
    turnId: "turn_1",
  },
  meta: { at: "2026-09-13T00:00:00.000Z", id: crypto.randomUUID() },
  type: "message.received",
});
/* oxlint-enable unicorn/no-null */

/* oxlint-disable max-lines-per-function, max-statements, no-undefined --
 * max-lines-per-function (#510): describe("Eve message delivery recovery") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): describe("Eve message delivery recovery") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-undefined (#519): describe("Eve message delivery recovery") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
describe("Eve message delivery recovery", () => {
  it("retains a lost response across reload until the exact operation is acknowledged", () => {
    const storage = memoryStorage();
    const pending = eveMessageDelivery.begin(storage, "session", {
      attachments: [],
      message: "same text",
      modelId: "model",
      selectedTool: undefined,
    });
    if (!pending.operationId) {
      throw new Error("New deliveries require an operation ID");
    }

    const reloaded = eveMessageDelivery.read(storage, "session");
    expect(reloaded).toEqual(pending);
    if (!reloaded) {
      throw new Error("Expected the pending delivery to survive reload");
    }

    const differentOperation = crypto.randomUUID();
    expect(
      eveMessageDelivery.acknowledge(
        storage,
        "session",
        reloaded,
        received("same text", differentOperation)
      )
    ).toBe(false);
    expect(eveMessageDelivery.read(storage, "session")).toEqual(pending);

    expect(
      eveMessageDelivery.acknowledge(
        storage,
        "session",
        reloaded,
        received("changed by preparation", pending.operationId)
      )
    ).toBe(true);
    expect(eveMessageDelivery.read(storage, "session")).toBeNull();

    // Replayed stream events are harmless after the first acknowledgement.
    expect(
      eveMessageDelivery.acknowledge(
        storage,
        "session",
        reloaded,
        received("same text", pending.operationId)
      )
    ).toBe(true);
    expect(eveMessageDelivery.read(storage, "session")).toBeNull();
  });

  it("retains rejection details and safely restores old records", () => {
    const storage = memoryStorage();
    const pending = eveMessageDelivery.begin(storage, "session", {
      attachments: [
        {
          contentType: "image/png",
          digest: "digest",
          name: "image.png",
          url: "/api/files/abcdefghijklmnopqrstuvwx.png",
        },
      ],
      message: "restore me",
      modelId: "model",
      selectedTool: "createTextDocument",
    });
    const rejected = eveMessageDelivery.reject(
      storage,
      "session",
      pending,
      "Insufficient credits"
    );
    expect(eveMessageDelivery.read(storage, "session")).toEqual(rejected);

    storage.setItem(
      "chatjs.eve.pending-message:old-session",
      JSON.stringify({ message: "old record without an operation" })
    );
    expect(eveMessageDelivery.read(storage, "old-session")).toEqual({
      attachments: [],
      message: "old record without an operation",
    });
  });
});
/* oxlint-enable max-lines-per-function, max-statements, no-undefined */

/* oxlint-disable max-statements  --
 * max-statements (#512): it("retries a busy saved delivery with its original identity and clears rejection bef keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-optional-chaining (#542): it("retries a busy saved delivery with its original identity and clears rejection bef handles optional reloaded?.retryable; retry?.operationId; retry?.rejection; retry?.retryable without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 */
it("retries a busy saved delivery with its original identity and clears rejection before dispatch", () => {
  const storage = memoryStorage();
  const original = eveMessageDelivery.begin(storage, "session", {
    attachments: [],
    message: "retry me",
    modelId: "model",
  });
  eveMessageDelivery.reject(storage, "session", original, "Busy", true);
  const reloaded = eveMessageDelivery.read(storage, "session");
  expect(reloaded?.retryable).toBe(true);
  if (!reloaded) {
    throw new Error("Missing saved delivery");
  }
  const retry = eveMessageDelivery.retry(storage, "session", reloaded);
  expect(retry?.operationId).toBe(original.operationId);
  expect(retry?.rejection).toBeUndefined();
  expect(retry?.retryable).toBeUndefined();
  // An ambiguous failed retry must never remain automatically replayable.
  expect(
    eveMessageDelivery.retry(storage, "session", original)
  ).toBeUndefined();
  eveMessageDelivery.acknowledge(
    storage,
    "session",
    original,
    received("retry me", original.operationId)
  );
  expect(
    eveMessageDelivery.retry(storage, "session", original)
  ).toBeUndefined();
});
/* oxlint-enable max-statements */
