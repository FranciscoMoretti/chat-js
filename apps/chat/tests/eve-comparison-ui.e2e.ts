import { expect, test } from "@playwright/test";
import type { Page, Response, TestInfo } from "@playwright/test";

import { conversationBinding } from "@/lib/eve/contracts";
import type { EveResponseGroupResult } from "@/chatjs/plugins/parallel-responses/response-group-contracts";
import {
  comparisonResult,
  requestBoundComparison,
} from "./eve-bound-comparison";

const nano = /GPT-5 Nano/iu;

const selectTwoReplies = async (page: Page) => {
  await page.getByTestId("model-selector").click();
  await page.getByRole("switch", { name: "Use Multiple Models" }).check();
  await page.getByRole("button", { name: /^1× /u }).click();
  await page.getByRole("menuitem", { name: "2x", exact: true }).click();
  await expect(page.getByRole("button", { name: /^2× /u })).toBeVisible();
  await page.keyboard.press("Escape");
};

test("nested comparisons retain both groups, duplicate-model slots and retry attempts under one chat URL", async ({
  page,
}, testInfo: Readonly<Pick<TestInfo, "outputPath">>) => {
  test.setTimeout(240_000);
  await page.route("https://unpkg.com/react-scan/**", async (route) => {
    await route.abort();
  });
  await page.goto("/api/dev-login");
  const { origin } = new URL(page.url());
  const group = await requestBoundComparison(page.request, origin, {
    message: "Do not use tools. Reply with exactly amber.",
    modelIds: ["openai/gpt-5-nano", "openai/gpt-5-nano"],
    operationId: crypto.randomUUID(),
  });
  const [first] = group.candidates;
  if (first.state !== "bound") {
    throw new Error("First candidate did not bind");
  }
  await page.goto(`/chat/${first.branchId}`);
  const cards = page.getByRole("log").getByRole("button", { name: nano });
  await expect(cards).toHaveCount(2);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  const url = page.url();
  const composer = page.getByRole("group", {
    exact: true,
    name: "Message composer",
  });
  await composer
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill("Keep my unsent draft");
  await cards.first().click();
  await cards.last().click();
  expect(page.url()).toBe(url);
  await expect(
    composer.getByRole("textbox", { exact: true, name: "Message" })
  ).toHaveValue("Keep my unsent draft");
  await cards.first().click();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  await requestBoundComparison(page.request, origin, {
    fork: { branchId: first.branchId },
    message: "Do not use tools. Reply with exactly cobalt.",
    modelIds: ["openai/gpt-5-nano", "openai/gpt-5-nano"],
    operationId: crypto.randomUUID(),
  });
  await page.reload();
  await expect(cards).toHaveCount(4, { timeout: 90_000 });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByRole("log")).toContainText("exactly cobalt");
  expect(page.url()).toBe(url);
  await composer
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill("");
  const retry = page.waitForResponse(
    (value: Readonly<Pick<Response, "url" | "request">>) =>
      value.url().endsWith("/api/agent-conversations") &&
      value.request().method() === "POST"
  );
  await page
    .getByRole("button", {
      exact: true,
      name: "Regenerate response",
    })
    .last()
    .click();
  const retryResponse = await retry;
  expect(retryResponse.ok()).toBe(true);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  await expect(cards).toHaveCount(4);
  expect(page.url()).toBe(url);
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("nested-comparisons.png"),
  });
  await page
    .getByRole("button", {
      exact: true,
      name: "Edit message",
    })
    .last()
    .click();
  const editor = page
    .getByRole("log")
    .getByRole("group", { exact: true, name: "Message composer" });
  await editor
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill("Do not use tools. Reply with exactly jade.");
  const editedGroup = page.waitForResponse(
    (value: Readonly<Pick<Response, "url" | "request">>) =>
      value.url().endsWith("/api/trpc/parallelResponses.submit") &&
      value.request().method() === "POST"
  );
  await editor.getByRole("button", { exact: true, name: "Send" }).click();
  const edited = await editedGroup;
  expect(edited.ok(), await edited.text()).toBe(true);
  expect(
    comparisonResult.parse(await edited.json()).result.data.json.candidates
  ).toHaveLength(2);
  await expect(page.getByRole("log")).toContainText("exactly jade");
  await expect(cards).toHaveCount(4);
  expect(page.url()).toBe(url);
});

test("new-chat recovery survives an ambiguous reply and reload without a new operation", async ({
  page,
}, testInfo: Readonly<Pick<TestInfo, "outputPath">>) => {
  await page.route("https://unpkg.com/react-scan/**", async (route) => {
    await route.abort();
  });
  await page.goto("/api/dev-login");
  await page.goto("/");
  const submissions: unknown[] = [];
  await page.route("**/api/agent-conversations", async (route) => {
    submissions.push(route.request().postDataJSON());
    await route.fulfill({
      json: { error: "Temporary transport failure" },
      status: 503,
    });
  });
  await page
    .getByLabel("Message", { exact: true })
    .fill("Keep this exact request");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(
    page.getByRole("button", { name: "Retry creation" })
  ).toBeEnabled();
  expect(submissions).toHaveLength(1);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Retry creation" })
  ).toBeEnabled();
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("new-chat-recovery.png"),
  });
  await page.getByRole("button", { name: "Retry creation" }).click();
  await expect.poll(() => submissions.length).toBe(2);
  expect(submissions[1]).toEqual(submissions[0]);
  await expect(
    page.getByRole("button", { name: "Retry creation" })
  ).toBeEnabled();
});

