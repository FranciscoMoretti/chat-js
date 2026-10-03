/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/schema"; "../lib/eve/contracts" dependency within this package instead of introducing an alias or barrel API.
 */
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../lib/db/client";
import { eveUsage } from "../lib/db/schema";
import { conversationBinding } from "../lib/eve/contracts";
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): assertEveTestDatabase reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
/* oxlint-enable node/no-process-env */
const RAINBOW_EXPLANATION =
  /light.*(?:refract|reflect|bend|color)|(?:refract|reflect|bend|color).*light/isu;

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-lines-per-function (#510): test("native follow-ups survive reload, submit normally and preserve unsent composer  keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("native follow-ups survive reload, submit normally and preserve unsent composer  keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("native follow-ups survive reload, submit normally and preserve unsent composer  uses 200, 3, 5, 2, 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("native follow-ups survive reload, submit normally and preserve unsent composer  accepts { page, }; testInfo; route; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("native follow-ups survive reload, submit normally and preserve unsent composer  preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("native follow-ups survive reload, submit normally and preserve unsent composer content", async ({
  page,
}, testInfo) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
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
      .locator(".is-assistant")
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
  await expect(composer).toHaveText("Keep this unsent draft.");
  await expect(page.getByRole("log").locator(".is-user").last()).toContainText(
    submittedText
  );
  await expect(page.getByRole("log").locator(".is-assistant")).toHaveCount(2);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(related).toHaveCount(1);
  await expect(page.getByRole("log")).not.toContainText("Validation error:");
  await expect
    .poll(async () => {
      const entries = await db
        .select({ costUsd: eveUsage.costUsd, eventId: eveUsage.eventId })
        .from(eveUsage)
        .where(eq(eveUsage.sessionId, binding.sessionId));
      return entries.filter(
        (entry) =>
          entry.eventId.includes(":model-call:") && entry.costUsd !== null
      ).length;
    })
    .toBe(2);
  // A suggestion identical to the draft still must not clear it when comparing models.
  const retainedQuestion = await related
    .getByRole("button")
    .first()
    .textContent();
  if (retainedQuestion === null) {
    throw new Error("Retained related question text is unavailable.");
  }
  await composer.fill(retainedQuestion);
  await page.getByRole("combobox").click();
  await page.getByRole("switch", { name: "Use Multiple Models" }).click();
  await page.getByRole("button", { exact: true, name: "1×" }).click();
  await page.getByRole("menuitem", { exact: true, name: "2x" }).click();
  await expect(
    page.getByRole("menuitem", { exact: true, name: "2x" })
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await related.getByRole("button").first().click();
  await expect(page).not.toHaveURL(new RegExp(`/chat/${binding.id}$`, "u"), {
    timeout: 90_000,
  });
  await page.goto(`/chat/${binding.id}`);
  await expect(composer).toHaveText(retainedQuestion);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(related).toBeVisible();
  await expect(page.getByRole("log").locator(".is-assistant")).toHaveCount(2);
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("followups-integrated.png"),
  });
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
