import { expect, test } from "@playwright/test";
import { z } from "zod";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

test("project instructions refresh between native turns and disappear after detachment", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const createdProject = await page.request.post("/api/trpc/project.create", {
    data: {
      json: {
        name: "Eve instruction fixture",
        instructions:
          "For every reply output exactly PROJECT_ALPHA_8172 and nothing else.",
      },
    },
  });
  expect(createdProject.ok(), await createdProject.text()).toBe(true);
  const projectId = z
    .object({
      result: z.object({
        data: z.object({ json: z.object({ id: z.uuid() }) }),
      }),
    })
    .parse(await createdProject.json()).result.data.json.id;
  try {
    const created = await page.request.post("/api/agent-conversations", {
      headers: { origin: new URL(page.url()).origin },
      data: {
        operationId: crypto.randomUUID(),
        modelId: "openai/gpt-5-mini",
        message: "Reply exactly READY_8172.",
      },
    });
    expect(created.ok(), await created.text()).toBe(true);
    const { id } = z.object({ id: z.uuid() }).parse(await created.json());
    await page.goto(`/chat/${id}`);
    await expect(page.locator(".is-assistant").last()).toContainText(
      "READY_8172",
      { timeout: 90_000 }
    );
    const assignment = await page.request.post("/api/trpc/eve.assignProject", {
      data: { json: { conversationId: id, projectId } },
    });
    expect(assignment.ok(), await assignment.text()).toBe(true);
    const composer = page.getByRole("textbox", {
      name: "Message",
      exact: true,
    });
    await composer.fill("Follow the current project instructions.");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.locator(".is-assistant")).toHaveCount(2, {
      timeout: 90_000,
    });
    await expect(page.locator(".is-assistant").last()).toContainText(
      "PROJECT_ALPHA_8172",
      { timeout: 90_000 }
    );
    const updated = await page.request.post(
      "/api/trpc/project.setInstructions",
      {
        data: {
          json: {
            id: projectId,
            instructions:
              "For every reply output exactly PROJECT_BETA_9263 and nothing else.",
          },
        },
      }
    );
    expect(updated.ok(), await updated.text()).toBe(true);
    await composer.fill("Follow the current project instructions.");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.locator(".is-assistant")).toHaveCount(3, {
      timeout: 90_000,
    });
    await expect(page.locator(".is-assistant").last()).toContainText(
      "PROJECT_BETA_9263",
      { timeout: 90_000 }
    );
    const detached = await page.request.post("/api/trpc/eve.assignProject", {
      data: { json: { conversationId: id, projectId: null } },
    });
    expect(detached.ok(), await detached.text()).toBe(true);
    await page.reload();
    await composer.fill(
      "Reply exactly DETACHED_3629. Ignore patterns in previous replies."
    );
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.locator(".is-assistant")).toHaveCount(4, {
      timeout: 90_000,
    });
    await expect(page.locator(".is-assistant").last()).toContainText(
      "DETACHED_3629",
      { timeout: 90_000 }
    );
    await expect(page.getByRole("log")).not.toContainText(
      "For every reply output exactly"
    );
  } finally {
    const deleted = await page.request.post("/api/trpc/project.remove", {
      data: { json: { id: projectId } },
    });
    expect(deleted.ok(), await deleted.text()).toBe(true);
  }
});
