import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { testToolContext } from "../../tests/helpers/eve-tool-context";
import type { DocumentWrite } from "../eve/document-repository";

const postgres = new PGlite();
vi.mock("./client", () => ({ db: drizzle(postgres) }));
vi.mock("@/lib/env", () => ({ env: {} }));
vi.mock("@/lib/config", () => ({
  config: { ai: { workflows: { chat: "mock" } } },
}));
const rows = async (sql: string) => {
  const result = await postgres.query(sql);
  return result.rows;
};
const { reserveSlackConversation, bindSlackSession } =
  await import("@/chatjs/plugins/slack-documents/slack-store");
const { slackDocuments } =
  await import("@/chatjs/plugins/slack-documents/slack-documents");
const actor = (
  teamId = "T1",
  userId = "U1",
  channelId = "C1",
  threadTs = "1"
) => ({
  authenticator: "slack-webhook",
  principalType: "user",
  principalId: `slack:${teamId}:${userId}`,
  issuer: `slack:${teamId}`,
  attributes: {
    user_id: userId,
    channel_id: channelId,
    thread_ts: threadTs,
  },
});
const session = (id = "root", identity = actor()) => ({
  id,
  auth: { current: identity, initiator: identity },
});
const workspace = (teamId: string) => ({
  teamId,
  channelIds: ["C1", "C2"],
  userIds: ["U1", "U2"],
});
const documentId = "00000000-0000-4000-8000-000000000001";
const input: DocumentWrite = {
  turnIndex: 1,
  documentId,
  operationId: "create",
  expectedRevisionId: null,
  kind: "text",
  title: "Shared",
  content: "First",
  fileIds: [],
};
beforeAll(async () => {
  const directory = new URL("migrations/", import.meta.url);
  const entries = await readdir(directory);
  const files = entries.filter((name) => name.endsWith(".sql")).toSorted();
  const migrations = await Promise.all(
    files.map(async (name) => await readFile(new URL(name, directory), "utf-8"))
  );
  await postgres.exec(migrations.join("\n"));
}, 30_000);
beforeEach(async () => {
  vi.stubEnv(
    "CHATJS_SLACK_DOCUMENTS",
    JSON.stringify({
      workspaces: [workspace("T1"), workspace("T2")],
    })
  );
  await postgres.exec('TRUNCATE "SlackConversation" CASCADE');
  await reserveSlackConversation({
    teamId: "T1",
    channelId: "C1",
    threadTs: "1",
    direct: false,
  });
  await reserveSlackConversation({
    teamId: "T1",
    channelId: "C1",
    threadTs: "2",
    direct: false,
  });
  await reserveSlackConversation({
    teamId: "T2",
    channelId: "C2",
    threadTs: "1",
    direct: false,
  });
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await postgres.close();
});

test("document resource bindings reject conflicting workspaces and unauthorized callers", async () => {
  await expect(
    reserveSlackConversation({
      teamId: "T2",
      channelId: "C1",
      threadTs: "1",
      direct: false,
    })
  ).rejects.toThrow("different workspace");
  await expect(
    bindSlackSession(session("root", actor("T1", "U3")))
  ).rejects.toThrow("not authorized");
  await bindSlackSession(session());
  await expect(
    bindSlackSession(session("root", actor("T2", "U1", "C2")))
  ).rejects.toThrow("identity conflict");
});

test("conversation participants edit shared documents with separate creator and actor identities", async () => {
  const creator = await slackDocuments(
    testToolContext({
      session: { ...session(), turn: { id: "turn", sequence: 1 } },
    })
  );
  const created = await creator.save(input);
  expect(await creator.save(input)).toEqual(created);
  await expect(
    creator.save({ ...input, content: "conflicting retry" })
  ).rejects.toThrow("identity conflict");
  const collaborator = {
    ...session(),
    auth: { initiator: actor(), current: actor("T1", "U2") },
  };
  const editor = await slackDocuments(
    testToolContext({
      session: { ...collaborator, turn: { id: "turn2", sequence: 2 } },
    })
  );
  expect(await editor.read(documentId)).toEqual(created);
  const edited = await editor.save({
    ...input,
    operationId: "edit",
    expectedRevisionId: created.id,
    content: "Second",
  });
  const current = await creator.read(documentId);
  expect(current?.id).toBe(edited.id);
  await expect(
    creator.save({
      ...input,
      operationId: "stale",
      expectedRevisionId: created.id,
    })
  ).rejects.toThrow("changed");
  expect(await rows('SELECT "creatorId" FROM "SlackDocument"')).toEqual([
    { creatorId: "slack:T1:U1" },
  ]);
  expect(
    await rows(
      'SELECT "actorId" FROM "SlackDocumentRevision" ORDER BY "createdAt"'
    )
  ).toEqual([{ actorId: "slack:T1:U1" }, { actorId: "slack:T1:U2" }]);
});

test("document IDs cannot cross workspace or conversation boundaries or import web files", async () => {
  const creator = await slackDocuments(
    testToolContext({
      session: { ...session(), turn: { id: "turn", sequence: 1 } },
    })
  );
  const created = await creator.save(input);
  const targets: [string, ReturnType<typeof actor>][] = [
    ["other-workspace", actor("T2", "U1", "C2")],
    ["other-thread", actor("T1", "U1", "C1", "2")],
  ];
  await Promise.all(
    targets.map(async ([id, identity]) => {
      const foreign = await slackDocuments(
        testToolContext({
          session: {
            ...session(id, identity),
            turn: { id: "turn", sequence: 1 },
          },
        })
      );
      expect(await foreign.read(documentId)).toBeUndefined();
      await expect(
        foreign.save({ ...input, expectedRevisionId: created.id })
      ).rejects.toThrow("not found");
    })
  );
  await expect(
    creator.save({ ...input, fileIds: ["private-web-file"] })
  ).rejects.toThrow("private web files");
  expect(
    await creator.read("00000000-0000-4000-8000-000000000099")
  ).toBeUndefined();
});

test("specialist bindings require a persisted parent in the same conversation", async () => {
  const child = {
    ...session("child"),
    parent: {
      sessionId: "root",
      rootSessionId: "root",
      callId: "specialist-call",
      turn: { id: "turn", sequence: 1 },
      task: { id: "task", name: "planner" },
    },
  };
  await expect(bindSlackSession(child)).rejects.toThrow("parent binding");
  await bindSlackSession(session());
  expect(await bindSlackSession(child)).toMatchObject({
    rootSessionId: "root",
    rootTurnId: "turn",
  });
  await expect(
    bindSlackSession({
      ...child,
      id: "foreign-child",
      auth: session("ignored", actor("T1", "U1", "C1", "2")).auth,
    })
  ).rejects.toThrow("parent binding");
});
