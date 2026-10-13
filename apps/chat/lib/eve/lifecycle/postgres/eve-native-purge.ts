import type { PostgresLifecycleQuery } from "./compatibility";
import type { Sql } from "postgres";
import { fenceEvePostgresSession } from "./eve-session-fence";
import postgres from "postgres";
import { purgeEvePostgresQueue } from "./eve-queue-purge";
import { purgeEvePostgresSessionPayloads } from "./eve-payload-purge";
import { z } from "zod";

const FIRST_INVENTORY_PASS = 0;
const NEXT_INVENTORY_PASS = 1;
const MAX_INVENTORY_PASSES = 100;

interface NativePurgeInventory {
  runIds: string[];
  streamIds: string[];
}

const retireNativeSessionOnce = async (
  query: PostgresLifecycleQuery,
  sessionId: string,
  retire: () => Promise<void>
): Promise<void> => {
  const retirementRows: readonly (object | undefined)[] =
    await query`select session_id from workflow.eve_session_retirements where session_id = ${sessionId}`;
  const [retired] = retirementRows;
  if (!retired) {
    await retire();
    // A crash before this commit retries idempotent retirement. After it, never
    // reset again: the next stage may already have fenced native writes.
    await query`insert into workflow.eve_session_retirements(session_id) values (${sessionId})`;
  }
};

const withRetiredNativeSession = async <Result>(
  connection: Readonly<Pick<Sql, "reserve">>,
  sessionId: string,
  stages: {
    readonly retire: () => Promise<void>;
    readonly afterRetirement: () => Result | Promise<Result>;
  }
): Promise<Result> => {
  // One connection holds the session lock across stage commits; a second runs
  // transactions. postgres reserves expose no begin() at runtime.
  const query = await connection.reserve();
  const lock = `eve-native-purge:${sessionId}`;
  try {
    await query`select pg_advisory_lock(hashtextextended(${lock}, 0))`;
    await retireNativeSessionOnce(query, sessionId, stages.retire);
    return await stages.afterRetirement();
  } finally {
    try {
      await query`select pg_advisory_unlock(hashtextextended(${lock}, 0))`;
    } finally {
      query.release();
    }
  }
};

const withNativeSession = async <Result>(
  databaseUrl: string,
  sessionId: string,
  stages: {
    readonly retire: () => Promise<void>;
    readonly afterRetirement: (
      connection: PostgresLifecycleQuery & Readonly<Pick<Sql, "begin">>
    ) => Promise<Result>;
  }
): Promise<Result> => {
  // Own the pool so concurrent cleanups cannot reserve all shared connections
  // while waiting for another connection to execute their stage transactions.
  const connection = postgres(databaseUrl, { max: 2 });
  try {
    return await withRetiredNativeSession(connection, sessionId, {
      afterRetirement: async () => await stages.afterRetirement(connection),
      retire: stages.retire,
    });
  } finally {
    await connection.end();
  }
};

