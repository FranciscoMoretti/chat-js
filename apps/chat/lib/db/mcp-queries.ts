"use server";

import type {
  OAuthClientInformation,
  OAuthClientMetadata,
  OAuthTokens,
} from "@ai-sdk/mcp";
import { and, desc, eq, isNotNull, isNull, ne, or, sql } from "drizzle-orm";

import { db } from "./client";
import {
  type McpConnector,
  type McpOAuthSession,
  mcpConnector,
  mcpOAuthSession,
} from "./schema";

// Full client information includes both metadata and registration response
export type OAuthClientInformationFull = OAuthClientMetadata &
  OAuthClientInformation;

// MCP Connector queries

export async function getMcpConnectorsByUserId({
  userId,
}: {
  userId: string;
}): Promise<McpConnector[]> {
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
}

export async function getMcpConnectorById({
  id,
}: {
  id: string;
}): Promise<McpConnector | undefined> {
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
}

export async function getMcpConnectorByNameId({
  userId,
  nameId,
  excludeId,
}: {
  userId: string | null;
  nameId: string;
  excludeId?: string;
}): Promise<McpConnector | undefined> {
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
}

export async function createMcpConnector({
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
}): Promise<McpConnector> {
  try {
    const [connector] = await db
      .insert(mcpConnector)
      .values({
        userId,
        name,
        nameId,
        url,
        type,
        oauthClientId: oauthClientId ?? null,
        oauthClientSecret: oauthClientSecret ?? null,
      })
      .returning();
    return connector;
  } catch (error) {
    console.error("Failed to create MCP connector in database", error);
    throw error;
  }
}

export async function updateMcpConnector({
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
}): Promise<void> {
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
}

export async function deleteMcpConnector({
  id,
}: {
  id: string;
}): Promise<void> {
  try {
    await db.delete(mcpConnector).where(eq(mcpConnector.id, id));
  } catch (error) {
    console.error("Failed to delete MCP connector from database", error);
    throw error;
  }
}

// MCP OAuth Session queries

export async function getAuthenticatedSession({
  mcpConnectorId,
}: {
  mcpConnectorId: string;
}): Promise<McpOAuthSession | undefined> {
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
}

export async function getSessionByState({
  state,
}: {
  state: string;
}): Promise<McpOAuthSession | undefined> {
  if (!state) {
    return;
  }
  const [session] = await db
    .select()
    .from(mcpOAuthSession)
    .where(eq(mcpOAuthSession.state, state));
  return session;
}

export async function createOAuthSession({
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
}): Promise<McpOAuthSession> {
  const [session] = await db
    .insert(mcpOAuthSession)
    .values({
      mcpConnectorId,
      serverUrl,
      state,
      codeVerifier,
      clientInfo,
    })
    .returning();
  return session;
}

export async function setOAuthCodeVerifierOnceByState({
  state,
  codeVerifier,
}: {
  state: string;
  codeVerifier: string;
}): Promise<McpOAuthSession> {
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
}

export async function setOAuthClientInfoOnceByState({
  state,
  clientInfo,
}: {
  state: string;
  clientInfo: OAuthClientInformationFull;
}): Promise<McpOAuthSession> {
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
}

export async function updateSessionByState({
  state,
  updates,
}: {
  state: string;
  updates: {
    tokens?: OAuthTokens | null;
    clientInfo?: OAuthClientInformationFull | null;
    codeVerifier?: string | null;
  };
}): Promise<McpOAuthSession> {
  // Filter out undefined values - only include explicit values (including null)
  const setValues = Object.fromEntries(
    Object.entries(updates).filter(([_, v]) => v !== undefined)
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
}

export async function saveTokensAndCleanup({
  state,
  mcpConnectorId,
  tokens,
}: {
  state: string;
  mcpConnectorId: string;
  tokens: OAuthTokens;
}): Promise<McpOAuthSession> {
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
}

export async function deleteSessionByState({
  state,
}: {
  state: string;
}): Promise<void> {
  await db.delete(mcpOAuthSession).where(eq(mcpOAuthSession.state, state));
}

export async function deleteSessionsByConnectorId({
  mcpConnectorId,
}: {
  mcpConnectorId: string;
}): Promise<void> {
  await db
    .delete(mcpOAuthSession)
    .where(eq(mcpOAuthSession.mcpConnectorId, mcpConnectorId));
}
