import catalogFixture from "./eve-catalog.fixture.json" with { type: "json" };
import { parseEveCatalog } from "../../../packages/registry/eve-catalog";
import { test, expect } from "@uiverify/playwright";

for (const width of [1440, 845, 390]) {
  test(`Setup provider tiles show brands, selection and descriptions at ${width}px`, async ({
    page,
    uiVerify,
  }, testInfo) => {
    uiVerify.disableAutoSnapshot();
    await page.setViewportSize({ width, height: 1000 });
    await page.route("**/api/eve-catalog", async (route) => {
      await route.fulfill({ json: parseEveCatalog(catalogFixture) });
    });
    await page.goto("/create");
    await page.getByRole("tab", { name: "Agent", exact: true }).click();
    await expect(page.getByTestId("eve-tool/web_fetch")).toBeVisible();
    const agentNav = await page
      .getByRole("navigation", { name: "Agent categories" })
      .boundingBox();
    const agentHeading = await page.locator("#agent-tool h2").boundingBox();
    await page.getByRole("tab", { name: "Setup", exact: true }).click();
    const setupNav = page.getByRole("navigation", { name: "Setup sections" });
    const setupNavBox = await setupNav.boundingBox();
    const setupHeading = await page.locator("#setup-gateway h2").boundingBox();
    expect(setupNavBox?.x).toBe(agentNav?.x);
    expect(setupNavBox?.width).toBe(agentNav?.width);
    expect(setupHeading?.x).toBe(agentHeading?.x);
    expect(setupHeading?.y).toBe(agentHeading?.y);
    if (width < 1024) {
      await expect(setupNav.getByLabel("Jump to category")).toBeVisible();
      await setupNav
        .getByLabel("Jump to category")
        .selectOption("infrastructure");
    } else {
      await setupNav
        .getByRole("link", { name: "Infrastructure", exact: true })
        .click();
    }
    await expect(page.locator("#setup-infrastructure h2")).toBeInViewport();
    await expect(
      page
        .getByTestId("setup-scroll")
        .getByRole("radiogroup", { name: "Sandbox", exact: true })
    ).toHaveCount(0);
    const gateway = page.getByRole("radiogroup", {
      name: "Model gateway",
      exact: true,
    });
    await expect(
      gateway.locator('[data-capability-visual="brand"]')
    ).toHaveCount(3);
    await expect
      .poll(
        async () =>
          await gateway
            .locator("img")
            .evaluateAll((images) =>
              images.every(
                (image) =>
                  image instanceof HTMLImageElement &&
                  image.complete &&
                  image.naturalWidth > 0
              )
            )
      )
      .toBe(true);
    const tileSizes = await gateway.locator("label").evaluateAll((tiles) =>
      tiles.map((tile) => {
        const bounds = tile.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height };
      })
    );
    for (const size of tileSizes) {
      expect(size.width).toBeLessThanOrEqual(200);
      expect(Math.abs(size.width - size.height)).toBeLessThan(1);
    }
    await page.getByRole("radio", { name: "OpenAI", exact: true }).check();
    await expect(
      page.getByRole("radio", { name: "OpenAI", exact: true })
    ).toBeChecked();
    const openai = gateway.getByRole("radio", { name: "OpenAI", exact: true });
    await openai.focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      gateway.getByRole("radio", { name: "OpenAI Compatible", exact: true })
    ).toBeChecked();
    await page.keyboard.press("ArrowLeft");
    await expect(openai).toBeChecked();
    if (width === 1440) {
      await gateway
        .getByRole("radio", { name: "Vercel AI Gateway", exact: true })
        .hover();
    }
    await page.getByTestId("setup-scroll").evaluate((element) => {
      element.scrollTo({ top: 0 });
    });
    await uiVerify.snapshot("Setup aligned category navigation");
    await page.screenshot({ path: testInfo.outputPath("gateways.png") });
    await expect(
      page.getByRole("button", { name: "Get Code", exact: true })
    ).toHaveCount(1);
    await page
      .getByRole("button", { name: "Your app summary", exact: true })
      .click();
    const summary = page.getByRole("complementary", {
      name: "Your app summary",
    });
    await expect(summary).toContainText("OpenAI");
    await uiVerify.snapshot("Setup header summary");
    await page.screenshot({ path: testInfo.outputPath("summary.png") });
    await page.keyboard.press("Escape");
    await expect(summary).toBeHidden();
    await page
      .getByRole("button", { name: "Toggle theme", exact: true })
      .click();
    const storage = page.getByRole("radiogroup", {
      name: "File storage",
      exact: true,
    });
    await storage
      .getByRole("radio", { name: "Cloudflare R2", exact: true })
      .check();
    await expect(
      storage.getByRole("radio", { name: "Cloudflare R2", exact: true })
    ).toBeChecked();
    await expect
      .poll(
        async () =>
          await storage
            .locator("img")
            .evaluateAll((images) =>
              images.every(
                (image) =>
                  image instanceof HTMLImageElement &&
                  image.complete &&
                  image.naturalWidth > 0
              )
            )
      )
      .toBe(true);
    await page.locator("#setup-storage").evaluate((element) => {
      element.scrollIntoView({ block: "start" });
    });
    await expect(page.locator("#setup-storage")).toContainText(
      "S3-compatible HTTP API"
    );
    await uiVerify.snapshot("adaptive square storage dark");
    await page.screenshot({ path: testInfo.outputPath("storage.png") });
    await expect(
      page
        .getByTestId("setup-scroll")
        .getByRole("region", { name: "Observability", exact: true })
    ).toHaveCount(0);
    const platforms = page.getByRole("region", {
      name: "Platforms",
      exact: true,
    });
    await page.getByRole("checkbox", { name: "Desktop", exact: true }).check();
    const featureMarks = page.locator(
      '#setup-platforms [data-capability-visual="brand"]'
    );
    await expect(featureMarks).toHaveCount(1);
    await expect
      .poll(
        async () =>
          await featureMarks
            .locator("img")
            .evaluateAll((images) =>
              images.every(
                (image) =>
                  image instanceof HTMLImageElement &&
                  image.complete &&
                  image.naturalWidth > 0
              )
            )
      )
      .toBe(true);
    const featureSizes = await page
      .locator("#setup-platforms label")
      .evaluateAll((tiles) =>
        tiles.map((tile) => {
          const bounds = tile.getBoundingClientRect();
          return { width: bounds.width, height: bounds.height };
        })
      );
    expect(featureSizes).toHaveLength(1);
    for (const size of featureSizes) {
      expect(Math.abs(size.width - tileSizes[0].width)).toBeLessThan(1);
      expect(Math.abs(size.width - size.height)).toBeLessThan(1);
    }
    await expect(
      platforms.getByText("Source: ChatJS", { exact: true })
    ).toHaveCount(0);
    await platforms.evaluate((element) => {
      element.scrollIntoView({ block: "start" });
    });
    await uiVerify.snapshot("branded Setup feature tiles dark");
    await page.screenshot({ path: testInfo.outputPath("features-dark.png") });
    if (width === 1440) {
      await page
        .getByRole("button", { name: "Toggle theme", exact: true })
        .click();
      await uiVerify.snapshot("branded Setup feature tiles light");
      await page.screenshot({
        path: testInfo.outputPath("features-light.png"),
      });
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
  });
}
