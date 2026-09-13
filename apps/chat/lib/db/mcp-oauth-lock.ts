import postgres from "postgres";

import { env } from "../env";
import { databaseConnection } from "./connection";

const OAUTH_REFRESH_LOCK_TIMEOUT = "15s";

/** Serialize one connector's rotating-token refresh without occupying the app pool. */
export const withMcpOAuthRefreshLock = async <T>(
  connectorId: string,
  run: () => Promise<T>
): Promise<T> => {
  const connectionConfig = databaseConnection(env);
  const connection = postgres(connectionConfig.url, {
    ...connectionConfig.options,
    max: 1,
    prepare: false,
  });
  try {
    const result = await connection.begin(async (transaction) => {
      await transaction`select set_config('lock_timeout', ${OAUTH_REFRESH_LOCK_TIMEOUT}, true)`;
      await transaction`select pg_advisory_xact_lock(hashtextextended(${`mcp-oauth-refresh:${connectorId}`}, 0))`;
      return { value: await run() };
    });
    return result.value;
  } finally {
    await connection.end();
  }
};
