/* oxlint-disable eslint/no-shadow -- Nested callback names mirror the protocol fields and transaction APIs under test. */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
/* oxlint-disable eslint/require-await -- Async mocks preserve the Promise-returning production callback contract. */
/* oxlint-disable unicorn/no-await-expression-member -- Direct awaited assertions keep each test action tied to its expectation. */
import { eq } from "drizzle-orm";
import { afterAll, expect, test, vi } from "vitest";

import { db } from "../lib/db/client";
import { completeEveConversationDeletion } from "../lib/db/eve-deletion";
import {
  beginEveConversationDeletion,
  createEveConversation,
  getEveCreation,
} from "../lib/db/eve-queries";
import {
  getEveResponseGroup,
  getEveResponseGroupForConversation,
  recordEveResponseGroupRejection,
  reserveEveResponseGroup,
} from "../lib/db/eve-response-groups";
import { eveConversation, eveResponseGroup, user } from "../lib/db/schema";
import { env } from "../lib/env";
import { createEveConversationOperation } from "../lib/eve/create-conversation-operation";
import { createEveResponseGroup } from "../lib/eve/response-group";
import { assertEveTestDatabase } from "./eve-test-database";

vi.mock("server-only", () => ({}));
vi.mock("../lib/eve/create-conversation-operation", () => ({
  createEveConversationOperation: vi.fn(),
}));
assertEveTestDatabase(env.DATABASE_URL);
const owner = crypto.randomUUID();
await db.insert(user).values({
  email: `${owner}@test.invalid`,
  id: owner,
  name: "Response group test",
});
afterAll(async () => {
  await db.delete(eveResponseGroup).where(eq(eveResponseGroup.ownerId, owner));
  // Fork foreign keys require deleting children before roots.
  const rows = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.ownerId, owner));
  for (const row of rows.filter((row) => row.parentConversationId)) {
    await db.delete(eveConversation).where(eq(eveConversation.id, row.id));
  }
  await db.delete(eveConversation).where(eq(eveConversation.ownerId, owner));
  await db.delete(user).where(eq(user.id, owner));
});

test("parallel reservations and partial dispatch retries keep ordered exact identities", async () => {
  const input = {
    message: "Compare these models",
    modelIds: ["model-a", "model-b", "model-c"],
    operationId: crypto.randomUUID(),
  };
  const [left, right] = await Promise.all([
    reserveEveResponseGroup(owner, input),
    reserveEveResponseGroup(owner, input),
  ]);
  expect(left).toEqual(right);
  await expect(
    reserveEveResponseGroup(owner, {
      ...input,
      modelIds: [...input.modelIds].toReversed(),
    })
  ).rejects.toThrow("different message");
  await expect(
    reserveEveResponseGroup(owner, { ...input, message: "Different" })
  ).rejects.toThrow("different message");
  let failSecond = true;
  const nativeCalls: string[] = [];
  vi.mocked(createEveConversationOperation).mockImplementation(
    async (ownerId, operation) => {
      if (operation.modelId === "model-b" && failSecond) {
        return Response.json({ error: "Unavailable" }, { status: 503 });
      }
      const binding = await createEveConversation(
        ownerId,
        operation.operationId,
        String(operation.message),
        (id) => {
          nativeCalls.push(id);
          return Promise.resolve(`session-${id}`);
        },
        { fork: operation.fork, initialModelId: operation.modelId }
      );
      return Response.json(binding);
    }
  );
  const first = await createEveResponseGroup(owner, input);
  expect(first.candidates.map((candidate) => candidate.state)).toEqual([
    "bound",
    "unresolved",
    "bound",
  ]);
  failSecond = false;
  const retried = await createEveResponseGroup(owner, input);
  expect(retried.candidates.map((candidate) => candidate.operationId)).toEqual(
    left.candidates.map((candidate) => candidate.operationId)
  );
  expect(
    retried.candidates.every((candidate) => candidate.state === "bound")
  ).toBe(true);
  expect(new Set(nativeCalls).size).toBe(3);
  expect(nativeCalls).toHaveLength(3);
  const root = await getEveCreation(owner, left.candidates[0].operationId);
  for (const candidate of left.candidates.slice(1)) {
    const child = await getEveCreation(owner, candidate.operationId);
    expect(child?.parentConversationId).toBe(root?.id);
    expect(child?.rootConversationId).toBe(root?.id);
    expect(child?.forkTurnId).toBe("turn_0");
  }
});

test("unconfirmed initial creation never starts independent secondary roots", async () => {
  vi.mocked(createEveConversationOperation)
    .mockReset()
    .mockResolvedValue(Response.json({ error: "Lost reply" }, { status: 409 }));
  const input = {
    message: "Wait for root",
    modelIds: ["model-a", "model-b"],
    operationId: crypto.randomUUID(),
  };
  const result = await createEveResponseGroup(owner, input);
  expect(result.candidates.map((candidate) => candidate.state)).toEqual([
    "unresolved",
    "waiting",
  ]);
  expect(createEveConversationOperation).toHaveBeenCalledTimes(1);
});

