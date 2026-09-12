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

const secondModelLabel = /Gemini 2.5 Flash$/;

test("multi-model creation retains exact partial operation across navigation and recovery", async ({
  page,
}, testInfo) => {
  page.setDefaultTimeout(10_000);
  const errors: string[] = [];
  const submissions: unknown[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const script = execFileSync("bun", ["tests/eve-comparison-ui.build.mjs"], {
    encoding: "utf8",
    maxBuffer: 40 * 1024 * 1024,
  });
  const css = execFileSync(
    "bun",
    [
      "-e",
      'import postcss from "postcss";import tailwind from "@tailwindcss/postcss";const from=process.cwd()+"/app/globals.css";process.stdout.write((await postcss([tailwind()]).process(await Bun.file(from).text(),{from})).css);',
    ],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }
  );
  await page.route("https://eve-comparison.test/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/fixture.js") {
      return route.fulfill({ contentType: "text/javascript", body: script });
    }
    if (url.pathname === "/api/chat-model") {
      return route.fulfill({ json: {} });
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
        contentType: "text/html",
        body: `<!doctype html><html class="dark"><head><style>${css}</style></head><body class="bg-background text-foreground"><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>`,
      });
    }
    return route.fulfill({ status: 404, body: "Unexpected fixture request" });
  });
  await page.goto("https://eve-comparison.test/");
  expect(errors).toEqual([]);
  await expect(page.locator('[contenteditable="true"]'))
    .toBeVisible({ timeout: 3000 })
    .catch((cause) => {
      throw new Error(JSON.stringify(errors), { cause });
    });
  await page.getByRole("combobox").click();
  await page.getByRole("switch", { name: "Use Multiple Models" }).click();
  await page.getByRole("option", { name: secondModelLabel }).click();
  await page.keyboard.press("Escape");
  await page
    .locator('[contenteditable="true"]')
    .fill("Compare a short greeting");
  await page.screenshot({
    path: testInfo.outputPath("new-comparison.png"),
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page).toHaveURL(
    `https://eve-comparison.test/chat/${firstConversation}`
  );
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toMatchObject({
    message: "Compare a short greeting",
    modelIds: expect.arrayContaining([firstModel, secondModel]),
  });
  const pending = await page.evaluate(
    (key) => sessionStorage.getItem(key),
    `chatjs.eve.comparison:${ownerId}:${groupId}`
  );
  expect(JSON.parse(pending ?? "null")).toEqual(submissions[0]);
  await page.getByLabel("Follow-up draft").fill("Keep this unsent follow-up");
  await page
    .getByRole("button", { name: "Attach fixture PDF", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Simulate pending send", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Gemini 2.5 Flash Needs retry",
      exact: true,
    })
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Resolve pending send", exact: true })
    .click();
  await page.reload();
  await expect(page.getByLabel("Follow-up draft")).toHaveValue(
    "Keep this unsent follow-up"
  );
  await expect(page.getByText("notes.pdf", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Selected native session: first-native")
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Gemini 2.5 Flash Needs retry", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry response", exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Check again", exact: true }).click();
  expect(submissions).toHaveLength(1);
  await page.screenshot({
    path: testInfo.outputPath("comparison-recovery.png"),
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Retry response", exact: true })
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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath("comparison-mobile.png"),
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  expect(errors).toEqual([]);
});
