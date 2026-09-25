import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getRegisteredSession } from "@/lib/registered-session";

import { DisposableGuestChat } from "./disposable-guest-chat";

export const EveChatPage = async ({
  conversationId,
}: {
  conversationId?: string;
}) => {
  const session = await getRegisteredSession(await headers());
  if (!session?.user) {
    if (conversationId) {
      redirect("/");
    }
    return <DisposableGuestChat />;
  }
  // oxlint-disable-next-line react/todo -- Load the database-backed page only for registered users.
  const { RegisteredEveChatPage } = await import("./registered-eve-chat-page");
  return <RegisteredEveChatPage conversationId={conversationId} />;
};
