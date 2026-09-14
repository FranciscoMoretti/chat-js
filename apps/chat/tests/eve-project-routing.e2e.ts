import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../lib/db/client";
import { eveChat, eveConversation, project } from "../lib/db/schema";
import { insertEveConversationFixtures } from "./eve-conversation-fixture";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

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
