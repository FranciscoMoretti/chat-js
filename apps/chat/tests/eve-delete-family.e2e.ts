import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, expect, test, vi } from "vitest";
import { db } from "../lib/db/client";
import {
  recordEveCodeSandboxDeletion,
  reserveEveCodeSandbox,
} from "../lib/db/eve-code-sandboxes";
import { createEveConversation } from "../lib/db/eve-queries";
import { eveCodeSandbox, eveConversation, user } from "../lib/db/schema";
import { env } from "../lib/env";
import { deleteLocalEveConversationFamily } from "../lib/eve/delete-local-conversation";
import { assertEveTestDatabase } from "./eve-test-database";

vi.mock("server-only", () => ({}));
// This suite exercises app-family state with synthetic native runs. Real native
// birth receipts and filesystem proof are covered by eve-deletion-retire.
vi.mock("../lib/eve/verify-local-coverage", () => ({
  verifyLocalEveFamilyCoverage: vi.fn(),
}));
// Fixtures below allocate no filesystem or blob resources; keep the test local.
vi.mock("../lib/eve/local-sandbox-fence", () => ({
  fenceLocalEveSandboxMutations: vi.fn(),
}));
vi.mock("../lib/eve/local-sandbox-inventory", () => ({
  readLocalEveSandboxInventory: () =>
    Promise.resolve({ owned: [], unattributedDirectories: [] }),
}));
vi.mock("../lib/file-storage", () => ({
  deleteFilesByUrls: () => {
    throw new Error("Unexpected fixture blob");
  },
}));
assertEveTestDatabase(env.DATABASE_URL);
if (!env.WORKFLOW_POSTGRES_URL) {
  throw new Error("Missing native database");
}
assertEveTestDatabase(env.WORKFLOW_POSTGRES_URL);
const native = postgres(env.WORKFLOW_POSTGRES_URL, { max: 2 });
const owner = crypto.randomUUID();
const sessionIds: string[] = [];
await db.insert(user).values({
  id: owner,
  name: "Deletion fixture",
  email: `${owner}@test.invalid`,
});
afterAll(async () => {
  await db.delete(eveCodeSandbox).where(eq(eveCodeSandbox.ownerId, owner));
  await db.delete(eveConversation).where(eq(eveConversation.ownerId, owner));
  await db.delete(user).where(eq(user.id, owner));
  for (const sessionId of sessionIds) {
    await native`delete from workflow.workflow_stream_chunks where run_id = ${sessionId}`;
    await native`delete from workflow.workflow_runs where id = ${sessionId}`;
    await native`delete from workflow.eve_session_retirements where session_id = ${sessionId}`;
    await native`delete from workflow.eve_payload_purges where session_id = ${sessionId}`;
    await native`delete from workflow.eve_queue_purge_runs where session_id = ${sessionId}`;
    await native`delete from workflow.eve_resource_fences where resource in ${native([`run:${sessionId}`, `stream:${sessionId}`])}`;
  }
  await native.end();
});
async function fixture(parentId?: string) {
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
    () => Promise.resolve(sessionId),
    parentId
      ? { fork: { conversationId: parentId, beforeTurnId: "turn_0" } }
      : undefined
  );
  return { ...conversation, sessionId };
}

test("full deletion keeps uncertain resources pending, then erases only its family and retries after payload removal", async () => {
  const target = await fixture();
  const child = await fixture(target.id);
  const unrelated = await fixture();
  const name = await reserveEveCodeSandbox(
    owner,
    target.id,
    "unallocated-fixture"
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
  // The test never invoked an allocator for this reservation.
  await recordEveCodeSandboxDeletion(owner, target.id, name);
  expect(
    await deleteLocalEveConversationFamily(owner, child.id, "/fixture")
  ).toEqual({ rootId: target.id });
  expect(
    await deleteLocalEveConversationFamily(owner, child.id, "/fixture")
  ).toEqual({ rootId: target.id });
  for (const member of [target, child]) {
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
      state: "deleted",
      firstMessage: "",
      title: null,
    });
  }
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
