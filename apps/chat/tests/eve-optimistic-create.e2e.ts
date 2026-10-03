import { expect, test } from "@playwright/test";

import { textPdf } from "./eve-attachment-fixtures";

const projectPath = /\/project\/[a-f\d-]+$/u;

/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions --
 * init-declarations (#507): for (const project of [false, true]) { test(`first mess assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): for (const project of [false, true]) { test(`first mess keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): for (const project of [false, true]) { test(`first mess keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): for (const project of [false, true]) { test(`first mess uses -1, 0, 200 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): for (const project of [false, true]) { test(`first mess uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): for (const project of [false, true]) { test(`first mess accepts { page, }; testInfo; route; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): for (const project of [false, true]) { test(`first mess preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): for (const project of [false, true]) { test(`first mess intentionally keeps the existing falsy-value behavior of projectId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
for (const project of [false, true]) {
  test(`first message is optimistic and recoverable in ${project ? "a project with an attachment" : "a new chat"}`, async ({
    page,
  }, testInfo) => {
    await page.route("https://unpkg.com/react-scan/**", (route) =>
      route.abort()
    );
    await page.goto("/api/dev-login", { waitUntil: "domcontentloaded" });
    const composer = page.getByRole("group", {
      exact: true,
      name: "Message composer",
    });
    let projectId: string | undefined;
    const release = Promise.withResolvers<undefined>();
    let received = false;
    await page.route("**/api/agent-conversations", async (route) => {
      received = true;
      await release.promise;
      await route.fulfill({
        json: { error: "Test creation unavailable" },
        status: 503,
      });
    });
    try {
      await expect(
        composer.getByLabel("Message", { exact: true })
      ).toHaveAttribute("contenteditable", "true");
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
        await page.route("**/api/files/upload", (route) =>
          route.fulfill({
            json: {
              url: "/api/files/012345678901234567890123.pdf",
            },
            status: 200,
          })
        );
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
      await expect(input).toHaveAttribute("contenteditable", "true");
      await input.fill("Optimistic first message");
      await composer.getByLabel("Send", { exact: true }).click();
      await expect.poll(() => received, { timeout: 5000 }).toBe(true);

      await expect(page.getByRole("log")).toContainText(
        "Optimistic first message",
        { timeout: 1000 }
      );
      await expect(composer.getByLabel("Message", { exact: true })).toHaveText(
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
      release.resolve(undefined);
      await expect(page.getByRole("alert")).toBeVisible();
      await expect(composer.getByLabel("Message", { exact: true })).toHaveText(
        "Optimistic first message"
      );
      if (project) {
        await expect(
          composer
            .getByTestId("attachments-preview")
            .getByRole("button", { exact: true, name: "pending.pdf" })
        ).toBeVisible();
      }
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(composer.getByLabel("Message", { exact: true })).toHaveText(
        "Optimistic first message"
      );
      if (project) {
        await expect(
          composer
            .getByTestId("attachments-preview")
            .getByRole("button", { exact: true, name: "pending.pdf" })
        ).toBeVisible();
      }
    } finally {
      release.resolve(undefined);
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
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions */

const chatPath = /\/chat\/[a-f\d-]+$/u;
const visualStyle =
  "nextjs-portal, #react-scan-toolbar, #react-scan-root, .tsqd-parent-container { visibility: hidden !important; }";

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): for (const identity of ["registered", "guest"]) { test( keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): for (const identity of ["registered", "guest"]) { test( keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): for (const identity of ["registered", "guest"]) { test( uses 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): for (const identity of ["registered", "guest"]) { test( uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): for (const identity of ["registered", "guest"]) { test( accepts { page, }; testInfo; route; event; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): for (const identity of ["registered", "guest"]) { test( preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): for (const identity of ["registered", "guest"]) { test( intentionally keeps the existing falsy-value behavior of document.querySelector('[role="log"]')?.textContent?.includes(text); distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
for (const identity of ["registered", "guest"]) {
  test(`first send keeps its document and optimistic message through stream attachment (${identity})`, async ({
    page,
  }, testInfo) => {
    await page.route("https://unpkg.com/react-scan/**", (route) =>
      route.abort()
    );
    await page.goto(identity === "registered" ? "/api/dev-login" : "/", {
      waitUntil: "domcontentloaded",
    });
    const input = page.getByLabel("Message", { exact: true });
    await expect(input).toHaveAttribute("contenteditable", "true");
    const message = "Do not use tools. Reply with exactly: Runtime ready";
    const creation = Promise.withResolvers<undefined>();
    const stream = Promise.withResolvers<undefined>();
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
    cdp.on("Network.requestWillBeSent", (event) => {
      if (event.type === "Document") {
        documents += 1;
      }
    });
    const origin = await page.evaluate(() => performance.timeOrigin);
    try {
      await input.fill(message);
      await page.getByRole("button", { exact: true, name: "Send" }).click();
      await expect(page.getByRole("log")).toContainText(message);
      await page.evaluate((text) => {
        document.documentElement.dataset.missingFirstMessage = "false";
        const observer = new MutationObserver(() => {
          if (
            !document.querySelector('[role="log"]')?.textContent?.includes(text)
          ) {
            document.documentElement.dataset.missingFirstMessage = "true";
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        document.addEventListener(
          "stop-message-observer",
          () => observer.disconnect(),
          { once: true }
        );
      }, message);
      creation.resolve(undefined);
      await expect(page).toHaveURL(chatPath);
      await expect(page.getByRole("log")).toContainText(message);
      await page.screenshot({
        animations: "disabled",
        path: testInfo.outputPath("awaiting-first-stream.png"),
        style: visualStyle,
      });
      expect(await page.evaluate(() => performance.timeOrigin)).toBe(origin);
      expect(documents).toBe(0);
      stream.resolve(undefined);
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
      await expect(input).toHaveAttribute("contenteditable", "true");
      await input.fill("Do not use tools. Reply with exactly: Followup ready");
      await page.getByRole("button", { exact: true, name: "Send" }).click();
      await expect(
        page.getByRole("log").getByText("Followup ready", { exact: true })
      ).toBeVisible({ timeout: 60_000 });
      await page.goBack();
      await expect(input).toHaveText("");
      await page.goForward();
      await expect(page.getByRole("log")).toContainText("Followup ready");
      expect(documents).toBe(0);
      await page.reload();
      await expect(page.getByRole("log")).toContainText("Followup ready");
      await expect(
        page.getByRole("log").getByText(message, { exact: true })
      ).toHaveCount(1);
      await page.getByRole("link", { name: /^New Chat/u }).click();
      await expect(input).toHaveText("");
      await expect(page.getByRole("log")).toHaveCount(0);
    } finally {
      creation.resolve(undefined);
      stream.resolve(undefined);
    }
  });
}
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions */
