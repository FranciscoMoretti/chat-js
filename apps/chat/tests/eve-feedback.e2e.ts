/* oxlint-disable import/no-nodejs-modules, import/no-relative-parent-imports, sort-imports --
 * import/no-nodejs-modules (#529): This test harness requires import { execFileSync } from "node:child_process";; import { readFileSync } from "node:fs";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/schema" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
/* oxlint-disable eslint/no-promise-executor-return -- These Promise executors directly register callback APIs whose return values are ignored. */
/* oxlint-disable promise/avoid-new -- These fixtures adapt callback, timer, stream, or browser event APIs into awaited Promises. */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
/* oxlint-disable unicorn/consistent-function-scoping -- One-off helpers stay beside the scenario state they coordinate. */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../lib/db/client";
import { eveConversation, eveVote } from "../lib/db/schema";
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable import/no-nodejs-modules, import/no-relative-parent-imports, sort-imports */

/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): assertEveTestDatabase reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
/* oxlint-enable node/no-process-env */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, oxc/no-async-await, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-void-return --
 * max-lines-per-function (#510): test("assistant feedback survives reload, recovers from errors and stays out of publi keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("assistant feedback survives reload, recovers from errors and stays out of publi keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("assistant feedback survives reload, recovers from errors and stays out of publi uses 0, 1100, 390, 120_000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("assistant feedback survives reload, recovers from errors and stays out of publi uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): test("assistant feedback survives reload, recovers from errors and stays out of publi sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test("assistant feedback survives reload, recovers from errors and stays out of publi accepts { page, browser, }; testInfo; route; url; url: URL; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("assistant feedback survives reload, recovers from errors and stays out of publi preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-void-return (#611): test("assistant feedback survives reload, recovers from errors and stays out of publi's void callback contract discards its result; changing the callback API or operation order solely to hide the return value is unnecessary.
 */
test("assistant feedback survives reload, recovers from errors and stays out of public shares", async ({
  page,
  browser,
}, testInfo) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const created = await page.request.post("/api/agent-conversations", {
    data: {
      message: "Reply exactly feedback-fixture-ok",
      modelId: "openai/gpt-5-mini",
      operationId: crypto.randomUUID(),
    },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const binding = z.object({ id: z.uuid() }).parse(await created.json());
  const anonymous = await browser.newContext();
  try {
    await page.goto(`/chat/${binding.id}`);
    await expect(page.locator(".is-assistant")).toContainText(
      "feedback-fixture-ok",
      { timeout: 90_000 }
    );
    const up = page.getByTestId("message-upvote");
    const down = page.getByTestId("message-downvote");
    await expect(up).toBeEnabled();
    await expect(
      page.locator(".is-user").getByTestId("message-upvote")
    ).toHaveCount(0);
    await up.click();
    await expect(up).toHaveAttribute("aria-pressed", "true");
    await expect(up).toBeDisabled();
    await expect(down).toBeEnabled();
    await page.reload();
    await expect(up).toHaveAttribute("aria-pressed", "true");
    for (const width of [1100, 390]) {
      await page.setViewportSize({ height: 850, width });
      await page.locator(".is-assistant").screenshot({
        animations: "disabled",
        path: testInfo.outputPath(`feedback-${width}.png`),
      });
    }
    await page.route(
      (url) =>
        url.pathname.includes("eve.vote") &&
        !url.pathname.includes("eve.votes"),
      (route) =>
        route.fulfill({
          body: "{}",
          contentType: "application/json",
          status: 500,
        }),
      { times: 1 }
    );
    await down.click();
    await expect(page.getByText("Failed to downvote response.")).toBeVisible();
    await expect(down).toBeEnabled();
    await expect(up).toHaveAttribute("aria-pressed", "true");
    await down.click();
    await expect(down).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(down).toHaveAttribute("aria-pressed", "true");

    const votesRoute = (url: URL): boolean =>
      url.pathname.includes("eve.votes");
    await page.route(votesRoute, (route) =>
      route.fulfill({
        body: "{}",
        contentType: "application/json",
        status: 500,
      })
    );
    await page.reload();
    const retry = page.getByRole("button", { name: "Retry loading feedback" });
    await expect(retry).toBeVisible();
    await page.locator(".is-assistant").screenshot({
      animations: "disabled",
      path: testInfo.outputPath("feedback-load-error.png"),
    });
    await page.unroute(votesRoute);
    await retry.click();
    await expect(down).toHaveAttribute("aria-pressed", "true");

    // A focus refetch starts during a save and returns the previous vote last.
    const mutationStarted = Promise.withResolvers<undefined>();
    const resumeMutation = Promise.withResolvers<undefined>();
    const staleReadStarted = Promise.withResolvers<undefined>();
    const releaseStaleRead = Promise.withResolvers<undefined>();
    const staleReadFinished = Promise.withResolvers<undefined>();
    const mutationRoute = (url: URL): boolean =>
      url.pathname.includes("eve.vote") && !url.pathname.includes("eve.votes");
    await page.route(
      mutationRoute,
      async (route) => {
        mutationStarted.resolve(undefined);
        await resumeMutation.promise;
        await route.continue();
      },
      { times: 1 }
    );
    await page.route(
      votesRoute,
      async (route) => {
        const response = await route.fetch();
        staleReadStarted.resolve(undefined);
        await releaseStaleRead.promise;
        try {
          await route.fulfill({ response });
        } finally {
          staleReadFinished.resolve(undefined);
        }
      },
      { times: 1 }
    );
    try {
      await up.click();
      await mutationStarted.promise;
      await page.clock.setFixedTime(new Date(Date.now() + 120_000));
      await page.evaluate(() =>
        globalThis.dispatchEvent(new Event("visibilitychange"))
      );
      await staleReadStarted.promise;
      resumeMutation.resolve(undefined);
      await expect(up).toHaveAttribute("aria-pressed", "true");
      releaseStaleRead.resolve(undefined);
      await staleReadFinished.promise;
      // A following browser task runs after the completed response is processed.
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve))
          )
      );
      await expect(up).toHaveAttribute("aria-pressed", "true");
      await expect(down).toBeEnabled();
    } finally {
      resumeMutation.resolve(undefined);
      releaseStaleRead.resolve(undefined);
    }

    const shared = await page.request.post("/api/trpc/eve.setVisibility", {
      data: { json: { id: binding.id, visibility: "public" } },
    });
    expect(shared.ok(), await shared.text()).toBe(true);
    const publicPage = await anonymous.newPage();
    const feedbackRequests: string[] = [];
    publicPage.on("request", (request) => {
      if (request.url().includes("eve.vote")) {
        feedbackRequests.push(request.url());
      }
    });
    await publicPage.route("https://unpkg.com/react-scan/**", (route) =>
      route.abort()
    );
    await publicPage.goto(`${new URL(page.url()).origin}/share/${binding.id}`);
    await expect(publicPage.getByRole("log")).toContainText(
      "feedback-fixture-ok"
    );
    await expect(publicPage.getByTestId("message-upvote")).toHaveCount(0);
    await expect(publicPage.getByTestId("message-downvote")).toHaveCount(0);
    expect(feedbackRequests).toEqual([]);
    await publicPage.locator("main").screenshot({
      animations: "disabled",
      path: testInfo.outputPath("feedback-shared.png"),
    });
  } finally {
    await anonymous.close();
    await db.delete(eveVote).where(eq(eveVote.conversationId, binding.id));
    await db
      .update(eveConversation)
      .set({ visibility: "private" })
      .where(eq(eveConversation.id, binding.id));
  }
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, oxc/no-async-await, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-void-return */

