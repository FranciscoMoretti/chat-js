import { expect, test } from "@playwright/test";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { MCPClient } from "../lib/ai/mcp/mcp-client";
import { db } from "../lib/db/client";
import { mcpConnector, mcpOAuthSession, userCredit } from "../lib/db/schema";
import { conversationBinding } from "../lib/eve/contracts";
import { discoverEveMcpTools } from "../lib/eve/mcp-tools";
import { assertEveTestDatabase } from "./eve-test-database";
import { startEveOAuthMcpServer } from "./fixtures/eve-oauth-mcp-server";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

test("MCP OAuth callback persists credentials for fresh Eve clients and native execution", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const fixture = await startEveOAuthMcpServer();
  const connectorId = crypto.randomUUID();
  const nameId = `oauth_${connectorId.slice(0, 8)}`;
  let conversationId: string | undefined;
  let origin: string | undefined;
  try {
    await page.route("https://unpkg.com/react-scan/**", (route) =>
      route.abort()
    );
    await page.goto("/api/dev-login");
    origin = new URL(page.url()).origin;
    const { user: owner } = z
      .object({ user: z.object({ id: z.string() }) })
      .parse(await (await page.request.get("/api/auth/get-session")).json());
    await db
      .insert(userCredit)
      .values({ userId: owner.id, credits: 1000 })
      .onConflictDoUpdate({
        target: userCredit.userId,
        set: { credits: sql`greatest(${userCredit.credits}, 1000)` },
      });
    await db.insert(mcpConnector).values({
      id: connectorId,
      userId: owner.id,
      name: "Local OAuth fixture",
      nameId,
      url: fixture.mcpUrl,
      type: "http",
      enabled: true,
    });
    const authorize = await page.request.post("/api/trpc/mcp.authorize", {
      data: { json: { id: connectorId } },
    });
    expect(authorize.ok(), await authorize.text()).toBe(true);
    const payload = z
      .object({
        result: z.object({
          data: z.object({ json: z.object({ authorizationUrl: z.url() }) }),
        }),
      })
      .parse(await authorize.json());
    const authorizationUrl = new URL(payload.result.data.json.authorizationUrl);
    expect(authorizationUrl.origin).toBe(fixture.origin);
    await page.goto(authorizationUrl.href);

    await expect(page).toHaveURL(
      `${origin}/settings/connectors/${connectorId}?connected=1`,
      { timeout: 30_000 }
    );
    const saved = await db
      .select({ tokens: mcpOAuthSession.tokens })
      .from(mcpOAuthSession)
      .where(eq(mcpOAuthSession.mcpConnectorId, connectorId));
    expect(saved.some((row) => row.tokens !== null)).toBe(true);
    expect(fixture.counters.tokenExchanges).toBe(1);
    await page.goto("/");
    const discover = () =>
      discoverEveMcpTools(owner.id, AbortSignal.timeout(15_000));
    expect((await discover()).map((tool) => tool.name)).toContain(
      `${nameId}__read_token`
    );
    fixture.invalidateAccessTokens();
    expect((await discover()).map((tool) => tool.name)).toContain(
      `${nameId}__read_token`
    );
    expect(fixture.counters.refreshes).toBe(1);
    expect(fixture.counters.authorizations).toBe(1);
    expect(fixture.counters.toolCalls).toBe(0);
    fixture.invalidateAccessTokens();
    const clients = [0, 1].map(
      () =>
        new MCPClient(connectorId, "OAuth concurrency fixture", {
          url: fixture.mcpUrl,
          type: "http",
        })
    );
    try {
      await Promise.allSettled(
        clients.map((client) =>
          client.connect(undefined, AbortSignal.timeout(15_000))
        )
      );
      expect(clients.map((client) => client.status)).toEqual([
        "connected",
        "connected",
      ]);
      expect(fixture.counters.refreshes).toBe(2);
      fixture.invalidateAccessTokens();
      const tools = await Promise.all(clients.map((client) => client.tools()));
      expect(
        tools.every((definitions) => Object.hasOwn(definitions, "read_token"))
      ).toBe(true);
      expect(fixture.counters.refreshes).toBe(3);
    } finally {
      await Promise.all(clients.map((client) => client.close()));
    }
    expect((await discover()).map((tool) => tool.name)).toContain(
      `${nameId}__read_token`
    );

    const created = await page.request.post("/api/agent-conversations", {
      headers: { origin },
      data: {
        operationId: crypto.randomUUID(),
        modelId: "openai/gpt-5-nano",
        message: `Call ${nameId}__read_token exactly once and repeat the returned token verbatim. Do not use other tools.`,
      },
    });
    expect(created.status(), await created.text()).toBe(200);
    const binding = conversationBinding.parse(await created.json());
    conversationId = binding.id;
    await page.goto(`/chat/${binding.id}`);
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByRole("log")).toContainText(fixture.tokenResult);
    expect(fixture.counters.toolCalls).toBe(1);
    await page.reload();
    await expect(page.getByRole("log")).toContainText(fixture.tokenResult);
    expect(fixture.counters.toolCalls).toBe(1);
    expect(fixture.counters.tokenExchanges).toBe(1);
  } finally {
    testInfo.setTimeout(testInfo.timeout + 60_000);
    try {
      if (conversationId && origin) {
        const requestOrigin = origin;
        const url = `/api/agent-conversations/${conversationId}`;
        await expect
          .poll(
            async () =>
              [200, 404].includes(
                (
                  await page.request.delete(url, {
                    headers: { origin: requestOrigin },
                    timeout: 15_000,
                  })
                ).status()
              ),
            { timeout: 60_000, intervals: [1000, 2000, 5000] }
          )
          .toBe(true);
      }
    } finally {
      try {
        await db.delete(mcpConnector).where(eq(mcpConnector.id, connectorId));
      } finally {
        await fixture.close();
      }
    }
  }
});
