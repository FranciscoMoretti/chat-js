import type { ArrayParameter, Helper, PendingQuery, Row } from "postgres";

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

// Only lifecycle string/number values, string-list helpers and native array
// parameters may be interpolated. Preserve the original callable connection and
// native query/helper outputs; no fragments, custom parameters or pool state.
/* oxlint-disable import/no-named-export -- App modules use named exports; the pinned import/no-default-export rule rejects the alternative. */
export interface PostgresLifecycleQuery {
  <Rows extends readonly (object | undefined)[] = Row[]>(
    template: Readonly<TemplateStringsArray>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Native list helpers retain their private NotAPromise brand and mutable rest tuple; array parameters retain native mutable raw arrays. Readonly mappings erase the brand, and readonly rest types reject native tag assignment.
    ...parameters: readonly (
      | string
      | number
      | Helper<readonly string[], []>
      | ArrayParameter<string[]>
    )[]
  ): PendingQuery<Rows>;
  (values: readonly string[]): Helper<readonly string[], []>;
}
/* oxlint-enable import/no-named-export */

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (assertPostgresLifecycleCompatibility); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve assertPostgresLifecycleCompatibility's awaited sequencing and rejected-Promise behavior. */

export const assertPostgresLifecycleCompatibility = async (
  connection: PostgresLifecycleQuery
): Promise<void> => {
  const [workflow] = await connection`
    select max(created_at)::text as boundary from workflow_drizzle.workflow_migrations
  `;
  const [graphile] = await connection`
    select max(id) as boundary from graphile_worker.migrations
  `;
  if (
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading boundary from workflow; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    workflow?.boundary !== workflowMigrationBoundary ||
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading boundary from graphile; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
    where not t.tgisinternal and t.tgenabled in ('O', 'A')
      -- BEFORE ROW INSERT OR UPDATE, without a conditional WHEN or arguments.
      and t.tgtype = 23 and t.tgqual is null and t.tgnargs = 0
      and ((n.nspname = 'workflow' and c.relname in ${connection(fencedTables)}
        and t.tgname = 'eve_resource_fence' and t.tgattr = ''::int2vector
        and t.tgfoid = case c.relname
          when 'workflow_runs' then 'workflow.eve_guard_run()'::regprocedure
          when 'workflow_stream_chunks' then 'workflow.eve_guard_stream()'::regprocedure
          else 'workflow.eve_guard_run_payload()'::regprocedure end)
      or (n.nspname = 'graphile_worker' and c.relname = '_private_jobs'
        and t.tgname = 'eve_queue_fence'
        and t.tgfoid = 'workflow.eve_guard_queue()'::regprocedure
        and (select array_agg(a.attname::text order by a.attname)
          from pg_attribute a where a.attrelid = c.oid
          and a.attnum = any(t.tgattr)) = array['payload', 'task_id']))
  `;
  const tasks = await connection`
    select identifier from workflow.eve_queue_tasks where identifier = 'workflow_flows'
  `;
  if (
    triggers.length !== fencedTables.length + queueFenceCount ||
    tasks.length === missingTaskCount
  ) {
    throw new Error(
      "Workflow lifecycle fences are missing or disabled, or their definitions are incompatible. Run eve:setup before cleanup."
    );
  }
};
/* oxlint-enable import/no-named-export */
/* oxlint-enable oxc/no-async-await */
