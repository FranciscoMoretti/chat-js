/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/schema"; "../lib/eve/contracts" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../lib/db/client";
import { eveChat, eveConversation } from "../lib/db/schema";
import { conversationBinding } from "../lib/eve/contracts";
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): assertEveTestDatabase reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
/* oxlint-enable node/no-process-env */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions  --
 * max-lines-per-function (#510): test("generated chat identity stays selected across edited branch paths") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("generated chat identity stays selected across edited branch paths") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("generated chat identity stays selected across edited branch paths") uses 150_000, 1000, 2000, 1, 60_000, 200, 202 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("generated chat identity stays selected across edited branch paths") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): test("generated chat identity stays selected across edited branch paths") handles optional chat?.status without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/explicit-function-return-type (#560): Keep test("generated chat identity stays selected across edited branch paths")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): test("generated chat identity stays selected across edited branch paths") accepts { page, }; testInfo; route; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("generated chat identity stays selected across edited branch paths") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): test("generated chat identity stays selected across edited branch paths") intentionally keeps the existing falsy-value behavior of chat; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
test("generated chat identity stays selected across edited branch paths", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const { origin } = new URL(page.url());
  const response = await page.request.post("/api/agent-conversations", {
    data: {
      message:
        "We will discuss planning a three day hiking trip with lightweight camping equipment. For this first reply say only trail-ready. Do not use tools.",
      modelId: "google/gemini-2.5-flash-lite",
      operationId: crypto.randomUUID(),
    },
    headers: { origin },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const source = conversationBinding.parse(await response.json());
  try {
    await page.goto(`/chat/${source.id}`);
    await expect(page.getByRole("log")).toContainText("trail-ready", {
      timeout: 60_000,
    });
    const readChat = async () => {
      const [row] = await db
        .select({
          id: eveChat.id,
          status: eveChat.titleStatus,
          title: eveChat.title,
        })
        .from(eveConversation)
        .innerJoin(eveChat, eq(eveConversation.chatId, eveChat.id))
        .where(eq(eveConversation.id, source.id));
      return row;
    };
    await expect
      .poll(
        async () => {
          const chat = await readChat();
          return chat?.status;
        },
        {
          intervals: [1000, 2000],
          timeout: 30_000,
        }
      )
      .toBe("generated");
    const chat = await readChat();
    if (!chat) {
      throw new Error("Missing test chat identity");
    }
    const title = page
      .getByRole("main")
      .getByRole("heading", { level: 1 })
      .filter({ visible: true });
    await expect(title).toHaveText(chat.title);
    const activeChat = page.locator(
      'a[data-sidebar="menu-button"][data-active="true"]'
    );
    await expect(activeChat).toHaveCount(1);
    await expect(activeChat).toHaveText(chat.title);
    const chatHref = await activeChat.getAttribute("href");
    await page
      .getByRole("button", { exact: true, name: "Edit message" })
      .click();
    const editor = page
      .getByRole("log")
      .getByRole("group", { name: "Message composer" });
    await editor
      .getByRole("textbox", { exact: true, name: "Message" })
      .fill("Say only branch-ready. Do not use tools.");
    await editor.getByRole("button", { exact: true, name: "Send" }).click();
    await expect(page).not.toHaveURL(
      new URL(`/chat/${source.id}`, origin).href
    );
    await expect(
      page.getByRole("log").getByText(/^branch-ready[.]?$/u)
    ).toBeVisible({
      timeout: 60_000,
    });
    await expect(title).toHaveText(chat.title);
    await expect(activeChat).toHaveCount(1);
    await expect(activeChat).toHaveAttribute("href", chatHref ?? "");
    await expect(activeChat).toHaveText(chat.title);
    await expect(
      page.getByText("Ready", { exact: true }).filter({ visible: true })
    ).toHaveClass(/sr-only/u);
    const expandSidebar = page.getByRole("button", { name: "Expand sidebar" });
    if (await expandSidebar.isVisible()) {
      await expandSidebar.click();
    }
    await page.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("same-chat-edited-branch.png"),
    });
    await page
      .getByRole("log")
      .locator(".is-user")
      .getByRole("button", { exact: true, name: "Previous version" })
      .click();
    await expect(page.getByRole("log")).toContainText("trail-ready");
    await expect(activeChat).toHaveAttribute("href", chatHref ?? "");
    await expect(title).toHaveText(chat.title);
    await page.reload();
    await expect(activeChat).toHaveText(chat.title);
    await expect(title).toHaveText(chat.title);
  } finally {
    testInfo.setTimeout(testInfo.timeout + 60_000);
    await expect
      .poll(
        async () => {
          const removed = await page.request.delete(
            `/api/agent-conversations/${source.id}`,
            { headers: { origin }, timeout: 20_000 }
          );
          expect([200, 202]).toContain(removed.status());
          return removed.status();
        },
        { intervals: [1000, 2000], timeout: 55_000 }
      )
      .toBe(200);
  }
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions */
