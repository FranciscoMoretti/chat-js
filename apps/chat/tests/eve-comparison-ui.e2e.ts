import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import {
  completeGroup,
  firstConversation,
  firstModel,
  groupId,
  ownerId,
  partialGroup,
  secondConversation,
  secondModel,
} from "./eve-comparison-data.fixture";

const secondModelLabel = /Gemini 2.5 Flash$/u;

test("multi-model creation retains exact partial operation across navigation and recovery", async ({
  page,
}, testInfo) => {
  page.setDefaultTimeout(10_000);
  const errors: string[] = [];
  const submissions: unknown[] = [];
  const preferences: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const script = execFileSync("bun", ["tests/eve-comparison-ui.build.mjs"], {
    encoding: "utf-8",
    maxBuffer: 40 * 1024 * 1024,
  });
  const css = execFileSync(
    "bun",
    [
      "-e",
      'import postcss from "postcss";import tailwind from "@tailwindcss/postcss";const from=process.cwd()+"/app/globals.css";process.stdout.write((await postcss([tailwind()]).process(await Bun.file(from).text(),{from})).css);',
    ],
    { encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 }
  );
  await page.route("https://eve-comparison.test/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/fixture.js") {
      return route.fulfill({ body: script, contentType: "text/javascript" });
    }
    if (url.pathname === "/api/chat-model") {
      const { model } = route.request().postDataJSON();
      preferences.push(model);
      return route.fulfill({
        headers: {
          "set-cookie": `chat-model=${model}; Path=/; Secure; SameSite=Lax`,
        },
        json: {},
      });
    }
    if (
      url.pathname === "/api/agent-response-groups" &&
      route.request().method() === "POST"
    ) {
      submissions.push(route.request().postDataJSON());
      return route.fulfill({
        json: submissions.length === 1 ? partialGroup : completeGroup,
      });
    }
    if (url.pathname === `/api/agent-response-groups/${groupId}`) {
      return route.fulfill({ json: partialGroup });
    }
    if (url.pathname === "/" || url.pathname.startsWith("/chat/")) {
      return route.fulfill({
        body: `<!doctype html><html class="dark"><head><style>${css}</style></head><body class="bg-background text-foreground"><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>`,
        contentType: "text/html",
      });
    }
    return route.fulfill({ body: "Unexpected fixture request", status: 404 });
  });
  await page.goto("https://eve-comparison.test/");
  expect(errors).toEqual([]);
  await expect(page.locator('[contenteditable="true"]'))
    .toBeVisible({ timeout: 3000 })
    .catch((error) => {
      throw new Error(JSON.stringify(errors), { cause: error });
    });
  await page.getByTitle("Select Tools", { exact: true }).click();
  await page.getByRole("menuitem", { exact: true, name: "Canvas" }).click();
  await page.getByTestId("model-selector").click();
  await page.getByRole("switch", { name: "Use Multiple Models" }).click();
  await page.getByRole("option", { name: secondModelLabel }).click();
  await page.keyboard.press("Escape");
  await page
    .locator('[contenteditable="true"]')
    .fill("Compare a short greeting");
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("new-comparison.png"),
  });
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(page).toHaveURL(
    `https://eve-comparison.test/chat/${firstConversation}`
  );
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toMatchObject({
    message: "Compare a short greeting",
    modelIds: expect.arrayContaining([firstModel, secondModel]),
    selectedTool: "createTextDocument",
  });
  const pending = await page.evaluate(
    (key) => sessionStorage.getItem(key),
    `chatjs.eve.comparison:${ownerId}:${groupId}`
  );
  expect(JSON.parse(pending ?? "null")).toEqual(submissions[0]);
  await page.getByLabel("Follow-up draft").fill("Keep this unsent follow-up");
  await page.getByTitle("Select Tools", { exact: true }).click();
  await page.getByRole("menuitem", { exact: true, name: "Canvas" }).click();
  await page
    .getByRole("button", { exact: true, name: "Attach fixture PDF" })
    .click();
  await page
    .getByRole("button", { exact: true, name: "Simulate pending send" })
    .click();
  await expect(page.getByTitle("Select Tools", { exact: true })).toBeDisabled();
  await expect(
    page.getByRole("button", {
      exact: true,
      name: "Gemini 2.5 Flash Needs retry",
    })
  ).toBeDisabled();
  await page
    .getByRole("button", { exact: true, name: "Resolve pending send" })
    .click();
  await page.reload();
  await expect(page.getByLabel("Follow-up draft")).toHaveValue(
    "Keep this unsent follow-up"
  );
  await expect(page.getByText("notes.pdf", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { exact: true, name: "Clear Canvas tool" })
  ).toBeVisible();
  await expect(
    page.getByText("Selected native session: first-native")
  ).toBeVisible();
  await page
    .getByRole("button", { exact: true, name: "Gemini 2.5 Flash Needs retry" })
    .click();
  await expect(
    page.getByRole("button", { exact: true, name: "Retry response" })
  ).toBeVisible();
  await page.getByRole("button", { exact: true, name: "Check again" }).click();
  expect(submissions).toHaveLength(1);
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("comparison-recovery.png"),
  });
  await page
    .getByRole("button", { exact: true, name: "Retry response" })
    .click();
  await expect(page).toHaveURL(
    `https://eve-comparison.test/chat/${secondConversation}`
  );
  expect(submissions).toHaveLength(2);
  expect(submissions[1]).toEqual(submissions[0]);
  await expect(
    page.getByText("Selected native session: second-native")
  ).toBeVisible();
  expect(
    await page.evaluate(
      (key) => sessionStorage.getItem(key),
      `chatjs.eve.comparison:${ownerId}:${groupId}`
    )
  ).toBeNull();
  await expect(page.getByLabel("Follow-up draft")).toHaveValue(
    "Keep this unsent follow-up"
  );
  await expect(page.getByText("notes.pdf", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { exact: true, name: "Clear Canvas tool" })
  ).toBeVisible();
  expect(preferences.at(-1)).toBe(secondModel);
  await expect(
    page.getByText(`Follow-up model: ${secondModel}`, { exact: true })
  ).toBeVisible();
  await page.setViewportSize({ height: 844, width: 390 });
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("comparison-mobile.png"),
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await page
    .getByRole("button", {
      exact: true,
      name: "Gemini 2.5 Flash Lite Open response",
    })
    .click();
  await expect(page).toHaveURL(
    `https://eve-comparison.test/chat/${firstConversation}`
  );
  expect(preferences.at(-1)).toBe(firstModel);
  await expect(
    page.getByText(`Follow-up model: ${firstModel}`, { exact: true })
  ).toBeVisible();
  await expect(page.getByLabel("Follow-up draft")).toHaveValue(
    "Keep this unsent follow-up"
  );
  expect(errors).toEqual([]);
});
