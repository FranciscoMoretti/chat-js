import postgres from "postgres";
import type { Sql } from "postgres";
import { z } from "zod";

import { purgeEvePostgresSessionPayloads } from "./eve-payload-purge";
import { purgeEvePostgresQueue } from "./eve-queue-purge";
import { fenceEvePostgresSession } from "./eve-session-fence";

/* oxlint-disable id-length, max-params, max-statements, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions  --
 * id-length (#506): withRetiredNativeSession uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * max-params (#511): withRetiredNativeSession keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): withRetiredNativeSession keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-async-await (#540): withRetiredNativeSession sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep withRetiredNativeSession's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): withRetiredNativeSession accepts connection: Sql; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): withRetiredNativeSession intentionally keeps the existing falsy-value behavior of retired; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const withRetiredNativeSession = async <T>(
  connection: Sql,
  sessionId: string,
  retire: () => Promise<void>,
  afterRetirement: () => Promise<T>
) => {
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
/* oxlint-enable id-length, max-params, max-statements, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable id-length, max-params, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async  --
 * id-length (#506): withNativeSession uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * max-params (#511): withNativeSession keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-async-await (#540): withNativeSession sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep withNativeSession's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): withNativeSession accepts connection: Sql; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): withNativeSession preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
const withNativeSession = async <T>(
  databaseUrl: string,
  sessionId: string,
  retire: () => Promise<void>,
  afterRetirement: (connection: Sql) => Promise<T>
) => {
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
/* oxlint-enable id-length, max-params, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions  --
 * max-statements (#512): prepareNativeSession keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): prepareNativeSession uses 1, 100 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): prepareNativeSession sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): prepareNativeSession copies or separates ...scope while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/explicit-function-return-type (#560): Keep prepareNativeSession's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): prepareNativeSession accepts connection: Sql; scope: { sessionId: string; taskIdentifier: string; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): prepareNativeSession intentionally keeps the existing falsy-value behavior of purged; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const prepareNativeSession = async (
  connection: Sql,
  scope: {
    sessionId: string;
    taskIdentifier: string;
  }
) => {
  const [purged] =
    await connection`select run_ids as "runIds", stream_ids as "streamIds" from workflow.eve_payload_purges where session_id = ${scope.sessionId} and task_identifier = ${scope.taskIdentifier}`;
  if (purged) {
    return z
      .object({ runIds: z.array(z.string()), streamIds: z.array(z.string()) })
      .parse(purged);
  }
  let resources = await fenceEvePostgresSession(connection, scope.sessionId);
  for (let pass = 0; ; pass += 1) {
    if (pass === 100) {
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
/* oxlint-enable max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): purgeEveNativeSession stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named purgeEveNativeSession API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): purgeEveNativeSession's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): purgeEveNativeSession's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * oxc/no-async-await (#540): purgeEveNativeSession sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep purgeEveNativeSession's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep purgeEveNativeSession's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): purgeEveNativeSession accepts scope: { sessionId: string; taskIdentifier: string; }; connection; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Internal provider stage. Caller authorizes a deleting binding; retirement must settle usage. */
export const purgeEveNativeSession = async (
  databaseUrl: string,
  scope: {
    sessionId: string;
    taskIdentifier: string;
  },
  retire: () => Promise<void>
) =>
  await withNativeSession(
    databaseUrl,
    scope.sessionId,
    retire,
    async (connection) => {
      await prepareNativeSession(connection, scope);
      return await purgeEvePostgresSessionPayloads(connection, scope);
    }
  );
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async  --
 * import/group-exports (#523): prepareEveNativeSessionPurge stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named prepareEveNativeSessionPurge API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): prepareEveNativeSessionPurge's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): prepareEveNativeSessionPurge's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * oxc/no-async-await (#540): prepareEveNativeSessionPurge sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep prepareEveNativeSessionPurge's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep prepareEveNativeSessionPurge's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): prepareEveNativeSessionPurge accepts scope: { sessionId: string; taskIdentifier: string; }; connection; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): prepareEveNativeSessionPurge preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
/** Fence native work and clear its queued deliveries while retaining transcript payloads for resource inventory. */
export const prepareEveNativeSessionPurge = async (
  databaseUrl: string,
  scope: {
    sessionId: string;
    taskIdentifier: string;
  },
  retire: () => Promise<void>
) =>
  await withNativeSession(databaseUrl, scope.sessionId, retire, (connection) =>
    prepareNativeSession(connection, scope)
  );
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable import/group-exports, jsdoc/require-param, typescript/prefer-readonly-parameter-types, typescript/promise-function-async  --
 * import/group-exports (#523): retireEveNativeSessions stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named retireEveNativeSessions API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): retireEveNativeSessions's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * oxc/no-async-await (#540): retireEveNativeSessions sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): retireEveNativeSessions accepts sessionIds: string[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): retireEveNativeSessions preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
/** Retire and settle every authorized member without erasing any native payloads. */
export const retireEveNativeSessions = async (
  databaseUrl: string,
  sessionIds: string[],
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
/* oxlint-enable import/group-exports, jsdoc/require-param, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
