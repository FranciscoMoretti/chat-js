/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This test harness requires import { execFileSync } from "node:child_process";; its Node runtime boundary deliberately permits these built-ins.
 */

import { execFileSync } from "node:child_process";
// oxlint-disable-next-line eslint/sort-imports -- Keep Playwright type-only imports separate from runtime bindings; moving them has no runtime module-order effect.

/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { expect, test } from "@playwright/test";
// oxlint-disable-next-line eslint/sort-imports -- Keep the type-only import required by consistent-type-imports; it has no runtime evaluation order.
import type { TestInfo } from "@playwright/test";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable eslint/sort-imports */
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, node/no-sync --
 * max-lines-per-function (#510): test("EVE message presentation keeps editing, actions, versions and cards coherent") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("EVE message presentation keeps editing, actions, versions and cards coherent") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("EVE message presentation keeps editing, actions, versions and cards coherent") uses 30, 1024, 2, 0, 4, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * node/no-sync (#538): test("EVE message presentation keeps editing, actions, versions and cards coherent") uses execFileSync( "bun", ["tests/eve-message-presentation.build.mjs"], { encoding: "ut; execFileSync( "bun", [ "-e", 'import postcss from "postcss";import tailwind from within its synchronous fixture setup contract; asynchronous conversion changes its callers and lifecycle.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Page fixture calls page.on(), page.route(), page.goto() on the original Page/locator receiver to change the live browser or route state.
test("EVE message presentation keeps editing, actions, versions and cards coherent", async ({
  page,
}, testInfo: Readonly<Pick<TestInfo, "outputPath">>) => {
  const errors: string[] = [];
  page.on("pageerror", (error: Readonly<Error>) => errors.push(error.message));
  const script = execFileSync(
    "bun",
    ["tests/eve-message-presentation.build.mjs"],
    {
      encoding: "utf-8",
      maxBuffer: 30 * 1024 * 1024,
    }
  );
  const css = execFileSync(
    "bun",
    [
      "-e",
      'import postcss from "postcss";import tailwind from "@tailwindcss/postcss";const from=process.cwd()+"/app/globals.css";const result=await postcss([tailwind()]).process(await Bun.file(from).text(),{from});process.stdout.write(result.css);',
    ],
    { encoding: "utf-8", maxBuffer: 30 * 1024 * 1024 }
  );
  const fixtureUrl = "http://eve-message-presentation.test/";
  await page.route(
    "**/*",
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Route callback calls route.fulfill() and route.abort() to resolve the intercepted live request through the original native Route receiver.
    async (route) => {
      if (route.request().url() === fixtureUrl) {
        await route.fulfill({
          body: `<!doctype html><html class="dark"><head><style>${css}</style></head><body class="bg-background text-foreground"><div id="root"></div></body></html>`,
          contentType: "text/html",
        });
        return;
      }
      await route.abort();
    }
  );
  await page.goto(fixtureUrl);
  await page.addScriptTag({ content: script, type: "module" });

  const editable = page.getByTestId("editable-transcript").first();
  const firstUser = editable.locator('[data-message-id="user-1"]');
  const firstAssistant = editable.locator('[data-message-id="assistant-1"]');
  const secondAssistant = editable.locator('[data-message-id="assistant-2"]');
  const legacy = page.getByTestId("legacy-reference");
  const legacyUser = legacy.locator('[data-message-id="legacy-user-1"]');
  const readonly = page.getByTestId("readonly-transcript");
  const legacyReadonly = page.getByTestId("legacy-readonly");
  await expect(
    page.getByRole("heading", { name: "Restored EVE — ready" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Restored EVE — readonly" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Restored EVE — pending" })
  ).toBeVisible();
  await expect(
    legacyUser.locator('button[data-testid="legacy-message-content"]')
  ).toBeVisible();
  const [restoredReadyBox, legacyReadyBox] = await Promise.all([
    firstUser.boundingBox(),
    legacyUser.boundingBox(),
  ]);
  expect(restoredReadyBox).not.toBeNull();
  expect(legacyReadyBox).not.toBeNull();
  if (!(restoredReadyBox && legacyReadyBox)) {
    throw new Error("Missing ready message geometry");
  }
  expect(Math.abs(restoredReadyBox.width - legacyReadyBox.width)).toBeLessThan(
    2
  );
  expect(
    Math.abs(restoredReadyBox.height - legacyReadyBox.height)
  ).toBeLessThan(2);
  await expect(
    firstUser.getByRole("button", { name: "Edit message" })
  ).toBeVisible();
  await expect(
    firstUser.getByRole("button", { name: "Previous version" })
  ).toBeEnabled();
  await expect(
    firstUser.getByRole("button", { name: "Next version" })
  ).toBeEnabled();
  await expect(
    editable
      .locator('[data-message-id="user-2"]')
      .getByRole("button", { name: "Previous version" })
  ).toBeEnabled();
  await expect(
    editable
      .locator('[data-message-id="user-2"]')
      .getByRole("button", { name: "Next version" })
  ).toBeDisabled();
  await expect(
    firstAssistant.getByRole("button", { name: "Retry" })
  ).toBeVisible();
  await expect(firstAssistant.getByText("model-a")).toBeVisible();
  await expect(
    secondAssistant.getByRole("button", { name: "Retry" })
  ).toBeVisible();
  await expect(
    firstUser.getByTestId("inline-response-cards").getByRole("button")
  ).toHaveCount(2);

  await page.evaluate(() => {
    const node = document.querySelector(
      '[data-testid="editable-transcript"] [data-message-id="user-1"] pre'
    );
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading firstChild from node; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    if (!node?.firstChild) {
      throw new Error("Missing selectable message text");
    }
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = globalThis.getSelection();
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading removeAllRanges from selection; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    selection?.removeAllRanges();
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading addRange from selection; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    selection?.addRange(range);
    const button = node.closest("button");
    if (!button) {
      throw new Error("Missing message content button");
    }
    button.click();
  });
  await expect(editable.getByTestId("inline-editor")).toHaveCount(0);
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading removeAllRanges from globalThis.getSelection(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  await page.evaluate(() => globalThis.getSelection()?.removeAllRanges());
  await firstUser.locator('button[data-testid="message-content"]').click();
  await expect(editable.getByTestId("inline-editor")).toBeVisible();
  await expect(
    firstUser.getByRole("button", { exact: true, name: "Cancel edit" })
  ).toBeVisible();
  await legacyUser
    .locator('button[data-testid="legacy-message-content"]')
    .click();
  await expect(legacyUser.getByTestId("inline-editor")).toBeVisible();
  const [restoredEditBox, legacyEditBox] = await Promise.all([
    firstUser.boundingBox(),
    legacyUser.boundingBox(),
  ]);
  expect(restoredEditBox).not.toBeNull();
  expect(legacyEditBox).not.toBeNull();
  if (!(restoredEditBox && legacyEditBox)) {
    throw new Error("Missing edit message geometry");
  }
  expect(Math.abs(restoredEditBox.width - legacyEditBox.width)).toBeLessThan(2);
  expect(Math.abs(restoredEditBox.height - legacyEditBox.height)).toBeLessThan(
    2
  );
  await firstUser.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("message-presentation-edit.png"),
  });
  await firstUser
    .getByRole("button", { exact: true, name: "Cancel edit" })
    .click();
  await legacyUser
    .getByRole("button", { exact: true, name: "Cancel edit" })
    .click();
  await expect(editable.getByTestId("inline-editor")).toHaveCount(0);
  await expect(legacyUser.getByTestId("inline-editor")).toHaveCount(0);
  await expect(page.getByTestId("interaction-log")).toContainText(
    "edit:user-1"
  );

  await secondAssistant.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByTestId("interaction-log")).toContainText(
    "retry:user-2->assistant-2"
  );
  await editable.getByRole("button", { name: "Next version" }).first().click();
  await expect(page.getByTestId("interaction-log")).toContainText(
    "next:user-1"
  );

  await expect(
    readonly.locator('button[data-testid="message-content"]')
  ).toHaveCount(0);
  await expect(readonly.getByTestId("message-content").first()).toBeVisible();
  await expect(
    readonly.getByRole("button", { name: "Edit message" })
  ).toHaveCount(0);
  await expect(readonly.getByRole("button", { name: "Copy" })).toHaveCount(4);
  const [restoredReadonlyBox, legacyReadonlyBox] = await Promise.all([
    readonly.locator('[data-message-id="user-1"]').boundingBox(),
    legacyReadonly.locator('[data-message-id="legacy-user-1"]').boundingBox(),
  ]);
  expect(restoredReadonlyBox).not.toBeNull();
  expect(legacyReadonlyBox).not.toBeNull();
  if (!(restoredReadonlyBox && legacyReadonlyBox)) {
    throw new Error("Missing readonly message geometry");
  }
  expect(
    Math.abs(restoredReadonlyBox.width - legacyReadonlyBox.width)
  ).toBeLessThan(2);
  expect(
    Math.abs(restoredReadonlyBox.height - legacyReadonlyBox.height)
  ).toBeLessThan(2);

  const loading = page.locator('[data-testid="editable-transcript"]').nth(1);
  await expect(
    loading.locator('[data-message-id="assistant-2"] button')
  ).toHaveCount(0);

  const comparison = page.getByTestId("comparison-cards");
  await expect(comparison.getByRole("button")).toHaveCount(2);
  await expect(
    comparison.getByRole("button", { name: "Model B Generating..." })
  ).toBeVisible();
  await comparison
    .getByRole("button", { name: "Model B Generating..." })
    .click();

  await page.setViewportSize({ height: 1100, width: 1280 });
  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: testInfo.outputPath("message-presentation-desktop.png"),
  });
  await page.setViewportSize({ height: 844, width: 390 });
  await expect(
    firstUser.getByRole("button", { name: "Edit message" })
  ).toBeVisible();
  await expect(firstUser.getByRole("button", { name: "Copy" })).toBeVisible();
  await expect(
    legacyUser.getByRole("button", { name: "Edit message" })
  ).toBeVisible();
  const [restoredMobileBox, legacyMobileBox] = await Promise.all([
    firstUser.boundingBox(),
    legacyUser.boundingBox(),
  ]);
  expect(restoredMobileBox).not.toBeNull();
  expect(legacyMobileBox).not.toBeNull();
  if (!(restoredMobileBox && legacyMobileBox)) {
    throw new Error("Missing mobile message geometry");
  }
  expect(
    Math.abs(restoredMobileBox.width - legacyMobileBox.width)
  ).toBeLessThan(2);
  expect(
    Math.abs(restoredMobileBox.height - legacyMobileBox.height)
  ).toBeLessThan(2);
  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: testInfo.outputPath("message-presentation-mobile.png"),
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  expect(errors).toEqual([]);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, node/no-sync */