// Queued envelopes are inventory seeds; repeat fencing until no detached run remains.
const stabilizeNativeQueueInventory = async (
  connection: Readonly<Pick<Sql, "begin">>,
  scope: { readonly sessionId: string; readonly taskIdentifier: string }
): Promise<NativePurgeInventory> => {
  let resources = await fenceEvePostgresSession(connection, scope.sessionId);
  for (let pass = FIRST_INVENTORY_PASS; ; pass += NEXT_INVENTORY_PASS) {
    if (pass === MAX_INVENTORY_PASSES) {
      throw new Error("Native cleanup inventory did not stabilize.");
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- Purge the currently fenced queue, then fence newly discovered runs before the next inventory pass; retire each session before committing its native retirement marker.
    const queued = await purgeEvePostgresQueue(connection, {
      ...scope,
      runIds: resources.runIds,
    });
    // Queued envelopes can be the only association to a detached run.
    // Include its streams and descendants before erasing its last payloads.
    // oxlint-disable-next-line eslint/no-await-in-loop -- Purge the currently fenced queue, then fence newly discovered runs before the next inventory pass; retire each session before committing its native retirement marker.
    resources = await fenceEvePostgresSession(
      connection,
      scope.sessionId,
      queued.runIds
    );
    if (resources.runIds.every((id) => queued.runIds.includes(id))) {
      return { runIds: queued.runIds, streamIds: resources.streamIds };
    }
  }
};

const prepareNativeSession = async (
  connection: PostgresLifecycleQuery & Readonly<Pick<Sql, "begin">>,
  scope: {
    readonly sessionId: string;
    readonly taskIdentifier: string;
  }
): Promise<NativePurgeInventory> => {
  const purgeRows: readonly (object | undefined)[] =
    await connection`select run_ids as "runIds", stream_ids as "streamIds" from workflow.eve_payload_purges where session_id = ${scope.sessionId} and task_identifier = ${scope.taskIdentifier}`;
  const [purged] = purgeRows;
  if (purged) {
    return z
      .object({ runIds: z.array(z.string()), streamIds: z.array(z.string()) })
      .parse(purged);
  }
  return await stabilizeNativeQueueInventory(connection, scope);
};

/**
 * Internal provider stage. Caller authorizes a deleting binding; retirement must settle usage.
 * @param {string} databaseUrl Native PostgreSQL store whose dedicated pool holds the session lock across stage commits.
 * @param {{ sessionId: string; taskIdentifier: string; }} scope Authorized deleting session and task identifier whose payloads are erased.
 * @param {() => Promise<void>} retire Idempotent retirement callback that settles usage before native write fencing.
 * @returns {ReturnType<typeof purgeEvePostgresSessionPayloads>} The purged run and stream inventory after ordered retirement, fencing and payload removal.
 */
const purgeEveNativeSession = async (
  databaseUrl: string,
  scope: {
    readonly sessionId: string;
    readonly taskIdentifier: string;
  },
  retire: () => Promise<void>
): ReturnType<typeof purgeEvePostgresSessionPayloads> =>
  await withNativeSession(databaseUrl, scope.sessionId, {
    afterRetirement: async (connection) => {
      await prepareNativeSession(connection, scope);
      return await purgeEvePostgresSessionPayloads(connection, scope);
    },
    retire,
  });

/**
 * Fence native work and clear its queued deliveries while retaining transcript payloads for resource inventory.
 * @param {string} databaseUrl Native PostgreSQL store whose dedicated pool holds the session lock across stage commits.
 * @param {{ sessionId: string; taskIdentifier: string; }} scope Authorized deleting session and task identifier whose queue and write fence are prepared.
 * @param {() => Promise<void>} retire Idempotent retirement callback that settles usage before native write fencing.
 * @returns {Promise<NativePurgeInventory>} The stabilized run and stream inventory while transcript payloads remain available for resource cleanup.
 */
const prepareEveNativeSessionPurge = async (
  databaseUrl: string,
  scope: {
    readonly sessionId: string;
    readonly taskIdentifier: string;
  },
  retire: () => Promise<void>
): Promise<NativePurgeInventory> =>
  await withNativeSession(databaseUrl, scope.sessionId, {
    afterRetirement: async (connection) =>
      await prepareNativeSession(connection, scope),
    retire,
  });

/**
 * Retire and settle every authorized member without erasing any native payloads.
 * @param {string} databaseUrl Native PostgreSQL store used for a bounded dedicated retirement pool.
 * @param {readonly string[]} sessionIds Authorized native sessions, retired sequentially once per distinct identity.
 * @param {(sessionId: string) => Promise<void>} retire Idempotent callback that retires and settles one session before its retirement marker commits.
 */
const retireEveNativeSessions = async (
  databaseUrl: string,
  sessionIds: readonly string[],
  retire: (sessionId: string) => Promise<void>
): Promise<void> => {
  const connection = postgres(databaseUrl, { max: 2 });
  try {
    for (const sessionId of new Set(sessionIds)) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Hold one retirement session lock at a time in the dedicated two-connection pool; retirement can reconcile overlapping descendant usage before its durable marker commits.
      await withRetiredNativeSession(connection, sessionId, {
        afterRetirement: () => {
          // Retirement has no following purge stage.
        },
        retire: async () => {
          await retire(sessionId);
        },
      });
    }
  } finally {
    await connection.end();
  }
};
export {
  prepareEveNativeSessionPurge,
  purgeEveNativeSession,
  retireEveNativeSessions,
};