/* oxlint-disable max-statements, no-magic-numbers, node/no-sync, oxc/no-async-await, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-statements (#512): test("shared feedback controls render unrated, selected and pending states") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("shared feedback controls render unrated, selected and pending states") uses 4, 0, 1, 2, 3, 1100, 390 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * node/no-sync (#538): test("shared feedback controls render unrated, selected and pending states") uses execFileSync("bun", [ "build", "tests/eve-feedback-fixture.tsx", "--target=browser", ; readFileSync(bundle, "utf-8") within its synchronous fixture setup contract; asynchronous conversion changes its callers and lifecycle.
 * oxc/no-async-await (#540): test("shared feedback controls render unrated, selected and pending states") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test("shared feedback controls render unrated, selected and pending states") accepts { page, }; testInfo; route; links; link; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("shared feedback controls render unrated, selected and pending states") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("shared feedback controls render unrated, selected and pending states", async ({
  page,
}, testInfo) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.outerHTML).join(""));
  const bundleDirectory = testInfo.outputPath("fixture-bundle");
  const bundle = `${bundleDirectory}/eve-feedback-fixture.js`;
  execFileSync("bun", [
    "build",
    "tests/eve-feedback-fixture.tsx",
    "--target=browser",
    "--outdir",
    bundleDirectory,
  ]);
  await page.setContent(
    `<!doctype html><html class="dark"><head>${styles}</head><body class="bg-background text-foreground"><div id="fixture"></div></body></html>`
  );
  await page.addScriptTag({
    content: readFileSync(bundle, "utf-8"),
    type: "module",
  });
  await expect(page.getByTestId("message-upvote")).toHaveCount(4);
  await expect(page.getByTestId("message-upvote").nth(0)).toBeEnabled();
  await expect(page.getByTestId("message-downvote").nth(0)).toBeEnabled();
  await expect(page.getByTestId("message-upvote").nth(1)).toBeDisabled();
  await expect(page.getByTestId("message-downvote").nth(2)).toBeDisabled();
  await expect(page.getByTestId("message-upvote").nth(3)).toBeDisabled();
  await expect(page.getByTestId("message-downvote").nth(3)).toBeDisabled();
  for (const width of [1100, 390]) {
    await page.setViewportSize({ height: 850, width });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: testInfo.outputPath(`feedback-states-${width}.png`),
    });
  }
});
/* oxlint-enable max-statements, no-magic-numbers, node/no-sync, oxc/no-async-await, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
