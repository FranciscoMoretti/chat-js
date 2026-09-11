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

test("an unresolved project conversation recovers after its project is deleted", async ({
  page,
}, testInfo) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const session = z
    .object({ user: z.object({ id: z.string() }) })
    .parse(await (await page.request.get("/api/auth/get-session")).json());
  const response = await page.request.post("/api/trpc/project.create", {
    data: { json: { name: "Recovery project fixture" } },
  });
  expect(response.ok()).toBe(true);
  const projectId = z
    .object({
      result: z.object({
        data: z.object({ json: z.object({ id: z.uuid() }) }),
      }),
    })
    .parse(await response.json()).result.data.json.id;
  const operation = {
    operationId: crypto.randomUUID(),
    projectId,
    modelId: "openai/gpt-4.1-mini-fast",
    message: "Reply exactly project-recovery-ok.",
  };
  await expect(
    createEveConversation(
      session.user.id,
      operation.operationId,
      operation.message,
      () => Promise.reject(new Error("Simulated dispatch interruption")),
      { initialProjectId: projectId, initialModelId: operation.modelId }
    )
  ).rejects.toThrow("Simulated dispatch interruption");
  const reservation = await getEveCreation(
    session.user.id,
    operation.operationId
  );
  expect(reservation?.state).toBe("uncertain");
  const removed = await page.request.post("/api/trpc/project.remove", {
    data: { json: { id: projectId } },
  });
  expect(removed.ok()).toBe(true);
  const storageKey = `chatjs.eve.pending:${session.user.id}:project:${projectId}`;
  await page.evaluate(
    ({ key, pending }) => sessionStorage.setItem(key, JSON.stringify(pending)),
    {
      key: storageKey,
      pending: { ...operation, operationId: crypto.randomUUID() },
    }
  );
  await page.goto(`/chat/${reservation?.id}`);
  const recovery = page.getByRole("region", { name: "Conversation recovery" });
  await expect(recovery).toContainText("does not have the original request");
  await expect(
    recovery.getByRole("button", { name: "Retry creation" })
  ).toHaveCount(0);
  await recovery.screenshot({
    path: testInfo.outputPath("recovery-missing.png"),
  });
  await page.evaluate(
    ({ key, pending }) => sessionStorage.setItem(key, JSON.stringify(pending)),
    { key: storageKey, pending: operation }
  );
  await page.reload();
  await expect(recovery).toContainText(operation.message);
  await page.route(
    "**/api/agent-conversations",
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Temporary recovery failure" }),
      }),
    { times: 1 }
  );
  await recovery.getByRole("button", { name: "Retry creation" }).click();
  await expect(recovery.getByRole("alert")).toHaveText(
    "Temporary recovery failure"
  );
  expect(
    await page.evaluate(
      (key) => JSON.parse(sessionStorage.getItem(key) ?? "null"),
      storageKey
    )
  ).toEqual(operation);
  await page.setViewportSize({ width: 390, height: 850 });
  await recovery.screenshot({
    path: testInfo.outputPath("recovery-error-mobile.png"),
  });
  let releaseRetry: () => void = () => undefined;
  const retryGate = new Promise<void>((resolve) => {
    releaseRetry = resolve;
  });
  await page.route(
    "**/api/agent-conversations",
    async (route) => {
      await retryGate;
      await route.continue();
    },
    { times: 1 }
  );
  await recovery.getByRole("button", { name: "Retry creation" }).click();
  await expect(
    recovery.getByRole("button", { name: "Recovering…" })
  ).toBeDisabled();
  await recovery.screenshot({
    path: testInfo.outputPath("recovery-pending-mobile.png"),
  });
  releaseRetry();
  await expect(page.locator(".is-assistant")).toContainText(
    "project-recovery-ok",
    { timeout: 90_000 }
  );
  const bound = await getEveCreation(session.user.id, operation.operationId);
  expect(bound?.state).toBe("bound");
  expect(bound?.id).toBe(reservation?.id);
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), storageKey)
  ).toBeNull();
  await page.reload();
  await expect(page.locator(".is-user")).toHaveCount(1);
  await expect(page.locator(".is-assistant")).toContainText(
    "project-recovery-ok"
  );
});
