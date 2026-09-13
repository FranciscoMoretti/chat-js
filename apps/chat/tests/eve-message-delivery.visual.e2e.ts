import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

test("pending delivery survives reload and clears only for its operation", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const script = execFileSync(
    "bun",
    [
      "-e",
      'const result = await Bun.build({entrypoints:["tests/eve-message-delivery.fixture.tsx"],target:"browser",define:{"process.env.NODE_ENV":JSON.stringify("production"),"process.env":"{}"}});if(!result.success)throw new Error(String(result.logs));process.stdout.write(await result.outputs[0].text());',
    ],
    { encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 }
  );
  const css = execFileSync(
    "bun",
    [
      "-e",
      'import postcss from "postcss";import tailwind from "@tailwindcss/postcss";const from= process.cwd()+"/app/globals.css";const result=await postcss([tailwind()]).process(await Bun.file(from).text(),{from});process.stdout.write(result.css);',
    ],
    { encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 }
  );
  await page.route("http://localhost:39799/delivery-fixture", (route) =>
    route.fulfill({
      body: `<!doctype html><html class="dark"><head><style>${css}</style></head><body class="bg-background text-foreground"><div id="root"></div></body></html>`,
      contentType: "text/html",
    })
  );
  const mount = async () => {
    await page.goto("http://localhost:39799/delivery-fixture");
    await page.addScriptTag({ content: script, type: "module" });
    await expect(page.getByRole("heading")).toBeVisible();
  };

  await mount();
  await page.getByRole("textbox", { name: "Message" }).fill("same text");
  await page.getByRole("button", { name: "Send" }).click();
  const operationId = await page.getByTestId("operation").textContent();
  expect(operationId).toMatch(/^[0-9a-f-]{36}$/u);
  await page.screenshot({
    animations: "disabled",
    mask: [page.getByTestId("operation")],
    maskColor: "#27272a",
    path: testInfo.outputPath("delivery-pending.png"),
  });

  await mount();
  await expect(page.getByText("Pending: same text")).toBeVisible();
  await page
    .getByRole("button", { name: "Acknowledge another operation" })
    .click();
  await expect(page.getByTestId("operation")).toHaveText(operationId ?? "");
  await page
    .getByRole("button", { name: "Acknowledge pending operation" })
    .click();
  await expect(page.getByText("No pending message")).toBeVisible();

  await page.getByRole("button", { name: "Send" }).click();
  await page.getByRole("button", { name: "Reject" }).click();
  await mount();
  await expect(page.getByText("Rejected: Insufficient credits")).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    mask: [page.getByTestId("operation")],
    maskColor: "#27272a",
    path: testInfo.outputPath("delivery-rejected.png"),
  });
  await page.getByRole("button", { name: "Restore draft" }).click();
  await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue(
    "same text"
  );
  await expect(page.getByText("No pending message")).toBeVisible();

  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("delivery-recovered.png"),
  });
  expect(errors).toEqual([]);
});
