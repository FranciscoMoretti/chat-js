/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/schema"; "../lib/env"; "../lib/eve/connection-options" dependency within this package instead of introducing an alias or barrel API.
 */
import { expect, test } from "@playwright/test";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eq, sql } from "drizzle-orm";
/* oxlint-enable sort-imports */
import { Client } from "eve/client";
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { db } from "../lib/db/client";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eveConversation, userCredit } from "../lib/db/schema";
/* oxlint-enable sort-imports */
import { env } from "../lib/env";
import { getEveConnectionOptions } from "../lib/eve/connection-options";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

assertEveTestDatabase(env.DATABASE_URL);

test.use({ trace: "retain-on-failure" });

const conversationUrl = /\/chat\/[0-9a-f-]+$/u;
const modelId = "openai/gpt-5-nano";
const modelName = "GPT-5 nano";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions --
 * init-declarations (#507): test("the single-model picker dispatches and retains the selected native model") assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): test("the single-model picker dispatches and retains the selected native model") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("the single-model picker dispatches and retains the selected native model") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("the single-model picker dispatches and retains the selected native model") uses 120_000, 0, 8, 200, -1, 60_000, 404, 1000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("the single-model picker dispatches and retains the selected native model") accepts { page, }; testInfo; route; event; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("the single-model picker dispatches and retains the selected native model") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): test("the single-model picker dispatches and retains the selected native model") intentionally keeps the existing falsy-value behavior of conversation?.sessionId; conversationId; origin; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
test("the single-model picker dispatches and retains the selected native model", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  let conversationId: string | undefined;
  let origin: string | undefined;
  try {
    await page.route("https://unpkg.com/react-scan/**", (route) =>
      route.abort()
    );
    await page.goto("/api/dev-login");
    ({ origin } = new URL(page.url()));
    const authSessionResponse = await page.request.get("/api/auth/get-session");
    const { user } = z
      .object({ user: z.object({ id: z.string() }) })
      .parse(await authSessionResponse.json());
    await db
      .insert(userCredit)
      .values({ credits: 1000, userId: user.id })
      .onConflictDoUpdate({
        set: { credits: sql`greatest(${userCredit.credits}, 1000)` },
        target: userCredit.userId,
      });
    await page.goto("/");

    const picker = page.getByTestId("model-selector").filter({ visible: true });
    await picker.click();
    await page.getByPlaceholder("Search models...").fill(modelName);
    await page
      .getByRole("option", { exact: true, name: "openai logo GPT-5 nano" })
      .filter({
        hasNot: page.getByTitle("Advanced reasoning capabilities", {
          exact: true,
        }),
      })
      .click({ timeout: 20_000 });
    await expect(picker).toContainText(modelName);

    const marker = `picker-${crypto.randomUUID().slice(0, 8)}`;
    await page
      .getByRole("textbox", { exact: true, name: "Message" })
      .fill(`Reply with exactly ${marker}. Do not call tools.`);
    const creation = page.waitForResponse("**/api/agent-conversations");
    await page.getByRole("button", { exact: true, name: "Send" }).click();
    const created = await creation;
    expect(created.status()).toBe(200);
    await page.waitForURL(conversationUrl, {
      timeout: 60_000,
      waitUntil: "commit",
    });
    conversationId = z
      .uuid()
      .parse(new URL(page.url()).pathname.split("/").at(-1));
    expect(created.request().postDataJSON()).toMatchObject({ modelId });

    const [conversation] = await db
      .select({
        initialModelId: eveConversation.initialModelId,
        sessionId: eveConversation.sessionId,
      })
      .from(eveConversation)
      .where(eq(eveConversation.id, conversationId));
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading initialModelId from conversation; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    expect(conversation?.initialModelId).toBe(modelId);
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading sessionId from conversation; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    if (!conversation?.sessionId) {
      throw new Error("Missing native session binding.");
    }

    await expect(page).toHaveURL(new RegExp(`/chat/${conversationId}$`, "u"));
    await expect(
      page.getByRole("log").locator(".is-assistant").last()
    ).toContainText(marker, { timeout: 90_000 });
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const client = new Client(getEveConnectionOptions(user.id));
    const snapshot = await client.sessions
      .attach(conversation.sessionId)
      .snapshot();
    const modelStep = snapshot.events.find(
      (event) => event.type === "step.started"
    );
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading data from modelStep; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    expect(modelStep?.data.modelId).toBe(`gateway/${modelId}`);
    await page.reload();
    await expect(picker).toContainText(modelName);
    await expect(
      page.getByRole("log").locator(".is-assistant").last()
    ).toContainText(marker);
  } finally {
    testInfo.setTimeout(testInfo.timeout + 60_000);
    if (conversationId && origin) {
      const url = `/api/agent-conversations/${conversationId}`;
      const headers = { origin };
      await expect
        .poll(
          async () => {
            const deletionResponse = await page.request.delete(url, {
              headers,
              timeout: 15_000,
            });
            return [200, 404].includes(deletionResponse.status());
          },
          { intervals: [1000, 2000, 5000], timeout: 60_000 }
        )
        .toBe(true);
    }
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions */
