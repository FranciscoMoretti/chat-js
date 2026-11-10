import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../lib/db/client";
import { env } from "../lib/env";
import {
  user,
  eveChat,
  eveConversation,
  eveWorkspace,
  eveSandboxSession,
  eveStoredFile,
  eveWorkspaceAttachment,
} from "../lib/db/schema";
import { assertEveTestDatabase } from "./eve-test-database";
import {
  retainWorkspaceAttachment,
  recordWorkspaceAttachment,
  readWorkspaceAttachment,
} from "../lib/eve/workspace-attachments";

const storage = vi.hoisted(() => ({
  bytes: new TextEncoder().encode("immutable uploaded original"),
}));
vi.mock("../lib/file-storage", () => ({
  downloadFile: () => new Blob([storage.bytes], { type: "application/pdf" }),
}));
assertEveTestDatabase(env.DATABASE_URL);
const ownerId = crypto.randomUUID();
const workspaceId = crypto.randomUUID();
const conversationId = crypto.randomUUID();
const chatId = crypto.randomUUID();
const sessionId = crypto.randomUUID();
const key = `${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}.pdf`;
const path =
  "/workspace/.eve/attachments/framework-observed-digest/original.pdf";
const identity = { workspaceId, ownerId };
beforeAll(async () => {
  await db.insert(user).values({
    name: "workspace attachment fixture",
    id: ownerId,
    email: `${ownerId}@example.test`,
  });
  await db.insert(eveWorkspace).values({ id: workspaceId, ownerId });
  await db
    .insert(eveChat)
    .values({ id: chatId, ownerId, title: "workspace attachment fixture" });
  await db.insert(eveConversation).values({
    id: conversationId,
    chatId,
    workspaceId,
    ownerId,
    sessionId,
    state: "bound",
    firstMessage: "fixture",
    operationId: crypto.randomUUID(),
  });
  await db.insert(eveSandboxSession).values({
    sessionId,
    rootSessionId: sessionId,
    conversationId,
    workspaceId,
    ownerId,
    state: "active",
  });
  await db.insert(eveStoredFile).values({ key, ownerId });
});
afterAll(async () => {
  await db
    .delete(eveWorkspaceAttachment)
    .where(eq(eveWorkspaceAttachment.workspaceId, workspaceId));
  await db.delete(eveStoredFile).where(eq(eveStoredFile.key, key));
  await db
    .delete(eveSandboxSession)
    .where(eq(eveSandboxSession.sessionId, sessionId));
  await db
    .delete(eveConversation)
    .where(eq(eveConversation.id, conversationId));
  await db.delete(eveChat).where(eq(eveChat.id, chatId));
  await db.delete(eveWorkspace).where(eq(eveWorkspace.id, workspaceId));
  await db.delete(user).where(eq(user.id, ownerId));
});
test("retains immutable originals independently of selected fork history and rejects changed originals", async () => {
  const original = new Uint8Array(storage.bytes);
  await retainWorkspaceAttachment({
    ownerId,
    sessionId,
    fileKey: key,
    content: original,
  });
  await recordWorkspaceAttachment({ identity, path, content: original });
  await expect(readWorkspaceAttachment({ identity, path })).resolves.toEqual(
    original
  );
  await expect(
    retainWorkspaceAttachment({
      ownerId,
      sessionId,
      fileKey: key,
      content: new TextEncoder().encode("changed"),
    })
  ).rejects.toThrow("bytes changed");
  await expect(
    recordWorkspaceAttachment({
      identity,
      path,
      content: new TextEncoder().encode("changed"),
    })
  ).rejects.toThrow("cannot be overwritten");
  storage.bytes = new TextEncoder().encode("corrupt backing blob");
  await expect(readWorkspaceAttachment({ identity, path })).rejects.toThrow(
    "bytes changed"
  );
  storage.bytes = original;
  await db
    .update(eveStoredFile)
    .set({ state: "deleted" })
    .where(eq(eveStoredFile.key, key));
  await expect(readWorkspaceAttachment({ identity, path })).rejects.toThrow(
    "unavailable"
  );
  await db
    .update(eveSandboxSession)
    .set({ state: "retired" })
    .where(eq(eveSandboxSession.sessionId, sessionId));
  await db
    .delete(eveWorkspaceAttachment)
    .where(eq(eveWorkspaceAttachment.workspaceId, workspaceId));
  await expect(
    retainWorkspaceAttachment({
      ownerId,
      sessionId,
      fileKey: key,
      content: original,
    })
  ).rejects.toThrow("retired");
  expect(
    await db
      .select()
      .from(eveWorkspaceAttachment)
      .where(eq(eveWorkspaceAttachment.workspaceId, workspaceId))
  ).toHaveLength(0);
});
