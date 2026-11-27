import { expect, test } from "@playwright/test";
import type { Response } from "@playwright/test";
import { z } from "zod";

import { env } from "../lib/env";
import { conversationBinding } from "../lib/eve/contracts";
import { requestBoundComparison } from "./eve-bound-comparison";
import { readLogicalChatId } from "./eve-test-chat-identity";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);

test("two cheap native responses bind, render, and preserve an unsent draft while switching", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://unpkg.com/react-scan/**", async (route) => {
    await route.abort();
  });
  await page.goto("/api/dev-login");
  const marker = `comparison-${crypto.randomUUID().slice(0, 8)}`;
  const message = `Reply with exactly ${marker}. Do not call tools.`;
  const { origin } = new URL(page.url());
  const group = await requestBoundComparison(page.request, origin, {
    message,
    modelIds: ["openai/gpt-5-nano", "openai/gpt-5-nano"],
    operationId: crypto.randomUUID(),
  });
  const [first, second] = group.candidates;
  if (first.state !== "bound" || second.state !== "bound") {
    throw new Error("Native comparison did not bind both candidates.");
  }
  const chatId = await readLogicalChatId(page.request, first.branchId);
  const chatUrl = new URL(`/chat/${chatId}`, origin).href;
  try {
    expect(first.sessionId).not.toBe(second.sessionId);
    await page.context().addCookies([
      {
        name: "chat-model",
        url: new URL(page.url()).origin,
        value: "openai/gpt-5-mini",
      },
    ]);
    await page.goto(`/chat/${first.branchId}`);
    const expand = page.getByRole("button", { name: "Expand sidebar" });
    if (await expand.isVisible()) {
      await expand.click();
    }
    const activeChat = page.locator(
      'a[data-sidebar="menu-button"][data-active]'
    );
    await expect(activeChat).toHaveCount(1);
    const chatHref = await activeChat.getAttribute("href");
    await expect(
      page.getByTestId("model-selector").filter({ visible: true })
    ).toContainText("GPT-5 mini");
    await expect(
      page.getByText(marker, { exact: true }).filter({ visible: true })
    ).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page.getByRole("log").getByText(message, { exact: true })
    ).toHaveCount(1);
    await page
      .getByLabel("Message", { exact: true })
      .filter({ visible: true })
      .fill("Keep this unsent comparison follow-up");
    await page
      .getByRole("button", {
        name: /GPT-5 Nano (?:Open response|Task completed)/iu,
      })
      .click();
    await expect(page).toHaveURL(chatUrl);
    await expect(
      page.getByText(marker, { exact: true }).filter({ visible: true })
    ).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page.getByRole("log").getByText(message, { exact: true })
    ).toHaveCount(1);
    await expect(
      page.getByLabel("Message", { exact: true }).filter({ visible: true })
    ).toHaveValue("Keep this unsent comparison follow-up");
    await expect(
      page.getByTestId("model-selector").filter({ visible: true })
    ).toContainText(/GPT-5 Nano/iu);
    await expect(activeChat).toHaveCount(1);
    await expect(activeChat).toHaveAttribute("href", chatHref ?? "");
    await page.reload();
    await expect(
      page.getByTestId("model-selector").filter({ visible: true })
    ).toContainText(/GPT-5 Nano/iu);
    await expect(
      page.getByText(marker, { exact: true }).filter({ visible: true })
    ).toBeVisible();
    await expect(
      page.getByText("Ready", { exact: true }).filter({ visible: true })
    ).toBeVisible();
    await expect(
      page.getByLabel("Message", { exact: true }).filter({ visible: true })
    ).toHaveValue("Keep this unsent comparison follow-up");
    await page.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("native-comparison.png"),
    });
    await page
      .getByLabel("Message", { exact: true })
      .filter({ visible: true })
      .fill("");
    // Retry belongs to the same model card even though EVE creates another session.
    const regenerationResponse = page.waitForResponse(
      (result: Readonly<Pick<Response, "request" | "url">>) =>
        result.url().endsWith("/api/agent-conversations") &&
        result.request().method() === "POST"
    );
    await page
      .getByRole("log")
      .getByRole("button", {
        exact: true,
        name: "Regenerate response",
      })
      .click();
    const regeneration = await regenerationResponse;
    expect(regeneration.ok()).toBe(true);

    expect(
      z
        .looseObject({ forkKind: z.string() })
        .parse(regeneration.request().postDataJSON()).forkKind
    ).toBe("regenerate");
    const retry = conversationBinding.parse(await regeneration.json());
    expect(retry.id).not.toBe(second.branchId);
    await expect(page).toHaveURL(chatUrl);
    await expect(
      page.getByText("Ready", { exact: true }).filter({ visible: true })
    ).toBeVisible();
    const userRow = page.getByRole("log").locator('[data-role="user"]');
    await expect(
      userRow.getByRole("button", {
        name: /GPT-5 Nano (?:Open response|Task completed)/iu,
      })
    ).toHaveCount(1);
    await userRow
      .getByRole("button", {
        name: /GPT-5 Nano (?:Open response|Task completed)/iu,
      })
      .click();
    await expect(page).toHaveURL(chatUrl);
    await expect(
      page.getByText("Ready", { exact: true }).filter({ visible: true })
    ).toBeVisible();
    await userRow
      .getByRole("button", {
        name: /GPT-5 Nano (?:Open response|Task completed)/iu,
      })
      .click();
    await expect(page).toHaveURL(chatUrl);
    await expect(
      page.getByText("Ready", { exact: true }).filter({ visible: true })
    ).toBeVisible();
    await expect(userRow).toHaveCount(1);
    await expect(
      userRow.getByRole("button", { name: /^GPT-5 nano/iu })
    ).toHaveCount(2);
  } finally {
    testInfo.setTimeout(testInfo.timeout + 150_000);
    // Both comparison roots belong to one logical chat and are deleted together.
    await expect
      .poll(
        async () => {
          const deletion = await page.request.delete(
            `/api/agent-conversations/${chatId}`,
            {
              headers: { origin: new URL(page.url()).origin },
              timeout: 30_000,
            }
          );
          expect([200, 202]).toContain(deletion.status());
          return deletion.status();
        },
        { intervals: [1000, 2000], timeout: 120_000 }
      )
      .toBe(200);
  }
});
