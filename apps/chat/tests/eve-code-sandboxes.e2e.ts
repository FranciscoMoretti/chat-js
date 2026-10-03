/* oxlint-disable import/no-relative-parent-imports, sort-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/eve-code-sandboxes"; "../lib/db/eve-deletion"; "../lib/db/eve-queries"; "../lib/db/schema" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/* oxlint-disable eslint/require-await -- Async mocks preserve the Promise-returning production callback contract. */
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
/* oxlint-enable import/no-relative-parent-imports, sort-imports */

vi.mock("server-only", () => ({}));
assertEveTestDatabase(env.DATABASE_URL);
const provider = { projectId: "fixture-project", teamId: "fixture-team" };
const owner = crypto.randomUUID();
/* oxlint-disable node/no-top-level-await --
 * node/no-top-level-await (#539): await db.insert(user).values({ email: `${owner}@test.in runs in the configured Bun/ESM entrypoint and must finish before following module work; do not introduce background initialization.
 */
await db.insert(user).values({
  email: `${owner}@test.invalid`,
  id: owner,
  name: "Sandbox ownership",
});
/* oxlint-enable node/no-top-level-await */
/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): afterAll sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
afterAll(async () => {
  await db.delete(eveCodeSandbox).where(eq(eveCodeSandbox.ownerId, owner));
  await db.delete(eveConversation).where(eq(eveConversation.ownerId, owner));
  await db.delete(user).where(eq(user.id, owner));
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await, typescript/explicit-function-return-type --
 * oxc/no-async-await (#540): conversation sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
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
/* oxlint-enable oxc/no-async-await, typescript/explicit-function-return-type */

/* oxlint-disable max-statements, oxc/no-async-await, oxc/no-rest-spread-properties --
 * max-statements (#512): test("unresolved allocation blocks final deletion until confirmed cleanup; retries re keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-async-await (#540): test("unresolved allocation blocks final deletion until confirmed cleanup; retries re sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): test("unresolved allocation blocks final deletion until confirmed cleanup; retries re copies or separates ...provider while preserving existing object ownership; mutating source objects is not equivalent.
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
/* oxlint-enable max-statements, oxc/no-async-await, oxc/no-rest-spread-properties */

/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): test("foreign owners cannot reserve or resolve resources, and completed calls cannot  sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
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
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): test("concurrent allocation and deletion cannot leave an untracked admitted resource" sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
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
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable max-statements, oxc/no-async-await --
 * max-statements (#512): test("only a retired owned family can inventory confirmed creation") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-async-await (#540): test("only a retired owned family can inventory confirmed creation") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
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
/* oxlint-enable max-statements, oxc/no-async-await */