test("continuation candidates share one source checkpoint and reject inaccessible sources", async () => {
  const source = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Original",
    (id) => Promise.resolve(`source-${id}`)
  );
  vi.mocked(createEveConversationOperation)
    .mockReset()
    .mockImplementation(async (ownerId, operation) => {
      const binding = await createEveConversation(
        ownerId,
        operation.operationId,
        String(operation.message),
        (id) => Promise.resolve(`continued-${id}`),
        { fork: operation.fork, initialModelId: operation.modelId }
      );
      return Response.json(binding);
    });
  const fork = { beforeTurnId: "turn_0", conversationId: source.id };
  const input = {
    fork,
    message: "Continue",
    modelIds: ["model-a", "model-b"],
    operationId: crypto.randomUUID(),
  };
  const result = await createEveResponseGroup(owner, input);
  expect(
    result.candidates.every((candidate) => candidate.state === "bound")
  ).toBe(true);
  for (const candidate of result.candidates) {
    const row = await getEveCreation(owner, candidate.operationId);
    expect(row?.parentConversationId).toBe(source.id);
    expect(row?.forkTurnId).toBe(fork.beforeTurnId);
  }
  await expect(
    createEveResponseGroup(owner, {
      ...input,
      fork: { ...fork, conversationId: crypto.randomUUID() },
      operationId: crypto.randomUUID(),
    })
  ).rejects.toThrow("Source conversation not found");
});

test("definitive rejection is distinct from uncertainty and repeated model choices remain independent", async () => {
  const input = {
    message: "Five responses",
    modelIds: ["model-a", "model-a", "model-b", "model-c", "model-d"],
    operationId: crypto.randomUUID(),
  };
  const group = await reserveEveResponseGroup(owner, input);
  expect(group.candidates.map((candidate) => candidate.modelId)).toEqual(
    input.modelIds
  );
  expect(
    new Set(group.candidates.map((candidate) => candidate.operationId)).size
  ).toBe(5);
  vi.mocked(createEveConversationOperation)
    .mockReset()
    .mockResolvedValue(
      Response.json(
        { creationRejected: true, error: "Model unavailable" },
        { status: 400 }
      )
    );
  const result = await createEveResponseGroup(owner, input);
  expect(result.candidates[0]).toMatchObject({
    error: "Model unavailable",
    state: "rejected",
  });
  expect(
    result.candidates
      .slice(1)
      .every((candidate) => candidate.state === "waiting")
  ).toBe(true);
});

test("deleting a partial family erases group payloads and fences unstarted candidates", async () => {
  const input = {
    message: "Private group",
    modelIds: ["model-a", "model-b"],
    operationId: crypto.randomUUID(),
  };
  const group = await reserveEveResponseGroup(owner, input);
  const root = await createEveConversation(
    owner,
    group.candidates[0].operationId,
    input.message,
    async (id) => `session-${id}`
  );
  const forkInput = {
    ...input,
    fork: { beforeTurnId: "turn_0", conversationId: root.id },
    operationId: crypto.randomUUID(),
  };
  const pendingFork = await reserveEveResponseGroup(owner, forkInput);
  const unrelated = await reserveEveResponseGroup(owner, {
    ...input,
    operationId: crypto.randomUUID(),
  });
  await beginEveConversationDeletion(owner, root.id);
  await completeEveConversationDeletion(owner, root.id);
  for (const { saved, original } of [
    { original: input, saved: group },
    { original: forkInput, saved: pendingFork },
  ]) {
    const [row] = await db
      .select()
      .from(eveResponseGroup)
      .where(eq(eveResponseGroup.id, saved.id));
    expect(row).toMatchObject({
      candidateOperationIds: saved.candidateOperationIds,
      candidates: null,
      deleted: true,
      inputHash: null,
    });
    await expect(reserveEveResponseGroup(owner, original)).rejects.toThrow(
      "deleted"
    );
  }
  await expect(
    createEveConversation(
      owner,
      group.candidates[1].operationId,
      input.message,
      async () => "must-not-create",
      { fork: { beforeTurnId: "turn_0", conversationId: root.id } }
    )
  ).rejects.toThrow();
  await expect(
    createEveConversation(
      owner,
      group.candidates[1].operationId,
      input.message,
      async () => "must-not-create-root"
    )
  ).rejects.toThrow("response group has been deleted");
  const [untouched] = await db
    .select()
    .from(eveResponseGroup)
    .where(eq(eveResponseGroup.id, unrelated.id));
  expect(untouched.deleted).toBe(false);
  expect(untouched.inputHash).toBe(unrelated.inputHash);
});

