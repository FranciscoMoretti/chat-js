/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, import/max-dependencies, unicorn/no-await-expression-member, unicorn/no-null --
 * max-lines-per-function: Keep the ordered dispatch/receipt or streaming scenario together so its evidence transitions remain reviewable.
 * max-statements: Keep the transaction or boundary scenario ordered; splitting its statements would hide the evidence transition.
 * no-magic-numbers: Protocol statuses, array positions and deterministic scenario counts are local to this boundary.
 * no-undefined: Undefined represents absent stream evidence or an optional query result; null is a persisted value.
 * import/max-dependencies: The integration test intentionally joins actual persistence, delivery, projection, copy and deletion boundaries.
 * unicorn/no-await-expression-member: Assert the state from each completed database observation at its exact point in the scenario.
 * unicorn/no-null: Explicit null represents the stored no-tool selection or an empty HTTP body, not missing evidence.
 */
import { eq } from "drizzle-orm";
import type { MessageStreamEvent } from "eve/client";
import { afterAll, expect, test, vi } from "vitest";

import { POST } from "@/app/api/eve/[...path]/route";
import { db } from "@/lib/db/client";
import { completeEveConversationDeletion } from "@/lib/db/eve-deletion";
import { beginEveConversationDeletion } from "@/lib/db/eve-queries";
import {
  claimEveSubmission,
  readEveSubmission,
  rejectEveSubmissionAdmission,
  recordEveMessageReceipt,
  reserveEveSubmission,
  settleEveSubmission,
} from "@/lib/db/queries";
import {
  eveChat,
  eveConversation,
  eveSubmission,
  eveMessageAnnotation,
  user,
} from "@/lib/db/schema";
import { env } from "@/lib/env";
import { prepareEveCopyTranscript } from "@/lib/eve/copy-transcript";
import {
  eveMessageDelivery,
  eveMessageDeliveryMetadata,
} from "@/lib/eve/message-delivery";
import { eveMessageTool } from "@/lib/eve/message-tool-selection";
import { sharedEveMessages } from "@/lib/eve/shared-messages";
import {
  projectEveSubmissionEvents,
  projectEveSubmissionStream,
} from "@/lib/eve/submission-projection";

import { insertEveConversationFixtures } from "./eve-conversation-fixture";
import { assertEveTestDatabase } from "./eve-test-database";

vi.mock("server-only", () => ({}));
const proxy = vi.hoisted(() => ({ principal: vi.fn(), request: vi.fn() }));
vi.mock("@/lib/eve/principal", () => ({
  resolveEvePrincipal: proxy.principal,
}));
vi.mock("@/lib/eve/server", () => ({ eveRequest: proxy.request }));
vi.mock("@/lib/eve/model-selection", () => ({
  loadEveModelDefinition: vi.fn(),
}));
vi.mock("@/lib/eve/prepare-message", () => ({
  // oxlint-disable-next-line require-await, typescript/require-await -- Match the asynchronous preparation boundary with deterministic fixture data.
  prepareEveMessage: async (message: string): Promise<string> => message,
}));
vi.mock("@/lib/db/eve-files", () => ({ referenceEveFiles: vi.fn() }));
vi.mock("@/lib/db/credits", () => ({
  // oxlint-disable-next-line require-await, typescript/require-await -- Preserve asynchronous admission without external billing.
  canSpend: async (): Promise<boolean> => true,
}));
vi.mock("@/lib/eve/reconcile-usage", () => ({
  reconcileEveOwnerUsage: vi.fn(),
}));
assertEveTestDatabase(env.DATABASE_URL);
const ownerId = crypto.randomUUID();
const sessionId = crypto.randomUUID();
const conversationId = crypto.randomUUID();
const otherConversation = crypto.randomUUID();
const otherSession = crypto.randomUUID();
await db.insert(user).values({
  email: `${ownerId}@test.invalid`,
  id: ownerId,
  name: "Submission test",
});
await insertEveConversationFixtures([
  {
    firstMessage: "test",
    id: conversationId,
    operationId: crypto.randomUUID(),
    ownerId,
    sessionId,
    state: "bound",
  },
  {
    firstMessage: "other",
    id: otherConversation,
    operationId: crypto.randomUUID(),
    ownerId,
    sessionId: otherSession,
    state: "bound",
  },
]);
afterAll(async () => {
  await db.delete(eveConversation).where(eq(eveConversation.ownerId, ownerId));
  await db.delete(eveChat).where(eq(eveChat.ownerId, ownerId));
  await db.delete(user).where(eq(user.id, ownerId));
});
const reserve = async (
  operationId: string,
  selectedTool: string | null = null
): ReturnType<typeof reserveEveSubmission> =>
  await reserveEveSubmission({
    command: { message: "identical", modelId: "model", selectedTool },
    conversationId,
    operationId,
    ownerId,
    selectedTool,
  });
const event = (
  operationId: string
): Extract<MessageStreamEvent, { type: "message.received" }> => ({
  data: {
    message: "identical",
    metadata: eveMessageDeliveryMetadata(operationId, null),
    sequence: 1,
    turnId: "turn_1",
  },
  meta: { at: "2026-10-07T00:00:00Z", id: crypto.randomUUID() },
  type: "message.received",
});

test("immutable binding and one dispatch claimant survive concurrent attempts and a lost acceptance", async () => {
  const operationId = crypto.randomUUID();
  await Promise.all([reserve(operationId), reserve(operationId)]);
  await expect(reserve(operationId, "createTextDocument")).rejects.toThrow(
    "another command"
  );
  await expect(
    reserveEveSubmission({
      command: { message: "identical" },
      conversationId: otherConversation,
      operationId,
      ownerId,
      selectedTool: null,
    })
  ).rejects.toThrow("another command");
  const claims = await Promise.all([
    claimEveSubmission(ownerId, operationId),
    claimEveSubmission(ownerId, operationId),
  ]);
  expect(claims.filter(Boolean)).toHaveLength(1);
  expect(
    (await readEveSubmission(ownerId, sessionId, operationId))?.state
  ).toBe("uncertain");
  expect(await claimEveSubmission(ownerId, operationId)).toBe(false);
  expect(
    await readEveSubmission(ownerId, otherSession, operationId)
  ).toBeUndefined();
  expect(
    await readEveSubmission("foreign", sessionId, operationId)
  ).toBeUndefined();
  const received = event(operationId);
  await projectEveSubmissionEvents(ownerId, otherSession, [received]);
  expect(
    (await readEveSubmission(ownerId, sessionId, operationId))?.state
  ).toBe("uncertain");
  await projectEveSubmissionEvents(ownerId, sessionId, [received]);
  expect(
    (await readEveSubmission(ownerId, sessionId, operationId))?.state
  ).toBe("received");
  await settleEveSubmission(ownerId, operationId, "admitted");
  expect(
    (await readEveSubmission(ownerId, sessionId, operationId))?.state
  ).toBe("received");
});

test("coalesced receipts retain every token and the last explicit null selection through stream, history and copy", async () => {
  const first = crypto.randomUUID();
  const last = crypto.randomUUID();
  await reserve(first, "createTextDocument");
  await reserve(last);
  await claimEveSubmission(ownerId, first);
  await claimEveSubmission(ownerId, last);
  await settleEveSubmission(ownerId, first, "admitted");
  const received = event(last);
  const proposed = {
    ...received,
    data: { ...received.data, correlationIds: [first, last] },
  };
  const source = new Response(`${JSON.stringify(proposed)}\n`).body;
  if (source === null) {
    throw new Error("Missing fixture body");
  }
  const projected = await new Response(
    projectEveSubmissionStream(ownerId, sessionId, source)
  ).text();
  expect(projected).toContain(`"operationIds":["${first}","${last}"]`);
  const events = await projectEveSubmissionEvents(ownerId, sessionId, [
    proposed,
  ]);
  expect(eveMessageTool(sharedEveMessages(events)[0])).toBeNull();
  const copy = prepareEveCopyTranscript([
    ...events,
    {
      data: { continuationToken: "token", wait: "next-user-message" },
      meta: { at: "2026-10-07T00:00:01Z", id: "waiting" },
      type: "session.waiting",
    },
  ]);
  expect(JSON.stringify(copy.seed)).not.toContain(first);
  expect(JSON.stringify(copy.seed)).not.toContain(ownerId);
  expect(JSON.stringify(copy.seed)).not.toContain("createTextDocument");
  expect(projected).toContain('"selectedTool":null');
  expect((await readEveSubmission(ownerId, sessionId, first))?.state).toBe(
    "received"
  );
  expect((await readEveSubmission(ownerId, sessionId, last))?.state).toBe(
    "received"
  );
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string): string | null => values.get(key) ?? null,
    removeItem: (key: string): void => {
      values.delete(key);
    },
    setItem: (key: string, value: string): void => {
      values.set(key, value);
    },
  };
  const [receiptEvent] = events;
  if (receiptEvent === undefined) {
    throw new Error("Missing receipt");
  }
  expect(
    eveMessageDelivery.acknowledge(
      storage,
      otherSession,
      { attachments: [], message: "identical", operationId: first },
      receiptEvent
    )
  ).toBe(false);
  expect(
    eveMessageDelivery.acknowledge(
      storage,
      sessionId,
      { attachments: [], message: "identical", operationId: first },
      receiptEvent
    )
  ).toBe(true);
});

