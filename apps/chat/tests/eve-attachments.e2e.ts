import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../lib/db/client";
import {
  eveConversation,
  eveFileReference,
  eveStoredFile,
  user,
} from "../lib/db/schema";
import { keyFromFileUrl } from "../lib/file-url";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
const redAnswer = /red/i;
const blobUrl = /^blob:/;
const chatUrl = /\/chat\/[a-f0-9-]+$/;
const redPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAb0lEQVR4nO3PAQkAAAyEwO9feoshgnABdLep8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3IPanc8OLDQitxAAAAAElFTkSuQmCC",
  "base64"
);

test("ChatJS upload remains durable through creation retries and message editing", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const upload = await page.request.post("/api/files/upload", {
    multipart: {
      file: { name: "eve-square.png", mimeType: "image/png", buffer: redPng },
    },
  });
  expect(upload.ok(), await upload.text()).toBe(true);
  const file = z.object({ url: z.string() }).parse(await upload.json());
  const cleanupUrls = [file.url];
  try {
    const input = {
      operationId: crypto.randomUUID(),
      modelId: "google/gemini-2.5-flash-lite",
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
    };
    const options = {
      headers: { origin: new URL(page.url()).origin },
      data: input,
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
        .getByRole("button", { name: "eve-square.png", exact: true })
    ).toBeVisible();
    await page.reload();
    await expect(
      page
        .getByRole("log")
        .getByRole("button", { name: "eve-square.png", exact: true })
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
      path: "tests/eve-results/screenshots/eve-image.png",
      animations: "disabled",
    });
    const retry = await page.request.post("/api/agent-conversations", options);
    expect(await retry.json()).toEqual(binding);
    const changed = await page.request.post("/api/agent-conversations", {
      ...options,
      data: {
        ...input,
        message: [
          input.message[0],
          { ...input.message[1], filename: "different.png" },
        ],
      },
    });
    expect(changed.status()).toBe(409);
    const external = await page.request.post("/api/agent-conversations", {
      ...options,
      data: {
        ...input,
        operationId: crypto.randomUUID(),
        message: [
          {
            type: "file",
            data: "http://127.0.0.1/private",
            mediaType: "image/png",
            filename: "bad.png",
          },
        ],
      },
    });
    expect(external.status()).toBe(400);
    await page
      .getByRole("button", { name: "Edit message", exact: true })
      .click();
    const editor = page.getByRole("dialog");
    await expect(
      editor.getByRole("button", { name: "eve-square.png", exact: true })
    ).toBeVisible();
    await editor
      .getByRole("textbox", { name: "Message", exact: true })
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
          status: response.status(),
          body: await response.json(),
          input: route.request().postDataJSON(),
        });
        await route.fulfill({ response });
      },
      { times: 1 }
    );
    await editor.getByRole("button", { name: "Send", exact: true }).click();
    const forkResponse = await forkReply.promise;
    expect(forkResponse.status).toBe(200);
    const forkInput = z
      .object({
        message: z.array(
          z.object({
            type: z.string(),
            data: z.string().optional(),
            mediaType: z.string().optional(),
            filename: z.string().optional(),
          })
        ),
      })
      .parse(forkResponse.input);
    const retained = forkInput.message.find((part) => part.type === "file");
    expect(retained).toMatchObject({
      mediaType: "image/png",
      filename: "eve-square.png",
    });
    if (!retained?.data) {
      throw new Error("Edited message lost its image");
    }
    cleanupUrls.push(retained.data);
    const retainedFile = await page.request.get(retained.data);
    expect(retainedFile.ok()).toBe(true);
    expect(await retainedFile.body()).toEqual(redPng);
    const edited = z.object({ id: z.uuid() }).parse(forkResponse.body);
    await expect(page).toHaveURL(new RegExp(`/chat/${edited.id}$`));
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.locator(".is-assistant")).toContainText(redAnswer);
    await page.reload();
    await expect(
      page
        .getByRole("log")
        .getByRole("button", { name: "eve-square.png", exact: true })
    ).toBeVisible();
    await expect(page.locator(".is-user")).toContainText(
      "Look at the attached square again"
    );
  } finally {
    // files-sdk is ESM-only; run application cleanup with the project's Bun runtime.
    execFileSync("bun", [
      "-e",
      'import { deleteFilesByUrls } from "./lib/file-storage"; await deleteFilesByUrls(JSON.parse(process.argv[1]));',
      JSON.stringify([...new Set(cleanupUrls)]),
    ]);
  }
});

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
  async function attach() {
    const uploaded = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/files/upload") &&
        response.request().method() === "POST"
    );
    await page
      .getByRole("group", { name: "Message composer", exact: true })
      .getByLabel("Attach files", { exact: true })
      .setInputFiles({
        name: "eve-square.png",
        mimeType: "image/png",
        buffer: redPng,
      });
    const response = await uploaded;
    expect(response.ok()).toBe(true);
    urls.push(z.object({ url: z.string() }).parse(await response.json()).url);
    await expect(
      page
        .getByTestId("attachments-preview")
        .getByRole("img", { name: "eve-square.png", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send", exact: true })
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
      page.getByRole("button", { name: "Send", exact: true })
    ).toBeDisabled();
    await attach();
    await page
      .getByRole("textbox", { name: "Message", exact: true })
      .fill("What color is the attached image? Answer with just the color.");
    await expect
      .poll(() =>
        page
          .getByTestId("attachments-preview")
          .getByRole("img", { name: "eve-square.png", exact: true })
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
      .getByRole("group", { name: "Message composer", exact: true })
      .screenshot({
        path: "tests/eve-results/screenshots/eve-composer-attachment.png",
        animations: "disabled",
      });
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page).toHaveURL(chatUrl);
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.locator(".is-assistant")).toContainText(redAnswer);
    await attach();
    await page
      .getByRole("textbox", { name: "Message", exact: true })
      .fill("Describe the attached image in two sentences.");
    const accepted = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        request.url().includes("/api/eve/v1/session/")
    );
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await accepted;
    await expect(
      page.getByRole("textbox", { name: "Message", exact: true })
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
        return rows.map((row) => row.key).sort();
      })
      .toEqual(urls.slice(1).map(keyFromFileUrl).sort());
    // Reload after durable acceptance, while the response is still in progress.
    await expect(
      page
        .getByRole("log")
        .getByRole("button", { name: "eve-square.png", exact: true })
    ).toHaveCount(2, { timeout: 90_000 });
    await page.reload();
    await expect(
      page
        .getByRole("log")
        .getByRole("button", { name: "eve-square.png", exact: true })
    ).toHaveCount(2, { timeout: 90_000 });
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({
      timeout: 90_000,
    });
    await expect(
      page.getByRole("button", { name: "Restore draft", exact: true })
    ).toHaveCount(0);
    await expect(
      page.getByRole("textbox", { name: "Message", exact: true })
    ).toHaveText("");
  } finally {
    execFileSync("bun", [
      "-e",
      'import { deleteFilesByUrls } from "./lib/file-storage"; await deleteFilesByUrls(JSON.parse(process.argv[1]));',
      JSON.stringify(urls),
    ]);
  }
});

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
      json: { url: "/api/files/content?key=abcdefghijklmnopqrstuvwx.png" },
    })
  );
  await page.route(
    "**/api/files/content?key=abcdefghijklmnopqrstuvwx.png",
    (route) => route.fulfill({ contentType: "image/png", body: redPng })
  );
  const requests: string[] = [];
  await page.route("**/api/agent-conversations", (route) => {
    requests.push(route.request().postData() ?? "");
    return route.abort("failed");
  });
  await page
    .getByRole("group", { name: "Message composer", exact: true })
    .getByLabel("Attach files", { exact: true })
    .setInputFiles({
      name: "eve-square.png",
      mimeType: "image/png",
      buffer: redPng,
    });
  await expect(
    page.getByRole("button", { name: "Send", exact: true })
  ).toBeEnabled();
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Failed to fetch" })
  ).toBeVisible();
  await expect(page.getByTestId("multimodal-input")).toHaveAttribute(
    "contenteditable",
    "false"
  );
  await expect(
    page
      .getByRole("group", { name: "Message composer", exact: true })
      .getByLabel("Attach files", { exact: true })
  ).toBeDisabled();
  await expect(
    page.getByTestId("attachments-preview").getByLabel("Remove attachment")
  ).toHaveCount(0);
  await expect(
    page
      .getByTestId("attachments-preview")
      .getByRole("img", { name: "eve-square.png", exact: true })
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByTestId("attachments-preview")
      .getByRole("img", { name: "eve-square.png", exact: true })
  ).toBeVisible();
  await expect(page.getByTestId("multimodal-input")).toHaveAttribute(
    "contenteditable",
    "false"
  );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Failed to fetch" })
  ).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1]).toBe(requests[0]);
  await page
    .getByRole("group", { name: "Message composer", exact: true })
    .screenshot({
      path: "tests/eve-results/screenshots/eve-composer-retained.png",
      animations: "disabled",
    });
});

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
        name: "ownership-fixture.png",
        mimeType: "image/png",
        buffer: redPng,
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
      id: stranger,
      email: `${stranger}@test.invalid`,
      name: "Foreign file fixture",
    });
    try {
      await db
        .update(eveStoredFile)
        .set({ ownerId: stranger })
        .where(eq(eveStoredFile.key, key));
      const operationId = crypto.randomUUID();
      const rejected = await page.request.post("/api/agent-conversations", {
        headers: { origin: new URL(page.url()).origin },
        data: {
          operationId,
          modelId: "google/gemini-2.5-flash-lite",
          message: [
            {
              type: "file",
              data: file.url,
              mediaType: "image/png",
              filename: "foreign.png",
            },
          ],
        },
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
