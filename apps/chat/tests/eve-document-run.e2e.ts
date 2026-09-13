import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { Client } from "eve/client";

import { db } from "../lib/db/client";
import { eveConversation, eveUsage } from "../lib/db/schema";
import { env } from "../lib/env";
import { conversationBinding } from "../lib/eve/contracts";
import { evePlatformResult } from "../lib/eve/platform-result";
import { reconcileEveUsage } from "../lib/eve/reconcile-usage";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);

test("saved-code controls cover pending, disabled, denied and error states", async ({
  page,
}, testInfo) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  await page.goto("/");
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.outerHTML).join(""));
  const content = execFileSync("bun", ["tests/eve-document-run-fixture.ts"], {
    encoding: "utf8",
  });
  await page.setContent(
    `<!doctype html><html class="dark"><head>${styles}</head><body class="bg-background text-foreground">${content}</body></html>`
  );
  await expect(page.getByRole("alert")).toHaveCount(2);
  await expect(page.getByRole("status")).toHaveText("Running saved code…");
  await expect(page.getByText("Document execution declined.")).toBeVisible();
  await expect(
    page
      .getByRole("button", { name: "Run code" })
      .and(page.locator(":disabled"))
  ).toHaveCount(2);
  for (const width of [1100, 390]) {
    await page.setViewportSize({ width, height: 850 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: testInfo.outputPath(`run-states-${width}.png`),
      fullPage: true,
      animations: "disabled",
    });
  }
});

test("artifact Run executes saved source, retains output across reload and sharing, and bills once", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(20_000);
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent =
        'nextjs-portal, [aria-label="Open Tanstack query devtools"] { display: none !important; }';
      document.head.append(style);
    });
  });
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const created = await page.request.post("/api/agent-conversations", {
    headers: { origin: new URL(page.url()).origin },
    data: {
      operationId: crypto.randomUUID(),
      modelId: "openai/gpt-4.1-mini-fast",
      message:
        'Call createCodeDocument once with title "saved.js" and content "console.log(42)". Do not execute it. Use no other tools.',
    },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const binding = conversationBinding.parse(await created.json());
  await page.goto(`/chat/${binding.id}`);
  await page
    .getByRole("button", { name: 'Created "saved.js"', exact: true })
    .click({ timeout: 90_000 });
  const panel = page.getByRole("region", { name: "Document", exact: true });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  const code = panel.locator(".cm-content");
  await code.fill('console.log("saved-revision-73")');
  await expect(
    panel.getByRole("button", { name: "Run code", exact: true })
  ).toBeDisabled();
  await expect(panel).toContainText("Version 2 of 2");
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  await composer.fill("Preserve this draft.");
  await panel.getByRole("button", { name: "Run code", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "Run code", exact: true })
  ).toBeDisabled();
  const output = panel.getByTestId("document-run-result");
  await output
    .getByRole("tab", { name: "Output", exact: true })
    .click({ timeout: 90_000 });
  await expect(output.getByRole("tabpanel")).toContainText("saved-revision-73");
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  await expect(composer).toHaveText("Preserve this draft.");
  await panel.screenshot({
    path: testInfo.outputPath("saved-code-output.png"),
    animations: "disabled",
  });

  const [conversation] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, binding.id));
  const client = new Client({
    host: env.EVE_INTERNAL_ORIGIN ?? "",
    auth: { bearer: env.EVE_GATEWAY_SECRET ?? "" },
    headers: { "x-chatjs-owner": conversation.ownerId },
  });
  const snapshot = await client.sessions
    .attach(binding.sessionId)
    .snapshot({ signal: AbortSignal.timeout(15_000) });
  const executions = snapshot.events.filter(
    (event) =>
      event.type === "action.result" &&
      event.data.result.kind === "tool-result" &&
      event.data.result.toolName === "runCodeDocument"
  );
  expect(executions).toHaveLength(1);
  const event = executions[0];
  if (
    event?.type !== "action.result" ||
    event.data.result.kind !== "tool-result"
  ) {
    throw new Error("Missing native saved-code result");
  }
  const result = evePlatformResult.parse(event.data.result.output);
  expect(result.output).toMatchObject({
    code: 'console.log("saved-revision-73")',
    language: "javascript",
  });
  expect(result.usage.costUsd).toBe(0.05);
  await reconcileEveUsage(conversation.ownerId, binding.sessionId);
  const evidenceId = `eve-tool:${binding.sessionId}:${event.data.result.callId}`;
  const before = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.eventId, evidenceId));
  expect(before).toHaveLength(1);
  expect(Number(before[0].costUsd)).toBe(0.05);
  await reconcileEveUsage(conversation.ownerId, binding.sessionId);
  expect(
    await db.select().from(eveUsage).where(eq(eveUsage.eventId, evidenceId))
  ).toEqual(before);

  await page.reload();
  await page
    .getByRole("button", { name: 'Created "saved.js"', exact: true })
    .click();
  await panel.getByRole("button", { name: "Next", exact: true }).click();
  await output.getByRole("tab", { name: "Output", exact: true }).click();
  await expect(output.getByRole("tabpanel")).toContainText("saved-revision-73");
  await panel.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(output).toHaveCount(0);
  await expect(
    panel.getByRole("button", { name: "Run code", exact: true })
  ).toBeDisabled();

  await db
    .update(eveConversation)
    .set({ visibility: "public" })
    .where(eq(eveConversation.id, binding.id));
  const publicContext = await browser.newContext();
  try {
    await publicContext.route("https://unpkg.com/react-scan/**", (route) =>
      route.abort()
    );
    await publicContext.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const style = document.createElement("style");
        style.textContent =
          'nextjs-portal, [aria-label="Open Tanstack query devtools"] { display: none !important; }';
        document.head.append(style);
      });
    });
    const reader = await publicContext.newPage();
    reader.setDefaultTimeout(20_000);
    await reader.goto(new URL(`/share/${binding.id}`, page.url()).href);
    await reader
      .getByRole("button", { name: 'Created "saved.js"', exact: true })
      .click();
    const shared = reader.getByRole("region", {
      name: "Document",
      exact: true,
    });
    await shared.getByRole("button", { name: "Next", exact: true }).click();
    await expect(
      shared.getByRole("button", { name: "Run code", exact: true })
    ).toHaveCount(0);
    const sharedOutput = shared.getByTestId("document-run-result");
    await sharedOutput
      .getByRole("tab", { name: "Output", exact: true })
      .click();
    await expect(sharedOutput.getByRole("tabpanel")).toContainText(
      "saved-revision-73"
    );
    await reader.setViewportSize({ width: 390, height: 844 });
    await shared.screenshot({
      path: testInfo.outputPath("shared-code-output-mobile.png"),
      animations: "disabled",
    });
  } finally {
    await publicContext.close();
  }
});
