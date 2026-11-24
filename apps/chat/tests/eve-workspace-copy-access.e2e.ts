import { eq } from "drizzle-orm";
import type { SessionEvent, SessionStreamEvent } from "eve/client";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { db } from "../lib/db/client";
import { initializeEveCurrentCopy } from "../lib/db/eve-current-copy";
import { canReadEveFile } from "../lib/db/eve-files";
import {
  beginEveConversationDeletion,
  createEveConversation,
  getEveCreation,
} from "../lib/db/eve-queries";
import {
  getEveResponseGroup,
  reserveEveResponseGroup,
} from "../lib/db/eve-response-groups";
import {
  eveChat,
  eveConversation,
  eveDispatch,
  eveFileReference,
  eveResponseGroup,
  eveStoredFile,
  eveWorkspace,
  user,
} from "../lib/db/schema";
import { env } from "../lib/env";
import { prepareEveCopyTranscript } from "../lib/eve/copy-transcript";
import { insertEveConversationFixtures } from "./eve-conversation-fixture";
import { assertEveTestDatabase } from "./eve-test-database";

// Native snapshot transport is mocked; real transcript projection, reservation,
// workspace catalog enrichment and public file authorization use PostgreSQL.
const native = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock("../lib/eve/completed-copy-source", () => ({
  readCompletedEveCopyTranscript: native.capture,
}));

assertEveTestDatabase(env.DATABASE_URL);
const ownerId = crypto.randomUUID();
beforeAll(async () => {
  await db.insert(user).values({
    id: ownerId,
    name: "Workspace copy authorization",
    email: `${ownerId}@example.test`,
  });
});
afterAll(async () => {
  await db
    .delete(eveFileReference)
    .where(eq(eveFileReference.ownerId, ownerId));
  await db.delete(eveStoredFile).where(eq(eveStoredFile.ownerId, ownerId));
  await db.delete(eveDispatch).where(eq(eveDispatch.ownerId, ownerId));
  await db
    .delete(eveResponseGroup)
    .where(eq(eveResponseGroup.ownerId, ownerId));
  await db.delete(eveConversation).where(eq(eveConversation.ownerId, ownerId));
  await db.delete(eveChat).where(eq(eveChat.ownerId, ownerId));
  await db.delete(eveWorkspace).where(eq(eveWorkspace.ownerId, ownerId));
  await db.delete(user).where(eq(user.id, ownerId));
});

test.each(["import:imported:0", "import:imported:1"])(
  "a public fork before %s authorizes only attachments in its selected history",
  async (beforeMessageId) => {
    const earlyKey = `${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}.png`;
    const laterKey = `${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}.pdf`;
    const [source] = await insertEveConversationFixtures({
      ownerId,
      firstMessage: "Private source",
      operationId: crypto.randomUUID(),
      sessionId: crypto.randomUUID(),
      state: "bound",
    });
    await db.insert(eveStoredFile).values([
      { key: earlyKey, ownerId },
      { key: laterKey, ownerId },
    ]);
    await db.insert(eveFileReference).values(
      [earlyKey, laterKey].map((key) => ({
        key,
        branchId: source.id,
        ownerId,
      }))
    );
    const events: (SessionEvent & { meta?: SessionStreamEvent["meta"] })[] = [
      { type: "session.started", data: {} },
      { type: "delivery.admitted", data: { deliveryId: "import" } },
      {
        type: "turn.started",
        scope: { turnId: "import-turn" },
        data: {
          turnId: "import-turn",
          cause: { deliveryId: "import" },
          follows: null,
        },
        meta: { at: "2026-11-02T00:00:00Z", position: { line: 0, index: 0 } },
      },
      {
        type: "delivery.consumed",
        scope: { turnId: "import-turn" },
        meta: {
          at: "2026-11-02T00:00:00Z",
          position: { line: 0, index: 1 },
          endOfLine: true,
        },
        data: {
          deliveryId: "import",
          turnId: "import-turn",
          parts: [],
          history: [
            {
              role: "user",
              parts: [
                {
                  type: "file",

                  url: `http://localhost:3220/api/files/${earlyKey}`,
                  mediaType: "image/png",
                },
              ],
            },
            {
              role: "user",
              parts: [
                {
                  type: "file",

                  url: `http://localhost:3220/api/files/${laterKey}`,
                  mediaType: "application/pdf",
                },
              ],
            },
          ],
        },
      },
      {
        type: "turn.settled",
        scope: { turnId: "import-turn" },
        data: { turnId: "import-turn", outcome: "completed" },
      },
    ];
    const completedEvents: SessionStreamEvent[] = events.map((event, line) => ({
      ...event,
      meta: {
        at: "2026-11-02T00:00:00Z",
        position: { line, index: 0 },
        endOfLine: true,
      },
    }));
    native.capture.mockImplementation(
      async (
        _ownerId: string,
        _sessionId: string,
        _dispatches: unknown,
        _receipts: unknown,
        boundary: string
      ) =>
        await Promise.resolve(
          prepareEveCopyTranscript(completedEvents, [], boundary)
        )
    );
    const selectedKeys =
      beforeMessageId === "import:imported:1" ? [earlyKey] : [];
    const fork = await createEveConversation(
      ownerId,
      crypto.randomUUID(),
      "Edited message",
      async (reservationId) => {
        const references = await db
          .select({ key: eveFileReference.key })
          .from(eveFileReference)
          .where(eq(eveFileReference.branchId, reservationId));
        expect(references.map((row) => row.key)).toEqual(selectedKeys);
        return { sessionId: crypto.randomUUID() };
      },
      { fork: { branchId: source.id, beforeMessageId } }
    );
    await db
      .update(eveConversation)
      .set({ visibility: "public" })
      .where(eq(eveConversation.id, fork.id));

    expect(await canReadEveFile(laterKey)).toEqual({
      allowed: false,
      managed: true,
    });
    expect(await canReadEveFile(earlyKey)).toEqual({
      allowed: selectedKeys.length === 1,
      managed: true,
    });
    expect(await canReadEveFile(laterKey, ownerId)).toEqual({
      allowed: true,
      managed: true,
    });
  }
);

