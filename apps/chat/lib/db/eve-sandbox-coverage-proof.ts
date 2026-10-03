/* oxlint-disable import/no-nodejs-modules  --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { isDeepStrictEqual } from "node:util";; its Node runtime boundary deliberately permits these built-ins.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { isDeepStrictEqual } from "node:util";

import postgres from "postgres";
import type { Sql } from "postgres";
import { z } from "zod";

import { readEvePostgresRunInventoryInTransaction } from "./eve-run-inventory";
/* oxlint-enable import/no-nodejs-modules */

const savedSchema = z.object({
  appRoot: z.string(),
  runIds: z.array(z.string()),
  sessionIds: z.array(z.string()),
});

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions  --
 * import/group-exports (#523): verifyEveSandboxCoverage stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named verifyEveSandboxCoverage API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): verifyEveSandboxCoverage's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): verifyEveSandboxCoverage's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): verifyEveSandboxCoverage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): verifyEveSandboxCoverage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): verifyEveSandboxCoverage uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): verifyEveSandboxCoverage sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep verifyEveSandboxCoverage's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep verifyEveSandboxCoverage's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): verifyEveSandboxCoverage accepts connection: Sql; input: { sessionId: string; runIds: string[]; appRoot: string; }; query; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): verifyEveSandboxCoverage intentionally keeps the existing falsy-value behavior of raw; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Internal: caller authorizes the deleting family and canonical worker root. */
export const verifyEveSandboxCoverage = async (
  connection: Sql,
  input: {
    sessionId: string;
    runIds: string[];
    appRoot: string;
  },
  verifyIdentity: (sessionId: string) => Promise<void>
) => {
  const runIds = [...new Set(input.runIds)].toSorted();
  if (!runIds.includes(input.sessionId)) {
    throw new Error("Sandbox coverage is missing its root session.");
  }
  return await connection.begin(
    "isolation level read committed",
    async (query) => {
      // Same lock as native payload erasure: retain the evidence until proof commits.
      await query`select pg_advisory_xact_lock(hashtextextended(${`eve-native-purge:${input.sessionId}`}, 0))`;
      const [raw] =
        await query`select app_root as "appRoot", run_ids as "runIds", sandbox_session_ids as "sessionIds" from workflow.eve_sandbox_coverage where session_id = ${input.sessionId}`;
      if (raw) {
        const saved = savedSchema.parse(raw);
        if (
          saved.appRoot !== input.appRoot ||
          !isDeepStrictEqual(saved.runIds, runIds)
        ) {
          throw new Error(
            "Sandbox coverage scope changed. Reconcile cleanup before retrying."
          );
        }
        return saved.sessionIds;
      }
      const inventory = await readEvePostgresRunInventoryInTransaction(
        query,
        input.sessionId,
        runIds
      );
      const actual = inventory.runs.map((run) => run.id).toSorted();
      if (
        !isDeepStrictEqual(actual, runIds) ||
        inventory.activeRunIds.length > 0 ||
        inventory.missingRunIds.length > 0 ||
        inventory.ambiguousStreamIds.length > 0 ||
        inventory.sandboxCoverage.unresolvedRunIds.length > 0
      ) {
        throw new Error(
          "Resolve incomplete sandbox workflow coverage before cleanup."
        );
      }
      const resources = [
        ...runIds.map((id) => `run:${id}`),
        ...inventory.streamIds.map((id) => `stream:${id}`),
      ];
      const fenced =
        await query`select resource from workflow.eve_resource_fences where resource in ${query(resources)} and fenced = true for share`;
      if (fenced.length !== resources.length) {
        throw new Error(
          "Fence native writers before verifying sandbox ownership."
        );
      }
      const { sessionIds } = inventory.sandboxCoverage;
      if (!sessionIds.includes(input.sessionId)) {
        throw new Error(
          "The deletion root is not a known sandbox-owning session."
        );
      }
      for (const sessionId of sessionIds) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
        await verifyIdentity(sessionId);
      }
      await query`insert into workflow.eve_sandbox_coverage(session_id, app_root, run_ids, sandbox_session_ids) values (${input.sessionId}, ${input.appRoot}, ${query.array(runIds)}::text[], ${query.array(sessionIds)}::text[])`;
      return sessionIds;
    }
  );
};
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): isFencedEveDescendant stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named isFencedEveDescendant API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): isFencedEveDescendant's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): isFencedEveDescendant's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-magic-numbers (#517): isFencedEveDescendant uses 10_000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): isFencedEveDescendant sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): isFencedEveDescendant accepts query; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Only call after authorizing the owner of rootSessionId's deleting binding. */
export const isFencedEveDescendant = async (
  databaseUrl: string,
  rootSessionId: string,
  sessionId: string
): Promise<boolean> => {
  const connection = postgres(databaseUrl, { max: 1 });
  try {
    return await connection.begin(
      "isolation level repeatable read read only",
      async (query) => {
        const retained = z
          .array(z.object({ id: z.string() }))
          .parse(
            await query`select run_id as id from workflow.eve_queue_purge_runs where session_id = ${rootSessionId} and task_identifier = 'workflow_flows' limit 10001`
          );
        if (retained.length > 10_000) {
          return false;
        }
        const inventory = await readEvePostgresRunInventoryInTransaction(
          query,
          rootSessionId,
          retained.map((run) => run.id)
        );
        if (!inventory.runs.some((run) => run.id === sessionId)) {
          return false;
        }
        const resources = [
          ...new Set([`run:${rootSessionId}`, `run:${sessionId}`]),
        ];
        const fenced =
          await query`select resource from workflow.eve_resource_fences where resource in ${query(resources)} and fenced = true`;
        return fenced.length === resources.length;
      }
    );
  } finally {
    await connection.end();
  }
};
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, typescript/prefer-readonly-parameter-types */
