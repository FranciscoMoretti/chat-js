import assert from "node:assert/strict";
import { describe, it } from "vitest";
import type { ChatMessage } from "@/lib/ai/types";
import { createCustomChatStore } from "./custom-store-provider";

describe("withChatPersistence", () => {
  it("can initialize persisted state without a follow-up store update", () => {
    const store = createCustomChatStore<ChatMessage>([], {
      initialIsChatPersisted: true,
    });

    assert.equal(store.getState().isChatPersisted, true);
  });

  it("resets app-level chat persistence", () => {
    const store = createCustomChatStore<ChatMessage>();

    assert.equal(store.getState().isChatPersisted, false);

    store.getState().setChatPersisted(true);
    assert.equal(store.getState().isChatPersisted, true);

    store.getState().reset();

    assert.equal(store.getState().isChatPersisted, false);
  });
});
