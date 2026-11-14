import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";

const postgres = new PGlite();
vi.mock("./client", () => ({ db: drizzle(postgres) }));
const {
  prepareEveFamilyFilePurge,
  completeEveFilePurge,
  releaseEveFamilyFileReferences,
} = await import("./eve-file-purge");
const { prepareEveOrphanedFilePurge } = await import("./eve-orphaned-files");
const { cleanupWorkspaceIfUnused } = await import("./eve-workspace-deletion");
const source = "00000000-0000-4000-8000-000000000001";
const fork = "00000000-0000-4000-8000-000000000002";
const chatId = "00000000-0000-4000-8000-000000000003";
const workspaceId = "00000000-0000-4000-8000-000000000004";

beforeAll(async () => {
  const directory = new URL("migrations/", import.meta.url);
  const entries = await readdir(directory);
  const names = entries.filter((name) => name.endsWith(".sql")).toSorted();
  const migrations = await Promise.all(
    names.map(async (name) => await readFile(new URL(name, directory), "utf-8"))
  );
  await postgres.exec(migrations.join("\n"));
  await postgres.exec(`
    INSERT INTO "user" (id,name,email) VALUES ('owner','owner','owner'),('foreign','foreign','foreign');
    INSERT INTO "EveChat" (id,"ownerId",title) VALUES ('${chatId}','owner','Test');
    INSERT INTO "EveWorkspace" (id,"ownerId") VALUES ('${workspaceId}','owner');
    INSERT INTO "EveConversation" ("workspaceId",id,"chatId","ownerId","operationId","firstMessage",state)
      VALUES ('${workspaceId}','${source}','${chatId}','owner','${source}','Source','bound'),
             ('${workspaceId}','${fork}','${chatId}','owner','${fork}','Fork','bound');
  `);
}, 30_000);
beforeEach(async () => {
  await postgres.exec(`
    DELETE FROM "EveFileReference"; DELETE FROM "EveStoredFile";
    UPDATE "EveConversation" SET state='bound'; UPDATE "EveWorkspace" SET state='active',"activeOperationId"=NULL;
    INSERT INTO "EveStoredFile" (key,"ownerId","createdAt") VALUES ('shared','owner','2020-01-01'),('unreferenced','owner','2020-01-01'),('foreign','foreign','2020-01-01');
    INSERT INTO "EveFileReference" ("conversationId",key,"ownerId") VALUES ('${source}','shared','owner'),('${fork}','shared','owner');
  `);
});
afterAll(async () => {
  await postgres.close();
});

test("conversation references retain originals until their final reader is deleted", async () => {
  await postgres.exec(
    `UPDATE "EveConversation" SET state='deleting' WHERE id='${source}'`
  );
  expect(await prepareEveFamilyFilePurge("owner", source)).toEqual([]);
  await releaseEveFamilyFileReferences("owner", source);
  const orphans = await prepareEveOrphanedFilePurge(
    ["shared", "unreferenced"],
    new Date("2021-01-01")
  );
  expect(orphans).toEqual([{ key: "unreferenced", ownerId: "owner" }]);
  await expect(prepareEveFamilyFilePurge("foreign", fork)).rejects.toThrow(
    "pending deletion"
  );
  await postgres.exec(
    `UPDATE "EveConversation" SET state='deleting' WHERE id='${fork}'`
  );
  expect(await prepareEveFamilyFilePurge("owner", fork)).toEqual(["shared"]);
  await expect(releaseEveFamilyFileReferences("owner", fork)).rejects.toThrow(
    "cleanup is incomplete"
  );
  await completeEveFilePurge("owner", ["shared"]);
  await releaseEveFamilyFileReferences("owner", fork);
  expect(await prepareEveFamilyFilePurge("owner", fork)).toEqual([]);
  const { rows } = await postgres.query(
    "SELECT state FROM \"EveStoredFile\" WHERE key='foreign'"
  );
  expect(rows).toEqual([{ state: "active" }]);
});

test("workspace metadata cleanup retains owner, live conversation and active operation checks without sandbox registration", async () => {
  await expect(
    cleanupWorkspaceIfUnused("foreign", workspaceId, true)
  ).rejects.toThrow("ownership");
  await expect(
    cleanupWorkspaceIfUnused("owner", workspaceId, true)
  ).rejects.toThrow("attached conversations");
  await postgres.exec(
    `UPDATE "EveConversation" SET state='deleting'; UPDATE "EveWorkspace" SET "activeOperationId"='${source}'`
  );
  await expect(cleanupWorkspaceIfUnused("owner", workspaceId)).rejects.toThrow(
    "turn retirement"
  );
  await postgres.exec('UPDATE "EveWorkspace" SET "activeOperationId"=NULL');
  await cleanupWorkspaceIfUnused("owner", workspaceId);
  await cleanupWorkspaceIfUnused("owner", workspaceId);
  const { rows } = await postgres.query('SELECT state FROM "EveWorkspace"');
  expect(rows).toEqual([{ state: "deleted" }]);
});
