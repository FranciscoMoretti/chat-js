// oxlint-disable-next-line import/no-nodejs-modules -- This Playwright E2E test runs under Node and intentionally uses this built-in fixture API.
import { execFileSync } from "node:child_process";
/* oxlint-disable import/max-dependencies, import/no-nodejs-modules, import/no-relative-parent-imports --
 * import/max-dependencies (#524): import from "node:child_process" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-nodejs-modules (#529): This test harness requires import { execFileSync } from "node:child_process";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/schema"; "../lib/env"; "../lib/eve/connection-options"; "../lib/eve/contracts" dependency within this package instead of introducing an alias or barrel API.
 */
// oxlint-disable-next-line eslint/sort-imports -- Keep Playwright type-only imports separate from runtime bindings; moving them has no runtime module-order effect.

/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { expect, test } from "@playwright/test";
// oxlint-disable-next-line eslint/sort-imports -- Keep the type-only import required by consistent-type-imports; it has no runtime evaluation order.
import type { TestInfo } from "@playwright/test";
/* oxlint-enable eslint/sort-imports */
import { eq } from "drizzle-orm";
/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Client } from "eve/client";
// oxlint-disable-next-line eslint/sort-imports -- Keep the type-only import separate from runtime bindings; it has no runtime module-order effect.
import type { MessageStreamEvent } from "eve/client";
/* oxlint-enable eslint/sort-imports */

import { db } from "../lib/db/client";
/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eveConversation, eveUsage } from "../lib/db/schema";
/* oxlint-enable eslint/sort-imports */
import { env } from "../lib/env";
import { getEveConnectionOptions } from "../lib/eve/connection-options";
/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { conversationBinding } from "../lib/eve/contracts";
/* oxlint-enable eslint/sort-imports */
import { reconcileEveUsage } from "../lib/eve/reconcile-usage";
import { toolResultSchema } from "../lib/eve/tool-result";
/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable eslint/sort-imports */
/* oxlint-enable import/max-dependencies, import/no-nodejs-modules, import/no-relative-parent-imports */

assertEveTestDatabase(env.DATABASE_URL);
type RunCodeActionResultReader =
  | Readonly<{
      type: "action.result";
      data: Readonly<{
        result: Readonly<{
          callId: string;
          kind: string;
          output: unknown;
          toolName?: string;
        }>;
      }>;
    }>
  | Readonly<{
      type: Exclude<MessageStreamEvent["type"], "action.result">;
      data?: unknown;
    }>;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-statements, no-magic-numbers, node/no-sync, typescript/promise-function-async --
 * max-statements (#512): test("saved-code controls cover pending, disabled, denied and error states") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("saved-code controls cover pending, disabled, denied and error states") uses 2, 1100, 390 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * node/no-sync (#538): test("saved-code controls cover pending, disabled, denied and error states") uses execFileSync("bun", ["tests/eve-document-run-fixture.ts"], { encoding: "utf-8", }) within its synchronous fixture setup contract; asynchronous conversion changes its callers and lifecycle.
 * typescript/promise-function-async (#606): test("saved-code controls cover pending, disabled, denied and error states") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Page fixture calls page.route(), page.goto(), page.setViewportSize() on the original Page/locator receiver to change the live browser or route state.
test("saved-code controls cover pending, disabled, denied and error states", async ({
  page,
}, testInfo: Readonly<Pick<TestInfo, "outputPath">>) => {
  await page.route(
    "https://unpkg.com/react-scan/**",
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Route callback calls route.abort() to resolve the intercepted live request through the original native Route receiver.
    (route) => route.abort()
  );
  await page.goto("/api/dev-login");
  await page.goto("/");
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links: readonly { readonly outerHTML: string }[]) =>
      links
        .map((link: { readonly outerHTML: string }) => link.outerHTML)
        .join("")
    );
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers, node/no-sync, typescript/promise-function-async */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/promise-function-async --
 * max-lines-per-function (#510): test("artifact Run executes saved source, retains output across reload and sharing, a keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("artifact Run executes saved source, retains output across reload and sharing, a keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("artifact Run executes saved source, retains output across reload and sharing, a uses 180_000, 20_000, 15_000, 1, 0.05, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/promise-function-async (#606): test("artifact Run executes saved source, retains output across reload and sharing, a preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Page fixture calls page.setDefaultTimeout(), page.addInitScript(), page.route() on the original Page/locator receiver to change the live browser or route state.
test("artifact Run executes saved source, retains output across reload and sharing, and bills once", async ({
  page,
  browser,
}, testInfo: Readonly<Pick<TestInfo, "outputPath">>) => {
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
  await page.route(
    "https://unpkg.com/react-scan/**",
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Route callback calls route.abort() to resolve the intercepted live request through the original native Route receiver.
    (route) => route.abort()
  );
  await page.goto("/api/dev-login");
  const created = await page.evaluate(
    async (
      data: Readonly<{ message: string; modelId: string; operationId: string }>
    ) => {
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
    (
      event: RunCodeActionResultReader
    ): event is Extract<MessageStreamEvent, { type: "action.result" }> =>
      event.type === "action.result" &&
      event.data.result.kind === "tool-result" &&
      event.data.result.toolName === "runCodeDocument"
  );
  expect(executions).toHaveLength(1);
  const [event] = executions;
  if (
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading type from event; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
    await publicContext.route(
      "https://unpkg.com/react-scan/**",
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Route callback calls route.abort() to resolve the intercepted live request through the original native Route receiver.
      (route) => route.abort()
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/promise-function-async */