test("refresh during a duplicate-model submission recovers the same operation and edit count", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("/api/dev-login");
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true })
  ).toBeHidden();
  await selectTwoReplies(page);
  const requests: string[] = [];
  const sessions = new Map<string, string>();
  const admitted = Promise.withResolvers<EveResponseGroupResult>();
  const recovered = Promise.withResolvers<EveResponseGroupResult>();
  const reloaded = Promise.withResolvers<boolean>();
  await page.route("**/api/trpc/parallelResponses.submit", async (route) => {
    const body = route.request().postData();
    if (body === null) {
      throw new Error("Missing comparison request");
    }
    requests.push(body);
    const initial = requests.length === 1;
    const result = await route.fetch();
    expect(result.ok(), await result.text()).toBe(true);
    const group = comparisonResult.parse(await result.json()).result.data.json;
    for (const candidate of group.candidates) {
      if (candidate.state === "bound") {
        sessions.set(candidate.operationId, candidate.sessionId);
      }
    }
    if (!initial) {
      await route.fulfill({ response: result });
      recovered.resolve(group);
      return;
    }
    admitted.resolve(group);
    await reloaded.promise;
    await route.abort();
  });
  try {
    await page
      .getByRole("textbox", { name: "Message", exact: true })
      .fill("Answer with one short sentence.");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(
      page.getByTestId("optimistic-response-group").getByRole("button")
    ).toHaveCount(2);
    await admitted.promise;
    await page.reload();
  } finally {
    reloaded.resolve(true);
  }
  await page.getByRole("button", { name: "Retry creation" }).click();
  const firstGroup = await admitted.promise;
  const recoveredGroup = await recovered.promise;
  expect(firstGroup.candidates).toHaveLength(2);
  expect(recoveredGroup.id).toBe(firstGroup.id);
  expect(
    recoveredGroup.candidates.map((candidate) => candidate.operationId)
  ).toEqual(firstGroup.candidates.map((candidate) => candidate.operationId));
  await expect.poll(() => requests.length).toBeGreaterThanOrEqual(2);
  expect(requests[1]).toBe(requests[0]);
  const log = page.getByRole("log");
  const choices = log.locator('[data-role="user"] button[aria-pressed]');
  await expect(choices).toHaveCount(2);
  const answer = log
    .locator('[data-role="assistant"]')
    .last()
    .getByRole("paragraph")
    .first();
  await expect(answer).toBeVisible({ timeout: 90_000 });
  await choices.last().click();
  await expect(choices.last()).toHaveAttribute("aria-pressed", "true");
  await expect(answer).toHaveText(/\S/u);
  const [, second] = firstGroup.candidates;
  await expect.poll(() => sessions.has(second.operationId)).toBe(true);
  const followUp = "Continue only the second reply.";
  const sends: string[] = [];
  const comparisonSubmissions = requests.length;
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (
      request.method() === "POST" &&
      request.headers()["x-chatjs-message-operation"]
    ) {
      sends.push(path.split("/").at(-1) ?? "");
    }
  });
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill(followUp);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(log.getByText(followUp, { exact: true })).toBeVisible();
  await expect(log.locator('[data-role="assistant"]')).toHaveCount(2);
  await expect(answer).toHaveText(/\S/u);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  expect(sends).toEqual([sessions.get(second.operationId)]);
  expect(requests).toHaveLength(comparisonSubmissions);
  await choices.first().click();
  await expect(choices.first()).toHaveAttribute("aria-pressed", "true");
  await expect(log.getByText(followUp, { exact: true })).toBeHidden();
  await expect(answer).toHaveText(/\S/u);
  await log
    .getByRole("button", { name: "Edit message", exact: true })
    .first()
    .click();
  await log.getByTestId("model-selector").click();
  await expect(page.getByRole("option", { selected: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^2× /u })).toBeVisible();
});

test("requesting two replies from an existing conversation forks the selected branch", async ({
  page,
}) => {
  await page.goto("/api/dev-login");
  await page.goto("/");
  const message = page.getByRole("textbox", { name: "Message", exact: true });
  const send = page.getByRole("button", { name: "Send", exact: true });
  const log = page.getByRole("log");
  const created = page.waitForResponse("**/api/agent-conversations");
  await message.fill("Start with one reply.");
  await send.click();
  const creation = await created;
  const source = conversationBinding.parse(await creation.json());
  await expect(log.locator('[data-role="assistant"] p').first()).toBeVisible();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  const url = page.url();
  await selectTwoReplies(page);
  const comparison = page.waitForRequest(
    "**/api/trpc/parallelResponses.submit"
  );
  await message.fill("Give me two versions.");
  await send.click();
  const submission = await comparison;
  expect(submission.postDataJSON()).toMatchObject({
    json: { fork: { branchId: source.id } },
  });
  await expect(
    log.locator('[data-role="user"] button[aria-pressed]')
  ).toHaveCount(2);
  await expect(
    log.getByText("Give me two versions.", { exact: true })
  ).toHaveCount(1);
  await expect(page).toHaveURL(url);
});
