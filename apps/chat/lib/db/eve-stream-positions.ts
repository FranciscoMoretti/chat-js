import postgres, { type Sql } from "postgres";
import { z } from "zod";

const positionRows = z.array(
  z.object({
    streamId: z.string(),
    length: z.coerce.number().int().nonnegative(),
  })
);

/**
 * Metadata-only adapter for Eve 0.52.2 and world-postgres 5.0.0-beta.40.
 * Uses the same default stream name and non-EOF chunk count as getReadable /
 * streams.getInfo. Callers must supply only owner-authorized sessions.
 * Missing streams are omitted, never certified as empty or settled.
 */
export async function readEvePostgresStreamPositions(
  connection: Sql,
  sessionIds: string[]
) {
  const sessionsByStream = new Map(
    sessionIds.map((id) => [`${id.replace("wrun_", "strm_")}_user`, id])
  );
  const positions = new Map<string, number>();
  const names = [...sessionsByStream.keys()];
  for (let offset = 0; offset < names.length; offset += 500) {
    const batch = names.slice(offset, offset + 500);
    const rows = positionRows.parse(
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
}

export async function getEvePostgresStreamPositions(
  databaseUrl: string,
  sessionIds: string[]
) {
  if (sessionIds.length === 0) {
    return new Map<string, number>();
  }
  const connection = postgres(databaseUrl, {
    max: 1,
    connect_timeout: 5,
    connection: { statement_timeout: 5000 },
  });
  try {
    return await readEvePostgresStreamPositions(connection, sessionIds);
  } finally {
    await connection.end();
  }
}
