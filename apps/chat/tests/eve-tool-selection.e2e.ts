import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { expect, test } from "@playwright/test";
import { z } from "zod";

import { conversationBinding } from "../lib/eve/contracts";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

test("compiled ChatJS tools exclude optional Eve defaults that bypass application policy", async () => {
  const pointer = z
    .object({ runtimeAppRoot: z.string() })
    .parse(JSON.parse(await readFile(".eve/dev-runtime/current.json", "utf8")));
  const manifest = z
    .object({
      tools: z.array(z.object({ name: z.string() })),
      dynamicTools: z.array(z.object({ slug: z.string() })),
    })
    .parse(
      JSON.parse(
        await readFile(
          join(
            pointer.runtimeAppRoot,
            ".eve/compile/compiled-agent-manifest.json"
          ),
          "utf8"
        )
      )
    );
  // All application tools are dynamic so each turn applies the selected-tool policy.
  expect(manifest.tools).toEqual([]);
  expect(manifest.dynamicTools.map((tool) => tool.slug).sort()).toEqual([
    "application",
    "confirm_note",
    "connection_search",
    "documents",
    "mcp",
    "platform",
    "research",
  ]);
});

test("Canvas selection survives native history and edits while later turns reset to automatic", async ({
  page,
}, testInfo) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const origin = new URL(page.url()).origin;
  const intended = {
    modelId: "google/gemini-2.5-flash",
    selectedTool: "createTextDocument",
    message:
      'Use wordCount to count "one two three four", then create a text document titled "Tool selection fixture" containing "Four words". If wordCount is unavailable, create the document directly. Finish briefly.',
  };
  await page.request.post("/api/chat-model", {
    data: { model: intended.modelId },
  });
  await page.goto("/");
  await page.getByTitle("Select Tools", { exact: true }).click();
  await page.getByRole("menuitem", { name: "Canvas", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill(intended.message);
  let operation:
    | {
        operationId: string;
        modelId: string;
        selectedTool: string;
        message: string;
      }
    | undefined;
  let binding: ReturnType<typeof conversationBinding.parse> | undefined;
  await page.route(
    "**/api/agent-conversations",
    async (route) => {
      operation = route.request().postDataJSON();
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      binding = conversationBinding.parse(await response.json());
      await route.fulfill({ response });
    },
    { times: 1 }
  );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect.poll(() => binding).toBeDefined();
  if (!(binding && operation)) {
    throw new Error("Missing creation response");
  }
  expect(operation).toMatchObject(intended);
  await expect(page).toHaveURL(new RegExp(`/chat/${binding.id}$`));
  await expect(
    page.getByRole("button", { name: "Clear Canvas tool", exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: 'Created "Tool selection fixture"',
      exact: true,
    })
  ).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(page.getByText("Words", { exact: true })).toHaveCount(0);
  const conflict = await page.request.post("/api/agent-conversations", {
    headers: { origin },
    data: { ...operation, selectedTool: "webSearch" },
  });
  expect(conflict.status()).toBe(409);
  const replay = await page.request.post("/api/agent-conversations", {
    headers: { origin },
    data: operation,
  });
  expect(replay.status()).toBe(200);
  expect(conversationBinding.parse(await replay.json())).toEqual(binding);
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: 'Created "Tool selection fixture"',
      exact: true,
    })
  ).toBeVisible();
  const composer = page.getByRole("group", {
    name: "Message composer",
    exact: true,
  });
  await composer
    .getByRole("textbox", { name: "Message", exact: true })
    .fill(
      'Reply briefly with "Automatic follow-up received". Do not create or edit documents.'
    );
  await composer.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    composer.getByRole("textbox", { name: "Message", exact: true })
  ).toHaveText("");
  await expect(page.getByRole("log").locator(".is-user")).toHaveCount(2);
  await expect(page.getByRole("log").locator(".is-assistant")).toHaveCount(2);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Edit message", exact: true })
    .first()
    .click();
  const editor = page.getByRole("dialog");
  await expect(
    editor.getByRole("button", { name: "Clear Canvas tool", exact: true })
  ).toBeVisible();
  await editor.screenshot({
    path: testInfo.outputPath("tool-selection-edit.png"),
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const clearTool = editor.getByRole("button", {
    name: "Clear Canvas tool",
    exact: true,
  });
  await clearTool.click({ trial: true });
  await editor.screenshot({
    path: testInfo.outputPath("tool-selection-edit-mobile.png"),
    animations: "disabled",
  });
});
