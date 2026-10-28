import type { installedChatUi } from "@/composition/generated/installed-chat-ui";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import ChatPage from "@/app/(chat)/chat/[id]/page";
import ChatLayout from "@/app/(chat)/layout";
import type { ChatMessageProps } from "@/lib/chat-plugin-contracts";
import {
  history,
  invoicesConversation,
  invoicesTranscripts,
  invoicesTrpc,
  signedIn,
} from "./fixtures";
import { renderRoute } from "./render";

vi.mock("@/composition/generated/installed-chat-ui", async (importOriginal) => {
  const original = await importOriginal<{
    installedChatUi: typeof installedChatUi;
  }>();
  return {
    ...original,
    installedChatUi: [
      ...original.installedChatUi,
      {
        id: "fixture-responses",
        chat: {
          MessageResponses: ({
            conversationId,
            messageId,
            disabled,
          }: ChatMessageProps) => (
            <button
              type="button"
              disabled={disabled}
              data-conversation-id={conversationId}
              data-message-id={messageId}
            >
              Inspect response details
            </button>
          ),
        },
      },
    ],
  };
});

test("plugin response content composes with core message actions", async () => {
  await renderRoute(
    <ChatLayout>
      <ChatPage params={Promise.resolve({ id: invoicesConversation.id })} />
    </ChatLayout>,
    {
      ...signedIn,
      path: `/chat/${invoicesConversation.chatId}`,
      server: { conversation: invoicesConversation, conversations: history },
      transcripts: invoicesTranscripts,
      trpc: invoicesTrpc,
    }
  );
  const response = page
    .getByRole("button", { name: "Inspect response details" })
    .first();
  await expect.element(response).toBeVisible();
  await expect.element(response).toBeEnabled();
  await expect
    .element(response)
    .toHaveAttribute("data-conversation-id", invoicesConversation.id);
  await expect.element(response).toHaveAttribute("data-message-id");
  await expect
    .element(page.getByRole("button", { name: "Edit message" }).first())
    .toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Copy" }).first())
    .toBeVisible();
});
