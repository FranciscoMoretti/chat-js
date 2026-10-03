/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
import { expect, test } from "@playwright/test";
import { z } from "zod";

import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable sort-imports */

test.use({ actionTimeout: 20_000 });

const projectUrl = /\/project\/[a-f\d-]+$/u;
const conversationUrl = /\/chat\/[a-f\d-]+$/u;
const modelId = "openai/gpt-5-nano";

/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): assertEveTestDatabase reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
/* oxlint-enable node/no-process-env */

/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null --
 * init-declarations (#507): test("project UI edits instructions, creates a native conversation and lists it after assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): test("project UI edits instructions, creates a native conversation and lists it after keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("project UI edits instructions, creates a native conversation and lists it after keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("project UI edits instructions, creates a native conversation and lists it after uses 180_000, -1, 1100, 390, 150_000, 200, 1000, 2000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("project UI edits instructions, creates a native conversation and lists it after sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): test("project UI edits instructions, creates a native conversation and lists it after handles optional response?.status() without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): test("project UI edits instructions, creates a native conversation and lists it after accepts { page, }; testInfo; route; url; request; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("project UI edits instructions, creates a native conversation and lists it after preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): test("project UI edits instructions, creates a native conversation and lists it after intentionally keeps the existing falsy-value behavior of conversationId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): test("project UI edits instructions, creates a native conversation and lists it after preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
test("project UI edits instructions, creates a native conversation and lists it after reload", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  if (
    await page
      .locator('[data-state="collapsed"][data-collapsible="icon"]')
      .count()
  ) {
    await page
      .getByRole("button", { exact: true, name: "Expand sidebar" })
      .first()
      .click();
  }
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
  await expect(createDialog).toHaveScreenshot("create-error.png", {
    animations: "disabled",
  });
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
    const invalidIdentityRequests: string[] = [];
    page.on("request", (request) => {
      if (
        request.url().includes("eve.get") &&
        decodeURIComponent(request.url()).includes(projectId)
      ) {
        invalidIdentityRequests.push(request.url());
      }
    });
    await page.goto(`/project/${projectId}`);
    await expect(
      page.getByRole("heading", { exact: true, name: "Project UI fixture" })
    ).toBeVisible();
    await expect(
      page.getByText("No chats in this project", { exact: true })
    ).toBeVisible();
    expect(invalidIdentityRequests).toEqual([]);
    await page.keyboard.press("Control+k");
    await expect(
      page.getByRole("dialog", { name: "Search chats" })
    ).toBeVisible();
    await page.getByRole("dialog", { name: "Search chats" }).screenshot({
      animations: "disabled",
      path: testInfo.outputPath("sidebar-search.png"),
    });
    await page.keyboard.press("Escape");
    await expect(
      page.locator('[data-sidebar="header"]').first()
    ).toHaveScreenshot("sidebar-controls.png", { animations: "disabled" });
    await page
      .locator('[data-sidebar="sidebar"]')
      .first()
      .screenshot({
        animations: "disabled",
        path: testInfo.outputPath("sidebar-projects.png"),
      });
    for (const width of [1100, 390]) {
      await page.setViewportSize({ height: 850, width });
      await expect(
        page.locator("section").filter({
          has: page.getByRole("textbox", { exact: true, name: "Message" }),
        })
      ).toHaveScreenshot(`project-empty-${width}.png`, {
        animations: "disabled",
        stylePath: "tests/visual-capture.css",
      });
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
    await expect(instructionDialog).toHaveScreenshot("instructions-error.png", {
      animations: "disabled",
    });
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
    const { promise: renameGate, resolve: rejectRename } =
      Promise.withResolvers<boolean>();
    await page.route(
      (url) => url.pathname.includes("project.update"),
      async (route) => {
        await renameGate;
        await route.fulfill({
          body: "{}",
          contentType: "application/json",
          status: 500,
        });
      },
      { times: 1 }
    );
    await renameDialog
      .getByRole("button", { exact: true, name: "Save" })
      .click();
    try {
      await expect(
        page.getByRole("heading", {
          exact: true,
          includeHidden: true,
          name: "Renamed project fixture",
        })
      ).toBeVisible();
      await expect(
        page.locator(`a[href="/project/${projectId}"]`)
      ).toContainText("Renamed project fixture");
    } finally {
      rejectRename(true);
    }
    await expect(renameDialog.getByRole("alert")).toBeVisible();
    await expect(renameDialog.getByPlaceholder("Project name")).toHaveValue(
      "Renamed project fixture"
    );
    await expect(
      renameDialog.getByRole("button", { exact: true, name: "Save" })
    ).toBeEnabled();
    await expect(
      page.getByRole("heading", {
        exact: true,
        includeHidden: true,
        name: "Project UI fixture",
      })
    ).toBeVisible();
    await expect(renameDialog).toHaveScreenshot("rename-error.png", {
      animations: "disabled",
    });
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
      .locator(`a[href="/project/${projectId}/chat/${conversationId}"]`);
    await expect(row).toBeVisible();
    await expect(row).toHaveAccessibleName(/\S/u);
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
        .getByRole("button", { exact: true, name: "Expand sidebar" })
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
    await expect(deleteDialog).toHaveScreenshot("delete-error.png", {
      animations: "disabled",
    });
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
                if (response?.status() !== 200) {
                  return null;
                }
                const responseBody: unknown = await response.json();
                return responseBody;
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
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable max-lines -- #509: This eve-project-ui.e2e.ts module keeps its existing fixture/scenario boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
