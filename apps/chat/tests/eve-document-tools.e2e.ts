import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";
import type { Request, TestInfo } from "@playwright/test";
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
}, testInfo: Readonly<Pick<TestInfo, "outputPath">>) => {
  await page.route("https://unpkg.com/react-scan/**", async (route) => {
    await route.abort();
  });
  await page.goto("/api/dev-login");
  await page.goto("/");
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll(
      (links: readonly Readonly<Pick<HTMLLinkElement, "outerHTML">>[]) =>
        links
          .map((link: { readonly outerHTML: string }) => link.outerHTML)
          .join("")
    );
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
  /* oxlint-disable eslint/no-await-in-loop -- Viewport changes and screenshots operate on the same browser page. */
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
  /* oxlint-enable eslint/no-await-in-loop */
});

test("native documents open in ChatJS, retain versions after reload, and honor shared access", async ({
  page,
  browser,
}, testInfo: Readonly<Pick<TestInfo, "outputPath">>) => {
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
  await page.route("https://unpkg.com/react-scan/**", async (route) => {
    await route.abort();
  });
  await page.goto("/api/dev-login");
  await page.context().addCookies([
    {
      name: "chat-model",
      url: new URL(page.url()).origin,
      value: encodeURIComponent("openai/gpt-4.1-mini"),
    },
  ]);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(page.url()).origin,
  });
  const authSessionResponse = await page.request.get("/api/auth/get-session");
  const session = z
    .object({ user: z.object({ id: z.string() }) })
    .parse(await authSessionResponse.json());
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
      modelId: "openai/gpt-4.1-mini",
      operationId: crypto.randomUUID(),
    },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const binding = conversationBinding.parse(await created.json());
  await page.goto(`/chat/${binding.id}`);
  await Promise.all(
    ["Artifact notes", "orchard.py", "Harvest"].map(async (title) => {
      await expect(
        page.getByRole("button", { exact: true, name: `Created "${title}"` })
      ).toBeVisible({ timeout: 90_000 });
    })
  );
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  /* oxlint-disable eslint/no-await-in-loop -- Each document interaction reuses the artifact panel and clipboard; finish copying and closing before opening the next document. */
  for (const [title, content, copyLabel] of [
    ["Artifact notes", "Amber apples.", "Copy to clipboard"],
    ["orchard.py", "print(42)", "Copy code to clipboard"],
    ["Harvest", "Apple", "Copy as .csv"],
  ]) {
    await page
      .getByRole("button", { exact: true, name: `Created "${title}"` })
      .click();
    const panel = page.getByTestId("artifact");
    await expect(panel).toContainText(content);
    await panel
      .getByRole("button", {
        exact: true,
        name: copyLabel,
      })
      .click();
    expect(
      await page.evaluate(async () => await navigator.clipboard.readText())
    ).toContain(content);
    if (title === "Artifact notes") {
      await expect(
        panel.getByRole("button", { exact: true, name: "View changes" })
      ).toBeDisabled();
    }
    await expect(
      panel.getByText("Version 1 of 1", { exact: true })
    ).toBeAttached();
    await panel.screenshot({
      animations: "disabled",
      path: testInfo.outputPath(`${title.replaceAll(".", "-")}.png`),
    });
    await panel.getByRole("toolbar", { name: "Document helpers" }).hover();
    await panel.getByRole("toolbar", { name: "Document helpers" }).screenshot({
      animations: "disabled",
      path: testInfo.outputPath(
        `assistant-actions-${title.replaceAll(".", "-")}.png`
      ),
    });
    await panel.getByRole("button", { exact: true, name: "Close" }).click();
  }
  /* oxlint-enable eslint/no-await-in-loop */
  await page
    .getByRole("button", { exact: true, name: 'Created "Artifact notes"' })
    .click();
  await expect(page.getByTestId("artifact")).toContainText("Version 1 of 1");
  await page.evaluate(() => {
    navigator.clipboard.writeText =
      /* oxlint-disable typescript/promise-function-async -- The browser clipboard API rejects on permission denial; this rejection fixture has no real clipboard work to await, and eslint/require-await rejects an immediate async failure. */
      () => Promise.reject(new Error("Clipboard denied for test"));
    /* oxlint-enable typescript/promise-function-async */
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
  // Opening a receipt pins its revision; a later write must not steal that selection.
  await expect(page.getByTestId("artifact")).toContainText("Version 1 of 2");
  await page
    .getByRole("button", { exact: true, name: 'Updated "Artifact notes"' })
    .click();
  await expect(page.getByTestId("artifact")).toContainText("Version 2 of 2");
  const checkpoints = await db
    .select()
    .from(eveDocumentCheckpoint)
    .where(eq(eveDocumentCheckpoint.conversationId, binding.id))
    .orderBy(eveDocumentCheckpoint.turnIndex);
  expect(checkpoints).toEqual([]);
  const checkpointEntries = await db
    .select()
    .from(eveDocumentCheckpointEntry)
    .where(eq(eveDocumentCheckpointEntry.conversationId, binding.id));
  expect(checkpointEntries).toEqual([]);
  await page.reload();
  await page
    .getByRole("button", { exact: true, name: 'Updated "Artifact notes"' })
    .click();
  const panel = page.getByTestId("artifact");
  await expect(panel).toContainText("Cobalt pears.");
  // Rich previews may have read the previous revision. Make its cache stale before testing a failed refetch.
  await page.clock.setFixedTime(new Date(Date.now() + 120_000));
  await page.route("**/api/trpc/eve.document*", async (route) => {
    await route.abort();
  });
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
  await page.clock.setSystemTime(new Date());
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
    .getByRole("button", { exact: true, name: "View changes" })
    .click();
  await panel
    .getByRole("button", { exact: true, name: "View Previous version" })
    .click();
  await expect(panel).toContainText("Amber apples.");
  await panel
    .getByRole("button", { exact: true, name: "View Next version" })
    .click();
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
  /* oxlint-disable eslint/no-await-in-loop -- Replay the exact save twice in order to verify the completed write is idempotent. */
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const saved = await page.request.post("/api/trpc/eve.saveDocument", {
      data: { json: manualInput },
    });
    expect(saved.ok(), await saved.text()).toBe(true);
  }
  /* oxlint-enable eslint/no-await-in-loop */
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
  await panel
    .getByRole("button", { exact: true, name: "View Next version" })
    .click();
  await expect(panel).toContainText("Manual grapes.");
  await expect(panel).toContainText("Version 3 of 3");
  const editor = panel.locator(".lexical-editor");
  await expect(editor).toHaveAttribute("contenteditable", "true");
  await page.route("**/api/trpc/eve.saveDocument*", async (route) => {
    await route.abort();
  });
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
    .getByRole("button", { exact: true, name: "View changes" })
    .click();
  await panel
    .getByRole("button", { exact: true, name: "View Previous version" })
    .click();
  await expect(editor).toHaveText("Retained manual draft");
  await expect(editor).toHaveAttribute("contenteditable", "false");
  await panel
    .getByRole("button", { exact: true, name: "View Next version" })
    .click();
  await expect(editor).toHaveText("");
  await expect(editor).toHaveAttribute("contenteditable", "true");
  await editor.fill("Final manual text");
  await expect(panel).toContainText("Version 6 of 6");
  const accepted: PromiseWithResolvers<void> = Promise.withResolvers();
  const release: PromiseWithResolvers<void> = Promise.withResolvers();
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
    panel.getByRole("button", { exact: true, name: "Add comments" })
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
    (request: Readonly<Pick<Request, "method" | "url">>) =>
      request.method() === "POST" &&
      request.url().includes("/api/eve/v1/session/")
  );
  await panel.getByRole("toolbar", { name: "Document helpers" }).hover();
  await panel
    .getByRole("button", { exact: true, name: "Add comments" })
    .click();
  const actionResponse = await actionRequest;
  expect(actionResponse.headers()["x-chatjs-selected-model"]).toBe(
    config.ai.tools.code.edits
  );
  await expect(
    panel.getByRole("button", { exact: true, name: "Stop generation" })
  ).toBeVisible();
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
      reader.getByRole("toolbar", { exact: true, name: "Document helpers" })
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
