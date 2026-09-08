import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { db } from "../lib/db/client";
import { eveConversation, eveUsage } from "../lib/db/schema";
import { reconcileEveUsage } from "../lib/eve/reconcile-usage";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

const conversationUrl = /\/chat\/[^/]+$/;

test("real provider, native application tool and replay-safe usage ledger", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill(
      'Use the wordCount tool to count "one two three four". Report the result as "4 words".'
    );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page).toHaveURL(conversationUrl);
  await expect(page.getByText("Words", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByRole("log")).toContainText("4 words", {
    timeout: 90_000,
  });
  const id = new URL(page.url()).pathname.split("/").at(-1);
  if (!id) {
    throw new Error("Missing conversation identity.");
  }
  const [conversation] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, id));
  if (!conversation?.sessionId) {
    throw new Error("Missing session binding.");
  }
  const usage = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.sessionId, conversation.sessionId));
  expect(usage.length).toBeGreaterThan(0);
  expect(usage.every((row) => row.costUsd !== null)).toBe(true);
  const charged = usage.reduce((total, row) => total + row.chargedCents, 0);
  expect(charged).toBeGreaterThan(0);
  await reconcileEveUsage(conversation.ownerId, conversation.sessionId);
  const replayed = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.sessionId, conversation.sessionId));
  expect(replayed.reduce((total, row) => total + row.chargedCents, 0)).toBe(
    charged
  );
  await page.reload();
  await expect(page.getByRole("log")).toContainText("4 words");
  await mkdir("tests/eve-results/screenshots", { recursive: true });
  const toolCard = page
    .getByText("Words", { exact: true })
    .locator("..")
    .locator("..");
  await toolCard.screenshot({
    path: "tests/eve-results/screenshots/tool-word-count.png",
    animations: "disabled",
  });
});
