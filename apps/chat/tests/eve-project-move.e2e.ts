/* oxlint-disable promise/avoid-new -- These fixtures adapt callback, timer, stream, or browser event APIs into awaited Promises. */
/* oxlint-disable unicorn/consistent-function-scoping -- One-off helpers stay beside the scenario state they coordinate. */
import { expect, test } from "@playwright/test";
import { z } from "zod";

import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
test.use({ actionTimeout: 20_000 });
const screenshotStyle =
  'nextjs-portal, [aria-label="Open Tanstack query devtools"] { display: none !important; }';

test("moves native conversations from sidebar and project rows with recoverable failures", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const response = await page.request.post("/api/trpc/project.create", {
    data: { json: { name: "Move target fixture" } },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const projectId = z
    .object({
      result: z.object({
        data: z.object({ json: z.object({ id: z.uuid() }) }),
      }),
    })
    .parse(await response.json()).result.data.json.id;
  try {
    const created = await page.request.post("/api/agent-conversations", {
      data: {
        message: "Reply exactly move-fixture-ok.",
        modelId: "openai/gpt-4.1-mini-fast",
        operationId: crypto.randomUUID(),
      },
      headers: { origin: new URL(page.url()).origin },
    });
    expect(created.ok(), await created.text()).toBe(true);
    const { id } = z.object({ id: z.uuid() }).parse(await created.json());
    await page.goto(`/chat/${id}`);
    await expect(page.locator(".is-assistant")).toContainText(
      "move-fixture-ok",
      { timeout: 90_000 }
    );
    const projectsRoute = (url: URL) => url.pathname.includes("project.list");
    let releaseProjects: () => void = () => {
      /* empty */
    };
    const projectsGate = new Promise<void>((resolve) => {
      releaseProjects = resolve;
    });
    await page.route(projectsRoute, async (route) => {
      await projectsGate;
      await route.fulfill({
        body: "{}",
        contentType: "application/json",
        status: 500,
      });
    });
    await page.reload();
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
    const sidebarRow = page
      .locator('[data-sidebar="menu-item"]')
      .filter({ has: page.locator(`a[href="/chat/${id}"]`) });
    await sidebarRow.getByRole("button", { exact: true, name: "More" }).click();
    await page.getByRole("menuitem", { name: "Move to project" }).click();
    const dialog = page.getByRole("dialog", { name: "Move to project" });
    await expect(dialog.getByRole("status")).toHaveText("Loading projects…");
    await dialog.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("move-loading.png"),
      style: screenshotStyle,
    });
    releaseProjects();
    await expect(dialog.getByRole("alert")).toContainText(
      "Could not load projects."
    );
    await dialog.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("move-load-error.png"),
      style: screenshotStyle,
    });
    await page.unroute(projectsRoute);
    await dialog.getByRole("button", { exact: true, name: "Retry" }).click();
    await expect(
      dialog.getByRole("combobox", { exact: true, name: "Project" })
    ).toBeEnabled();
    await dialog.getByRole("combobox").selectOption(projectId);
    await page.route(
      (url) => url.pathname.includes("eve.assignProject"),
      (route) =>
        route.fulfill({
          body: "{}",
          contentType: "application/json",
          status: 500,
        }),
      { times: 1 }
    );
    await dialog.getByRole("button", { exact: true, name: "Move" }).click();
    await expect(dialog.getByRole("alert")).toContainText(
      "Could not move the conversation."
    );
    await expect(dialog.getByRole("combobox")).toHaveValue(projectId);
    await dialog.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("move-save-error.png"),
      style: screenshotStyle,
    });
    let releaseMove: () => void = () => {
      /* empty */
    };
    const moveGate = new Promise<void>((resolve) => {
      releaseMove = resolve;
    });
    await page.route(
      (url) => url.pathname.includes("eve.assignProject"),
      async (route) => {
        await moveGate;
        await route.continue();
      },
      { times: 1 }
    );
    await dialog.getByRole("button", { exact: true, name: "Move" }).click();
    await expect(
      dialog.getByRole("button", { exact: true, name: "Moving…" })
    ).toBeDisabled();
    await dialog.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("move-pending.png"),
      style: screenshotStyle,
    });
    releaseMove();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.locator(`a[href="/project/${projectId}/chat/${id}"]`)
    ).toBeVisible();
    await page.goto(`/project/${projectId}`);
    await page.setViewportSize({ height: 850, width: 390 });
    const surface = page.locator("section").filter({
      has: page.getByRole("textbox", { exact: true, name: "Message" }),
    });
    const projectRow = surface.locator("li").filter({
      has: page.locator(`a[href="/project/${projectId}/chat/${id}"]`),
    });
    await projectRow.getByRole("button", { exact: true, name: "More" }).click();
    await page.getByRole("menuitem", { name: "Move to project" }).click();
    await dialog.getByRole("combobox").selectOption("");
    await dialog.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("move-remove-mobile.png"),
      style: screenshotStyle,
    });
    await dialog.getByRole("button", { exact: true, name: "Move" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(projectRow).toHaveCount(0);
    await page.goto(`/chat/${id}`);
    await expect(page.locator(".is-assistant")).toContainText(
      "move-fixture-ok"
    );
  } finally {
    const removed = await page.request.post("/api/trpc/project.remove", {
      data: { json: { id: projectId } },
    });
    expect(removed.ok(), await removed.text()).toBe(true);
  }
});
