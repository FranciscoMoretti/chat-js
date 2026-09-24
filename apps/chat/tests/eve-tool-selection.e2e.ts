import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { z } from "zod";

import { conversationBinding } from "../lib/eve/contracts";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

test("compiled ChatJS tools exclude optional Eve defaults that bypass application policy", async () => {
  const pointer = z
    .object({ runtimeAppRoot: z.string() })
    .parse(
      JSON.parse(await readFile(".eve/dev-runtime/current.json", "utf-8"))
    );
  const manifest = z
    .object({
      dynamicTools: z.array(z.object({ slug: z.string() })),
      tools: z.array(z.object({ name: z.string() })),
    })
    .parse(
      JSON.parse(
        await readFile(
          path.join(
            pointer.runtimeAppRoot,
            ".eve/compile/compiled-agent-manifest.json"
          ),
          "utf-8"
        )
      )
    );
  // All application tools are dynamic so each turn applies the selected-tool policy.
  expect(manifest.tools).toEqual([]);
  expect(manifest.dynamicTools.map((tool) => tool.slug).toSorted()).toEqual([
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
  const { origin } = new URL(page.url());
  const intended = {
    message:
      'Use wordCount to count "one two three four", then create a text document titled "Tool selection fixture" containing "Four words". If wordCount is unavailable, create the document directly. Finish briefly.',
    modelId: "google/gemini-2.5-flash",
    selectedTool: "createTextDocument",
  };
  await page.request.post("/api/chat-model", {
    data: { model: intended.modelId },
  });
  await page.goto("/");
  await page.getByTitle("Select Tools", { exact: true }).click();
  await page.getByRole("menuitem", { exact: true, name: "Canvas" }).click();
  await page
    .getByRole("textbox", { exact: true, name: "Message" })
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
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect.poll(() => binding).toBeDefined();
  if (!(binding && operation)) {
    throw new Error("Missing creation response");
  }
  expect(operation).toMatchObject(intended);
  await expect(page).toHaveURL(new RegExp(`/chat/${binding.id}$`, "u"));
  await expect(
    page.getByRole("button", { exact: true, name: "Clear Canvas tool" })
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      exact: true,
      name: 'Created "Tool selection fixture"',
    })
  ).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(page.getByText("Words", { exact: true })).toHaveCount(0);
  const conflict = await page.request.post("/api/agent-conversations", {
    data: { ...operation, selectedTool: "webSearch" },
    headers: { origin },
  });
  expect(conflict.status()).toBe(409);
  const replay = await page.request.post("/api/agent-conversations", {
    data: operation,
    headers: { origin },
  });
  expect(replay.status()).toBe(200);
  expect(conversationBinding.parse(await replay.json())).toEqual(binding);
  await page.reload();
  await expect(
    page.getByRole("button", {
      exact: true,
      name: 'Created "Tool selection fixture"',
    })
  ).toBeVisible();
  const composer = page.getByRole("group", {
    exact: true,
    name: "Message composer",
  });
  await composer
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill(
      'Reply briefly with "Automatic follow-up received". Do not create or edit documents.'
    );
  await composer.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(
    composer.getByRole("textbox", { exact: true, name: "Message" })
  ).toHaveText("");
  await expect(page.getByRole("log").locator(".is-user")).toHaveCount(2);
  await expect(page.getByRole("log").locator(".is-assistant")).toHaveCount(2);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  await page.reload();
  await page
    .getByRole("button", { exact: true, name: "Edit message" })
    .first()
    .click();
  const editor = page.getByRole("dialog");
  await expect(
    editor.getByRole("button", { exact: true, name: "Clear Canvas tool" })
  ).toBeVisible();
  await editor.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("tool-selection-edit.png"),
  });
  await page.setViewportSize({ height: 844, width: 390 });
  const clearTool = editor.getByRole("button", {
    exact: true,
    name: "Clear Canvas tool",
  });
  await clearTool.click({ trial: true });
  await editor.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("tool-selection-edit-mobile.png"),
  });
});
