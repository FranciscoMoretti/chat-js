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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve withRetiredNativeSession's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable id-length, max-params, max-statements, typescript/strict-boolean-expressions -- * id-length (#506): withRetiredNativeSession uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * max-params (#511): withRetiredNativeSession keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): withRetiredNativeSession keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/strict-boolean-expressions (#610): withRetiredNativeSession intentionally keeps the existing falsy-value behavior of retired; distinguishing empty, zero, and absent states requires a domain behavior decision. */
const withRetiredNativeSession = async <T>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Reserve the native connection for the session advisory lock and retirement receipt; the reserved connection is released after the shared database writes.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve withNativeSession's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable id-length, max-params, max-statements, typescript/strict-boolean-expressions */

/* oxlint-disable id-length, max-params, typescript/promise-function-async -- * id-length (#506): withNativeSession uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * max-params (#511): withNativeSession keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/promise-function-async (#606): withNativeSession preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections. */
const withNativeSession = async <T>(
  databaseUrl: string,
  sessionId: string,
  retire: () => Promise<void>,
  afterRetirement: (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the original pool to the native retirement, fencing and purge writers; their connection reservation and transaction lifecycle require the Postgres Sql contract.
    connection: Sql
  ) => Promise<T>
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve prepareNativeSession's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable id-length, max-params, typescript/promise-function-async */

/* oxlint-disable max-statements, typescript/strict-boolean-expressions -- * max-statements (#512): prepareNativeSession keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/strict-boolean-expressions (#610): prepareNativeSession intentionally keeps the existing falsy-value behavior of purged; distinguishing empty, zero, and absent states requires a domain behavior decision. */
const prepareNativeSession = async (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the original pool to the native retirement, fencing and purge writers; their connection reservation and transaction lifecycle require the Postgres Sql contract.
  connection: Sql,
  scope: {
    readonly sessionId: string;
    readonly taskIdentifier: string;
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
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing scope own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve purgeEveNativeSession's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, typescript/strict-boolean-expressions */

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
  await withNativeSession(
    databaseUrl,
    scope.sessionId,
    retire,
    async (
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the original pool to the native retirement, fencing and purge writers; their connection reservation and transaction lifecycle require the Postgres Sql contract.
      connection
    ) => {
      await prepareNativeSession(connection, scope);
      return await purgeEvePostgresSessionPayloads(connection, scope);
    }
  );
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve prepareEveNativeSessionPurge's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable typescript/promise-function-async -- typescript/promise-function-async (#606): prepareEveNativeSessionPurge preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections. */
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
  await withNativeSession(
    databaseUrl,
    scope.sessionId,
    retire,
    (
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the original pool to the native retirement, fencing and purge writers; their connection reservation and transaction lifecycle require the Postgres Sql contract.
      connection
    ) => prepareNativeSession(connection, scope)
  );
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve retireEveNativeSessions's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/promise-function-async */

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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (prepareEveNativeSessionPurge, purgeEveNativeSession, retireEveNativeSessions); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/promise-function-async */
export {
  prepareEveNativeSessionPurge,
  purgeEveNativeSession,
  retireEveNativeSessions,
};
/* oxlint-enable import/no-named-export */
