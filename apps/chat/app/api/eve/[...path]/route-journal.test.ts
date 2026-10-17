import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { z } from "zod";

const postgres = new PGlite();
vi.mock("@/lib/db/client", () => ({ db: drizzle(postgres) }));
const mocks = vi.hoisted(() => ({
  bound: vi.fn(),
  canSpend: vi.fn(),
  eveRequest: vi.fn(),
  prepare: vi.fn(),
  principal: vi.fn(),
  reconcile: vi.fn(),
  referenceFiles: vi.fn(),
}));

vi.mock("@/lib/db/credits", () => ({ canSpend: mocks.canSpend }));
vi.mock("@/lib/db/eve-files", () => ({
  referenceEveFiles: mocks.referenceFiles,
}));
vi.mock("@/lib/db/eve-queries", () => ({
  getBoundEveConversationForSession: mocks.bound,
}));
vi.mock("@/lib/env", () => ({ env: { APP_URL: "http://localhost:3790" } }));
vi.mock("@/lib/eve/guest-message-admission", () => ({
  admitGuestMessage: vi.fn(),
  settleGuestMessage: vi.fn(),
}));
vi.mock("@/lib/eve/model-selection", () => ({
  loadEveModelDefinition: vi.fn(),
}));
vi.mock("@/lib/eve/prepare-message", () => ({
  prepareEveMessage: mocks.prepare,
}));
vi.mock("@/lib/eve/principal", () => ({
  resolveEvePrincipal: mocks.principal,
}));
vi.mock("@/lib/eve/reconcile-usage", () => ({
  reconcileEveOwnerUsage: mocks.reconcile,
}));
vi.mock("@/lib/eve/server", () => ({ eveRequest: mocks.eveRequest }));

const { POST } = await import("./route");
const conversationId = "00000000-0000-4000-8000-000000000011";
beforeAll(async () => {
  const journal = z
    .object({ entries: z.array(z.object({ tag: z.string() })) })
    .parse(
      JSON.parse(
        await readFile(
          new URL(
            "../../../../lib/db/migrations/meta/_journal.json",
            import.meta.url
          ),
          "utf-8"
        )
      )
    );
  /* oxlint-disable no-await-in-loop -- Migrations have ordered dependencies. */
  for (const entry of journal.entries) {
    await postgres.exec(
      await readFile(
        new URL(
          `../../../../lib/db/migrations/${entry.tag}.sql`,
          import.meta.url
        ),
        "utf-8"
      )
    );
  }
  /* oxlint-enable no-await-in-loop */
  await postgres.exec(`INSERT INTO "user" (id,name,email) VALUES ('owner','owner','owner');
    INSERT INTO "EveChat" (id,"ownerId",title) VALUES ('${conversationId}','owner','Test');
    INSERT INTO "EveConversation" (id,"chatId","ownerId","operationId","firstMessage","sessionId",state)
    VALUES ('${conversationId}','${conversationId}','owner','${conversationId}','Test','native','bound');`);
  mocks.bound.mockResolvedValue({ id: conversationId });
  mocks.principal.mockResolvedValue({ kind: "registered", ownerId: "owner" });
  mocks.canSpend.mockResolvedValue(true);
  mocks.prepare.mockResolvedValue("prepared");
}, 30_000);
afterAll(async () => {
  await postgres.close();
});
const send = async (
  operationId: string,
  message = "original"
): Promise<Response> =>
  await POST(
    new Request("http://localhost:3790/api/eve/v1/session/native", {
      method: "POST",
      body: JSON.stringify({ message, modelId: "model" }),
      headers: {
        origin: "http://localhost:3790",
        "content-type": "application/json",
        "x-chatjs-message-operation": operationId,
      },
    }),
    { params: Promise.resolve({ path: ["v1", "session", "native"] }) }
  );
it("keeps a real proxy dispatch unknown after response loss, with no second native request", async () => {
  mocks.eveRequest.mockRejectedValue(new Error("lost native response"));
  const operationId = "00000000-0000-4000-8000-000000000012";
  const first = await send(operationId);
  const repeated = await send(operationId);
  expect(first.status).toBe(502);
  expect(repeated.status).toBe(502);
  expect(await repeated.json()).toEqual({
    code: "chatjs_delivery_unknown",
    error:
      "Message delivery is unknown. This operation will not be sent again.",
  });
  expect(mocks.eveRequest).toHaveBeenCalledTimes(1);
});
it("replays the exact successful proxy binding and rejects changed intent before native dispatch", async () => {
  mocks.eveRequest.mockClear();
  mocks.eveRequest.mockResolvedValue(
    Response.json({ sessionId: "native", deliveryId: "native-delivery" })
  );
  const operationId = "00000000-0000-4000-8000-000000000013";
  const first = await send(operationId);
  expect(await first.json()).toMatchObject({
    sessionId: "native",
    deliveryId: "native-delivery",
  });
  const repeated = await send(operationId);
  expect(await repeated.json()).toMatchObject({
    sessionId: "native",
    deliveryId: "native-delivery",
  });
  const conflict = await send(operationId, "different");
  expect(conflict.status).toBe(502);
  expect(mocks.eveRequest).toHaveBeenCalledTimes(1);
});
