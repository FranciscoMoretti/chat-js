/* oxlint-disable eslint/no-promise-executor-return -- These Promise executors directly register callback APIs whose return values are ignored. */
/* oxlint-disable promise/avoid-new -- These fixtures adapt callback, timer, stream, or browser event APIs into awaited Promises. */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
/* oxlint-disable unicorn/no-await-expression-member -- Direct awaited assertions keep each test action tied to its expectation. */
import { createServer } from "node:http";
import type { ServerResponse } from "node:http";

import { expect, test } from "@playwright/test";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { MCPClient } from "../lib/ai/mcp/mcp-client";
import { db } from "../lib/db/client";
import { mcpConnector, userCredit } from "../lib/db/schema";
import { env } from "../lib/env";
import { discoverEveMcpTools, executeEveMcpTool } from "../lib/eve/mcp-tools";

if (!["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname)) {
  throw new Error("MCP acceptance requires local Postgres.");
}

const requestSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string(),
  params: z.object({ name: z.string().optional() }).passthrough().optional(),
});

async function localMcpServer(
  invoke: (response: ServerResponse) => unknown | Promise<unknown>
) {
  const server = createServer(async (request, response) => {
    if (request.method !== "POST") {
      response.writeHead(405).end();
      return;
    }
    try {
      let body = "";
      for await (const chunk of request) {
        body += chunk.toString();
      }
      const rpc = requestSchema.parse(JSON.parse(body));
      if (rpc.id === undefined) {
        response.writeHead(202).end();
        return;
      }
      let result: unknown;
      switch (rpc.method) {
        case "initialize": {
          result = {
            protocolVersion: "2025-03-26",
            capabilities: { tools: {} },
            serverInfo: { name: "ChatJS local fixture", version: "1.0.0" },
          };
          break;
        }
        case "tools/list": {
          result = {
            tools: [
              {
                name: "read_token",
                description:
                  "Return the local acceptance token. Call once when asked.",
                inputSchema: {
                  type: "object",
                  properties: {},
                  additionalProperties: false,
                },
              },
            ],
          };
          break;
        }
        case "tools/call": {
          if (rpc.params?.name !== "read_token") {
            throw new Error("Unknown fixture tool");
          }
          result = await invoke(response);
          break;
        }
        default: {
          response.writeHead(200, { "content-type": "application/json" }).end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: rpc.id,
              error: { code: -32_601, message: "Method not found" },
            })
          );
          return;
        }
      }
      response
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify({ id: rpc.id, jsonrpc: "2.0", result }));
    } catch {
      response.writeHead(400).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Missing local MCP address");
  }
  return { address, server };
}

