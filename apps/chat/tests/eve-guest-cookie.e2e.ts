import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../lib/db/client";
import { eveGuest, user } from "../lib/db/schema";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

test("guest bootstrap is private, stable and cannot impersonate a registered session", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/login");
  const origin = new URL(page.url()).origin;
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
    headers: { origin },
    data: {
      operationId: crypto.randomUUID(),
      modelId: "openai/gpt-5-nano",
      message: "Guest admission is not enabled yet.",
    },
  });
  expect(denied.status()).toBe(401);
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
