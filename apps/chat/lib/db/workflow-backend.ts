import type { Sql, TransactionSql } from "postgres";

const FIRST_WORKFLOW_BACKEND_ROW_INDEX = 0;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ensureWorkflowBackend); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve ensureWorkflowBackend's awaited sequencing and rejected-Promise behavior. */

/**
 * Refuse a deployment that would reinterpret existing run IDs in another world.
 * @param {Sql} connection - Database connection used to lock and register the workflow backend in one transaction.
 * @param {string} world - Workflow backend identity required to match any existing registration.
 * @returns {Promise<void>} Resolves after preserving or creating the matching registration; rejects on a conflicting backend or database failure.
 */
export const ensureWorkflowBackend = async (
  connection: Readonly<Pick<Sql, "begin">>,
  world: string
): Promise<void> => {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Postgres TransactionSql keeps its native callable generic tag and mutable fragment overloads; a readonly projection loses tag compatibility.
  await connection.begin(async (tx: TransactionSql) => {
    await tx`select pg_advisory_xact_lock(hashtextextended('eve-workflow-backend', 0))`;
    const registrationRows = await tx<{ world: string }[]>`
      select world from "EveWorkflowBackend" where id = 1
    `;
    const registered = registrationRows.at(FIRST_WORKFLOW_BACKEND_ROW_INDEX);
    if (registered && registered.world !== world) {
      throw new Error(
        `This application database belongs to ${registered.world}, not ${world}. Deployment stopped to preserve existing conversations. Keep the previous deployment and database intact; use a fresh application database or complete a verified workflow migration before cutover.`
      );
    }
    await tx`insert into "EveWorkflowBackend" (id, world) values (1, ${world}) on conflict do nothing`;
  });
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
