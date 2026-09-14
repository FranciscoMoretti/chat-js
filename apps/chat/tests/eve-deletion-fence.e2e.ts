/* oxlint-disable unicorn/no-await-expression-member -- Direct awaited assertions keep each test action tied to its expectation. */
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../lib/db/client";
import { eveConversation } from "../lib/db/schema";
import { env } from "../lib/env";
import { insertEveConversationFixtures } from "./eve-conversation-fixture";

if (!["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname)) {
  throw new Error("Deletion tests require local Postgres.");
}

for (const state of ["deleting", "deleted"] as const) {
  test(`${state} conversation rejects browser access and old creation requests`, async ({
    page,
    browser,
  }) => {
    await page.route("https://unpkg.com/react-scan/**", (route) =>
      route.abort()
    );
    await page.goto("/api/dev-login");
    const owner = z
      .object({ user: z.object({ id: z.string() }) })
      .parse(await (await page.request.get("/api/auth/get-session")).json())
      .user.id;
    const id = crypto.randomUUID();
    const operationId = crypto.randomUUID();
    const sessionId = `wrun_deleted_${id}`;
    await insertEveConversationFixtures({
      firstMessage: "Deleted test conversation",
      id,
      operationId,
      ownerId: owner,
      sessionId,
      state,
      visibility: "public",
    });
    const anonymous = await browser.newContext();
    try {
      const retry = await page.request.post("/api/agent-conversations", {
        data: {
          message: "Deleted test conversation",
          modelId: "openai/gpt-5-mini",
          operationId,
        },
        headers: { origin: new URL(page.url()).origin },
      });
      expect(retry.status()).toBe(404);
      expect(await retry.json()).toMatchObject({ creationRejected: true });
      await page.goto(`/chat/${id}`);
      await expect(
        page.getByRole("heading", { exact: true, name: "404" })
      ).toBeVisible();
      const stream = await page.request.get(
        `/api/eve/v1/session/${sessionId}/stream`,
        { headers: { "x-chatjs-deletion": "1" } }
      );
      expect(stream.status()).toBe(404);
      const publicPage = await anonymous.newPage();
      await publicPage.route("https://unpkg.com/react-scan/**", (route) =>
        route.abort()
      );
      await publicPage.goto(`${new URL(page.url()).origin}/share/${id}`);
      await expect(
        publicPage.getByRole("heading", { exact: true, name: "404" })
      ).toBeVisible();
      await expect(publicPage.getByRole("log")).toHaveCount(0);
    } finally {
      await anonymous.close();
      await db.delete(eveConversation).where(eq(eveConversation.id, id));
    }
  });
}
