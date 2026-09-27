import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";
import { serialize } from "superjson";

test("search states", async ({ page }, testInfo) => {
  const script = execFileSync(
    "bun",
    [
      "-e",
      'const result=await Bun.build({entrypoints:["tests/eve-search.fixture.tsx"],target:"browser",define:{"process.env.NODE_ENV":JSON.stringify("production"),"process.env":"{}"}});if(!result.success)throw new Error(String(result.logs));process.stdout.write(await result.outputs[0].text());',
    ],
    { encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 }
  );
  const css = execFileSync(
    "bun",
    [
      "-e",
      'import postcss from "postcss";import tailwind from "@tailwindcss/postcss";const from=process.cwd()+"/app/globals.css";const result=await postcss([tailwind()]).process(await Bun.file(from).text(),{from});process.stdout.write(result.css);',
    ],
    { encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 }
  );
  await page.route("**/search-fixture", (route) =>
    route.fulfill({
      body: `<!doctype html><html><head><style>${css}</style></head><body class="bg-background text-foreground"><div id="root"></div></body></html>`,
      contentType: "text/html",
    })
  );
  await page.setViewportSize({ height: 1100, width: 1100 });
  await page.goto("/search-fixture");
  await page.addScriptTag({ content: script, type: "module" });
  await expect(page.getByRole("heading", { name: "Pagination" })).toBeVisible();
  await expect(page.locator("mark")).toHaveText([
    "saffron",
    "Worl",
    "Hello",
    "saffron",
  ]);
  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: testInfo.outputPath("search-states.png"),
  });
});

test("debounces requests, hides obsolete results, and navigates to the matching branch", async ({
  page,
}, testInfo) => {
  const searches: string[] = [];
  const delayed = Promise.withResolvers<boolean>();
  await page.route("**/api/trpc/eve.search*", async (route) => {
    const input = JSON.parse(
      new URL(route.request().url()).searchParams.get("input") ?? "{}"
    );
    const { search } = input["0"].json;
    searches.push(search);
    if (search === "saffron rice") {
      await delayed.promise;
    }
    await route.fulfill({
      json: [
        {
          result: {
            data: serialize({
              items: [
                {
                  conversationId: "00000000-0000-4000-8000-000000000002",
                  excerpt: "Toast the ⟦saffron⟧ gently before adding broth.",
                  id: "00000000-0000-4000-8000-000000000001",
                  rank: 1,
                  title: "Weekend dinner ideas",
                  updatedAt: "2026-09-25T10:00:00Z",
                },
              ],
              nextCursor: null,
            }),
          },
        },
      ],
    });
  });
  await page.goto("/api/dev-login");
  await page.getByRole("button", { name: /Search chats/u }).click();
  const input = page.getByRole("combobox", { name: "Search conversations" });
  await input.pressSequentially("saffron", { delay: 30 });
  await expect(
    page.getByRole("option", { name: /Weekend dinner ideas/u })
  ).toBeVisible();
  expect(searches).toEqual(["saffron"]);
  await input.fill("saffron rice");
  await expect.poll(() => searches).toEqual(["saffron", "saffron rice"]);
  await expect(page.getByRole("option")).toHaveCount(0);
  await expect(
    page.getByRole("status", { name: "Loading chats" })
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Searching…" })
  ).toHaveText("Searching…");
  await expect(page.getByText("Loading chats…")).toHaveCount(0);
  delayed.resolve(true);
  await expect(page.getByText("Searching…", { exact: true })).toHaveCount(0);
  await page.getByRole("dialog").screenshot({
    animations: "disabled",
    path: testInfo.outputPath("search-dialog.png"),
  });
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(page).toHaveURL(
    /\/chat\/00000000-0000-4000-8000-000000000002$/u
  );
});

