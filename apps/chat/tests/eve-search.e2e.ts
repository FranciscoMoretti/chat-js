/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { Client } from "eve/client";
import { z } from "zod";

import { db } from "../lib/db/client";
import { eveConversation, eveUsage } from "../lib/db/schema";
import { env } from "../lib/env";
import { evePlatformResult } from "../lib/eve/platform-result";
import { reconcileEveUsage } from "../lib/eve/reconcile-usage";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);
const SOURCES = /\d+ Sources/u;

test("native search retains sources, progress and billing across reload", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const created = await page.request.post("/api/agent-conversations", {
    data: {
      message:
        'Use webSearch exactly twice, separately: first query "IANA example domains", then query "MDN JavaScript Array". Each call should have one query, maximum 2 results, basic depth. Use no other tool. Summarize the sources in one sentence.',
      modelId: "google/gemini-2.5-flash-lite",
      operationId: crypto.randomUUID(),
      selectedTool: "webSearch",
    },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const binding = z
    .object({ id: z.uuid(), sessionId: z.string() })
    .parse(await created.json());
  await page.goto(`/chat/${binding.id}`);
  const sources = page.getByRole("button", { name: SOURCES });
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
  const client = new Client({
    auth: { bearer: env.EVE_GATEWAY_SECRET ?? "" },
    headers: { "x-chatjs-owner": conversation.ownerId },
    host: env.EVE_INTERNAL_ORIGIN ?? "",
  });
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
    const receipt = evePlatformResult.parse(call.data.result.output);
    expect(receipt.usage.costUsd).toBe(0.05);
    expect(
      receipt.updates?.filter((update) => update.type === "web")
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
  await expect(page.getByText("Search declined.")).toBeVisible();
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
