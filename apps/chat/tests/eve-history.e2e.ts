import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../lib/db/client";
import { listEveConversations } from "../lib/db/eve-queries";
import { eveConversation, user } from "../lib/db/schema";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

test("history pages and searches older conversations without exposing other owners", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const [owner] = await db
    .select()
    .from(user)
    .where(eq(user.email, "dev@localhost"));
  if (!owner) {
    throw new Error("Missing development user");
  }
  const prefix = `history-${crypto.randomUUID()}`;
  const foreignOwner = crypto.randomUUID();
  const ids = Array.from({ length: 56 }, () => crypto.randomUUID());
  await db.insert(user).values({
    id: foreignOwner,
    email: `${foreignOwner}@test.invalid`,
    name: "History test",
  });
  await db.insert(eveConversation).values(
    ids.map((id, index) => ({
      id,
      ownerId: index === 55 ? foreignOwner : owner.id,
      operationId: crypto.randomUUID(),
      firstMessage: `${prefix} ${index === 54 ? "100%_literal" : `${index} end`}`,
      // Exercise precise timestamp ties and the pinned-to-unpinned boundary.
      updatedAt: sql`'2099-01-01 00:00:00.123456'::timestamp`,
      isPinned: index < 2,
    }))
  );
  try {
    const first = await listEveConversations(owner.id, { search: prefix });
    expect(first.items).toHaveLength(50);
    expect(first.items.slice(0, 2).every((row) => row.isPinned)).toBe(true);
    expect(first.nextCursor?.updatedAt).toBe("2099-01-01T00:00:00.123456Z");
    const second = await listEveConversations(owner.id, {
      search: prefix,
      cursor: first.nextCursor,
    });
    expect(second.items).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
    expect(
      new Set([...first.items, ...second.items].map((row) => row.id)).size
    ).toBe(55);
    const literal = await listEveConversations(owner.id, {
      search: "100%_literal",
    });
    expect(literal.items.map((row) => row.id)).toContain(ids[54]);
    const last = second.items.at(-1);
    if (!last) {
      throw new Error("Missing last page fixture");
    }
    await page.goto("/");
    const expand = page.getByRole("button", {
      name: "Expand sidebar",
      exact: true,
    });
    if (await expand.isVisible()) {
      await expand.click();
    }
    const search = page.getByRole("textbox", { name: "Search conversations" });
    let releaseSearch: () => void = () => {
      /* Assigned synchronously below. */
    };
    const searchGate = new Promise<void>((resolve) => {
      releaseSearch = resolve;
    });
    await page.route("**/api/trpc/eve.list**", async (route) => {
      await searchGate;
      await route.continue();
    });
    await search.fill(prefix);
    try {
      await expect(
        page.getByRole("status").filter({ hasText: "Loading conversations…" })
      ).toBeVisible();
      await mkdir("tests/eve-results/screenshots", { recursive: true });
      await page.screenshot({
        path: "tests/eve-results/screenshots/eve-history-loading.png",
        animations: "disabled",
      });
    } finally {
      releaseSearch();
    }
    await page.unroute("**/api/trpc/eve.list**");
    await expect(
      page.locator('a[href^="/chat/"]').filter({ hasText: prefix })
    ).toHaveCount(50);
    const loadMore = page.getByRole("button", {
      name: "Load more conversations",
      exact: true,
    });
    await loadMore.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "tests/eve-results/screenshots/eve-history-pagination.png",
      animations: "disabled",
    });
    await loadMore.click();
    await expect(
      page.locator('a[href^="/chat/"]').filter({ hasText: prefix })
    ).toHaveCount(55);
    await expect(
      page.getByRole("button", { name: "Load more conversations", exact: true })
    ).toHaveCount(0);
    await search.fill(last.title);
    await expect(
      page.getByRole("link", { name: last.title, exact: true })
    ).toBeVisible();
    await expect(
      page.locator('a[href^="/chat/"]').filter({ hasText: prefix })
    ).toHaveCount(1);
    await mkdir("tests/eve-results/screenshots", { recursive: true });
    await page.screenshot({
      path: "tests/eve-results/screenshots/eve-history-search.png",
      animations: "disabled",
    });
    await search.fill(`${prefix} absent`);
    await expect(
      page.getByText("No matching conversations.", { exact: true })
    ).toBeVisible();
    await page.screenshot({
      path: "tests/eve-results/screenshots/eve-history-empty.png",
      animations: "disabled",
    });
    await page.route("**/api/trpc/eve.list**", (route) => route.abort());
    await search.fill(`${prefix} failed`);
    await expect(
      page.getByText("Could not load conversations.", { exact: true })
    ).toBeVisible();
    await page.screenshot({
      path: "tests/eve-results/screenshots/eve-history-error.png",
      animations: "disabled",
    });
    await page.unroute("**/api/trpc/eve.list**");
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(
      page.getByText("No matching conversations.", { exact: true })
    ).toBeVisible();
    await search.fill("");
    await expect(
      page.getByRole("button", { name: "Load more conversations", exact: true })
    ).toBeVisible();
  } finally {
    await db.delete(eveConversation).where(inArray(eveConversation.id, ids));
    await db.delete(user).where(eq(user.id, foreignOwner));
  }
});
