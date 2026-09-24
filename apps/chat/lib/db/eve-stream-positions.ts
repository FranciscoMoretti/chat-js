import postgres from "postgres";
import type { Sql } from "postgres";
import { z } from "zod";

const positionRows = z.array(
  z.object({
    length: z.coerce.number().int().nonnegative(),
    streamId: z.string(),
  })
);

/**
 * Metadata-only adapter for Eve 0.61.0 and world-postgres 5.0.0-beta.40.
 * Uses the same default stream name and non-EOF chunk count as getReadable /
 * streams.getInfo. Callers must supply only owner-authorized sessions.
 * Missing streams are omitted, never certified as empty or settled.
 */
export const readEvePostgresStreamPositions = async (
  connection: Sql,
  sessionIds: string[]
) => {
  const sessionsByStream = new Map(
    sessionIds.map((id) => [`${id.replace("wrun_", "strm_")}_user`, id])
  );
  const positions = new Map<string, number>();
  const names = [...sessionsByStream.keys()];
  for (let offset = 0; offset < names.length; offset += 500) {
    const batch = names.slice(offset, offset + 500);
    // oxlint-disable-next-line eslint/no-await-in-loop -- Advance durable evidence in order without skipping unresolved work.
    const rows = positionRows.parse(
      // oxlint-disable-next-line eslint/no-await-in-loop -- Keep ordered reads and bounded cleanup sequential.
      await connection`
      select stream_id as "streamId",
        count(*) filter (where eof = false) as length
      from workflow.workflow_stream_chunks
      where stream_id in ${connection(batch)}
      group by stream_id
    `
    );
    for (const row of rows) {
      const sessionId = sessionsByStream.get(row.streamId);
      if (sessionId) {
        positions.set(sessionId, row.length);
      }
    }
  }
  return positions;
};

export const getEvePostgresStreamPositions = async (
  databaseUrl: string,
  sessionIds: string[]
) => {
  if (sessionIds.length === 0) {
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
