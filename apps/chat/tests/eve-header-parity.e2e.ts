import { expect, test } from "@playwright/test";
// oxlint-disable-next-line eslint/sort-imports -- Keep the type-only import required by consistent-type-imports; it has no runtime evaluation order.
import type { TestInfo } from "@playwright/test";
// oxlint-disable-next-line eslint/sort-imports -- Keep Playwright type-only imports separate from runtime bindings; moving them has no runtime module-order effect.
import { z } from "zod";

const captureStyle =
  "nextjs-portal, #react-scan-toolbar, #react-scan-root { visibility:hidden !important; }";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/promise-function-async, unicorn/max-nested-calls --
 * max-lines-per-function (#510): test("logical header metadata is optimistic, rolls back, and preserves project and mo keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("logical header metadata is optimistic, rolls back, and preserves project and mo keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("logical header metadata is optimistic, rolls back, and preserves project and mo uses 180_000, -1, 0, 8 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/explicit-function-return-type (#560): Keep test("logical header metadata is optimistic, rolls back, and preserves project and mo's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/promise-function-async (#606): test("logical header metadata is optimistic, rolls back, and preserves project and mo preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * unicorn/max-nested-calls (#568): test("logical header metadata is optimistic, rolls back, and preserves project and mo keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Page fixture calls page.route(), page.goto(), page.reload() on the original Page/locator receiver to change the live browser or route state.
test("logical header metadata is optimistic, rolls back, and preserves project and mobile context", async ({
  page,
}, testInfo: Readonly<Pick<TestInfo, "outputPath">>) => {
  test.setTimeout(180_000);
  await page.route(
    "https://unpkg.com/react-scan/**",
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Route callback calls route.abort() to resolve the intercepted live request through the original native Route receiver.
    (route) => route.abort()
  );
  await page.goto("/api/dev-login");
  await page.request.post("/api/chat-model", {
    data: { model: "openai/gpt-5-nano" },
  });
  await page.goto("/");
  const composer = page.getByRole("group", {
    exact: true,
    name: "Message composer",
  });
  await composer
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill("Do not use tools. Reply with exactly header.");
  await composer.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  const id = new URL(page.url()).pathname.split("/").at(-1);
  const title = `Header parity ${crypto.randomUUID().slice(0, 8)}`;
  const renameResponse = await page.request.post("/api/trpc/eve.rename", {
    data: { json: { id, title } },
  });
  expect(renameResponse.ok()).toBe(true);
  await page.reload();
  const menu = () =>
    page.getByRole("button", { exact: true, name: `Chat menu: ${title}` });
  await expect(menu()).toBeVisible();
  const expand = page.getByRole("button", {
    exact: true,
    name: "Expand sidebar",
  });
  if (await expand.isVisible()) {
    await expand.click();
  }
  const renameGate = Promise.withResolvers<boolean>();
  await page.route(
    "**/api/trpc/eve.rename?batch=1",
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Route callback calls route.abort() to resolve the intercepted live request through the original native Route receiver.
    async (route) => {
      await renameGate.promise;
      await route.abort("failed");
    }
  );
  await menu().click();
  await page.getByRole("menuitem", { exact: true, name: "Rename" }).click();
  await page
    .getByRole("textbox", { exact: true, name: "Chat title" })
    .fill("Optimistic header");
  await page
    .getByRole("textbox", { exact: true, name: "Chat title" })
    .press("Enter");
  await expect(
    page.getByRole("button", {
      exact: true,
      name: "Chat menu: Optimistic header",
    })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { exact: true, name: "Optimistic header" })
  ).toBeVisible();
  await expect(page.locator("header").first()).toHaveScreenshot(
    "optimistic-header.png",
    { animations: "disabled" }
  );
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("optimistic-header.png"),
    style: captureStyle,
  });
  renameGate.resolve(true);
  await expect(menu()).toBeVisible();
  await expect(
    page.getByRole("link", { exact: true, name: title })
  ).toBeVisible();
  await page.unroute("**/api/trpc/eve.rename?batch=1");
  const pinGate = Promise.withResolvers<boolean>();
  await page.route(
    "**/api/trpc/eve.pin?batch=1",
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Route callback calls route.abort() to resolve the intercepted live request through the original native Route receiver.
    async (route) => {
      await pinGate.promise;
      await route.abort("failed");
    }
  );
  await menu().click();
  await page.getByRole("menuitem", { exact: true, name: "Pin" }).click();
  await menu().click();
  await expect(
    page.getByRole("menuitem", { exact: true, name: "Unpin" })
  ).toBeVisible();
  pinGate.resolve(true);
  await expect(
    page.getByRole("menuitem", { exact: true, name: "Pin" })
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.unroute("**/api/trpc/eve.pin?batch=1");
  const created = await page.request.post("/api/trpc/project.create", {
    data: { json: { instructions: "", name: "Header parity project" } },
  });
  expect(created.ok()).toBe(true);
  const {
    result: {
      data: { json: project },
    },
  } = z
    .object({
      result: z.object({
        data: z.object({ json: z.object({ id: z.string() }) }),
      }),
    })
    .parse(await created.json());
  const projectAssignmentResponse = await page.request.post(
    "/api/trpc/eve.assignProject",
    {
      data: { json: { conversationId: id, projectId: project.id } },
    }
  );
  expect(projectAssignmentResponse.ok()).toBe(true);
  await page.reload();
  await expect(
    page
      .locator("header")
      .getByRole("link", { exact: true, name: "Header parity project" })
  ).toHaveAttribute("href", `/project/${project.id}`);
  await menu().click();
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("project-header-menu.png"),
    style: captureStyle,
  });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ height: 844, width: 390 });
  await expect(
    page
      .locator("header")
      .getByRole("button", { exact: true, name: "Share chat" })
  ).toBeHidden();
  await menu().click();
  await expect(
    page.getByRole("menuitem", { exact: true, name: "Share" })
  ).toBeVisible();
  await expect(page.getByRole("menu")).toHaveScreenshot(
    "mobile-header-menu.png",
    { animations: "disabled" }
  );
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("mobile-header-menu.png"),
    style: captureStyle,
  });
  await page.getByRole("menuitem", { exact: true, name: "Share" }).click();
  await page.getByRole("button", { exact: true, name: "Share Chat" }).click();
  const shareUrl = await page
    .getByRole("textbox", { exact: true, name: "Link" })
    .inputValue();
  await page.goto(shareUrl);
  await expect(
    page.locator("header").getByText("Shared", { exact: true })
  ).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("shared-header-mobile.png"),
    style: captureStyle,
  });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/promise-function-async, unicorn/max-nested-calls */
