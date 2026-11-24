import "./eve-native-session.fixture";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, expect, test, vi } from "vitest";

import { db } from "../lib/db/client";
import { insertEveConversationFixtures } from "./eve-conversation-fixture";
import {
  eveChat,
  eveConversation,
  eveWorkspace,
  eveStoredFile,
  eveFileReference,
  user,
} from "../lib/db/schema";
import { env } from "../lib/env";
import { deleteLocalEveConversationFamily } from "../lib/eve/delete-local-conversation";
import { assertEveTestDatabase } from "./eve-test-database";

vi.mock("server-only", () => ({}));
// Real app/native PostgreSQL deletion with a mocked external sandbox and blob provider.
const providers = vi.hoisted(() => ({
  remove: vi.fn<() => Promise<void>>().mockResolvedValue(),
  files: vi.fn<() => Promise<void>>().mockResolvedValue(),
}));
vi.mock("../lib/file-storage", () => ({ deleteFilesByUrls: providers.files }));
assertEveTestDatabase(env.DATABASE_URL);

if (
  env.WORKFLOW_POSTGRES_URL === undefined ||
  env.WORKFLOW_POSTGRES_URL === null ||
  env.WORKFLOW_POSTGRES_URL === ""
) {
  throw new Error("Missing native database");
}

assertEveTestDatabase(env.WORKFLOW_POSTGRES_URL);
const native = postgres(env.WORKFLOW_POSTGRES_URL, { max: 2 });
const owner = crypto.randomUUID();
const sessionIds: string[] = [];
await db.insert(user).values({
  email: `${owner}@test.invalid`,
  id: owner,
  name: "Deletion fixture",
});
afterAll(async () => {
  await db.delete(eveFileReference).where(eq(eveFileReference.ownerId, owner));
  await db.delete(eveStoredFile).where(eq(eveStoredFile.ownerId, owner));
  await db.delete(eveConversation).where(eq(eveConversation.ownerId, owner));
  await db.delete(eveChat).where(eq(eveChat.ownerId, owner));
  await db.delete(eveWorkspace).where(eq(eveWorkspace.ownerId, owner));
  await db.delete(user).where(eq(user.id, owner));
  await Promise.all(
    sessionIds.map(async (sessionId) => {
      await native`delete from workflow.workflow_stream_chunks where run_id = ${sessionId}`;
      await native`delete from workflow.workflow_runs where id = ${sessionId}`;
      await native`delete from workflow.eve_session_retirements where session_id = ${sessionId}`;
      await native`delete from workflow.eve_payload_purges where session_id = ${sessionId}`;
      await native`delete from workflow.eve_queue_purge_runs where session_id = ${sessionId}`;
      await native`delete from workflow.eve_resource_fences where resource in ${native([`run:${sessionId}`, `stream:${sessionId}`])}`;
    })
  );
  await native.end();
});

const fixture = async (parentId?: string) => {
  const sessionId = crypto.randomUUID();
  sessionIds.push(sessionId);
  await native`insert into workflow.workflow_runs(id, name, deployment_id, status, attributes) values (${sessionId}, 'delete-fixture', 'fixture', 'completed', '{}')`;
  await native`insert into workflow.workflow_stream_chunks(id, stream_id, run_id, data, eof) values (${crypto.randomUUID()}, ${sessionId}, ${sessionId}, ${Buffer.from("private fixture")}, true)`;
  // This fixture is already retired; receipt avoids invoking the model/runtime.
  await native`insert into workflow.eve_session_retirements(session_id) values (${sessionId})`;
  const [conversation] = await insertEveConversationFixtures({
    id: crypto.randomUUID(),
    ownerId: owner,
    operationId: crypto.randomUUID(),
    firstMessage: "Private fixture",
    sessionId,
    state: "bound",
    parentBranchId: parentId,
    rootBranchId: parentId,
  });
  return { ...conversation, sessionId };
};

test("full deletion erases only its family and retries after payload removal", async () => {
  const target = await fixture();
  const child = await fixture(target.id);
  const unrelated = await fixture();
  expect(await deleteLocalEveConversationFamily(owner, target.chatId)).toEqual({
    rootId: target.chatId,
  });
  expect(await deleteLocalEveConversationFamily(owner, target.chatId)).toEqual({
    rootId: target.chatId,
  });
  await Promise.all(
    [target, child].map(async (member) => {
      expect(
        await native`select id from workflow.workflow_runs where id = ${member.sessionId}`
      ).toEqual([]);
      expect(
        await native`select id from workflow.workflow_stream_chunks where run_id = ${member.sessionId}`
      ).toEqual([]);
      const [deleted] = await db
        .select()
        .from(eveConversation)
        .where(eq(eveConversation.id, member.id));
      expect(deleted).toMatchObject({
        firstMessage: "",
        state: "deleted",
      });
    })
  );
  const [deletedChat] = await db
    .select()
    .from(eveChat)
    .where(eq(eveChat.id, target.chatId));
  expect(deletedChat).toMatchObject({
    activeBranchId: null,
    title: "",
  });
  expect(
    await deleteLocalEveConversationFamily("foreign", unrelated.id)
  ).toBeUndefined();
  expect(
    await native`select id from workflow.workflow_runs where id = ${unrelated.sessionId}`
  ).toHaveLength(1);
  const [survivor] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, unrelated.id));
  expect(survivor.state).toBe("bound");
});

