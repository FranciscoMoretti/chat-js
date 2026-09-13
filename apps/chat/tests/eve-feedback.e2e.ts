import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../lib/db/client";
import { eveConversation, eveVote } from "../lib/db/schema";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

test("assistant feedback survives reload, recovers from errors and stays out of public shares", async ({
  page,
  browser,
}, testInfo) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const created = await page.request.post("/api/agent-conversations", {
    headers: { origin: new URL(page.url()).origin },
    data: {
      operationId: crypto.randomUUID(),
      modelId: "openai/gpt-5-mini",
      message: "Reply exactly feedback-fixture-ok",
    },
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
      await page.setViewportSize({ width, height: 850 });
      await page.locator(".is-assistant").screenshot({
        path: testInfo.outputPath(`feedback-${width}.png`),
        animations: "disabled",
      });
    }
    await page.route(
      (url) =>
        url.pathname.includes("eve.vote") &&
        !url.pathname.includes("eve.votes"),
      (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: "{}",
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

    const votesRoute = (url: URL) => url.pathname.includes("eve.votes");
    await page.route(votesRoute, (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: "{}",
      })
    );
    await page.reload();
    const retry = page.getByRole("button", { name: "Retry loading feedback" });
    await expect(retry).toBeVisible();
    await page.locator(".is-assistant").screenshot({
      path: testInfo.outputPath("feedback-load-error.png"),
      animations: "disabled",
    });
    await page.unroute(votesRoute);
    await retry.click();
    await expect(down).toHaveAttribute("aria-pressed", "true");

    // A focus refetch starts during a save and returns the previous vote last.
    const mutationStarted = Promise.withResolvers<void>();
    const resumeMutation = Promise.withResolvers<void>();
    const staleReadStarted = Promise.withResolvers<void>();
    const releaseStaleRead = Promise.withResolvers<void>();
    const staleReadFinished = Promise.withResolvers<void>();
    const mutationRoute = (url: URL) =>
      url.pathname.includes("eve.vote") && !url.pathname.includes("eve.votes");
    await page.route(
      mutationRoute,
      async (route) => {
        mutationStarted.resolve();
        await resumeMutation.promise;
        await route.continue();
      },
      { times: 1 }
    );
    await page.route(
      votesRoute,
      async (route) => {
        const response = await route.fetch();
        staleReadStarted.resolve();
        await releaseStaleRead.promise;
        try {
          await route.fulfill({ response });
        } finally {
          staleReadFinished.resolve();
        }
      },
      { times: 1 }
    );
    try {
      await up.click();
      await mutationStarted.promise;
      await page.clock.setFixedTime(new Date(Date.now() + 120_000));
      await page.evaluate(() =>
        window.dispatchEvent(new Event("visibilitychange"))
      );
      await staleReadStarted.promise;
      resumeMutation.resolve();
      await expect(up).toHaveAttribute("aria-pressed", "true");
      releaseStaleRead.resolve();
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
      resumeMutation.resolve();
      releaseStaleRead.resolve();
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
      path: testInfo.outputPath("feedback-shared.png"),
      animations: "disabled",
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
    content: readFileSync(bundle, "utf8"),
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
    await page.setViewportSize({ width, height: 850 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: testInfo.outputPath(`feedback-states-${width}.png`),
      animations: "disabled",
      fullPage: true,
    });
  }
});
