import postgres, { type Sql } from "postgres";
import { z } from "zod";

import { purgeEvePostgresSessionPayloads } from "./eve-payload-purge";
import { purgeEvePostgresQueue } from "./eve-queue-purge";
import { fenceEvePostgresSession } from "./eve-session-fence";

/** Internal provider stage. Caller authorizes a deleting binding; retirement must settle usage. */
export async function purgeEveNativeSession(
  databaseUrl: string,
  scope: { sessionId: string; taskIdentifier: string },
  retire: () => Promise<void>
) {
  return await withNativeSession(
    databaseUrl,
    scope.sessionId,
    retire,
    async (connection) => {
      await prepareNativeSession(connection, scope);
      return await purgeEvePostgresSessionPayloads(connection, scope);
    }
  );
}

/** Fence native work and clear its queued deliveries while retaining transcript payloads for resource inventory. */
export async function prepareEveNativeSessionPurge(
  databaseUrl: string,
  scope: { sessionId: string; taskIdentifier: string },
  retire: () => Promise<void>
) {
  return await withNativeSession(
    databaseUrl,
    scope.sessionId,
    retire,
    (connection) => prepareNativeSession(connection, scope)
  );
}

async function withNativeSession<T>(
  databaseUrl: string,
  sessionId: string,
  retire: () => Promise<void>,
  afterRetirement: (connection: Sql) => Promise<T>
) {
  // Own the pool so concurrent cleanups cannot reserve all shared connections
  // while waiting for another connection to execute their stage transactions.
  const connection = postgres(databaseUrl, { max: 2 });
  try {
    return await withRetiredNativeSession(connection, sessionId, retire, () =>
      afterRetirement(connection)
    );
  } finally {
    await connection.end();
  }
}

/** Retire and settle every authorized member without erasing any native payloads. */
export async function retireEveNativeSessions(
  databaseUrl: string,
  sessionIds: string[],
  retire: (sessionId: string) => Promise<void>
) {
  const connection = postgres(databaseUrl, { max: 2 });
  try {
    for (const sessionId of new Set(sessionIds)) {
      await withRetiredNativeSession(
        connection,
        sessionId,
        () => retire(sessionId),
        () => Promise.resolve()
      );
    }
  } finally {
    await connection.end();
  }
}

async function prepareNativeSession(
  connection: Sql,
  scope: { sessionId: string; taskIdentifier: string }
) {
  const [purged] =
    await connection`select run_ids as "runIds", stream_ids as "streamIds" from workflow.eve_payload_purges where session_id = ${scope.sessionId} and task_identifier = ${scope.taskIdentifier}`;
  if (purged) {
    return z
      .object({ runIds: z.array(z.string()), streamIds: z.array(z.string()) })
      .parse(purged);
  }
  let resources = await fenceEvePostgresSession(connection, scope.sessionId);
  for (let pass = 0; ; pass++) {
    if (pass === 100) {
      throw new Error("Native cleanup inventory did not stabilize.");
    }
    const queued = await purgeEvePostgresQueue(connection, {
      ...scope,
      runIds: resources.runIds,
    });
    // Queued envelopes can be the only association to a detached run.
    // Include its streams and descendants before erasing its last payloads.
    resources = await fenceEvePostgresSession(
      connection,
      scope.sessionId,
      queued.runIds
    );
    if (resources.runIds.every((id) => queued.runIds.includes(id))) {
      return { runIds: queued.runIds, streamIds: resources.streamIds };
    }
  }
}

async function withRetiredNativeSession<T>(
  connection: Sql,
  sessionId: string,
  retire: () => Promise<void>,
  afterRetirement: () => Promise<T>
) {
  // One connection holds the session lock across stage commits; a second runs
  // transactions. postgres reserves expose no begin() at runtime.
  const query = await connection.reserve();
  const lock = `eve-native-purge:${sessionId}`;
  try {
    await query`select pg_advisory_lock(hashtextextended(${lock}, 0))`;
    const [retired] =
      await query`select session_id from workflow.eve_session_retirements where session_id = ${sessionId}`;
    if (!retired) {
      await retire();
      // A crash before this commit retries idempotent retirement. After it, never
      // reset again: the next stage may already have fenced native writes.
      await query`insert into workflow.eve_session_retirements(session_id) values (${sessionId})`;
    }
    return await afterRetirement();
  } finally {
    try {
      await query`select pg_advisory_unlock(hashtextextended(${lock}, 0))`;
    } finally {
      query.release();
    }
  }
}
