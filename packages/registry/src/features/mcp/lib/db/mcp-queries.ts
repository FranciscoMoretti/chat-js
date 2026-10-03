import type {
  OAuthClientInformation,
  OAuthClientMetadata,
  OAuthTokens,
} from "@ai-sdk/mcp";
import { and, desc, eq, isNotNull, isNull, ne, or, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { mcpConnector, mcpOAuthSession } from "@/lib/db/schema";
import type { McpConnector, McpOAuthSession } from "@/lib/db/schema";
import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("mcp-queries");

// Full client information includes both metadata and registration response
export type OAuthClientInformationFull = OAuthClientMetadata &
  OAuthClientInformation;

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
// MCP Connector queries

export const getMcpConnectorsByUserId = async ({
  userId,
}: {
  userId: string;
}): Promise<McpConnector[]> => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const getMcpConnectorById = async ({
  id,
}: {
  id: string;
}): Promise<McpConnector | undefined> => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const getMcpConnectorByNameId = async ({
  userId,
  nameId,
  excludeId,
}: {
  userId: string | null;
  nameId: string;
  excludeId?: string;
}): Promise<McpConnector | undefined> => {
  try {
    const conditions = [
      eq(mcpConnector.nameId, nameId),
      userId === null
        ? isNull(mcpConnector.userId)
        : eq(mcpConnector.userId, userId),
    ];

    const whereClause =
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const createMcpConnector = async ({
  userId,
  name,
  nameId,
  url,
  type,
  oauthClientId,
  oauthClientSecret,
}: {
  userId: string | null;
  name: string;
  nameId: string;
  url: string;
  type: "http" | "sse";
  oauthClientId?: string;
  oauthClientSecret?: string;
}): Promise<McpConnector> => {
  try {
    const [connector] = await db
      .insert(mcpConnector)
      .values({
        name,
        nameId,
        oauthClientId: oauthClientId ?? null,
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const updateMcpConnector = async ({
  id,
  updates,
}: {
  id: string;
  updates: Partial<{
    name: string;
    nameId: string;
    url: string;
    type: "http" | "sse";
    oauthClientId: string | null;
    oauthClientSecret: string | null;
    enabled: boolean;
  }>;
}): Promise<void> => {
  try {
    await db
      .update(mcpConnector)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(mcpConnector.id, id));
  } catch (error) {
    log.error({ err: error }, "Failed to update MCP connector in database");
    throw error;
  }
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const deleteMcpConnector = async ({
  id,
}: {
  id: string;
}): Promise<void> => {
  try {
    await db.delete(mcpConnector).where(eq(mcpConnector.id, id));
  } catch (error) {
    log.error({ err: error }, "Failed to delete MCP connector from database");
    throw error;
  }
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
// MCP OAuth Session queries

export const getAuthenticatedSession = async ({
  mcpConnectorId,
}: {
  mcpConnectorId: string;
}): Promise<McpOAuthSession | undefined> => {
  const [session] = await db
    .select()
    .from(mcpOAuthSession)
    .where(
      and(
        eq(mcpOAuthSession.mcpConnectorId, mcpConnectorId),
        isNotNull(mcpOAuthSession.tokens)
      )
    )
    .orderBy(desc(mcpOAuthSession.updatedAt))
    .limit(1);
  return session;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const getSessionByState = async ({
  state,
}: {
  state: string;
}): Promise<McpOAuthSession | undefined> => {
  if (!state) {
    return;
  }
  const [session] = await db
    .select()
    .from(mcpOAuthSession)
    .where(eq(mcpOAuthSession.state, state));
  // oxlint-disable-next-line typescript/consistent-return -- This lookup or optional operation intentionally returns no value when the target is absent; callers already handle the value-or-undefined contract.
  return session;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const createOAuthSession = async ({
  mcpConnectorId,
  serverUrl,
  state,
  codeVerifier,
  clientInfo,
}: {
  mcpConnectorId: string;
  serverUrl: string;
  state: string;
  codeVerifier?: string;
  clientInfo?: OAuthClientInformationFull;
}): Promise<McpOAuthSession> => {
  // Preserve active authorization attempts while pruning abandoned expired attempts.
  try {
    await db
      .delete(mcpOAuthSession)
      .where(
        and(
          eq(mcpOAuthSession.mcpConnectorId, mcpConnectorId),
          isNull(mcpOAuthSession.tokens),
          sql`${mcpOAuthSession.createdAt} < now() - interval '1 hour'`
        )
      );
  } catch (error) {
    log.warn(
      { err: error, mcpConnectorId },
      "Could not clean up expired OAuth sessions"
    );
  }
  const [session] = await db
    .insert(mcpOAuthSession)
    .values({
      clientInfo,
      codeVerifier,
      mcpConnectorId,
      serverUrl,
      state,
    })
    .returning();
  return session;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
export const setOAuthCodeVerifierOnceByState = async ({
  state,
  codeVerifier,
}: {
  state: string;
  codeVerifier: string;
}): Promise<McpOAuthSession> => {
  const [updated] = await db
    .update(mcpOAuthSession)
    .set({ codeVerifier })
    .where(
      and(
        eq(mcpOAuthSession.state, state),
        isNull(mcpOAuthSession.codeVerifier)
      )
    )
    .returning();

  if (updated) {
    return updated;
  }

  const [existingSession] = await db
    .select()
    .from(mcpOAuthSession)
    .where(eq(mcpOAuthSession.state, state));
  if (!existingSession) {
    throw new Error(`Session with state ${state} not found`);
  }
  return existingSession;
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
export const setOAuthClientInfoOnceByState = async ({
  state,
  clientInfo,
}: {
  state: string;
  clientInfo: OAuthClientInformationFull;
}): Promise<McpOAuthSession> => {
  const [updated] = await db
    .update(mcpOAuthSession)
    .set({ clientInfo })
    .where(
      and(eq(mcpOAuthSession.state, state), isNull(mcpOAuthSession.clientInfo))
    )
    .returning();

  if (updated) {
    return updated;
  }

  const [existingSession] = await db
    .select()
    .from(mcpOAuthSession)
    .where(eq(mcpOAuthSession.state, state));
  if (!existingSession) {
    throw new Error(`Session with state ${state} not found`);
  }
  return existingSession;
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
export const updateSessionByState = async ({
  state,
  updates,
}: {
  state: string;
  updates: {
    tokens?: OAuthTokens | null;
    clientInfo?: OAuthClientInformationFull | null;
    codeVerifier?: string | null;
  };
}): Promise<McpOAuthSession> => {
  // Filter out undefined values - only include explicit values (including null)
  const setValues = Object.fromEntries(
    Object.entries(updates).filter(([, value]): boolean => value !== undefined)
  );

  if (Object.keys(setValues).length === 0) {
    const [existingSession] = await db
      .select()
      .from(mcpOAuthSession)
      .where(eq(mcpOAuthSession.state, state));
    if (!existingSession) {
      throw new Error(`Session with state ${state} not found`);
    }
    return existingSession;
  }

  const [session] = await db
    .update(mcpOAuthSession)
    .set(setValues)
    .where(eq(mcpOAuthSession.state, state))
    .returning();
  if (!session) {
    throw new Error(`Session with state ${state} not found`);
  }
  return session;
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
export const saveTokensAndCleanup = async ({
  state,
  mcpConnectorId,
  tokens,
}: {
  state: string;
  mcpConnectorId: string;
  tokens: OAuthTokens;
}): Promise<McpOAuthSession> => {
  const [session] = await db
    .update(mcpOAuthSession)
    .set({ tokens })
    .where(eq(mcpOAuthSession.state, state))
    .returning();

  if (!session) {
    throw new Error(`Session with state ${state} not found`);
  }

  try {
    await db
      .delete(mcpOAuthSession)
      .where(
        and(
          eq(mcpOAuthSession.mcpConnectorId, mcpConnectorId),
          isNull(mcpOAuthSession.tokens),
          sql`${mcpOAuthSession.createdAt} < now() - interval '1 hour'`,
          ne(mcpOAuthSession.state, state)
        )
      );
  } catch (error) {
    log.warn(
      { err: error, mcpConnectorId },
      "Could not clean up expired OAuth sessions"
    );
  }

  return session;
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable jsdoc/require-returns -- The comment documents lifecycle behavior; the TypeScript return contract remains the authoritative result description. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/** Remove only an unfinished OAuth attempt, atomically preserving any token winner. */
export const deletePendingSessionByState = async ({
  state,
}: {
  state: string;
}) => {
  const [session] = await db
    .delete(mcpOAuthSession)
    .where(
      and(eq(mcpOAuthSession.state, state), isNull(mcpOAuthSession.tokens))
    )
    .returning();
  return session;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable jsdoc/require-returns */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const deleteSessionByState = async ({
  state,
}: {
  state: string;
}): Promise<void> => {
  await db.delete(mcpOAuthSession).where(eq(mcpOAuthSession.state, state));
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const deleteSessionsByConnectorId = async ({
  mcpConnectorId,
}: {
  mcpConnectorId: string;
}): Promise<void> => {
  await db
    .delete(mcpOAuthSession)
    .where(eq(mcpOAuthSession.mcpConnectorId, mcpConnectorId));
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable import/group-exports */

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
