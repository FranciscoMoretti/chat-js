/* oxlint-disable import/max-dependencies, import/no-nodejs-modules, import/no-relative-parent-imports  --
 * import/max-dependencies (#524): import from "node:child_process" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-nodejs-modules (#529): This test harness requires import { execFileSync } from "node:child_process";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/schema"; "../lib/env"; "../lib/eve/connection-options"; "../lib/eve/contracts" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { Client } from "eve/client";

import { db } from "../lib/db/client";
import { eveConversation, eveUsage } from "../lib/db/schema";
import { env } from "../lib/env";
import { getEveConnectionOptions } from "../lib/eve/connection-options";
import { conversationBinding } from "../lib/eve/contracts";
import { reconcileEveUsage } from "../lib/eve/reconcile-usage";
import { toolResultSchema } from "../lib/eve/tool-result";
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable import/max-dependencies, import/no-nodejs-modules, import/no-relative-parent-imports */

assertEveTestDatabase(env.DATABASE_URL);

/* oxlint-disable max-statements, no-magic-numbers, node/no-sync, typescript/prefer-readonly-parameter-types, typescript/promise-function-async  --
 * max-statements (#512): test("saved-code controls cover pending, disabled, denied and error states") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("saved-code controls cover pending, disabled, denied and error states") uses 2, 1100, 390 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * node/no-sync (#538): test("saved-code controls cover pending, disabled, denied and error states") uses execFileSync("bun", ["tests/eve-document-run-fixture.ts"], { encoding: "utf-8", }) within its synchronous fixture setup contract; asynchronous conversion changes its callers and lifecycle.
 * oxc/no-async-await (#540): test("saved-code controls cover pending, disabled, denied and error states") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test("saved-code controls cover pending, disabled, denied and error states") accepts { page, }; testInfo; route; links; link; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("saved-code controls cover pending, disabled, denied and error states") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
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
    encoding: "utf-8",
  });
  await page.setContent(
    `<!doctype html><html class="dark"><head>${styles}</head><body class="bg-background text-foreground">${content}</body></html>`
  );
  await expect(page.getByRole("alert")).toHaveCount(2);
  await expect(page.getByRole("status")).toHaveText("Running saved code…");
  await expect(page.getByText("Document execution declined.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Run" }).and(page.locator(":disabled"))
  ).toHaveCount(2);
  for (const width of [1100, 390]) {
    await page.setViewportSize({ height: 850, width });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: testInfo.outputPath(`run-states-${width}.png`),
    });
  }
});
/* oxlint-enable max-statements, no-magic-numbers, node/no-sync, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async  --
 * max-lines-per-function (#510): test("artifact Run executes saved source, retains output across reload and sharing, a keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("artifact Run executes saved source, retains output across reload and sharing, a keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("artifact Run executes saved source, retains output across reload and sharing, a uses 180_000, 20_000, 15_000, 1, 0.05, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("artifact Run executes saved source, retains output across reload and sharing, a sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): test("artifact Run executes saved source, retains output across reload and sharing, a handles optional event?.type without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): test("artifact Run executes saved source, retains output across reload and sharing, a accepts { page, browser, }; testInfo; route; data; event; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("artifact Run executes saved source, retains output across reload and sharing, a preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
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
  const created = await page.evaluate(
    async (data) => {
      const response = await fetch("/api/agent-conversations", {
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body: unknown = await response.json();
      return { body, ok: response.ok };
    },
    {
      message:
        'Call createCodeDocument once with title "saved.js" and content "console.log(42)". Do not execute it. Use no other tools.',
      modelId: "openai/gpt-4.1-mini",
      operationId: crypto.randomUUID(),
    }
  );
  expect(created.ok, JSON.stringify(created.body)).toBe(true);
  const binding = conversationBinding.parse(created.body);
  await page.goto(`/chat/${binding.id}`);
  await page
    .getByRole("button", { exact: true, name: 'Created "saved.js"' })
    .click({ timeout: 90_000 });
  const panel = page.getByRole("region", { exact: true, name: "Document" });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  const code = panel.locator(".cm-content");
  await code.fill('console.log("saved-revision-73")');
  await expect(
    panel.getByRole("button", { exact: true, name: "Run" })
  ).toBeDisabled();
  await expect(panel).toContainText("Version 2 of 2");
  const composer = page.getByRole("textbox", { exact: true, name: "Message" });
  await composer.fill("Preserve this draft.");
  await panel.getByRole("button", { exact: true, name: "Run" }).click();
  await expect(
    panel.getByRole("button", { exact: true, name: "Run" })
  ).toBeDisabled();
  const output = panel.getByTestId("document-run-result");
  await expect(output).toContainText("saved-revision-73");
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  await expect(composer).toHaveText("Preserve this draft.");
  await panel.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("saved-code-output.png"),
  });

  const [conversation] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, binding.id));
  const client = new Client(getEveConnectionOptions(conversation.ownerId));
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
  const [event] = executions;
  if (
    event?.type !== "action.result" ||
    event.data.result.kind !== "tool-result"
  ) {
    throw new Error("Missing native saved-code result");
  }
  const result = toolResultSchema.parse(event.data.result.output);
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
    .getByRole("button", { exact: true, name: 'Created "saved.js"' })
    .click();
  await panel
    .getByRole("button", { exact: true, name: "View Next version" })
    .click();
  await expect(output).toContainText("saved-revision-73");
  await panel
    .getByRole("button", { exact: true, name: "View Previous version" })
    .click();
  await expect(output).toHaveCount(0);
  await expect(
    panel.getByRole("button", { exact: true, name: "Run" })
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
      .getByRole("button", { exact: true, name: 'Created "saved.js"' })
      .click();
    const shared = reader.getByRole("region", {
      exact: true,
      name: "Document",
    });
    await shared
      .getByRole("button", { exact: true, name: "View Next version" })
      .click();
    await expect(
      shared.getByRole("button", { exact: true, name: "Run" })
    ).toHaveCount(0);
    const sharedOutput = shared.getByTestId("document-run-result");
    await expect(sharedOutput).toContainText("saved-revision-73");
    await reader.setViewportSize({ height: 844, width: 390 });
    await shared.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("shared-code-output-mobile.png"),
    });
  } finally {
    await publicContext.close();
  }
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
