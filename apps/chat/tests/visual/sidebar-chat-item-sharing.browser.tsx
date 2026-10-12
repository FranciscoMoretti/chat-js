import { test } from "vitest";
import { checkChatItemSharing } from "./chat-item-sharing.fixture";

test("sidebar item renders synchronous share content", async () => {
  await checkChatItemSharing("sidebar-chat");
});
