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
      'const result = await Bun.build({ entrypoints: ["tests/eve-document-auto-open.bootstrap.ts"], target: "browser", define: {"process.env.NODE_ENV": JSON.stringify("production"), "process.env": "{}"} }); if (!result.success) throw new Error(String(result.logs)); process.stdout.write(await result.outputs[0].text());',
    ],
    { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 }
  );
  await page.route("**/eve-component-fixture", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html class="dark"><head>${styles}</head><body class="bg-background text-foreground"><div id="root"></div></body></html>`,
    })
  );
  await page.goto("/eve-component-fixture");
  await page.addScriptTag({ content: script, type: "module" });
  const panel = page.getByRole("region", { name: "Document", exact: true });
  await expect(page.getByText('Created "Orchard notes"')).toBeVisible();
  await expect(panel).toHaveCount(0);
  await page.getByRole("button", { name: "Start write", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Writing document…");
  await page
    .getByRole("button", { name: "Complete write", exact: true })
    .click();
  await expect(panel).toContainText("Orchard notes");
  await expect(panel).toContainText("Plant the apple trees in autumn.");
  await expect(panel).toContainText("Version 1 of 1");
  await page.screenshot({
    path: testInfo.outputPath("auto-open.png"),
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Complete write", exact: true })
    .click();
  await expect(panel).toHaveCount(0);
  await page.getByRole("button", { name: "Open existing" }).click();
  await page.getByRole("button", { name: "Start write", exact: true }).click();
  await page
    .getByRole("button", { name: "Complete write", exact: true })
    .click();
  await expect(panel).toContainText("Existing draft");
  await expect(panel).toContainText("Existing document content.");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Start write", exact: true }).click();
  await page
    .getByRole("button", { name: "Complete read", exact: true })
    .click();
  await expect(panel).toHaveCount(0);
  await page.getByRole("button", { name: "Toggle readonly" }).click();
  await page.getByRole("button", { name: "Start write", exact: true }).click();
  await page
    .getByRole("button", { name: "Complete write", exact: true })
    .click();
  await expect(panel).toHaveCount(0);
  expect(errors).toEqual([]);
});
