import type { project } from "@/plugins/projects/db/project-schema";

import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, expect, expectTypeOf, test, vi } from "vitest";

import type { eveConversation } from "./schema";

const postgres = new PGlite();
vi.mock("./client", () => ({ db: drizzle(postgres) }));
vi.mock("@/lib/env", () => ({ env: {} }));

const { getEveConversationProject } =
  await import("@/plugins/projects/db/project-queries");
const {
  getBoundEveConversationForSession,
  getEveConversation,
  getEveChatPageConversation,
  getDeletingEveConversationForSession,
  getEveCreation,
  ownsEveSession,
  readEveSessionMapping,
  updateEveConversationMetadata,
} = await import("./eve-queries");

const { getEveDeletionState } = await import("./eve-deletion");

const conversationId = "00000000-0000-4000-8000-000000000001";
const missingId = "00000000-0000-4000-8000-000000000002";

beforeAll(async () => {
  const directory = new URL("migrations/", import.meta.url);
  const entries = await readdir(directory);
  const filenames = entries.filter((name) => name.endsWith(".sql")).toSorted();
  const migrations = await Promise.all(
    filenames.map(
      async (name) => await readFile(new URL(name, directory), "utf-8")
    )
  );
  await postgres.exec(migrations.join("\n"));
  await postgres.exec(
    `insert into "user" (id,name,email) values ('owner','owner','owner'), ('other','other','other')`
  );
  await postgres.query(
    `insert into "EveChat" (id,"ownerId",title) values ($1,'owner','Research')`,
    [conversationId]
  );
  await postgres.query(
    `insert into "EveWorkspace" (id,"ownerId") values ($1,'owner')`,
    [conversationId]
  );
  await postgres.query(
    `insert into "EveConversation" ("workspaceId",id,"chatId","ownerId","operationId","firstMessage","sessionId",state) values ($1,$1,$1,'owner',$1,'Research','native','bound')`,
    [conversationId]
  );
}, 30_000);

afterAll(async () => {
  await postgres.close();
});

test("session mappings preserve exact identity and tombstones while absent identities stay missing", async () => {
  const mapping = await readEveSessionMapping({
    reservationId: conversationId,
  });
  expectTypeOf(mapping).toEqualTypeOf<Pick<
    typeof eveConversation.$inferSelect,
    | "creationKind"
    | "id"
    | "ownerId"
    | "sessionId"
    | "state"
    | "parentConversationId"
  > | null>();
  expect(mapping).toMatchObject({ id: conversationId, state: "bound" });
  expect(await readEveSessionMapping({ sessionId: "native" })).toEqual(mapping);
  expect(await readEveSessionMapping({ reservationId: missingId })).toBeNull();
  expect(await readEveSessionMapping({ sessionId: "unknown" })).toBeNull();
  expect(await ownsEveSession("owner", "native")).toBe(true);
  expect(await ownsEveSession("other", "native")).toBe(false);

  await postgres.exec(
    `update "EveConversation" set state='deleted' where "sessionId"='native'`
  );
  expect(await readEveSessionMapping({ sessionId: "native" })).toMatchObject({
    id: conversationId,
    state: "deleted",
  });
  expect(await ownsEveSession("owner", "native")).toBe(false);
  await postgres.exec(
    `update "EveConversation" set state='bound' where "sessionId"='native'`
  );
});

test("deletion lookup returns only an owned deleting session", async () => {
  const absent = await getDeletingEveConversationForSession("owner", "native");
  expectTypeOf(absent).toEqualTypeOf<Pick<
    typeof eveConversation.$inferSelect,
    "id"
  > | null>();
  expect(absent).toBeNull();
  await postgres.exec(
    `update "EveConversation" set state='deleting' where "sessionId"='native'`
  );
  expect(await getDeletingEveConversationForSession("owner", "native")).toEqual(
    {
      id: conversationId,
    }
  );
  expect(
    await getDeletingEveConversationForSession("other", "native")
  ).toBeNull();
  expect(
    await getDeletingEveConversationForSession("owner", "unknown")
  ).toBeNull();
  await postgres.exec(
    `update "EveConversation" set state='bound' where "sessionId"='native'`
  );
});