test("admission and controls never fabricate receipt; unknown or mixed tokens cannot borrow annotations", async () => {
  const operationId = crypto.randomUUID();
  await reserve(operationId, "createTextDocument");
  await claimEveSubmission(ownerId, operationId);
  await settleEveSubmission(ownerId, operationId, "admitted");
  await projectEveSubmissionEvents(ownerId, sessionId, [
    {
      data: { continuationToken: "token", wait: "next-user-message" },
      meta: { at: "2026-10-07T00:00:00Z", id: "control" },
      type: "session.waiting",
    },
  ]);
  expect(
    (await readEveSubmission(ownerId, sessionId, operationId))?.state
  ).toBe("admitted");
  expect(
    await recordEveMessageReceipt({
      legacy: false,
      legacySelection: null,
      messageId: "forged",
      operationIds: [operationId, crypto.randomUUID()],
      ownerId,
      sessionId,
    })
  ).toBeUndefined();
  expect(
    (await readEveSubmission(ownerId, sessionId, operationId))?.state
  ).toBe("admitted");
  await projectEveSubmissionEvents(ownerId, sessionId, [
    {
      data: { sequence: 0, turnId: "turn_0" },
      meta: { at: "2026-10-07T00:00:00Z", id: "cancel" },
      type: "turn.cancelled",
    },
  ]);
  expect(
    (await readEveSubmission(ownerId, sessionId, operationId))?.state
  ).toBe("admitted");
  await projectEveSubmissionEvents(ownerId, sessionId, [event(operationId)]);
  expect(
    (await readEveSubmission(ownerId, sessionId, operationId))?.state
  ).toBe("received");
  await rejectEveSubmissionAdmission(ownerId, operationId);
  expect(
    (await readEveSubmission(ownerId, sessionId, operationId))?.state
  ).toBe("received");
  const rejected = crypto.randomUUID();
  await reserve(rejected);
  await settleEveSubmission(ownerId, rejected, "rejected");
  expect(await claimEveSubmission(ownerId, rejected)).toBe(false);
});

test("old scalar history migrates display only, without inventing immutable commands", async () => {
  const old = crypto.randomUUID();
  const received = event(old);
  const events = await projectEveSubmissionEvents(ownerId, sessionId, [
    received,
  ]);
  expect(await readEveSubmission(ownerId, sessionId, old)).toBeUndefined();
  expect(sharedEveMessages(events)).toEqual(sharedEveMessages([received]));
});

test("replayed materialization keeps the first receipt and annotation even when native event ID changes", async () => {
  const operationId = crypto.randomUUID();
  await reserve(operationId, "createTextDocument");
  const original = event(operationId);
  const replay = {
    ...original,
    meta: { ...original.meta, id: crypto.randomUUID() },
  };
  await projectEveSubmissionEvents(ownerId, sessionId, [original]);
  const projected = await projectEveSubmissionEvents(ownerId, sessionId, [
    replay,
  ]);
  expect(projected).toMatchObject([
    {
      data: {
        metadata: {
          chatjs: {
            operationIds: [operationId],
            selectedTool: "createTextDocument",
          },
        },
      },
    },
  ]);
  expect(
    (await readEveSubmission(ownerId, sessionId, operationId))?.messageId
  ).toBe(original.meta.id);
});