test("composer connector controls persist and fence native tool execution", async ({
  page,
}, testInfo) => {
  let calls = 0;
  const { server, address } = await localMcpServer(() => {
    calls += 1;
    return { content: [{ text: "connector fixture", type: "text" }] };
  });
  const id = crypto.randomUUID();
  const nameId = `test_${id.slice(0, 8)}`;
  try {
    await page.route("https://unpkg.com/react-scan/**", (route) =>
      route.abort()
    );
    await page.goto("/api/dev-login");
    const { user: owner } = z
      .object({ user: z.object({ id: z.string() }) })
      .parse(await (await page.request.get("/api/auth/get-session")).json());
    await db.insert(mcpConnector).values({
      enabled: true,
      id,
      name: "Local connector fixture",
      nameId,
      type: "http",
      url: `http://127.0.0.1:${address.port}/mcp`,
      userId: owner.id,
    });
    await page.goto("/");
    const control = page.getByRole("button", {
      exact: true,
      name: "Connectors",
    });
    const toggle = page.getByRole("switch", {
      name: "Enable Local connector fixture",
    });
    const discover = () =>
      discoverEveMcpTools(owner.id, AbortSignal.timeout(10_000));
    expect((await discover()).map((tool) => tool.name)).toContain(
      `${nameId}__read_token`
    );
    await expect(control).toBeVisible();
    await page
      .getByRole("group", { exact: true, name: "Message composer" })
      .screenshot({
        animations: "disabled",
        path: testInfo.outputPath("connectors-enabled.png"),
      });
    await control.click();
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await expect
      .poll(async () => {
        const [connector] = await db
          .select({ enabled: mcpConnector.enabled })
          .from(mcpConnector)
          .where(eq(mcpConnector.id, id));
        return connector?.enabled;
      })
      .toBe(false);
    expect((await discover()).map((tool) => tool.name)).not.toContain(
      `${nameId}__read_token`
    );
    await expect(
      executeEveMcpTool(
        id,
        "read_token",
        {},
        {
          abortSignal: AbortSignal.timeout(10_000),
          callId: "stale-tool-selection",
          session: {
            auth: {
              current: null,
              initiator: {
                attributes: {},
                authenticator: "fixture",
                principalId: owner.id,
                principalType: "user",
              },
            },
            id: "connector-ui-fixture",
            turn: { id: "turn_0", sequence: 0 },
          },
        },
        []
      )
    ).rejects.toThrow("MCP connector is unavailable");
    expect(calls).toBe(0);
    await page.setViewportSize({ height: 844, width: 390 });
    await page.reload();
    await control.click();
    await expect(toggle).not.toBeChecked();
    await page.getByRole("menu").screenshot({
      animations: "disabled",
      path: testInfo.outputPath("connectors-disabled-mobile.png"),
    });
    await toggle.click();
    await expect
      .poll(async () =>
        (await discover()).some((tool) => tool.name === `${nameId}__read_token`)
      )
      .toBe(true);
    await page.getByRole("menuitem", { name: "Manage Connectors" }).click();
    await expect(page).toHaveURL(
      `${new URL(page.url()).origin}/settings/connectors`
    );
    expect(calls).toBe(0);
  } finally {
    await db.delete(mcpConnector).where(eq(mcpConnector.id, id));
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});

test("native MCP executes and its saved result survives connector removal and reload", async ({
  page,
  browser,
}) => {
  const token = `MCP_RESULT_${crypto.randomUUID()}`;
  let calls = 0;
  const { server, address } = await localMcpServer(() => {
    calls += 1;
    return { content: [{ text: token, type: "text" }] };
  });
  const connectorId = crypto.randomUUID();
  const nameId = `test_${connectorId.slice(0, 8)}`;
  try {
    await page.route("https://unpkg.com/react-scan/**", (route) =>
      route.abort()
    );
    await page.goto("/api/dev-login");
    const session = z
      .object({ user: z.object({ id: z.string() }) })
      .parse(await (await page.request.get("/api/auth/get-session")).json());
    await db
      .insert(userCredit)
      .values({ credits: 1000, userId: session.user.id })
      .onConflictDoUpdate({
        set: { credits: sql`greatest(${userCredit.credits}, 1000)` },
        target: userCredit.userId,
      });
    await db.insert(mcpConnector).values({
      enabled: true,
      id: connectorId,
      name: "Local MCP acceptance",
      nameId,
      type: "http",
      url: `http://127.0.0.1:${address.port}/mcp`,
      userId: session.user.id,
    });
    const created = await page.request.post("/api/agent-conversations", {
      data: {
        message: `Call ${nameId}__read_token exactly once and repeat its returned token verbatim. Do not call other tools.`,
        modelId: "openai/gpt-4.1-mini-fast",
        operationId: crypto.randomUUID(),
      },
      headers: { origin: new URL(page.url()).origin },
    });
    expect(created.ok(), await created.text()).toBe(true);
    const binding = z.object({ id: z.uuid() }).parse(await created.json());
    await page.goto(`/chat/${binding.id}`);
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({
      timeout: 90_000,
    });
    await expect(
      page.getByRole("button", { exact: true, name: "read_token Completed" })
    ).toBeVisible();
    await expect(
      page.locator(".is-assistant p").filter({ hasText: token })
    ).toBeVisible();
    expect(calls).toBe(1);
    await page
      .getByRole("button", { exact: true, name: "read_token Completed" })
      .click();
    await expect(
      page.locator("pre:visible").filter({ hasText: token })
    ).toBeVisible();
    await db.delete(mcpConnector).where(eq(mcpConnector.id, connectorId));
    await page.reload();
    await page
      .getByRole("button", { exact: true, name: "read_token Completed" })
      .click();
    await expect(
      page.locator("pre:visible").filter({ hasText: token })
    ).toBeVisible();
    expect(calls).toBe(1);
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: "tests/eve-results/screenshots/eve-native-mcp.png",
    });
    const shared = await page.request.post("/api/trpc/eve.setVisibility", {
      data: { json: { id: binding.id, visibility: "public" } },
    });
    expect(shared.ok(), await shared.text()).toBe(true);
    const anonymous = await browser.newContext();
    try {
      const publicPage = await anonymous.newPage();
      let connectorRequests = 0;
      publicPage.on("request", (request) => {
        const procedures =
          decodeURIComponent(new URL(request.url()).pathname)
            .split("/api/trpc/")[1]
            ?.split(",") ?? [];
        if (procedures.some((procedure) => procedure.startsWith("mcp."))) {
          connectorRequests += 1;
        }
      });
      await publicPage.route("https://unpkg.com/react-scan/**", (route) =>
        route.abort()
      );
      await publicPage.goto(
        `${new URL(page.url()).origin}/share/${binding.id}`
      );
      await publicPage
        .getByRole("button", { exact: true, name: "read_token Completed" })
        .click();
      await expect(
        publicPage.locator("pre:visible").filter({ hasText: token })
      ).toBeVisible();
      await expect(publicPage.locator('[aria-label="Message"]')).toHaveCount(0);
      expect(connectorRequests).toBe(0);
      expect(calls).toBe(1);
    } finally {
      const privateAgain = await page.request.post(
        "/api/trpc/eve.setVisibility",
        {
          data: { json: { id: binding.id, visibility: "private" } },
        }
      );
      await anonymous.close();
      expect(privateAgain.ok(), await privateAgain.text()).toBe(true);
    }
  } finally {
    await db.delete(mcpConnector).where(eq(mcpConnector.id, connectorId));
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});

