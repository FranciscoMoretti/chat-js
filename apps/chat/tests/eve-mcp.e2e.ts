/* oxlint-disable import/no-nodejs-modules, import/no-relative-parent-imports --
 * import/no-nodejs-modules (#529): This test harness requires import { createServer } from "node:http";; import type { ServerResponse } from "node:http";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/ai/mcp/mcp-client"; "../lib/db/client"; "../lib/db/schema"; "../lib/env"; "../lib/eve/mcp-tools" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable eslint/no-promise-executor-return -- These Promise executors directly register callback APIs whose return values are ignored. */
/* oxlint-disable promise/avoid-new -- These fixtures adapt callback, timer, stream, or browser event APIs into awaited Promises. */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
import type { ServerResponse } from "node:http";
import { createServer } from "node:http";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { expect, test } from "@playwright/test";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eq, sql } from "drizzle-orm";
/* oxlint-enable sort-imports */
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { MCPClient } from "../lib/ai/mcp/mcp-client";
/* oxlint-enable sort-imports */
import { db } from "../lib/db/client";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { mcpConnector, userCredit } from "../lib/db/schema";
/* oxlint-enable sort-imports */
import { env } from "../lib/env";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { discoverEveMcpTools, executeEveMcpTool } from "../lib/eve/mcp-tools";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules, import/no-relative-parent-imports */