test("copied history imports display annotations without transferring submission identity", async () => {
  const copied = crypto.randomUUID();
  const foreignOperation = crypto.randomUUID();
  await projectEveSubmissionEvents(ownerId, sessionId, [
    {
      data: {
        messages: [
          {
            id: copied,
            metadata: {
              custom: eveMessageDeliveryMetadata(
                foreignOperation,
                "createTextDocument"
              ),
            },
            parts: [{ text: "copied", type: "text" }],
            role: "user",
          },
        ],
      },
      meta: { at: "2026-10-07T00:00:00Z", id: "seed" },
      type: "history.seeded",
    },
  ]);
  const [annotation] = await db
    .select()
    .from(eveMessageAnnotation)
    .where(eq(eveMessageAnnotation.messageId, copied));
  expect(annotation).toMatchObject({
    operationIds: [],
    selectedTool: "createTextDocument",
    source: "legacy",
  });
  expect(
    await readEveSubmission(ownerId, sessionId, foreignOperation)
  ).toBeUndefined();
});

test("authenticated proxy persists uncertainty before losing the response and never dispatches a repeat", async () => {
  const operationId = crypto.randomUUID();
  proxy.principal.mockResolvedValue({ kind: "registered", ownerId });
  proxy.request.mockImplementation(async () => {
    const stored = await readEveSubmission(ownerId, sessionId, operationId);
    expect(stored?.state).toBe("uncertain");
    throw new Error("accepted upstream, reply lost");
  });
  const request = (): Request =>
    new Request(`http://localhost:3000/api/eve/v1/session/${sessionId}`, {
      body: JSON.stringify({ message: "proxy original", modelId: "model" }),
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        "x-chatjs-message-operation": operationId,
      },
      method: "POST",
    });
  const context = {
    params: Promise.resolve({ path: ["v1", "session", sessionId] }),
  };
  expect((await POST(request(), context)).status).toBe(502);
  expect(
    (await readEveSubmission(ownerId, sessionId, operationId))?.state
  ).toBe("uncertain");
  expect((await POST(request(), context)).status).toBe(409);
  expect(proxy.request).toHaveBeenCalledTimes(1);
  proxy.principal.mockResolvedValue({ kind: "registered", ownerId: "foreign" });
  expect((await POST(request(), context)).status).toBe(404);
  expect(proxy.request).toHaveBeenCalledTimes(1);
});

test("deletion erases submission content and annotations while fencing retired operation IDs", async () => {
  const target = crypto.randomUUID();
  const native = crypto.randomUUID();
  const operationId = crypto.randomUUID();
  await insertEveConversationFixtures({
    firstMessage: "private",
    id: target,
    operationId: crypto.randomUUID(),
    ownerId,
    sessionId: native,
    state: "bound",
  });
  await reserveEveSubmission({
    command: { message: "private command" },
    conversationId: target,
    operationId,
    ownerId,
    selectedTool: "createTextDocument",
  });
  await recordEveMessageReceipt({
    legacy: false,
    legacySelection: null,
    messageId: "private-message",
    operationIds: [operationId],
    ownerId,
    sessionId: native,
  });
  await beginEveConversationDeletion(ownerId, target);
  await completeEveConversationDeletion(ownerId, target);
  const [tombstone] = await db
    .select()
    .from(eveSubmission)
    .where(eq(eveSubmission.operationId, operationId));
  expect(tombstone).toMatchObject({
    command: {},
    messageId: null,
    selectedTool: null,
    state: "retired",
  });
  expect(
    await db
      .select()
      .from(eveMessageAnnotation)
      .where(eq(eveMessageAnnotation.conversationId, target))
  ).toEqual([]);
  expect(await readEveSubmission(ownerId, native, operationId)).toBeUndefined();
  await expect(
    reserveEveSubmission({
      command: { message: "replacement" },
      conversationId,
      operationId,
      ownerId,
      selectedTool: null,
    })
  ).rejects.toThrow("another command");
  expect(await claimEveSubmission(ownerId, operationId)).toBe(false);
});

/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, import/max-dependencies, unicorn/no-await-expression-member, unicorn/no-null */

/* oxlint-disable max-lines -- Keep the real PostgreSQL submission, projection and retirement scenarios in one isolated fixture lifecycle. */
