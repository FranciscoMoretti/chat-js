/* oxlint-disable import/no-nodejs-modules  --
 * import/no-nodejs-modules (#529): This test harness requires import { execFileSync } from "node:child_process";; its Node runtime boundary deliberately permits these built-ins.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";
import { serialize } from "superjson";
import { z } from "zod";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable unicorn/max-nested-calls --
 * unicorn/max-nested-calls (#568): searchBatchSchema keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
const searchBatchSchema = z.object({
  "0": z.object({ json: z.object({ search: z.string() }) }),
});
/* oxlint-enable unicorn/max-nested-calls */

/* oxlint-disable no-magic-numbers, node/no-sync, typescript/prefer-readonly-parameter-types, typescript/promise-function-async  --
 * no-magic-numbers (#517): test("search states") uses 20, 1024 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * node/no-sync (#538): test("search states") uses execFileSync( "bun", [ "-e", 'const result=await Bun.build({entrypoints:["tests/; execFileSync( "bun", [ "-e", 'import postcss from "postcss";import tailwind from within its synchronous fixture setup contract; asynchronous conversion changes its callers and lifecycle.
 * oxc/no-async-await (#540): test("search states") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test("search states") accepts { page }; testInfo; route; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("search states") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
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
/* oxlint-enable no-magic-numbers, node/no-sync, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls, unicorn/no-null  --
 * max-lines-per-function (#510): test("debounces requests, hides obsolete results, and navigates to the matching branc keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("debounces requests, hides obsolete results, and navigates to the matching branc keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("debounces requests, hides obsolete results, and navigates to the matching branc uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("debounces requests, hides obsolete results, and navigates to the matching branc sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test("debounces requests, hides obsolete results, and navigates to the matching branc accepts { page, }; testInfo; route; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * unicorn/max-nested-calls (#568): test("debounces requests, hides obsolete results, and navigates to the matching branc keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * unicorn/no-null (#570): test("debounces requests, hides obsolete results, and navigates to the matching branc preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
test("debounces requests, hides obsolete results, and navigates to the matching branch", async ({
  page,
}, testInfo) => {
  const searches: string[] = [];
  const delayed = Promise.withResolvers<boolean>();
  await page.route("**/api/trpc/eve.search*", async (route) => {
    const input = searchBatchSchema.parse(
      JSON.parse(
        new URL(route.request().url()).searchParams.get("input") ?? "{}"
      )
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
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls, unicorn/no-null */

/* oxlint-disable max-lines-per-function, max-statements, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls, unicorn/no-null  --
 * max-lines-per-function (#510): test("does not publish a response for text superseded during the debounce window") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("does not publish a response for text superseded during the debounce window") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-async-await (#540): test("does not publish a response for text superseded during the debounce window") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test("does not publish a response for text superseded during the debounce window") accepts { page, }; message; request; route; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * unicorn/max-nested-calls (#568): test("does not publish a response for text superseded during the debounce window") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * unicorn/no-null (#570): test("does not publish a response for text superseded during the debounce window") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
      const input = searchBatchSchema.parse(
        JSON.parse(new URL(request.url()).searchParams.get("input") ?? "{}")
      );
      aborted.push(input["0"].json.search);
    }
  });
  const intermediate = Promise.withResolvers<boolean>();
  await page.route("**/api/trpc/eve.search*", async (route) => {
    const input = searchBatchSchema.parse(
      JSON.parse(
        new URL(route.request().url()).searchParams.get("input") ?? "{}"
      )
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
/* oxlint-enable max-lines-per-function, max-statements, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls, unicorn/no-null */

/* oxlint-disable id-length, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, unicorn/no-null  --
 * id-length (#506): test("recent-chat skeletons reserve the loaded dialog height") uses _ as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * max-lines-per-function (#510): test("recent-chat skeletons reserve the loaded dialog height") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("recent-chat skeletons reserve the loaded dialog height") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("recent-chat skeletons reserve the loaded dialog height") uses 1, 13, 8, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-ternary (#518): test("recent-chat skeletons reserve the loaded dialog height") derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): test("recent-chat skeletons reserve the loaded dialog height") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): test("recent-chat skeletons reserve the loaded dialog height") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): test("recent-chat skeletons reserve the loaded dialog height") handles optional after?.height; before?.height; after?.y; before?.y without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): test("recent-chat skeletons reserve the loaded dialog height") accepts { page, }; testInfo; url; route; element; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): test("recent-chat skeletons reserve the loaded dialog height") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
test("recent-chat skeletons reserve the loaded dialog height", async ({
  page,
}, testInfo) => {
  const recent = Promise.withResolvers<boolean>();
  await page.route(
    (url) =>
      url.pathname.startsWith("/api/trpc/") &&
      url.pathname.slice("/api/trpc/".length).split(",").includes("eve.list"),
    async (route) => {
      const procedures = new URL(route.request().url()).pathname
        .slice("/api/trpc/".length)
        .split(",");
      // Preserve unrelated results when tRPC batches the sidebar queries.
      const response = procedures.length > 1 ? await route.fetch() : undefined;
      const data: unknown = response ? await response.json() : [];
      if (!Array.isArray(data)) {
        throw new TypeError("Expected a tRPC batch response");
      }
      const batchResults: readonly unknown[] = data;
      await recent.promise;
      await route.fulfill({
        json: procedures.map((procedure, procedureIndex) =>
          procedure === "eve.list"
            ? {
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
              }
            : batchResults[procedureIndex]
        ),
        response,
      });
    }
  );
  await page.goto("/api/dev-login");
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

  // Exercise the CI batch explicitly, regardless of local request timing.
  const batch = await page.evaluate(async () => {
    const input = encodeURIComponent(
      JSON.stringify({ "0": { json: null }, "1": { json: {} } })
    );
    const response = await fetch(
      `/api/trpc/project.list,eve.list?batch=1&input=${input}`
    );
    const responseBody: unknown = await response.json();
    return responseBody;
  });
  expect(batch).toMatchObject([
    { result: { data: { json: expect.any(Array) } } },
    {
      result: {
        data: {
          json: {
            items: Array.from({ length: 8 }, (_, index) => ({
              title: `Recent conversation ${index + 1}`,
            })),
          },
        },
      },
    },
  ]);
});
/* oxlint-enable id-length, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable max-lines -- #509: This eve-search.visual.e2e.ts module keeps its existing fixture/scenario boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
