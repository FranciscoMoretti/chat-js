import assert from "node:assert/strict";
import { afterEach, describe, it } from "vitest";
import {
  acknowledgeProvisionalUserMessagePersistence,
  claimConfirmedProvisionalChat,
  clearProvisionalChatConfirmations,
  discardUnacknowledgedProvisionalChatConfirmation,
  registerProvisionalChatConfirmation,
} from "./provisional-chat-confirmations";

describe("provisional chat confirmations", () => {
  afterEach(clearProvisionalChatConfirmations);

  it("releases only after the expected user message and group are persisted", () => {
    registerProvisionalChatConfirmation("chat-1", {
      parallelGroupId: "group-1",
      userMessageId: "user-1",
    });

    assert.equal(claimConfirmedProvisionalChat("chat-1"), false);
    assert.equal(
      acknowledgeProvisionalUserMessagePersistence({
        chatId: "chat-1",
        parallelGroupId: "wrong-group",
        userMessageId: "user-1",
      }),
      false
    );
    assert.equal(claimConfirmedProvisionalChat("chat-1"), false);
    assert.equal(
      acknowledgeProvisionalUserMessagePersistence({
        chatId: "chat-1",
        parallelGroupId: "group-1",
        userMessageId: "wrong-user",
      }),
      false
    );
    assert.equal(claimConfirmedProvisionalChat("chat-1"), false);

    assert.equal(
      acknowledgeProvisionalUserMessagePersistence({
        chatId: "chat-1",
        parallelGroupId: "group-1",
        userMessageId: "user-1",
      }),
      true
    );
    assert.equal(claimConfirmedProvisionalChat("chat-1"), true);
    assert.equal(claimConfirmedProvisionalChat("chat-1"), false);
  });

  it("discards only the matching unacknowledged confirmation", () => {
    registerProvisionalChatConfirmation("chat-1", {
      parallelGroupId: "group-1",
      userMessageId: "user-1",
    });

    assert.equal(
      discardUnacknowledgedProvisionalChatConfirmation("chat-1", "wrong-user"),
      false
    );
    assert.equal(
      discardUnacknowledgedProvisionalChatConfirmation("chat-1", "user-1"),
      true
    );
    assert.equal(claimConfirmedProvisionalChat("chat-1"), false);
  });

  it("preserves an acknowledged confirmation until it is claimed", () => {
    registerProvisionalChatConfirmation("chat-1", {
      parallelGroupId: "group-1",
      userMessageId: "user-1",
    });
    acknowledgeProvisionalUserMessagePersistence({
      chatId: "chat-1",
      parallelGroupId: "group-1",
      userMessageId: "user-1",
    });

    assert.equal(
      discardUnacknowledgedProvisionalChatConfirmation("chat-1", "user-1"),
      false
    );
    assert.equal(claimConfirmedProvisionalChat("chat-1"), true);
  });
});
