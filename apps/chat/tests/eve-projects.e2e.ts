/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/eve-deletion"; "../lib/db/eve-queries"; "../lib/db/queries"; "../lib/db/schema" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
/* oxlint-disable eslint/require-await -- Async mocks preserve the Promise-returning production callback contract. */
import { eq, inArray } from "drizzle-orm";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { afterAll, expect, test, vi } from "vitest";
/* oxlint-enable sort-imports */

import { db } from "../lib/db/client";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { completeEveConversationDeletion } from "../lib/db/eve-deletion";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  beginEveConversationDeletion,
  createEveConversation,
  getEveConversation,
  getEveConversationProject,
  getEveCreation,
  listEveConversations,
} from "../lib/db/eve-queries";
/* oxlint-enable sort-imports */
import { assignEveConversationProject } from "../lib/db/queries";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  eveChatProject,
  eveConversation,
  project,
  user,
} from "../lib/db/schema";
/* oxlint-enable sort-imports */
import { env } from "../lib/env";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

vi.mock("server-only", () => ({}));
assertEveTestDatabase(env.DATABASE_URL);
const owner = crypto.randomUUID();
const stranger = crypto.randomUUID();
const ownProject = crypto.randomUUID();
const foreignProject = crypto.randomUUID();
// oxlint-disable-next-line node/no-top-level-await -- This Bun database suite creates the owner and stranger before their project fixtures.
await db.insert(user).values(
  [owner, stranger].map((id) => ({
    email: `${id}@test.invalid`,
    id,
    name: "Project test",
  }))
);
// oxlint-disable-next-line node/no-top-level-await -- This Bun database suite creates owned and foreign projects before registering authorization scenarios.
await db.insert(project).values([
  {
    id: ownProject,
    instructions: "Owner-only instructions",
    name: "Owner project",
    userId: owner,
  },
  {
    id: foreignProject,
    instructions: "Foreign instructions",
    name: "Foreign project",
    userId: stranger,
  },
]);
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve afterAll's awaited sequencing and rejected-Promise behavior. */
afterAll(async () => {
  await db
    .delete(eveConversation)
    .where(inArray(eveConversation.ownerId, [owner, stranger]));
  await db.delete(project).where(inArray(project.userId, [owner, stranger]));
  await db.delete(user).where(inArray(user.id, [owner, stranger]));
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve conversation's awaited sequencing and rejected-Promise behavior. Native-session fixture resolves crypto.randomUUID() for createEveConversation; synchronous return would fail its create callback contract. */
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep conversation's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
async function conversation() {
  return await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Project fixture",
    async () => crypto.randomUUID()
  );
}
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * typescript/prefer-readonly-parameter-types (#565): test("assignment, filtered history and removal retain native identity") accepts item; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): test("assignment, filtered history and removal retain native identity") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
// oxlint-disable-next-line max-statements -- Keep the ordered database scenario intact while naming the awaited results.
test("assignment, filtered history and removal retain native identity", async () => {
  const row = await conversation();
  expect(await assignEveConversationProject(owner, row.id, ownProject)).toEqual(
    { conversationId: row.id, projectId: ownProject }
  );
  expect(await getEveConversationProject(owner, row.id)).toEqual({
    id: ownProject,
    instructions: "Owner-only instructions",
    name: "Owner project",
  });
  const conversationsInProject = await listEveConversations(owner, {
    projectId: ownProject,
    search: "",
  });
  expect(conversationsInProject.items).toEqual([
    expect.objectContaining({ id: row.id, projectId: ownProject }),
  ]);
  const conversationsWithoutProject = await listEveConversations(owner, {
    projectId: null,
    search: "",
  });
  expect(
    conversationsWithoutProject.items.some(
      (item) => item.conversationId === row.id
    )
  ).toBe(false);
  await assignEveConversationProject(owner, row.id, null);
  expect(await getEveConversationProject(owner, row.id)).toBeNull();
  const detachedConversation = await getEveConversation(owner, row.id);
  // oxlint-disable-next-line oxc/no-optional-chaining -- A detached conversation may be absent; preserve the undefined result for that valid state. The app guidance prefers optional chaining.
  expect(detachedConversation?.sessionId).toBe(row.sessionId);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable unicorn/max-nested-calls, unicorn/no-null --
 * unicorn/max-nested-calls (#568): test("both application checks and database constraints reject cross-owner assignment" keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * unicorn/no-null (#570): test("both application checks and database constraints reject cross-owner assignment" preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
// oxlint-disable-next-line max-statements -- Keep the ordered database scenario intact while naming the awaited result.
test("both application checks and database constraints reject cross-owner assignment", async () => {
  const row = await conversation();
  await assignEveConversationProject(owner, row.id, ownProject);
  expect(
    await assignEveConversationProject(owner, row.id, foreignProject)
  ).toBeNull();
  expect(
    await assignEveConversationProject(stranger, row.id, foreignProject)
  ).toBeNull();
  expect(await assignEveConversationProject(stranger, row.id, null)).toBeNull();
  expect(await getEveConversationProject(stranger, row.id)).toBeNull();
  const strangerProjectConversations = await listEveConversations(stranger, {
    projectId: ownProject,
    search: "",
  });
  expect(strangerProjectConversations.items).toEqual([]);
  await expect(
    db
      .update(eveChatProject)
      .set({ projectId: foreignProject })
      .where(
        inArray(
          eveChatProject.chatId,
          db
            .select({ chatId: eveConversation.chatId })
            .from(eveConversation)
            .where(eq(eveConversation.id, row.id))
        )
      )
  ).rejects.toThrow();
  const existingProject = await getEveConversationProject(owner, row.id);
  // oxlint-disable-next-line oxc/no-optional-chaining -- A missing project is a valid result; preserve the undefined value for that state. The app guidance prefers optional chaining.
  expect(existingProject?.id).toBe(ownProject);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable unicorn/max-nested-calls, unicorn/no-null */

/* oxlint-disable typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * typescript/prefer-readonly-parameter-types (#565): test("deleting a project detaches its Eve conversations without erasing their session accepts item; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): test("deleting a project detaches its Eve conversations without erasing their session preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
// oxlint-disable-next-line max-statements -- Keep the ordered database scenario intact while naming the awaited results.
test("deleting a project detaches its Eve conversations without erasing their sessions", async () => {
  const projectId = crypto.randomUUID();
  await db
    .insert(project)
    .values({ id: projectId, name: "Disposable project", userId: owner });
  const row = await conversation();
  await assignEveConversationProject(owner, row.id, projectId);
  await db.delete(project).where(eq(project.id, projectId));
  expect(await getEveConversationProject(owner, row.id)).toBeNull();
  const detachedConversation = await getEveConversation(owner, row.id);
  // oxlint-disable-next-line oxc/no-optional-chaining -- A detached conversation may be absent; preserve the undefined result for that valid state. The app guidance prefers optional chaining.
  expect(detachedConversation?.sessionId).toBe(row.sessionId);
  const conversationsWithoutProject = await listEveConversations(owner, {
    projectId: null,
    search: "",
  });
  expect(
    conversationsWithoutProject.items.some(
      (item) => item.conversationId === row.id
    )
  ).toBe(true);
  expect(
    await assignEveConversationProject(owner, row.id, projectId)
  ).toBeNull();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable no-magic-numbers, unicorn/max-nested-calls, unicorn/no-null --
 * no-magic-numbers (#517): test("conversation deletion fences assignment and removes metadata without touching t uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * unicorn/max-nested-calls (#568): test("conversation deletion fences assignment and removes metadata without touching t keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * unicorn/no-null (#570): test("conversation deletion fences assignment and removes metadata without touching t preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
test("conversation deletion fences assignment and removes metadata without touching the project", async () => {
  const row = await conversation();
  await assignEveConversationProject(owner, row.id, ownProject);
  await beginEveConversationDeletion(owner, row.id);
  expect(await getEveConversationProject(owner, row.id)).toBeNull();
  expect(
    await assignEveConversationProject(owner, row.id, ownProject)
  ).toBeNull();
  expect(await assignEveConversationProject(owner, row.id, null)).toBeNull();
  await completeEveConversationDeletion(owner, row.id);
  expect(
    await db
      .select()
      .from(eveChatProject)
      .where(
        inArray(
          eveChatProject.chatId,
          db
            .select({ chatId: eveConversation.chatId })
            .from(eveConversation)
            .where(eq(eveConversation.id, row.id))
        )
      )
  ).toEqual([]);
  expect(
    await db.select().from(project).where(eq(project.id, ownProject))
  ).toHaveLength(1);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. Native-session fixture resolves crypto.randomUUID() for createEveConversation; synchronous return would fail its create callback contract. */
/* oxlint-enable no-magic-numbers, unicorn/max-nested-calls, unicorn/no-null */

/* oxlint-disable max-statements, typescript/explicit-function-return-type, typescript/promise-function-async, unicorn/max-nested-calls, unicorn/no-null --
 * max-statements (#512): test("fork paths share their chat project and retry cannot restore an old assignment" keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/explicit-function-return-type (#560): Keep test("fork paths share their chat project and retry cannot restore an old assignment"'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/promise-function-async (#606): test("fork paths share their chat project and retry cannot restore an old assignment" preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * unicorn/max-nested-calls (#568): test("fork paths share their chat project and retry cannot restore an old assignment" keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * unicorn/no-null (#570): test("fork paths share their chat project and retry cannot restore an old assignment" preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
// oxlint-disable-next-line max-statements -- Keep the ordered database scenario intact while naming the awaited results.
test("fork paths share their chat project and retry cannot restore an old assignment", async () => {
  const source = await conversation();
  await assignEveConversationProject(owner, source.id, ownProject);
  const operationId = crypto.randomUUID();
  const createFork = () =>
    createEveConversation(
      owner,
      operationId,
      "Fork fixture",
      async () => crypto.randomUUID(),
      { fork: { beforeTurnId: "turn_0", conversationId: source.id } }
    );
  const fork = await createFork();
  const forkProject = await getEveConversationProject(owner, fork.id);
  // oxlint-disable-next-line oxc/no-optional-chaining -- A missing project is a valid result; preserve the undefined value for that state. The app guidance prefers optional chaining.
  expect(forkProject?.id).toBe(ownProject);
  await assignEveConversationProject(owner, source.id, null);
  const repeatedFork = await createFork();
  expect(repeatedFork.id).toBe(fork.id);
  expect(await getEveConversationProject(owner, fork.id)).toBeNull();
  await beginEveConversationDeletion(owner, source.id);
  await completeEveConversationDeletion(owner, source.id);
  expect(
    await db
      .select()
      .from(eveChatProject)
      .where(
        inArray(
          eveChatProject.chatId,
          db
            .select({ chatId: eveConversation.chatId })
            .from(eveConversation)
            .where(eq(eveConversation.id, fork.id))
        )
      )
  ).toEqual([]);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, typescript/explicit-function-return-type, typescript/promise-function-async, unicorn/max-nested-calls, unicorn/no-null */

/* oxlint-disable typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null --
 * typescript/promise-function-async (#606): test("an unresolved fork retains its project route for creation recovery") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): test("an unresolved fork retains its project route for creation recovery") intentionally keeps the existing falsy-value behavior of pending; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): test("an unresolved fork retains its project route for creation recovery") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
// oxlint-disable-next-line max-statements -- Keep the ordered database scenario intact while naming the awaited result.
test("an unresolved fork retains its project route for creation recovery", async () => {
  const source = await conversation();
  await assignEveConversationProject(owner, source.id, ownProject);
  const operationId = crypto.randomUUID();
  await expect(
    createEveConversation(
      owner,
      operationId,
      "Uncertain fork",
      () => Promise.reject(new Error("Lost creation reply")),
      { fork: { beforeTurnId: "turn_0", conversationId: source.id } }
    )
  ).rejects.toThrow("Lost creation reply");
  const pending = await getEveCreation(owner, operationId);
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading state from pending; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(pending?.state).toBe("uncertain");
  if (!pending) {
    throw new Error("Missing unresolved fork");
  }
  const pendingProject = await getEveConversationProject(owner, pending.id);
  // oxlint-disable-next-line oxc/no-optional-chaining -- A missing project is a valid result; preserve the undefined value for that state. The app guidance prefers optional chaining.
  expect(pendingProject?.id).toBe(ownProject);
  expect(
    await assignEveConversationProject(owner, pending.id, null)
  ).toBeNull();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/promise-function-async --
 * max-statements (#512): test("project creation binds before dispatch and preserves its initial intent through keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("project creation binds before dispatch and preserves its initial intent through uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("project creation binds before dispatch and preserves its initial intent through uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/explicit-function-return-type (#560): Keep test("project creation binds before dispatch and preserves its initial intent through's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/promise-function-async (#606): test("project creation binds before dispatch and preserves its initial intent through preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("project creation binds before dispatch and preserves its initial intent through moves and deletion", async () => {
  const projectId = crypto.randomUUID();
  await db.insert(project).values({
    id: projectId,
    instructions: "First turn instructions",
    name: "Creation project",
    userId: owner,
  });
  const operationId = crypto.randomUUID();
  const dispatch = vi.fn(async (id: string) => {
    expect(await getEveConversationProject(owner, id)).toMatchObject({
      id: projectId,
      instructions: "First turn instructions",
    });
    return crypto.randomUUID();
  });
  const create = (requestedProject: string | undefined) =>
    createEveConversation(owner, operationId, "Project creation", dispatch, {
      fileKeys: [],
      initialProjectId: requestedProject,
    });
  const binding = await create(projectId);
  await assignEveConversationProject(owner, binding.id, ownProject);
  expect(await create(projectId)).toEqual(binding);
  expect(await getEveConversationProject(owner, binding.id)).toMatchObject({
    id: ownProject,
  });
  await expect(create(ownProject)).rejects.toThrow("different");
  await expect(create(undefined)).rejects.toThrow("different");
  await db.delete(project).where(eq(project.id, projectId));
  expect(await create(projectId)).toEqual(binding);
  expect(dispatch).toHaveBeenCalledTimes(1);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. Native-session fixture mock resolves crypto.randomUUID() for createEveConversation; synchronous return would fail its create callback contract. */
/* oxlint-enable max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/promise-function-async */

test("missing and foreign projects reject creation without leaving a reservation or dispatching", async () => {
  const dispatch = vi.fn(async () => crypto.randomUUID());
  for (const projectId of [foreignProject, crypto.randomUUID()]) {
    const operationId = crypto.randomUUID();
    await expect(
      createEveConversation(
        owner,
        operationId,
        "Unauthorized project",
        dispatch,
        { fileKeys: [], initialProjectId: projectId }
      )
    ).rejects.toThrow("Project not found");
    expect(await getEveCreation(owner, operationId)).toBeUndefined();
  }
  expect(dispatch).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
