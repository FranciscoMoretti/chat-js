import type { Sql, TransactionSql } from "postgres";
import type { PostgresLifecycleQuery } from "./compatibility";
import { readEvePostgresRunInventoryInTransaction } from "./eve-run-inventory";
import { z } from "zod";

const FIRST_ROW_INDEX = 0;
const EMPTY_COUNT = 0;
type CoverageQuery = PostgresLifecycleQuery & {
  readonly array: TransactionSql["array"];
};

const savedSchema = z.object({
  appRoot: z.string(),
  runIds: z.array(z.string()),
  sessionIds: z.array(z.string()),
});

// Both operands come from parsed or canonicalized dense string arrays. Retained
// proof compares ordered run identities, without object/prototype equality.
const sameRunInventory = (
  left: readonly string[],
  right: readonly string[]
): boolean =>
  left.length === right.length &&
  left.every((runId, index) => runId === right[index]);

const assertCompleteSandboxInventory = (
  inventory: {
    readonly runs: readonly { readonly id: string }[];
    readonly activeRunIds: readonly string[];
    readonly missingRunIds: readonly string[];
    readonly ambiguousStreamIds: readonly string[];
    readonly sandboxCoverage: { readonly unresolvedRunIds: readonly string[] };
  },
  runIds: readonly string[]
): void => {
  const actual = inventory.runs.map((run) => run.id).toSorted();
  if (
    !sameRunInventory(actual, runIds) ||
    inventory.activeRunIds.length > EMPTY_COUNT ||
    inventory.missingRunIds.length > EMPTY_COUNT ||
    inventory.ambiguousStreamIds.length > EMPTY_COUNT ||
    inventory.sandboxCoverage.unresolvedRunIds.length > EMPTY_COUNT
  ) {
    throw new Error(
      "Resolve incomplete sandbox workflow coverage before cleanup."
    );
  }
};

const readFencedSandboxCoverage = async (
  query: PostgresLifecycleQuery,
  scope: { readonly sessionId: string },
  runIds: readonly string[]
): Promise<string[]> => {
  const inventory = await readEvePostgresRunInventoryInTransaction(
    query,
    scope.sessionId,
    runIds
  );
  assertCompleteSandboxInventory(inventory, runIds);
  const resources = [
    ...runIds.map((id) => `run:${id}`),
    ...inventory.streamIds.map((id) => `stream:${id}`),
  ];
  const fenced =
    await query`select resource from workflow.eve_resource_fences where resource in ${query(resources)} and fenced = true for share`;
  if (fenced.length !== resources.length) {
    throw new Error("Fence native writers before verifying sandbox ownership.");
  }
  const { sessionIds } = inventory.sandboxCoverage;
  if (!sessionIds.includes(scope.sessionId)) {
    throw new Error("The deletion root is not a known sandbox-owning session.");
  }
  return sessionIds;
};

const readMatchingSavedCoverage = (
  raw: unknown,
  input: { readonly appRoot: string },
  runIds: readonly string[]
): string[] => {
  const saved = savedSchema.parse(raw);
  if (
    saved.appRoot !== input.appRoot ||
    !sameRunInventory(saved.runIds, runIds)
  ) {
    throw new Error(
      "Sandbox coverage scope changed. Reconcile cleanup before retrying."
    );
  }
  return saved.sessionIds;
};

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
  connection: Readonly<Pick<Sql, "begin">>,
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
    async (query: CoverageQuery) => {
      // Same lock as native payload erasure: retain the evidence until proof commits.
      await query`select pg_advisory_xact_lock(hashtextextended(${`eve-native-purge:${input.sessionId}`}, 0))`;
      const savedRows =
        await query`select app_root as "appRoot", run_ids as "runIds", sandbox_session_ids as "sessionIds" from workflow.eve_sandbox_coverage where session_id = ${input.sessionId}`;
      const raw = savedRows.at(FIRST_ROW_INDEX);
      if (raw) {
        return readMatchingSavedCoverage(raw, input, runIds);
      }
      const sessionIds = await readFencedSandboxCoverage(query, input, runIds);
      for (const sessionId of sessionIds) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Bound native HTTP and local identity reads to one request at a time while holding resource fences; all identities must match before the coverage proof commits.
        await verifyIdentity(sessionId);
      }
      await query`insert into workflow.eve_sandbox_coverage(session_id, app_root, run_ids, sandbox_session_ids) values (${input.sessionId}, ${input.appRoot}, ${query.array(runIds)}::text[], ${query.array(sessionIds)}::text[])`;
      return sessionIds;
    }
  );
};

export { verifyEveSandboxCoverage };
