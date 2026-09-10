import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../lib/db/client";
import {
  eveConversation,
  eveDocumentCheckpoint,
  eveDocumentCheckpointEntry,
  userCredit,
} from "../lib/db/schema";
import { conversationBinding } from "../lib/eve/contracts";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

test("document tool states remain readable on desktop and mobile", async ({
  page,
}, testInfo) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  await page.goto("/");
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.outerHTML).join(""));
  const content = execFileSync(
    "bun",
    ["tests/eve-document-renderer-fixture.ts"],
    { encoding: "utf8" }
  );
  await page.setContent(
    `<!doctype html><html class="dark"><head>${styles}</head><body class="bg-background text-foreground">${content}</body></html>`
  );
  await expect(page.getByRole("status")).toHaveCount(2);
  await expect(page.getByRole("alert")).toHaveCount(2);
  for (const width of [1100, 390]) {
    await page.setViewportSize({ width, height: 850 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: testInfo.outputPath(`states-${width}.png`),
      fullPage: true,
      animations: "disabled",
    });
  }
});

test("native documents open in ChatJS, retain versions after reload, and honor shared access", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(240_000);
  // Keep the development-only floating query inspector out of product controls and captures.
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent =
        '[aria-label="Open Tanstack query devtools"] { display: none !important; }';
      document.head.append(style);
    });
  });
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const session = z
    .object({ user: z.object({ id: z.string() }) })
    .parse(await (await page.request.get("/api/auth/get-session")).json());
  await db
    .insert(userCredit)
    .values({ userId: session.user.id, credits: 1000 })
    .onConflictDoUpdate({
      target: userCredit.userId,
      set: { credits: sql`greatest(${userCredit.credits}, 1000)` },
    });
  const created = await page.request.post("/api/agent-conversations", {
    headers: { origin: new URL(page.url()).origin },
    data: {
      operationId: crypto.randomUUID(),
      modelId: "openai/gpt-4.1-mini-fast",
      message:
        'Call createTextDocument with title "Artifact notes" and content "# Orchard\n\nAmber apples.". Call createCodeDocument with title "orchard.py" and content "print(42)". Call createSheetDocument with title "Harvest" and content "Fruit,Count\nApple,3". Create exactly these three documents, use no other tools and finish briefly.',
    },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const binding = conversationBinding.parse(await created.json());
  await page.goto(`/chat/${binding.id}`);
  for (const title of ["Artifact notes", "orchard.py", "Harvest"]) {
    await expect(
      page.getByRole("button", { name: `Created "${title}"`, exact: true })
    ).toBeVisible({ timeout: 90_000 });
  }
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  for (const [title, content] of [
    ["Artifact notes", "Amber apples."],
    ["orchard.py", "print(42)"],
    ["Harvest", "Apple"],
  ]) {
    await page
      .getByRole("button", { name: `Created "${title}"`, exact: true })
      .click();
    const panel = page.getByTestId("artifact");
    await expect(panel).toContainText(content);
    await expect(
      panel.getByText("Version 1 of 1", { exact: true })
    ).toBeInViewport();
    await panel.screenshot({
      path: testInfo.outputPath(`${title.replaceAll(".", "-")}.png`),
      animations: "disabled",
    });
    await panel.getByRole("button", { name: "Close", exact: true }).click();
  }
  await page
    .getByRole("button", { name: 'Created "Artifact notes"', exact: true })
    .click();
  await expect(page.getByTestId("artifact")).toContainText("Version 1 of 1");
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill(
      'Use readDocument to read Artifact notes, then editTextDocument to replace its content with "# Orchard\n\nCobalt pears.". Keep the title. Use the revision ID from readDocument.'
    );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("button", { name: 'Updated "Artifact notes"', exact: true })
  ).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("artifact")).toContainText("Version 1 of 2");
  const checkpoints = await db
    .select()
    .from(eveDocumentCheckpoint)
    .where(eq(eveDocumentCheckpoint.conversationId, binding.id))
    .orderBy(eveDocumentCheckpoint.turnIndex);
  expect(checkpoints.map((checkpoint) => checkpoint.turnIndex)).toEqual([0, 1]);
  const checkpointEntries = await db
    .select()
    .from(eveDocumentCheckpointEntry)
    .where(eq(eveDocumentCheckpointEntry.conversationId, binding.id));
  expect(checkpointEntries).toHaveLength(3);
  expect(checkpointEntries.every((entry) => entry.turnIndex === 1)).toBe(true);
  await page.reload();
  await page
    .getByRole("button", { name: 'Updated "Artifact notes"', exact: true })
    .click();
  const panel = page.getByTestId("artifact");
  await expect(panel).toContainText("Cobalt pears.");
  await panel.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(panel).toContainText("Amber apples.");
  await panel.getByRole("button", { name: "Next", exact: true }).click();
  await expect(panel).toContainText("Cobalt pears.");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: testInfo.outputPath("artifact-mobile.png"),
    animations: "disabled",
  });
  await page.goto("/");
  await expect(page.getByTestId("artifact")).toHaveCount(0);
  await db
    .update(eveConversation)
    .set({ visibility: "public" })
    .where(eq(eveConversation.id, binding.id));
  const publicContext = await browser.newContext();
  try {
    const reader = await publicContext.newPage();
    await reader.goto(new URL(`/share/${binding.id}`, page.url()).href);
    await reader
      .getByRole("button", { name: 'Updated "Artifact notes"', exact: true })
      .click();
    await expect(
      reader.getByRole("region", { name: "Document", exact: true })
    ).toContainText("Cobalt pears.");
    await db
      .update(eveConversation)
      .set({ visibility: "private" })
      .where(eq(eveConversation.id, binding.id));
    await reader.reload();
    await expect(
      reader.getByRole("region", { name: "Document", exact: true })
    ).toHaveCount(0);
  } finally {
    await publicContext.close();
    await db
      .update(eveConversation)
      .set({ visibility: "private" })
      .where(eq(eveConversation.id, binding.id));
  }
});
