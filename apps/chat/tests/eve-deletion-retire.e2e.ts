import { expect, test } from "@playwright/test";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../lib/db/client";
import { beginEveConversationDeletion } from "../lib/db/eve-queries";
import {
  eveConversation,
  eveDocumentCheckpoint,
  eveDocumentCheckpointEntry,
  userCredit,
} from "../lib/db/schema";
import { env } from "../lib/env";
import { retireEveSessionForDeletion } from "../lib/eve/retire-session";

if (!["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname)) {
  throw new Error("Retirement acceptance requires local Postgres.");
}

test("internal retirement settles usage after access revocation and is retryable", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const owner = z
    .object({ user: z.object({ id: z.string() }) })
    .parse(await (await page.request.get("/api/auth/get-session")).json())
    .user.id;
  await db
    .insert(userCredit)
    .values({ userId: owner, credits: 1000 })
    .onConflictDoUpdate({
      target: userCredit.userId,
      set: { credits: sql`greatest(${userCredit.credits}, 1000)` },
    });
  const created = await page.request.post("/api/agent-conversations", {
    headers: { origin: new URL(page.url()).origin },
    data: {
      operationId: crypto.randomUUID(),
      modelId: "openai/gpt-4.1-mini-fast",
      message: "Reply exactly retire-fixture-ok. Do not call tools.",
    },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const binding = z
    .object({ id: z.uuid(), sessionId: z.string() })
    .parse(await created.json());
  await page.goto(`/chat/${binding.id}`);
  await expect(page.locator(".is-assistant")).toContainText(
    "retire-fixture-ok",
    { timeout: 90_000 }
  );
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await beginEveConversationDeletion(owner, binding.id);
  const denied = await page.request.get(
    `/api/eve/v1/session/${binding.sessionId}/stream`,
    { headers: { "x-chatjs-deletion": "1" } }
  );
  expect(denied.status()).toBe(404);
  // Keep a failed fixture fenced for diagnosis/retry; never reopen it to clean up.
  const snapshot = await retireEveSessionForDeletion(owner, binding.sessionId);
  expect(
    snapshot.events.some((event) => event.type === "session.completed")
  ).toBe(true);
  const [before] = await db
    .select()
    .from(userCredit)
    .where(eq(userCredit.userId, owner));
  await retireEveSessionForDeletion(owner, binding.sessionId);
  const [after] = await db
    .select()
    .from(userCredit)
    .where(eq(userCredit.userId, owner));
  expect(after.credits).toBe(before.credits);
  // Remove only this retired test binding; this is not a production purge assertion.
  await db.transaction(async (tx) => {
    await tx
      .delete(eveDocumentCheckpointEntry)
      .where(eq(eveDocumentCheckpointEntry.conversationId, binding.id));
    await tx
      .delete(eveDocumentCheckpoint)
      .where(eq(eveDocumentCheckpoint.conversationId, binding.id));
    await tx.delete(eveConversation).where(eq(eveConversation.id, binding.id));
  });
});
