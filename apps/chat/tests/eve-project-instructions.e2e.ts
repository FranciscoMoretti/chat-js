import { expect, test } from "@playwright/test";
import { z } from "zod";

import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

// The deterministic instruction slot assertions live in lib/eve/project-instructions.test.ts.
test("a native chat completes turns after project instructions change and after detachment", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", async (route) => {
    await route.abort();
  });
  await page.goto("/api/dev-login");
  const createdProject = await page.request.post("/api/trpc/project.create", {
    data: {
      json: {
        instructions: "Use the example about invoices when it is relevant.",
        name: "Eve instruction fixture",
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
      data: {
        message: "Follow the current project instructions.",
        modelId: "openai/gpt-5-nano",
        operationId: crypto.randomUUID(),
        projectId,
      },
      headers: { origin: new URL(page.url()).origin },
    });
    expect(created.ok(), await created.text()).toBe(true);
    const { id } = z.object({ id: z.uuid() }).parse(await created.json());
    await page.goto(`/chat/${id}`);
    await expect(
      page.locator('[data-eve-message-id="turn_0:assistant"]')
    ).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const composer = page.getByRole("textbox", {
      exact: true,
      name: "Message",
    });
    const updated = await page.request.post(
      "/api/trpc/project.setInstructions",
      {
        data: {
          json: {
            id: projectId,
            instructions:
              "Use the example about spreadsheets when it is relevant.",
          },
        },
      }
    );
    expect(updated.ok(), await updated.text()).toBe(true);
    await composer.fill("Give a brief example related to my project.");
    await page.getByRole("button", { exact: true, name: "Send" }).click();
    await expect(
      page.locator('[data-eve-message-id="turn_1:assistant"]')
    ).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const detached = await page.request.post("/api/trpc/project.assign", {
      data: { json: { id, projectId: null } },
    });
    expect(detached.ok(), await detached.text()).toBe(true);
    await page.reload();
    await composer.fill(
      "Give a short general example without using any tools."
    );
    await page.getByRole("button", { exact: true, name: "Send" }).click();
    await expect(
      page.locator('[data-eve-message-id="turn_2:assistant"]')
    ).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  } finally {
    const deleted = await page.request.post("/api/trpc/project.remove", {
      data: { json: { id: projectId } },
    });
    expect(deleted.ok(), await deleted.text()).toBe(true);
  }
});
