/* oxlint-disable unicorn/no-await-expression-member -- Awaited browser responses stay beside their assertions. */
import { expect, test } from "@playwright/test";
import { z } from "zod";

const captureStyle =
  "nextjs-portal, #react-scan-toolbar, #react-scan-root { visibility:hidden !important; }";

test("logical header metadata is optimistic, rolls back, and preserves project and mobile context", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
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
  expect(
    (
      await page.request.post("/api/trpc/eve.rename", {
        data: { json: { id, title } },
      })
    ).ok()
  ).toBe(true);
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
  await page.route("**/api/trpc/eve.rename?batch=1", async (route) => {
    await renameGate.promise;
    await route.abort("failed");
  });
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
  await page.route("**/api/trpc/eve.pin?batch=1", async (route) => {
    await pinGate.promise;
    await route.abort("failed");
  });
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
  expect(
    (
      await page.request.post("/api/trpc/eve.assignProject", {
        data: { json: { conversationId: id, projectId: project.id } },
      })
    ).ok()
  ).toBe(true);
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
