/* oxlint-disable import/no-nodejs-modules, import/no-relative-parent-imports --
 * import/no-nodejs-modules (#529): This test harness requires import { mkdir } from "node:fs/promises";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/schema" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
import { mkdir } from "node:fs/promises";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { expect, test } from "@playwright/test";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eq, inArray } from "drizzle-orm";
/* oxlint-enable sort-imports */

import { db } from "../lib/db/client";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eveChat, eveConversation, user } from "../lib/db/schema";
/* oxlint-enable sort-imports */
import { insertEveConversationFixtures } from "./eve-conversation-fixture";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules, import/no-relative-parent-imports */

const metadataTitle = /renamed|metadata newer/u;

/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): assertEveTestDatabase reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
/* oxlint-enable node/no-process-env */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): test("rename and pin persist, preserve input, and reject another owner's changes") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("rename and pin persist, preserve input, and reject another owner's changes") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("rename and pin persist, preserve input, and reject another owner's changes") uses 0, 1, 2, 1000, 404, 400, 401 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/explicit-function-return-type (#560): Keep test("rename and pin persist, preserve input, and reject another owner's changes")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): test("rename and pin persist, preserve input, and reject another owner's changes") accepts { page, browser, }; route; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("rename and pin persist, preserve input, and reject another owner's changes") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): test("rename and pin persist, preserve input, and reject another owner's changes") intentionally keeps the existing falsy-value behavior of owner; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
    email: `${foreignOwner}@test.invalid`,
    id: foreignOwner,
    name: "Metadata test",
  });
  await insertEveConversationFixtures(
    ids.map((id, index) => ({
      firstMessage: index === 0 ? firstTitle : secondTitle,
      id,
      operationId: crypto.randomUUID(),
      ownerId: index === 2 ? foreignOwner : owner.id,
      updatedAt: new Date(Date.now() + index * 1000),
    }))
  );
  try {
    await page.goto("/");
    const expand = page.getByRole("button", {
      exact: true,
      name: "Expand sidebar",
    });
    if (await expand.isVisible()) {
      await expand.click();
    }
    const row = () =>
      page.getByRole("link", { exact: true, name: firstTitle }).locator("..");
    await row().getByRole("button", { exact: true, name: "More" }).click();
    await page.getByRole("menuitem", { exact: true, name: "Rename" }).click();
    await page
      .locator(
        'input[maxlength="255"]:not([aria-label="Search conversations"]):visible'
      )
      .fill(renamed);
    const renameResponse = page.waitForResponse(
      "**/api/trpc/eve.rename?batch=1"
    );
    await page
      .locator(
        'input[maxlength="255"]:not([aria-label="Search conversations"]):visible'
      )
      .press("Enter");
    const renamedResponse = await renameResponse;
    expect(renamedResponse.ok(), await renamedResponse.text()).toBe(true);
    await expect(
      page.getByRole("link", { exact: true, name: renamed })
    ).toBeVisible();
    const renamedRow = page
      .getByRole("link", { exact: true, name: renamed })
      .locator("..");
    await renamedRow.getByRole("button", { exact: true, name: "More" }).click();
    await page.getByRole("menuitem", { exact: true, name: "Pin" }).click();
    await expect
      .poll(async () => {
        const conversationRows = await db
          .select({ isPinned: eveChat.isPinned })
          .from(eveConversation)
          .innerJoin(eveChat, eq(eveChat.id, eveConversation.chatId))
          .where(eq(eveConversation.id, ids[0]));
        return conversationRows?.[0]?.isPinned;
      })
      .toBe(true);
    await page.reload();
    await expect(
      page.getByRole("link", { exact: true, name: renamed })
    ).toBeVisible();
    const conversationLinks = page
      .locator('a[href^="/chat/"]')
      .filter({ hasText: metadataTitle });
    await expect(conversationLinks.first()).toHaveText(renamed);
    await renamedRow.getByRole("button", { exact: true, name: "More" }).click();
    await expect(
      page.getByRole("menuitem", { exact: true, name: "Unpin" })
    ).toBeVisible();
    await mkdir("tests/eve-results/screenshots", { recursive: true });
    await page.screenshot({
      animations: "disabled",
      path: "tests/eve-results/screenshots/eve-history-menu.png",
      style:
        "nextjs-portal, #react-scan-toolbar, #react-scan-root { visibility:hidden !important; }",
    });
    await page.getByRole("menuitem", { exact: true, name: "Unpin" }).click();
    await expect
      .poll(async () => {
        const conversationRows = await db
          .select({ isPinned: eveChat.isPinned })
          .from(eveConversation)
          .innerJoin(eveChat, eq(eveChat.id, eveConversation.chatId))
          .where(eq(eveConversation.id, ids[0]));
        return conversationRows?.[0]?.isPinned;
      })
      .toBe(false);
    await page.reload();
    await expect(conversationLinks.first()).toHaveText(secondTitle);
    for (const { procedure, input } of [
      { input: { id: ids[2], title: "intrusion" }, procedure: "rename" },
      { input: { id: ids[2], isPinned: true }, procedure: "pin" },
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
      .select({
        firstMessage: eveConversation.firstMessage,
        isPinned: eveChat.isPinned,
        title: eveChat.title,
      })
      .from(eveConversation)
      .innerJoin(eveChat, eq(eveChat.id, eveConversation.chatId))
      .where(eq(eveConversation.id, ids[0]));
    expect(stored?.title).toBe(renamed);
    expect(stored?.firstMessage).toBe(firstTitle);
    const [foreign] = await db
      .select({
        firstMessage: eveConversation.firstMessage,
        isPinned: eveChat.isPinned,
        title: eveChat.title,
      })
      .from(eveConversation)
      .innerJoin(eveChat, eq(eveChat.id, eveConversation.chatId))
      .where(eq(eveConversation.id, ids[2]));
    expect(foreign?.title).toBe(secondTitle);
    expect(foreign?.isPinned).toBe(false);
  } finally {
    await db.delete(eveConversation).where(inArray(eveConversation.id, ids));
    await db.delete(user).where(eq(user.id, foreignOwner));
  }
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions */
