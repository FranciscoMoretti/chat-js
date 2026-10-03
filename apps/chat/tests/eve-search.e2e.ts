/* oxlint-disable import/max-dependencies, import/no-nodejs-modules, import/no-relative-parent-imports  --
 * import/max-dependencies (#524): import from "node:child_process" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-nodejs-modules (#529): This test harness requires import { execFileSync } from "node:child_process";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/schema"; "../lib/env"; "../lib/eve/connection-options"; "../lib/eve/reconcile-usage" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { Client } from "eve/client";
import { z } from "zod";

import { db } from "../lib/db/client";
import { eveConversation, eveUsage } from "../lib/db/schema";
import { env } from "../lib/env";
import { getEveConnectionOptions } from "../lib/eve/connection-options";
import { reconcileEveUsage } from "../lib/eve/reconcile-usage";
import { toolResultSchema } from "../lib/eve/tool-result";
import { ResearchUpdateSchema } from "../tools/platform/research-updates-schema";
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable import/max-dependencies, import/no-nodejs-modules, import/no-relative-parent-imports */

assertEveTestDatabase(env.DATABASE_URL);

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async  --
 * max-lines-per-function (#510): test("native search retains sources, progress and billing across reload") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("native search retains sources, progress and billing across reload") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("native search retains sources, progress and billing across reload") uses 2, 1, 0, 15_000, 0.05 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("native search retains sources, progress and billing across reload") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): test("native search retains sources, progress and billing across reload") handles optional receipt.updates?.filter( (update) => ResearchUpdateSchema.parse(update).type === "web without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): test("native search retains sources, progress and billing across reload") accepts { page, }; route; data; event; update; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("native search retains sources, progress and billing across reload") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("native search retains sources, progress and billing across reload", async ({
  page,
}) => {
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
        'Use webSearch exactly twice, separately: first query "IANA example domains", then query "MDN JavaScript Array". Each call should have one query, maximum 2 results, basic depth. Use no other tool. Summarize the sources in one sentence.',
      modelId: "openai/gpt-4.1-mini",
      operationId: crypto.randomUUID(),
      selectedTool: "webSearch",
    }
  );
  expect(created.ok, JSON.stringify(created.body)).toBe(true);
  const binding = z
    .object({ id: z.uuid(), sessionId: z.string() })
    .parse(created.body);
  await page.goto(`/chat/${binding.id}`);
  const sources = page.getByRole("button", {
    exact: true,
    name: "Show all sources",
  });
  await expect(sources).toHaveCount(2, { timeout: 90_000 });
  const firstLinks: (string | null)[] = [];
  for (let index = 0; index < 2; index += 1) {
    await sources.nth(index).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("dialog").getByRole("link").first()
    ).toBeVisible();
    firstLinks.push(
      await page
        .getByRole("dialog")
        .getByRole("link")
        .first()
        .getAttribute("href")
    );
    await page.keyboard.press("Escape");
  }
  expect(firstLinks[0]).not.toBe(firstLinks[1]);
  const [conversation] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, binding.id));
  const client = new Client(getEveConnectionOptions(conversation.ownerId));
  const snapshot = await client.sessions
    .attach(binding.sessionId)
    .snapshot({ signal: AbortSignal.timeout(15_000) });
  const calls = snapshot.events.filter(
    (event) =>
      event.type === "action.result" &&
      event.data.result.kind === "tool-result" &&
      event.data.result.toolName === "webSearch"
  );
  expect(calls).toHaveLength(2);
  expect(
    snapshot.events.some(
      (event) =>
        event.type === "action.partial" &&
        event.data.result.kind === "tool-result" &&
        event.data.result.toolName === "webSearch"
    )
  ).toBe(true);
  await reconcileEveUsage(conversation.ownerId, binding.sessionId);
  for (const call of calls) {
    if (
      call.type !== "action.result" ||
      call.data.result.kind !== "tool-result"
    ) {
      throw new Error("Missing search receipt");
    }
    const receipt = toolResultSchema.parse(call.data.result.output);
    expect(receipt.usage.costUsd).toBe(0.05);
    expect(
      receipt.updates?.filter(
        (update) => ResearchUpdateSchema.parse(update).type === "web"
      )
    ).toHaveLength(1);
    const rows = await db
      .select()
      .from(eveUsage)
      .where(
        eq(
          eveUsage.eventId,
          `eve-tool:${binding.sessionId}:${call.data.result.callId}`
        )
      );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].costUsd)).toBe(0.05);
  }
  await page.reload();
  await expect(sources).toHaveCount(2);
  await page.getByRole("log").screenshot({
    animations: "disabled",
    path: "tests/eve-results/screenshots/eve-search-desktop.png",
  });
  await page.setViewportSize({ height: 844, width: 390 });
  await sources.last().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: "tests/eve-results/screenshots/eve-search-mobile.png",
  });
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable max-statements, no-magic-numbers, node/no-sync, typescript/prefer-readonly-parameter-types, typescript/promise-function-async  --
 * max-statements (#512): test("search loading and failure states remain readable") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("search loading and failure states remain readable") uses 3, 1100, 390 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * node/no-sync (#538): test("search loading and failure states remain readable") uses execFileSync( "bun", ["tests/eve-search-renderer-fixture.ts"], { encoding: "utf-8" }  within its synchronous fixture setup contract; asynchronous conversion changes its callers and lifecycle.
 * oxc/no-async-await (#540): test("search loading and failure states remain readable") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test("search loading and failure states remain readable") accepts { page }; route; links; link; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("search loading and failure states remain readable") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("search loading and failure states remain readable", async ({ page }) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  await page.goto("/");
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.outerHTML).join(""));
  const content = execFileSync(
    "bun",
    ["tests/eve-search-renderer-fixture.ts"],
    { encoding: "utf-8" }
  );
  await page.setContent(
    `<!doctype html><html class="dark"><head>${styles}</head><body class="bg-background text-foreground">${content}</body></html>`
  );
  await expect(page.getByRole("status")).toContainText("Searching");
  await expect(page.getByRole("alert")).toHaveCount(3);
  await expect(page.getByText("Request declined.")).toBeVisible();
  for (const width of [1100, 390]) {
    await page.setViewportSize({ height: 850, width });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: `tests/eve-results/screenshots/eve-search-states-${width}.png`,
    });
  }
});
/* oxlint-enable max-statements, no-magic-numbers, node/no-sync, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
