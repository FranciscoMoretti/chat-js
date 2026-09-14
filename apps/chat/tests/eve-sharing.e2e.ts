import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { Client } from "eve/client";
import { z } from "zod";

import { db } from "../lib/db/client";
import { eveConversation, user } from "../lib/db/schema";
import { env } from "../lib/env";
import { insertEveConversationFixtures } from "./eve-conversation-fixture";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

test("sharing exposes only a read-only transcript, enforces ownership and revokes the link", async ({
  page,
  browser,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const created = await page.request.post("/api/agent-conversations", {
    data: {
      message:
        "Reply exactly share-fixture-ok as plain text. Do not call tools.",
      modelId: "google/gemini-2.5-flash-lite",
      operationId: crypto.randomUUID(),
    },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const binding = z
    .object({ id: z.uuid(), sessionId: z.string() })
    .parse(await created.json());
  const anonymous = await browser.newContext();
  const publicPage = await anonymous.newPage();
  await publicPage.route("https://unpkg.com/react-scan/**", (route) =>
    route.abort()
  );
  const foreignId = crypto.randomUUID();
  const foreignChat = crypto.randomUUID();
  await db.insert(user).values({
    email: `${foreignId}@test.invalid`,
    id: foreignId,
    name: "Share ownership fixture",
  });
  await insertEveConversationFixtures({
    firstMessage: "Private foreign conversation",
    id: foreignChat,
    operationId: crypto.randomUUID(),
    ownerId: foreignId,
  });
  try {
    const base = new URL(page.url()).origin;
    await publicPage.goto(`${base}/share/${binding.id}`);
    await expect(
      publicPage.getByRole("heading", { exact: true, name: "404" })
    ).toBeVisible();
    await page.goto(`/chat/${binding.id}`);
    await expect(page.locator(".is-assistant")).toContainText(
      "share-fixture-ok",
      { timeout: 90_000 }
    );
    const [owner] = await db
      .select({ id: eveConversation.ownerId })
      .from(eveConversation)
      .where(eq(eveConversation.id, binding.id));
    if (!owner) {
      throw new Error("Missing fixture owner.");
    }
    const native = new Client({
      auth: { bearer: env.EVE_GATEWAY_SECRET ?? "" },
      headers: { "x-chatjs-owner": owner.id },
      host: env.EVE_INTERNAL_ORIGIN ?? "",
    }).sessions.attach(binding.sessionId);
    // Tool input can contain the same marker before an answer exists.
    await expect
      .poll(
        async () => {
          const snapshot = await native.snapshot({
            signal: AbortSignal.timeout(10_000),
          });
          return snapshot.events.some(
            (event) =>
              event.type === "message.completed" &&
              event.data.finishReason === "stop" &&
              event.data.message?.trim() === "share-fixture-ok"
          );
        },
        { intervals: [1000, 2000, 4000], timeout: 30_000 }
      )
      .toBe(true);
    await page.getByRole("button", { exact: true, name: "Share chat" }).click();
    await expect(page.getByRole("dialog")).toContainText("Private");
    await expect(
      page.getByRole("button", { exact: true, name: "Share Chat" })
    ).toBeEnabled();
    await page.getByRole("dialog").screenshot({
      animations: "disabled",
      path: "tests/eve-results/screenshots/eve-share-private.png",
    });
    await page.getByRole("button", { exact: true, name: "Share Chat" }).click();
    await expect(
      page.getByRole("button", { exact: true, name: "Make Private" })
    ).toBeEnabled();
    await page.getByRole("dialog").screenshot({
      animations: "disabled",
      path: "tests/eve-results/screenshots/eve-share-public.png",
    });
    await publicPage.reload();
    await expect(publicPage.getByRole("log")).toContainText("share-fixture-ok");
    await expect(publicPage.getByTestId("multimodal-input")).toHaveCount(0);
    await publicPage.locator("main").screenshot({
      animations: "disabled",
      path: "tests/eve-results/screenshots/eve-shared-transcript.png",
    });
    const forbidden = await publicPage.request.post(
      `${base}/api/trpc/eve.setVisibility`,
      { data: { json: { id: binding.id, visibility: "private" } } }
    );
    expect(forbidden.status()).toBe(401);
    const foreign = await page.request.post("/api/trpc/eve.setVisibility", {
      data: { json: { id: foreignChat, visibility: "public" } },
    });
    expect(foreign.status()).toBe(404);
    const stream = await publicPage.request.get(
      `${base}/api/eve/v1/session/${binding.sessionId}/stream`
    );
    expect(stream.status()).toBe(401);
    await page
      .getByRole("button", { exact: true, name: "Make Private" })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await publicPage.reload();
    await expect(
      publicPage.getByRole("heading", { exact: true, name: "404" })
    ).toBeVisible();
    await expect(publicPage.getByRole("log")).toHaveCount(0);
  } finally {
    await db
      .update(eveConversation)
      .set({ visibility: "private" })
      .where(eq(eveConversation.id, binding.id));
    await anonymous.close();
    await db.delete(eveConversation).where(eq(eveConversation.id, foreignChat));
    await db.delete(user).where(eq(user.id, foreignId));
  }
});
