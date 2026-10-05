/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/eve-code-sandboxes"; "../lib/db/eve-deletion"; "../lib/db/eve-queries"; "../lib/db/schema" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/* oxlint-disable eslint/require-await -- Async mocks preserve the Promise-returning production callback contract. */
import { eq } from "drizzle-orm";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { afterAll, expect, test, vi } from "vitest";
/* oxlint-enable sort-imports */

import { db } from "../lib/db/client";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  confirmEveCodeSandboxCreation,
  listEveCodeSandboxesForDeletion,
  recordEveCodeSandboxDeletion,
  reserveEveCodeSandbox,
} from "../lib/db/eve-code-sandboxes";
/* oxlint-enable sort-imports */
import { completeEveConversationDeletion } from "../lib/db/eve-deletion";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  beginEveConversationDeletion,
  createEveConversation,
} from "../lib/db/eve-queries";
/* oxlint-enable sort-imports */
import { eveCodeSandbox, eveConversation, user } from "../lib/db/schema";
import { env } from "../lib/env";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

vi.mock("server-only", () => ({}));
assertEveTestDatabase(env.DATABASE_URL);
const provider = { projectId: "fixture-project", teamId: "fixture-team" };
const owner = crypto.randomUUID();
// oxlint-disable-next-line node/no-top-level-await -- This Bun database suite inserts the sandbox owner before registering ownership scenarios.
await db.insert(user).values({
  email: `${owner}@test.invalid`,
  id: owner,
  name: "Sandbox ownership",
});
afterAll(async () => {
  await db.delete(eveCodeSandbox).where(eq(eveCodeSandbox.ownerId, owner));
  await db.delete(eveConversation).where(eq(eveConversation.ownerId, owner));
  await db.delete(user).where(eq(user.id, owner));
});
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep conversation's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
async function conversation() {
  return await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Sandbox fixture",
    async () => crypto.randomUUID()
  );
}
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable max-statements --
 * max-statements (#512): test("unresolved allocation blocks final deletion until confirmed cleanup; retries re keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
test("unresolved allocation blocks final deletion until confirmed cleanup; retries retain the tombstone", async () => {
  const row = await conversation();
  const name = await reserveEveCodeSandbox(owner, row.id, "call-1", provider);
  await expect(
    reserveEveCodeSandbox(owner, row.id, "call-1", provider)
  ).rejects.toThrow("Reconcile");
  await expect(
    reserveEveCodeSandbox(owner, row.id, "call-1", {
      ...provider,
      projectId: "other-project",
    })
  ).rejects.toThrow("Reconcile");
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
  await expect(
    reserveEveCodeSandbox(owner, row.id, "call-2", provider)
  ).rejects.toThrow("unavailable");
});
/* oxlint-enable max-statements */

test("foreign owners cannot reserve or resolve resources, and completed calls cannot reallocate", async () => {
  const row = await conversation();
  await expect(
    reserveEveCodeSandbox("stranger", row.id, "call", provider)
  ).rejects.toThrow("unavailable");
  const name = await reserveEveCodeSandbox(owner, row.id, "call", provider);
  await expect(
    recordEveCodeSandboxDeletion("stranger", row.id, name)
  ).rejects.toThrow("ownership");
  await recordEveCodeSandboxDeletion(owner, row.id, name);
  await expect(
    reserveEveCodeSandbox(owner, row.id, "call", provider)
  ).rejects.toThrow("Reconcile");
});

test("concurrent allocation and deletion cannot leave an untracked admitted resource", async () => {
  const row = await conversation();
  const [allocation] = await Promise.allSettled([
    reserveEveCodeSandbox(owner, row.id, "racing-call", provider),
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

/* oxlint-disable max-statements --
 * max-statements (#512): test("only a retired owned family can inventory confirmed creation") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
test("only a retired owned family can inventory confirmed creation", async () => {
  const row = await conversation();
  const name = await reserveEveCodeSandbox(
    owner,
    row.id,
    "confirmed",
    provider
  );
  await expect(listEveCodeSandboxesForDeletion(owner, row.id)).rejects.toThrow(
    "Retire"
  );
  await expect(
    confirmEveCodeSandboxCreation("stranger", row.id, name)
  ).rejects.toThrow("ownership");
  await confirmEveCodeSandboxCreation(owner, row.id, name);
  await beginEveConversationDeletion(owner, row.id);
  expect(await listEveCodeSandboxesForDeletion(owner, row.id)).toEqual([
    {
      callId: "confirmed",
      conversationId: row.id,
      creationConfirmed: true,
      name,
      sessionId: row.sessionId,
    },
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
/* oxlint-enable max-statements */
