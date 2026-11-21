import { test, expect } from "@uiverify/playwright";
import type { Page } from "playwright/test";
import catalogFixture from "./eve-catalog.fixture.json" with { type: "json" };
import {
  parseEveCatalog,
  parseSkillsCatalog,
} from "../../../packages/registry/eve-catalog";
import { encodeAppPreset } from "../../../packages/registry/app-preset";
import { installationSelectionSchema } from "../../../packages/registry/installation";
import { commandAppPreset } from "./create-fixtures.mts";
import { eveDefaultToolIds } from "../../../packages/registry/agent-configuration";

const jumpToCategory = async (
  page: Page,
  width: number,
  title: string,
  id: string
) => {
  await (width < 1024
    ? page
        .getByRole("navigation", { name: "Agent categories" })
        .getByLabel("Jump to category")
        .selectOption(id)
    : page
        .getByRole("navigation", { name: "Agent categories" })
        .getByRole("link", { name: title, exact: true })
        .click());
};

for (const width of [1440, 845, 390]) {
  test(`Agent authoring exports native settings without a chat preview at ${width}px`, async ({
    page,
    uiVerify,
  }, testInfo) => {
    uiVerify.disableAutoSnapshot();
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/eve-catalog", async (route) => {
      await route.fulfill({ json: parseEveCatalog(catalogFixture) });
    });
    await page.route("**/api/skills-catalog?q=react", async (route) => {
      await route.fulfill({
        json: parseSkillsCatalog({
          items: [
            {
              name: "vercel-labs/agent-skills/vercel-react-best-practices",
              title: "React best practices",
              description: "React and Next.js performance guidance.",
            },
          ],
        }),
      });
    });
    await page.route("**/capability-icons/notion.svg", async (route) => {
      await route.fulfill({ status: 503, body: "" });
    });
    // Imported model settings stay intact while their controls are hidden.
    const initial = installationSelectionSchema.parse({
      gateway: "vercel",
      storage: { source: "vercel-blob" },
      agent: {
        model: "openai/gpt-5-mini",
        modelIds: ["openai/gpt-5-mini", "openai/gpt-5-nano"],
        reasoning: "high",
        compaction: { model: "openai/gpt-5-nano" },
      },
    });
    await page.goto(`/create?app=${encodeAppPreset(initial)}`);
    await page.getByRole("tab", { name: "Agent", exact: true }).click();
    await expect(page.locator('iframe[title="Preview"]')).toBeHidden();
    await expect(
      page.getByRole("heading", { name: "Build your agent" })
    ).toBeVisible();
    await expect(page.getByLabel("Instructions", { exact: true })).toHaveCount(
      0
    );
    await expect(
      page.getByRole("button", { name: "Add skill", exact: true })
    ).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "ChatJS memory", exact: true })
    ).toHaveCount(0);
    await page
      .getByRole("checkbox", {
        name: "Tavily (connection/tavily)",
        exact: true,
      })
      .check();
    await page
      .getByRole("checkbox", {
        name: "Firecrawl (connection/firecrawl)",
        exact: true,
      })
      .check();
    await page
      .getByRole("checkbox", { name: "Slack (channel/slack)", exact: true })
      .check();
    await page
      .getByRole("checkbox", {
        name: "Notion (connection/notion)",
        exact: true,
      })
      .check();
    await expect(
      page.getByTestId("eve-channel/slack").locator("img")
    ).toHaveJSProperty("complete", true);
    expect(
      await page
        .getByTestId("eve-channel/slack")
        .locator("img")
        .evaluate((image: HTMLImageElement) => image.naturalWidth)
    ).toBeGreaterThan(0);
    await expect(
      page
        .getByTestId("eve-connection/notion")
        .locator("[data-capability-visual]")
    ).toHaveAttribute("data-capability-visual", "category");
    await expect(
      page.getByLabel(/^(?:Model|Model IDs|Reasoning|Compaction model)$/u)
    ).toHaveCount(0);
    await expect(
      page.getByText("Advanced settings", { exact: true })
    ).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Specialists", exact: true })
    ).toHaveCount(0);
    await expect(page.getByLabel("EVE category", { exact: true })).toHaveCount(
      0
    );
    const catalog = page.getByRole("region", {
      name: "EVE catalog",
      exact: true,
    });
    await Promise.all(
      [
        "Tools",
        "Connections",
        "Channels",
        "Skills",
        "Extensions",
        "Memory",
        "Observability",
      ].map(async (title) => {
        await expect(
          catalog.getByRole("heading", { name: title, exact: true })
        ).toHaveCount(1);
      })
    );
    await catalog
      .getByRole("checkbox", {
        name: "Braintrust (instrumentation/braintrust)",
        exact: true,
      })
      .check();
    await jumpToCategory(page, width, "Observability", "instrumentation");
    const observability = catalog.getByRole("region", {
      name: "Observability",
      exact: true,
    });
    await expect(
      observability.getByRole("link", { name: "Vercel Agent Runs" })
    ).toBeVisible();
    if (width === 1440) {
      await uiVerify.snapshot("observability with Vercel Agent Runs default");
      await page.screenshot({ path: testInfo.outputPath("observability.png") });
    }
    await expect(
      catalog.getByTestId("eve-tool/bash").getByRole("checkbox")
    ).toBeChecked();
    await expect(page.getByLabel("Search EVE catalog")).toHaveCount(0);
    await expect(page.getByLabel("Capability source")).toHaveCount(0);
    const scroll = page.getByTestId("agent-scroll");
    await scroll.evaluate((element) => {
      element.scrollTo(0, 0);
    });
    await page.getByTestId("capability-list").evaluate((element) => {
      element.scrollTo(0, 0);
    });
    await uiVerify.snapshot(
      "agent catalog with local logos and category fallback"
    );
    await page.screenshot({ path: testInfo.outputPath("agent.png") });
    await page
      .getByRole("region", { name: "EVE catalog", exact: true })
      .scrollIntoViewIfNeeded();
    await page
      .getByRole("checkbox", {
        name: "Linear (connection/linear)",
        exact: true,
      })
      .check();
    await jumpToCategory(page, width, "Connections", "connection");
    await uiVerify.snapshot("agent native catalog connections");
    await page.screenshot({ path: testInfo.outputPath("connections.png") });
    await jumpToCategory(page, width, "Memory", "memory");
    await page
      .getByRole("checkbox", { name: "File memory (memory/file)", exact: true })
      .check();
    await expect(
      page.getByText(/does not automatically delete provider memory/u)
    ).toBeVisible();
    await uiVerify.snapshot("agent native memory retention");
    await jumpToCategory(page, width, "Channels", "channel");
    const channels = catalog.getByRole("region", {
      name: "Channels",
      exact: true,
    });
    await expect(
      channels.getByText("Web chat provided by ChatJS.")
    ).toBeVisible();
    await expect(channels.getByTestId("eve-channel/web")).toHaveCount(0);
    await uiVerify.snapshot("agent native channels and composition");
    await page.screenshot({ path: testInfo.outputPath("channels.png") });
    await jumpToCategory(page, width, "Tools", "tool");
    const attachment = catalog.getByRole("checkbox", {
      name: "Attach Workspace File",
      exact: true,
    });
    await expect(
      page.getByLabel("Source: ChatJS", { exact: true })
    ).toHaveCount(0);
    await catalog
      .getByRole("button", { name: "About Attach Workspace File" })
      .click();
    const attachmentDetails = page.getByRole("dialog");
    await expect(attachmentDetails).toHaveCSS("animation-name", "none");
    await expect(attachmentDetails.getByLabel("Source: ChatJS")).toBeVisible();
    await expect(
      attachmentDetails.getByText("Requires ChatJS", { exact: true })
    ).toBeVisible();
    await uiVerify.snapshot("capability source and documentation details");
    await page.screenshot({ path: testInfo.outputPath("details.png") });
    await page.keyboard.press("Escape");
    await expect(attachment).not.toBeChecked();
    await attachment.check();
    await jumpToCategory(page, width, "Tools", "tool");
    await uiVerify.snapshot("ChatJS workspace attachment selected");
    await page.screenshot({
      path: testInfo.outputPath("workspace-attachment.png"),
    });

    await attachment.press("Space");
    await expect(attachment).not.toBeChecked();
    await attachment.press("Space");
    await expect(attachment).toBeChecked();
    if (width === 1440) {
      await page
        .getByRole("button", { name: "Toggle theme", exact: true })
        .click();
      await expect(page.locator("html")).toHaveClass(/dark/u);
      await uiVerify.snapshot(
        "compact capabilities selected and unselected dark"
      );
      await page.screenshot({ path: testInfo.outputPath("dark.png") });
      await page
        .getByRole("button", { name: "Toggle theme", exact: true })
        .click();
    }

    await jumpToCategory(page, width, "Skills", "skill");
    await page.getByLabel("Search skills.sh", { exact: true }).fill("react");
    await page
      .getByRole("button", { name: "Search skills", exact: true })
      .click();
    await page
      .getByTestId(
        "eve-@skills/vercel-labs/agent-skills/vercel-react-best-practices"
      )
      .getByRole("checkbox")
      .check();
    await jumpToCategory(page, width, "Skills", "skill");
    await uiVerify.snapshot("registry skills search selection");
    await page.screenshot({ path: testInfo.outputPath("skills.png") });
    await page.getByText("Add from another registry", { exact: true }).click();
    await page
      .getByLabel("Registry item", { exact: true })
      .fill("@acme/analytics");
    await page
      .getByLabel("Registry URL template")
      .fill("https://registry.example/r/{name}.json");
    await uiVerify.snapshot("named registry configuration");
    await page
      .getByRole("button", { name: "Add capability", exact: true })
      .click();
    await page
      .getByTestId("eve-@acme/analytics")
      .getByRole("button", { name: "About @acme/analytics" })
      .click();
    await expect(
      page.getByRole("dialog").getByLabel("Source: @acme")
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page
        .getByTestId("eve-@acme/analytics")
        .locator("[data-capability-visual]")
    ).toHaveAttribute("data-capability-visual", "category");
    await uiVerify.snapshot("external registry source");
    const search = page.getByLabel("Research search provider", { exact: true });
    await page
      .getByRole("checkbox", { name: "Deep Research", exact: true })
      .check();
    await expect(search).toHaveCount(0);
    await page
      .getByRole("button", { name: "About Deep Research", exact: true })
      .click();
    await expect(
      page.getByRole("dialog").getByLabel("Source: ChatJS")
    ).toBeVisible();
    await expect(
      page.getByRole("dialog").getByText("Requires ChatJS", { exact: true })
    ).toHaveCount(0);
    await uiVerify.snapshot("native research capability");
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("checkbox", { name: "Attach Workspace File", exact: true })
    ).toBeEnabled();
    await expect(
      page.getByRole("checkbox", { name: "Text Documents", exact: true })
    ).toHaveCount(0);
    await page
      .getByRole("checkbox", { name: "Deep Research", exact: true })
      .uncheck();
    const environment = page.getByRole("region", {
      name: "Sandbox",
      exact: true,
    });
    const sandbox = environment.getByRole("radiogroup", {
      name: "Sandbox",
      exact: true,
    });
    await expect(sandbox.getByRole("radio")).toHaveCount(4);
    await expect(
      sandbox.getByRole("radio", { name: "Automatic", exact: true })
    ).toBeChecked();
    await expect(environment.getByRole("combobox")).toHaveCount(0);
    await environment
      .getByRole("button", { name: "About Automatic", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "Run Docker during the build, or choose a sandbox provider."
    );
    if (width === 1440) {
      await uiVerify.snapshot("automatic sandbox production details");
      await page.screenshot({
        path: testInfo.outputPath("automatic-sandbox.png"),
      });
    }
    await page.keyboard.press("Escape");
    await sandbox
      .getByRole("radio", { name: "just-bash", exact: true })
      .check();
    await expect(
      sandbox.getByRole("radio", { name: "Automatic", exact: true })
    ).not.toBeChecked();
    await expect(environment).toContainText("Cannot run native Python or Node");
    await environment.scrollIntoViewIfNeeded();
    const dockerLogo = environment.locator(
      'img[src="/capability-icons/docker.svg"]'
    );
    await expect(dockerLogo).toBeVisible();
    await expect(dockerLogo).toHaveJSProperty("complete", true);
    expect(
      await dockerLogo.evaluate((img: HTMLImageElement) => img.naturalWidth)
    ).toBeGreaterThan(0);
    await uiVerify.snapshot("native EVE sandboxes");
    await page.screenshot({ path: testInfo.outputPath("sandbox.png") });
    await sandbox.getByRole("radio", { name: "Docker", exact: true }).check();
    await page.getByRole("button", { name: "Get Code", exact: true }).click();
    const recipe = commandAppPreset(
      await page.getByTestId("create-command").textContent()
    );
    expect(recipe.plugins).toEqual([]);
    expect(recipe.sandbox).toBe("docker");
    expect(recipe.eve).toContain(
      "@skills/vercel-labs/agent-skills/vercel-react-best-practices"
    );
    expect(recipe.tools).toContain("attach-workspace-file");
    expect(recipe.eveRegistries).toEqual({
      "@acme": "https://registry.example/r/{name}.json",
    });
    expect(recipe.eve).toContain("instrumentation/braintrust");
    expect(recipe.eve).toContain("channel/slack");
    expect(recipe.eve).toContain("connection/notion");
    expect(recipe.eve).toContain("connection/linear");
    expect(recipe.eve).toContain("connection/tavily");
    expect(recipe.eve).toContain("connection/firecrawl");
    expect(recipe.eve).toContain("memory/file");
    expect(recipe.tools).not.toContain("tavily-search");
    expect(recipe.tools).not.toContain("firecrawl-search");
    expect(recipe.agent).toMatchObject({
      compaction: { model: "openai/gpt-5-nano" },
      model: "openai/gpt-5-mini",
      modelIds: ["openai/gpt-5-mini", "openai/gpt-5-nano"],
      reasoning: "high",
    });
    await page.reload();
    await page.getByRole("tab", { name: "Agent", exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
    await expect(
      page.getByRole("checkbox", {
        name: "Linear (connection/linear)",
        exact: true,
      })
    ).toBeChecked();
    expect(errors).toEqual([]);
  });
}