test("group reservation racing retirement cannot leave an active unstarted group", async () => {
  const root = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Race",
    async (id) => `session-${id}`
  );
  const input = {
    fork: { beforeTurnId: "turn_0", conversationId: root.id },
    message: "Concurrent",
    modelIds: ["model-a", "model-b"],
    operationId: crypto.randomUUID(),
  };
  await Promise.allSettled([
    reserveEveResponseGroup(owner, input),
    beginEveConversationDeletion(owner, root.id),
  ]);
  const rows = await db
    .select()
    .from(eveResponseGroup)
    .where(eq(eveResponseGroup.operationId, input.operationId));
  expect(
    rows.every(
      (row) => row.deleted && row.candidates === null && row.inputHash === null
    )
  ).toBe(true);
  await expect(
    reserveEveResponseGroup(owner, {
      ...input,
      operationId: crypto.randomUUID(),
    })
  ).rejects.toThrow("unavailable");
});

test("pre-contract groups block erasure until an exact replay recovers their source identity", async () => {
  const root = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Old group",
    async (id) => `session-${id}`
  );
  const input = {
    fork: { beforeTurnId: "turn_0", conversationId: root.id },
    message: "Preserved",
    modelIds: ["model-a", "model-b"],
    operationId: crypto.randomUUID(),
  };
  const group = await reserveEveResponseGroup(owner, input);
  await db
    .update(eveResponseGroup)
    .set({ sourceConversationId: null, sourceIdentityKnown: false })
    .where(eq(eveResponseGroup.id, group.id));
  await expect(beginEveConversationDeletion(owner, root.id)).rejects.toThrow(
    "Recover saved response group"
  );
  await reserveEveResponseGroup(owner, input);
  await beginEveConversationDeletion(owner, root.id);
  const [row] = await db
    .select()
    .from(eveResponseGroup)
    .where(eq(eveResponseGroup.id, group.id));
  expect(row).toMatchObject({
    deleted: true,
    sourceConversationId: root.id,
    sourceIdentityKnown: true,
  });
});

test("owner-only group reads preserve order and rejection recovery without exposing intent hashes", async () => {
  const input = {
    message: "Read group",
    modelIds: ["model-a", "model-b"],
    operationId: crypto.randomUUID(),
  };
  const group = await reserveEveResponseGroup(owner, input);
  const first = await createEveConversation(
    owner,
    group.candidates[0].operationId,
    input.message,
    async (id) => `session-${id}`
  );
  await recordEveResponseGroupRejection(
    owner,
    group.id,
    group.candidates[1].operationId,
    { code: "project_not_found", error: "Project missing" }
  );
  const result = await getEveResponseGroup(owner, group.id);
  expect(result?.candidates.map((candidate) => candidate.state)).toEqual([
    "bound",
    "rejected",
  ]);
  expect(result?.candidates[1]).toMatchObject({ code: "project_not_found" });
  expect(result).not.toHaveProperty("inputHash");
  expect(await getEveResponseGroupForConversation(owner, first.id)).toEqual(
    result
  );
  expect(await getEveResponseGroup("other-owner", group.id)).toBeUndefined();
  expect(
    await getEveResponseGroupForConversation("other-owner", first.id)
  ).toBeUndefined();
  await recordEveResponseGroupRejection(
    owner,
    group.id,
    group.candidates[1].operationId
  );
  expect(
    (await getEveResponseGroup(owner, group.id))?.candidates[1].state
  ).toBe("waiting");
  await beginEveConversationDeletion(owner, first.id);
  expect(await getEveResponseGroup(owner, group.id)).toBeUndefined();
  await expect(
    recordEveResponseGroupRejection(
      owner,
      group.id,
      group.candidates[1].operationId,
      { error: "late write" }
    )
  ).rejects.toThrow("unavailable");
});

test("an in-flight candidate prevents family erasure until its binding resolves", async () => {
  const input = {
    message: "In flight",
    modelIds: ["model-a", "model-b"],
    operationId: crypto.randomUUID(),
  };
  const group = await reserveEveResponseGroup(owner, input);
  const entered = Promise.withResolvers<undefined>();
  const release = Promise.withResolvers<undefined>();
  const creation = createEveConversation(
    owner,
    group.candidates[0].operationId,
    input.message,
    async (id) => {
      entered.resolve(undefined);
      await release.promise;
      return `session-${id}`;
    }
  );
  await entered.promise;
  try {
    const root = await getEveCreation(owner, group.candidates[0].operationId);
    if (!root) {
      throw new Error("Missing creating candidate");
    }
    await expect(beginEveConversationDeletion(owner, root.id)).rejects.toThrow(
      "Finish recovering"
    );
  } finally {
    release.resolve(undefined);
  }
  const root = await creation;
  await beginEveConversationDeletion(owner, root.id);
  await expect(createEveResponseGroup(owner, input)).rejects.toThrow("deleted");
  expect(
    await getEveCreation(owner, group.candidates[1].operationId)
  ).toBeUndefined();
});
