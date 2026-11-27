import { expect, test } from "@playwright/test";
import { eq, inArray, sql } from "drizzle-orm";

import { db } from "../lib/db/client";
import { listEveConversations } from "../lib/db/eve-queries";
import { eveChat, eveConversation, eveWorkspace, user } from "../lib/db/schema";
import { insertEveConversationFixtures } from "./eve-conversation-fixture";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

test("history pages and searches older conversations without exposing other owners", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", async (route) => {
    await route.abort();
  });
  await page.goto("/api/dev-login");
  const [owner] = await db
    .select()
    .from(user)
    .where(eq(user.email, "dev@localhost"));
  if (owner === undefined) {
    throw new Error("Missing development user");
  }
  const prefix = `history${crypto.randomUUID().replaceAll("-", "")}`;
  const foreignOwner = crypto.randomUUID();
  const ids = Array.from({ length: 56 }, () => crypto.randomUUID());
  await db.insert(user).values({
    email: `${foreignOwner}@test.invalid`,
    id: foreignOwner,
    name: "History test",
  });
  const fixtures = await insertEveConversationFixtures(
    ids.map((id, index) => ({
      id,
      state: "bound",
      sessionId: id,
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
    expect(literal.items.map((row) => row.branchId)).toContain(ids[54]);
    const last = second.items.at(-1);
    if (!last) {
      throw new Error("Missing last page fixture");
    }
    const checkSearch = async (width: number): Promise<void> => {
      await page.goto("/");

      await page.setViewportSize({ width, height: 844 });
      if (width === 390) {
        await page
          .getByRole("button", { name: "Toggle Sidebar", exact: true })
          .click();
      }
      await page.getByRole("button", { name: /Search chats/u }).click();
      const dialog = page.getByRole("dialog", { name: "Search chats" });
      const search = dialog.getByRole("combobox", {
        name: "Search conversations",
      });
      await search.fill(prefix);
      const options = dialog.getByRole("option");
      await expect(options).toHaveCount(20);
      await dialog.getByRole("button", { name: "Load more chats" }).click();
      await expect(options).toHaveCount(40);
      await dialog.getByRole("button", { name: "Load more chats" }).click();
      await expect(options).toHaveCount(55);
      await search.fill(last.title);
      await expect(options).toHaveCount(1);
      await expect(options).toContainText(last.title);
      await search.fill(`${prefix} absent`);
      await expect(
        dialog.getByText("No chats found. Try different words.")
      ).toBeVisible();
      await page.route("**/api/trpc/search.query?*", async (route) => {
        await route.abort();
      });
      await search.fill(`${prefix} offline`);
      await expect(dialog.getByText("Could not search chats.")).toBeVisible();
      await page.unroute("**/api/trpc/search.query?*");
      await dialog.getByRole("button", { name: "Retry" }).click();
      await expect(
        dialog.getByText("No chats found. Try different words.")
      ).toBeVisible();
      await page.keyboard.press("Escape");
    };
    await checkSearch(1280);
    await checkSearch(390);
  } finally {
    await db.delete(eveConversation).where(inArray(eveConversation.id, ids));
    await db.delete(eveChat).where(
      inArray(
        eveChat.id,
        fixtures.map((row) => row.chatId)
      )
    );
    await db.delete(eveWorkspace).where(
      inArray(
        eveWorkspace.id,
        fixtures.map((row) => row.workspaceId)
      )
    );
    await db.delete(user).where(eq(user.id, foreignOwner));
  }
});
