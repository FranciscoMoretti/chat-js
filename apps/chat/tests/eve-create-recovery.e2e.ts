import { expect, test } from "@playwright/test";
import { Client } from "eve/client";
import { z } from "zod";
import { createEveConversation, getEveCreation } from "../lib/db/eve-queries";
import { env } from "../lib/env";
import { eveRequest } from "../lib/eve/server";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);

test("a lost native creation reply recovers the same session from the retained composer", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const session = z
    .object({ user: z.object({ id: z.string() }) })
    .parse(await (await page.request.get("/api/auth/get-session")).json());
  const operation = {
    operationId: crypto.randomUUID(),
    message: "Reply only with creation-recovered-73.",
    modelId: "openai/gpt-4.1-mini-fast",
  };
  let nativeSessionId = "";
  await expect(
    createEveConversation(
      session.user.id,
      operation.operationId,
      operation.message,
      async (id) => {
        const results = await Promise.all(
          [0, 1].map(() =>
            eveRequest(
              session.user.id,
              "/eve/v1/session",
              {
                method: "POST",
                body: JSON.stringify({
                  operationId: id,
                  message: operation.message,
                }),
                signal: AbortSignal.timeout(30_000),
              },
              operation.modelId
            )
          )
        );
        const sessionIds: string[] = [];
        for (const result of results) {
          expect(result.ok).toBe(true);
          const response = z
            .object({ sessionId: z.string() })
            .parse(await result.json());
          sessionIds.push(response.sessionId);
          expect(result.headers.get("x-eve-session-id")).toBe(
            response.sessionId
          );
        }
        expect(new Set(sessionIds).size).toBe(1);
        nativeSessionId = sessionIds[0];
        throw new Error("Simulated lost native reply before app binding");
      },
      { initialModelId: operation.modelId }
    )
  ).rejects.toThrow("Simulated lost native reply");
  const reservation = await getEveCreation(
    session.user.id,
    operation.operationId
  );
  expect(reservation?.state).toBe("uncertain");
  const lookup = await eveRequest(
    session.user.id,
    `/eve/v1/operation/${reservation?.id}`
  );
  expect(lookup.status).toBe(200);
  expect(await lookup.json()).toEqual({ sessionId: nativeSessionId });
  const otherOwner = await eveRequest(
    crypto.randomUUID(),
    `/eve/v1/operation/${reservation?.id}`
  );
  expect(otherOwner.status).toBe(404);
  expect(await otherOwner.json()).toMatchObject({
    code: "eve_operation_not_found",
  });
  await page.goto("/");
  await page.evaluate(
    ({ ownerId, pending }) => {
      sessionStorage.setItem(
        `chatjs.eve.pending:${ownerId}`,
        JSON.stringify(pending)
      );
    },
    { ownerId: session.user.id, pending: operation }
  );
  await page.reload();
  await expect(page.locator('[aria-label="Message"]')).toHaveText(
    operation.message
  );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page).toHaveURL(
    new URL(`/chat/${reservation?.id}`, page.url()).href
  );
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  const bound = await getEveCreation(session.user.id, operation.operationId);
  expect(bound?.sessionId).toBe(nativeSessionId);
  expect(bound?.state).toBe("bound");
  const client = new Client({
    host: env.EVE_INTERNAL_ORIGIN ?? "",
    auth: { bearer: env.EVE_GATEWAY_SECRET ?? "" },
    headers: { "x-chatjs-owner": session.user.id },
  });
  const snapshot = await client.sessions
    .attach(nativeSessionId)
    .snapshot({ signal: AbortSignal.timeout(15_000) });
  expect(
    snapshot.events.filter((event) => event.type === "message.received")
  ).toHaveLength(1);
  expect(
    await page.evaluate(
      (ownerId) => sessionStorage.getItem(`chatjs.eve.pending:${ownerId}`),
      session.user.id
    )
  ).toBeNull();
});
