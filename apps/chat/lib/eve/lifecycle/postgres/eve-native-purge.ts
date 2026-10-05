import type { Sql } from "postgres";
import postgres from "postgres";
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { purgeEvePostgresSessionPayloads } from "./eve-payload-purge";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { purgeEvePostgresQueue } from "./eve-queue-purge";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { fenceEvePostgresSession } from "./eve-session-fence";
/* oxlint-enable sort-imports */

const FIRST_INVENTORY_PASS = 0;
const NEXT_INVENTORY_PASS = 1;
const MAX_INVENTORY_PASSES = 100;

interface NativePurgeInventory {
  runIds: string[];
  streamIds: string[];
}

/* oxlint-disable id-length, max-params, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * id-length (#506): withRetiredNativeSession uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * max-params (#511): withRetiredNativeSession keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): withRetiredNativeSession keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/prefer-readonly-parameter-types (#565): withRetiredNativeSession accepts connection: Sql; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): withRetiredNativeSession intentionally keeps the existing falsy-value behavior of retired; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const withRetiredNativeSession = async <T>(
  connection: Sql,
  sessionId: string,
  retire: () => Promise<void>,
  afterRetirement: () => Promise<T>
): Promise<T> => {
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
};
/* oxlint-enable id-length, max-params, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable id-length, max-params, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * id-length (#506): withNativeSession uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * max-params (#511): withNativeSession keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/prefer-readonly-parameter-types (#565): withNativeSession accepts connection: Sql; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): withNativeSession preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
const withNativeSession = async <T>(
  databaseUrl: string,
  sessionId: string,
  retire: () => Promise<void>,
  afterRetirement: (connection: Sql) => Promise<T>
): Promise<T> => {
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
};
/* oxlint-enable id-length, max-params, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * max-statements (#512): prepareNativeSession keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/prefer-readonly-parameter-types (#565): prepareNativeSession accepts connection: Sql; scope: { sessionId: string; taskIdentifier: string; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): prepareNativeSession intentionally keeps the existing falsy-value behavior of purged; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const prepareNativeSession = async (
  connection: Sql,
  scope: {
    sessionId: string;
    taskIdentifier: string;
  }
): Promise<NativePurgeInventory> => {
  const [purged] =
    await connection`select run_ids as "runIds", stream_ids as "streamIds" from workflow.eve_payload_purges where session_id = ${scope.sessionId} and task_identifier = ${scope.taskIdentifier}`;
  if (purged) {
    return z
      .object({ runIds: z.array(z.string()), streamIds: z.array(z.string()) })
      .parse(purged);
  }
  let resources = await fenceEvePostgresSession(connection, scope.sessionId);
  for (let pass = FIRST_INVENTORY_PASS; ; pass += NEXT_INVENTORY_PASS) {
    if (pass === MAX_INVENTORY_PASSES) {
      throw new Error("Native cleanup inventory did not stabilize.");
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
    const queued = await purgeEvePostgresQueue(connection, {
      ...scope,
      runIds: resources.runIds,
    });
    // Queued envelopes can be the only association to a detached run.
    // Include its streams and descendants before erasing its last payloads.
    // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
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
/* oxlint-enable max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable typescript/prefer-readonly-parameter-types --typescript/prefer-readonly-parameter-types (#565): purgeEveNativeSession accepts scope: { sessionId: string; taskIdentifier: string; }; connection; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
    sessionId: string;
    taskIdentifier: string;
  },
  retire: () => Promise<void>
): ReturnType<typeof purgeEvePostgresSessionPayloads> =>
  await withNativeSession(
    databaseUrl,
    scope.sessionId,
    retire,
    async (connection) => {
      await prepareNativeSession(connection, scope);
      return await purgeEvePostgresSessionPayloads(connection, scope);
    }
  );
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/promise-function-async --typescript/prefer-readonly-parameter-types (#565): prepareEveNativeSessionPurge accepts scope: { sessionId: string; taskIdentifier: string; }; connection; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/promise-function-async (#606): prepareEveNativeSessionPurge preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
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
    sessionId: string;
    taskIdentifier: string;
  },
  retire: () => Promise<void>
): Promise<NativePurgeInventory> =>
  await withNativeSession(databaseUrl, scope.sessionId, retire, (connection) =>
    prepareNativeSession(connection, scope)
  );
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable typescript/promise-function-async --typescript/promise-function-async (#606): retireEveNativeSessions preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
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
      // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
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
};
/* oxlint-enable typescript/promise-function-async */
export {
  prepareEveNativeSessionPurge,
  purgeEveNativeSession,
  retireEveNativeSessions,
};