test("stopping a pending MCP call closes its transport and permits another message", async ({
  page,
}) => {
  let calls = 0;
  let disconnected = false;
  const completion = Promise.withResolvers<unknown>();
  const { server, address } = await localMcpServer((response) => {
    calls += 1;
    response.on("close", () => {
      disconnected = !response.writableEnded;
      completion.resolve({
        content: [{ text: "cancelled-fixture", type: "text" }],
      });
    });
    return completion.promise;
  });
  const connectorId = crypto.randomUUID();
  const nameId = `test_${connectorId.slice(0, 8)}`;
  try {
    await page.route("https://unpkg.com/react-scan/**", (route) =>
      route.abort()
    );
    await page.goto("/api/dev-login");
    const session = z
      .object({ user: z.object({ id: z.string() }) })
      .parse(await (await page.request.get("/api/auth/get-session")).json());
    await db
      .insert(userCredit)
      .values({ credits: 1000, userId: session.user.id })
      .onConflictDoUpdate({
        set: { credits: sql`greatest(${userCredit.credits}, 1000)` },
        target: userCredit.userId,
      });
    await db.insert(mcpConnector).values({
      enabled: true,
      id: connectorId,
      name: "Local MCP cancellation",
      nameId,
      type: "http",
      url: `http://127.0.0.1:${address.port}/mcp`,
      userId: session.user.id,
    });
    const created = await page.request.post("/api/agent-conversations", {
      data: {
        message: `Call ${nameId}__read_token exactly once and await its result. Do not call other tools.`,
        modelId: "openai/gpt-4.1-mini-fast",
        operationId: crypto.randomUUID(),
      },
      headers: { origin: new URL(page.url()).origin },
    });
    expect(created.ok(), await created.text()).toBe(true);
    const binding = z.object({ id: z.uuid() }).parse(await created.json());
    await page.goto(`/chat/${binding.id}`);
    await expect.poll(() => calls, { timeout: 60_000 }).toBe(1);
    const cancelled = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/cancel")
    );
    await page.getByRole("button", { exact: true, name: "Stop" }).click();
    const cancellation = await cancelled;
    expect(cancellation.request().postDataJSON()).toEqual({});
    expect(cancellation.ok(), await cancellation.text()).toBe(true);
    await expect.poll(() => disconnected, { timeout: 20_000 }).toBe(true);
    await expect(
      page.getByRole("button", { exact: true, name: "Stop" })
    ).toHaveCount(0);
    const token = `RECOVERED_${crypto.randomUUID()}`;
    const composer = page.getByRole("textbox", {
      exact: true,
      name: "Message",
    });
    await composer.fill(`Do not call tools. Reply exactly ${token}.`);
    await composer.press("Enter");
    await expect(
      page.locator(".is-assistant p").filter({ hasText: token })
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    await page.reload();
    await expect(
      page.locator(".is-assistant p").filter({ hasText: token })
    ).toBeVisible();
    expect(calls).toBe(1);
  } finally {
    completion.resolve({
      content: [{ text: "fixture-cleanup", type: "text" }],
    });
    await db.delete(mcpConnector).where(eq(mcpConnector.id, connectorId));
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});

test("the real MCP client aborts an in-flight HTTP tool request", async () => {
  const started = Promise.withResolvers<undefined>();
  const finished = Promise.withResolvers<unknown>();
  let disconnected = false;
  const { server, address } = await localMcpServer((response) => {
    response.on("close", () => {
      disconnected = !response.writableEnded;
      finished.resolve({ content: [] });
    });
    started.resolve(undefined);
    return finished.promise;
  });
  const connectorId = crypto.randomUUID();
  await db.insert(mcpConnector).values({
    enabled: false,
    id: connectorId,
    name: "Direct MCP cancellation fixture",
    nameId: `test_${connectorId.slice(0, 8)}`,
    type: "http",
    url: `http://127.0.0.1:${address.port}/mcp`,
    userId: null,
  });
  const client = new MCPClient(connectorId, "Local fixture", {
    type: "http",
    url: `http://127.0.0.1:${address.port}/mcp`,
  });
  try {
    await client.connect();
    const tools = await client.tools();
    const { execute } = tools.read_token;
    if (!execute) {
      throw new Error("Missing fixture executor");
    }
    const controller = new AbortController();
    const result = execute(
      {},
      {
        abortSignal: controller.signal,
        context: {},
        messages: [],
        toolCallId: "isolated",
      }
    );
    const rejected = expect(Promise.resolve(result)).rejects.toThrow();
    await started.promise;
    controller.abort();
    await rejected;
    await expect.poll(() => disconnected).toBe(true);
  } finally {
    finished.resolve({ content: [] });
    await client.close();
    await db.delete(mcpConnector).where(eq(mcpConnector.id, connectorId));
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});
