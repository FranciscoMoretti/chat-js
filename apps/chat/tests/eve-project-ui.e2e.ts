import { expect, test } from "@playwright/test";
import { z } from "zod";

import { assertEveTestDatabase } from "./eve-test-database";

test.use({ actionTimeout: 20_000 });

const projectUrl = /\/project\/[a-f\d-]+$/;
const conversationUrl = /\/chat\/[a-f\d-]+$/;
const modelId = "openai/gpt-5-nano";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

test("project UI edits instructions, creates a native conversation and lists it after reload", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const origin = new URL(page.url()).origin;
  await page.request.post("/api/chat-model", {
    data: { model: modelId },
  });
  await page.getByRole("button", { name: "New project", exact: true }).click();
  const createDialog = page.getByRole("dialog");
  await createDialog
    .getByPlaceholder("Project name")
    .fill("Project UI fixture");
  await page.route(
    (url) => url.pathname.includes("project.create"),
    (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: "{}",
      }),
    { times: 1 }
  );
  await createDialog
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await expect(createDialog.getByRole("alert")).toBeVisible();
  await expect(createDialog.getByPlaceholder("Project name")).toHaveValue(
    "Project UI fixture"
  );
  await createDialog.screenshot({
    path: testInfo.outputPath("create-error.png"),
    animations: "disabled",
    style:
      'nextjs-portal, [aria-label="Open Tanstack query devtools"] { display: none !important; }',
  });
  await createDialog
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await expect(page).toHaveURL(projectUrl);
  const projectId = z.uuid().parse(page.url().split("/").at(-1));
  let deletedInUI = false;
  let conversationId: string | undefined;
  let bodyFailed = false;
  let cleanupFailure: { error: unknown } | undefined;
  try {
    await page.goto(`/project/${projectId}`);
    await expect(
      page.getByRole("heading", { name: "Project UI fixture", exact: true })
    ).toBeVisible();
    for (const width of [1100, 390]) {
      await page.setViewportSize({ width, height: 850 });
      await page
        .locator("section")
        .filter({
          has: page.getByRole("textbox", { name: "Message", exact: true }),
        })
        .screenshot({
          path: testInfo.outputPath(`project-empty-${width}.png`),
          animations: "disabled",
          style:
            'nextjs-portal, [aria-label="Open Tanstack query devtools"] { display: none !important; }',
        });
    }
    await page.setViewportSize({ width: 1100, height: 850 });
    await page
      .getByRole("button", { name: "Instructions", exact: true })
      .click();
    const instructionDialog = page.getByRole("dialog");
    await instructionDialog
      .getByRole("textbox", { name: "Project instructions" })
      .fill("Reply with exactly PROJECT_UI_7238 and nothing else.");
    await page.route(
      (url) => url.pathname.includes("project.setInstructions"),
      (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: "{}",
        }),
      { times: 1 }
    );
    await instructionDialog
      .getByRole("button", { name: "Save instructions" })
      .click();
    await expect(instructionDialog.getByRole("alert")).toBeVisible();
    await instructionDialog.screenshot({
      path: testInfo.outputPath("instructions-error.png"),
      animations: "disabled",
      style:
        'nextjs-portal, [aria-label="Open Tanstack query devtools"] { display: none !important; }',
    });
    await instructionDialog
      .getByRole("button", { name: "Save instructions" })
      .click();
    await expect(instructionDialog).not.toBeVisible();
    await page.getByRole("button", { name: "Rename project" }).click();
    const renameDialog = page.getByRole("dialog");
    await renameDialog
      .getByPlaceholder("Project name")
      .fill("Renamed project fixture");
    await page.route(
      (url) => url.pathname.includes("project.update"),
      (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: "{}",
        }),
      { times: 1 }
    );
    await renameDialog
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect(renameDialog.getByRole("alert")).toBeVisible();
    await renameDialog.screenshot({
      path: testInfo.outputPath("rename-error.png"),
      animations: "disabled",
      style:
        'nextjs-portal, [aria-label="Open Tanstack query devtools"] { display: none !important; }',
    });
    await renameDialog
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect(renameDialog).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Renamed project fixture" })
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: "Message", exact: true })
      .fill("Follow the project instruction.");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page).toHaveURL(conversationUrl);
    conversationId = page.url().split("/").at(-1);
    await expect(page.locator(".is-assistant")).toContainText(
      "PROJECT_UI_7238",
      { timeout: 90_000 }
    );
    await page.goto(`/project/${projectId}`);
    await expect(
      page.getByRole("textbox", { name: "Message", exact: true })
    ).toHaveText("");
    const row = page
      .locator("section")
      .filter({
        has: page.getByRole("textbox", { name: "Message", exact: true }),
      })
      .getByRole("link", {
        name: "Follow the project instruction.",
        exact: true,
      });
    await expect(row).toBeVisible();
    await expect(row).toHaveAttribute(
      "href",
      `/project/${projectId}/chat/${conversationId}`
    );
    await page
      .locator("section")
      .filter({
        has: page.getByRole("textbox", { name: "Message", exact: true }),
      })
      .screenshot({
        path: testInfo.outputPath("project-populated.png"),
        animations: "disabled",
        style:
          'nextjs-portal, [aria-label="Open Tanstack query devtools"] { display: none !important; }',
      });
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/chat/${conversationId}$`));
    await page.goto(`/project/${projectId}`);
    if (
      await page
        .locator('[data-state="collapsed"][data-collapsible="icon"]')
        .count()
    ) {
      await page
        .getByRole("button", { name: "Toggle Sidebar", exact: true })
        .first()
        .click();
    }
    const projectRow = page.locator('[data-sidebar="menu-item"]').filter({
      has: page.locator(`a[href="/project/${projectId}"]`),
    });
    await projectRow.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
    const deleteDialog = page.getByRole("alertdialog");
    await page.route(
      (url) => url.pathname.includes("project.remove"),
      (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: "{}",
        }),
      { times: 1 }
    );
    await deleteDialog
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(deleteDialog.getByRole("alert")).toBeVisible();
    await deleteDialog.screenshot({
      path: testInfo.outputPath("delete-error.png"),
      animations: "disabled",
    });
    await deleteDialog
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(page).toHaveURL(new URL("/", page.url()).href);
    deletedInUI = true;
    const surviving = page.locator(`a[href="/chat/${conversationId}"]`);
    await expect(surviving).toHaveAttribute("href", `/chat/${conversationId}`);
    await surviving.click();
    await expect(page.locator(".is-assistant")).toContainText(
      "PROJECT_UI_7238"
    );
  } catch (error) {
    bodyFailed = true;
    throw error;
  } finally {
    testInfo.setTimeout(testInfo.timeout + 150_000);
    try {
      try {
        if (!deletedInUI) {
          const removed = await page.request.post("/api/trpc/project.remove", {
            data: { json: { id: projectId } },
          });
          expect(removed.ok(), await removed.text()).toBe(true);
        }
      } finally {
        if (conversationId) {
          const url = `/api/agent-conversations/${conversationId}`;
          await expect
            .poll(
              async () => {
                const response = await page.request
                  .delete(url, { headers: { origin }, timeout: 30_000 })
                  .catch(() => null);
                return response?.status() === 200 ? response.json() : null;
              },
              { timeout: 90_000, intervals: [1000, 2000, 5000] }
            )
            .toEqual({ status: "deleted", rootId: conversationId });
        }
      }
    } catch (error) {
      if (!bodyFailed) {
        cleanupFailure = { error };
      }
      testInfo.annotations.push({
        type: "cleanup",
        description: "Project or native conversation cleanup also failed.",
      });
    }
  }
  if (cleanupFailure) {
    throw cleanupFailure.error;
  }
});
