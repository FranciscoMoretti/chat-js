/* oxlint-disable import/no-nodejs-modules, import/no-relative-parent-imports --
 * import/no-nodejs-modules (#529): This test harness requires import { mkdir } from "node:fs/promises";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/eve-queries"; "../lib/db/schema" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable promise/avoid-new -- These fixtures adapt callback, timer, stream, or browser event APIs into awaited Promises. */
/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
/* oxlint-disable unicorn/consistent-function-scoping -- One-off helpers stay beside the scenario state they coordinate. */
import { mkdir } from "node:fs/promises";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { expect, test } from "@playwright/test";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eq, inArray, sql } from "drizzle-orm";
/* oxlint-enable sort-imports */

import { db } from "../lib/db/client";
import { listEveConversations } from "../lib/db/eve-queries";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eveConversation, user } from "../lib/db/schema";
/* oxlint-enable sort-imports */
import { insertEveConversationFixtures } from "./eve-conversation-fixture";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules, import/no-relative-parent-imports */

/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): assertEveTestDatabase reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable node/no-process-env */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): test("history pages and searches older conversations without exposing other owners") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("history pages and searches older conversations without exposing other owners") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("history pages and searches older conversations without exposing other owners") uses 55, 54, 2, 50, 0, 5, -1, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("history pages and searches older conversations without exposing other owners") accepts { page, }; route; row; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("history pages and searches older conversations without exposing other owners") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): test("history pages and searches older conversations without exposing other owners") intentionally keeps the existing falsy-value behavior of owner; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
    email: `${foreignOwner}@test.invalid`,
    id: foreignOwner,
    name: "History test",
  });
  await insertEveConversationFixtures(
    ids.map((id, index) => ({
      id,
      // oxlint-disable-next-line no-ternary -- Keep ownerId as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      ownerId: index === 55 ? foreignOwner : owner.id,
      operationId: crypto.randomUUID(),
      // oxlint-disable-next-line no-ternary -- Keep template interpolation as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading updatedAt from first.nextCursor; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    expect(first.nextCursor?.updatedAt).toBe("2099-01-01T00:00:00.123456Z");
    const second = await listEveConversations(owner.id, {
      cursor: first.nextCursor,
      search: prefix,
    });
    expect(second.items).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
    expect(
      new Set([...first.items, ...second.items].map((row) => row.id)).size
    ).toBe(55);
    const literal = await listEveConversations(owner.id, {
      search: "100%_literal",
    });
    expect(literal.items.map((row) => row.conversationId)).toContain(ids[54]);
    const last = second.items.at(-1);
    if (!last) {
      throw new Error("Missing last page fixture");
    }
    await page.goto("/");
    const expand = page.getByRole("button", {
      exact: true,
      name: "Expand sidebar",
    });
    if (await expand.isVisible()) {
      await expand.click();
    }
    const search = page.getByRole("textbox", { name: "Search conversations" });
    let releaseSearch: () => void = (): void => {
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
        animations: "disabled",
        path: "tests/eve-results/screenshots/eve-history-loading.png",
      });
    } finally {
      releaseSearch();
    }
    await page.unroute("**/api/trpc/eve.list**");
    await expect(
      page.locator('a[href^="/chat/"]').filter({ hasText: prefix })
    ).toHaveCount(50);
    const loadMore = page.getByRole("button", {
      exact: true,
      name: "Load more conversations",
    });
    await loadMore.scrollIntoViewIfNeeded();
    await page.screenshot({
      animations: "disabled",
      path: "tests/eve-results/screenshots/eve-history-pagination.png",
    });
    await loadMore.click();
    await expect(
      page.locator('a[href^="/chat/"]').filter({ hasText: prefix })
    ).toHaveCount(55);
    await expect(
      page.getByRole("button", { exact: true, name: "Load more conversations" })
    ).toHaveCount(0);
    await search.fill(last.title);
    await expect(
      page.getByRole("link", { exact: true, name: last.title })
    ).toBeVisible();
    await expect(
      page.locator('a[href^="/chat/"]').filter({ hasText: prefix })
    ).toHaveCount(1);
    await mkdir("tests/eve-results/screenshots", { recursive: true });
    await page.screenshot({
      animations: "disabled",
      path: "tests/eve-results/screenshots/eve-history-search.png",
    });
    await search.fill(`${prefix} absent`);
    await expect(
      page.getByText("No matching conversations.", { exact: true })
    ).toBeVisible();
    await page.screenshot({
      animations: "disabled",
      path: "tests/eve-results/screenshots/eve-history-empty.png",
    });
    await page.route("**/api/trpc/eve.list**", (route) => route.abort());
    await search.fill(`${prefix} failed`);
    await expect(
      page.getByText("Could not load conversations.", { exact: true })
    ).toBeVisible();
    await page.screenshot({
      animations: "disabled",
      path: "tests/eve-results/screenshots/eve-history-error.png",
    });
    await page.unroute("**/api/trpc/eve.list**");
    await page.getByRole("button", { exact: true, name: "Retry" }).click();
    await expect(
      page.getByText("No matching conversations.", { exact: true })
    ).toBeVisible();
    await search.fill("");
    await expect(
      page.getByRole("button", { exact: true, name: "Load more conversations" })
    ).toBeVisible();
  } finally {
    await db.delete(eveConversation).where(inArray(eveConversation.id, ids));
    await db.delete(user).where(eq(user.id, foreignOwner));
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions */
