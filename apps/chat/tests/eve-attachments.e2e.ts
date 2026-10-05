/* oxlint-disable import/max-dependencies, import/no-nodejs-modules, import/no-relative-parent-imports --
 * import/max-dependencies (#524): import from "node:child_process" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-nodejs-modules (#529): This test harness requires import { execFileSync } from "node:child_process";; import { mkdir } from "node:fs/promises";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/eve-file-purge"; "../lib/db/eve-orphaned-files"; "../lib/db/schema"; "../lib/file-url" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
/* oxlint-disable unicorn/no-await-expression-member -- Direct awaited assertions keep each test action tied to its expectation. */
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { expect, test } from "@playwright/test";
/* oxlint-enable sort-imports */
import { eq } from "drizzle-orm";
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { db } from "../lib/db/client";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { completeEveFilePurge } from "../lib/db/eve-file-purge";
/* oxlint-enable sort-imports */
import { prepareEveOrphanedFilePurge } from "../lib/db/eve-orphaned-files";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  eveConversation,
  eveFileReference,
  eveStoredFile,
  user,
} from "../lib/db/schema";
/* oxlint-enable sort-imports */
import { keyFromFileUrl } from "../lib/file-url";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable sort-imports */
/* oxlint-enable import/max-dependencies, import/no-nodejs-modules, import/no-relative-parent-imports */

/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): assertEveTestDatabase reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
/* oxlint-enable node/no-process-env */
const redAnswer = /red/iu;
const blobUrl = /^blob:/u;
const chatUrl = /\/chat\/[a-f0-9-]+$/u;
const redPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAb0lEQVR4nO3PAQkAAAyEwO9feoshgnABdLep8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3IPanc8OLDQitxAAAAAElFTkSuQmCC",
  "base64"
);

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, node/no-sync, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/max-nested-calls --
 * max-lines-per-function (#510): test("ChatJS upload remains durable through creation retries and message editing") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("ChatJS upload remains durable through creation retries and message editing") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("ChatJS upload remains durable through creation retries and message editing") uses 180_000, 60_000, 0, 1, 409, 400, 200 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * node/no-sync (#538): test("ChatJS upload remains durable through creation retries and message editing") uses execFileSync("bun", [ "-e", 'import { deleteFilesByUrls } from "./lib/file-storage";  within its synchronous fixture setup contract; asynchronous conversion changes its callers and lifecycle.
 * typescript/prefer-readonly-parameter-types (#565): test("ChatJS upload remains durable through creation retries and message editing") accepts { page, }; route; image; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("ChatJS upload remains durable through creation retries and message editing") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): test("ChatJS upload remains durable through creation retries and message editing") intentionally keeps the existing falsy-value behavior of retained?.data; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/max-nested-calls (#568): test("ChatJS upload remains durable through creation retries and message editing") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
test("ChatJS upload remains durable through creation retries and message editing", async ({
  page,
}) => {
  test.setTimeout(180_000);
  page.setDefaultNavigationTimeout(60_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  await page.request.post("/api/chat-model", {
    data: { model: "google/gemini-2.5-flash-lite" },
  });
  const upload = await page.request.post("/api/files/upload", {
    multipart: {
      file: { buffer: redPng, mimeType: "image/png", name: "eve-square.png" },
    },
  });
  expect(upload.ok(), await upload.text()).toBe(true);
  const file = z.object({ url: z.string() }).parse(await upload.json());
  const cleanupUrls = [file.url];
  try {
    const input = {
      message: [
        {
          type: "text",
          text: "What is the dominant color of the attached square? Answer with just the color.",
        },
        {
          type: "file",
          data: file.url,
          mediaType: "image/png",
          filename: "eve-square.png",
        },
      ],
      modelId: "google/gemini-2.5-flash-lite",
      operationId: crypto.randomUUID(),
    };
    const options = {
      data: input,
      headers: { origin: new URL(page.url()).origin },
    };
    const created = await page.request.post(
      "/api/agent-conversations",
      options
    );
    expect(created.ok(), await created.text()).toBe(true);
    const binding = z
      .object({ id: z.uuid(), sessionId: z.string() })
      .parse(await created.json());
    expect(
      await db
        .select({ key: eveFileReference.key })
        .from(eveFileReference)
        .where(eq(eveFileReference.conversationId, binding.id))
    ).toEqual([{ key: keyFromFileUrl(file.url) }]);
    await page.goto(`/chat/${binding.id}`);
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.locator(".is-assistant")).toContainText(redAnswer);
    await expect(
      page
        .getByRole("log")
        .getByRole("button", { exact: true, name: "eve-square.png" })
    ).toBeVisible();
    await page.reload();
    await expect(
      page
        .getByRole("log")
        .getByRole("button", { exact: true, name: "eve-square.png" })
    ).toBeVisible();
    await page
      .getByRole("log")
      .getByRole("button", { name: "eve-square.png" })
      .hover();
    const opened = page.waitForEvent("popup");
    await page.getByTitle("Open", { exact: true }).click();
    const preview = await opened;
    await expect(preview).toHaveURL(blobUrl);
    await expect(preview.locator("img")).toBeVisible();
    await preview.close();
    await mkdir("tests/eve-results/screenshots", { recursive: true });
    await page.getByTestId("attachments").screenshot({
      animations: "disabled",
      path: "tests/eve-results/screenshots/eve-image.png",
    });
    const retry = await page.request.post("/api/agent-conversations", options);
    expect(await retry.json()).toEqual(binding);
    const changed = await page.request.post("/api/agent-conversations", {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing options own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...options,
      data: {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...input,
        message: [
          input.message[0],
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input.message[1] own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
          { ...input.message[1], filename: "different.png" },
        ],
      },
    });
    expect(changed.status()).toBe(409);
    const external = await page.request.post("/api/agent-conversations", {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing options own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...options,
      data: {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...input,
        message: [
          {
            type: "file",
            data: "http://127.0.0.1/private",
            mediaType: "image/png",
            filename: "bad.png",
          },
        ],
        operationId: crypto.randomUUID(),
      },
    });
    expect(external.status()).toBe(400);
    await page
      .getByRole("button", { exact: true, name: "Edit message" })
      .click();
    const editor = page.getByRole("dialog");
    await expect(
      editor.getByRole("button", { exact: true, name: "eve-square.png" })
    ).toBeVisible();
    await expect
      .poll(() =>
        editor
          .getByRole("img", { exact: true, name: "eve-square.png" })
          .evaluate(
            (image) =>
              image instanceof HTMLImageElement &&
              image.complete &&
              image.naturalWidth > 0
          )
      )
      .toBe(true);
    await editor.screenshot({
      animations: "disabled",
      path: "tests/eve-results/screenshots/eve-edit-restored-attachment.png",
    });
    await editor
      .getByRole("textbox", { exact: true, name: "Message" })
      .fill(
        "Look at the attached square again. Reply with only its dominant color."
      );
    // Capture before the app's hard navigation discards browser response bodies.
    const forkReply = Promise.withResolvers<{
      status: number;
      body: unknown;
      input: unknown;
    }>();
    await page.route(
      "**/api/agent-conversations",
      async (route) => {
        const response = await route.fetch();
        forkReply.resolve({
          body: await response.json(),
          input: route.request().postDataJSON(),
          status: response.status(),
        });
        await route.fulfill({ response });
      },
      { times: 1 }
    );
    await editor.getByRole("button", { exact: true, name: "Send" }).click();
    const forkResponse = await forkReply.promise;
    expect(forkResponse.status).toBe(200);
    const forkInput = z
      .object({
        message: z.array(
          z.object({
            data: z.string().optional(),
            filename: z.string().optional(),
            mediaType: z.string().optional(),
            type: z.string(),
          })
        ),
      })
      .parse(forkResponse.input);
    const retained = forkInput.message.find((part) => part.type === "file");
    expect(retained).toMatchObject({
      filename: "eve-square.png",
      mediaType: "image/png",
    });
    if (!retained?.data) {
      throw new Error("Edited message lost its image");
    }
    cleanupUrls.push(retained.data);
    const retainedFile = await page.request.get(retained.data);
    expect(retainedFile.ok()).toBe(true);
    expect(await retainedFile.body()).toEqual(redPng);
    const edited = z.object({ id: z.uuid() }).parse(forkResponse.body);
    await expect(page).toHaveURL(new RegExp(`/chat/${edited.id}$`, "u"));
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.locator(".is-assistant")).toContainText(redAnswer);
    await page.reload();
    await expect(
      page
        .getByRole("log")
        .getByRole("button", { exact: true, name: "eve-square.png" })
    ).toBeVisible();
    await expect(page.locator(".is-user")).toContainText(
      "Look at the attached square again"
    );
  } finally {
    // Note: `files-sdk` is ESM-only; run application cleanup with the project's Bun runtime.
    execFileSync("bun", [
      "-e",
      'import { deleteFilesByUrls } from "./lib/file-storage"; await deleteFilesByUrls(JSON.parse(process.argv[1]));',
      JSON.stringify([...new Set(cleanupUrls)]),
    ]);
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, node/no-sync, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/max-nested-calls */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, node/no-sync, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): test("composer uploads and clears attachments, then reload confirms an in-flight mult keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("composer uploads and clears attachments, then reload confirms an in-flight mult keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("composer uploads and clears attachments, then reload confirms an in-flight mult uses 0, -1, 1, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * node/no-sync (#538): test("composer uploads and clears attachments, then reload confirms an in-flight mult uses execFileSync("bun", [ "-e", 'import { deleteFilesByUrls } from "./lib/file-storage";  within its synchronous fixture setup contract; asynchronous conversion changes its callers and lifecycle.
 * typescript/prefer-readonly-parameter-types (#565): test("composer uploads and clears attachments, then reload confirms an in-flight mult accepts { page, }; route; response; image; request; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("composer uploads and clears attachments, then reload confirms an in-flight mult preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): test("composer uploads and clears attachments, then reload confirms an in-flight mult intentionally keeps the existing falsy-value behavior of conversationId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
test("composer uploads and clears attachments, then reload confirms an in-flight multipart send", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  await page.request.post("/api/chat-model", {
    data: { model: "google/gemini-2.5-flash-lite" },
  });
  await page.goto("/");
  const urls: string[] = [];
  async function attach(): Promise<void> {
    const uploaded = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/files/upload") &&
        response.request().method() === "POST"
    );
    await page
      .getByRole("group", { exact: true, name: "Message composer" })
      .getByLabel("Attach files", { exact: true })
      .setInputFiles({
        buffer: redPng,
        mimeType: "image/png",
        name: "eve-square.png",
      });
    const response = await uploaded;
    expect(response.ok()).toBe(true);
    urls.push(z.object({ url: z.string() }).parse(await response.json()).url);
    await expect(
      page
        .getByTestId("attachments-preview")
        .getByRole("img", { exact: true, name: "eve-square.png" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { exact: true, name: "Send" })
    ).toBeEnabled();
  }
  try {
    await attach();
    await page
      .getByTestId("attachments-preview")
      .getByLabel("Remove attachment")
      .click();
    await expect(page.getByTestId("attachments-preview")).toHaveCount(0);
    await expect(
      page.getByRole("button", { exact: true, name: "Send" })
    ).toBeDisabled();
    await attach();
    await page
      .getByRole("textbox", { exact: true, name: "Message" })
      .fill("What color is the attached image? Answer with just the color.");
    await expect
      .poll(() =>
        page
          .getByTestId("attachments-preview")
          .getByRole("img", { exact: true, name: "eve-square.png" })
          .evaluate(
            (image) =>
              image instanceof HTMLImageElement &&
              image.complete &&
              image.naturalWidth > 0
          )
      )
      .toBe(true);
    await page.mouse.move(0, 0);
    await page
      .getByRole("group", { exact: true, name: "Message composer" })
      .screenshot({
        animations: "disabled",
        path: "tests/eve-results/screenshots/eve-composer-attachment.png",
      });
    await page.getByRole("button", { exact: true, name: "Send" }).click();
    await expect(page).toHaveURL(chatUrl);
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.locator(".is-assistant")).toContainText(redAnswer);
    await attach();
    await page
      .getByRole("textbox", { exact: true, name: "Message" })
      .fill("Describe the attached image in two sentences.");
    const accepted = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        request.url().includes("/api/eve/v1/session/")
    );
    await page.getByRole("button", { exact: true, name: "Send" }).click();
    await accepted;
    await expect(
      page.getByRole("textbox", { exact: true, name: "Message" })
    ).toHaveText("");
    await expect(page.getByTestId("attachments-preview")).toHaveCount(0);
    const conversationId = new URL(page.url()).pathname.split("/").at(-1);
    if (!conversationId) {
      throw new Error("Missing conversation ID.");
    }
    await expect
      .poll(async () => {
        const rows = await db
          .select({ key: eveFileReference.key })
          .from(eveFileReference)
          .where(eq(eveFileReference.conversationId, conversationId));
        return rows.map((row) => row.key).toSorted();
      })
      .toEqual(
        // oxlint-disable-next-line typescript/require-array-sort-compare -- Optional storage keys are compared in default UTF-16 order on both sides; locale collation would change this assertion.
        urls
          .slice(1)
          .map((url) => keyFromFileUrl(url))
          .toSorted()
      );
    // Reload after durable acceptance, while the response is still in progress.
    await expect(
      page
        .getByRole("log")
        .getByRole("button", { exact: true, name: "eve-square.png" })
    ).toHaveCount(2, { timeout: 90_000 });
    await page.reload();
    await expect(
      page
        .getByRole("log")
        .getByRole("button", { exact: true, name: "eve-square.png" })
    ).toHaveCount(2, { timeout: 90_000 });
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({
      timeout: 90_000,
    });
    await expect(
      page.getByRole("button", { exact: true, name: "Restore draft" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("textbox", { exact: true, name: "Message" })
    ).toHaveText("");
  } finally {
    execFileSync("bun", [
      "-e",
      'import { deleteFilesByUrls } from "./lib/file-storage"; await deleteFilesByUrls(JSON.parse(process.argv[1]));',
      JSON.stringify(urls),
    ]);
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, node/no-sync, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-lines-per-function (#510): test("an uncertain creation retains the same visible attachment and immutable request keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("an uncertain creation retains the same visible attachment and immutable request keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("an uncertain creation retains the same visible attachment and immutable request uses 0, 2, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("an uncertain creation retains the same visible attachment and immutable request accepts { page, }; route; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("an uncertain creation retains the same visible attachment and immutable request preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("an uncertain creation retains the same visible attachment and immutable request after reload", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  await page.request.post("/api/chat-model", {
    data: { model: "google/gemini-2.5-flash-lite" },
  });
  await page.goto("/");
  await page.route("**/api/files/upload", (route) =>
    route.fulfill({
      json: { url: "/api/files/abcdefghijklmnopqrstuvwx.png" },
    })
  );
  await page.route("**/api/files/abcdefghijklmnopqrstuvwx.png", (route) =>
    route.fulfill({ body: redPng, contentType: "image/png" })
  );
  const requests: string[] = [];
  await page.route("**/api/agent-conversations", (route) => {
    requests.push(route.request().postData() ?? "");
    return route.abort("failed");
  });
  await page
    .getByRole("group", { exact: true, name: "Message composer" })
    .getByLabel("Attach files", { exact: true })
    .setInputFiles({
      buffer: redPng,
      mimeType: "image/png",
      name: "eve-square.png",
    });
  await expect(
    page.getByRole("button", { exact: true, name: "Send" })
  ).toBeEnabled();
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Failed to fetch" })
  ).toBeVisible();
  await expect(page.getByTestId("multimodal-input")).toHaveAttribute(
    "contenteditable",
    "false"
  );
  await expect(
    page
      .getByRole("group", { exact: true, name: "Message composer" })
      .getByLabel("Attach files", { exact: true })
  ).toBeDisabled();
  await expect(
    page.getByTestId("attachments-preview").getByLabel("Remove attachment")
  ).toHaveCount(0);
  await expect(
    page
      .getByTestId("attachments-preview")
      .getByRole("img", { exact: true, name: "eve-square.png" })
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByTestId("attachments-preview")
      .getByRole("img", { exact: true, name: "eve-square.png" })
  ).toBeVisible();
  await expect(page.getByTestId("multimodal-input")).toHaveAttribute(
    "contenteditable",
    "false"
  );
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Failed to fetch" })
  ).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1]).toBe(requests[0]);
  await page
    .getByRole("group", { exact: true, name: "Message composer" })
    .screenshot({
      animations: "disabled",
      path: "tests/eve-results/screenshots/eve-composer-retained.png",
    });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, node/no-sync, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): test("uploaded attachment has durable authenticated ownership") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("uploaded attachment has durable authenticated ownership") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("uploaded attachment has durable authenticated ownership") uses 400 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * node/no-sync (#538): test("uploaded attachment has durable authenticated ownership") uses execFileSync("bun", [ "-e", 'import { deleteFilesByUrls } from "./lib/file-storage";  within its synchronous fixture setup contract; asynchronous conversion changes its callers and lifecycle.
 * typescript/prefer-readonly-parameter-types (#565): test("uploaded attachment has durable authenticated ownership") accepts { page, }; route; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("uploaded attachment has durable authenticated ownership") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): test("uploaded attachment has durable authenticated ownership") intentionally keeps the existing falsy-value behavior of key; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
test("uploaded attachment has durable authenticated ownership", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const session = z
    .object({ user: z.object({ id: z.string() }) })
    .parse(await (await page.request.get("/api/auth/get-session")).json());
  const uploaded = await page.request.post("/api/files/upload", {
    multipart: {
      file: {
        buffer: redPng,
        mimeType: "image/png",
        name: "ownership-fixture.png",
      },
    },
  });
  expect(uploaded.ok(), await uploaded.text()).toBe(true);
  const file = z.object({ url: z.string() }).parse(await uploaded.json());
  const key = keyFromFileUrl(file.url);
  if (!key) {
    throw new Error("Upload returned an invalid key.");
  }
  try {
    expect(
      await db
        .select({ ownerId: eveStoredFile.ownerId })
        .from(eveStoredFile)
        .where(eq(eveStoredFile.key, key))
    ).toEqual([{ ownerId: session.user.id }]);
    const downloaded = await page.request.get(file.url);
    expect(downloaded.ok()).toBe(true);
    expect(await downloaded.body()).toEqual(redPng);
    // This test-owned upload becomes a foreign file before any conversation uses it.
    const stranger = crypto.randomUUID();
    await db.insert(user).values({
      email: `${stranger}@test.invalid`,
      id: stranger,
      name: "Foreign file fixture",
    });
    try {
      await db
        .update(eveStoredFile)
        .set({ ownerId: stranger })
        .where(eq(eveStoredFile.key, key));
      const operationId = crypto.randomUUID();
      const rejected = await page.request.post("/api/agent-conversations", {
        data: {
          message: [
            {
              type: "file",
              data: file.url,
              mediaType: "image/png",
              filename: "foreign.png",
            },
          ],
          modelId: "google/gemini-2.5-flash-lite",
          operationId,
        },
        headers: { origin: new URL(page.url()).origin },
      });
      expect(rejected.status()).toBe(400);
      expect(await rejected.json()).toMatchObject({ creationRejected: true });
      expect(
        await db
          .select({ id: eveConversation.id })
          .from(eveConversation)
          .where(eq(eveConversation.operationId, operationId))
      ).toEqual([]);
    } finally {
      await db
        .update(eveStoredFile)
        .set({ ownerId: session.user.id })
        .where(eq(eveStoredFile.key, key));
      await db.delete(user).where(eq(user.id, stranger));
    }
  } finally {
    execFileSync("bun", [
      "-e",
      'import { deleteFilesByUrls } from "./lib/file-storage"; await deleteFilesByUrls([process.argv[1]]);',
      file.url,
    ]);
    await db.delete(eveStoredFile).where(eq(eveStoredFile.key, key));
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, node/no-sync, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions */

/* oxlint-disable max-statements, no-magic-numbers, node/no-sync, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions --
 * max-statements (#512): test("a fenced orphan URL stops serving bytes before physical removal") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("a fenced orphan URL stops serving bytes before physical removal") uses 1000, 1, 404, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * node/no-sync (#538): test("a fenced orphan URL stops serving bytes before physical removal") uses execFileSync("bun", [ "--no-env-file", "-e", 'import { deleteFilesByUrls } from ". within its synchronous fixture setup contract; asynchronous conversion changes its callers and lifecycle.
 * typescript/prefer-readonly-parameter-types (#565): test("a fenced orphan URL stops serving bytes before physical removal") accepts { page, }; route; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("a fenced orphan URL stops serving bytes before physical removal") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): test("a fenced orphan URL stops serving bytes before physical removal") intentionally keeps the existing falsy-value behavior of key; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
test("a fenced orphan URL stops serving bytes before physical removal", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const upload = await page.request.post("/api/files/upload", {
    multipart: {
      file: { buffer: redPng, mimeType: "image/png", name: "orphan-fence.png" },
    },
  });
  expect(upload.ok()).toBe(true);
  const { url } = z.object({ url: z.string() }).parse(await upload.json());
  const key = keyFromFileUrl(url);
  if (!key) {
    throw new Error("Missing uploaded key");
  }
  try {
    const fencedFileResponse = await page.request.get(url);
    expect(fencedFileResponse.ok()).toBe(true);
    // Advance eligibility for this single test-owned key, never run a global sweep.
    const fenced = await prepareEveOrphanedFilePurge(
      [key],
      new Date(Date.now() + 1000)
    );
    expect(fenced).toHaveLength(1);
    const denied = await page.request.get(url, { maxRedirects: 0 });
    expect(denied.status()).toBe(404);
    expect(denied.headers().location).toBeUndefined();
    expect(denied.headers()["cache-control"]).toBe("private, no-store");
    await completeEveFilePurge(fenced[0].ownerId, [key]);
    const redirectedFileResponse = await page.request.get(url, {
      maxRedirects: 0,
    });
    expect(redirectedFileResponse.status()).toBe(404);
  } finally {
    execFileSync("bun", [
      "--no-env-file",
      "-e",
      'import { deleteFilesByUrls } from "./lib/file-storage"; await deleteFilesByUrls(JSON.parse(process.argv[1]));',
      JSON.stringify([url]),
    ]);
    await db.delete(eveStoredFile).where(eq(eveStoredFile.key, key));
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements, no-magic-numbers, node/no-sync, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines -- #509: This eve-attachments.e2e.ts module keeps its existing fixture/scenario boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
