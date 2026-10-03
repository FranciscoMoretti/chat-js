/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/schema" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../lib/db/client";
import { eveChat, eveConversation, project } from "../lib/db/schema";
import { insertEveConversationFixtures } from "./eve-conversation-fixture";
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): assertEveTestDatabase reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
/* oxlint-enable node/no-process-env */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/max-nested-calls, unicorn/no-null  --
 * max-lines-per-function (#510): test("assigned Eve conversations resolve through project URLs and remain accessible a keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("assigned Eve conversations resolve through project URLs and remain accessible a keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("assigned Eve conversations resolve through project URLs and remain accessible a uses 401 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("assigned Eve conversations resolve through project URLs and remain accessible a sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test("assigned Eve conversations resolve through project URLs and remain accessible a accepts { page, browser, }; testInfo; route; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("assigned Eve conversations resolve through project URLs and remain accessible a preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): test("assigned Eve conversations resolve through project URLs and remain accessible a intentionally keeps the existing falsy-value behavior of root; chat; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/max-nested-calls (#568): test("assigned Eve conversations resolve through project URLs and remain accessible a keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * unicorn/no-null (#570): test("assigned Eve conversations resolve through project URLs and remain accessible a preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
test("assigned Eve conversations resolve through project URLs and remain accessible after project deletion", async ({
  page,
  browser,
}, testInfo) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const createdProject = await page.request.post("/api/trpc/project.create", {
    data: { json: { name: "Eve routing fixture" } },
  });
  expect(createdProject.ok(), await createdProject.text()).toBe(true);
  const result = z
    .object({
      result: z.object({
        data: z.object({ json: z.object({ id: z.uuid() }) }),
      }),
    })
    .parse(await createdProject.json());
  const projectId = result.result.data.json.id;
  const anonymous = await browser.newContext();
  const pendingId = crypto.randomUUID();
  try {
    const created = await page.request.post("/api/agent-conversations", {
      data: {
        message: "Reply exactly project-route-fixture-ok",
        modelId: "openai/gpt-5-mini",
        operationId: crypto.randomUUID(),
      },
      headers: { origin: new URL(page.url()).origin },
    });
    expect(created.ok(), await created.text()).toBe(true);
    const binding = z.object({ id: z.uuid() }).parse(await created.json());
    const assignment = await page.request.post("/api/trpc/eve.assignProject", {
      data: { json: { conversationId: binding.id, projectId } },
    });
    expect(assignment.ok(), await assignment.text()).toBe(true);
    const forbidden = await anonymous.request.post(
      `${new URL(page.url()).origin}/api/trpc/eve.assignProject`,
      { data: { json: { conversationId: binding.id, projectId: null } } }
    );
    expect(forbidden.status()).toBe(401);
    await page.goto(`/project/${projectId}/chat/${binding.id}`);
    await expect(page).toHaveURL(new RegExp(`/chat/${binding.id}$`, "u"));
    await expect(page.locator(".is-assistant")).toContainText(
      "project-route-fixture-ok",
      { timeout: 90_000 }
    );
    await page.locator('[role="log"]').screenshot({
      animations: "disabled",
      path: testInfo.outputPath("project-conversation.png"),
    });
    await page.goto(`/project/${crypto.randomUUID()}/chat/${binding.id}`);
    await expect(
      page.getByRole("heading", { exact: true, name: "404" })
    ).toBeVisible();
    const [root] = await db
      .select()
      .from(eveConversation)
      .where(eq(eveConversation.id, binding.id));
    if (!root) {
      throw new Error("Missing project conversation");
    }
    await insertEveConversationFixtures({
      firstMessage: "Uncertain fork fixture",
      forkTurnId: "turn_0",
      id: pendingId,
      operationId: crypto.randomUUID(),
      ownerId: root.ownerId,
      parentConversationId: root.id,
      rootConversationId: root.id,
      state: "uncertain",
    });
    await page.goto(`/project/${projectId}/chat/${pendingId}`);
    await expect(page).toHaveURL(new RegExp(`/chat/${pendingId}$`, "u"));
    const recovery = page.getByRole("region", {
      name: "Conversation recovery",
    });
    await expect(recovery).toBeVisible();
    await expect(recovery).toContainText(
      "This browser does not have the original request."
    );
    await recovery.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("project-creation-recovery.png"),
    });
    const removed = await page.request.post("/api/trpc/project.remove", {
      data: { json: { id: projectId } },
    });
    expect(removed.ok(), await removed.text()).toBe(true);
    await page.goto(`/chat/${binding.id}`);
    await expect(page.locator(".is-assistant")).toContainText(
      "project-route-fixture-ok"
    );
    const [chat] = await db
      .select({ title: eveChat.title })
      .from(eveChat)
      .where(eq(eveChat.id, root.chatId));
    if (!chat) {
      throw new Error("Missing project chat title");
    }
    const query = await page.request.get(
      `/api/trpc/eve.list?input=${encodeURIComponent(JSON.stringify({ json: { projectId: null, search: chat.title } }))}`
    );
    expect(query.ok(), await query.text()).toBe(true);
    expect(await query.text()).toContain(binding.id);
  } finally {
    await anonymous.close();
    await db.delete(eveConversation).where(eq(eveConversation.id, pendingId));
    await db.delete(project).where(eq(project.id, projectId));
  }
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/max-nested-calls, unicorn/no-null */