test("creation and metadata lookups preserve no-match results", async () => {
  const missingCreation = await getEveCreation("owner", missingId);
  expectTypeOf(missingCreation).toEqualTypeOf<
    typeof eveConversation.$inferSelect | undefined
  >();
  expect(missingCreation).toBeUndefined();
  expect(await getEveCreation("other", conversationId)).toBeUndefined();
  expect(await getEveCreation("owner", conversationId)).toMatchObject({
    id: conversationId,
    state: "bound",
  });

  const missingUpdate = await updateEveConversationMetadata(
    "owner",
    missingId,
    {
      title: "Missing",
    }
  );
  expectTypeOf(missingUpdate).toEqualTypeOf<
    Pick<typeof eveConversation.$inferSelect, "id"> | undefined
  >();
  expect(missingUpdate).toBeUndefined();
  expect(
    await updateEveConversationMetadata("other", conversationId, {
      visibility: "public",
    })
  ).toBeUndefined();
  expect(
    await updateEveConversationMetadata("owner", conversationId, {
      title: "Updated",
    })
  ).toEqual({ id: conversationId });

  const unassigned = await getEveConversationProject("owner", conversationId);
  expectTypeOf(unassigned).toEqualTypeOf<Pick<
    typeof project.$inferSelect,
    "id" | "instructions" | "name" | "icon" | "iconColor"
  > | null>();
  expect(unassigned).toBeNull();
});

test("owner-visible lookup boundaries return null for missing and foreign identities", async () => {
  expect(await getBoundEveConversationForSession("owner", "native")).toEqual({
    id: conversationId,
  });
  expect(await getBoundEveConversationForSession("other", "native")).toBeNull();
  expect(
    await getBoundEveConversationForSession("owner", "missing")
  ).toBeNull();
  expect(await getEveConversation("owner", conversationId)).toMatchObject({
    id: conversationId,
  });
  expect(await getEveConversation("other", conversationId)).toBeNull();
  expect(await getEveConversation("owner", missingId)).toBeNull();
  expect(await getEveChatPageConversation("other", conversationId)).toBeNull();
  expect(await getEveChatPageConversation("owner", missingId)).toBeNull();
  expect(await getEveDeletionState("owner", conversationId)).toEqual({
    rootId: conversationId,
    state: "bound",
  });
  expect(await getEveDeletionState("other", conversationId)).toBeNull();
  expect(await getEveDeletionState("owner", missingId)).toBeNull();
});

vi.mock("@/lib/eve/workspace-attachments", () => ({
  resolveWorkspaceSeedAttachments: vi.fn(),
}));

vi.mock("@/lib/eve/persistent-sandbox-store", () => ({
  checkDeletedWorkspaceMemberships: vi
    .fn<() => Promise<void>>()
    .mockResolvedValue(),
}));

test("Projects assigns atomically and retries never reconsider membership", async () => {
  const { createEveConversation } = await import("./eve-queries");
  const { assignEveConversationProject } =
    await import("@/plugins/projects/db/project-queries");
  const first = crypto.randomUUID();
  const moved = crypto.randomUUID();
  await postgres.query(
    `insert into "Project" (id,"userId",name) values ($1,'owner','First'), ($2,'owner','Moved')`,
    [first, moved]
  );
  const operationId = crypto.randomUUID();
  const dispatch = vi.fn((id: string): string => `native-${id}`);
  const create = async (projectId: string) =>
    await createEveConversation(
      "owner",
      operationId,
      "Same message",
      dispatch,
      {
        initialRequest: { operationId, message: "Same message", projectId },
      }
    );
  const binding = await create(first);
  expect(await getEveConversationProject("owner", binding.id)).toMatchObject({
    id: first,
  });
  await assignEveConversationProject("owner", binding.id, moved);
  expect(await create(crypto.randomUUID())).toEqual(binding);
  expect(await getEveConversationProject("owner", binding.id)).toMatchObject({
    id: moved,
  });
  await postgres.query(`delete from "Project" where id = $1`, [moved]);
  expect(await create(first)).toEqual(binding);
  expect(await getEveConversationProject("owner", binding.id)).toBeNull();
  expect(dispatch).toHaveBeenCalledTimes(1);
});

test("an invalid initial assignment rolls back the chat reservation", async () => {
  const { createEveConversation } = await import("./eve-queries");
  const operationId = crypto.randomUUID();
  const dispatch = vi.fn((): string => "should-not-dispatch");
  await expect(
    createEveConversation("owner", operationId, "Missing project", dispatch, {
      initialRequest: { projectId: crypto.randomUUID() },
    })
  ).rejects.toThrow("Project not found");
  expect(await getEveCreation("owner", operationId)).toBeUndefined();
  expect(dispatch).not.toHaveBeenCalled();
});

