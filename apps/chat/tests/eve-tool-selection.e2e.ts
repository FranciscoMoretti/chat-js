/* oxlint-disable import/no-nodejs-modules, import/no-relative-parent-imports, sort-imports --
 * import/no-nodejs-modules (#529): This test harness requires import { readFile } from "node:fs/promises";; import path from "node:path";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/eve/contracts" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { z } from "zod";

import { conversationBinding } from "../lib/eve/contracts";
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable import/no-nodejs-modules, import/no-relative-parent-imports, sort-imports */

/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): assertEveTestDatabase reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
/* oxlint-enable node/no-process-env */

/* oxlint-disable oxc/no-async-await, unicorn/max-nested-calls --
 * oxc/no-async-await (#540): test("compiled ChatJS tools exclude optional Eve defaults that bypass application pol sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * unicorn/max-nested-calls (#568): test("compiled ChatJS tools exclude optional Eve defaults that bypass application pol keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
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
  expect(manifest.tools.map((tool) => tool.name).toSorted()).toEqual([
    "deepResearch",
  ]);
  expect(manifest.dynamicTools.map((tool) => tool.slug).toSorted()).toEqual([
    "connection_search",
    "installed",
    "mcp",
  ]);
});
/* oxlint-enable oxc/no-async-await, unicorn/max-nested-calls */

/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, oxc/no-async-await, oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * init-declarations (#507): test("Canvas selection survives native history and edits while later turns reset to a assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): test("Canvas selection survives native history and edits while later turns reset to a keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("Canvas selection survives native history and edits while later turns reset to a keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("Canvas selection survives native history and edits while later turns reset to a uses 200, 0, 409, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("Canvas selection survives native history and edits while later turns reset to a sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): test("Canvas selection survives native history and edits while later turns reset to a copies or separates ...operation while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/prefer-readonly-parameter-types (#565): test("Canvas selection survives native history and edits while later turns reset to a accepts { page, }; testInfo; route; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("Canvas selection survives native history and edits while later turns reset to a preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
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
  await page
    .getByRole("button", { exact: true, name: "Composer options" })
    .click();
  await page
    .getByRole("menuitemcheckbox", { exact: true, name: "Canvas" })
    .click();
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
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- Capture the actual native operation payload; subsequent assertions verify tool selection on the wire.
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
    page.getByRole("button", { exact: true, name: "Composer options" })
  ).not.toContainText("Canvas");
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
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, oxc/no-async-await, oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
