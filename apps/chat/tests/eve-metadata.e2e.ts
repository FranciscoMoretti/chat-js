import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { eq, inArray } from "drizzle-orm";
import { db } from "../lib/db/client";
import { eveConversation, user } from "../lib/db/schema";
import { assertEveTestDatabase } from "./eve-test-database";

const metadataTitle = /renamed|metadata newer/;

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

test("rename and pin persist, preserve input, and reject another owner's changes", async ({
  page,
  browser,
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
  const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  const foreignOwner = crypto.randomUUID();
  const firstTitle = `metadata older ${ids[0]}`;
  const secondTitle = `metadata newer ${ids[1]}`;
  const renamed = `renamed ${ids[0]}`;
  await db.insert(user).values({
    id: foreignOwner,
    email: `${foreignOwner}@test.invalid`,
    name: "Metadata test",
  });
  await db.insert(eveConversation).values(
    ids.map((id, index) => ({
      id,
      ownerId: index === 2 ? foreignOwner : owner.id,
      operationId: crypto.randomUUID(),
      firstMessage: index === 0 ? firstTitle : secondTitle,
      updatedAt: new Date(Date.now() + index * 1000),
    }))
  );
  try {
    await page.goto("/");
    const expand = page.getByRole("button", {
      name: "Expand sidebar",
      exact: true,
    });
    if (await expand.isVisible()) {
      await expand.click();
    }
    const row = () =>
      page.getByRole("link", { name: firstTitle, exact: true }).locator("..");
    await row().getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
    await page.locator('input[maxlength="255"]:visible').fill(renamed);
    const renameResponse = page.waitForResponse(
      "**/api/trpc/eve.rename?batch=1"
    );
    await page.locator('input[maxlength="255"]:visible').press("Enter");
    const renamedResponse = await renameResponse;
    expect(renamedResponse.ok(), await renamedResponse.text()).toBe(true);
    await expect(
      page.getByRole("link", { name: renamed, exact: true })
    ).toBeVisible();
    const renamedRow = page
      .getByRole("link", { name: renamed, exact: true })
      .locator("..");
    await renamedRow.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("menuitem", { name: "Pin", exact: true }).click();
    await expect
      .poll(
        async () =>
          (
            await db
              .select()
              .from(eveConversation)
              .where(eq(eveConversation.id, ids[0]))
          )?.[0]?.isPinned
      )
      .toBe(true);
    await page.reload();
    await expect(
      page.getByRole("link", { name: renamed, exact: true })
    ).toBeVisible();
    const conversationLinks = page
      .locator('a[href^="/chat/"]')
      .filter({ hasText: metadataTitle });
    await expect(conversationLinks.first()).toHaveText(renamed);
    await renamedRow.getByRole("button", { name: "More", exact: true }).click();
    await expect(
      page.getByRole("menuitem", { name: "Unpin", exact: true })
    ).toBeVisible();
    await mkdir("tests/eve-results/screenshots", { recursive: true });
    await page.screenshot({
      path: "tests/eve-results/screenshots/eve-history-menu.png",
      animations: "disabled",
      style:
        "nextjs-portal, #react-scan-toolbar, #react-scan-root { visibility:hidden !important; }",
    });
    await page.getByRole("menuitem", { name: "Unpin", exact: true }).click();
    await expect
      .poll(
        async () =>
          (
            await db
              .select()
              .from(eveConversation)
              .where(eq(eveConversation.id, ids[0]))
          )?.[0]?.isPinned
      )
      .toBe(false);
    await page.reload();
    await expect(conversationLinks.first()).toHaveText(secondTitle);
    for (const { procedure, input } of [
      { procedure: "rename", input: { id: ids[2], title: "intrusion" } },
      { procedure: "pin", input: { id: ids[2], isPinned: true } },
    ]) {
      const response = await page.request.post(`/api/trpc/eve.${procedure}`, {
        data: { json: input },
      });
      expect(response.status()).toBe(404);
    }
    const invalid = await page.request.post("/api/trpc/eve.rename", {
      data: { json: { id: ids[0], title: "  " } },
    });
    expect(invalid.status()).toBe(400);
    const anonymous = await browser.newContext();
    try {
      const rejected = await anonymous.request.post(
        new URL("/api/trpc/eve.rename", page.url()).href,
        { data: { json: { id: ids[0], title: "intrusion" } } }
      );
      expect(rejected.status()).toBe(401);
    } finally {
      await anonymous.close();
    }
    const [stored] = await db
      .select()
      .from(eveConversation)
      .where(eq(eveConversation.id, ids[0]));
    expect(stored?.title).toBe(renamed);
    expect(stored?.firstMessage).toBe(firstTitle);
    const [foreign] = await db
      .select()
      .from(eveConversation)
      .where(eq(eveConversation.id, ids[2]));
    expect(foreign?.title).toBeNull();
    expect(foreign?.isPinned).toBe(false);
  } finally {
    await db.delete(eveConversation).where(inArray(eveConversation.id, ids));
    await db.delete(user).where(eq(user.id, foreignOwner));
  }
});
