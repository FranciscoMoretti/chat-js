import { eq } from "drizzle-orm";
import type { ChatServerIntegration } from "@/chatjs/core/chat/contracts";
import { eveConversation } from "@/lib/db/schema";

const sharingChat = {
  publicReadFilter: () => eq(eveConversation.visibility, "public"),
} satisfies ChatServerIntegration;

export default sharingChat;
