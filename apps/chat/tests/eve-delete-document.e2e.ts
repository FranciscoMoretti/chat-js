import { expect, test } from "@playwright/test";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "../lib/db/client";
import { eveConversation, eveDocumentHead, userCredit } from "../lib/db/schema";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

test("installed deleteDocument requires approval, survives reload, and honors rejection", async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const session = z.object({ user: z.object({ id: z.string() }) }).parse(
    await page.evaluate(async () => {
      const response = await fetch("/api/auth/get-session");
      return await response.json();
    })
  );
  await db
    .insert(userCredit)
    .values({ credits: 1000, userId: session.user.id })
    .onConflictDoUpdate({
      set: { credits: sql`greatest(${userCredit.credits}, 1000)` },
      target: userCredit.userId,
    });
  await page.context().addCookies([
    {
      name: "chat-model",
      url: new URL(page.url()).origin,
      value: encodeURIComponent("openai/gpt-4.1-mini"),
    },
  ]);
  await page.goto("/");
  const composer = page.getByRole("textbox", { exact: true, name: "Message" });
  await composer.fill(
    'Call createTextDocument with title "Approval orchard" and content "Apples and pears.". Do not use other tools. Finish briefly.'
  );
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(
    page.getByRole("button", {
      exact: true,
      name: 'Created "Approval orchard"',
    })
  ).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  const chatId = new URL(page.url()).pathname.split("/").at(-1);
  if (!chatId) {
    throw new Error("Missing conversation");
  }
  const [document] = await db
    .select({
      conversationId: eveDocumentHead.conversationId,
      documentId: eveDocumentHead.documentId,
    })
    .from(eveDocumentHead)
    .innerJoin(
      eveConversation,
      eq(eveConversation.id, eveDocumentHead.conversationId)
    )
    .where(
      and(
        eq(eveConversation.chatId, chatId),
        eq(eveConversation.ownerId, session.user.id)
      )
    );
  if (!document) {
    throw new Error("Missing created document");
  }
  const { conversationId } = document;
  const deletionPrompt = `Read document ${document.documentId} with readDocument and then call deleteDocument using its exact title and current revision. I want it removed from this conversation. Call the tool now; its built-in approval controls will ask me to approve. Do not ask for confirmation in a chat message.`;
  await composer.fill(deletionPrompt);
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(
    page.getByRole("button", { exact: true, name: "Approve" })
  ).toBeVisible({ timeout: 90_000 });
  await page.reload();
  await expect(
    page.getByRole("button", { exact: true, name: "Approve" })
  ).toBeVisible();
  await expect(page.getByRole("log")).toContainText(
    '"title": "Approval orchard"'
  );
  await page
    .getByRole("region", { name: "Tool result" })
    .filter({ has: page.getByRole("button", { exact: true, name: "Approve" }) })
    .screenshot({ path: testInfo.outputPath("approval.png") });
  await page.getByRole("button", { exact: true, name: "Cancel" }).click();
  await expect(
    page.getByText("Request declined.", { exact: true })
  ).toBeVisible();
  expect(
    await db
      .select()
      .from(eveDocumentHead)
      .where(eq(eveDocumentHead.conversationId, conversationId))
  ).toHaveLength(1);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await composer.fill(deletionPrompt);
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(
    page.getByRole("button", { exact: true, name: "Approve" })
  ).toBeVisible({ timeout: 90_000 });
  await page.getByRole("button", { exact: true, name: "Approve" }).click();
  await expect(
    page.getByText("Tool completed.", { exact: true })
  ).toBeVisible();
  await expect
    .poll(
      async () =>
        await db
          .select()
          .from(eveDocumentHead)
          .where(eq(eveDocumentHead.conversationId, conversationId))
    )
    .toHaveLength(0);
  await expect(
    page
      .getByText("Document is no longer available in this conversation.")
      .last()
  ).toBeAttached();
  await page
    .getByRole("region", { name: "Tool result" })
    .last()
    .screenshot({ path: testInfo.outputPath("deleted.png") });
});
