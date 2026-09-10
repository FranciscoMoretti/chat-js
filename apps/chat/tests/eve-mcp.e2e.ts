import { createServer } from "node:http";
import { expect, test } from "@playwright/test";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../lib/db/client";
import { mcpConnector, userCredit } from "../lib/db/schema";
import { env } from "../lib/env";

if (!["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname)) {
  throw new Error("MCP acceptance requires local Postgres.");
}

const requestSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string(),
  params: z.object({ name: z.string().optional() }).passthrough().optional(),
});

test("native MCP executes and its saved result survives connector removal and reload", async ({
  page,
  browser,
}) => {
  const token = `MCP_RESULT_${crypto.randomUUID()}`;
  let calls = 0;
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
          calls += 1;
          result = { content: [{ type: "text", text: token }] };
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
