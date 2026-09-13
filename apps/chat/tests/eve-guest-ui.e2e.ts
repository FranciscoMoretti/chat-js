/* oxlint-disable promise/avoid-new -- These fixtures adapt callback, timer, stream, or browser event APIs into awaited Promises. */
/* oxlint-disable promise/prefer-await-to-then -- The event Promise forwards completion through the callback chain it observes. */
/* oxlint-disable unicorn/consistent-function-scoping -- One-off helpers stay beside the scenario state they coordinate. */
/* oxlint-disable unicorn/no-await-expression-member -- Direct awaited assertions keep each test action tied to its expectation. */
import { expect, test } from "@playwright/test";

import { conversationBinding } from "../lib/eve/contracts";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
const CHAT_URL = /\/chat\/[^/]+$/u;
const UUID = /^[0-9a-f-]{36}$/u;
const visualStyle =
  "nextjs-portal, #react-scan-toolbar, #react-scan-root, .tsqd-parent-container { visibility:hidden !important; }";

test("guest uses the existing chat shell, retries bootstrap, sends, reloads and owns sidebar metadata", async ({
  page,
  browser,
}, testInfo) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.request.post("/api/chat-model", {
    data: { model: "openai/gpt-5-nano" },
  });
  let release: () => void = () => {
    /* empty */
  };
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/eve-guest", async (route) => {
    await gate;
    await route.fulfill({ body: "unavailable", status: 503 });
  });
  await page.goto("/");
  await expect(
    page.getByText("Preparing chat…", { exact: true })
  ).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("guest-preparing.png"),
    style: visualStyle,
  });
  release();
  await expect(
    page.getByRole("alert").filter({ hasText: "Could not start chat" })
  ).toContainText("Could not start chat");
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("guest-bootstrap-error.png"),
    style: visualStyle,
  });
  await page.unroute("**/api/eve-guest");
  await page.getByRole("button", { exact: true, name: "Try again" }).click();
  const composer = page.getByRole("textbox", { exact: true, name: "Message" });
  await expect(composer).toBeVisible();
  await composer.fill("Reply with the single word hello.");
  const creation = new Promise<ReturnType<typeof conversationBinding.parse>>(
    (resolve, reject) => {
      page
        .route("**/api/agent-conversations", async (route) => {
          try {
            const response = await route.fetch();
            expect(response.status()).toBe(200);
            resolve(conversationBinding.parse(await response.json()));
            await route.fulfill({ response });
          } catch (error) {
            reject(error);
            await route.abort();
          }
        })
        .catch(reject);
    }
  );
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  const binding = await creation;
  await expect(page).toHaveURL(CHAT_URL);
  await expect(page.getByRole("log").locator(".is-assistant")).toContainText(
    "hello",
    { timeout: 60_000 }
  );
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await page.reload();
  await expect(page.getByRole("log").locator(".is-user")).toContainText(
    "Reply with the single word hello."
  );
  await composer.fill("Reply with the single word goodbye.");
  const followup = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith(`/api/eve/v1/session/${binding.sessionId}`)
  );
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(composer).toHaveText("");
  const sent = await followup;
  expect(sent.status()).toBe(202);
  expect(sent.request().headers()["x-chatjs-message-operation"]).toMatch(UUID);
  await expect(
    page.getByRole("log").locator(".is-assistant").last()
  ).toContainText("goodbye", { timeout: 60_000 });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  const renamed = await page.request.post("/api/trpc/eve.rename", {
    data: { json: { id: binding.id, title: "Guest conversation" } },
  });
  expect(renamed.status()).toBe(200);
  const pinned = await page.request.post("/api/trpc/eve.pin", {
    data: { json: { id: binding.id, isPinned: true } },
  });
  expect(pinned.status()).toBe(200);
  expect(
    (
      await page.request.post("/api/trpc/eve.setVisibility", {
        data: { json: { id: binding.id, visibility: "public" } },
      })
    ).status()
  ).toBe(401);
  await page.reload();
  const expand = page.getByRole("button", {
    exact: true,
    name: "Expand sidebar",
  });
  if (await expand.isVisible()) {
    await expand.click();
  }
  await expect(
    page.getByRole("link", { exact: true, name: "Guest conversation" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { exact: true, name: "New project" })
  ).toHaveCount(0);
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("guest-chat-desktop.png"),
    style: visualStyle,
  });
  const outsider = await browser.newContext();
  try {
    const { origin } = new URL(page.url());
    await outsider.request.post(`${origin}/api/eve-guest`, {
      headers: { origin },
    });
    const denied = await outsider.request.post(
      `${origin}/api/trpc/eve.rename`,
      { data: { json: { id: binding.id, title: "intrusion" } } }
    );
    expect(denied.status()).toBe(404);
  } finally {
    await outsider.close();
  }
  await page.setViewportSize({ height: 844, width: 390 });
  await expect(composer).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("guest-chat-mobile.png"),
    style: visualStyle,
  });
  await page.setViewportSize({ height: 720, width: 1280 });
  const previousPrincipal = await page.request.post("/api/eve-guest", {
    headers: { origin: new URL(page.url()).origin },
  });
  expect(previousPrincipal.status()).toBe(200);
  const { ownerId } = await previousPrincipal.json();
  await page.evaluate(() => {
    document.documentElement.dataset.guestCacheTest = "same-document";
  });
  await page.context().clearCookies({ name: "chatjs-eve-guest" });
  await page
    .getByRole("link", { exact: true, name: "New conversation" })
    .click();
  await expect(composer).toBeVisible();
  await expect(
    page.getByRole("link", { exact: true, name: "Guest conversation" })
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => document.documentElement.dataset.guestCacheTest)
  ).toBe("same-document");
  const staleScope = await page.request.get("/api/trpc/eve.list", {
    params: { input: JSON.stringify({ json: { ownerScope: ownerId } }) },
  });
  expect(staleScope.status()).toBe(403);
});
