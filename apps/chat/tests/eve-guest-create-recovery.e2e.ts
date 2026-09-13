import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { Client } from "eve/client";
import { z } from "zod";

import { db } from "../lib/db/client";
import { eveGuest, eveGuestMessage, userCredit } from "../lib/db/schema";
import { env } from "../lib/env";
import { conversationBinding } from "../lib/eve/contracts";
import { ANONYMOUS_LIMITS } from "../lib/types/anonymous";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);

test("a guest recovers one native creation after its browser loses the reply", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(20_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.request.post("/api/chat-model", {
    data: { model: "openai/gpt-5-nano" },
  });
  await page.goto("/");
  const composer = page.getByLabel("Message", { exact: true });
  await expect(composer).toBeVisible();
  const origin = new URL(page.url()).origin;
  const principal = await page.request.post("/api/eve-guest", {
    headers: { origin },
  });
  expect(principal.status()).toBe(200);
  const { ownerId } = z
    .object({ kind: z.literal("guest"), ownerId: z.uuid() })
    .parse(await principal.json());
  const message = "Reply only with guest-create-recovered-47.";
  const accepted =
    Promise.withResolvers<ReturnType<typeof conversationBinding.parse>>();
  await page.route(
    "**/api/agent-conversations",
    async (route) => {
      try {
        const response = await route.fetch();
        expect(response.status(), await response.text()).toBe(200);
        accepted.resolve(conversationBinding.parse(await response.json()));
        await route.abort();
      } catch (error) {
        accepted.reject(error);
        await route.abort();
      }
    },
    { times: 1 }
  );

  let binding: ReturnType<typeof conversationBinding.parse> | undefined;
  try {
    await composer.fill(message);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    binding = await accepted.promise;
    await expect(page.getByRole("alert")).toBeVisible();
    await page.reload();
    await expect(composer).toHaveText(message);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page).toHaveURL(new URL(`/chat/${binding.id}`, origin).href, {
      timeout: 90_000,
    });
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByRole("log").locator(".is-assistant")).toContainText(
      "guest-create-recovered-47",
      { timeout: 90_000 }
    );

    await expect(composer).toHaveText("");
    expect(
      await page.evaluate(
        (id) => sessionStorage.getItem(`chatjs.eve.pending:${id}`),
        ownerId
      )
    ).toBeNull();

    const client = new Client({
      host: env.EVE_INTERNAL_ORIGIN ?? "",
      auth: { bearer: env.EVE_GATEWAY_SECRET ?? "" },
      headers: {
        "x-chatjs-owner": ownerId,
      },
    });
    const native = client.sessions.attach(binding.sessionId);
    const snapshot = await native.snapshot({
      signal: AbortSignal.timeout(15_000),
    });
    expect(
      snapshot.events.filter((event) => event.type === "message.received")
    ).toHaveLength(1);
    const started = snapshot.events.filter(
      (event) => event.type === "turn.started"
    );
    expect(started).toHaveLength(1);

    const [guest] = await db
      .select()
      .from(eveGuest)
      .where(eq(eveGuest.ownerId, ownerId));
    expect(guest?.remainingMessages).toBe(ANONYMOUS_LIMITS.CREDITS - 1);
    const reservations = await db
      .select()
      .from(eveGuestMessage)
      .where(eq(eveGuestMessage.ownerId, ownerId));
    expect(reservations).toHaveLength(1);
    expect(reservations[0]?.state).toBe("committed");
    expect(
      await db.select().from(userCredit).where(eq(userCredit.userId, ownerId))
    ).toEqual([]);
  } finally {
    if (binding) {
      const conversationId = binding.id;
      testInfo.setTimeout(testInfo.timeout + 90_000);
      await expect
        .poll(
          async () => {
            const response = await page.request.delete(
              `/api/agent-conversations/${conversationId}`,
              { headers: { origin }, timeout: 15_000 }
            );
            return [200, 404].includes(response.status());
          },
          {
            message: "Guest recovery fixture family cleanup must complete",
            timeout: 90_000,
            intervals: [1000, 2000, 5000],
          }
        )
        .toBe(true);
    }
  }
});
