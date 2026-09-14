import { isDeepStrictEqual } from "node:util";

import postgres from "postgres";
import type { Sql } from "postgres";
import { z } from "zod";

import { readEvePostgresRunInventoryInTransaction } from "./eve-run-inventory";

const savedSchema = z.object({
  appRoot: z.string(),
  runIds: z.array(z.string()),
  sessionIds: z.array(z.string()),
});

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
        inventory.activeRunIds.length ||
        inventory.missingRunIds.length ||
        inventory.ambiguousStreamIds.length ||
        inventory.sandboxCoverage.unresolvedRunIds.length
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

/** Only call after authorizing the owner of rootSessionId's deleting binding. */
export const isFencedEveDescendant = async (
  databaseUrl: string,
  rootSessionId: string,
  sessionId: string
) => {
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
