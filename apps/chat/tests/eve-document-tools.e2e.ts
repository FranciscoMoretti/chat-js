import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { config } from "../lib/config";
import { db } from "../lib/db/client";
import {
  eveConversation,
  eveDocumentCheckpoint,
  eveDocumentCheckpointEntry,
  eveDocumentRevision,
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
  page.setDefaultTimeout(20_000);
  // Keep the development-only floating query inspector out of product controls and captures.
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent =
        '[aria-label="Open Tanstack query devtools"], nextjs-portal { display: none !important; }';
      document.head.append(style);
    });
  });
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(page.url()).origin,
  });
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
    await panel
      .getByRole("button", {
        name: title === "Harvest" ? "Copy as CSV" : "Copy to clipboard",
        exact: true,
      })
      .click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      content
    );
    if (title === "Artifact notes") {
      await expect(
        panel.getByRole("button", { name: "View changes", exact: true })
      ).toBeDisabled();
    }
    await expect(
      panel.getByText("Version 1 of 1", { exact: true })
    ).toBeInViewport();
    await panel.screenshot({
      path: testInfo.outputPath(`${title.replaceAll(".", "-")}.png`),
      animations: "disabled",
    });
    await panel
      .getByRole("button", { name: "Improve document", exact: true })
      .click();
    await page.getByRole("menu").screenshot({
      path: testInfo.outputPath(
        `assistant-actions-${title.replaceAll(".", "-")}.png`
      ),
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await panel.getByRole("button", { name: "Close", exact: true }).click();
  }
  await page
    .getByRole("button", { name: 'Created "Artifact notes"', exact: true })
    .click();
  await expect(page.getByTestId("artifact")).toContainText("Version 1 of 1");
  await page.evaluate(() => {
    navigator.clipboard.writeText = () =>
      Promise.reject(new Error("Clipboard denied for test"));
  });
  await page
    .getByTestId("artifact")
    .getByRole("button", { name: "Copy to clipboard", exact: true })
    .click();
  const copyError = page.getByText(
    "Could not copy. Check your browser's clipboard permissions.",
    { exact: true }
  );
  await expect(copyError).toBeVisible();
  await copyError.screenshot({
    path: testInfo.outputPath("copy-error.png"),
    animations: "disabled",
  });
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
  await page.route("**/api/trpc/eve.document*", (route) => route.abort());
  await panel
    .getByRole("button", { name: "View changes", exact: true })
    .click();
  await panel.screenshot({
    path: testInfo.outputPath("comparison-loading.png"),
    animations: "disabled",
  });
  await expect(
    panel.getByRole("button", { name: "Retry comparison", exact: true })
  ).toBeVisible();
  await panel.screenshot({
    path: testInfo.outputPath("comparison-error.png"),
    animations: "disabled",
  });
  await page.unroute("**/api/trpc/eve.document*");
  await panel
    .getByRole("button", { name: "Retry comparison", exact: true })
    .click();
  const comparison = panel.getByRole("region", {
    name: "Document changes",
    exact: true,
  });
  await expect(comparison).toContainText("Cobalt pears.");
  await expect(comparison.locator(".line-through")).toContainText(
    "Amber apples"
  );
  await panel.screenshot({
    path: testInfo.outputPath("comparison.png"),
    animations: "disabled",
  });
  await panel
    .getByRole("button", { name: "Show document", exact: true })
    .click();
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
  const [latest] = await db
    .select()
    .from(eveDocumentRevision)
    .where(
      and(
        eq(eveDocumentRevision.conversationId, binding.id),
        eq(eveDocumentRevision.title, "Artifact notes")
      )
    )
    .orderBy(desc(eveDocumentRevision.createdAt))
    .limit(1);
  const manualInput = {
    conversationId: binding.id,
    documentId: latest.documentId,
    expectedRevisionId: latest.id,
    operationId: crypto.randomUUID(),
    title: latest.title,
    content: "# Orchard\n\nManual grapes.",
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const saved = await page.request.post("/api/trpc/eve.saveDocument", {
      data: { json: manualInput },
    });
    expect(saved.ok(), await saved.text()).toBe(true);
  }
  const conflict = await page.request.post("/api/trpc/eve.saveDocument", {
    data: {
      json: {
        ...manualInput,
        operationId: crypto.randomUUID(),
        content: "Stale replacement",
      },
    },
  });
  expect(conflict.status()).toBe(409);
  await page.reload();
  await page
    .getByRole("button", { name: 'Updated "Artifact notes"', exact: true })
    .click();
  await panel.getByRole("button", { name: "Next", exact: true }).click();
  await expect(panel).toContainText("Manual grapes.");
  await expect(panel).toContainText("Version 3 of 3");
  const editor = panel.locator(".lexical-editor");
  await expect(editor).toHaveAttribute("contenteditable", "true");
  await page.route("**/api/trpc/eve.saveDocument*", (route) => route.abort());
  await editor.fill("Retained manual draft");
  await expect(panel.getByRole("button", { name: "Retry save" })).toBeVisible();
  await panel.screenshot({
    path: testInfo.outputPath("manual-save-failed.png"),
    animations: "disabled",
  });
  await page.reload();
  await page
    .getByRole("button", { name: 'Updated "Artifact notes"', exact: true })
    .click();
  await expect(editor).toHaveText("Retained manual draft");
  await expect(panel.getByRole("button", { name: "Retry save" })).toBeVisible();
  await page.unroute("**/api/trpc/eve.saveDocument*");
  await panel.getByRole("button", { name: "Retry save" }).click();
  await expect(panel).toContainText("All changes saved");
  await expect(panel).toContainText("Version 4 of 4");
  await editor.fill("");
  await expect(panel).toContainText("Version 5 of 5");
  await expect(editor).toHaveText("");
  await panel
    .getByRole("button", { name: "View changes", exact: true })
    .click();
  await expect(comparison.locator(".line-through")).toContainText(
    "Retained manual draft"
  );
  await panel.screenshot({
    path: testInfo.outputPath("comparison-empty.png"),
    animations: "disabled",
  });
  await panel
    .getByRole("button", { name: "Show document", exact: true })
    .click();
  await panel.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(editor).toHaveText("Retained manual draft");
  await expect(editor).toHaveAttribute("contenteditable", "false");
  await panel.getByRole("button", { name: "Next", exact: true }).click();
  await expect(editor).toHaveText("");
  await expect(editor).toHaveAttribute("contenteditable", "true");
  await editor.fill("Final manual text");
  await expect(panel).toContainText("Version 6 of 6");
  const accepted = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  await page.route(
    "**/api/trpc/eve.saveDocument*",
    async (route) => {
      const response = await route.fetch();
      accepted.resolve();
      await release.promise;
      await route.fulfill({ response });
    },
    { times: 1 }
  );
  try {
    await editor.fill("First queued save");
    await accepted.promise;
    await editor.fill("Newer queued content");
  } finally {
    release.resolve();
  }
  await expect(panel).toContainText("Version 8 of 8");
  await expect(editor).toHaveText("Newer queued content");
  await expect(panel).toContainText("All changes saved");
  await panel.screenshot({
    path: testInfo.outputPath("manual-saved.png"),
    animations: "disabled",
  });
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: 'Created "orchard.py"', exact: true })
    .click();
  const code = panel.locator(".cm-content");
  await code.fill("print(73)");
  await expect(panel).toContainText("Version 2 of 2");
  await expect(code).toHaveText("print(73)");
  await expect(code).toBeFocused();
  await expect(panel).toContainText("All changes saved");
  await panel.screenshot({
    path: testInfo.outputPath("manual-code.png"),
    animations: "disabled",
  });
  await code.fill("");
  await expect(
    panel.getByRole("button", { name: "Improve document", exact: true })
  ).toBeDisabled();
  await expect(panel).toContainText("Version 3 of 3");
  await expect(code).toHaveText("");
  await code.fill("def add(a, b):\n    return a + b");
  await expect(panel).toContainText("Version 4 of 4");
  await expect(panel).toContainText("All changes saved");
  await page.setViewportSize({ width: 1100, height: 850 });
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  await composer.fill("Keep this composer draft.");
  const actionRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      request.url().includes("/api/eve/v1/session/")
  );
  await panel
    .getByRole("button", { name: "Improve document", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Add comments", exact: true })
    .click();
  expect((await actionRequest).headers()["x-chatjs-selected-model"]).toBe(
    config.ai.tools.code.edits
  );
  await expect(
    panel.getByRole("button", { name: "Improve document", exact: true })
  ).toBeDisabled();
  await expect(panel).toContainText("Version 5 of 5", { timeout: 90_000 });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  await expect(code).toContainText("def add");
  await expect(composer).toHaveText("Keep this composer draft.");
  await panel.screenshot({
    path: testInfo.outputPath("assistant-comments.png"),
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: 'Created "Harvest"', exact: true })
    .click();
  await expect(panel).toContainText("All changes saved");
  await panel.getByRole("gridcell", { name: "Apple", exact: true }).click();
  await panel.getByRole("textbox").fill("Peach");
  await panel.getByRole("textbox").press("Enter");
  await expect(panel).toContainText("Version 2 of 2");
  await expect(
    panel.getByRole("gridcell", { name: "Peach", exact: true })
  ).toBeVisible();
  await expect(panel).toContainText("All changes saved");
  await panel.screenshot({
    path: testInfo.outputPath("manual-sheet.png"),
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
    const denied = await publicContext.request.post(
      new URL("/api/trpc/eve.saveDocument", page.url()).href,
      { data: { json: manualInput } }
    );
    expect(denied.status()).toBe(401);
    await reader.goto(new URL(`/share/${binding.id}`, page.url()).href);
    await reader
      .getByRole("button", { name: 'Updated "Artifact notes"', exact: true })
      .click();
    await expect(
      reader.getByRole("region", { name: "Document", exact: true })
    ).toContainText("Cobalt pears.");
    await expect(
      reader.getByRole("button", { name: "Improve document", exact: true })
    ).toHaveCount(0);
    await reader
      .getByRole("button", { name: "View changes", exact: true })
      .click();
    await expect(
      reader.getByRole("region", { name: "Document changes", exact: true })
    ).toContainText("Amber apples");
    await expect(reader.locator(".lexical-editor")).toHaveAttribute(
      "contenteditable",
      "false"
    );
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
