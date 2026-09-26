/* oxlint-disable eslint/no-shadow -- Nested callback names mirror the protocol fields and transaction APIs under test. */
/* oxlint-disable promise/avoid-new -- These fixtures adapt callback, timer, stream, or browser event APIs into awaited Promises. */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
/* oxlint-disable unicorn/consistent-function-scoping -- One-off helpers stay beside the scenario state they coordinate. */
/* oxlint-disable unicorn/no-await-expression-member -- Direct awaited assertions keep each test action tied to its expectation. */
import { expect, test } from "@playwright/test";
import { Client } from "eve/client";
import { z } from "zod";

import { createEveConversation, getEveCreation } from "../lib/db/eve-queries";
import { env } from "../lib/env";
import { getEveConnectionOptions } from "../lib/eve/connection-options";
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
    message: "Reply only with creation-recovered-73.",
    modelId: "openai/gpt-4.1-mini-fast",
    operationId: crypto.randomUUID(),
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
              "/eve/chat/v1/session",
              {
                body: JSON.stringify({
                  operationId: id,
                  message: operation.message,
                }),
                method: "POST",
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
        [nativeSessionId] = sessionIds;
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
    `/eve/chat/v1/operation/${reservation?.id}`
  );
  expect(lookup.status).toBe(200);
  expect(await lookup.json()).toEqual({ sessionId: nativeSessionId });
  const otherOwner = await eveRequest(
    crypto.randomUUID(),
    `/eve/chat/v1/operation/${reservation?.id}`
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
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(page).toHaveURL(
    new URL(`/chat/${reservation?.id}`, page.url()).href
  );
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  const bound = await getEveCreation(session.user.id, operation.operationId);
  expect(bound?.sessionId).toBe(nativeSessionId);
  expect(bound?.state).toBe("bound");
  const client = new Client(getEveConnectionOptions(session.user.id));
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
    message: "Reply exactly project-recovery-ok.",
    modelId: "openai/gpt-4.1-mini-fast",
    operationId: crypto.randomUUID(),
    projectId,
  };
  await expect(
    createEveConversation(
      session.user.id,
      operation.operationId,
      operation.message,
      () => Promise.reject(new Error("Simulated dispatch interruption")),
      { initialModelId: operation.modelId, initialProjectId: projectId }
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
        body: JSON.stringify({ error: "Temporary recovery failure" }),
        contentType: "application/json",
        status: 503,
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
  await page.setViewportSize({ height: 850, width: 390 });
  await recovery.screenshot({
    path: testInfo.outputPath("recovery-error-mobile.png"),
  });
  let releaseRetry: () => void = () => {
    /* empty */
  };
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

test("a missing project preserves an unreserved request until definitive rejection", async ({
  page,
}, testInfo) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const session = z
    .object({ user: z.object({ id: z.string() }) })
    .parse(await (await page.request.get("/api/auth/get-session")).json());
  const projectId = crypto.randomUUID();
  const operation = {
    message: "Preserve my missing project draft",
    modelId: "openai/gpt-4.1-mini-fast",
    operationId: crypto.randomUUID(),
    projectId,
  };
  const key = `chatjs.eve.pending:${session.user.id}:project:${projectId}`;
  await page.evaluate(
    ({ key, operation }) =>
      sessionStorage.setItem(key, JSON.stringify(operation)),
    { key, operation }
  );
  await page.goto(`/project/${projectId}`);
  const recovery = page.getByRole("region", { name: "Conversation recovery" });
  await expect(recovery).toContainText(operation.message);
  await page.route(
    "**/api/agent-conversations",
    async (route) => {
      expect(route.request().postDataJSON()).toEqual(operation);
      await route.fulfill({
        body: JSON.stringify({ error: "Temporary failure" }),
        contentType: "application/json",
        status: 503,
      });
    },
    { times: 1 }
  );
  await recovery.getByRole("button", { name: "Retry creation" }).click();
  await expect(recovery.getByRole("alert")).toHaveText("Temporary failure");
  await expect(
    recovery.getByRole("button", { name: "Continue without project" })
  ).toHaveCount(0);
  await page.reload();
  await expect(recovery).toContainText(operation.message);
  await recovery.screenshot({
    path: testInfo.outputPath("missing-project-retained.png"),
  });
  await page.route(
    "**/api/agent-conversations",
    async (route) => {
      expect(route.request().postDataJSON()).toEqual(operation);
      await route.fulfill({
        body: JSON.stringify({
          error: "Project not found",
          creationRejected: true,
          code: "project_not_found",
        }),
        contentType: "application/json",
        status: 404,
      });
    },
    { times: 1 }
  );
  await recovery.getByRole("button", { name: "Retry creation" }).click();
  await expect(
    recovery.getByRole("button", { name: "Continue without project" })
  ).toBeVisible();
  await page.setViewportSize({ height: 850, width: 390 });
  await recovery.screenshot({
    path: testInfo.outputPath("missing-project-rejected-mobile.png"),
  });
  await recovery
    .getByRole("button", { name: "Continue without project" })
    .click();
  await expect(page).toHaveURL(new URL("/", page.url()).href);
  await expect(page.locator('[aria-label="Message"]')).toHaveText(
    operation.message
  );
  const saved = await page.evaluate(
    ({ key, ownerId }) => ({
      next: JSON.parse(
        sessionStorage.getItem(`chatjs.eve.pending:${ownerId}`) ?? "null"
      ),
      old: sessionStorage.getItem(key),
    }),
    { key, ownerId: session.user.id }
  );
  expect(saved.old).toBeNull();
  expect(saved.next).toMatchObject({
    message: operation.message,
    modelId: operation.modelId,
  });
  expect(saved.next.operationId).not.toBe(operation.operationId);
  expect(saved.next.projectId).toBeUndefined();
});

test("a rejected project composer retains its request across project deletion", async ({
  page,
}, testInfo) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const session = z
    .object({ user: z.object({ id: z.string() }) })
    .parse(await (await page.request.get("/api/auth/get-session")).json());
  const created = await page.request.post("/api/trpc/project.create", {
    data: { json: { name: "Rejected creation fixture" } },
  });
  expect(created.ok()).toBe(true);
  const projectId = z
    .object({
      result: z.object({
        data: z.object({ json: z.object({ id: z.uuid() }) }),
      }),
    })
    .parse(await created.json()).result.data.json.id;
  await page.goto(`/project/${projectId}`);
  await page
    .locator('[aria-label="Message"]')
    .fill("Preserve rejected composer");
  await page.route("**/api/agent-conversations", (route) =>
    route.fulfill({
      body: JSON.stringify({
        error: "Project not found",
        creationRejected: true,
        code: "project_not_found",
      }),
      contentType: "application/json",
      status: 404,
    })
  );
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  const recovery = page.getByRole("region", { name: "Conversation recovery" });
  await expect(
    recovery.getByRole("button", { name: "Continue without project" })
  ).toBeVisible();
  const key = `chatjs.eve.pending:${session.user.id}:project:${projectId}`;
  const retained = await page.evaluate(
    (key) => sessionStorage.getItem(key),
    key
  );
  expect(retained).not.toBeNull();
  await recovery.screenshot({
    path: testInfo.outputPath("project-composer-rejected.png"),
  });
  const removed = await page.request.post("/api/trpc/project.remove", {
    data: { json: { id: projectId } },
  });
  expect(removed.ok()).toBe(true);
  await page.reload();
  await expect(recovery).toContainText("Preserve rejected composer");
  expect(await page.evaluate((key) => sessionStorage.getItem(key), key)).toBe(
    retained
  );
});
