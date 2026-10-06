/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/eve-queries"; "../lib/db/schema" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable unicorn/prefer-ternary -- Explicit branches make stateful route behavior and cleanup order visible. */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { eq } from "drizzle-orm";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { db } from "../lib/db/client";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  getEveConversation,
  listEveConversations,
} from "../lib/db/eve-queries";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eveConversation, user } from "../lib/db/schema";
/* oxlint-enable sort-imports */
import { insertEveConversationFixtures } from "./eve-conversation-fixture";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): assertEveTestDatabase reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve openSidebar's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable node/no-process-env */
/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): openSidebar accepts page: Page; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
async function openSidebar(page: Page): Promise<void> {
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): for (const width of [1280, 390]) { test(`sidebar deleti keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): for (const width of [1280, 390]) { test(`sidebar deleti keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): for (const width of [1280, 390]) { test(`sidebar deleti uses 1280, 390, 1, 202, 200, 0, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): for (const width of [1280, 390]) { test(`sidebar deleti accepts { page, }; testInfo; route; item; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): for (const width of [1280, 390]) { test(`sidebar deleti preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): for (const width of [1280, 390]) { test(`sidebar deleti intentionally keeps the existing falsy-value behavior of owner; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
for (const width of [1280, 390]) {
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
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
        // oxlint-disable-next-line no-ternary -- Keep state as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        .set({ state: deletes === 1 ? "deleting" : "deleted" })
        .where(eq(eveConversation.id, id));
      await route.fulfill({
        // oxlint-disable-next-line no-ternary -- Keep status as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        json: { rootId: id, status: deletes === 1 ? "pending" : "deleted" },
        // oxlint-disable-next-line no-ternary -- Keep status as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
      const conversationMatchesDuringPendingCleanup =
        await listEveConversations(owner.id, {
          search: title,
        });
      expect(
        conversationMatchesDuringPendingCleanup.items.map((item) => item.id)
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
      const conversationMatchesAfterCleanup = await listEveConversations(
        owner.id,
        {
          search: title,
        }
      );
      expect(conversationMatchesAfterCleanup.items).toHaveLength(0);
    } finally {
      await db.delete(eveConversation).where(eq(eveConversation.id, id));
    }
  });
  /* oxlint-enable oxc/no-async-await */
}
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions */
