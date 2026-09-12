import { eq } from "drizzle-orm";
import { afterAll, expect, test, vi } from "vitest";
import { db } from "../lib/db/client";
import {
  confirmEveCodeSandboxCreation,
  listEveCodeSandboxesForDeletion,
  recordEveCodeSandboxDeletion,
  reserveEveCodeSandbox,
} from "../lib/db/eve-code-sandboxes";
import { completeEveConversationDeletion } from "../lib/db/eve-deletion";
import {
  beginEveConversationDeletion,
  createEveConversation,
} from "../lib/db/eve-queries";
import { eveCodeSandbox, eveConversation, user } from "../lib/db/schema";
import { env } from "../lib/env";
import { assertEveTestDatabase } from "./eve-test-database";

vi.mock("server-only", () => ({}));
assertEveTestDatabase(env.DATABASE_URL);
const owner = crypto.randomUUID();
await db.insert(user).values({
  id: owner,
  name: "Sandbox ownership",
  email: `${owner}@test.invalid`,
});
afterAll(async () => {
  await db.delete(eveCodeSandbox).where(eq(eveCodeSandbox.ownerId, owner));
  await db.delete(eveConversation).where(eq(eveConversation.ownerId, owner));
  await db.delete(user).where(eq(user.id, owner));
});
async function conversation() {
  return await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Sandbox fixture",
    async () => crypto.randomUUID()
  );
}

test("unresolved allocation blocks final deletion until confirmed cleanup; retries retain the tombstone", async () => {
  const row = await conversation();
  const name = await reserveEveCodeSandbox(owner, row.id, "call-1");
  await expect(reserveEveCodeSandbox(owner, row.id, "call-1")).rejects.toThrow(
    "Reconcile"
  );
  await beginEveConversationDeletion(owner, row.id);
  await expect(completeEveConversationDeletion(owner, row.id)).rejects.toThrow(
    "Code sandbox cleanup is incomplete"
  );
  await recordEveCodeSandboxDeletion(owner, row.id, name);
  await recordEveCodeSandboxDeletion(owner, row.id, name);
  await completeEveConversationDeletion(owner, row.id);
  const [resource] = await db
    .select()
    .from(eveCodeSandbox)
    .where(eq(eveCodeSandbox.name, name));
  expect(resource.state).toBe("deleted");
  await expect(reserveEveCodeSandbox(owner, row.id, "call-2")).rejects.toThrow(
    "unavailable"
  );
});

test("foreign owners cannot reserve or resolve resources, and completed calls cannot reallocate", async () => {
  const row = await conversation();
  await expect(
    reserveEveCodeSandbox("stranger", row.id, "call")
  ).rejects.toThrow("unavailable");
  const name = await reserveEveCodeSandbox(owner, row.id, "call");
  await expect(
    recordEveCodeSandboxDeletion("stranger", row.id, name)
  ).rejects.toThrow("ownership");
  await recordEveCodeSandboxDeletion(owner, row.id, name);
  await expect(reserveEveCodeSandbox(owner, row.id, "call")).rejects.toThrow(
    "Reconcile"
  );
});

test("concurrent allocation and deletion cannot leave an untracked admitted resource", async () => {
  const row = await conversation();
  const [allocation] = await Promise.allSettled([
    reserveEveCodeSandbox(owner, row.id, "racing-call"),
    beginEveConversationDeletion(owner, row.id),
  ]);
  if (allocation.status === "fulfilled") {
    await expect(
      completeEveConversationDeletion(owner, row.id)
    ).rejects.toThrow("cleanup is incomplete");
  } else {
    await completeEveConversationDeletion(owner, row.id);
    expect(
      await db
        .select()
        .from(eveCodeSandbox)
        .where(eq(eveCodeSandbox.conversationId, row.id))
    ).toEqual([]);
  }
});

test("only a retired owned family can inventory confirmed creation", async () => {
  const row = await conversation();
  const name = await reserveEveCodeSandbox(owner, row.id, "confirmed");
  await expect(listEveCodeSandboxesForDeletion(owner, row.id)).rejects.toThrow(
    "Retire"
  );
  await expect(
    confirmEveCodeSandboxCreation("stranger", row.id, name)
  ).rejects.toThrow("ownership");
  await confirmEveCodeSandboxCreation(owner, row.id, name);
  await beginEveConversationDeletion(owner, row.id);
  expect(await listEveCodeSandboxesForDeletion(owner, row.id)).toEqual([
    { name, conversationId: row.id, creationConfirmed: true },
  ]);
  await expect(
    listEveCodeSandboxesForDeletion("stranger", row.id)
  ).rejects.toThrow("Retire");
  await recordEveCodeSandboxDeletion(owner, row.id, name);
  expect(await listEveCodeSandboxesForDeletion(owner, row.id)).toEqual([]);
  await expect(
    confirmEveCodeSandboxCreation(owner, row.id, name)
  ).rejects.toThrow("ownership");
});
