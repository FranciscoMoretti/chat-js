import { expect, test } from "@playwright/test";
import type { TestInfo } from "@playwright/test";

import { textPdf } from "./eve-attachment-fixtures";

const projectPath = /\/project\/[a-f\d-]+$/u;

for (const project of [false, true]) {
  test(`first message is optimistic and recoverable in ${project ? "a project with an attachment" : "a new chat"}`, async ({
    page,
  }, testInfo: Readonly<Pick<TestInfo, "outputPath">>) => {
    await page.route("https://unpkg.com/react-scan/**", async (route) => {
      await route.abort();
    });
    await page.goto("/api/dev-login", { waitUntil: "domcontentloaded" });
    const composer = page.getByRole("group", {
      exact: true,
      name: "Message composer",
    });
    let projectId: string | undefined;
    const release: PromiseWithResolvers<void> = Promise.withResolvers();
    await page.route("**/api/agent-conversations", async (route) => {
      await release.promise;
      await route.fulfill({
        json: { error: "Test creation unavailable" },
        status: 503,
      });
    });
    try {
      await expect(
        composer.getByLabel("Message", { exact: true })
      ).toBeEditable();
      if (project) {
        await page
          .getByRole("button", { exact: true, name: "Expand sidebar" })
          .click();
        await page
          .getByRole("button", { exact: true, name: "New project" })
          .click();
        const dialog = page.getByRole("dialog");
        await dialog
          .getByPlaceholder("Project name")
          .fill("Optimistic send fixture");
        await dialog
          .getByRole("button", { exact: true, name: "Create" })
          .click();
        await expect(page).toHaveURL(projectPath);
        projectId = new URL(page.url()).pathname.split("/").at(-1);
        await page.setViewportSize({ height: 844, width: 390 });
        await page.route("**/api/files/upload", async (route) => {
          await route.fulfill({
            json: {
              url: "/api/files/012345678901234567890123.pdf",
            },
            status: 200,
          });
        });
        await page
          .getByRole("group", { exact: true, name: "Message composer" })
          .getByLabel("Attach files", { exact: true })
          .setInputFiles({
            buffer: textPdf("Pending attachment"),
            mimeType: "application/pdf",
            name: "pending.pdf",
          });
        await expect(
          composer
            .getByTestId("attachments-preview")
            .getByRole("button", { exact: true, name: "pending.pdf" })
        ).toBeVisible();
      }
      const input = composer.getByLabel("Message", { exact: true });
      await expect(input).toBeEditable();
      await input.fill("Optimistic first message");
      const firstRequest = page.waitForRequest("**/api/agent-conversations");
      await composer.getByLabel("Send", { exact: true }).click();
      const original = await firstRequest;
      const firstBody = original.postData();
      expect(firstBody).toContain("Optimistic first message");
      if (project) {
        expect(firstBody).toContain("pending.pdf");
      }

      await expect(page.getByRole("log")).toContainText(
        "Optimistic first message",
        { timeout: 1000 }
      );
      await expect(composer.getByLabel("Message", { exact: true })).toHaveValue(
        ""
      );
      await page.screenshot({
        animations: "disabled",
        path: testInfo.outputPath("optimistic-first-message.png"),
      });
      if (project) {
        await expect(
          page.getByRole("button", { exact: true, name: "Rename project" })
        ).toBeHidden();
        await expect(
          page.getByText("No chats in this project", { exact: true })
        ).toBeHidden();
        await expect(
          page
            .getByRole("log")
            .getByRole("button", { exact: true, name: "pending.pdf" })
        ).toBeVisible();
        await expect(
          page
            .getByRole("group", { exact: true, name: "Message composer" })
            .getByTestId("input-attachment-preview")
        ).toHaveCount(0);
      }
      release.resolve();
      const recovery = page.getByRole("region", {
        name: "Conversation recovery",
      });
      await expect(recovery.getByRole("alert")).toHaveText(
        "Test creation unavailable"
      );
      await expect(recovery).toContainText("Optimistic first message");
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(recovery).toContainText("Optimistic first message");
      const retried = page.waitForRequest("**/api/agent-conversations");
      await recovery.getByRole("button", { name: "Retry creation" }).click();
      const replay = await retried;
      expect(replay.postData()).toBe(firstBody);
    } finally {
      release.resolve();
      if (projectId !== undefined && projectId !== null && projectId !== "") {
        const removed = await page.request.post("/api/trpc/project.remove", {
          data: { json: { id: projectId } },
          timeout: 15_000,
        });
        expect(removed.status()).toBe(200);
      }
    }
  });
}