test("does not publish a response for text superseded during the debounce window", async ({
  page,
}) => {
  const requests: string[] = [];
  const aborted: string[] = [];
  const searchErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("eve.search")) {
      searchErrors.push(message.text());
    }
  });
  page.on("requestfailed", (request) => {
    if (request.url().includes("/api/trpc/eve.search")) {
      const input = JSON.parse(
        new URL(request.url()).searchParams.get("input") ?? "{}"
      );
      aborted.push(input["0"].json.search);
    }
  });
  const intermediate = Promise.withResolvers<boolean>();
  await page.route("**/api/trpc/eve.search*", async (route) => {
    const input = JSON.parse(
      new URL(route.request().url()).searchParams.get("input") ?? "{}"
    );
    const { search } = input["0"].json;
    requests.push(search);
    if (search === "intermediate") {
      await intermediate.promise;
    }
    await route.fulfill({
      json: [
        {
          result: {
            data: serialize({
              items: [
                {
                  conversationId: "00000000-0000-4000-8000-000000000002",
                  excerpt: "",
                  id: "00000000-0000-4000-8000-000000000001",
                  rank: 1,
                  title: `Result for ${search}`,
                  updatedAt: "2026-09-25T10:00:00Z",
                },
              ],
              nextCursor: null,
            }),
          },
        },
      ],
    });
  });
  await page.goto("/api/dev-login");
  await page.getByRole("button", { name: /Search chats/u }).click();
  const input = page.getByRole("combobox", { name: "Search conversations" });
  await input.fill("original");
  await expect(
    page.getByRole("option", { name: "Result for original" })
  ).toBeVisible();
  await page.evaluate(() => {
    const seen = document.createElement("div");
    seen.id = "observed-search-results";
    seen.hidden = true;
    document.body.append(seen);
    const list = document.querySelector("[cmdk-list]");
    if (!list) {
      throw new Error("Missing result list");
    }
    new MutationObserver(() => {
      seen.textContent += `|${list.textContent}`;
    }).observe(list, { characterData: true, childList: true, subtree: true });
  });
  await input.fill("intermediate");
  await expect.poll(() => requests).toEqual(["original", "intermediate"]);
  await input.fill("latest");
  intermediate.resolve(true);
  await expect(
    page.getByRole("option", { name: "Result for latest" })
  ).toBeVisible();
  expect(requests).toEqual(["original", "intermediate", "latest"]);
  await expect(page.locator("#observed-search-results")).not.toContainText(
    "Result for intermediate"
  );
  await expect.poll(() => aborted).toContain("intermediate");
  expect(searchErrors).toEqual([]);
  await input.fill("original");
  await expect(
    page.getByRole("option", { name: "Result for original" })
  ).toBeVisible();
  await expect(page.getByRole("listbox")).toHaveAttribute("aria-busy", "false");
  expect(requests).toEqual(["original", "intermediate", "latest", "original"]);
});

test("recent-chat skeletons reserve the loaded dialog height", async ({
  page,
}, testInfo) => {
  const recent = Promise.withResolvers<boolean>();
  await page.goto("/api/dev-login");
  await page.route("**/api/trpc/eve.list*", async (route) => {
    await recent.promise;
    await route.fulfill({
      json: [
        {
          result: {
            data: serialize({
              items: Array.from({ length: 8 }, (_, index) => ({
                conversationId: `branch-${index}`,
                createdAt: "2026-09-25T10:00:00Z",
                id: `chat-${index}`,
                state: "bound",
                title: `Recent conversation ${index + 1}`,
              })),
              nextCursor: null,
            }),
          },
        },
      ],
    });
  });
  await page.getByRole("button", { name: /Search chats/u }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("status", { name: "Loading chats" })
  ).toBeVisible();
  await expect(dialog.locator('[data-slot="skeleton"]')).toHaveCount(13);
  const background = await dialog
    .locator("[cmdk-root]")
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  await expect(dialog.locator('[data-slot="skeleton"]').first()).not.toHaveCSS(
    "background-color",
    background
  );

  await dialog.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("search-skeletons.png"),
  });
  const before = await dialog.boundingBox();
  recent.resolve(true);
  await expect(dialog.getByRole("option")).toHaveCount(8);
  await expect(dialog.locator('[data-slot="skeleton"]')).toHaveCount(0);
  const after = await dialog.boundingBox();
  expect(after?.height).toBe(before?.height);
  expect(after?.y).toBe(before?.y);
  await expect(
    dialog.getByText("Search across your conversations")
  ).toHaveCount(0);
});
