import { assetDataUri } from "../../registry/src/tools/_shared/visual-fonts";
import { definePlugin, slot } from "@/chatjs/core/ui/slots";
import { MessageResponses } from "@/components/chat-slots";
import { chatPlugins } from "@/integrations/chat/ui";
import { expect, onTestFinished, test } from "vitest";
import { page } from "vitest/browser";
import ChatPage from "@/app/(chat)/chat/[id]/page";
import ChatLayout from "@/app/(chat)/layout";
import type { ChatMessageProps } from "@/chatjs/core/chat/contracts";
import {
  generatedImageTranscripts,
  generatedVideoTranscripts,
  history,
  invoicesConversation,
  invoicesTranscripts,
  invoicesTrpc,
  signedIn,
} from "./fixtures";
import { renderRoute } from "./render";

const responseDetails = definePlugin({
  id: "fixture-responses",
  slots: [
    slot(
      MessageResponses,
      ({ conversationId, messageId, disabled }: ChatMessageProps) => (
        <button
          type="button"
          disabled={disabled}
          data-conversation-id={conversationId}
          data-message-id={messageId}
        >
          Inspect response details
        </button>
      )
    ),
  ],
});

test("plugin response content composes with core message actions", async () => {
  // The runtime transcript mounts under the layout's provider, outside route children.
  // Extend the app-owned list before mounting, then restore it for other captures.
  chatPlugins.push(responseDetails);
  onTestFinished(() => {
    chatPlugins.splice(chatPlugins.indexOf(responseDetails), 1);
  });
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

for (const media of ["image", "video"]) {
  for (const withViewer of [false, true]) {
    test(`${media} artifact actions with viewer=${withViewer}`, async () => {
      const original = [...chatPlugins];
      if (!withViewer) {
        chatPlugins.splice(
          0,
          chatPlugins.length,
          ...original.filter((plugin) => plugin.id !== `${media}-viewer`)
        );
      }
      onTestFinished(() => {
        chatPlugins.splice(0, chatPlugins.length, ...original);
      });
      await renderRoute(
        <ChatLayout>
          <ChatPage params={Promise.resolve({ id: invoicesConversation.id })} />
        </ChatLayout>,
        {
          ...signedIn,
          path: `/chat/${invoicesConversation.chatId}`,
          server: {
            conversation: invoicesConversation,
            conversations: history,
          },
          transcripts:
            media === "image"
              ? generatedImageTranscripts
              : generatedVideoTranscripts(
                  await assetDataUri(
                    new URL(
                      "../../registry/src/tools/generate-video/fixtures/blue.mp4",
                      import.meta.url
                    ).href,
                    "video/mp4"
                  )
                ),
          trpc: invoicesTrpc,
        }
      );
      await expect
        .element(
          page.getByRole("button", { name: `Download ${media}`, exact: true })
        )
        .toBeVisible();
      const open = page.getByRole("button", {
        name: `Open ${media}`,
        exact: true,
      });
      if (withViewer) {
        await open.click();
        await expect.element(page.getByRole("dialog")).toBeVisible();
        await page.screenshot({ path: `__screenshots__/${media}-viewer.png` });
        await page.getByRole("button", { name: "Close", exact: true }).click();
        await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
      } else {
        await expect.element(open).not.toBeInTheDocument();
        await page.screenshot({
          path: `__screenshots__/${media}-without-viewer.png`,
        });
      }
    });
  }
}
