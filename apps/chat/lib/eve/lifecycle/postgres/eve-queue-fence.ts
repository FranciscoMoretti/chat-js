import type { Sql } from "postgres";
import { z } from "zod";

const installSql = `
create table if not exists workflow.eve_queue_tasks (identifier text primary key);
create table if not exists workflow.eve_queue_purge_runs (
  session_id text not null, task_identifier text not null, run_id text not null,
  primary key (session_id, task_identifier, run_id)
);
create or replace function workflow.eve_queue_resources(payload json)
returns text[] language plpgsql set search_path = pg_catalog as $$
declare body jsonb; run_id text;
begin
  body := convert_from(decode(payload->>'data', 'base64'), 'UTF8')::jsonb;
  if body is null or jsonb_typeof(body) <> 'object' then
    raise exception 'Unsupported EVE queue envelope' using errcode = '22023';
  end if;
  if jsonb_typeof(body->'runId') = 'string' then run_id := nullif(body->>'runId', ''); end if;
  if run_id is null and not coalesce(body->'__healthCheck' = 'true'::jsonb, false) then
    raise exception 'Unsupported EVE queue message' using errcode = '22023';
  end if;
  return array['run:' || run_id,
    'run:' || (body #>> '{runInput,attributes,$parentRunId}'),
    'run:' || (body #>> '{runInput,attributes,$rootRunId}'),
    'run:' || (body #>> '{runInput,attributes,$eve.parent}'),
    'run:' || (body #>> '{runInput,attributes,$eve.root}')];
end $$;
create or replace function workflow.eve_guard_queue()
returns trigger language plpgsql set search_path = pg_catalog as $$
declare resources text[] := array[]::text[];
begin
  -- Graphile may set payload to itself while finishing a job. Bookkeeping must
  -- remain possible after fencing; only a changed payload/task is a new write.
  if tg_op = 'UPDATE' and new.task_id = old.task_id
      and new.payload::text is not distinct from old.payload::text then
    return new;
  end if;
  if exists (select 1 from graphile_worker._private_tasks task
    join workflow.eve_queue_tasks configured on configured.identifier = task.identifier
    where task.id = new.task_id) then
    resources := resources || workflow.eve_queue_resources(new.payload);
  end if;
  if tg_op = 'UPDATE' then
    if exists (select 1 from graphile_worker._private_tasks task
      join workflow.eve_queue_tasks configured on configured.identifier = task.identifier
      where task.id = old.task_id) then
      resources := resources || workflow.eve_queue_resources(old.payload);
    end if;
  end if;
  perform workflow.eve_assert_writable(resources);
  return new;
end $$;
create or replace trigger eve_queue_fence before insert or update of payload, task_id
  on graphile_worker._private_jobs for each row execute function workflow.eve_guard_queue();
`;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (installEvePostgresQueueFence); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve installEvePostgresQueueFence's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): installEvePostgresQueueFence uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): installEvePostgresQueueFence accepts connection: Sql; query; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/**
 * Explicit provider migration after installEvePostgresResourceFence. Fences enqueues and replacements, leaving worker bookkeeping and existing job removal available.
 *
 * @param {Sql} connection Postgres connection used to install the queue trigger and register its task in one READ COMMITTED transaction.
 * @param {string} taskIdentifier Nonempty provider task identifier (normally workflow_flows) whose queue writes require writable resources.
 * @returns {Promise<void>} Resolves after the trigger and task registration commit; validation, migration or transaction failures reject.
 */
export const installEvePostgresQueueFence = async (
  connection: Sql,
  taskIdentifier: string
): Promise<void> => {
  z.string().min(1).parse(taskIdentifier);
  await connection.begin("isolation level read committed", async (query) => {
    await query`select 'workflow.eve_assert_writable(text[])'::regprocedure`;
    await query.unsafe(installSql);
    await query`insert into workflow.eve_queue_tasks(identifier) values (${taskIdentifier}) on conflict do nothing`;
  });
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */
