import { readFile, readdir } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, expect, expectTypeOf, test, vi } from "vitest";

import type { eveConversation, project } from "./schema";

const postgres = new PGlite();
vi.mock("./client", () => ({ db: drizzle(postgres) }));
vi.mock("@/lib/env", () => ({ env: {} }));

const {
  getDeletingEveConversationForSession,
  getEveConversationProject,
  getEveCreation,
  ownsEveSession,
  readEveSessionMapping,
  updateEveConversationMetadata,
} = await import("./eve-queries");

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
    `insert into "EveConversation" (id,"chatId","ownerId","operationId","firstMessage","sessionId",state) values ($1,$1,'owner',$1,'Research','native','bound')`,
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
  expectTypeOf(mapping).toEqualTypeOf<
    | Pick<
        typeof eveConversation.$inferSelect,
        "creationKind" | "id" | "ownerId" | "sessionId" | "state"
      >
    | undefined
  >();
  expect(mapping).toMatchObject({ id: conversationId, state: "bound" });
  expect(await readEveSessionMapping({ sessionId: "native" })).toEqual(mapping);
  expect(
    await readEveSessionMapping({ reservationId: missingId })
  ).toBeUndefined();
  expect(await readEveSessionMapping({ sessionId: "unknown" })).toBeUndefined();
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
  expectTypeOf(absent).toEqualTypeOf<
    Pick<typeof eveConversation.$inferSelect, "id"> | undefined
  >();
  expect(absent).toBeUndefined();
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
  ).toBeUndefined();
  expect(
    await getDeletingEveConversationForSession("owner", "unknown")
  ).toBeUndefined();
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
    "id" | "instructions" | "name"
  > | null>();
  expect(unassigned).toBeNull();
});
