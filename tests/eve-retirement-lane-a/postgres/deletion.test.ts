/* oxlint-disable import/no-nodejs-modules, node/no-process-env -- The integration test reads only the explicit disposable database handoff and local migration files. */
import { randomUUID } from "node:crypto";
import path from "node:path";

import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, expect, test, vi } from "vitest";

/* oxlint-disable no-undefined -- An absent explicit handoff must fail closed. */
/* oxlint-disable max-statements, max-lines-per-function -- Fixture setup and concurrency cases keep their transaction lifecycle in one readable scope. */
/* oxlint-disable typescript/explicit-function-return-type -- Drizzle infers fixture row and transaction return types from the actual application schema. */
/* oxlint-disable eslint/no-await-in-loop -- Cleanup must respect foreign-key order before disposing the next owner. */
/* oxlint-disable eslint/no-magic-numbers -- Expected row/effect counts are the assertions of these transaction tests. */
import { removeEveDocumentFromConversation } from "@/lib/db/eve-documents";
import {
  eveChat,
  eveConversation,
  eveDocumentHead,
  eveDocumentRevision,
  user,
} from "@/lib/db/schema";

const database = await vi.hoisted(async () => {
  const { readFile } = await import("node:fs/promises");
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { z: schema } = await import("zod");
  const file = process.env.EVE_RETIREMENT_POSTGRES_FILE;
  if (file === undefined || file === "") {
    throw new Error(
      "Supply D's disposable connection.json through EVE_RETIREMENT_POSTGRES_FILE."
    );
  }
  const settings = schema
    .object({ databases: schema.object({ lane_a: schema.url() }) })
    .parse(JSON.parse(await readFile(file, "utf-8")));
  const url = new URL(settings.databases.lane_a);
  if (
    url.hostname !== "127.0.0.1" ||
    url.pathname !== "/lane_a" ||
    url.username !== "retirement"
  ) {
    throw new Error("Only D's loopback lane_a database is allowed.");
  }
  const client = postgres(url.href, {
    connection: { application_name: "lane-a-deletion" },
    max: 3,
    onnotice: () => {
      /* Migration notices are expected in the disposable database. */
    },
  });
  const control = postgres(url.href, {
    connection: { application_name: "lane-a-control" },
    max: 2,
    onnotice: () => {
      /* Migration notices are expected in the disposable database. */
    },
  });
  const injection = {
    afterDelete: new AbortController(),
    deletes: 0,
    enabled: false,
  };
  const db = drizzle(client, {
    logger: {
      logQuery(query) {
        if (query.startsWith('delete from "EveDocumentHead"')) {
          injection.deletes += 1;
          if (injection.enabled) {
            injection.afterDelete.abort(
              new Error("Abort after DELETE dispatch")
            );
          }
        }
      },
    },
  });
  return { client, control, db, injection };
});
vi.mock("@/lib/db/client", () => ({ db: database.db }));
vi.mock("@/lib/env", () => ({ env: {} }));

const owners: string[] = [];
const seed = async () => {
  const ownerId = `lane-a-${randomUUID()}`;
  const chatId = randomUUID();
  const conversationId = randomUUID();
  const documentId = randomUUID();
  const expectedRevisionId = randomUUID();
  owners.push(ownerId);
  await database.db.insert(user).values({
    email: `${ownerId}@invalid.test`,
    id: ownerId,
    name: "Disposable proof owner",
  });
  await database.db
    .insert(eveChat)
    .values({ id: chatId, ownerId, title: "Deletion proof" });
  await database.db.insert(eveConversation).values({
    chatId,
    firstMessage: "Delete",
    id: conversationId,
    operationId: randomUUID(),
    ownerId,
    sessionId: `session-${conversationId}`,
    state: "bound",
  });
  await database.db.insert(eveDocumentRevision).values({
    content: "Preserved immutable revision",
    conversationId,
    documentId,
    id: expectedRevisionId,
    kind: "text",
    operationId: randomUUID(),
    ownerId,
    title: "Notes",
  });
  await database.db.insert(eveDocumentHead).values({
    conversationId,
    documentId,
    ownerId,
    revisionId: expectedRevisionId,
  });
  return {
    input: { documentId, expectedRevisionId, title: "Notes" },
    scope: { conversationId, ownerId },
  };
};
const heads = async (ownerId: string) =>
  await database.db
    .select()
    .from(eveDocumentHead)
    .where(eq(eveDocumentHead.ownerId, ownerId));
const normalSignal = () => new AbortController().signal;

beforeAll(async () => {
  await migrate(database.db, {
    migrationsFolder: path.resolve(
      import.meta.dirname,
      "../../../apps/chat/lib/db/migrations"
    ),
  });
});
afterAll(async () => {
  database.injection.enabled = false;
  for (const ownerId of owners) {
    await database.db
      .delete(eveDocumentHead)
      .where(eq(eveDocumentHead.ownerId, ownerId));
    await database.db
      .delete(eveDocumentRevision)
      .where(eq(eveDocumentRevision.ownerId, ownerId));
    await database.db
      .delete(eveConversation)
      .where(eq(eveConversation.ownerId, ownerId));
    await database.db.delete(eveChat).where(eq(eveChat.ownerId, ownerId));
    await database.db.delete(user).where(eq(user.id, ownerId));
  }
  await Promise.all([database.client.end(), database.control.end()]);
});

