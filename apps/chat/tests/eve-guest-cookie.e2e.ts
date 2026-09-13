/* oxlint-disable unicorn/no-await-expression-member -- Direct awaited assertions keep each test action tied to its expectation. */
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { Client } from "eve/client";
import { z } from "zod";

import { db } from "../lib/db/client";
import { eveGuest, user, userCredit } from "../lib/db/schema";
import { env } from "../lib/env";
import { conversationBinding } from "../lib/eve/contracts";
import { ANONYMOUS_LIMITS } from "../lib/types/anonymous";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

test("guest bootstrap is private, stable and cannot impersonate a registered session", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/login");
  const { origin } = new URL(page.url());
  const response = await page.request.post("/api/eve-guest", {
    headers: { origin },
  });
  expect(response.status()).toBe(200);
  const guest = z
    .object({ kind: z.literal("guest"), ownerId: z.uuid() })
    .strict()
    .parse(await response.json());
  const cookie = (await page.context().cookies()).find(
    (item) => item.name === "chatjs-eve-guest"
  );
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
  expect(
    await page.evaluate(() => document.cookie.includes("chatjs-eve-guest="))
  ).toBe(false);
  const repeated = await page.request.post("/api/eve-guest", {
    headers: { origin },
  });
  expect(await repeated.json()).toEqual(guest);
  expect(
    await db
      .select({ ownerId: eveGuest.ownerId })
      .from(eveGuest)
      .where(eq(eveGuest.ownerId, guest.ownerId))
  ).toEqual([]);
  expect(
    await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, guest.ownerId))
  ).toEqual([]);
  const denied = await page.request.post("/api/agent-conversations", {
    data: {
      message: "Guest cannot bypass the model allowlist.",
      modelId: "unavailable/guest-model",
      operationId: crypto.randomUUID(),
    },
    headers: { origin },
  });
  expect(denied.status()).toBe(403);
  await page.goto("/api/dev-login");
  const registered = await page.request.post("/api/eve-guest", {
    headers: { origin },
  });
  const signedIn = z
    .object({ kind: z.literal("registered"), ownerId: z.string() })
    .strict()
    .parse(await registered.json());
  expect(signedIn.ownerId).not.toBe(guest.ownerId);
  expect(
    await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, guest.ownerId))
  ).toEqual([]);
});

test("guest creation and duplicate follow-ups debit once per native turn without monetary credits", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/login");
  const { origin } = new URL(page.url());
  const bootstrap = await page.request.post("/api/eve-guest", {
    headers: { origin },
  });
  const principal = z
    .object({ ownerId: z.string() })
    .parse(await bootstrap.json());
  const input = {
    message: "Reply with the single word hello.",
    modelId: "openai/gpt-5-nano",
    operationId: crypto.randomUUID(),
  };
  const first = await page.request.post("/api/agent-conversations", {
    data: input,
    headers: { origin },
  });
  expect(first.status()).toBe(200);
  const binding = conversationBinding.parse(await first.json());
  const replay = await page.request.post("/api/agent-conversations", {
    data: input,
    headers: { origin },
  });
  expect(replay.status()).toBe(200);
  expect(await replay.json()).toEqual(binding);
  const changed = await page.request.post("/api/agent-conversations", {
    data: { ...input, message: "changed content" },
    headers: { origin },
  });
  expect(changed.status()).toBe(409);
  const client = new Client({
    headers: {
      authorization: `Bearer ${env.EVE_GATEWAY_SECRET}`,
      "x-chatjs-owner": principal.ownerId,
    },
    host: env.EVE_INTERNAL_ORIGIN ?? "",
  });
  const native = client.sessions.attach(binding.sessionId);
  await expect
    .poll(
      async () =>
        (await native.snapshot()).events.filter(
          (event) => event.type === "turn.completed"
        ).length,
      { intervals: [1000], timeout: 60_000 }
    )
    .toBe(1);
  const snapshot = await native.snapshot();
  expect(
    snapshot.events.filter((event) => event.type === "turn.started")
  ).toHaveLength(1);
  expect(
    snapshot.events
      .flatMap((event) =>
        event.type === "message.appended" ? [event.data.messageDelta] : []
      )
      .join("")
      .toLowerCase()
  ).toContain("hello");
  const operationId = crypto.randomUUID();
  const command = {
    message: "Reply with the single word goodbye.",
    modelId: "openai/gpt-5-nano",
  };
  const send = () =>
    page.request.post(`/api/eve/v1/session/${binding.sessionId}`, {
      data: command,
      headers: { origin, "x-chatjs-message-operation": operationId },
    });
  const duplicate = await Promise.all([send(), send()]);
  expect(duplicate.map((response) => response.status()).toSorted()).toEqual([
    202, 409,
  ]);
  const guestCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === "chatjs-eve-guest"
  );
  if (!guestCookie) {
    throw new Error("Guest credential is missing");
  }
  const publicClient = new Client({
    headers: { cookie: `${guestCookie.name}=${guestCookie.value}`, origin },
    host: `${origin}/api`,
  });
  const publicSession = publicClient.sessions.attach(binding.sessionId);
  await expect
    .poll(
      async () =>
        (await publicSession.snapshot()).events.filter(
          (event) => event.type === "turn.completed"
        ).length,
      { intervals: [1000], timeout: 60_000 }
    )
    .toBe(2);
  const followed = await publicSession.snapshot();
  expect(
    followed.events
      .flatMap((event) =>
        event.type === "message.appended" ? [event.data.messageDelta] : []
      )
      .join("")
      .toLowerCase()
  ).toContain("goodbye");
  expect((await send()).status()).toBe(409);
  const outsider = await page.context().browser()?.newContext();
  if (!outsider) {
    throw new Error("Missing browser context");
  }
  try {
    await outsider.request.post(`${origin}/api/eve-guest`, {
      headers: { origin },
    });
    const hidden = await outsider.request.get(
      `${origin}/api/eve/v1/session/${binding.sessionId}/stream`,
      { headers: { origin } }
    );
    expect(hidden.status()).toBe(404);
    const forbidden = await outsider.request.post(
      `${origin}/api/eve/v1/session/${binding.sessionId}/cancel`,
      { data: {}, headers: { origin } }
    );
    expect(forbidden.status()).toBe(404);
  } finally {
    await outsider.close();
  }
  const [guest] = await db
    .select()
    .from(eveGuest)
    .where(eq(eveGuest.ownerId, principal.ownerId));
  expect(guest.remainingMessages).toBe(ANONYMOUS_LIMITS.CREDITS - 2);
  expect(
    await db
      .select()
      .from(userCredit)
      .where(eq(userCredit.userId, principal.ownerId))
  ).toEqual([]);
});
