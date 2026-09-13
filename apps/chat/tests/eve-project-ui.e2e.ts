/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
import { expect, test } from "@playwright/test";
import { z } from "zod";

import { assertEveTestDatabase } from "./eve-test-database";

test.use({ actionTimeout: 20_000 });

const projectUrl = /\/project\/[a-f\d-]+$/u;
const conversationUrl = /\/chat\/[a-f\d-]+$/u;
const modelId = "openai/gpt-5-nano";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

test("project UI edits instructions, creates a native conversation and lists it after reload", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const { origin } = new URL(page.url());
  await page.request.post("/api/chat-model", {
    data: { model: modelId },
  });
  await page.getByRole("button", { exact: true, name: "New project" }).click();
  const createDialog = page.getByRole("dialog");
  await createDialog
    .getByPlaceholder("Project name")
    .fill("Project UI fixture");
  await page.route(
    (url) => url.pathname.includes("project.create"),
    (route) =>
      route.fulfill({
        body: "{}",
        contentType: "application/json",
        status: 500,
      }),
    { times: 1 }
  );
  await createDialog
    .getByRole("button", { exact: true, name: "Create" })
    .click();
  await expect(createDialog.getByRole("alert")).toBeVisible();
  await expect(createDialog.getByPlaceholder("Project name")).toHaveValue(
    "Project UI fixture"
  );
  await createDialog.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("create-error.png"),
    style:
      'nextjs-portal, [aria-label="Open Tanstack query devtools"] { display: none !important; }',
  });
  await createDialog
    .getByRole("button", { exact: true, name: "Create" })
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
      page.getByRole("heading", { exact: true, name: "Project UI fixture" })
    ).toBeVisible();
    for (const width of [1100, 390]) {
      await page.setViewportSize({ height: 850, width });
      await page
        .locator("section")
        .filter({
          has: page.getByRole("textbox", { exact: true, name: "Message" }),
        })
        .screenshot({
          animations: "disabled",
          path: testInfo.outputPath(`project-empty-${width}.png`),
          style:
            'nextjs-portal, [aria-label="Open Tanstack query devtools"] { display: none !important; }',
        });
    }
    await page.setViewportSize({ height: 850, width: 1100 });
    await page
      .getByRole("button", { exact: true, name: "Instructions" })
      .click();
    const instructionDialog = page.getByRole("dialog");
    await instructionDialog
      .getByRole("textbox", { name: "Project instructions" })
      .fill("Reply with exactly PROJECT_UI_7238 and nothing else.");
    await page.route(
      (url) => url.pathname.includes("project.setInstructions"),
      (route) =>
        route.fulfill({
          body: "{}",
          contentType: "application/json",
          status: 500,
        }),
      { times: 1 }
    );
    await instructionDialog
      .getByRole("button", { name: "Save instructions" })
      .click();
    await expect(instructionDialog.getByRole("alert")).toBeVisible();
    await instructionDialog.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("instructions-error.png"),
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
          body: "{}",
          contentType: "application/json",
          status: 500,
        }),
      { times: 1 }
    );
    await renameDialog
      .getByRole("button", { exact: true, name: "Save" })
      .click();
    await expect(renameDialog.getByRole("alert")).toBeVisible();
    await renameDialog.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("rename-error.png"),
      style:
        'nextjs-portal, [aria-label="Open Tanstack query devtools"] { display: none !important; }',
    });
    await renameDialog
      .getByRole("button", { exact: true, name: "Save" })
      .click();
    await expect(renameDialog).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Renamed project fixture" })
    ).toBeVisible();
    await page
      .getByRole("textbox", { exact: true, name: "Message" })
      .fill("Follow the project instruction.");
    await page.getByRole("button", { exact: true, name: "Send" }).click();
    await expect(page).toHaveURL(conversationUrl);
    conversationId = page.url().split("/").at(-1);
    await expect(page.locator(".is-assistant")).toContainText(
      "PROJECT_UI_7238",
      { timeout: 90_000 }
    );
    await page.goto(`/project/${projectId}`);
    await expect(
      page.getByRole("textbox", { exact: true, name: "Message" })
    ).toHaveText("");
    const row = page
      .locator("section")
      .filter({
        has: page.getByRole("textbox", { exact: true, name: "Message" }),
      })
      .getByRole("link", {
        exact: true,
        name: "Follow the project instruction.",
      });
    await expect(row).toBeVisible();
    await expect(row).toHaveAttribute(
      "href",
      `/project/${projectId}/chat/${conversationId}`
    );
    await page
      .locator("section")
      .filter({
        has: page.getByRole("textbox", { exact: true, name: "Message" }),
      })
      .screenshot({
        animations: "disabled",
        path: testInfo.outputPath("project-populated.png"),
        style:
          'nextjs-portal, [aria-label="Open Tanstack query devtools"] { display: none !important; }',
      });
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/chat/${conversationId}$`, "u"));
    await page.goto(`/project/${projectId}`);
    if (
      await page
        .locator('[data-state="collapsed"][data-collapsible="icon"]')
        .count()
    ) {
      await page
        .getByRole("button", { exact: true, name: "Toggle Sidebar" })
        .first()
        .click();
    }
    const projectRow = page.locator('[data-sidebar="menu-item"]').filter({
      has: page.locator(`a[href="/project/${projectId}"]`),
    });
    await projectRow.getByRole("button", { exact: true, name: "More" }).click();
    await page.getByRole("menuitem", { exact: true, name: "Delete" }).click();
    const deleteDialog = page.getByRole("alertdialog");
    await page.route(
      (url) => url.pathname.includes("project.remove"),
      (route) =>
        route.fulfill({
          body: "{}",
          contentType: "application/json",
          status: 500,
        }),
      { times: 1 }
    );
    await deleteDialog
      .getByRole("button", { exact: true, name: "Delete" })
      .click();
    await expect(deleteDialog.getByRole("alert")).toBeVisible();
    await deleteDialog.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("delete-error.png"),
    });
    await deleteDialog
      .getByRole("button", { exact: true, name: "Delete" })
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
              { intervals: [1000, 2000, 5000], timeout: 90_000 }
            )
            .toEqual({ rootId: conversationId, status: "deleted" });
        }
      }
    } catch (error) {
      if (!bodyFailed) {
        cleanupFailure = { error };
      }
      testInfo.annotations.push({
        description: "Project or native conversation cleanup also failed.",
        type: "cleanup",
      });
    }
  }
  if (cleanupFailure) {
    throw cleanupFailure.error;
  }
});
