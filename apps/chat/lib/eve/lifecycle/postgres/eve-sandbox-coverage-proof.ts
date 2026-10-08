/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { isDeepStrictEqual } from "node:util";; its Node runtime boundary deliberately permits these built-ins.
 */
import { isDeepStrictEqual } from "node:util";

import postgres from "postgres";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { Sql } from "postgres";
/* oxlint-enable sort-imports */
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { readEvePostgresRunInventoryInTransaction } from "./eve-run-inventory";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules */

const FIRST_ROW_INDEX = 0;

const savedSchema = z.object({
  appRoot: z.string(),
  runIds: z.array(z.string()),
  sessionIds: z.array(z.string()),
});

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve verifyEveSandboxCoverage's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers -- max-lines-per-function (#510): verifyEveSandboxCoverage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): verifyEveSandboxCoverage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): verifyEveSandboxCoverage uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions. */
/**
 * Internal: caller authorizes the deleting family and canonical worker root.
 * @param {Sql} connection Native workflow database connection used to retain proof under the purge lock.
 * @param {{ sessionId: string; runIds: string[]; appRoot: string; }} input Authorized root, canonical worker app root, and exact run inventory to cover.
 * @param {string} input.sessionId Root session included in the authorized run inventory.
 * @param {string[]} input.runIds Run identities whose writers must be fenced and workflow coverage complete.
 * @param {string} input.appRoot Canonical worker root bound into the retained coverage proof.
 * @param {(sessionId: string) => Promise<void>} verifyIdentity Checks each sandbox-owning session against the authorized native identity.
 * @returns {Promise<string[]>} Sandbox-owning session IDs from matching retained proof or newly verified coverage.
 */
const verifyEveSandboxCoverage = async (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Open the native Postgres transaction with connection.begin; preserve its overloaded transaction callback and connection lifecycle contract.
  connection: Sql,
  input: {
    readonly sessionId: string;
    readonly runIds: readonly string[];
    readonly appRoot: string;
  },
  verifyIdentity: (sessionId: string) => Promise<void>
): Promise<string[]> => {
  const runIds = [...new Set(input.runIds)].toSorted();
  if (!runIds.includes(input.sessionId)) {
    throw new Error("Sandbox coverage is missing its root session.");
  }
  return await connection.begin(
    "isolation level read committed",
    async (
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- This native transaction executes database writes and retains the Postgres tagged-query and interpolation overloads.
      query
    ) => {
      // Same lock as native payload erasure: retain the evidence until proof commits.
      await query`select pg_advisory_xact_lock(hashtextextended(${`eve-native-purge:${input.sessionId}`}, 0))`;
      const savedRows =
        await query`select app_root as "appRoot", run_ids as "runIds", sandbox_session_ids as "sessionIds" from workflow.eve_sandbox_coverage where session_id = ${input.sessionId}`;
      const raw = savedRows.at(FIRST_ROW_INDEX);
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve isFencedEveDescendant's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers */

/* oxlint-disable no-magic-numbers -- no-magic-numbers (#517): isFencedEveDescendant uses 10_000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions. */
/**
 * Only call after authorizing the owner of rootSessionId's deleting binding.
 * @param {string} databaseUrl Native workflow database used to inspect the retained cleanup inventory.
 * @param {string} rootSessionId Authorized deleting binding whose retained queue inventory defines the family.
 * @param {string} sessionId Candidate descendant whose native run and resource fences must be present.
 * @returns {Promise<boolean>} Whether the candidate is in the native inventory and both root and candidate writers are fenced.
 */
const isFencedEveDescendant = async (
  databaseUrl: string,
  rootSessionId: string,
  sessionId: string
): Promise<boolean> => {
  const connection = postgres(databaseUrl, { max: 1 });
  try {
    return await connection.begin(
      "isolation level repeatable read read only",
      async (
        // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Execute metadata reads through the native Postgres tag and interpolation overloads; preserving those callable signatures retains SDK mutable members and the rule finding.
        query
      ) => {
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (isFencedEveDescendant, verifyEveSandboxCoverage); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers */
export { isFencedEveDescendant, verifyEveSandboxCoverage };
/* oxlint-enable import/no-named-export */
