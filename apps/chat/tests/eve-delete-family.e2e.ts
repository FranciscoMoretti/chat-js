import "./eve-native-session.fixture";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, expect, test, vi } from "vitest";

import { db } from "../lib/db/client";
import {
  recordEveCodeSandboxDeletion,
  reserveEveCodeSandbox,
} from "../lib/db/eve-code-sandboxes";
import { createEveConversation } from "../lib/db/eve-queries";
import {
  eveChat,
  eveCodeSandbox,
  eveConversation,
  user,
} from "../lib/db/schema";
import { env } from "../lib/env";
import { deleteLocalEveConversationFamily } from "../lib/eve/delete-local-conversation";
import { assertEveTestDatabase } from "./eve-test-database";

vi.mock("server-only", () => ({}));
// This suite owns app-family erasure, using synthetic native runs with no VMs.
// Provider authority and removal are exercised by the disposable VM proof.
vi.mock("../lib/eve/verify-local-coverage", () => ({
  verifyLocalEveFamilyCoverage: vi.fn(
    async () =>
      await Promise.resolve({
        appRoot: "/fixture",
        sessions: [],
      })
  ),
  manageEveLocalResources: vi.fn(async () => {
    await Promise.resolve();
  }),
}));

vi.mock("../lib/file-storage", () => ({
  deleteFilesByUrls: () => {
    throw new Error("Unexpected fixture blob");
  },
}));
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
const provider = {
  providerId: "vercel",
  scopeId: "fixture-project",
  accountId: "fixture-team",
};
const owner = crypto.randomUUID();
const sessionIds: string[] = [];
await db.insert(user).values({
  email: `${owner}@test.invalid`,
  id: owner,
  name: "Deletion fixture",
});
afterAll(async () => {
  await db.delete(eveCodeSandbox).where(eq(eveCodeSandbox.ownerId, owner));
  await db.delete(eveConversation).where(eq(eveConversation.ownerId, owner));
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
  const conversation = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Private fixture",
    vi.fn<() => Promise<string>>().mockResolvedValue(sessionId),
    parentId === undefined || parentId === null || parentId === ""
      ? undefined
      : { fork: { conversationId: parentId } }
  );
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
    deleteLocalEveConversationFamily(owner, child.id, "/fixture")
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
    await deleteLocalEveConversationFamily(owner, child.id, "/fixture")
  ).toEqual({ rootId: pending.chatId });
  expect(
    await deleteLocalEveConversationFamily(owner, child.id, "/fixture")
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
