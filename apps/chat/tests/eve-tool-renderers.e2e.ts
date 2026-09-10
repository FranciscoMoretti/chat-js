import { execFileSync } from "node:child_process";
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
    encoding: "utf8",
  });
  await page.setContent(
    `<!doctype html><html class="dark"><head>${styles}</head><body class="bg-background text-foreground">${content}</body></html>`
  );
  await expect(page.getByText("Counting words...").first()).toBeVisible();
  await expect(page.getByText("Words", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(2);
  await expect(page.getByText("Request declined.")).toBeVisible();
  for (const width of [1100, 390]) {
    await page.setViewportSize({ width, height: 850 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: `tests/eve-results/screenshots/eve-renderer-states-${width}.png`,
      animations: "disabled",
      fullPage: true,
    });
  }
});

test("native video renderer covers progress, completion and failure states", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.route(
    "**/api/files/content?key=abcdefghijklmnopqrstuvwx.mp4",
    (route) => route.abort()
  );
  await page.goto("/api/dev-login");
  await page.goto("/");
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.outerHTML).join(""));
  const content = execFileSync("bun", ["tests/eve-video-renderer-fixture.ts"], {
    encoding: "utf8",
  });
  await page.setContent(
    `<!doctype html><html class="dark"><head>${styles}</head><body class="bg-background text-foreground">${content}</body></html>`
  );
  await expect(page.getByText("Preparing video…")).toBeVisible();
  await expect(
    page.getByText('Generating video: "A tree in the wind"')
  ).toBeVisible();
  await expect(page.locator("video")).toHaveAttribute(
    "src",
    "/api/files/content?key=abcdefghijklmnopqrstuvwx.mp4"
  );
  await expect(page.getByRole("alert")).toHaveCount(3);
  await expect(page.getByText("Request declined.")).toBeVisible();
  for (const width of [1100, 390]) {
    await page.setViewportSize({ width, height: 850 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: `tests/eve-results/screenshots/eve-video-states-${width}.png`,
      animations: "disabled",
      fullPage: true,
    });
  }
});

test("native image renderer covers progress, completion and failure states", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.route(
    "**/api/files/content?key=abcdefghijklmnopqrstuvwx.png",
    (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="320"><rect width="512" height="320" fill="white"/><rect x="176" y="80" width="160" height="160" fill="royalblue"/></svg>',
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
      encoding: "utf8",
    }
  );
  await page.setContent(
    `<!doctype html><html class="dark"><head>${styles}</head><body class="bg-background text-foreground">${content}</body></html>`
  );
  await expect(page.getByText("Preparing image…")).toBeVisible();
  await expect(
    page.getByText('Generating image: "A tree in the wind"')
  ).toBeVisible();
  await expect(page.locator("img")).toHaveAttribute(
    "src",
    "/api/files/content?key=abcdefghijklmnopqrstuvwx.png"
  );
  await expect(page.getByRole("alert")).toHaveCount(3);
  await expect(page.getByText("Request declined.")).toBeVisible();
  for (const width of [1100, 390]) {
    await page.setViewportSize({ width, height: 850 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: `tests/eve-results/screenshots/eve-image-states-${width}.png`,
      animations: "disabled",
      fullPage: true,
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
    { encoding: "utf8" }
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
    await page.setViewportSize({ width, height: 850 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: `tests/eve-results/screenshots/eve-research-states-${width}.png`,
      animations: "disabled",
      fullPage: true,
    });
  }
});