test("Native defaults can be unchecked without reinstalling the remaining tools", async ({
  page,
  uiVerify,
}, testInfo) => {
  uiVerify.disableAutoSnapshot();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("**/api/eve-catalog", async (route) => {
    await route.fulfill({ json: parseEveCatalog(catalogFixture) });
  });
  await page.goto("/create");
  await page.getByRole("tab", { name: "Agent", exact: true }).click();
  await Promise.all(
    eveDefaultToolIds.map(async (id) => {
      const card = page.getByTestId(`eve-${id}`);
      await expect(card.getByRole("checkbox")).toBeChecked();
      await expect(card.getByRole("checkbox")).toBeEnabled();
      await expect(card.getByText("Included", { exact: true })).toHaveCount(0);
    })
  );
  const bash = page.getByTestId("eve-tool/bash").getByRole("checkbox");
  const fetch = page.getByTestId("eve-tool/web_fetch").getByRole("checkbox");
  await bash.uncheck();
  await fetch.uncheck();
  await fetch.check();
  await expect(bash).not.toBeChecked();
  await expect(fetch).toBeChecked();
  await bash.scrollIntoViewIfNeeded();
  await uiVerify.snapshot("native defaults with Bash unchecked");
  await page.screenshot({ path: testInfo.outputPath("native-defaults.png") });
  const slack = page.getByRole("checkbox", {
    name: "Slack (channel/slack)",
    exact: true,
  });
  await slack.check();
  await expect(
    page.getByRole("button", { name: "Selected · 7", exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Selected · 7", exact: true }).click();
  await expect(
    page.getByTestId("capability-list").getByRole("checkbox")
  ).toHaveCount(7);
  await expect(bash).toHaveCount(0);
  await page.getByRole("button", { name: "Get Code", exact: true }).click();
  const recipe = commandAppPreset(
    await page.getByTestId("create-command").textContent()
  );
  expect(recipe.eve).toEqual(["channel/slack"]);
  expect(recipe.agent?.defaultTools).toBe(true);
  expect(recipe.agent?.disabledDefaultTools).toEqual(["tool/bash"]);
  await page.goto(`/create?app=${encodeAppPreset(recipe)}`);
  await page.getByRole("tab", { name: "Agent", exact: true }).click();
  await expect(bash).not.toBeChecked();
  await expect(fetch).toBeChecked();
});

test("Native catalog loading, retry, empty and selected states preserve choices", async ({
  page,
  uiVerify,
}, testInfo) => {
  uiVerify.disableAutoSnapshot();
  await page.setViewportSize({ width: 390, height: 1000 });
  let fail = true;
  const loading = Promise.withResolvers<null>();
  await page.route("**/api/eve-catalog", async (route) => {
    await loading.promise;
    await route.fulfill(
      fail
        ? { status: 503, json: { error: "unavailable" } }
        : { json: parseEveCatalog(catalogFixture) }
    );
  });
  await page.goto(
    `/create?app=${encodeAppPreset(installationSelectionSchema.parse({ agent: { defaultTools: false } }))}`
  );
  await page.getByRole("tab", { name: "Agent", exact: true }).click();
  const catalog = page.getByRole("region", {
    name: "EVE catalog",
    exact: true,
  });
  await catalog.scrollIntoViewIfNeeded();
  await expect(catalog.getByText("Loading EVE catalog…")).toBeVisible();
  await uiVerify.snapshot("catalog loading");
  loading.resolve(null);
  await expect(catalog.getByRole("alert")).toBeVisible();
  await uiVerify.snapshot("catalog unavailable retry");
  fail = false;
  await page.getByRole("button", { name: "Retry catalog" }).click();
  await page.getByRole("button", { name: "Selected · 0", exact: true }).click();
  await expect(
    catalog.getByText("No capabilities selected yet.")
  ).toBeVisible();
  await uiVerify.snapshot("catalog no selected capabilities");
  await page.getByRole("button", { name: "Selected · 0", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Web Fetch (tool/web_fetch)" })
    .check();
  await page.getByRole("button", { name: "Selected · 1", exact: true }).click();
  await expect(
    catalog.getByTestId("capability-list").getByRole("checkbox")
  ).toHaveCount(1);
  await expect(
    catalog.getByTestId("capability-list").getByRole("checkbox")
  ).toBeChecked();
  await expect(
    catalog
      .getByTestId("eve-tool/web_fetch")
      .locator("[data-capability-visual]")
  ).toHaveAttribute("data-capability-visual", "symbol");
  await uiVerify.snapshot("catalog functional tool icons");
  await page.screenshot({ path: testInfo.outputPath("selected.png") });
});

// These existing services previously rendered category fallbacks. Use the actual
// bundled assets so a missing file or invalid SVG fails in the browser too.
test("Existing service logos render across every agent category", async ({
  page,
  uiVerify,
}, testInfo) => {
  uiVerify.disableAutoSnapshot();
  await page.setViewportSize({ width: 1440, height: 1800 });
  const services = [
    ["connection/candid", "Candid"],
    ["connection/local-falcon", "Local Falcon"],
    ["connection/natural", "Natural"],
    ["channel/recall", "Recall.ai"],
    ["channel/chat-sdk-velt", "Velt"],
    ["channel/chat-sdk-sendblue", "Sendblue"],
    ["channel/linq", "Linq"],
    ["channel/chat-sdk-kapso", "Kapso"],
    ["channel/photon-imessage", "Photon iMessage"],
    ["channel/chat-sdk-lark", "Lark / Feishu"],
    ["channel/chat-sdk-beeper", "Beeper"],
    ["extension/agent-browser", "agent-browser"],
    ["extension/jetty", "Jetty"],
    ["memory/arcana", "Kybernesis Arcana"],
    ["memory/memco", "memco"],
    ["instrumentation/raindrop", "Raindrop"],
    ["instrumentation/oodle", "Oodle"],
  ] as const;
  await page.route("**/api/eve-catalog", async (route) => {
    await route.fulfill({
      json: parseEveCatalog({
        items: services.map(([name, title]) => ({ name, title })),
      }),
    });
  });
  await page.goto("/create");
  await page.getByRole("tab", { name: "Agent", exact: true }).click();
  await expect(page.getByTestId("eve-connection/candid")).toBeAttached();
  // Load offscreen images too, so this verifies the entire local asset set.
  await page.locator("img").evaluateAll((images) => {
    for (const image of images) {
      if (image instanceof HTMLImageElement) {
        image.loading = "eager";
      }
    }
  });
  await Promise.all(
    services.map(async ([id]) => {
      const card = page.getByTestId(`eve-${id}`);
      await expect(
        card.locator('[data-capability-visual="brand"]')
      ).toBeVisible();
      await expect
        .poll(
          async () =>
            await card
              .locator("img")
              .evaluate(
                (image: HTMLImageElement) =>
                  image.complete && image.naturalWidth > 0
              )
        )
        .toBe(true);
    })
  );
  const capture = async (theme: string) => {
    await jumpToCategory(page, 1440, "Connections", "connection");
    await uiVerify.snapshot(`complete service logos ${theme}`);
    await page.screenshot({
      path: testInfo.outputPath(`service-logos-${theme}.png`),
    });
  };
  await capture("light");
  await page.getByRole("button", { name: "Toggle theme", exact: true }).click();
  await capture("dark");
});

for (const width of [1440, 845, 390]) {
  test(`Research bundle belongs to Extensions at ${width}px`, async ({
    page,
    uiVerify,
  }, testInfo) => {
    uiVerify.disableAutoSnapshot();
    await page.setViewportSize({ width, height: 1000 });
    await page.route("**/api/eve-catalog", async (route) => {
      await route.fulfill({ json: parseEveCatalog(catalogFixture) });
    });
    const initial = installationSelectionSchema.parse({
      gateway: "vercel",
      storage: { source: "vercel-blob" },
    });
    await page.goto(`/create?app=${encodeAppPreset(initial)}`);
    await page.getByRole("tab", { name: "Agent", exact: true }).click();
    const extensions = page.getByRole("region", {
      name: "Extensions",
      exact: true,
    });
    const research = extensions.getByRole("checkbox", {
      name: "Deep Research",
      exact: true,
    });
    await expect(
      page.getByRole("region", {
        name: "Application capabilities",
        exact: true,
      })
    ).toHaveCount(0);
    await research.check();
    await expect(
      extensions.getByLabel("Research search provider", { exact: true })
    ).toHaveCount(0);
    await expect(
      page.getByRole("checkbox", { name: "Deep Research", exact: true })
    ).toHaveCount(1);
    await expect(
      page.getByRole("checkbox", { name: "Text Documents", exact: true })
    ).toHaveCount(0);
    await expect(
      page.getByRole("checkbox", { name: "Attach Workspace File", exact: true })
    ).not.toBeChecked();
    await jumpToCategory(page, width, "Extensions", "extension");
    await uiVerify.snapshot("research extension with native registry items");
    await page.screenshot({
      path: testInfo.outputPath("research-extension.png"),
    });
    await extensions
      .getByRole("button", { name: "About Deep Research", exact: true })
      .click();
    const details = page.getByRole("dialog");
    await expect(details.getByLabel("Source: ChatJS")).toBeVisible();
    await expect(
      details.getByText("Requires ChatJS", { exact: true })
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await research.uncheck();
    await expect(research).not.toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: "Attach Workspace File", exact: true })
    ).not.toBeChecked();
  });
}

test("an imported native research selection remains one Extension choice", async ({
  page,
  uiVerify,
}) => {
  uiVerify.disableAutoSnapshot();
  await page.route("**/api/eve-catalog", async (route) => {
    await route.fulfill({ json: parseEveCatalog(catalogFixture) });
  });
  const installation = installationSelectionSchema.parse({
    gateway: "vercel",
    eve: ["@chatjs/deep-research"],
  });
  await page.goto(`/create?app=${encodeAppPreset(installation)}`);
  await page.getByRole("tab", { name: "Agent", exact: true }).click();
  const research = page
    .getByRole("region", { name: "Extensions", exact: true })
    .getByRole("checkbox", {
      name: "Deep Research (@chatjs/deep-research)",
      exact: true,
    });
  await expect(research).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: /Deep Research/u })
  ).toHaveCount(1);
  await research.click();
  await expect(
    page.getByRole("checkbox", { name: "Deep Research", exact: true })
  ).not.toBeChecked();
});