const chatPath = /\/chat\/[a-f\d-]+$/u;
const visualStyle =
  "nextjs-portal, #react-scan-toolbar, #react-scan-root, .tsqd-parent-container { visibility: hidden !important; }";

for (const identity of ["registered", "guest"]) {
  test(`first send keeps its document and optimistic message through stream attachment (${identity})`, async ({
    page,
  }, testInfo: Readonly<Pick<TestInfo, "outputPath">>) => {
    await page.route("https://unpkg.com/react-scan/**", async (route) => {
      await route.abort();
    });
    await page.goto(identity === "registered" ? "/api/dev-login" : "/", {
      waitUntil: "domcontentloaded",
    });
    const input = page.getByLabel("Message", { exact: true });
    await expect(input).toBeEditable();
    const message = "Do not use tools. Reply with exactly: Runtime ready";
    const creation: PromiseWithResolvers<void> = Promise.withResolvers();
    const stream: PromiseWithResolvers<void> = Promise.withResolvers();
    await page.route("**/api/agent-conversations", async (route) => {
      await creation.promise;
      await route.continue();
    });
    await page.route("**/stream?**", async (route) => {
      await stream.promise;
      await route.continue();
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    let documents = 0;
    cdp.on(
      "Network.requestWillBeSent",
      (event: Readonly<{ type?: string }>) => {
        if (event.type === "Document") {
          documents += 1;
        }
      }
    );
    const origin = await page.evaluate(() => performance.timeOrigin);
    try {
      await input.fill(message);
      await page.getByRole("button", { exact: true, name: "Send" }).click();
      await expect(page.getByRole("log")).toContainText(message);
      await page.evaluate((text) => {
        document.documentElement.dataset.missingFirstMessage = "false";
        const observer = new MutationObserver(() => {
          if (
            document
              .querySelector('[role="log"]')
              ?.textContent?.includes(text) !== true
          ) {
            document.documentElement.dataset.missingFirstMessage = "true";
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        document.addEventListener(
          "stop-message-observer",
          () => {
            observer.disconnect();
          },
          { once: true }
        );
      }, message);
      creation.resolve();
      await expect(page).toHaveURL(chatPath);
      await expect(page.getByRole("log")).toContainText(message);
      await page.screenshot({
        animations: "disabled",
        path: testInfo.outputPath("awaiting-first-stream.png"),
        style: visualStyle,
      });
      expect(await page.evaluate(() => performance.timeOrigin)).toBe(origin);
      expect(documents).toBe(0);
      stream.resolve();
      await expect(
        page.getByRole("log").getByText("Runtime ready", { exact: true })
      ).toBeVisible({ timeout: 60_000 });
      await expect(
        page.getByRole("log").getByText(message, { exact: true })
      ).toHaveCount(1);
      expect(
        await page.evaluate(
          () => document.documentElement.dataset.missingFirstMessage
        )
      ).toBe("false");
      expect(documents).toBe(0);
      await page.evaluate(() =>
        document.dispatchEvent(new Event("stop-message-observer"))
      );
      await expect(page.getByText("Ready", { exact: true })).toHaveCount(1);
      await page.screenshot({
        animations: "disabled",
        path: testInfo.outputPath("first-reply.png"),
        style: visualStyle,
      });
      await expect(input).toBeEditable();
      await input.fill("Do not use tools. Reply with exactly: Followup ready");
      await page.getByRole("button", { exact: true, name: "Send" }).click();
      await expect(
        page.getByRole("log").getByText("Followup ready", { exact: true })
      ).toBeVisible({ timeout: 60_000 });
      await page.goBack();
      await expect(input).toHaveValue("");
      await page.goForward();
      await expect(page.getByRole("log")).toContainText("Followup ready");
      expect(documents).toBe(0);
      await page.reload();
      await expect(page.getByRole("log")).toContainText("Followup ready");
      await expect(
        page.getByRole("log").getByText(message, { exact: true })
      ).toHaveCount(1);
      await page.getByRole("link", { name: /^New Chat/u }).click();
      await expect(input).toHaveValue("");
      await expect(page.getByRole("log")).toHaveCount(0);
    } finally {
      creation.resolve();
      stream.resolve();
    }
  });
}
