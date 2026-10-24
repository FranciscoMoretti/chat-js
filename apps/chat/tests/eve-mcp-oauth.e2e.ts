import { expect, test } from "@playwright/test";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { MCPClient } from "../lib/ai/mcp/mcp-client";
import { db } from "../lib/db/client";
import { userCredit } from "../lib/db/schema";
import { mcpConnector, mcpOAuthSession } from "@/features/mcp/db/mcp-schema";
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
    await page.route("https://unpkg.com/react-scan/**", async (route) => {
      await route.abort();
    });
    await page.goto("/api/dev-login");
    ({ origin } = new URL(page.url()));
    const authSessionResponse = await page.request.get("/api/auth/get-session");
    const { user: owner } = z
      .object({ user: z.object({ id: z.string() }) })
      .parse(await authSessionResponse.json());
    await db
      .insert(userCredit)
      .values({ credits: 1000, userId: owner.id })
      .onConflictDoUpdate({
        set: { credits: sql`greatest(${userCredit.credits}, 1000)` },
        target: userCredit.userId,
      });
    await db.insert(mcpConnector).values({
      enabled: true,
      id: connectorId,
      name: "Local OAuth fixture",
      nameId,
      requireApproval: true,
      type: "http",
      url: fixture.mcpUrl,
      userId: owner.id,
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
    expect(
      saved.some((row: Readonly<{ tokens: unknown }>) => row.tokens !== null)
    ).toBe(true);
    expect(fixture.counters.tokenExchanges).toBe(1);
    await page.goto("/");
    const discover = async () =>
      await discoverEveMcpTools(owner.id, AbortSignal.timeout(15_000));
    const toolsAfterOAuthCallback = await discover();
    expect(
      toolsAfterOAuthCallback.map(
        (tool: { readonly name: string }) => tool.name
      )
    ).toContain(`${nameId}__read_token`);
    fixture.invalidateAccessTokens();
    const toolsAfterTokenRefresh = await discover();
    expect(
      toolsAfterTokenRefresh.map((tool: { readonly name: string }) => tool.name)
    ).toContain(`${nameId}__read_token`);
    expect(fixture.counters.refreshes).toBe(1);
    expect(fixture.counters.authorizations).toBe(1);
    expect(fixture.counters.toolCalls).toBe(0);
    fixture.invalidateAccessTokens();
    const clients = [0, 1].map(
      () =>
        new MCPClient(connectorId, "OAuth concurrency fixture", {
          type: "http",
          url: fixture.mcpUrl,
        })
    );
    try {
      await Promise.allSettled(
        clients.map(async (client: Readonly<Pick<MCPClient, "connect">>) => {
          await client.connect({ abortSignal: AbortSignal.timeout(15_000) });
        })
      );
      expect(
        clients.map(
          (client: Readonly<Pick<MCPClient, "status">>) => client.status
        )
      ).toEqual(["connected", "connected"]);
      expect(fixture.counters.refreshes).toBe(2);
      fixture.invalidateAccessTokens();
      const tools = await Promise.all(
        clients.map(
          async (client: Readonly<Pick<MCPClient, "tools">>) =>
            await client.tools()
        )
      );
      expect(
        tools.every((definitions: Readonly<Record<string, unknown>>) =>
          Object.hasOwn(definitions, "read_token")
        )
      ).toBe(true);
      expect(fixture.counters.refreshes).toBe(3);
    } finally {
      await Promise.all(
        clients.map(async (client: Readonly<Pick<MCPClient, "close">>) => {
          await client.close();
        })
      );
    }
    const toolsAfterSecondTokenRefresh = await discover();
    expect(
      toolsAfterSecondTokenRefresh.map(
        (tool: { readonly name: string }) => tool.name
      )
    ).toContain(`${nameId}__read_token`);

    const created = await page.request.post("/api/agent-conversations", {
      data: {
        message: `Call ${nameId}__read_token exactly once and repeat the returned token verbatim. Do not use other tools.`,
        modelId: "openai/gpt-5-nano",
        operationId: crypto.randomUUID(),
      },
      headers: { origin },
    });
    expect(created.status(), await created.text()).toBe(200);
    const binding = conversationBinding.parse(await created.json());
    conversationId = binding.id;
    await page.goto(`/chat/${binding.id}`);
    const approve = page.getByRole("button", { exact: true, name: "Approve" });
    await expect(approve).toBeVisible({ timeout: 90_000 });
    expect(fixture.counters.toolCalls).toBe(0);
    await page.reload();
    await expect(approve).toBeVisible();
    expect(fixture.counters.toolCalls).toBe(0);
    await approve.click();
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
      if (
        conversationId !== undefined &&
        conversationId !== null &&
        conversationId !== "" &&
        origin !== undefined &&
        origin !== null &&
        origin !== ""
      ) {
        const requestOrigin = origin;
        const url = `/api/agent-conversations/${conversationId}`;
        await expect
          .poll(
            async () => {
              const deletionResponse = await page.request.delete(url, {
                headers: { origin: requestOrigin },
                timeout: 15_000,
              });
              return [200, 404].includes(deletionResponse.status());
            },
            { intervals: [1000, 2000, 5000], timeout: 60_000 }
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
