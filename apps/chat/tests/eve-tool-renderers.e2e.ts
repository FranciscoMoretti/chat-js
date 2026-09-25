/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

test("installed renderer states stay readable at desktop and mobile sizes", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  await page.goto("/");
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.outerHTML).join(""));
  expect(styles.length).toBeGreaterThan(0);
  const content = execFileSync("bun", ["tests/eve-renderer-fixture.ts"], {
    encoding: "utf-8",
  });
  await page.setContent(
    `<!doctype html><html class="dark"><head>${styles}</head><body class="bg-background text-foreground">${content}</body></html>`
  );
  await expect(page.getByText("Counting words...").first()).toBeVisible();
  await expect(page.getByText("Words", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(2);
  await expect(page.getByText("Request declined.")).toBeVisible();
  for (const width of [1100, 390]) {
    await page.setViewportSize({ height: 850, width });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: `tests/eve-results/screenshots/eve-renderer-states-${width}.png`,
    });
  }
});

test("native video renderer covers progress, completion and failure states", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.route("**/api/files/abcdefghijklmnopqrstuvwx.mp4", (route) =>
    route.abort()
  );
  await page.goto("/api/dev-login");
  await page.goto("/");
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.outerHTML).join(""));
  const content = execFileSync("bun", ["tests/eve-video-renderer-fixture.ts"], {
    encoding: "utf-8",
  });
  await page.setContent(
    `<!doctype html><html class="dark"><head>${styles}</head><body class="bg-background text-foreground">${content}</body></html>`
  );
  await expect(
    page.getByText('Generating video: "Preparing prompt…"')
  ).toBeVisible();
  await expect(
    page.getByText('Generating video: "A tree in the wind"')
  ).toBeVisible();
  await expect(page.locator("video")).toHaveAttribute(
    "src",
    "/api/files/abcdefghijklmnopqrstuvwx.mp4"
  );
  await expect(page.getByRole("alert")).toHaveCount(3);
  await expect(page.getByText("Request declined.")).toBeVisible();
  for (const width of [1100, 390]) {
    await page.setViewportSize({ height: 850, width });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: `tests/eve-results/screenshots/eve-video-states-${width}.png`,
    });
  }
});

test("native image renderer covers progress, completion and failure states", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.route("**/api/files/abcdefghijklmnopqrstuvwx.png", (route) =>
    route.fulfill({
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="320"><rect width="512" height="320" fill="white"/><rect x="176" y="80" width="160" height="160" fill="royalblue"/></svg>',
      contentType: "image/svg+xml",
    })
  );
  await page.goto("/api/dev-login");
  await page.goto("/");
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.outerHTML).join(""));
  const content = execFileSync(
    "bun",
    ["tests/eve-video-renderer-fixture.ts", "--image"],
    {
      encoding: "utf-8",
    }
  );
  await page.setContent(
    `<!doctype html><html class="dark"><head>${styles}</head><body class="bg-background text-foreground">${content}</body></html>`
  );
  await expect(
    page.getByText('Generating image: "Preparing prompt…"')
  ).toBeVisible();
  await expect(
    page.getByText('Generating image: "A tree in the wind"')
  ).toBeVisible();
  await expect(page.locator("img")).toHaveAttribute(
    "src",
    "/api/files/abcdefghijklmnopqrstuvwx.png"
  );
  await expect(page.getByRole("alert")).toHaveCount(3);
  await expect(page.getByText("Request declined.")).toBeVisible();
  for (const width of [1100, 390]) {
    await page.setViewportSize({ height: 850, width });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: `tests/eve-results/screenshots/eve-image-states-${width}.png`,
    });
  }
});

test("native research renderer covers progress, clarification, report and failures", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  await page.goto("/");
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.outerHTML).join(""));
  const content = execFileSync(
    "bun",
    ["tests/eve-research-renderer-fixture.tsx"],
    { encoding: "utf-8" }
  );
  await page.setContent(
    `<!doctype html><html class="dark"><head>${styles}</head><body class="bg-background text-foreground">${content}</body></html>`
  );
  await expect(
    page.getByText("Which time period should the research cover?")
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: 'Created "Research report"' })
  ).toBeVisible();
  await expect(page.getByText("Research declined.")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(3);
  for (const width of [1100, 390]) {
    await page.setViewportSize({ height: 850, width });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: `tests/eve-results/screenshots/eve-research-states-${width}.png`,
    });
  }
});

test("native MCP renderer covers pending, result, denial and errors", async ({
  page,
}, testInfo) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  await page.goto("/");
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.outerHTML).join(""));
  const bundlePath = testInfo.outputPath("mcp-fixture.js");
  execFileSync("bun", [
    "build",
    "tests/eve-mcp-renderer-fixture.tsx",
    "--target=browser",
    "--outfile",
    bundlePath,
  ]);
  await page.setContent(
    `<!doctype html><html class="dark"><head>${styles}</head><body class="bg-background text-foreground"><div id="fixture"></div></body></html>`
  );
  await page.addScriptTag({
    content: readFileSync(bundlePath, "utf-8"),
    type: "module",
  });
  const native = page.locator("#native-mcp");
  await expect(
    native.locator("pre:visible").filter({ hasText: "Hello MCP" }).first()
  ).toBeVisible();
  await expect(
    native.getByText(
      "MCP tool failed. Check the connector in settings and try again."
    )
  ).toHaveCount(2);
  await expect(native.getByText("private connector URL")).toHaveCount(0);
  await expect(native.getByText("Result", { exact: true })).toHaveCount(6);
  await native
    .getByRole("button", { exact: true, name: "echo Completed" })
    .click();
  await expect(native.getByText("Result", { exact: true })).toHaveCount(5);
  await native
    .getByRole("button", { exact: true, name: "echo Completed" })
    .click();
  await expect(native.getByText("Result", { exact: true })).toHaveCount(6);

  for (const value of ["false", "0", "true", "null", '""']) {
    await expect(
      page
        .locator("pre:visible")
        .filter({ hasText: new RegExp(`^${value}$`, "u") })
    ).toHaveCount(2);
  }

  for (const width of [1100, 390]) {
    await page.setViewportSize({ height: 850, width });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: `tests/eve-results/screenshots/eve-mcp-states-${width}.png`,
    });
  }
});

test("public tool projection preserves readable results without approval controls or private envelopes", async ({
  page,
}, testInfo) => {
  await page.goto("/api/dev-login");
  await page.goto("/");
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.outerHTML).join(""));
  const content = execFileSync("bun", ["tests/eve-public-tools.fixture.ts"], {
    encoding: "utf-8",
  });
  expect(content).not.toContain("owner-approval-secret");
  expect(content).not.toContain("runtime-private");
  expect(content).not.toContain("costUsd");
  await page.setContent(
    `<!doctype html><html class="dark"><head>${styles}</head><body class="bg-background text-foreground">${content}</body></html>`
  );
  await expect(page.getByText("Published note", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Waiting for input.", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("Request declined.", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("Words", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "This tool result is unavailable in the shared conversation.",
      { exact: true }
    )
  ).toBeVisible();
  await expect(
    page.getByRole("button", { exact: true, name: "Approve" })
  ).toHaveCount(0);
  await page.setViewportSize({ height: 844, width: 390 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: testInfo.outputPath("public-tool-states.png"),
  });
});
