import { expect, test } from "@playwright/test";

import { conversationBinding } from "../lib/eve/contracts";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

const sourceModelId = "openai/gpt-5-nano";

test("edit recovery and regeneration create navigable versions inside ChatJS", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  let cleanup: { id: string; origin: string } | undefined;
  let bodyFailed = false;
  let cleanupFailure: { error: unknown } | undefined;
  try {
    await page.route("https://unpkg.com/react-scan/**", (route) =>
      route.abort()
    );
    await page.goto("/api/dev-login");
    const { origin } = new URL(page.url());
    await page.request.post("/api/chat-model", {
      data: { model: sourceModelId },
    });
    const created = await page.request.post("/api/agent-conversations", {
      data: {
        message: "Reply briefly with amber.",
        modelId: sourceModelId,
        operationId: crypto.randomUUID(),
      },
      headers: { origin: new URL(page.url()).origin },
    });
    expect(created.ok(), await created.text()).toBe(true);
    const source = conversationBinding.parse(await created.json());
    cleanup = { id: source.id, origin };
    await page.goto(`/chat/${source.id}`);
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({
      timeout: 90_000,
    });
    await page
      .getByRole("button", { exact: true, name: "Edit message" })
      .click();
    const editor = page.getByRole("dialog");
    await expect(editor).toContainText("original conversation stays available");
    await editor
      .getByRole("textbox", { exact: true, name: "Message" })
      .fill("Reply briefly with cobalt.");
    await editor.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("edit-dialog.png"),
    });

    const desktopViewport = page.viewportSize();
    await page.setViewportSize({ height: 844, width: 390 });
    await editor.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("edit-dialog-mobile.png"),
    });
    if (desktopViewport) {
      await page.setViewportSize(desktopViewport);
    }

    let accepted: ReturnType<typeof conversationBinding.parse> | undefined;
    await page.route(
      "**/api/agent-conversations",
      async (route) => {
        const response = await route.fetch();
        accepted = conversationBinding.parse(await response.json());
        await route.abort("failed");
      },
      { times: 1 }
    );
    await editor.getByRole("button", { exact: true, name: "Send" }).click();
    await expect(
      page.getByRole("button", { name: "Recover version" })
    ).toBeEnabled({ timeout: 60_000 });
    expect(accepted).toBeDefined();
    await page.reload();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Response creation is unconfirmed" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Recover version" }).click();
    await expect(page).toHaveURL(new RegExp(`/chat/${accepted?.id}$`, "u"), {
      timeout: 60_000,
    });
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByRole("log").locator(".is-user")).toContainText(
      "cobalt"
    );
    await expect(page.getByRole("log").locator(".is-assistant")).toHaveCount(1);
    await expect(
      page.getByRole("combobox", { name: "Conversation version" })
    ).toContainText("Version 2");
    await page.getByRole("log").screenshot({
      animations: "disabled",
      path: testInfo.outputPath("edited-messages.png"),
    });
    await page.getByTestId("model-selector").filter({ visible: true }).click();
    await page.getByPlaceholder("Search models...").fill("GPT-5 mini");
    await page
      .getByRole("option", { exact: true, name: "openai logo GPT-5 mini" })
      .filter({
        hasNot: page.getByTitle("Advanced reasoning capabilities", {
          exact: true,
        }),
      })
      .click();
    // Reload proves regeneration comes from durable response evidence, not a local selection cache.
    await page.reload();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({
      timeout: 60_000,
    });
    const regenerated = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/agent-conversations") &&
        response.request().method() === "POST"
    );
    await page
      .getByRole("button", { exact: true, name: "Regenerate response" })
      .click();
    const regeneration = await regenerated;
    expect(regeneration.ok()).toBe(true);
    expect(regeneration.request().postDataJSON().modelId).toBe(sourceModelId);
    await expect(page).not.toHaveURL(
      new RegExp(`/chat/${accepted?.id}$`, "u"),
      {
        timeout: 60_000,
      }
    );
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({
      timeout: 90_000,
    });
    await expect(
      page.getByRole("combobox", { name: "Conversation version" })
    ).toContainText("Version 3");
    await expect(page.getByRole("log").locator(".is-user")).toContainText(
      "cobalt"
    );
    await expect(page.getByRole("log").locator(".is-assistant")).toHaveCount(1);
    await page
      .getByRole("navigation", { name: "Conversation versions" })
      .screenshot({
        animations: "disabled",
        path: testInfo.outputPath("version-navigation.png"),
      });
    await page
      .getByRole("link", { exact: true, name: "Original conversation" })
      .click();
    await expect(page).toHaveURL(new RegExp(`/chat/${source.id}$`, "u"));
    await expect(page.getByRole("log").locator(".is-user")).toContainText(
      "amber"
    );
    await expect(page.getByRole("log")).not.toContainText("cobalt");
    await page
      .getByRole("button", { exact: true, name: "Edit message" })
      .click();
    await editor
      .getByRole("textbox", { exact: true, name: "Message" })
      .fill("Keep this edited violet draft.");
    await page.route(
      "**/api/agent-conversations",
      (route) =>
        route.fulfill({
          json: { error: "Temporary test outage" },
          status: 503,
        }),
      { times: 1 }
    );
    await editor.getByRole("button", { exact: true, name: "Send" }).click();
    await expect(
      page.getByRole("button", { name: "Recover version" })
    ).toBeEnabled();
    await page.reload();
    await expect(
      page.getByRole("combobox", { name: "Conversation version" })
    ).toContainText("Original");
    await expect(
      page.getByRole("button", { name: "Recover version" })
    ).toBeVisible();
    await page.getByRole("region", { name: "Version recovery" }).screenshot({
      animations: "disabled",
      path: testInfo.outputPath("retained-edit.png"),
    });
    await page.route(
      "**/api/agent-conversations",
      (route) =>
        route.fulfill({
          json: { creationRejected: true, error: "Test model rejection" },
          status: 400,
        }),
      { times: 1 }
    );
    await page.getByRole("button", { name: "Recover version" }).click();
    await expect(
      editor.getByRole("textbox", { exact: true, name: "Message" })
    ).toHaveText("Keep this edited violet draft.");
    await expect(editor).toContainText("Test model rejection");
    let replacement: unknown;
    await page.route(
      "**/api/agent-conversations",
      async (route) => {
        replacement = route.request().postDataJSON();
        await route.fulfill({
          json: { creationRejected: true, error: "End of test" },
          status: 400,
        });
      },
      { times: 1 }
    );
    await editor.getByRole("button", { exact: true, name: "Send" }).click();
    await expect(editor).toContainText("End of test");
    expect(replacement).toMatchObject({
      fork: { beforeTurnId: "turn_0", conversationId: source.id },
      message: "Keep this edited violet draft.",
    });
  } catch (error) {
    bodyFailed = true;
    throw error;
  } finally {
    testInfo.setTimeout(testInfo.timeout + 150_000);
    if (cleanup) {
      const url = `/api/agent-conversations/${cleanup.id}`;
      const headers = { origin: cleanup.origin };
      try {
        await expect
          .poll(
            async () => {
              const response = await page.request
                .delete(url, { headers, timeout: 30_000 })
                .catch(() => null);
              return response?.status() === 200 ? response.json() : null;
            },
            { intervals: [1000, 2000, 5000], timeout: 90_000 }
          )
          .toEqual({ rootId: cleanup.id, status: "deleted" });
      } catch (error) {
        if (!bodyFailed) {
          cleanupFailure = { error };
        }
        testInfo.annotations.push({
          description: "Native conversation family cleanup also failed.",
          type: "cleanup",
        });
      }
    }
  }
  if (cleanupFailure) {
    throw cleanupFailure.error;
  }
});
