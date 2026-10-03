/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/ai/mcp/mcp-client"; "../lib/db/client"; "../lib/db/schema"; "../lib/eve/contracts"; "../lib/eve/mcp-tools" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
/* oxlint-disable unicorn/no-await-expression-member -- Direct awaited assertions keep each test action tied to its expectation. */
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
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): assertEveTestDatabase reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
/* oxlint-enable node/no-process-env */

/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/max-nested-calls  --
 * init-declarations (#507): test("MCP OAuth callback persists credentials for fresh Eve clients and native execut assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): test("MCP OAuth callback persists credentials for fresh Eve clients and native execut keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("MCP OAuth callback persists credentials for fresh Eve clients and native execut keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("MCP OAuth callback persists credentials for fresh Eve clients and native execut uses 180_000, 0, 8, 1, 15_000, 2, 3, 200 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("MCP OAuth callback persists credentials for fresh Eve clients and native execut uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): test("MCP OAuth callback persists credentials for fresh Eve clients and native execut sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep test("MCP OAuth callback persists credentials for fresh Eve clients and native execut's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): test("MCP OAuth callback persists credentials for fresh Eve clients and native execut accepts { page, }; testInfo; route; row; tool; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("MCP OAuth callback persists credentials for fresh Eve clients and native execut preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): test("MCP OAuth callback persists credentials for fresh Eve clients and native execut intentionally keeps the existing falsy-value behavior of conversationId; origin; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/max-nested-calls (#568): test("MCP OAuth callback persists credentials for fresh Eve clients and native execut keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
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
    ({ origin } = new URL(page.url()));
    const { user: owner } = z
      .object({ user: z.object({ id: z.string() }) })
      .parse(await (await page.request.get("/api/auth/get-session")).json());
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
          type: "http",
          url: fixture.mcpUrl,
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
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/max-nested-calls */
