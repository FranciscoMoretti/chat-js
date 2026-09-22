import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

test("live document completion opens once without replacing an existing panel or opening history", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.outerHTML).join(""));
  const script = execFileSync(
    "bun",
    [
      "-e",
      'const result = await Bun.build({ plugins: [{ name: "fixture-prism", setup(build) { build.onResolve({ filter: /^prismjs$/ }, () => ({ path: Bun.resolveSync("prismjs", Bun.resolveSync("@lexical/code", process.cwd())) })); } }], entrypoints: ["tests/eve-document-auto-open.bootstrap.ts"], target: "browser", define: {"process.env.NODE_ENV": JSON.stringify("production"), "process.env": "{}"} }); if (!result.success) throw new Error(String(result.logs)); process.stdout.write(await result.outputs[0].text());',
    ],
    { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 }
  );
  await page.route("**/eve-component-fixture", (route) =>
    route.fulfill({
      body: `<!doctype html><html class="dark"><head>${styles}</head><body class="bg-background text-foreground"><div id="root"></div></body></html>`,
      contentType: "text/html",
    })
  );
  await page.goto("/eve-component-fixture");
  await page.clock.setFixedTime(new Date("2026-09-22T12:00:00.000Z"));
  await page.addScriptTag({ content: script, type: "module" });
  const panel = page.getByRole("region", { exact: true, name: "Document" });
  await expect(page.getByText('Created "Orchard notes"')).toBeVisible();
  await expect(panel).toHaveCount(0);
  await page.getByRole("button", { exact: true, name: "Start replay" }).click();
  await expect(panel).toHaveCount(0);
  await page
    .getByRole("button", { exact: true, name: "Complete write" })
    .click();
  await page
    .getByRole("button", { exact: true, name: "Finish replay" })
    .click();
  await expect(panel).toHaveCount(0);
  await page.getByRole("button", { exact: true, name: "Start write" }).click();
  await expect(page.getByRole("status")).toHaveText("Writing document…");
  await expect(panel).toContainText("Partial apple planting instructions.");
  await expect(
    panel.getByRole("button", { name: "View Previous version" })
  ).toHaveCount(0);
  await expect(panel).toHaveScreenshot("partial-document.png", {
    animations: "disabled",
  });
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("partial-document.png"),
  });
  await page
    .getByRole("button", { exact: true, name: "Complete write" })
    .click();
  await expect(panel).toContainText("Orchard notes");
  await expect(panel).toContainText("Plant the apple trees in autumn.");
  await expect(panel).toContainText("Version 1 of 1");
  await expect(panel).toHaveScreenshot("auto-open.png", {
    animations: "disabled",
  });
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("auto-open.png"),
  });
  await page.getByRole("button", { exact: true, name: "Close" }).click();
  await page
    .getByRole("button", { exact: true, name: "Complete write" })
    .click();
  await expect(panel).toHaveCount(0);
  await page.getByRole("button", { name: "Open existing" }).click();
  await page.getByRole("button", { exact: true, name: "Start write" }).click();
  await page
    .getByRole("button", { exact: true, name: "Complete write" })
    .click();
  await expect(panel).toContainText("Existing draft");
  await expect(panel).toContainText("Existing document content.");
  await page.getByRole("button", { exact: true, name: "Close" }).click();
  await page.getByRole("button", { exact: true, name: "Start write" }).click();
  await page.getByRole("button", { exact: true, name: "Fail write" }).click();
  await page
    .getByRole("button", { exact: true, name: "Complete read" })
    .click();
  await expect(panel).toHaveCount(0);
  await page.getByRole("button", { name: "Toggle readonly" }).click();
  await page.getByRole("button", { exact: true, name: "Start write" }).click();
  await page
    .getByRole("button", { exact: true, name: "Complete write" })
    .click();
  await expect(panel).toHaveCount(0);
  await page.getByRole("button", { name: "Open existing" }).click();
  await expect(panel).toContainText("Existing document content.");
  await panel
    .getByRole("button", { exact: true, name: "View Previous version" })
    .click();
  await expect(panel).toContainText("Historical orchard content.");
  await expect(
    panel.getByRole("button", { exact: true, name: "Restore this version" })
  ).toBeVisible();
  await panel.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("historical-version.png"),
  });
  await page
    .getByRole("button", { exact: true, name: "Switch branch" })
    .click();
  await expect(panel).toContainText("Historical orchard content.");
  // The fixture rejects any query/save through the newly selected branch ID.
  await panel
    .getByRole("button", { exact: true, name: "Back to latest version" })
    .click();
  await expect(panel).toContainText("Existing document content.");
  await panel
    .getByRole("button", { exact: true, name: "View Previous version" })
    .click();
  await panel
    .getByRole("button", { exact: true, name: "Restore this version" })
    .click();
  await expect(panel).toContainText("Saving changes...");
  await expect(panel).toContainText("Version 3 of 3");
  await expect(panel).toContainText("Historical orchard content.");
  await expect(
    panel.getByRole("button", { exact: true, name: "Restore this version" })
  ).toHaveCount(0);
  await panel.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("restored-version.png"),
  });
  await expect(
    panel.getByRole("button", { exact: true, name: "Add final polish" })
  ).toBeDisabled();
  await page
    .getByRole("button", { exact: true, name: "Start background execution" })
    .click();
  await expect(
    panel.getByRole("button", { exact: true, name: "Stop generation" })
  ).toBeVisible();
  await panel
    .getByRole("button", { exact: true, name: "Stop generation" })
    .click();
  await expect(
    page.getByText("Stopped session: 00000000-0000-4000-8000-000000000010", {
      exact: true,
    })
  ).toBeVisible();
  expect(errors).toEqual([]);
});
