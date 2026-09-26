/* oxlint-disable unicorn/no-await-expression-member -- Direct awaited assertions keep each test action tied to its expectation. */
import { expect, test } from "@playwright/test";
import { eq, sql } from "drizzle-orm";
import { Client } from "eve/client";
import { z } from "zod";

import { db } from "../lib/db/client";
import { eveConversation, userCredit } from "../lib/db/schema";
import { env } from "../lib/env";
import { getEveConnectionOptions } from "../lib/eve/connection-options";
import { evePlatformResult } from "../lib/eve/platform-result";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);
const createdReport = /^Created "/u;
test("native deep research saves a reloadable report in ChatJS with a usage receipt", async ({
  page,
}) => {
  test.setTimeout(360_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const session = z
    .object({ user: z.object({ id: z.string() }) })
    .parse(await (await page.request.get("/api/auth/get-session")).json());
  await db
    .insert(userCredit)
    .values({ credits: 1000, userId: session.user.id })
    .onConflictDoUpdate({
      set: { credits: sql`greatest(${userCredit.credits}, 1000)` },
      target: userCredit.userId,
    });
  const created = await page.request.post("/api/agent-conversations", {
    data: {
      message:
        "Call deepResearch exactly once. Research the purpose of the HTML dialog element and its accessibility behavior, using the current MDN documentation as the primary source. Audience: web developers. Scope: a short report under 300 words with citations, no historical comparison. All requirements are specified; no clarification is needed. Do not call any other tools yourself.",
      modelId: "openai/gpt-4.1-mini-fast",
      operationId: crypto.randomUUID(),
    },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const binding = z
    .object({ id: z.uuid(), sessionId: z.string() })
    .parse(await created.json());
  await page.goto(`/chat/${binding.id}`);
  const report = page.getByRole("button", { name: createdReport }).first();
  await expect(report).toBeVisible({ timeout: 300_000 });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  const title = await report.textContent();
  await page.reload();
  await expect(report).toHaveText(title ?? "");
  await report.click();
  const panel = page.getByTestId("artifact");
  await expect(panel).toContainText("showModal");
  await expect(panel).toContainText("https://developer.mozilla.org/");
  await expect(panel).toContainText("Version 1 of 1");
  await panel.screenshot({
    animations: "disabled",
    path: "tests/eve-results/screenshots/eve-native-research.png",
  });
  const [conversation] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, binding.id));
  const client = new Client(getEveConnectionOptions(conversation.ownerId));
  const snapshot = await client.sessions
    .attach(binding.sessionId)
    .snapshot({ signal: AbortSignal.timeout(15_000) });
  const results = snapshot.events.filter(
    (event) =>
      event.type === "action.result" &&
      event.data.result.kind === "tool-result" &&
      event.data.result.toolName === "deepResearch"
  );
  expect(results).toHaveLength(1);
  const [result] = results;
  if (
    result.type !== "action.result" ||
    result.data.result.kind !== "tool-result"
  ) {
    throw new Error("Missing research result");
  }
  const receipt = evePlatformResult.parse(result.data.result.output);
  expect(receipt.output).toMatchObject({
    format: "report",
    revisionId: expect.any(String),
    status: "success",
  });
  expect(receipt.usage.costUsd).toBeGreaterThan(0);
  expect(receipt.updates?.some((update) => update.type === "web")).toBe(true);
});
