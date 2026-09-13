import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../lib/db/client";
import { eveGuest, eveGuestMessage, userCredit } from "../lib/db/schema";
import { eveResponseGroupResult } from "../lib/eve/response-group-contracts";
import { ANONYMOUS_LIMITS } from "../lib/types/anonymous";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

test("guest comparison reserves two responses once, renders both and isolates ownership", async ({
  page,
  browser,
}, testInfo) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.request.post("/api/chat-model", {
    data: { model: "openai/gpt-5-nano" },
  });
  await page.goto("/");
  await expect(
    page.getByRole("textbox", { name: "Message", exact: true })
  ).toBeVisible();
  const origin = new URL(page.url()).origin;
  const principal = await page.request.post("/api/eve-guest", {
    headers: { origin },
  });
  expect(principal.status()).toBe(200);
  const { ownerId } = await principal.json();
  const input = {
    operationId: crypto.randomUUID(),
    modelIds: ["openai/gpt-5-nano", "openai/gpt-5-nano"],
    message: "Reply with the single word hello. Do not call tools.",
  };
  const post = (data = input) =>
    page.request.post("/api/agent-response-groups", {
      headers: { origin },
      data,
      timeout: 90_000,
    });
  const created = await post();
  expect(created.status()).toBe(200);
  const group = eveResponseGroupResult.parse(await created.json());
  const [first, second] = group.candidates;
  if (first.state !== "bound" || second.state !== "bound") {
    throw new Error("Guest comparison did not bind both candidates.");
  }
  expect(first.sessionId).not.toBe(second.sessionId);
  const replay = await post({
    ...input,
    operationId: input.operationId.toUpperCase(),
  });
  expect(replay.status()).toBe(200);
  expect(eveResponseGroupResult.parse(await replay.json())).toEqual(group);
  expect((await post({ ...input, message: "Changed content" })).status()).toBe(
    409
  );
  const [guest] = await db
    .select()
    .from(eveGuest)
    .where(eq(eveGuest.ownerId, ownerId));
  expect(guest.remainingMessages).toBe(ANONYMOUS_LIMITS.CREDITS - 2);
  const reservations = await db
    .select()
    .from(eveGuestMessage)
    .where(eq(eveGuestMessage.ownerId, ownerId));
  expect(reservations).toHaveLength(2);
  expect(reservations.every((entry) => entry.state === "committed")).toBe(true);
  expect(
    await db.select().from(userCredit).where(eq(userCredit.userId, ownerId))
  ).toEqual([]);
  await page.goto(`/chat/${first.conversationId}`);
  await expect(page.getByRole("log").locator(".is-assistant")).toContainText(
    "hello",
    { timeout: 60_000 }
  );
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  await composer.fill("Keep this guest draft");
  await page
    .getByRole("button", { name: "GPT-5 nano Open response", exact: true })
    .click();
  await expect(page).toHaveURL(
    new URL(`/chat/${second.conversationId}`, origin).href
  );
  await expect(page.getByRole("log").locator(".is-assistant")).toContainText(
    "hello",
    { timeout: 60_000 }
  );
  await expect(composer).toHaveText("Keep this guest draft");
  await page.reload();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(composer).toHaveText("Keep this guest draft");
  await page.screenshot({
    path: testInfo.outputPath("guest-comparison.png"),
    animations: "disabled",
    style:
      "nextjs-portal, .tsqd-parent-container { visibility:hidden !important; }",
  });
  const outsider = await browser.newContext();
  try {
    await outsider.request.post(`${origin}/api/eve-guest`, {
      headers: { origin },
    });
    expect(
      (
        await outsider.request.get(
          `${origin}/api/agent-response-groups/${group.id}`
        )
      ).status()
    ).toBe(404);
  } finally {
    await outsider.close();
  }
});
