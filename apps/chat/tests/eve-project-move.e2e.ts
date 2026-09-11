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
      headers: { origin: new URL(page.url()).origin },
      data: {
        operationId: crypto.randomUUID(),
        modelId: "openai/gpt-4.1-mini-fast",
        message: "Reply exactly move-fixture-ok.",
      },
    });
    expect(created.ok(), await created.text()).toBe(true);
    const { id } = z.object({ id: z.uuid() }).parse(await created.json());
    await page.goto(`/chat/${id}`);
    await expect(page.locator(".is-assistant")).toContainText(
      "move-fixture-ok",
      { timeout: 90_000 }
    );
    const projectsRoute = (url: URL) => url.pathname.includes("project.list");
    let releaseProjects: () => void = () => undefined;
    const projectsGate = new Promise<void>((resolve) => {
      releaseProjects = resolve;
    });
    await page.route(projectsRoute, async (route) => {
      await projectsGate;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: "{}",
      });
    });
    await page.reload();
    if (
      await page
        .locator('[data-state="collapsed"][data-collapsible="icon"]')
        .count()
    ) {
      await page
        .getByRole("button", { name: "Expand sidebar", exact: true })
        .first()
        .click();
    }
    const sidebarRow = page
      .locator('[data-sidebar="menu-item"]')
      .filter({ has: page.locator(`a[href="/chat/${id}"]`) });
    await sidebarRow.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("menuitem", { name: "Move to project" }).click();
    const dialog = page.getByRole("dialog", { name: "Move to project" });
    await expect(dialog.getByRole("status")).toHaveText("Loading projects…");
    await dialog.screenshot({
      path: testInfo.outputPath("move-loading.png"),
      animations: "disabled",
      style: screenshotStyle,
    });
    releaseProjects();
    await expect(dialog.getByRole("alert")).toContainText(
      "Could not load projects."
    );
    await dialog.screenshot({
      path: testInfo.outputPath("move-load-error.png"),
      animations: "disabled",
      style: screenshotStyle,
    });
    await page.unroute(projectsRoute);
    await dialog.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(
      dialog.getByRole("combobox", { name: "Project", exact: true })
    ).toBeEnabled();
    await dialog.getByRole("combobox").selectOption(projectId);
    await page.route(
      (url) => url.pathname.includes("eve.assignProject"),
      (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: "{}",
        }),
      { times: 1 }
    );
    await dialog.getByRole("button", { name: "Move", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText(
      "Could not move the conversation."
    );
    await expect(dialog.getByRole("combobox")).toHaveValue(projectId);
    await dialog.screenshot({
      path: testInfo.outputPath("move-save-error.png"),
      animations: "disabled",
      style: screenshotStyle,
    });
    let releaseMove: () => void = () => undefined;
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
    await dialog.getByRole("button", { name: "Move", exact: true }).click();
    await expect(
      dialog.getByRole("button", { name: "Moving…", exact: true })
    ).toBeDisabled();
    await dialog.screenshot({
      path: testInfo.outputPath("move-pending.png"),
      animations: "disabled",
      style: screenshotStyle,
    });
    releaseMove();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.locator(`a[href="/project/${projectId}/chat/${id}"]`)
    ).toBeVisible();
    await page.goto(`/project/${projectId}`);
    await page.setViewportSize({ width: 390, height: 850 });
    const surface = page.locator("section").filter({
      has: page.getByRole("textbox", { name: "Message", exact: true }),
    });
    const projectRow = surface.locator("li").filter({
      has: page.locator(`a[href="/project/${projectId}/chat/${id}"]`),
    });
    await projectRow.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("menuitem", { name: "Move to project" }).click();
    await dialog.getByRole("combobox").selectOption("");
    await dialog.screenshot({
      path: testInfo.outputPath("move-remove-mobile.png"),
      animations: "disabled",
      style: screenshotStyle,
    });
    await dialog.getByRole("button", { name: "Move", exact: true }).click();
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
