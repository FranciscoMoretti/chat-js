import type { Page } from "@playwright/test";
import { test, expect } from "@uiverify/playwright";
import catalogFixture from "./eve-catalog.fixture.json" with { type: "json" };
import {
  parseEveCatalog,
  parseSkillsCatalog,
} from "../../../packages/registry/eve-catalog";
import { encodeAppPreset } from "../../../packages/registry/app-preset";
import { installationSelectionSchema } from "../../../packages/registry/installation";
import { commandAppPreset } from "./create-fixtures.mts";

const jumpToCategory = async (
  page: Page,
  width: number,
  title: string,
  id: string
) => {
  await (width < 1024
    ? page.getByLabel("Jump to category").selectOption(id)
    : page
        .getByRole("navigation", { name: "Agent categories" })
        .getByRole("link", { name: title, exact: true })
        .click());
};

for (const width of [1440, 390]) {
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
    // Imported model settings stay intact while their controls are hidden.
    const initial = installationSelectionSchema.parse({
      gateway: "vercel",
      storage: { source: "vercel-blob" },
      agent: {
        model: "openai/gpt-5-mini",
        allowedModels: ["openai/gpt-5-nano"],
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
      .getByRole("checkbox", { name: "Slack (channel/slack)", exact: true })
      .check();
    await page
      .getByRole("checkbox", {
        name: "Notion (connection/notion)",
        exact: true,
      })
      .check();
    await expect(
      page.getByLabel(
        /^(?:Model|Allowed alternative models|Reasoning|Compaction model)$/u
      )
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
    await expect(
      catalog.getByTestId("capability-list").getByRole("checkbox")
    ).toHaveCount(14);
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
      "agent catalog categories with matching section icons"
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
    await expect(
      page.getByRole("checkbox", {
        name: "Web Chat (channel/web)",
        exact: true,
      })
    ).toBeDisabled();
    await uiVerify.snapshot("agent native channels and composition");
    await page.screenshot({ path: testInfo.outputPath("channels.png") });
    await jumpToCategory(page, width, "Tools", "tool");
    const portable = page.getByTestId("eve-@chatjs/word-count");
    await expect(portable.getByLabel("Source: ChatJS")).toBeVisible();
    await expect(
      portable.getByText("Requires ChatJS", { exact: true })
    ).toHaveCount(0);
    await portable.getByRole("checkbox").check();
    await jumpToCategory(page, width, "Tools", "tool");
    await uiVerify.snapshot(
      "portable ChatJS source without application requirement"
    );
    await page.screenshot({ path: testInfo.outputPath("portable.png") });
    await expect(portable.locator("details")).toHaveCount(0);
    await expect(
      portable.getByRole("link", { name: "Word Count documentation" })
    ).toBeVisible();
    await portable.getByRole("checkbox").press("Space");
    await expect(portable.getByRole("checkbox")).not.toBeChecked();
    await portable.getByRole("checkbox").press("Space");
    await expect(portable.getByRole("checkbox")).toBeChecked();
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
    await expect(
      page.getByTestId("eve-@acme/analytics").getByLabel("Source: @acme")
    ).toBeVisible();
    await uiVerify.snapshot("external registry source");
    const search = page.getByLabel("Research search provider", { exact: true });
    await expect(search).toHaveCount(0);
    await page
      .getByRole("checkbox", { name: "Deep Research", exact: true })
      .check();
    await search.selectOption("firecrawl-search");
    await expect(search).toHaveValue("firecrawl-search");
    await expect(
      page.getByRole("checkbox", { name: "Text Documents", exact: true })
    ).toBeDisabled();
    await search.selectOption("tavily-search");
    await page
      .getByRole("checkbox", { name: "Deep Research", exact: true })
      .uncheck();
    await expect(search).toHaveCount(0);
    await page.getByRole("button", { name: "Get Code", exact: true }).click();
    const recipe = commandAppPreset(
      await page.getByTestId("create-command").textContent()
    );
    expect(recipe.plugins).toEqual([]);
    expect(recipe.eve).toContain(
      "@skills/vercel-labs/agent-skills/vercel-react-best-practices"
    );
    expect(recipe.eve).toContain("@chatjs/word-count");
    expect(recipe.tools).not.toContain("word-count");
    expect(recipe.eveRegistries).toEqual({
      "@acme": "https://registry.example/r/{name}.json",
    });
    expect(recipe.eve).toContain("channel/slack");
    expect(recipe.eve).toContain("connection/notion");
    expect(recipe.eve).toContain("connection/linear");
    expect(recipe.eve).toContain("memory/file");
    expect(recipe.tools).not.toContain("tavily-search");
    expect(recipe.tools).not.toContain("firecrawl-search");
    expect(recipe.agent).toMatchObject({
      compaction: { model: "openai/gpt-5-nano" },
      model: "openai/gpt-5-mini",
      allowedModels: ["openai/gpt-5-nano"],
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
  await page.goto("/create");
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
  await uiVerify.snapshot("catalog selected native tool");
  await page.screenshot({ path: testInfo.outputPath("selected.png") });
});
