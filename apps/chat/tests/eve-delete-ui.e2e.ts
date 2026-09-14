/* oxlint-disable unicorn/prefer-ternary -- Explicit branches make stateful route behavior and cleanup order visible. */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/* oxlint-disable unicorn/no-await-expression-member -- Direct awaited assertions keep each test action tied to its expectation. */
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../lib/db/client";
import {
  getEveConversation,
  listEveConversations,
} from "../lib/db/eve-queries";
import { eveConversation, user } from "../lib/db/schema";
import { insertEveConversationFixtures } from "./eve-conversation-fixture";
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
    exact: true,
    name: "Expand sidebar",
  });
  if (await expand.isVisible()) {
    await expand.click();
  } else {
    await page
      .getByRole("button", { exact: true, name: "Toggle Sidebar" })
      .click();
  }
}

for (const width of [1280, 390]) {
  test(`sidebar deletion at ${width}px survives reload and checks uncertain results`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ height: 844, width });
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
    await insertEveConversationFixtures({
      firstMessage: title,
      id,
      operationId: crypto.randomUUID(),
      ownerId: owner.id,
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
        json: { rootId: id, status: deletes === 1 ? "pending" : "deleted" },
        status: deletes === 1 ? 202 : 200,
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
        .filter({ has: page.getByRole("link", { exact: true, name: title }) });
      await row.hover();
      await row.getByRole("button", { exact: true, name: "More" }).click();
      await page.getByRole("menuitem", { exact: true, name: "Delete" }).click();
      const dialog = page.getByRole("dialog", {
        exact: true,
        name: "Delete conversation and branches?",
      });
      await expect(dialog).toContainText("all its branches");
      await dialog
        .getByRole("button", {
          exact: true,
          name: "Delete conversation and branches",
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
        .getByRole("button", { exact: true, name: "Close" })
        .first()
        .click();
      await page.reload();
      await openSidebar(page);
      await page
        .getByRole("textbox", { name: "Search conversations" })
        .fill(title);
      await expect(
        page.getByRole("link", { exact: true, name: title })
      ).toHaveCount(0);
      expect(deletes).toBe(1);
      await page
        .getByRole("button", { exact: true, name: "Resume deletion" })
        .click();
      await dialog
        .getByRole("button", { exact: true, name: "Check status" })
        .click();
      await expect(dialog).toContainText("could not be confirmed");
      await expect(
        dialog.getByRole("button", { exact: true, name: "Retry deletion" })
      ).toHaveCount(0);
      await dialog
        .getByRole("button", { exact: true, name: "Check status" })
        .click();
      await expect(dialog).toContainText("cleanup is not complete");
      await page.setViewportSize({ height: 844, width: 390 });
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
        animations: "disabled",
        path: testInfo.outputPath("deletion-dialog.png"),
      });
      await dialog
        .getByRole("button", { exact: true, name: "Retry deletion" })
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