test("compatibility failure blocks the complete coordinator before revoking access", async () => {
  const target = await fixture();
  await native`alter table graphile_worker._private_jobs disable trigger eve_queue_fence`;
  try {
    await expect(
      deleteLocalEveConversationFamily(owner, target.id)
    ).rejects.toThrow("Workflow lifecycle fences are missing or disabled");
    const [binding] = await db
      .select({ state: eveConversation.state })
      .from(eveConversation)
      .where(eq(eveConversation.id, target.id));
    expect(binding).toEqual({ state: "bound" });
    expect(
      await native`select id from workflow.workflow_runs where id = ${target.sessionId}`
    ).toEqual([{ id: target.sessionId }]);
  } finally {
    await native`alter table graphile_worker._private_jobs enable trigger eve_queue_fence`;
  }
});

test("deleting original keeps shared workspace and original upload until final fork deletion", async () => {
  const original = await fixture();
  const fork = await fixture(original.id);
  await db
    .update(eveChat)
    .set({ activeBranchId: original.id })
    .where(eq(eveChat.id, original.chatId));
  const key = crypto.randomUUID();
  await db.insert(eveStoredFile).values({ key, ownerId: owner });
  await db.insert(eveFileReference).values(
    [original, fork].map(({ id }) => ({
      key,
      branchId: id,
      ownerId: owner,
    }))
  );
  providers.files.mockClear();
  expect(await deleteLocalEveConversationFamily(owner, original.id)).toEqual({
    rootId: original.id,
  });
  expect(providers.files).not.toHaveBeenCalled();
  const [workspace] = await db
    .select()
    .from(eveWorkspace)
    .where(eq(eveWorkspace.id, original.workspaceId));
  const [file] = await db
    .select()
    .from(eveStoredFile)
    .where(eq(eveStoredFile.key, key));
  const [survivor] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, fork.id));
  const [chat] = await db
    .select()
    .from(eveChat)
    .where(eq(eveChat.id, original.chatId));
  expect(workspace.state).toBe("active");
  expect(file.state).toBe("active");
  expect(survivor.state).toBe("bound");
  expect(chat.activeBranchId).toBe(fork.id);
  expect(
    await db
      .select()
      .from(eveFileReference)
      .where(eq(eveFileReference.key, key))
  ).toEqual([expect.objectContaining({ branchId: fork.id, key })]);
  expect(
    await native`select id from workflow.workflow_runs where id = ${fork.sessionId}`
  ).toHaveLength(1);
  expect(await deleteLocalEveConversationFamily(owner, original.id)).toEqual({
    rootId: original.id,
  });
  expect(await deleteLocalEveConversationFamily(owner, fork.id)).toEqual({
    rootId: fork.id,
  });
  expect(providers.files).toHaveBeenCalledOnce();
  const [deletedWorkspace] = await db
    .select()
    .from(eveWorkspace)
    .where(eq(eveWorkspace.id, original.workspaceId));
  const [deletedFile] = await db
    .select()
    .from(eveStoredFile)
    .where(eq(eveStoredFile.key, key));
  expect(deletedWorkspace.state).toBe("deleted");
  expect(deletedFile.state).toBe("deleted");
  expect(
    await deleteLocalEveConversationFamily(owner, original.chatId)
  ).toEqual({ rootId: original.chatId });
  expect(providers.files).toHaveBeenCalledOnce();
});

test("deleting the last never-dispatched fork cleans its retained workspace and originals", async () => {
  const original = await fixture();
  const [waiting] = await insertEveConversationFixtures({
    id: crypto.randomUUID(),
    ownerId: owner,
    operationId: crypto.randomUUID(),
    firstMessage: "Waiting fork",
    state: "creating",
    parentBranchId: original.id,
    rootBranchId: original.id,
  });
  const key = crypto.randomUUID();
  await db.insert(eveStoredFile).values({ key, ownerId: owner });
  await db
    .insert(eveFileReference)
    .values({ key, branchId: waiting.id, ownerId: owner });
  providers.files.mockClear();
  await deleteLocalEveConversationFamily(owner, original.id);
  expect(providers.files).not.toHaveBeenCalled();
  providers.files.mockRejectedValueOnce(new Error("Storage offline"));
  await expect(
    deleteLocalEveConversationFamily(owner, waiting.id)
  ).rejects.toThrow("Storage offline");
  const [pending] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, waiting.id));
  expect(pending).toMatchObject({
    state: "deleting",
    firstMessage: "Waiting fork",
    sessionId: null,
  });
  expect(await deleteLocalEveConversationFamily(owner, waiting.id)).toEqual({
    rootId: waiting.id,
  });
  const [workspace] = await db
    .select()
    .from(eveWorkspace)
    .where(eq(eveWorkspace.id, original.workspaceId));
  const [file] = await db
    .select()
    .from(eveStoredFile)
    .where(eq(eveStoredFile.key, key));
  const [deleted] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, waiting.id));
  expect(workspace.state).toBe("deleted");
  expect(file.state).toBe("deleted");
  expect(deleted).toMatchObject({
    state: "deleted",
    firstMessage: "",
    sessionId: null,
  });
  expect(providers.files).toHaveBeenCalledTimes(2);
});
