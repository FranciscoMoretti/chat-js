import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../lib/db/client";
import {
  eveConversation,
  eveConversationProject,
  project,
} from "../lib/db/schema";
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
      headers: { origin: new URL(page.url()).origin },
      data: {
        operationId: crypto.randomUUID(),
        modelId: "openai/gpt-5-mini",
        message: "Reply exactly project-route-fixture-ok",
      },
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
    await expect(page).toHaveURL(new RegExp(`/chat/${binding.id}$`));
    await expect(page.locator(".is-assistant")).toContainText(
      "project-route-fixture-ok",
      { timeout: 90_000 }
    );
    await page.locator('[role="log"]').screenshot({
      path: testInfo.outputPath("project-conversation.png"),
      animations: "disabled",
    });
    await page.goto(`/project/${crypto.randomUUID()}/chat/${binding.id}`);
    await expect(
      page.getByRole("heading", { name: "404", exact: true })
    ).toBeVisible();
    const [root] = await db
      .select()
      .from(eveConversation)
      .where(eq(eveConversation.id, binding.id));
    if (!root) {
      throw new Error("Missing project conversation");
    }
    await db.insert(eveConversation).values({
      id: pendingId,
      ownerId: root.ownerId,
      operationId: crypto.randomUUID(),
      firstMessage: "Uncertain fork fixture",
      state: "uncertain",
      parentConversationId: root.id,
      rootConversationId: root.id,
      forkTurnId: "turn_0",
    });
    await db
      .insert(eveConversationProject)
      .values({ conversationId: pendingId, ownerId: root.ownerId, projectId });
    await page.goto(`/project/${projectId}/chat/${pendingId}`);
    await expect(page).toHaveURL(new RegExp(`/chat/${pendingId}$`));
    const recovery = page
      .getByRole("alert")
      .filter({ hasText: "Creation is unresolved." });
    await expect(recovery).toBeVisible();
    await recovery.screenshot({
      path: testInfo.outputPath("project-creation-recovery.png"),
      animations: "disabled",
    });
    const removed = await page.request.post("/api/trpc/project.remove", {
      data: { json: { id: projectId } },
    });
    expect(removed.ok(), await removed.text()).toBe(true);
    await page.goto(`/chat/${binding.id}`);
    await expect(page.locator(".is-assistant")).toContainText(
      "project-route-fixture-ok"
    );
    const query = await page.request.get(
      `/api/trpc/eve.list?input=${encodeURIComponent(JSON.stringify({ json: { projectId: null, search: "project-route-fixture-ok" } }))}`
    );
    expect(query.ok(), await query.text()).toBe(true);
    expect(await query.text()).toContain(binding.id);
  } finally {
    await anonymous.close();
    await db.delete(eveConversation).where(eq(eveConversation.id, pendingId));
    await db.delete(project).where(eq(project.id, projectId));
  }
});
