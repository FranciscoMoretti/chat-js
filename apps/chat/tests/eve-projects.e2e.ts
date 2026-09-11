import { eq, inArray } from "drizzle-orm";
import { afterAll, expect, test, vi } from "vitest";
import { db } from "../lib/db/client";
import { completeEveConversationDeletion } from "../lib/db/eve-deletion";
import {
  beginEveConversationDeletion,
  createEveConversation,
  getEveConversation,
  getEveCreation,
  listEveConversations,
} from "../lib/db/eve-queries";
import {
  assignEveConversationProject,
  getEveConversationProject,
} from "../lib/db/queries";
import {
  chat,
  eveConversation,
  eveConversationProject,
  project,
  user,
} from "../lib/db/schema";
import { env } from "../lib/env";
import { assertEveTestDatabase } from "./eve-test-database";

vi.mock("server-only", () => ({}));
assertEveTestDatabase(env.DATABASE_URL);
const owner = crypto.randomUUID();
const stranger = crypto.randomUUID();
const ownProject = crypto.randomUUID();
const foreignProject = crypto.randomUUID();
const legacyId = crypto.randomUUID();
await db.insert(user).values(
  [owner, stranger].map((id) => ({
    id,
    email: `${id}@test.invalid`,
    name: "Project test",
  }))
);
await db.insert(project).values([
  {
    id: ownProject,
    userId: owner,
    name: "Owner project",
    instructions: "Owner-only instructions",
  },
  {
    id: foreignProject,
    userId: stranger,
    name: "Foreign project",
    instructions: "Foreign instructions",
  },
]);
await db.insert(chat).values({
  id: legacyId,
  userId: owner,
  projectId: ownProject,
  title: "Legacy fixture",
  createdAt: new Date(),
});
afterAll(async () => {
  await db
    .delete(eveConversation)
    .where(inArray(eveConversation.ownerId, [owner, stranger]));
  await db.delete(chat).where(eq(chat.id, legacyId));
  await db.delete(project).where(inArray(project.userId, [owner, stranger]));
  await db.delete(user).where(inArray(user.id, [owner, stranger]));
});
async function conversation() {
  return await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Project fixture",
    async () => crypto.randomUUID()
  );
}

test("assignment, filtered history and removal retain native identity and exclude legacy conversations", async () => {
  const row = await conversation();
  expect(await assignEveConversationProject(owner, row.id, ownProject)).toEqual(
    { conversationId: row.id, projectId: ownProject }
  );
  expect(await getEveConversationProject(owner, row.id)).toEqual({
    id: ownProject,
    name: "Owner project",
    instructions: "Owner-only instructions",
  });
  expect(
    (await listEveConversations(owner, { search: "", projectId: ownProject }))
      .items
  ).toEqual([expect.objectContaining({ id: row.id, projectId: ownProject })]);
  expect(
    (
      await listEveConversations(owner, { search: "", projectId: null })
    ).items.some((item) => item.id === row.id)
  ).toBe(false);
  expect(
    (await listEveConversations(owner)).items.some(
      (item) => item.id === legacyId
    )
  ).toBe(false);
  await assignEveConversationProject(owner, row.id, null);
  expect(await getEveConversationProject(owner, row.id)).toBeNull();
  expect((await getEveConversation(owner, row.id))?.sessionId).toBe(
    row.sessionId
  );
});

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
  expect(
    (
      await listEveConversations(stranger, {
        search: "",
        projectId: ownProject,
      })
    ).items
  ).toEqual([]);
  await expect(
    db
      .update(eveConversationProject)
      .set({ projectId: foreignProject })
      .where(eq(eveConversationProject.conversationId, row.id))
  ).rejects.toThrow();
  expect((await getEveConversationProject(owner, row.id))?.id).toBe(ownProject);
});

test("deleting a project detaches its Eve conversations without erasing their sessions", async () => {
  const projectId = crypto.randomUUID();
  await db
    .insert(project)
    .values({ id: projectId, userId: owner, name: "Disposable project" });
  const row = await conversation();
  await assignEveConversationProject(owner, row.id, projectId);
  await db.delete(project).where(eq(project.id, projectId));
  expect(await getEveConversationProject(owner, row.id)).toBeNull();
  expect((await getEveConversation(owner, row.id))?.sessionId).toBe(
    row.sessionId
  );
  expect(
    (
      await listEveConversations(owner, { search: "", projectId: null })
    ).items.some((item) => item.id === row.id)
  ).toBe(true);
  expect(
    await assignEveConversationProject(owner, row.id, projectId)
  ).toBeNull();
});

test("conversation deletion fences assignment and removes metadata without touching legacy rows or the project", async () => {
  const row = await conversation();
  const [legacyBefore] = await db
    .select()
    .from(chat)
    .where(eq(chat.id, legacyId));
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
      .from(eveConversationProject)
      .where(eq(eveConversationProject.conversationId, row.id))
  ).toEqual([]);
  expect(await db.select().from(chat).where(eq(chat.id, legacyId))).toEqual([
    legacyBefore,
  ]);
  expect(
    await db.select().from(project).where(eq(project.id, ownProject))
  ).toHaveLength(1);
});

test("forks inherit their source project once and retry cannot silently move them", async () => {
  const source = await conversation();
  await assignEveConversationProject(owner, source.id, ownProject);
  const operationId = crypto.randomUUID();
  const createFork = () =>
    createEveConversation(
      owner,
      operationId,
      "Fork fixture",
      async () => crypto.randomUUID(),
      undefined,
      undefined,
      { conversationId: source.id, beforeTurnId: "turn_0" }
    );
  const fork = await createFork();
  expect((await getEveConversationProject(owner, fork.id))?.id).toBe(
    ownProject
  );
  await assignEveConversationProject(owner, source.id, null);
  expect((await createFork()).id).toBe(fork.id);
  expect((await getEveConversationProject(owner, fork.id))?.id).toBe(
    ownProject
  );
  await beginEveConversationDeletion(owner, source.id);
  await completeEveConversationDeletion(owner, source.id);
  expect(
    await db
      .select()
      .from(eveConversationProject)
      .where(eq(eveConversationProject.conversationId, fork.id))
  ).toEqual([]);
});

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
      undefined,
      undefined,
      { conversationId: source.id, beforeTurnId: "turn_0" }
    )
  ).rejects.toThrow("Lost creation reply");
  const pending = await getEveCreation(owner, operationId);
  expect(pending?.state).toBe("uncertain");
  if (!pending) {
    throw new Error("Missing unresolved fork");
  }
  expect((await getEveConversationProject(owner, pending.id))?.id).toBe(
    ownProject
  );
  expect(
    await assignEveConversationProject(owner, pending.id, null)
  ).toBeNull();
});
