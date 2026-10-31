import type { ChatServerIntegration } from "@/chatjs/core/chat/contracts";
import { sharingChat } from "@/chatjs/plugins/sharing/chat";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, expect, test, vi } from "vitest";

const postgres = new PGlite();
vi.mock("./client", () => ({ db: drizzle(postgres) }));
vi.mock("@/lib/env", () => ({ env: {} }));
const installed = vi.hoisted(() => {
  const plugins: ChatServerIntegration[] = [];
  return { plugins };
});
vi.mock("@/chatjs/generated/installed-chat", () => ({
  installedChat: installed.plugins,
}));
const { getSharing, setSharing, getPublicEveConversation } =
  await import("@/chatjs/plugins/sharing/queries");
const { canReadEveFile } = await import("./eve-files");
const { getAccessibleEveDocument, saveEveDocumentRevision } =
  await import("./eve-documents");
const chat = "00000000-0000-4000-8000-000000000001";
const conversation = "00000000-0000-4000-8000-000000000002";
beforeAll(async () => {
  const directory = new URL("migrations/", import.meta.url);
  const entries = await readdir(directory);
  const files = entries.filter((name) => name.endsWith(".sql")).toSorted();
  const migrations = await Promise.all(
    files.map(async (name) => await readFile(new URL(name, directory), "utf-8"))
  );
  await postgres.exec(migrations.join("\n"));
  await postgres.exec(`
    INSERT INTO "user" (id,name,email) VALUES ('owner','owner','owner');
    INSERT INTO "EveChat" (id,"ownerId",title) VALUES ('${chat}','owner','Fallback');
    INSERT INTO "EveWorkspace" (id,"ownerId") VALUES ('${chat}','owner');
    INSERT INTO "EveConversation" ("workspaceId",id,"chatId","ownerId","operationId","firstMessage","sessionId",state)
    VALUES ('${chat}','${conversation}','${chat}','owner','${conversation}','Fallback','session','bound');
  `);
  await postgres.exec(`
    INSERT INTO "EveStoredFile" (key,"ownerId") VALUES ('file','owner');
    INSERT INTO "EveFileReference" (key,"ownerId","conversationId") VALUES ('file','owner','${conversation}');
  `);
  await saveEveDocumentRevision({
    ownerId: "owner",
    conversationId: conversation,
    documentId: chat,
    expectedRevisionId: null,
    operationId: "save",
    content: "Shared content",
    title: "Document",
    kind: "text",
    fileIds: [],
    turnIndex: 0,
  });
}, 30_000);
afterAll(async () => {
  await postgres.close();
});

test("public access requires Sharing, exact conversation ownership, and a live public flag", async () => {
  expect(await setSharing("other", conversation, "public")).toBeUndefined();
  expect(await getSharing("other", conversation)).toBeUndefined();
  expect(await setSharing("owner", chat, "public")).toBeUndefined();
  expect(await setSharing("owner", conversation, "public")).toEqual({
    id: conversation,
  });
  expect(await canReadEveFile("file")).toEqual({
    allowed: false,
    managed: true,
  });
  expect(
    await getAccessibleEveDocument(undefined, conversation, chat)
  ).toBeUndefined();
  expect(await canReadEveFile("file", "owner")).toEqual({
    allowed: true,
    managed: true,
  });
  expect(
    await getAccessibleEveDocument("owner", conversation, chat)
  ).toMatchObject({ canEdit: true });
  installed.plugins.push(sharingChat);
  expect(await getPublicEveConversation(conversation)).toMatchObject({
    id: conversation,
  });
  expect(await canReadEveFile("file")).toEqual({
    allowed: true,
    managed: true,
  });
  expect(
    await getAccessibleEveDocument(undefined, conversation, chat)
  ).toMatchObject({ canEdit: false, revision: { content: "Shared content" } });
  expect(
    await getAccessibleEveDocument("other", conversation, chat)
  ).toMatchObject({ canEdit: false });
  await setSharing("owner", conversation, "private");
  expect(await getPublicEveConversation(conversation)).toBeUndefined();
  expect(await canReadEveFile("file")).toEqual({
    allowed: false,
    managed: true,
  });
  expect(
    await getAccessibleEveDocument(undefined, conversation, chat)
  ).toBeUndefined();
  await setSharing("owner", conversation, "public");
  await postgres.exec(
    `UPDATE "EveConversation" SET state='deleting' WHERE id='${conversation}'`
  );
  expect(await setSharing("owner", conversation, "public")).toBeUndefined();
  expect(await getPublicEveConversation(conversation)).toBeUndefined();
  expect(await canReadEveFile("file")).toEqual({
    allowed: false,
    managed: true,
  });
  expect(
    await getAccessibleEveDocument("owner", conversation, chat)
  ).toBeUndefined();
});
