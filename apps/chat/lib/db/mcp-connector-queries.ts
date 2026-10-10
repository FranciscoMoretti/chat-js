import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import type { McpConnector } from "@/lib/db/schema";
import { db } from "@/lib/db/client";
import { mcpConnector } from "@/lib/db/schema";
/* oxlint-disable sort-imports -- Keep database/schema initialization before Pino logger initialization; their complete runtime graphs have not been proved to commute. */
import { createModuleLogger } from "@/lib/logger";
/* oxlint-enable sort-imports */

const log = createModuleLogger("mcp-queries");
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getMcpConnectorsByUserId's awaited sequencing and rejected-Promise behavior. */
// MCP Connector queries

const getMcpConnectorsByUserId = async ({
  userId,
}: Readonly<{
  userId: string;
}>): Promise<McpConnector[]> => {
  try {
    return await db
      .select()
      .from(mcpConnector)
      .where(or(eq(mcpConnector.userId, userId), isNull(mcpConnector.userId)))
      .orderBy(desc(mcpConnector.createdAt));
  } catch (error) {
    log.error({ err: error }, "Failed to get MCP connectors from database");
    throw error;
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getMcpConnectorById's awaited sequencing and rejected-Promise behavior. */
const getMcpConnectorById = async ({
  id,
}: Readonly<{
  id: string;
}>): Promise<McpConnector | undefined> => {
  try {
    const [connector] = await db
      .select()
      .from(mcpConnector)
      .where(eq(mcpConnector.id, id));
    return connector;
  } catch (error) {
    log.error(
      { err: error },
      "Failed to get MCP connector by id from database"
    );
    throw error;
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getMcpConnectorByNameId's awaited sequencing and rejected-Promise behavior. */
const getMcpConnectorByNameId = async ({
  userId,
  nameId,
  excludeId,
}: Readonly<{
  userId: string | null;
  nameId: string;
  excludeId?: string;
}>): Promise<McpConnector | undefined> => {
  try {
    const conditions = [
      eq(mcpConnector.nameId, nameId),
      // oxlint-disable-next-line no-ternary -- Keep ArrayLiteralExpression as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      userId === null
        ? isNull(mcpConnector.userId)
        : eq(mcpConnector.userId, userId),
    ];

    const whereClause =
      // oxlint-disable-next-line no-ternary -- Keep whereClause as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      typeof excludeId === "string" && excludeId !== ""
        ? and(...conditions, sql`${mcpConnector.id} != ${excludeId}::uuid`)
        : and(...conditions);

    const [connector] = await db.select().from(mcpConnector).where(whereClause);
    return connector;
  } catch (error) {
    log.error(
      { err: error },
      "Failed to get MCP connector by nameId from database"
    );
    throw error;
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve createMcpConnector's awaited sequencing and rejected-Promise behavior. */
const createMcpConnector = async ({
  userId,
  name,
  nameId,
  url,
  type,
  oauthClientId,
  oauthClientSecret,
}: Readonly<{
  userId: string | null;
  name: string;
  nameId: string;
  url: string;
  type: "http" | "sse";
  oauthClientId?: string;
  oauthClientSecret?: string;
}>): Promise<McpConnector> => {
  try {
    const [connector] = await db
      .insert(mcpConnector)
      .values({
        name,
        nameId,
        // oxlint-disable-next-line unicorn/no-null -- Explicit SQL NULL clears an absent OAuth credential; empty strings are credentials and omitting the binding delegates to column defaults.
        oauthClientId: oauthClientId ?? null,
        // oxlint-disable-next-line unicorn/no-null -- Explicit SQL NULL clears an absent OAuth secret; empty strings are credentials and omitting the binding delegates to column defaults.
        oauthClientSecret: oauthClientSecret ?? null,
        type,
        url,
        userId,
      })
      .returning();
    return connector;
  } catch (error) {
    log.error({ err: error }, "Failed to create MCP connector in database");
    throw error;
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve updateMcpConnector's awaited sequencing and rejected-Promise behavior. */
const updateMcpConnector = async ({
  id,
  updates,
}: Readonly<{
  id: string;
  updates: Readonly<
    Partial<{
      name: string;
      nameId: string;
      url: string;
      type: "http" | "sse";
      oauthClientId: string | null;
      oauthClientSecret: string | null;
      enabled: boolean;
      requireApproval: boolean;
    }>
  >;
}>): Promise<void> => {
  try {
    await db
      .update(mcpConnector)
      .set({
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing updates own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(mcpConnector.id, id));
  } catch (error) {
    log.error({ err: error }, "Failed to update MCP connector in database");
    throw error;
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve deleteMcpConnector's awaited sequencing and rejected-Promise behavior. */
const deleteMcpConnector = async ({
  id,
}: Readonly<{ id: string }>): Promise<void> => {
  try {
    await db.delete(mcpConnector).where(eq(mcpConnector.id, id));
  } catch (error) {
    log.error({ err: error }, "Failed to delete MCP connector from database");
    throw error;
  }
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (createMcpConnector, deleteMcpConnector, getMcpConnectorById, getMcpConnectorByNameId, getMcpConnectorsByUserId, updateMcpConnector); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable oxc/no-async-await */
export {
  createMcpConnector,
  deleteMcpConnector,
  getMcpConnectorById,
  getMcpConnectorByNameId,
  getMcpConnectorsByUserId,
  updateMcpConnector,
};
/* oxlint-enable import/no-named-export */
