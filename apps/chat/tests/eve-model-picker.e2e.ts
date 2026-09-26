/* oxlint-disable unicorn/no-await-expression-member -- Direct awaited assertions keep each test action tied to its expectation. */
import { expect, test } from "@playwright/test";
import { eq, sql } from "drizzle-orm";
import { Client } from "eve/client";
import { z } from "zod";

import { db } from "../lib/db/client";
import { eveConversation, userCredit } from "../lib/db/schema";
import { env } from "../lib/env";
import { getEveConnectionOptions } from "../lib/eve/connection-options";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);

test.use({ trace: "retain-on-failure" });

const conversationUrl = /\/chat\/[0-9a-f-]+$/u;
const modelId = "openai/gpt-5-nano";
const modelName = "GPT-5 nano";

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
    const { user } = z
      .object({ user: z.object({ id: z.string() }) })
      .parse(await (await page.request.get("/api/auth/get-session")).json());
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
    expect(conversation?.initialModelId).toBe(modelId);
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
          async () =>
            [200, 404].includes(
              (
                await page.request.delete(url, {
                  headers,
                  timeout: 15_000,
                })
              ).status()
            ),
          { intervals: [1000, 2000, 5000], timeout: 60_000 }
        )
        .toBe(true);
    }
  }
});
