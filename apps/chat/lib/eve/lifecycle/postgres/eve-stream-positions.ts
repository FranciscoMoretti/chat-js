import type { PostgresLifecycleQuery } from "./compatibility";
import postgres from "postgres";
import { z } from "zod";

const STREAM_POSITION_BATCH_SIZE = 500;
const EMPTY_SESSION_COUNT = 0;

const positionRows = z.array(
  z.object({
    length: z.coerce.number().int().nonnegative(),
    streamId: z.string(),
  })
);

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readEvePostgresStreamPositions's awaited sequencing and rejected-Promise behavior. */
/**
 * Metadata-only adapter for Eve 0.61.0 and world-postgres 5.0.0-beta.40.
 * Uses the same default stream name and non-EOF chunk count as getReadable /
 * streams.getInfo. Callers must supply only owner-authorized sessions.
 * Missing streams are omitted, never certified as empty or settled.
 * @param {PostgresLifecycleQuery} connection Existing PostgreSQL connection used for bounded metadata reads.
 * @param {readonly string[]} sessionIds Owner-authorized native session identities mapped to their default user streams.
 * @returns {Promise<Map<string, number>>} Positions for existing stream groups, including zero non-EOF chunks; missing streams are omitted.
 */
const readEvePostgresStreamPositions = async (
  connection: PostgresLifecycleQuery,
  sessionIds: readonly string[]
): Promise<Map<string, number>> => {
  const sessionsByStream = new Map(
    sessionIds.map((id) => [`${id.replace("wrun_", "strm_")}_user`, id])
  );
  const positions = new Map<string, number>();
  const names = [...sessionsByStream.keys()];
  for (
    let offset = 0;
    offset < names.length;
    offset += STREAM_POSITION_BATCH_SIZE
  ) {
    const rows = positionRows.parse(
      // oxlint-disable-next-line eslint/no-await-in-loop -- Issue authorized stream-name batches sequentially on the supplied connection; a rejected batch prevents later queries and preserves result insertion order.
      await connection`
      select stream_id as "streamId",
        count(*) filter (where eof = false) as length
      from workflow.workflow_stream_chunks
      where stream_id in ${connection(names.slice(offset, offset + STREAM_POSITION_BATCH_SIZE))}
      group by stream_id
    `
    );
    for (const row of rows) {
      const sessionId = sessionsByStream.get(row.streamId);
      if (typeof sessionId === "string" && sessionId !== "") {
        positions.set(sessionId, row.length);
      }
    }
  }
  return positions;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getEvePostgresStreamPositions's awaited sequencing and rejected-Promise behavior. */

/** Open a short-lived connection for owner-authorized native stream metadata.
 * @param {string} databaseUrl PostgreSQL connection URL for the workflow world.
 * @param {readonly string[]} sessionIds Native sessions whose default user streams are queried.
 * @returns {Promise<Map<string, number>>} Persisted positions for existing streams; closes the connection on success or failure.
 */
const getEvePostgresStreamPositions = async (
  databaseUrl: string,
  sessionIds: readonly string[]
): Promise<Map<string, number>> => {
  if (sessionIds.length === EMPTY_SESSION_COUNT) {
    return new Map<string, number>();
  }
  const connection = postgres(databaseUrl, {
    connect_timeout: 5,
    connection: { statement_timeout: 5000 },
    max: 1,
  });
  try {
    return await readEvePostgresStreamPositions(connection, sessionIds);
  } finally {
    await connection.end();
  }
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (getEvePostgresStreamPositions, readEvePostgresStreamPositions); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
export { getEvePostgresStreamPositions, readEvePostgresStreamPositions };
/* oxlint-enable import/no-named-export */
