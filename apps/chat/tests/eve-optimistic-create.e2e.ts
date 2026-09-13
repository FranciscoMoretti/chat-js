import { expect, test } from "@playwright/test";

import { textPdf } from "./eve-attachment-fixtures";

const projectPath = /\/project\/[a-f\d-]+$/;

for (const project of [false, true]) {
  test(`first message is optimistic and recoverable in ${project ? "a project with an attachment" : "a new chat"}`, async ({
    page,
  }, testInfo) => {
    await page.route("https://unpkg.com/react-scan/**", (route) =>
      route.abort()
    );
    await page.goto("/api/dev-login", { waitUntil: "domcontentloaded" });
    const composer = page.getByRole("group", {
      name: "Message composer",
      exact: true,
    });
    let projectId: string | undefined;
    const release = Promise.withResolvers<void>();
    let received = false;
    await page.route("**/api/agent-conversations", async (route) => {
      received = true;
      await release.promise;
      await route.fulfill({
        status: 503,
        json: { error: "Test creation unavailable" },
      });
    });
    try {
      await expect(
        composer.getByLabel("Message", { exact: true })
      ).toHaveAttribute("contenteditable", "true");
      if (project) {
        await page
          .getByRole("button", { name: "New project", exact: true })
          .click();
        const dialog = page.getByRole("dialog");
        await dialog
          .getByPlaceholder("Project name")
          .fill("Optimistic send fixture");
        await dialog
          .getByRole("button", { name: "Create", exact: true })
          .click();
        await expect(page).toHaveURL(projectPath);
        projectId = new URL(page.url()).pathname.split("/").at(-1);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.route("**/api/files/upload", (route) =>
          route.fulfill({
            status: 200,
            json: {
              url: "/api/files/content?key=012345678901234567890123.pdf",
            },
          })
        );
        await page
          .getByRole("group", { name: "Message composer", exact: true })
          .getByLabel("Attach files", { exact: true })
          .setInputFiles({
            name: "pending.pdf",
            mimeType: "application/pdf",
            buffer: textPdf("Pending attachment"),
          });
        await expect(
          page.getByRole("button", { name: "pending.pdf", exact: true })
        ).toBeVisible();
      }
      const input = composer.getByLabel("Message", { exact: true });
      await expect(input).toHaveAttribute("contenteditable", "true");
      await input.fill("Optimistic first message");
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await expect.poll(() => received, { timeout: 5000 }).toBe(true);

      await expect(page.getByRole("log")).toContainText(
        "Optimistic first message",
        { timeout: 1000 }
      );
      await expect(composer.getByLabel("Message", { exact: true })).toHaveText(
        ""
      );
      await page.screenshot({
        path: testInfo.outputPath("optimistic-first-message.png"),
        animations: "disabled",
      });
      if (project) {
        await expect(
          page
            .getByRole("log")
            .getByRole("button", { name: "pending.pdf", exact: true })
        ).toBeVisible();
        await expect(
          page
            .getByRole("group", { name: "Message composer", exact: true })
            .getByTestId("input-attachment-preview")
        ).toHaveCount(0);
      }
      release.resolve();
      await expect(page.getByRole("alert")).toBeVisible();
      await expect(composer.getByLabel("Message", { exact: true })).toHaveText(
        "Optimistic first message"
      );
      if (project) {
        await expect(
          page
            .getByRole("group", { name: "Message composer", exact: true })
            .getByRole("button", { name: "pending.pdf", exact: true })
        ).toBeVisible();
      }
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(composer.getByLabel("Message", { exact: true })).toHaveText(
        "Optimistic first message"
      );
      if (project) {
        await expect(
          page
            .getByRole("group", { name: "Message composer", exact: true })
            .getByRole("button", { name: "pending.pdf", exact: true })
        ).toBeVisible();
      }
    } finally {
      release.resolve();
      if (projectId) {
        const removed = await page.request.post("/api/trpc/project.remove", {
          data: { json: { id: projectId } },
          timeout: 15_000,
        });
        expect(removed.status()).toBe(200);
      }
    }
  });
}
