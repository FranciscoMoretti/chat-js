import { expect, type Page, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../lib/db/client";
import {
  getEveConversation,
  listEveConversations,
} from "../lib/db/eve-queries";
import { eveConversation, user } from "../lib/db/schema";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
async function openSidebar(page: Page) {
  if (
    await page
      .getByRole("textbox", { name: "Search conversations" })
      .isVisible()
  ) {
    return;
  }
  const expand = page.getByRole("button", {
    name: "Expand sidebar",
    exact: true,
  });
  if (await expand.isVisible()) {
    await expand.click();
  } else {
    await page
      .getByRole("button", { name: "Toggle Sidebar", exact: true })
      .click();
  }
}

for (const width of [1280, 390]) {
  test(`sidebar deletion at ${width}px survives reload and checks uncertain results`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route("https://unpkg.com/react-scan/**", (route) =>
      route.abort()
    );
    await page.goto("/api/dev-login");
    const [owner] = await db
      .select()
      .from(user)
      .where(eq(user.email, "dev@localhost"));
    if (!owner) {
      throw new Error("Missing development user");
    }
    const id = crypto.randomUUID();
    const title = "Deletion UI fixture";
    await db.insert(eveConversation).values({
      id,
      ownerId: owner.id,
      operationId: crypto.randomUUID(),
      firstMessage: title,
    });
    let deletes = 0;
    let failCheck = true;
    await page.route(`**/api/agent-conversations/${id}`, async (route) => {
      if (route.request().method() === "GET") {
        if (failCheck) {
          failCheck = false;
          await route.abort();
          return;
        }
        await route.fulfill({ json: { rootId: id, status: "pending" } });
        return;
      }
      deletes += 1;
      await db
        .update(eveConversation)
        .set({ state: deletes === 1 ? "deleting" : "deleted" })
        .where(eq(eveConversation.id, id));
      await route.fulfill({
        status: deletes === 1 ? 202 : 200,
        json: { rootId: id, status: deletes === 1 ? "pending" : "deleted" },
      });
    });
    try {
      await page.goto("/");
      await openSidebar(page);
      await page
        .getByRole("textbox", { name: "Search conversations" })
        .fill(title);
      const row = page
        .locator("li")
        .filter({ has: page.getByRole("link", { name: title, exact: true }) });
      await row.hover();
      await row.getByRole("button", { name: "More", exact: true }).click();
      await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
      const dialog = page.getByRole("dialog", {
        name: "Delete conversation and branches?",
        exact: true,
      });
      await expect(dialog).toContainText("all its branches");
      await dialog
        .getByRole("button", {
          name: "Delete conversation and branches",
          exact: true,
        })
        .click();
      await expect(dialog).toContainText("cleanup is not complete");
      expect(await getEveConversation(owner.id, id)).toBeUndefined();
      expect(
        (await listEveConversations(owner.id, { search: title })).items.map(
          (item) => item.id
        )
      ).toContain(id);
      await dialog
        .getByRole("button", { name: "Close", exact: true })
        .first()
        .click();
      await page.reload();
      await openSidebar(page);
      await page
        .getByRole("textbox", { name: "Search conversations" })
        .fill(title);
      await expect(
        page.getByRole("link", { name: title, exact: true })
      ).toHaveCount(0);
      expect(deletes).toBe(1);
      await page
        .getByRole("button", { name: "Resume deletion", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Check status", exact: true })
        .click();
      await expect(dialog).toContainText("could not be confirmed");
      await expect(
        dialog.getByRole("button", { name: "Retry deletion", exact: true })
      ).toHaveCount(0);
      await dialog
        .getByRole("button", { name: "Check status", exact: true })
        .click();
      await expect(dialog).toContainText("cleanup is not complete");
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(dialog).toContainText("cleanup is not complete");
      const heading = await dialog.getByRole("heading").boundingBox();
      const closeIcon = await dialog
        .locator('[data-slot="dialog-close"]')
        .boundingBox();
      if (!(heading && closeIcon)) {
        throw new Error("Missing dialog geometry");
      }
      expect(heading.x + heading.width).toBeLessThanOrEqual(closeIcon.x);
      await dialog.screenshot({
        path: testInfo.outputPath("deletion-dialog.png"),
        animations: "disabled",
      });
      await dialog
        .getByRole("button", { name: "Retry deletion", exact: true })
        .click();
      await expect(dialog).toHaveCount(0);
      expect(deletes).toBe(2);
      expect(
        (await listEveConversations(owner.id, { search: title })).items
      ).toHaveLength(0);
    } finally {
      await db.delete(eveConversation).where(eq(eveConversation.id, id));
    }
  });
}
