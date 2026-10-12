import { test } from "vitest";
import { checkChatItemSharing } from "./chat-item-sharing.fixture";

test("project item renders synchronous share content", async () => {
  await checkChatItemSharing("project-chat");
});
