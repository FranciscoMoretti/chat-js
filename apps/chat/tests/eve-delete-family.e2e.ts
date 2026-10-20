import "./eve-native-session.fixture";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, expect, test, vi } from "vitest";

import { db } from "../lib/db/client";
import {
  recordEveCodeSandboxDeletion,
  reserveEveCodeSandbox,
} from "../lib/db/eve-code-sandboxes";
import { insertEveConversationFixtures } from "./eve-conversation-fixture";
import {
  resolvePersistentIdentity,
  retirePersistentSession,
  cleanupPersistentSession,
  cleanupWorkspaceIfUnused,
} from "../lib/eve/persistent-sandbox-store";
import {
  eveChat,
  eveCodeSandbox,
  eveConversation,
  eveWorkspace,
  eveSandboxSession,
  evePersistentSandbox,
  eveWorkspaceAttachment,
  eveStoredFile,
  eveFileReference,
  user,
} from "../lib/db/schema";
import { env } from "../lib/env";
import { deleteLocalEveConversationFamily } from "../lib/eve/delete-local-conversation";
import { purgeEveWorkspaceFiles } from "../lib/eve/purge-files";
import { assertEveTestDatabase } from "./eve-test-database";

const provider = {
  providerId: "vercel",
  scopeId: "fixture-project",
  accountId: "fixture-team",
};
vi.mock("server-only", () => ({}));
// Real app/native PostgreSQL deletion with a mocked external sandbox and blob provider.
const providers = vi.hoisted(() => ({
  remove: vi.fn<() => Promise<void>>().mockResolvedValue(),
  files: vi.fn<() => Promise<void>>().mockResolvedValue(),
}));
vi.mock("../lib/eve/verify-local-coverage", () => ({
  verifyLocalEveFamilyCoverage: vi.fn(
    async (
      ownerId: string,
      appRoot: string,
      inventories: { sessionId: string }[]
    ) => {
      const sessions = [];
      for (const { sessionId } of inventories) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Mirror coordinator retirement before resource cleanup.
        const identity = await resolvePersistentIdentity({
          sessionId,
          rootSessionId: sessionId,
          ownerId,
        });
        // oxlint-disable-next-line eslint/no-await-in-loop -- All writers must be retired before any workspace deletion.
        await retirePersistentSession(identity);
        sessions.push(identity);
      }
      return { appRoot, sessions };
    }
  ),
  manageEveLocalResources: vi.fn(
    async (
      ownerId: string,
      identity: Awaited<ReturnType<typeof resolvePersistentIdentity>>
    ) => {
      if (identity.ownerId !== ownerId) {
        throw new Error("Owner mismatch");
      }
      await cleanupPersistentSession(identity, () => ({
        scope: provider,
        persistent: {
          stop: providers.remove,
          deleteAndConfirmAbsent: providers.remove,
        },
      }));
    }
  ),
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
  await db.delete(eveCodeSandbox).where(eq(eveCodeSandbox.ownerId, owner));
  await db
    .delete(eveWorkspaceAttachment)
    .where(eq(eveWorkspaceAttachment.ownerId, owner));
  await db.delete(eveFileReference).where(eq(eveFileReference.ownerId, owner));
  await db.delete(eveStoredFile).where(eq(eveStoredFile.ownerId, owner));
  await db
    .delete(eveSandboxSession)
    .where(eq(eveSandboxSession.ownerId, owner));
  const ownedWorkspaces = db
    .select({ id: eveWorkspace.id })
    .from(eveWorkspace)
    .where(eq(eveWorkspace.ownerId, owner));
  await db
    .delete(evePersistentSandbox)
    .where(inArray(evePersistentSandbox.workspaceId, ownedWorkspaces));
  await db.delete(eveConversation).where(eq(eveConversation.ownerId, owner));
  await db.delete(eveChat).where(eq(eveChat.ownerId, owner));
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
    parentConversationId: parentId,
    rootConversationId: parentId,
  });
  return { ...conversation, sessionId };
};