test("exact owned revision is removed; immutable revision survives; retry is harmless", async () => {
  const { input, scope } = await seed();
  await expect(
    removeEveDocumentFromConversation(input, scope, normalSignal())
  ).resolves.toMatchObject({ documentId: input.documentId, status: "success" });
  expect(await heads(scope.ownerId)).toEqual([]);
  expect(
    await database.db
      .select()
      .from(eveDocumentRevision)
      .where(eq(eveDocumentRevision.id, input.expectedRevisionId))
  ).toHaveLength(1);
  await expect(
    removeEveDocumentFromConversation(input, scope, normalSignal())
  ).resolves.toMatchObject({ status: "success" });
});

test.each(["owner", "title", "revision", "conversation-state"])(
  "guard rejects changed %s and retains head",
  async (change) => {
    const { input, scope } = await seed();
    if (change === "conversation-state") {
      await database.db
        .update(eveConversation)
        .set({ state: "deleting" })
        .where(eq(eveConversation.id, scope.conversationId));
    }
    await expect(
      removeEveDocumentFromConversation(
        {
          ...input,
          ...(change === "title" ? { title: "Wrong" } : {}),
          ...(change === "revision"
            ? { expectedRevisionId: randomUUID() }
            : {}),
        },
        { ...scope, ...(change === "owner" ? { ownerId: "foreign" } : {}) },
        normalSignal()
      )
    ).rejects.toThrow();
    expect(await heads(scope.ownerId)).toHaveLength(1);
  }
);

test("aborted signal rejects before mutation", async () => {
  const { input, scope } = await seed();
  const cancellation = new AbortController();
  cancellation.abort(new Error("Already cancelled"));
  await expect(
    removeEveDocumentFromConversation(input, scope, cancellation.signal)
  ).rejects.toThrow("Already cancelled");
  expect(await heads(scope.ownerId)).toHaveLength(1);
});

test("abort after DELETE dispatch rolls the actual transaction back", async () => {
  const { input, scope } = await seed();
  database.injection.afterDelete = new AbortController();
  database.injection.enabled = true;
  const before = database.injection.deletes;
  try {
    await expect(
      removeEveDocumentFromConversation(
        input,
        scope,
        database.injection.afterDelete.signal
      )
    ).rejects.toThrow("Abort after DELETE dispatch");
  } finally {
    database.injection.enabled = false;
  }
  expect(database.injection.deletes).toBe(before + 1);
  expect(await heads(scope.ownerId)).toHaveLength(1);
});

test.each(["abort", "new-head"])(
  "waiting transaction rechecks %s after the family lock",
  async (change) => {
    const { input, scope } = await seed();
    const nextRevision = randomUUID();
    await database.db.insert(eveDocumentRevision).values({
      content: "Newer",
      conversationId: scope.conversationId,
      documentId: input.documentId,
      id: nextRevision,
      kind: "text",
      operationId: randomUUID(),
      ownerId: scope.ownerId,
      title: input.title,
    });
    const locked = Promise.withResolvers<boolean>();
    const release = Promise.withResolvers<boolean>();
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- postgres.js owns the callable transaction interface.
    const holder = database.control.begin(async (transaction) => {
      await transaction`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${scope.ownerId}`}, 0))`;
      locked.resolve(true);
      await release.promise;
      if (change === "new-head") {
        await transaction`update "EveDocumentHead" set "revisionId"=${nextRevision} where "conversationId"=${scope.conversationId}`;
      }
    });
    await locked.promise;
    const cancellation = new AbortController();
    /* oxlint-disable promise/prefer-await-to-then, promise/prefer-await-to-callbacks -- Attach rejection handling before waiting on the lock so cancellation cannot produce an unhandled rejection. */
    const operation = removeEveDocumentFromConversation(
      input,
      scope,
      cancellation.signal
    ).then(
      () => "unexpected-success",
      (error: unknown) => error
    );
    /* oxlint-enable promise/prefer-await-to-then, promise/prefer-await-to-callbacks */
    try {
      await expect
        .poll(async () => {
          const waiting = await database.control<
            { count: number }[]
          >`select count(*)::int as count from pg_stat_activity where datname='lane_a' and application_name='lane-a-deletion' and wait_event_type='Lock'`;
          return waiting[0].count;
        })
        .toBe(1);
      if (change === "abort") {
        cancellation.abort(new Error("Cancelled while locked"));
      }
    } finally {
      release.resolve(true);
      await holder;
    }
    expect(await operation).toBeInstanceOf(Error);
    const [head] = await heads(scope.ownerId);
    expect(head.revisionId).toBe(
      change === "new-head" ? nextRevision : input.expectedRevisionId
    );
  }
);
