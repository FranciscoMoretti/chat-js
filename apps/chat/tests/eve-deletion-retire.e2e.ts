import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { eq, sql } from "drizzle-orm";
import postgres from "postgres";
import { z } from "zod";
import { db } from "../lib/db/client";
import { saveEveDocumentRevision } from "../lib/db/eve-documents";
import { purgeEveNativeSession } from "../lib/db/eve-native-purge";
import {
  eveConversation,
  eveDocumentCheckpoint,
  eveDocumentCheckpointEntry,
  eveDocumentRevision,
  userCredit,
} from "../lib/db/schema";
import { env } from "../lib/env";
import { prepareEveFamilyDeletion } from "../lib/eve/prepare-deletion";
import {
  retireEveFamilyForDeletion,
  retireEveSessionForDeletion,
} from "../lib/eve/retire-session";

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
      modelId: "google/gemini-2.5-flash-lite",
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
  await saveEveDocumentRevision({
    ownerId: owner,
    conversationId: binding.id,
    documentId: crypto.randomUUID(),
    operationId: crypto.randomUUID(),
    expectedRevisionId: null,
    turnIndex: 0,
    title: "Removal fixture",
    content: "Artifact content to remove",
    kind: "text",
  });
  const family = await retireEveFamilyForDeletion(owner, binding.id);
  expect(family?.conversations).toEqual([
    { id: binding.id, sessionId: binding.sessionId },
  ]);
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
  const prepared = await prepareEveFamilyDeletion(owner, binding.id);
  expect(prepared?.runIds).toContain(binding.sessionId);
  expect(await prepareEveFamilyDeletion(owner, binding.id)).toEqual(prepared);
  const purgeResources = async () => {
    // Playwright loads this suite as CommonJS; run the ESM-only storage adapter
    // under the app's Bun runtime with the same local environment and app root.
    const { stdout } = await promisify(execFile)(
      "bun",
      [
        "-e",
        'import { purgeLocalEveFamilyResources } from "./lib/eve/purge-local-resources"; const result = await purgeLocalEveFamilyResources(process.argv[1], process.argv[2], process.cwd()); console.log(JSON.stringify(result)); process.exit(0);',
        owner,
        binding.id,
      ],
      { cwd: process.cwd(), timeout: 30_000 }
    );
    return JSON.parse(stdout);
  };
  expect(await purgeResources()).toEqual(prepared);
  expect(await purgeResources()).toEqual(prepared);
  expect(
    await db
      .select()
      .from(eveDocumentRevision)
      .where(eq(eveDocumentRevision.conversationId, binding.id))
  ).toEqual([]);
  const [pending] = await db
    .select({ state: eveConversation.state })
    .from(eveConversation)
    .where(eq(eveConversation.id, binding.id));
  expect(pending.state).toBe("deleting");
  const native = postgres(env.DATABASE_URL, { max: 1 });
  try {
    expect(
      await native`select id from workflow.workflow_runs where id = ${binding.sessionId}`
    ).toHaveLength(1);
    const scope = {
      sessionId: binding.sessionId,
      taskIdentifier: "workflow_flows",
    };
    const receipt = await purgeEveNativeSession(
      env.DATABASE_URL,
      scope,
      async () => {
        await retireEveSessionForDeletion(owner, binding.sessionId);
      }
    );
    expect(receipt.runIds).toContain(binding.sessionId);
    expect(
      await native`select id from workflow.workflow_runs where id in ${native(receipt.runIds)}`
    ).toEqual([]);
    expect(
      await purgeEveNativeSession(env.DATABASE_URL, scope, () =>
        Promise.reject(new Error("Retired session must not reset again"))
      )
    ).toEqual(receipt);
    expect(await purgeResources()).toEqual(prepared);
    const deletionUrl = `/api/agent-conversations/${binding.id}`;
    const deletion = await page.request.delete(deletionUrl, {
      headers: { origin: new URL(page.url()).origin },
    });
    expect(deletion.status(), await deletion.text()).toBe(200);
    expect(await deletion.json()).toEqual({
      status: "deleted",
      rootId: binding.id,
    });
    expect(await (await page.request.get(deletionUrl)).json()).toEqual({
      status: "deleted",
      rootId: binding.id,
    });
    expect(
      (
        await page.request.delete(deletionUrl, {
          headers: { origin: new URL(page.url()).origin },
        })
      ).status()
    ).toBe(200);
    const [settled] = await db
      .select()
      .from(userCredit)
      .where(eq(userCredit.userId, owner));
    expect(settled.credits).toBe(after.credits);
  } finally {
    await native.end();
  }
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

test("sidebar deletion retires a fresh conversation and reports its durable tombstone", async ({
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
  const origin = new URL(page.url()).origin;
  const response = await page.request.post("/api/agent-conversations", {
    headers: { origin },
    data: {
      operationId: crypto.randomUUID(),
      modelId: "google/gemini-2.5-flash-lite",
      message: "Reply exactly deletion-api-ok. Do not call tools.",
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const binding = z
    .object({ id: z.uuid(), sessionId: z.string() })
    .parse(await response.json());
  await page.goto(`/chat/${binding.id}`);
  await expect(page.locator(".is-assistant")).toContainText("deletion-api-ok", {
    timeout: 90_000,
  });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  const url = `/api/agent-conversations/${binding.id}`;
  expect(await (await page.request.get(url)).json()).toEqual({
    status: "active",
    rootId: binding.id,
  });
  const expand = page.getByRole("button", {
    name: "Expand sidebar",
    exact: true,
  });
  if (await expand.isVisible()) {
    await expand.click();
  }
  const row = page
    .locator("li")
    .filter({ has: page.locator(`a[href="/chat/${binding.id}"]`) });
  await row.hover();
  await row.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  const result = page.waitForResponse(
    (response) =>
      response.url().endsWith(url) && response.request().method() === "DELETE"
  );
  await page
    .getByRole("dialog", { name: "Delete conversation and branches?" })
    .getByRole("button", {
      name: "Delete conversation and branches",
      exact: true,
    })
    .click();
  const deleted = await result;
  expect(deleted.status(), await deleted.text()).toBe(200);
  await expect(page).toHaveURL(`${origin}/`);
  await expect(
    page.getByRole("dialog", { name: "Delete conversation and branches?" })
  ).toHaveCount(0);
  expect(await deleted.json()).toEqual({
    status: "deleted",
    rootId: binding.id,
  });
  expect(await (await page.request.get(url)).json()).toEqual({
    status: "deleted",
    rootId: binding.id,
  });
  expect(
    (await page.request.delete(url, { headers: { origin } })).status()
  ).toBe(200);
  const native = postgres(env.DATABASE_URL, { max: 1 });
  try {
    expect(
      await native`select id from workflow.workflow_runs where id = ${binding.sessionId}`
    ).toHaveLength(0);
  } finally {
    await native.end();
  }
});
