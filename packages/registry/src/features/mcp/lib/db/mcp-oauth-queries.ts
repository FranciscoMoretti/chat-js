import type {
  OAuthClientInformation,
  OAuthClientMetadata,
  OAuthTokens,
} from "@ai-sdk/mcp";
import { and, desc, eq, isNotNull, isNull, ne, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { mcpOAuthSession } from "@/lib/db/schema";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { McpOAuthSession } from "@/lib/db/schema";
/* oxlint-enable sort-imports */
import { createModuleLogger } from "@/lib/logger";

const AUTHENTICATED_SESSION_LIMIT = 1;
const EMPTY_UPDATE_COUNT = 0;
const FIRST_QUERY_ROW_INDEX = 0;
// oxlint-disable-next-line eslint/no-undefined -- Drizzle update bindings omit an undefined column update while retaining explicit null clearing.
const OMITTED_COLUMN_UPDATE = undefined;

const log = createModuleLogger("mcp-queries");

// Full client information includes both metadata and registration response
type OAuthClientInformationFull = OAuthClientMetadata & OAuthClientInformation;
type ReadonlyMetadataValue<Value> = Value extends readonly unknown[]
  ? Readonly<Value>
  : Value;
type ReadonlyClientInformation = {
  readonly [
    Property in keyof Omit<OAuthClientInformationFull, "jwks">
  ]: ReadonlyMetadataValue<OAuthClientInformationFull[Property]>;
} & { readonly jwks?: unknown };

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getAuthenticatedSession's awaited sequencing and rejected-Promise behavior. */
// MCP OAuth Session queries

const getAuthenticatedSession = async ({
  mcpConnectorId,
}: Readonly<{
  mcpConnectorId: string;
}>): Promise<McpOAuthSession | undefined> => {
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
    .limit(AUTHENTICATED_SESSION_LIMIT);
  return session;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getSessionByState's awaited sequencing and rejected-Promise behavior. */
const getSessionByState = async ({
  state,
}: Readonly<{ state: string }>): Promise<McpOAuthSession | undefined> => {
  const rows =
    // oxlint-disable-next-line no-ternary -- Keep rows as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    state === ""
      ? []
      : await db
          .select()
          .from(mcpOAuthSession)
          .where(eq(mcpOAuthSession.state, state));
  return rows.at(FIRST_QUERY_ROW_INDEX);
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve createOAuthSession's awaited sequencing and rejected-Promise behavior. */
const createOAuthSession = async ({
  mcpConnectorId,
  serverUrl,
  state,
  codeVerifier,
  clientInfo,
}: Readonly<{
  mcpConnectorId: string;
  serverUrl: string;
  state: string;
  codeVerifier?: string;
  clientInfo?: ReadonlyClientInformation;
}>): Promise<McpOAuthSession> => {
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve requireSessionByState's awaited sequencing and rejected-Promise behavior. */
const requireSessionByState = async (
  state: string
): Promise<McpOAuthSession> => {
  const rows = await db
    .select()
    .from(mcpOAuthSession)
    .where(eq(mcpOAuthSession.state, state));
  const session = rows.at(FIRST_QUERY_ROW_INDEX);
  if (!session) {
    throw new Error(`Session with state ${state} not found`);
  }
  return session;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve setOAuthCodeVerifierOnceByState's awaited sequencing and rejected-Promise behavior. */
const setOAuthCodeVerifierOnceByState = async ({
  state,
  codeVerifier,
}: Readonly<{
  state: string;
  codeVerifier: string;
}>): Promise<McpOAuthSession> => {
  const updatedRows = await db
    .update(mcpOAuthSession)
    .set({ codeVerifier })
    .where(
      and(
        eq(mcpOAuthSession.state, state),
        isNull(mcpOAuthSession.codeVerifier)
      )
    )
    .returning();
  const updated = updatedRows.at(FIRST_QUERY_ROW_INDEX);

  if (updated) {
    return updated;
  }

  return await requireSessionByState(state);
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve setOAuthClientInfoOnceByState's awaited sequencing and rejected-Promise behavior. */
const setOAuthClientInfoOnceByState = async ({
  state,
  clientInfo,
}: Readonly<{
  state: string;
  clientInfo: ReadonlyClientInformation;
}>): Promise<McpOAuthSession> => {
  const updatedRows = await db
    .update(mcpOAuthSession)
    .set({ clientInfo })
    .where(
      and(eq(mcpOAuthSession.state, state), isNull(mcpOAuthSession.clientInfo))
    )
    .returning();
  const updated = updatedRows.at(FIRST_QUERY_ROW_INDEX);

  if (updated) {
    return updated;
  }

  return await requireSessionByState(state);
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve updateSessionByState's awaited sequencing and rejected-Promise behavior. */
const updateSessionByState = async ({
  state,
  updates,
}: Readonly<{
  state: string;
  updates: Readonly<{
    tokens?: Readonly<OAuthTokens> | null;
    clientInfo?: ReadonlyClientInformation | null;
    codeVerifier?: string | null;
  }>;
}>): Promise<McpOAuthSession> => {
  // Filter out undefined values - only include explicit values (including null)
  const setValues = Object.fromEntries(
    Object.entries(updates).filter(
      ([, value]: readonly [unknown, unknown]): boolean =>
        value !== OMITTED_COLUMN_UPDATE
    )
  );

  if (Object.keys(setValues).length === EMPTY_UPDATE_COUNT) {
    return await requireSessionByState(state);
  }

  const sessionRows = await db
    .update(mcpOAuthSession)
    .set(setValues)
    .where(eq(mcpOAuthSession.state, state))
    .returning();
  const session = sessionRows.at(FIRST_QUERY_ROW_INDEX);
  if (!session) {
    throw new Error(`Session with state ${state} not found`);
  }
  return session;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve saveTokensAndCleanup's awaited sequencing and rejected-Promise behavior. */
const saveTokensAndCleanup = async ({
  state,
  mcpConnectorId,
  tokens,
}: Readonly<{
  state: string;
  mcpConnectorId: string;
  tokens: Readonly<OAuthTokens>;
}>): Promise<McpOAuthSession> => {
  const sessionRows = await db
    .update(mcpOAuthSession)
    .set({ tokens })
    .where(eq(mcpOAuthSession.state, state))
    .returning();
  const session = sessionRows.at(FIRST_QUERY_ROW_INDEX);

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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve deletePendingSessionByState's awaited sequencing and rejected-Promise behavior. */
/** Remove only an unfinished OAuth attempt, atomically preserving any token winner.
 * @param {Readonly<{ state: string }>} options - State identifying the unfinished authorization attempt.
 * @returns {Promise<McpOAuthSession | undefined>} The removed row when no token winner was present.
 */
const deletePendingSessionByState = async (
  options: Readonly<{ state: string }>
): Promise<McpOAuthSession | undefined> => {
  const { state } = options;
  const [session] = await db
    .delete(mcpOAuthSession)
    .where(
      and(eq(mcpOAuthSession.state, state), isNull(mcpOAuthSession.tokens))
    )
    .returning();
  return session;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve deleteSessionByState's awaited sequencing and rejected-Promise behavior. */
const deleteSessionByState = async ({
  state,
}: Readonly<{
  state: string;
}>): Promise<void> => {
  await db.delete(mcpOAuthSession).where(eq(mcpOAuthSession.state, state));
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve deleteSessionsByConnectorId's awaited sequencing and rejected-Promise behavior. */
const deleteSessionsByConnectorId = async ({
  mcpConnectorId,
}: Readonly<{
  mcpConnectorId: string;
}>): Promise<void> => {
  await db
    .delete(mcpOAuthSession)
    .where(eq(mcpOAuthSession.mcpConnectorId, mcpConnectorId));
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (createOAuthSession, deletePendingSessionByState, deleteSessionByState, deleteSessionsByConnectorId, getAuthenticatedSession, getSessionByState, saveTokensAndCleanup, setOAuthClientInfoOnceByState, setOAuthCodeVerifierOnceByState, updateSessionByState); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable oxc/no-async-await */
export {
  createOAuthSession,
  deletePendingSessionByState,
  deleteSessionByState,
  deleteSessionsByConnectorId,
  getAuthenticatedSession,
  getSessionByState,
  saveTokensAndCleanup,
  setOAuthClientInfoOnceByState,
  setOAuthCodeVerifierOnceByState,
  updateSessionByState,
};
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (OAuthClientInformationFull); the enabled import/no-default-export convention rejects the default-export alternative. */
export type { OAuthClientInformationFull };
/* oxlint-enable import/no-named-export */
