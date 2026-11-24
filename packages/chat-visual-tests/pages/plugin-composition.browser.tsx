import { assetDataUri } from "../../registry/src/tools/_shared/visual-fonts";
import { definePlugin, slot } from "@/chatjs/core/ui/slots";
import { MessageResponses } from "@/components/chat-slots";
import { chatPlugins } from "@/integrations/chat/ui";
import { expect, onTestFinished, test } from "vitest";
import { page } from "vitest/browser";
import ChatPage from "@/app/(chat)/chat/[chatId]/page";
import ChatLayout from "@/app/(chat)/layout";
import type { ChatMessageProps } from "@/chatjs/core/chat/contracts";
import {
  generatedImageTranscripts,
  publishedFileTranscripts,
  researchFileTranscripts,
  nativeFileTranscripts,
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
      ({ branchId, messageId, disabled }: ChatMessageProps) => (
        <button
          type="button"
          disabled={disabled}
          data-branch-id={branchId}
          data-message-id={messageId}
        >
          Inspect response details
        </button>
      )
    ),
  ],
});

test("published file is downloadable without a matching viewer", async () => {
  const original = [...chatPlugins];
  chatPlugins.splice(
    0,
    chatPlugins.length,
    ...original.filter((plugin) => plugin.id !== "spreadsheet-viewer")
  );
  onTestFinished(() => {
    chatPlugins.splice(0, chatPlugins.length, ...original);
  });
  await renderRoute(
    <ChatLayout>
      <ChatPage params={Promise.resolve({ chatId: invoicesConversation.id })} />
    </ChatLayout>,
    {
      ...signedIn,
      path: `/chat/${invoicesConversation.chatId}`,
      params: { chatId: invoicesConversation.chatId },
      server: { conversation: invoicesConversation, conversations: history },
      transcripts: publishedFileTranscripts,
      trpc: invoicesTrpc,
    }
  );
  await expect
    .element(page.getByRole("button", { name: "Download report.xlsx" }))
    .toBeVisible();
  await expect
    .element(page.getByText("report.xlsx", { exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByRole("button", { name: /^Open /u }))
    .not.toBeInTheDocument();
  await page.screenshot({ path: "__screenshots__/published-file.png" });
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
      <ChatPage params={Promise.resolve({ chatId: invoicesConversation.id })} />
    </ChatLayout>,
    {
      ...signedIn,
      path: `/chat/${invoicesConversation.chatId}`,
      params: { chatId: invoicesConversation.chatId },
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
    .toHaveAttribute("data-branch-id", invoicesConversation.id);
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
          <ChatPage
            params={Promise.resolve({ chatId: invoicesConversation.id })}
          />
        </ChatLayout>,
        {
          ...signedIn,
          path: `/chat/${invoicesConversation.chatId}`,
          params: { chatId: invoicesConversation.chatId },
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

test("published spreadsheet opens through the optional viewer", async () => {
  const url = await assetDataUri(
    new URL(
      "../../registry/src/plugins/spreadsheet-viewer/fixtures/budget.xlsx",
      import.meta.url
    ).href,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  const transcripts = Object.fromEntries(
    Object.entries(publishedFileTranscripts).map(([id, messages]) => [
      id,
      messages.map((message) => ({
        ...message,
        parts: message.parts.map((part) => ({
          ...part,
          output: { ...part.output, url },
        })),
      })),
    ])
  );
  await renderRoute(
    <ChatLayout>
      <ChatPage params={Promise.resolve({ chatId: invoicesConversation.id })} />
    </ChatLayout>,
    {
      ...signedIn,
      path: `/chat/${invoicesConversation.chatId}`,
      params: { chatId: invoicesConversation.chatId },
      server: { conversation: invoicesConversation, conversations: history },
      transcripts,
      trpc: invoicesTrpc,
    }
  );
  await page.getByRole("button", { name: "Open spreadsheet" }).click();
  await expect.element(page.getByRole("dialog")).toBeVisible();
  await expect
    .element(page.getByRole("gridcell", { name: "Hosting", exact: true }))
    .toBeVisible();
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await expect
    .element(page.getByRole("gridcell", { name: "Launch plan", exact: true }))
    .toBeVisible();
  await page.screenshot({ path: "__screenshots__/spreadsheet-viewer.png" });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect
    .element(page.getByRole("button", { name: "Download report.xlsx" }))
    .toBeVisible();
});

test("native execution output and uploaded spreadsheet use core presentation", async () => {
  await renderRoute(
    <ChatLayout>
      <ChatPage params={Promise.resolve({ chatId: invoicesConversation.id })} />
    </ChatLayout>,
    {
      ...signedIn,
      path: `/chat/${invoicesConversation.chatId}`,
      params: { chatId: invoicesConversation.chatId },
      server: { conversation: invoicesConversation, conversations: history },
      transcripts: nativeFileTranscripts,
      trpc: invoicesTrpc,
    }
  );
  await expect
    .element(page.getByText("Exit code: 0", { exact: true }))
    .toBeVisible();
  await page.screenshot({ path: "__screenshots__/native-bash.png" });
  await page.getByRole("button", { name: "Open spreadsheet" }).click();
  await expect
    .element(page.getByRole("gridcell", { name: "Hosting", exact: true }))
    .toBeVisible();
  await page.screenshot({ path: "__screenshots__/uploaded-spreadsheet.png" });
});

test("native research report is published separately without a document editor", async () => {
  await renderRoute(
    <ChatLayout>
      <ChatPage params={Promise.resolve({ chatId: invoicesConversation.id })} />
    </ChatLayout>,
    {
      ...signedIn,
      path: `/chat/${invoicesConversation.chatId}`,
      params: { chatId: invoicesConversation.chatId },
      server: { conversation: invoicesConversation, conversations: history },
      transcripts: researchFileTranscripts,
      trpc: invoicesTrpc,
    }
  );
  const activity = page.getByRole("button", { name: "Worked 2 steps" });
  await expect.element(activity).toHaveAttribute("aria-expanded", "false");
  await expect
    .element(page.getByRole("button", { name: "Download Research report.md" }))
    .toBeVisible();
  await expect.element(page.getByTestId("artifact")).not.toBeInTheDocument();
  await activity.click();
  await expect
    .element(
      page.getByText("Research complete. Report saved in the agent workspace.")
    )
    .toBeVisible();
  await activity.click();
  await page.screenshot({ path: "__screenshots__/research-file.png" });
});
