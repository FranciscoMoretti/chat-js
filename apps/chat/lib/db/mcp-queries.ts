"use server";

import type {
  OAuthClientInformation,
  OAuthClientMetadata,
  OAuthTokens,
} from "@ai-sdk/mcp";
import { and, desc, eq, isNotNull, isNull, ne, or, sql } from "drizzle-orm";

import { db } from "./client";
import { mcpConnector, mcpOAuthSession } from "./schema";
import type { McpConnector, McpOAuthSession } from "./schema";

// Full client information includes both metadata and registration response
export type OAuthClientInformationFull = OAuthClientMetadata &
  OAuthClientInformation;

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
    console.error("Failed to get MCP connectors from database", error);
    throw error;
  }
};

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
    console.error("Failed to get MCP connector by id from database", error);
    throw error;
  }
};

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

    const whereClause = excludeId
      ? and(...conditions, sql`${mcpConnector.id} != ${excludeId}::uuid`)
      : and(...conditions);

    const [connector] = await db.select().from(mcpConnector).where(whereClause);
    return connector;
  } catch (error) {
    console.error("Failed to get MCP connector by nameId from database", error);
    throw error;
  }
};

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
    console.error("Failed to create MCP connector in database", error);
    throw error;
  }
};

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
    console.error("Failed to update MCP connector in database", error);
    throw error;
  }
};

export const deleteMcpConnector = async ({
  id,
}: {
  id: string;
}): Promise<void> => {
  try {
    await db.delete(mcpConnector).where(eq(mcpConnector.id, id));
  } catch (error) {
    console.error("Failed to delete MCP connector from database", error);
    throw error;
  }
};

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
  return session;
};

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
    Object.entries(updates).filter(([, value]) => value !== undefined)
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

  await db
    .delete(mcpOAuthSession)
    .where(
      and(
        eq(mcpOAuthSession.mcpConnectorId, mcpConnectorId),
        isNull(mcpOAuthSession.tokens),
        ne(mcpOAuthSession.state, state)
      )
    );

  return session;
};

export const deleteSessionByState = async ({
  state,
}: {
  state: string;
}): Promise<void> => {
  await db.delete(mcpOAuthSession).where(eq(mcpOAuthSession.state, state));
};

export const deleteSessionsByConnectorId = async ({
  mcpConnectorId,
}: {
  mcpConnectorId: string;
}): Promise<void> => {
  await db
    .delete(mcpOAuthSession)
    .where(eq(mcpOAuthSession.mcpConnectorId, mcpConnectorId));
};