test("an already captured seed remains replayable while its delivery is fenced", async () => {
  const [source] = await insertEveConversationFixtures({
    ownerId,
    firstMessage: "Source",
    operationId: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    state: "bound",
  });
  const [target] = await insertEveConversationFixtures({
    ownerId,
    firstMessage: "Fork",
    operationId: crypto.randomUUID(),
    state: "uncertain",
    parentBranchId: source.id,
    rootBranchId: source.id,
    workspaceId: source.workspaceId,
    initialSeed: {
      messages: [{ role: "user", parts: [{ type: "text", text: "Captured" }] }],
    },
  });
  const activeOperationId = crypto.randomUUID();
  await db
    .update(eveWorkspace)
    .set({ activeOperationId })
    .where(eq(eveWorkspace.id, source.workspaceId));
  native.capture.mockClear();
  await initializeEveCurrentCopy(ownerId, target.id);
  expect(native.capture).not.toHaveBeenCalled();
  const [workspace] = await db
    .select()
    .from(eveWorkspace)
    .where(eq(eveWorkspace.id, source.workspaceId));
  expect(workspace.activeOperationId).toBe(activeOperationId);
});

test.each(["retry", "delete"])(
  "a never-dispatched busy fork allows %s with immutable intent",
  async (action) => {
    const [source] = await insertEveConversationFixtures({
      ownerId,
      firstMessage: "busy source",
      operationId: crypto.randomUUID(),
      sessionId: crypto.randomUUID(),
      state: "bound",
    });
    await db
      .update(eveWorkspace)
      .set({ activeOperationId: crypto.randomUUID() })
      .where(eq(eveWorkspace.id, source.workspaceId));
    const group = await reserveEveResponseGroup(ownerId, {
      operationId: crypto.randomUUID(),
      message: "blocked fork",
      modelIds: ["model-a", "model-b"],
      fork: { branchId: source.id },
    });
    const [{ operationId }] = group.candidates;
    const dispatch = vi.fn(
      async () => await Promise.resolve({ sessionId: crypto.randomUUID() })
    );
    await expect(
      createEveConversation(ownerId, operationId, "blocked fork", dispatch, {
        fork: { branchId: source.id },
      })
    ).rejects.toThrow("workspace");
    expect(dispatch).not.toHaveBeenCalled();
    const reservation = await getEveCreation(ownerId, operationId);
    expect(reservation?.state).toBe("creating");
    if (!reservation) {
      throw new Error("Missing busy reservation");
    }
    const waitingGroup = await getEveResponseGroup(ownerId, group.id);
    expect(waitingGroup?.candidates[0]).toMatchObject({
      operationId,
      state: "waiting",
    });
    expect(
      await db
        .select()
        .from(eveDispatch)
        .where(eq(eveDispatch.branchId, reservation.id))
    ).toHaveLength(0);
    await expect(
      createEveConversation(ownerId, operationId, "changed intent", dispatch, {
        fork: { branchId: source.id },
      })
    ).rejects.toThrow("different");
    if (action === "retry") {
      // The external writer has now completed. Only this fixture supplies that fact.
      await db
        .update(eveWorkspace)
        .set({ activeOperationId: null })
        .where(eq(eveWorkspace.id, source.workspaceId));
      native.capture.mockResolvedValue({
        seed: {
          messages: [
            {
              role: "user",
              parts: [{ type: "text", text: "Completed source" }],
            },
          ],
        },
        resources: { fileKeys: [] },
        projectionHash: "settled",
      });
      const result = await createEveConversation(
        ownerId,
        operationId,
        "blocked fork",
        dispatch,
        {
          fork: { branchId: source.id },
        }
      );
      expect(result.id).toBe(reservation.id);
      const boundGroup = await getEveResponseGroup(ownerId, group.id);
      expect(boundGroup?.candidates[0]).toMatchObject({
        operationId,
        state: "bound",
        branchId: reservation.id,
      });
      expect(dispatch).toHaveBeenCalledOnce();
    } else {
      const deletion = await beginEveConversationDeletion(
        ownerId,
        source.chatId
      );
      expect(deletion?.conversations.map((row) => row.id)).toEqual([source.id]);
      const retired = await getEveCreation(ownerId, operationId);
      expect(retired?.state).toBe("deleting");
      expect(dispatch).not.toHaveBeenCalled();
    }
  }
);
