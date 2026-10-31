import { describe, expect, it } from "vitest";

import { eveMessageDelivery } from "./message-delivery";

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

const received = (_message: string, operationId: string) => ({
  sessionId: "session",
  operationId,
  deliveryId: `native-${operationId}`,
});

describe("Eve message delivery recovery", () => {
  it("preserves pending delivery data when its selected tool is no longer installed", () => {
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
      message: "Keep this message after removing its tool",
      modelId: "model",
      selectedTool: "removedPluginTool",
    });

    expect(eveMessageDelivery.read(storage, "session")).toEqual(pending);
    expect(
      storage.getItem("chatjs.eve.pending-message:session")
    ).not.toBeNull();
  });

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

    // Repeated positive receipts are harmless after the first acknowledgement.
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

it("retries a busy saved delivery with its original identity and clears rejection before dispatch", () => {
  const storage = memoryStorage();
  const original = eveMessageDelivery.begin(storage, "session", {
    attachments: [],
    message: "retry me",
    modelId: "model",
  });
  eveMessageDelivery.reject(storage, "session", original, "Busy", true);
  const reloaded = eveMessageDelivery.read(storage, "session");
  if (!reloaded) {
    throw new Error("Missing saved delivery");
  }
  expect(reloaded.retryable).toBe(true);
  const retry = eveMessageDelivery.retry(storage, "session", reloaded);
  if (!retry) {
    throw new Error("Missing retried delivery");
  }
  expect(retry.operationId).toBe(original.operationId);
  expect(retry.rejection).toBeUndefined();
  expect(retry.retryable).toBeUndefined();
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
