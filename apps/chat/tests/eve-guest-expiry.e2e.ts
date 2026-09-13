import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { db } from "../lib/db/client";
import { recordEveUsage } from "../lib/db/eve-billing";
import {
  eveConversation,
  eveGuest,
  eveUsage,
  user,
  userCredit,
} from "../lib/db/schema";
import { conversationBinding } from "../lib/eve/contracts";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

test("local startup automatically erases expired guest content while retaining billing identity", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/");
  await expect(
    page.getByRole("textbox", { name: "Message", exact: true })
  ).toBeVisible();
  const origin = new URL(page.url()).origin;
  const principal = await page.request.post("/api/eve-guest", {
    headers: { origin },
  });
  const { ownerId } = await principal.json();
  const created = await page.request.post("/api/agent-conversations", {
    headers: { origin },
    data: {
      operationId: crypto.randomUUID(),
      modelId: "openai/gpt-5-nano",
      message: "Reply with the single word hello.",
    },
  });
  expect(created.status(), await created.text()).toBe(200);
  const binding = conversationBinding.parse(await created.json());
  await page.goto(`/chat/${binding.id}`);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole("log").locator(".is-assistant")).toContainText(
    "hello"
  );
  await db
    .update(eveGuest)
    .set({ expiresAt: new Date(0) })
    .where(eq(eveGuest.ownerId, ownerId));
  // No cleanup endpoint or coordinator call: the app's startup scheduler must do this.
  await expect
    .poll(
      async () => {
        const [row] = await db
          .select({ state: eveConversation.state })
          .from(eveConversation)
          .where(eq(eveConversation.id, binding.id));
        return row?.state;
      },
      { timeout: 180_000, intervals: [2000] }
    )
    .toBe("deleted");
  const [deleted] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, binding.id));
  expect(deleted.firstMessage).toBe("");
  expect(deleted.guestCleanupAttemptedAt).not.toBeNull();
  expect(
    await db.select().from(eveGuest).where(eq(eveGuest.ownerId, ownerId))
  ).toHaveLength(1);
  expect(await db.select().from(user).where(eq(user.id, ownerId))).toHaveLength(
    1
  );
  const eventId = crypto.randomUUID();
  await recordEveUsage({
    ownerId,
    eventId,
    sessionId: binding.sessionId,
    turnId: "turn_late_fixture",
    costUsd: 0.001,
  });
  const [usage] = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.eventId, eventId));
  expect(usage.chargedCents).toBe(0);
  expect(
    await db.select().from(userCredit).where(eq(userCredit.userId, ownerId))
  ).toHaveLength(0);
});
