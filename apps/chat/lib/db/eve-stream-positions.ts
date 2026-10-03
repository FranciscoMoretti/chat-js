/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import postgres from "postgres";
import type { Sql } from "postgres";
import { z } from "zod";
/* oxlint-enable sort-imports */

const positionRows = z.array(
  z.object({
    length: z.coerce.number().int().nonnegative(),
    streamId: z.string(),
  })
);

/* oxlint-disable import/group-exports, import/no-named-export, jsdoc/require-param, jsdoc/require-returns, max-statements, no-magic-numbers, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/group-exports (#523): readEvePostgresStreamPositions stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named readEvePostgresStreamPositions API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): readEvePostgresStreamPositions's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): readEvePostgresStreamPositions's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-statements (#512): readEvePostgresStreamPositions keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): readEvePostgresStreamPositions uses 500 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): readEvePostgresStreamPositions sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep readEvePostgresStreamPositions's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep readEvePostgresStreamPositions's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): readEvePostgresStreamPositions accepts connection: Sql; sessionIds: string[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): readEvePostgresStreamPositions intentionally keeps the existing falsy-value behavior of sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
/* oxlint-enable import/group-exports, import/no-named-export, jsdoc/require-param, jsdoc/require-returns, max-statements, no-magic-numbers, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, import/no-named-export, no-magic-numbers, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): getEvePostgresStreamPositions stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getEvePostgresStreamPositions API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): getEvePostgresStreamPositions uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): getEvePostgresStreamPositions sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep getEvePostgresStreamPositions's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep getEvePostgresStreamPositions's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): getEvePostgresStreamPositions accepts sessionIds: string[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable import/group-exports, import/no-named-export, no-magic-numbers, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
