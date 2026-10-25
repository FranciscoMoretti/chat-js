import { eveDispatch, eveConversation, user } from "../lib/db/schema";
import { createEveTestSession } from "./eve-native-session.fixture";

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
} from "@/plugins/projects/db/project-queries";
import { project, eveChatProject } from "@/plugins/projects/db/project-schema";
import { env } from "../lib/env";
import { assertEveTestDatabase } from "./eve-test-database";

vi.mock("server-only", () => ({}));
assertEveTestDatabase(env.DATABASE_URL);
const owner = crypto.randomUUID();
const stranger = crypto.randomUUID();
const ownProject = crypto.randomUUID();
const foreignProject = crypto.randomUUID();
await db.insert(user).values(
  [owner, stranger].map((id) => ({
    email: `${id}@test.invalid`,
    id,
    name: "Project test",
  }))
);
await db.insert(project).values([
  {
    id: ownProject,
    icon: "folder",
    iconColor: "gray",
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
afterAll(async () => {
  await db
    .delete(eveDispatch)
    .where(inArray(eveDispatch.ownerId, [owner, stranger]));
  await db
    .delete(eveConversation)
    .where(inArray(eveConversation.ownerId, [owner, stranger]));
  await db.delete(project).where(inArray(project.userId, [owner, stranger]));
  await db.delete(user).where(inArray(user.id, [owner, stranger]));
});
const conversation = async () =>
  await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Project fixture",
    createEveTestSession
  );

test("assignment, filtered history and removal retain native identity", async () => {
  const row = await conversation();
  expect(await assignEveConversationProject(owner, row.id, ownProject)).toEqual(
    { conversationId: row.id, projectId: ownProject }
  );
  expect(await getEveConversationProject(owner, row.id)).toEqual({
    id: ownProject,
    icon: "folder",
    iconColor: "gray",
    instructions: "Owner-only instructions",
    name: "Owner project",
  });
  const conversationsInProject = await listEveConversations(owner, {
    projectId: ownProject,
    search: "",
  });
  expect(conversationsInProject.items).toEqual([
    expect.objectContaining({ conversationId: row.id }),
  ]);
  const conversationsWithoutProject = await listEveConversations(owner, {
    projectId: null,
    search: "",
  });
  expect(
    conversationsWithoutProject.items.some(
      (item: Readonly<{ conversationId: string }>) =>
        item.conversationId === row.id
    )
  ).toBe(false);
  await assignEveConversationProject(owner, row.id, null);
  expect(await getEveConversationProject(owner, row.id)).toBeNull();
  const detachedConversation = await getEveConversation(owner, row.id);
  expect(detachedConversation?.sessionId).toBe(row.sessionId);
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
  expect(existingProject?.id).toBe(ownProject);
});

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
  expect(detachedConversation?.sessionId).toBe(row.sessionId);
  const conversationsWithoutProject = await listEveConversations(owner, {
    projectId: null,
    search: "",
  });
  expect(
    conversationsWithoutProject.items.some(
      (item: Readonly<{ conversationId: string }>) =>
        item.conversationId === row.id
    )
  ).toBe(true);
  expect(
    await assignEveConversationProject(owner, row.id, projectId)
  ).toBeNull();
});

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

test("fork paths share their chat project and retry cannot restore an old assignment", async () => {
  const source = await conversation();
  await assignEveConversationProject(owner, source.id, ownProject);
  const operationId = crypto.randomUUID();
  const createFork = async () =>
    await createEveConversation(
      owner,
      operationId,
      "Fork fixture",
      createEveTestSession,
      { fork: { conversationId: source.id } }
    );
  const fork = await createFork();
  const forkProject = await getEveConversationProject(owner, fork.id);
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

test("an unresolved copy follows changes to its chat project", async () => {
  const source = await conversation();
  await assignEveConversationProject(owner, source.id, ownProject);
  const operationId = crypto.randomUUID();
  await expect(
    createEveConversation(
      owner,
      operationId,
      "Uncertain fork",
      vi
        .fn<() => Promise<string>>()
        .mockRejectedValue(new Error("Lost creation reply")),
      { fork: { conversationId: source.id } }
    )
  ).rejects.toThrow("Lost creation reply");
  const pending = await getEveCreation(owner, operationId);
  expect(pending?.state).toBe("uncertain");
  if (pending === undefined) {
    throw new Error("Missing unresolved fork");
  }
  const pendingProject = await getEveConversationProject(owner, pending.id);
  expect(pendingProject?.id).toBe(ownProject);
  expect(
    await assignEveConversationProject(owner, pending.id, null)
  ).toMatchObject({ conversationId: pending.id, projectId: null });
});

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
  const create = async (requestedProject?: string) =>
    await createEveConversation(
      owner,
      operationId,
      "Project creation",
      dispatch,
      {
        fileKeys: [],
        initialRequest: { projectId: requestedProject },
      }
    );
  const binding = await create(projectId);
  await assignEveConversationProject(owner, binding.id, ownProject);
  expect(await create(projectId)).toEqual(binding);
  expect(await getEveConversationProject(owner, binding.id)).toMatchObject({
    id: ownProject,
  });
  expect(await create(ownProject)).toEqual(binding);
  expect(await create()).toEqual(binding);
  await db.delete(project).where(eq(project.id, projectId));
  expect(await create(projectId)).toEqual(binding);
  expect(dispatch).toHaveBeenCalledTimes(1);
});

test("missing and foreign projects reject creation without leaving a reservation or dispatching", async () => {
  const dispatch = vi.fn(createEveTestSession);
  await Promise.all(
    [foreignProject, crypto.randomUUID()].map(async (projectId) => {
      const operationId = crypto.randomUUID();
      await expect(
        createEveConversation(
          owner,
          operationId,
          "Unauthorized project",
          dispatch,
          { fileKeys: [], initialRequest: { projectId } }
        )
      ).rejects.toThrow("Project not found");
      expect(await getEveCreation(owner, operationId)).toBeUndefined();
    })
  );
  expect(dispatch).not.toHaveBeenCalled();
});
