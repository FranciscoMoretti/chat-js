import { createServer, type ServerResponse } from "node:http";
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
        case "initialize":
          result = {
            protocolVersion: "2025-03-26",
            capabilities: { tools: {} },
            serverInfo: { name: "ChatJS local fixture", version: "1.0.0" },
          };
          break;
        case "tools/list":
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
        case "tools/call":
          if (rpc.params?.name !== "read_token") {
            throw new Error("Unknown fixture tool");
          }
          result = await invoke(response);
          break;
        default:
          response.writeHead(200, { "content-type": "application/json" }).end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: rpc.id,
              error: { code: -32_601, message: "Method not found" },
            })
          );
          return;
      }
      response
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }));
    } catch {
      response.writeHead(400).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Missing local MCP address");
  }
  return { server, address };
}

test("composer connector controls persist and fence native tool execution", async ({
  page,
}, testInfo) => {
  let calls = 0;
  const { server, address } = await localMcpServer(() => {
    calls += 1;
    return { content: [{ type: "text", text: "connector fixture" }] };
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
      id,
      userId: owner.id,
      name: "Local connector fixture",
      nameId,
      url: `http://127.0.0.1:${address.port}/mcp`,
      type: "http",
      enabled: true,
    });
    await page.goto("/");
    const control = page.getByRole("button", {
      name: "Connectors",
      exact: true,
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
      .getByRole("group", { name: "Message composer", exact: true })
      .screenshot({
        path: testInfo.outputPath("connectors-enabled.png"),
        animations: "disabled",
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
          session: {
            id: "connector-ui-fixture",
            turn: { id: "turn_0", sequence: 0 },
            auth: {
              current: null,
              initiator: {
                principalId: owner.id,
                principalType: "user",
                authenticator: "fixture",
                attributes: {},
              },
            },
          },
          callId: "stale-tool-selection",
          abortSignal: AbortSignal.timeout(10_000),
        },
        []
      )
    ).rejects.toThrow("MCP connector is unavailable");
    expect(calls).toBe(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await control.click();
    await expect(toggle).not.toBeChecked();
    await page.getByRole("menu").screenshot({
      path: testInfo.outputPath("connectors-disabled-mobile.png"),
      animations: "disabled",
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
    return { content: [{ type: "text", text: token }] };
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
      .values({ userId: session.user.id, credits: 1000 })
      .onConflictDoUpdate({
        target: userCredit.userId,
        set: { credits: sql`greatest(${userCredit.credits}, 1000)` },
      });
    await db.insert(mcpConnector).values({
      id: connectorId,
      userId: session.user.id,
      name: "Local MCP acceptance",
      nameId,
      url: `http://127.0.0.1:${address.port}/mcp`,
      type: "http",
      enabled: true,
    });
    const created = await page.request.post("/api/agent-conversations", {
      headers: { origin: new URL(page.url()).origin },
      data: {
        operationId: crypto.randomUUID(),
        modelId: "openai/gpt-4.1-mini-fast",
        message: `Call ${nameId}__read_token exactly once and repeat its returned token verbatim. Do not call other tools.`,
      },
    });
    expect(created.ok(), await created.text()).toBe(true);
    const binding = z.object({ id: z.uuid() }).parse(await created.json());
    await page.goto(`/chat/${binding.id}`);
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({
      timeout: 90_000,
    });
    await expect(
      page.getByRole("button", { name: "read_token Completed", exact: true })
    ).toBeVisible();
    await expect(
      page.locator(".is-assistant p").filter({ hasText: token })
    ).toBeVisible();
    expect(calls).toBe(1);
    await page
      .getByRole("button", { name: "read_token Completed", exact: true })
      .click();
    await expect(
      page.locator("pre:visible").filter({ hasText: token })
    ).toBeVisible();
    await db.delete(mcpConnector).where(eq(mcpConnector.id, connectorId));
    await page.reload();
    await page
      .getByRole("button", { name: "read_token Completed", exact: true })
      .click();
    await expect(
      page.locator("pre:visible").filter({ hasText: token })
    ).toBeVisible();
    expect(calls).toBe(1);
    await page.screenshot({
      path: "tests/eve-results/screenshots/eve-native-mcp.png",
      fullPage: true,
      animations: "disabled",
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
        .getByRole("button", { name: "read_token Completed", exact: true })
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
        content: [{ type: "text", text: "cancelled-fixture" }],
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
      .values({ userId: session.user.id, credits: 1000 })
      .onConflictDoUpdate({
        target: userCredit.userId,
        set: { credits: sql`greatest(${userCredit.credits}, 1000)` },
      });
    await db.insert(mcpConnector).values({
      id: connectorId,
      userId: session.user.id,
      name: "Local MCP cancellation",
      nameId,
      url: `http://127.0.0.1:${address.port}/mcp`,
      type: "http",
      enabled: true,
    });
    const created = await page.request.post("/api/agent-conversations", {
      headers: { origin: new URL(page.url()).origin },
      data: {
        operationId: crypto.randomUUID(),
        modelId: "openai/gpt-4.1-mini-fast",
        message: `Call ${nameId}__read_token exactly once and await its result. Do not call other tools.`,
      },
    });
    expect(created.ok(), await created.text()).toBe(true);
    const binding = z.object({ id: z.uuid() }).parse(await created.json());
    await page.goto(`/chat/${binding.id}`);
    await expect.poll(() => calls, { timeout: 60_000 }).toBe(1);
    const cancelled = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/cancel")
    );
    await page.getByRole("button", { name: "Stop", exact: true }).click();
    const cancellation = await cancelled;
    expect(cancellation.request().postDataJSON()).toEqual({});
    expect(cancellation.ok(), await cancellation.text()).toBe(true);
    await expect.poll(() => disconnected, { timeout: 20_000 }).toBe(true);
    await expect(
      page.getByRole("button", { name: "Stop", exact: true })
    ).toHaveCount(0);
    const token = `RECOVERED_${crypto.randomUUID()}`;
    const composer = page.getByRole("textbox", {
      name: "Message",
      exact: true,
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
      content: [{ type: "text", text: "fixture-cleanup" }],
    });
    await db.delete(mcpConnector).where(eq(mcpConnector.id, connectorId));
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});

test("the real MCP client aborts an in-flight HTTP tool request", async () => {
  const started = Promise.withResolvers<void>();
  const finished = Promise.withResolvers<unknown>();
  let disconnected = false;
  const { server, address } = await localMcpServer((response) => {
    response.on("close", () => {
      disconnected = !response.writableEnded;
      finished.resolve({ content: [] });
    });
    started.resolve();
    return finished.promise;
  });
  const connectorId = crypto.randomUUID();
  await db.insert(mcpConnector).values({
    id: connectorId,
    userId: null,
    name: "Direct MCP cancellation fixture",
    nameId: `test_${connectorId.slice(0, 8)}`,
    url: `http://127.0.0.1:${address.port}/mcp`,
    type: "http",
    enabled: false,
  });
  const client = new MCPClient(connectorId, "Local fixture", {
    url: `http://127.0.0.1:${address.port}/mcp`,
    type: "http",
  });
  try {
    await client.connect();
    const tools = await client.tools();
    const execute = tools.read_token.execute;
    if (!execute) {
      throw new Error("Missing fixture executor");
    }
    const controller = new AbortController();
    const result = execute(
      {},
      {
        toolCallId: "isolated",
        messages: [],
        context: {},
        abortSignal: controller.signal,
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
