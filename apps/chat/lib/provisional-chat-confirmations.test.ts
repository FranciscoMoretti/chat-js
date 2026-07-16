import assert from "node:assert/strict";
import { afterEach, describe, it } from "vitest";
import type { PendingChatConfirmation } from "@/lib/stores/with-chat-persistence";
import {
  acknowledgeProvisionalUserMessagePersistence,
  claimConfirmedProvisionalChat,
  clearProvisionalChatConfirmations,
  registerProvisionalChatConfirmation,
} from "./provisional-chat-confirmations";

const confirmation = {
  message: {
    id: "user-1",
    metadata: { parallelGroupId: "group-1" },
  },
  projectId: null,
  requestSpecs: [],
} as unknown as PendingChatConfirmation;

describe("provisional chat confirmations", () => {
  afterEach(clearProvisionalChatConfirmations);

  it("releases only after the expected user message and group are persisted", () => {
    registerProvisionalChatConfirmation("chat-1", confirmation);

    assert.equal(claimConfirmedProvisionalChat("chat-1"), null);
    assert.equal(
      acknowledgeProvisionalUserMessagePersistence({
        chatId: "chat-1",
        parallelGroupId: "wrong-group",
        userMessageId: "user-1",
      }),
      false
    );
    assert.equal(claimConfirmedProvisionalChat("chat-1"), null);

    assert.equal(
      acknowledgeProvisionalUserMessagePersistence({
        chatId: "chat-1",
        parallelGroupId: "group-1",
        userMessageId: "user-1",
      }),
      true
    );
    assert.equal(claimConfirmedProvisionalChat("chat-1"), confirmation);
    assert.equal(claimConfirmedProvisionalChat("chat-1"), null);
  });
});