if (!["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname)) {
  throw new Error("MCP acceptance requires local Postgres.");
}

const requestSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string(),
  params: z.object({ name: z.string().optional() }).loose().optional(),
});

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve localMcpServer's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return --
 * init-declarations (#507): localMcpServer assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): localMcpServer keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): localMcpServer keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): localMcpServer uses 405, 202, 200, 400, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): localMcpServer uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/explicit-function-return-type (#560): Keep localMcpServer's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): localMcpServer accepts response: ServerResponse; request; response; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): localMcpServer intentionally keeps the existing falsy-value behavior of address; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * typescript/strict-void-return (#611): localMcpServer's void callback contract discards its result; changing the callback API or operation order solely to hide the return value is unnecessary.
 */
async function localMcpServer(invoke: (response: ServerResponse) => unknown) {
  const server = createServer((request, response) => {
    void (async (): Promise<void> => {
      try {
        if (request.method !== "POST") {
          response.writeHead(405).end();
          return;
        }
        try {
          let body = "";
          for await (const chunk of request) {
            if (typeof chunk !== "string" && !Buffer.isBuffer(chunk)) {
              throw new TypeError(
                "Expected a string or Buffer HTTP body chunk"
              );
            }
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
                serverInfo: {
                  name: "ChatJS local fixture",
                  version: "1.0.0",
                },
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
              // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading name from rpc.params; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
              if (rpc.params?.name !== "read_token") {
                throw new Error("Unknown fixture tool");
              }
              result = await invoke(response);
              break;
            }
            default: {
              response
                .writeHead(200, { "content-type": "application/json" })
                .end(
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
      } catch (error) {
        if (error instanceof Error) {
          response.destroy(error);
        } else {
          response.destroy(new Error(String(error)));
        }
      }
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Missing local MCP address");
  }
  return { address, server };
}
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-void-return, unicorn/no-null --
 * max-lines-per-function (#510): test("composer connector controls persist and fence native tool execution") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("composer connector controls persist and fence native tool execution") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("composer connector controls persist and fence native tool execution") uses 1, 0, 8, 10_000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/explicit-function-return-type (#560): Keep test("composer connector controls persist and fence native tool execution")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): test("composer connector controls persist and fence native tool execution") accepts { page, }; testInfo; route; tool; error; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("composer connector controls persist and fence native tool execution") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-void-return (#611): test("composer connector controls persist and fence native tool execution")'s void callback contract discards its result; changing the callback API or operation order solely to hide the return value is unnecessary.
 * unicorn/no-null (#570): test("composer connector controls persist and fence native tool execution") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
    const authSessionResponse = await page.request.get("/api/auth/get-session");
    const { user: owner } = z
      .object({ user: z.object({ id: z.string() }) })
      .parse(await authSessionResponse.json());
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
    const control = page.getByRole("menuitem", {
      exact: true,
      name: "Connectors",
    });
    const toggle = page.getByRole("menuitemcheckbox", {
      name: "Local connector fixture",
    });
    const discover = () =>
      discoverEveMcpTools(owner.id, AbortSignal.timeout(10_000));
    const enabledConnectorTools = await discover();
    expect(enabledConnectorTools.map((tool) => tool.name)).toContain(
      `${nameId}__read_token`
    );
    await expect(
      page.getByRole("button", { name: "Composer options" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Composer options" }).click();
    await control.click();
    await expect(toggle).toBeChecked();
    await page
      .getByRole("menu")
      .filter({
        has: page.getByRole("menuitem", { name: "Manage connectors" }),
      })
      .screenshot({
        animations: "disabled",
        path: testInfo.outputPath("connectors-enabled.png"),
      });
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await expect
      .poll(async () => {
        const [connector] = await db
          .select({ enabled: mcpConnector.enabled })
          .from(mcpConnector)
          .where(eq(mcpConnector.id, id));
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading enabled from connector; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
        return connector?.enabled;
      })
      .toBe(false);
    const disabledConnectorTools = await discover();
    expect(disabledConnectorTools.map((tool) => tool.name)).not.toContain(
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
    await page.getByRole("button", { name: "Composer options" }).click();
    await control.click();
    await expect(toggle).not.toBeChecked();
    await page
      .getByRole("menu")
      .filter({
        has: page.getByRole("menuitem", { name: "Manage connectors" }),
      })
      .screenshot({
        animations: "disabled",
        path: testInfo.outputPath("connectors-disabled-mobile.png"),
      });
    await toggle.click();
    await expect
      .poll(async () => {
        const discoveredTools = await discover();
        return discoveredTools.some(
          (tool) => tool.name === `${nameId}__read_token`
        );
      })
      .toBe(true);
    await page.getByRole("menuitem", { name: "Manage connectors" }).click();
    await expect(page).toHaveURL(
      `${new URL(page.url()).origin}/settings/connectors`
    );
    expect(calls).toBe(0);
  } finally {
    await db.delete(mcpConnector).where(eq(mcpConnector.id, id));
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      })
    );
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-void-return, unicorn/no-null */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-void-return --
 * max-lines-per-function (#510): test("native MCP executes and its saved result survives connector removal and reload" keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("native MCP executes and its saved result survives connector removal and reload" keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("native MCP executes and its saved result survives connector removal and reload" uses 1, 0, 8 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("native MCP executes and its saved result survives connector removal and reload" accepts { page, browser, }; route; request; error; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("native MCP executes and its saved result survives connector removal and reload" preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-void-return (#611): test("native MCP executes and its saved result survives connector removal and reload"'s void callback contract discards its result; changing the callback API or operation order solely to hide the return value is unnecessary.
 */
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
    const authSessionResponse = await page.request.get("/api/auth/get-session");
    const session = z
      .object({ user: z.object({ id: z.string() }) })
      .parse(await authSessionResponse.json());
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
          // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading split from decodeURIComponent(...).split(...)[1]; preserve one receiver evaluation, skipped accesses and the existing [] fallback. The app guidance prefers optional chaining.
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
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      })
    );
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-void-return */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-void-return --
 * max-lines-per-function (#510): test("stopping a pending MCP call closes its transport and permits another message") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("stopping a pending MCP call closes its transport and permits another message") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("stopping a pending MCP call closes its transport and permits another message") uses 1, 0, 8 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("stopping a pending MCP call closes its transport and permits another message") accepts { page, }; response; route; error; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("stopping a pending MCP call closes its transport and permits another message") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-void-return (#611): test("stopping a pending MCP call closes its transport and permits another message")'s void callback contract discards its result; changing the callback API or operation order solely to hide the return value is unnecessary.
 */
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
    const authSessionResponse = await page.request.get("/api/auth/get-session");
    const session = z
      .object({ user: z.object({ id: z.string() }) })
      .parse(await authSessionResponse.json());
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
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      })
    );
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-void-return */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-void-return, unicorn/no-null --
 * max-lines-per-function (#510): test("the real MCP client aborts an in-flight HTTP tool request") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("the real MCP client aborts an in-flight HTTP tool request") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("the real MCP client aborts an in-flight HTTP tool request") uses 0, 8 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("the real MCP client aborts an in-flight HTTP tool request") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): test("the real MCP client aborts an in-flight HTTP tool request") accepts response; error; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("the real MCP client aborts an in-flight HTTP tool request") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-void-return (#611): test("the real MCP client aborts an in-flight HTTP tool request")'s void callback contract discards its result; changing the callback API or operation order solely to hide the return value is unnecessary.
 * unicorn/no-null (#570): test("the real MCP client aborts an in-flight HTTP tool request") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
    const result: unknown = execute(
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
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      })
    );
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-void-return, unicorn/no-null */

/* oxlint-disable max-lines -- #509: This eve-mcp.e2e.ts module keeps its existing fixture/scenario boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
