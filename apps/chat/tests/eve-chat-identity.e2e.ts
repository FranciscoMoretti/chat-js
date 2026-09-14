import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../lib/db/client";
import { eveChat, eveConversation } from "../lib/db/schema";
import { conversationBinding } from "../lib/eve/contracts";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

test("generated chat identity stays selected across edited branch paths", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const { origin } = new URL(page.url());
  const response = await page.request.post("/api/agent-conversations", {
    data: {
      message:
        "We will discuss planning a three day hiking trip with lightweight camping equipment. For this first reply say only trail-ready. Do not use tools.",
      modelId: "google/gemini-2.5-flash-lite",
      operationId: crypto.randomUUID(),
    },
    headers: { origin },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const source = conversationBinding.parse(await response.json());
  try {
    await page.goto(`/chat/${source.id}`);
    await expect(page.getByRole("log")).toContainText("trail-ready", {
      timeout: 60_000,
    });
    const readChat = async () => {
      const [row] = await db
        .select({
          id: eveChat.id,
          status: eveChat.titleStatus,
          title: eveChat.title,
        })
        .from(eveConversation)
        .innerJoin(eveChat, eq(eveConversation.chatId, eveChat.id))
        .where(eq(eveConversation.id, source.id));
      return row;
    };
    await expect
      .poll(
        async () => {
          const chat = await readChat();
          return chat?.status;
        },
        {
          intervals: [1000, 2000],
          timeout: 30_000,
        }
      )
      .toBe("generated");
    const chat = await readChat();
    if (!chat) {
      throw new Error("Missing test chat identity");
    }
    const title = page
      .getByRole("main")
      .getByRole("heading", { level: 1 })
      .filter({ visible: true });
    await expect(title).toHaveText(chat.title);
    const activeChat = page.locator(
      'a[data-sidebar="menu-button"][data-active="true"]'
    );
    await expect(activeChat).toHaveCount(1);
    await expect(activeChat).toHaveText(chat.title);
    const chatHref = await activeChat.getAttribute("href");
    await page
      .getByRole("button", { exact: true, name: "Edit message" })
      .click();
    const editor = page
      .getByRole("log")
      .getByRole("group", { name: "Message composer" });
    await editor
      .getByRole("textbox", { exact: true, name: "Message" })
      .fill("Say only branch-ready. Do not use tools.");
    await editor.getByRole("button", { exact: true, name: "Send" }).click();
    await expect(page).not.toHaveURL(
      new URL(`/chat/${source.id}`, origin).href
    );
    await expect(
      page.getByRole("log").getByText(/^branch-ready[.]?$/u)
    ).toBeVisible({
      timeout: 60_000,
    });
    await expect(title).toHaveText(chat.title);
    await expect(activeChat).toHaveCount(1);
    await expect(activeChat).toHaveAttribute("href", chatHref ?? "");
    await expect(activeChat).toHaveText(chat.title);
    await expect(
      page.getByText("Ready", { exact: true }).filter({ visible: true })
    ).toHaveClass(/sr-only/u);
    const expandSidebar = page.getByRole("button", { name: "Expand sidebar" });
    if (await expandSidebar.isVisible()) {
      await expandSidebar.click();
    }
    await page.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("same-chat-edited-branch.png"),
    });
    await page
      .getByRole("log")
      .locator(".is-user")
      .getByRole("button", { exact: true, name: "Previous version" })
      .click();
    await expect(page.getByRole("log")).toContainText("trail-ready");
    await expect(activeChat).toHaveAttribute("href", chatHref ?? "");
    await expect(title).toHaveText(chat.title);
    await page.reload();
    await expect(activeChat).toHaveText(chat.title);
    await expect(title).toHaveText(chat.title);
  } finally {
    testInfo.setTimeout(testInfo.timeout + 60_000);
    await expect
      .poll(
        async () => {
          const removed = await page.request.delete(
            `/api/agent-conversations/${source.id}`,
            { headers: { origin }, timeout: 20_000 }
          );
          expect([200, 202]).toContain(removed.status());
          return removed.status();
        },
        { intervals: [1000, 2000], timeout: 55_000 }
      )
      .toBe(200);
  }
});