test("an unresolved retry uses the saved dispatch intent after a project change", async () => {
  const { createEveConversation } = await import("./eve-queries");
  const projectId = crypto.randomUUID();
  await postgres.query(
    `insert into "Project" (id,"userId",name) values ($1,'owner','Pending')`,
    [projectId]
  );
  const operationId = crypto.randomUUID();
  const dispatch = vi.fn((): string => {
    throw new Error("connection lost");
  });
  await expect(
    createEveConversation("owner", operationId, "Pending", dispatch, {
      initialRequest: { operationId, message: "Pending", projectId },
    })
  ).rejects.toThrow("connection lost");
  await postgres.query(`delete from "Project" where id = $1`, [projectId]);
  await expect(
    createEveConversation("owner", operationId, "Pending", dispatch, {
      initialRequest: {
        operationId,
        message: "Pending",
        projectId: crypto.randomUUID(),
      },
    })
  ).rejects.toThrow("outcome is unknown");
  expect(dispatch).toHaveBeenCalledTimes(1);
});

test("the extraction migration retains pending recovery context before dropping initialProjectId", async () => {
  const projectId = crypto.randomUUID();
  await postgres.exec(
    'ALTER TABLE "EveConversation" ADD COLUMN "initialProjectId" uuid'
  );
  await postgres.query(
    `UPDATE "EveConversation" SET state='creating', "initialProjectId"=$1, "initialRequest"=$2 WHERE id=$3`,
    [
      projectId,
      { message: "Original payload", modelId: "original-model" },
      conversationId,
    ]
  );
  const migration = await readFile(
    new URL("migrations/0020_organic_black_panther.sql", import.meta.url),
    "utf-8"
  );
  await postgres.exec(migration);
  const recovered = await getEveConversation("owner", conversationId);
  expect(recovered?.initialRequest).toEqual({
    message: "Original payload",
    modelId: "original-model",
    projectId,
  });
});

test("comparison retries ignore initial plugin choices but retain message and model checks", async () => {
  const { reserveEveResponseGroup } = await import("./eve-response-groups");
  const input = {
    operationId: crypto.randomUUID(),
    message: "Compare",
    modelIds: ["one", "two"],
    projectId: crypto.randomUUID(),
  };
  const first = await reserveEveResponseGroup("owner", input);
  const retried = await reserveEveResponseGroup("owner", {
    ...input,
    projectId: crypto.randomUUID(),
  });
  expect(retried.id).toBe(first.id);
  await expect(
    reserveEveResponseGroup("owner", { ...input, message: "Different" })
  ).rejects.toThrow("different message");
  await expect(
    reserveEveResponseGroup("owner", { ...input, modelIds: ["two", "one"] })
  ).rejects.toThrow("different message");
});

test("legacy comparison retries recover the original assignment without weakening message checks", async () => {
  const { reserveEveResponseGroup } = await import("./eve-response-groups");
  const input = {
    operationId: crypto.randomUUID(),
    modelIds: ["one", "two"],
    message: "Legacy comparison",
    selectedTool: "webSearch" as const,
    projectId: crypto.randomUUID(),
  };
  const group = await reserveEveResponseGroup("owner", input);
  const legacyHash = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  await postgres.query(
    `UPDATE "EveResponseGroup" SET "inputHash"=$1 WHERE id=$2`,
    [legacyHash, group.id]
  );
  await postgres.query(
    `INSERT INTO "EveConversation" ("workspaceId","chatId","ownerId","operationId","firstMessage","initialRequest",state) VALUES ($1,$1,'owner',$2,'Legacy comparison',$3,'creating')`,
    [conversationId, group.candidateOperationIds[0], input]
  );
  const retry = { ...input, projectId: crypto.randomUUID() };
  await expect(
    reserveEveResponseGroup("owner", { ...retry, message: "Different" })
  ).rejects.toThrow("different message");
  const retried = await reserveEveResponseGroup("owner", retry);
  expect(retried.id).toBe(group.id);
});

