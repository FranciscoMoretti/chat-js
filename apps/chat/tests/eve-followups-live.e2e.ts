import { expect, test } from "@playwright/test";
import type { TestInfo } from "@playwright/test";
import { z } from "zod";
import { config } from "../lib/config";
import { eq } from "drizzle-orm";

import { db } from "../lib/db/client";
import { eveUsage } from "../lib/db/schema";
import { conversationBinding } from "../lib/eve/contracts";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
const RAINBOW_EXPLANATION =
  /light.*(?:refract|reflect|bend|color)|(?:refract|reflect|bend|color).*light/isu;

test("native follow-ups survive reload, submit normally and preserve unsent composer content", async ({
  page,
}, testInfo: Readonly<Pick<TestInfo, "outputPath">>) => {
  await page.route("https://unpkg.com/react-scan/**", async (route) => {
    await route.abort();
  });
  await page.goto("/api/dev-login");
  const { origin } = new URL(page.url());
  await page.request.post("/api/chat-model", {
    data: { model: "openai/gpt-5-nano" },
  });
  const response = await page.request.post("/api/agent-conversations", {
    data: {
      message: "Explain in one sentence why rainbows appear.",
      modelId: "openai/gpt-5-nano",
      operationId: crypto.randomUUID(),
    },
    headers: { origin },
  });
  expect(response.status()).toBe(200);
  const binding = conversationBinding.parse(await response.json());
  await page.goto(`/chat/${binding.id}`);
  const related = page.getByRole("group", {
    exact: true,
    name: "Related questions",
  });
  await expect(related).toBeVisible({ timeout: 60_000 });
  await expect(
    page
      .getByRole("log")
      .locator('[data-role="assistant"]')
      .first()
      .locator(":scope > div")
      .first()
  ).toContainText(RAINBOW_EXPLANATION);
  const questions = await related.getByRole("button").allTextContents();
  expect(questions.length).toBeGreaterThanOrEqual(3);
  expect(questions.length).toBeLessThanOrEqual(5);
  await page.reload();
  await expect(related.getByRole("button")).toHaveText(questions);
  const composer = page.getByRole("textbox", { exact: true, name: "Message" });
  await composer.fill("Keep this unsent draft.");
  const nextQuestion = related.getByRole("button").first();
  const submittedText = await nextQuestion.textContent();
  if (submittedText === null) {
    throw new Error("Related question text is unavailable.");
  }
  await nextQuestion.click();
  await expect(composer).toHaveValue("Keep this unsent draft.");
  await expect(
    page.getByRole("log").locator('[data-role="user"]').last()
  ).toContainText(submittedText);
  await expect(
    page.getByRole("log").locator('[data-role="assistant"]')
  ).toHaveCount(2);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(related).toHaveCount(1);
  await expect(page.getByRole("log")).not.toContainText("Validation error:");
  await expect
    .poll(async () => {
      const entries = await db
        .select({
          costUsd: eveUsage.costUsd,
          attempt: eveUsage.modelAttempt,
          turn: eveUsage.turnId,
        })
        .from(eveUsage)
        .where(eq(eveUsage.sessionId, binding.sessionId));
      const followupAttempt = z.object({
        modelId: z.literal(config.ai.tools.followupSuggestions.default),
        state: z.literal("returned"),
        sessionId: z.literal(binding.sessionId),
      });
      return entries
        .filter(
          (entry) =>
            entry.costUsd !== null &&
            followupAttempt.safeParse(entry.attempt).success
        )
        .map((entry) => entry.turn)
        .toSorted();
    })
    .toEqual(["turn_0", "turn_1"]);
  // A suggestion identical to the draft still must not clear it when comparing models.
  const retainedQuestion = await related
    .getByRole("button")
    .first()
    .textContent();
  if (retainedQuestion === null) {
    throw new Error("Retained related question text is unavailable.");
  }
  await composer.fill(retainedQuestion);
  await page.getByTestId("model-selector").filter({ visible: true }).click();
  await page.getByRole("switch", { name: "Use Multiple Models" }).click();
  await page.getByRole("button", { name: /^1× /u }).click();
  await page.getByRole("menuitem", { exact: true, name: "2x" }).click();
  await expect(
    page.getByRole("menuitem", { exact: true, name: "2x" })
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const logicalUrl = page.url();
  const compared = page.waitForResponse(
    (reply) =>
      reply.request().method() === "POST" &&
      new URL(reply.url()).pathname === "/api/agent-response-groups"
  );
  await related.getByRole("button").first().click();
  const comparison = await compared;
  expect(comparison.ok(), await comparison.text()).toBe(true);
  expect(comparison.request().postDataJSON()).toMatchObject({
    fork: { branchId: binding.id },
    message: retainedQuestion,
    modelIds: ["openai/gpt-5-nano", "openai/gpt-5-nano"],
  });
  await expect(page).toHaveURL(logicalUrl);
  await expect(composer).toHaveValue(retainedQuestion);
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("followups-integrated.png"),
  });
});
