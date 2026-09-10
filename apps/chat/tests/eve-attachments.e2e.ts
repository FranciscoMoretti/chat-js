import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { z } from "zod";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
const redAnswer = /red/i;
const blobUrl = /^blob:/;
const redPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAb0lEQVR4nO3PAQkAAAyEwO9feoshgnABdLep8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3IPanc8OLDQitxAAAAAElFTkSuQmCC",
  "base64"
);

test("ChatJS upload becomes a durable Eve image and creation retries retain attachment identity", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const upload = await page.request.post("/api/files/upload", {
    multipart: {
      file: { name: "eve-square.png", mimeType: "image/png", buffer: redPng },
    },
  });
  expect(upload.ok(), await upload.text()).toBe(true);
  const file = z.object({ url: z.string() }).parse(await upload.json());
  try {
    const input = {
      operationId: crypto.randomUUID(),
      modelId: "openai/gpt-4.1-mini",
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
  } finally {
    // files-sdk is ESM-only; run application cleanup with the project's Bun runtime.
    execFileSync("bun", [
      "-e",
      'import { deleteFilesByUrls } from "./lib/file-storage"; await deleteFilesByUrls([process.argv[1]]);',
      file.url,
    ]);
  }
});