test("plugin history filtering preserves ownership and supplies project navigation", async () => {
  const { createEveConversation, listEveConversations } =
    await import("./eve-queries");
  const projectId = crypto.randomUUID();
  await postgres.query(
    `INSERT INTO "Project" (id,"userId",name) VALUES ($1,'owner','History')`,
    [projectId]
  );
  const chat = await createEveConversation(
    "owner",
    crypto.randomUUID(),
    "History membership",
    (id) => `native-${id}`,
    { initialRequest: { projectId } }
  );
  const reservation = await getEveConversation("owner", chat.id);
  if (!reservation) {
    throw new Error("Expected a reserved conversation");
  }
  const { chatId } = reservation;
  const scoped = await listEveConversations("owner", { projectId, search: "" });
  expect(scoped.items).toEqual([
    expect.objectContaining({
      id: chatId,
      conversationId: chat.id,
      state: "bound",
      href: `/project/${projectId}/chat/${chatId}`,
      parentHref: `/project/${projectId}`,
    }),
  ]);
  const sidebar = await listEveConversations("owner", {
    surface: "sidebar",
    search: "",
  });
  expect(sidebar.items.some((item) => item.id === chatId)).toBe(false);
  const all = await listEveConversations("owner", {
    surface: "all",
    search: "",
  });
  expect(all.items.some((item) => item.id === chatId)).toBe(true);
  const forbidden = await listEveConversations("other", {
    projectId,
    search: "",
  });
  expect(forbidden.items).toEqual([]);
});

test("owned chat mutations resolve legacy IDs and exclude other owners or unavailable sessions", async () => {
  const { updateOwnedChat } = await import("./update-owned-chat");
  const { createEveConversation } = await import("./eve-queries");
  const bound = await createEveConversation(
    "owner",
    crypto.randomUUID(),
    "Mutation coordination",
    (id) => `native-${id}`
  );
  const reservation = await getEveConversation("owner", bound.id);
  if (!reservation) {
    throw new Error("Expected a reserved conversation");
  }
  const mutate = vi
    .fn<Parameters<typeof updateOwnedChat>[1]>()
    .mockResolvedValue({ changed: true });
  expect(
    await updateOwnedChat({ ownerId: "other", chatId: bound.id }, mutate)
  ).toBeNull();
  expect(
    await updateOwnedChat(
      { ownerId: "owner", chatId: crypto.randomUUID() },
      mutate
    )
  ).toBeNull();
  expect(mutate).not.toHaveBeenCalled();
  await postgres.query(
    `UPDATE "EveChat" SET "updatedAt"='2000-01-01' WHERE id=$1`,
    [reservation.chatId]
  );
  expect(
    await updateOwnedChat({ ownerId: "owner", chatId: bound.id }, mutate)
  ).toEqual({ changed: true });
  expect(mutate).toHaveBeenCalledWith(
    expect.objectContaining({ chatId: reservation.chatId })
  );
  const updated = await postgres.query<{ touched: boolean }>(
    `SELECT "updatedAt" > '2000-01-01'::timestamp AS touched FROM "EveChat" WHERE id=$1`,
    [reservation.chatId]
  );
  expect(updated.rows).toEqual([{ touched: true }]);
  mutate.mockClear();
  await postgres.query(
    `UPDATE "EveConversation" SET state='deleting' WHERE id=$1`,
    [bound.id]
  );
  expect(
    await updateOwnedChat(
      { ownerId: "owner", chatId: reservation.chatId },
      mutate
    )
  ).toBeNull();
  expect(mutate).not.toHaveBeenCalled();
});

test("a failed plugin mutation rolls back its writes and the core timestamp", async () => {
  const { updateOwnedChat } = await import("./update-owned-chat");
  const { createEveConversation } = await import("./eve-queries");
  const { eveChatProject } =
    await import("@/plugins/projects/db/project-schema");
  const bound = await createEveConversation(
    "owner",
    crypto.randomUUID(),
    "Rollback",
    (id) => `native-${id}`
  );
  const reservation = await getEveConversation("owner", bound.id);
  if (!reservation) {
    throw new Error("Expected a reserved conversation");
  }
  const projectId = crypto.randomUUID();
  await postgres.query(
    `INSERT INTO "Project" (id,"userId",name) VALUES ($1,'owner','Rollback')`,
    [projectId]
  );
  await postgres.query(
    `UPDATE "EveChat" SET "updatedAt"='2000-01-01' WHERE id=$1`,
    [reservation.chatId]
  );
  await expect(
    updateOwnedChat(
      { ownerId: "owner", chatId: reservation.chatId },
      async ({ tx, chatId }) => {
        await tx
          .insert(eveChatProject)
          .values({ chatId, ownerId: "owner", projectId });
        throw new Error("Plugin write failed");
      }
    )
  ).rejects.toThrow("Plugin write failed");
  expect(await getEveConversationProject("owner", bound.id)).toBeNull();
  const unchanged = await postgres.query<{ original: boolean }>(
    `SELECT "updatedAt" = '2000-01-01'::timestamp AS original FROM "EveChat" WHERE id=$1`,
    [reservation.chatId]
  );
  expect(unchanged.rows).toEqual([{ original: true }]);
});
