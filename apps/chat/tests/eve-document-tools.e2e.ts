/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
/* oxlint-disable unicorn/no-await-expression-member -- Direct awaited assertions keep each test action tied to its expectation. */
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
    { encoding: "utf-8" }
  );
  await page.setContent(
    `<!doctype html><html class="dark"><head>${styles}</head><body class="bg-background text-foreground">${content}</body></html>`
  );
  await expect(page.getByRole("status")).toHaveCount(2);
  await expect(page.getByRole("alert")).toHaveCount(2);
  for (const width of [1100, 390]) {
    await page.setViewportSize({ height: 850, width });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: testInfo.outputPath(`states-${width}.png`),
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
    .values({ credits: 1000, userId: session.user.id })
    .onConflictDoUpdate({
      set: { credits: sql`greatest(${userCredit.credits}, 1000)` },
      target: userCredit.userId,
    });
  const created = await page.request.post("/api/agent-conversations", {
    data: {
      message:
        'Call createTextDocument with title "Artifact notes" and content "# Orchard\n\nAmber apples.". Call createCodeDocument with title "orchard.py" and content "print(42)". Call createSheetDocument with title "Harvest" and content "Fruit,Count\nApple,3". Create exactly these three documents, use no other tools and finish briefly.',
      modelId: "openai/gpt-4.1-mini-fast",
      operationId: crypto.randomUUID(),
    },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const binding = conversationBinding.parse(await created.json());
  await page.goto(`/chat/${binding.id}`);
  for (const title of ["Artifact notes", "orchard.py", "Harvest"]) {
    await expect(
      page.getByRole("button", { exact: true, name: `Created "${title}"` })
    ).toBeVisible({ timeout: 90_000 });
  }
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  for (const [title, content] of [
    ["Artifact notes", "Amber apples."],
    ["orchard.py", "print(42)"],
    ["Harvest", "Apple"],
  ]) {
    await page
      .getByRole("button", { exact: true, name: `Created "${title}"` })
      .click();
    const panel = page.getByTestId("artifact");
    await expect(panel).toContainText(content);
    await panel
      .getByRole("button", {
        exact: true,
        name: title === "Harvest" ? "Copy as CSV" : "Copy to clipboard",
      })
      .click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      content
    );
    if (title === "Artifact notes") {
      await expect(
        panel.getByRole("button", { exact: true, name: "View changes" })
      ).toBeDisabled();
    }
    await expect(
      panel.getByText("Version 1 of 1", { exact: true })
    ).toBeInViewport();
    await panel.screenshot({
      animations: "disabled",
      path: testInfo.outputPath(`${title.replaceAll(".", "-")}.png`),
    });
    await panel
      .getByRole("button", { exact: true, name: "Improve document" })
      .click();
    await page.getByRole("menu").screenshot({
      animations: "disabled",
      path: testInfo.outputPath(
        `assistant-actions-${title.replaceAll(".", "-")}.png`
      ),
    });
    await page.keyboard.press("Escape");
    await panel.getByRole("button", { exact: true, name: "Close" }).click();
  }
  await page
    .getByRole("button", { exact: true, name: 'Created "Artifact notes"' })
    .click();
  await expect(page.getByTestId("artifact")).toContainText("Version 1 of 1");
  await page.evaluate(() => {
    navigator.clipboard.writeText = () =>
      Promise.reject(new Error("Clipboard denied for test"));
  });
  await page
    .getByTestId("artifact")
    .getByRole("button", { exact: true, name: "Copy to clipboard" })
    .click();
  const copyError = page.getByText(
    "Could not copy. Check your browser's clipboard permissions.",
    { exact: true }
  );
  await expect(copyError).toBeVisible();
  await copyError.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("copy-error.png"),
  });
  await page
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill(
      'Use readDocument to read Artifact notes, then editTextDocument to replace its content with "# Orchard\n\nCobalt pears.". Keep the title. Use the revision ID from readDocument.'
    );
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(
    page.getByRole("button", { exact: true, name: 'Updated "Artifact notes"' })
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
    .getByRole("button", { exact: true, name: 'Updated "Artifact notes"' })
    .click();
  const panel = page.getByTestId("artifact");
  await expect(panel).toContainText("Cobalt pears.");
  await page.route("**/api/trpc/eve.document*", (route) => route.abort());
  await panel
    .getByRole("button", { exact: true, name: "View changes" })
    .click();
  await panel.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("comparison-loading.png"),
  });
  await expect(
    panel.getByRole("button", { exact: true, name: "Retry comparison" })
  ).toBeVisible();
  await panel.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("comparison-error.png"),
  });
  await page.unroute("**/api/trpc/eve.document*");
  await panel
    .getByRole("button", { exact: true, name: "Retry comparison" })
    .click();
  const comparison = panel.getByRole("region", {
    exact: true,
    name: "Document changes",
  });
  await expect(comparison).toContainText("Cobalt pears.");
  await expect(comparison.locator(".line-through")).toContainText(
    "Amber apples"
  );
  await panel.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("comparison.png"),
  });
  await panel
    .getByRole("button", { exact: true, name: "Show document" })
    .click();
  await panel.getByRole("button", { exact: true, name: "Previous" }).click();
  await expect(panel).toContainText("Amber apples.");
  await panel.getByRole("button", { exact: true, name: "Next" }).click();
  await expect(panel).toContainText("Cobalt pears.");
  await page.setViewportSize({ height: 844, width: 390 });
  await expect(panel).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("artifact-mobile.png"),
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
    content: "# Orchard\n\nManual grapes.",
    conversationId: binding.id,
    documentId: latest.documentId,
    expectedRevisionId: latest.id,
    operationId: crypto.randomUUID(),
    title: latest.title,
  };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const saved = await page.request.post("/api/trpc/eve.saveDocument", {
      data: { json: manualInput },
    });
    expect(saved.ok(), await saved.text()).toBe(true);
  }
  const conflict = await page.request.post("/api/trpc/eve.saveDocument", {
    data: {
      json: {
        ...manualInput,
        content: "Stale replacement",
        operationId: crypto.randomUUID(),
      },
    },
  });
  expect(conflict.status()).toBe(409);
  await page.reload();
  await page
    .getByRole("button", { exact: true, name: 'Updated "Artifact notes"' })
    .click();
  await panel.getByRole("button", { exact: true, name: "Next" }).click();
  await expect(panel).toContainText("Manual grapes.");
  await expect(panel).toContainText("Version 3 of 3");
  const editor = panel.locator(".lexical-editor");
  await expect(editor).toHaveAttribute("contenteditable", "true");
  await page.route("**/api/trpc/eve.saveDocument*", (route) => route.abort());
  await editor.fill("Retained manual draft");
  await expect(panel.getByRole("button", { name: "Retry save" })).toBeVisible();
  await panel.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("manual-save-failed.png"),
  });
  await page.reload();
  await page
    .getByRole("button", { exact: true, name: 'Updated "Artifact notes"' })
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
    .getByRole("button", { exact: true, name: "View changes" })
    .click();
  await expect(comparison.locator(".line-through")).toContainText(
    "Retained manual draft"
  );
  await panel.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("comparison-empty.png"),
  });
  await panel
    .getByRole("button", { exact: true, name: "Show document" })
    .click();
  await panel.getByRole("button", { exact: true, name: "Previous" }).click();
  await expect(editor).toHaveText("Retained manual draft");
  await expect(editor).toHaveAttribute("contenteditable", "false");
  await panel.getByRole("button", { exact: true, name: "Next" }).click();
  await expect(editor).toHaveText("");
  await expect(editor).toHaveAttribute("contenteditable", "true");
  await editor.fill("Final manual text");
  await expect(panel).toContainText("Version 6 of 6");
  const accepted = Promise.withResolvers<undefined>();
  const release = Promise.withResolvers<undefined>();
  await page.route(
    "**/api/trpc/eve.saveDocument*",
    async (route) => {
      const response = await route.fetch();
      accepted.resolve(undefined);
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
    release.resolve(undefined);
  }
  await expect(panel).toContainText("Version 8 of 8");
  await expect(editor).toHaveText("Newer queued content");
  await expect(panel).toContainText("All changes saved");
  await panel.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("manual-saved.png"),
  });
  await panel.getByRole("button", { exact: true, name: "Close" }).click();
  await page
    .getByRole("button", { exact: true, name: 'Created "orchard.py"' })
    .click();
  const code = panel.locator(".cm-content");
  await code.fill("print(73)");
  await expect(panel).toContainText("Version 2 of 2");
  await expect(code).toHaveText("print(73)");
  await expect(code).toBeFocused();
  await expect(panel).toContainText("All changes saved");
  await panel.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("manual-code.png"),
  });
  await code.fill("");
  await expect(
    panel.getByRole("button", { exact: true, name: "Improve document" })
  ).toBeDisabled();
  await expect(panel).toContainText("Version 3 of 3");
  await expect(code).toHaveText("");
  await code.fill("def add(a, b):\n    return a + b");
  await expect(panel).toContainText("Version 4 of 4");
  await expect(panel).toContainText("All changes saved");
  await page.setViewportSize({ height: 850, width: 1100 });
  const composer = page.getByRole("textbox", { exact: true, name: "Message" });
  await composer.fill("Keep this composer draft.");
  const actionRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      request.url().includes("/api/eve/v1/session/")
  );
  await panel
    .getByRole("button", { exact: true, name: "Improve document" })
    .click();
  await page
    .getByRole("menuitem", { exact: true, name: "Add comments" })
    .click();
  expect((await actionRequest).headers()["x-chatjs-selected-model"]).toBe(
    config.ai.tools.code.edits
  );
  await expect(
    panel.getByRole("button", { exact: true, name: "Improve document" })
  ).toBeDisabled();
  await expect(panel).toContainText("Version 5 of 5", { timeout: 90_000 });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  await expect(code).toContainText("def add");
  await expect(composer).toHaveText("Keep this composer draft.");
  await panel.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("assistant-comments.png"),
  });
  await page.setViewportSize({ height: 844, width: 390 });
  await panel.getByRole("button", { exact: true, name: "Close" }).click();
  await page
    .getByRole("button", { exact: true, name: 'Created "Harvest"' })
    .click();
  await expect(panel).toContainText("All changes saved");
  await panel.getByRole("gridcell", { exact: true, name: "Apple" }).click();
  await panel.getByRole("textbox").fill("Peach");
  await panel.getByRole("textbox").press("Enter");
  await expect(panel).toContainText("Version 2 of 2");
  await expect(
    panel.getByRole("gridcell", { exact: true, name: "Peach" })
  ).toBeVisible();
  await expect(panel).toContainText("All changes saved");
  await panel.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("manual-sheet.png"),
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
      .getByRole("button", { exact: true, name: 'Updated "Artifact notes"' })
      .click();
    await expect(
      reader.getByRole("region", { exact: true, name: "Document" })
    ).toContainText("Cobalt pears.");
    await expect(
      reader.getByRole("button", { exact: true, name: "Improve document" })
    ).toHaveCount(0);
    await reader
      .getByRole("button", { exact: true, name: "View changes" })
      .click();
    await expect(
      reader.getByRole("region", { exact: true, name: "Document changes" })
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
      reader.getByRole("region", { exact: true, name: "Document" })
    ).toHaveCount(0);
  } finally {
    await publicContext.close();
    await db
      .update(eveConversation)
      .set({ visibility: "private" })
      .where(eq(eveConversation.id, binding.id));
  }
});