test("full deletion keeps uncertain resources pending, then erases only its family and retries after payload removal", async () => {
  const target = await fixture();
  const child = await fixture(target.id);
  const unrelated = await fixture();
  const name = await reserveEveCodeSandbox(
    owner,
    target.id,
    "unallocated-fixture",
    provider
  );
  await expect(
    deleteLocalEveConversationFamily(owner, target.chatId, "/fixture")
  ).rejects.toThrow("uncertain code sandbox creation");
  expect(
    await native`select id from workflow.workflow_runs where id = ${target.sessionId}`
  ).toHaveLength(1);
  const [pending] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, target.id));
  expect(pending.state).toBe("deleting");
  expect(pending.chatId).not.toBe(target.id);
  // The test never invoked an allocator for this reservation.
  await recordEveCodeSandboxDeletion(owner, target.id, name);
  expect(
    await deleteLocalEveConversationFamily(owner, target.chatId, "/fixture")
  ).toEqual({ rootId: pending.chatId });
  expect(
    await deleteLocalEveConversationFamily(owner, target.chatId, "/fixture")
  ).toEqual({ rootId: pending.chatId });
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
    .where(eq(eveChat.id, pending.chatId));
  expect(deletedChat).toMatchObject({
    activeConversationId: null,
    title: "",
  });
  expect(
    await deleteLocalEveConversationFamily("foreign", unrelated.id, "/fixture")
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
      deleteLocalEveConversationFamily(owner, target.id, "/fixture")
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
    .set({ activeConversationId: original.id })
    .where(eq(eveChat.id, original.chatId));
  const key = crypto.randomUUID();
  await db.insert(eveStoredFile).values({ key, ownerId: owner });
  await db
    .insert(eveFileReference)
    .values({ key, conversationId: original.id, ownerId: owner });
  await db.insert(eveWorkspaceAttachment).values({
    fileKey: key,
    workspaceId: original.workspaceId,
    ownerId: owner,
    sha256: "fixture-original",
    paths: ["/workspace/.eve/attachments/original.png"],
  });
  providers.files.mockClear();
  expect(
    await deleteLocalEveConversationFamily(owner, original.id, "/fixture")
  ).toEqual({ rootId: original.id });
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
  expect(chat.activeConversationId).toBe(fork.id);
  expect(
    await db
      .select()
      .from(eveFileReference)
      .where(eq(eveFileReference.key, key))
  ).toEqual([]);
  expect(
    await native`select id from workflow.workflow_runs where id = ${fork.sessionId}`
  ).toHaveLength(1);
  expect(
    await deleteLocalEveConversationFamily(owner, original.id, "/fixture")
  ).toEqual({ rootId: original.id });
  expect(
    await deleteLocalEveConversationFamily(owner, fork.id, "/fixture")
  ).toEqual({ rootId: fork.id });
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
    await deleteLocalEveConversationFamily(owner, original.chatId, "/fixture")
  ).toEqual({ rootId: original.chatId });
  expect(providers.files).toHaveBeenCalledOnce();
});

test("explicit empty workspace deletion retries original blob cleanup without exposing other owners", async () => {
  const workspaceId = crypto.randomUUID();
  const key = crypto.randomUUID();
  await db.insert(eveWorkspace).values({ id: workspaceId, ownerId: owner });
  await db.insert(eveStoredFile).values({ key, ownerId: owner });
  await db.insert(eveWorkspaceAttachment).values({
    workspaceId,
    fileKey: key,
    ownerId: owner,
    sha256: "fixture-original",
  });
  await expect(purgeEveWorkspaceFiles(owner, workspaceId)).rejects.toThrow(
    "resources must be deleted"
  );
  await cleanupWorkspaceIfUnused(
    owner,
    workspaceId,
    () => ({
      scope: provider,
      persistent: {
        stop: providers.remove,
        deleteAndConfirmAbsent: providers.remove,
      },
    }),
    true
  );
  await expect(purgeEveWorkspaceFiles("foreign", workspaceId)).rejects.toThrow(
    "resources must be deleted"
  );
  providers.files.mockClear();
  providers.files.mockRejectedValueOnce(new Error("Storage offline"));
  await expect(purgeEveWorkspaceFiles(owner, workspaceId)).rejects.toThrow(
    "Storage offline"
  );
  const [pending] = await db
    .select()
    .from(eveStoredFile)
    .where(eq(eveStoredFile.key, key));
  expect(pending.state).toBe("deleting");
  await purgeEveWorkspaceFiles(owner, workspaceId);
  await purgeEveWorkspaceFiles(owner, workspaceId);
  const [deleted] = await db
    .select()
    .from(eveStoredFile)
    .where(eq(eveStoredFile.key, key));
  expect(deleted.state).toBe("deleted");
  expect(providers.files).toHaveBeenCalledTimes(2);
});
