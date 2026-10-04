import type { Sql } from "postgres";

// Exact migration boundary of @workflow/world-postgres 5.0.0-beta.40 and
// graphile-worker 0.16.6. New migrations require native acceptance and review of
// queue envelopes, ownership relationships, triggers, and deletion ordering.
const workflowMigrationBoundary = "1786060800000";
const graphileMigrationBoundary = 18;
const queueFenceCount = 1;
const missingTaskCount = 0;
const fencedTables = [
  "workflow_runs",
  "workflow_events",
  "workflow_event_slots",
  "workflow_steps",
  "workflow_hooks",
  "workflow_waits",
  "workflow_stream_chunks",
];

/* oxlint-disable typescript/prefer-readonly-parameter-types -- postgres.Sql is a callable connection API whose transactions remain mutable. */
export const assertPostgresLifecycleCompatibility = async (
  connection: Sql
): Promise<void> => {
  const [workflow] = await connection`
    select max(created_at)::text as boundary from workflow_drizzle.workflow_migrations
  `;
  const [graphile] = await connection`
    select max(id) as boundary from graphile_worker.migrations
  `;
  if (
    workflow?.boundary !== workflowMigrationBoundary ||
    graphile?.boundary !== graphileMigrationBoundary
  ) {
    throw new Error(
      "Unsupported workflow lifecycle schema version. Review provider compatibility before cleanup."
    );
  }
  const triggers = await connection`
    select c.relname from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal and t.tgenabled = 'O'
      and ((n.nspname = 'workflow' and c.relname in ${connection(fencedTables)}
        and t.tgname = 'eve_resource_fence')
      or (n.nspname = 'graphile_worker' and c.relname = '_private_jobs'
        and t.tgname = 'eve_queue_fence'))
  `;
  const tasks = await connection`
    select identifier from workflow.eve_queue_tasks where identifier = 'workflow_flows'
  `;
  if (
    triggers.length !== fencedTables.length + queueFenceCount ||
    tasks.length === missingTaskCount
  ) {
    throw new Error(
      "Workflow lifecycle fences are missing or disabled. Run eve:setup before cleanup."
    );
  }
};
