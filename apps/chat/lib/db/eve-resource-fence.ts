import type { Sql, TransactionSql } from "postgres";
import { z } from "zod";

// Provider extension for the pinned Workflow Postgres schema. Install through
// an explicit provider migration, never from a request or an app DB migration.
const installSql = `
create table if not exists workflow.eve_resource_fences (
  resource text primary key,
  fenced boolean not null default false
);
create table if not exists workflow.eve_session_retirements (
  session_id text primary key,
  completed_at timestamptz not null default now()
);
create table if not exists workflow.eve_payload_purges (
  session_id text not null, task_identifier text not null,
  run_ids text[] not null, stream_ids text[] not null,
  completed_at timestamptz not null default now(),
  primary key (session_id, task_identifier)
);
create table if not exists workflow.eve_sandbox_coverage (
  session_id text primary key,
  app_root text not null,
  run_ids text[] not null,
  sandbox_session_ids text[] not null,
  completed_at timestamptz not null default now()
);
create or replace function workflow.eve_assert_writable(resources text[])
returns void language plpgsql set search_path = pg_catalog as $$
declare resource_id text; is_fenced boolean;
begin
  for resource_id in select distinct value from unnest(resources) value
    where value is not null order by value
  loop
    insert into workflow.eve_resource_fences(resource) values(resource_id)
      on conflict do nothing;
    select fenced into is_fenced from workflow.eve_resource_fences
      where resource = resource_id for share;
    if is_fenced then
      raise exception 'EVE resource is fenced for deletion' using errcode = '55000';
    end if;
  end loop;
end $$;
create or replace function workflow.eve_guard_run()
returns trigger language plpgsql set search_path = pg_catalog as $$
declare resources text[];
begin
  resources := array['run:' || new.id,
    'run:' || (new.attributes->>'$parentRunId'),
    'run:' || (new.attributes->>'$rootRunId'),
    'run:' || (new.attributes->>'$eve.parent'),
    'run:' || (new.attributes->>'$eve.root')];
  if tg_op = 'UPDATE' then
    resources := resources || array['run:' || old.id,
      'run:' || (old.attributes->>'$parentRunId'),
      'run:' || (old.attributes->>'$rootRunId'),
      'run:' || (old.attributes->>'$eve.parent'),
      'run:' || (old.attributes->>'$eve.root')];
  end if;
  perform workflow.eve_assert_writable(resources);
  return new;
end $$;
create or replace function workflow.eve_guard_run_payload()
returns trigger language plpgsql set search_path = pg_catalog as $$
declare resources text[];
begin
  resources := array['run:' || new.run_id];
  if tg_op = 'UPDATE' then resources := resources || array['run:' || old.run_id]; end if;
  perform workflow.eve_assert_writable(resources);
  return new;
end $$;
create or replace function workflow.eve_guard_stream()
returns trigger language plpgsql set search_path = pg_catalog as $$
declare resources text[];
begin
  resources := array['run:' || new.run_id, 'stream:' || new.stream_id];
  if tg_op = 'UPDATE' then
    resources := resources || array['run:' || old.run_id, 'stream:' || old.stream_id];
  end if;
  perform workflow.eve_assert_writable(resources);
  return new;
end $$;
create or replace trigger eve_resource_fence before insert or update
  on workflow.workflow_runs for each row execute function workflow.eve_guard_run();
create or replace trigger eve_resource_fence before insert or update
  on workflow.workflow_stream_chunks for each row execute function workflow.eve_guard_stream();
do $$ declare table_name text; begin
  foreach table_name in array array['workflow_events', 'workflow_event_slots',
    'workflow_steps', 'workflow_hooks', 'workflow_waits']
  loop
    execute format('create or replace trigger eve_resource_fence before insert or update on workflow.%I for each row execute function workflow.eve_guard_run_payload()', table_name);
  end loop;
end $$;
`;

export const installEvePostgresResourceFence = async (connection: Sql) => {
  await connection.begin("isolation level read committed", async (query) => {
    await query.unsafe(installSql);
  });
};

/** Shares the caller's READ COMMITTED transaction with inventory coordination. */
export const fenceEvePostgresResourcesInTransaction = async (
  query: TransactionSql,
  input: {
    runIds: string[];
    streamIds: string[];
  }
) => {
  const { runIds, streamIds } = z
    .object({
      runIds: z.array(z.string().min(1)).min(1).max(10_000),
      streamIds: z.array(z.string().min(1)).max(10_000),
    })
    .parse(input);
  const resources = [
    ...new Set([
      ...runIds.map((id) => `run:${id}`),
      ...streamIds.map((id) => `stream:${id}`),
    ]),
  ].toSorted();
  // Writers retain shared row locks through commit. This update waits for
  // admitted writes and prevents later writes from crossing the fence.
  for (const resource of resources) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
    await query`
      insert into workflow.eve_resource_fences(resource, fenced)
      values (${resource}, true)
      on conflict (resource) do update set fenced = true
    `;
  }
  const active = await query`
    select id from workflow.workflow_runs
    where id in ${query(runIds)} and status not in ('completed', 'failed', 'cancelled')
    limit 1
  `;
  if (active.length) {
    throw new Error("Retire active runs before fencing their payloads.");
  }
  if (streamIds.length) {
    const ambiguous = await query`
      select stream_id from workflow.workflow_stream_chunks
      where stream_id in ${query(streamIds)}
        and (run_id is null or run_id not in ${query(runIds)}) limit 1
    `;
    if (ambiguous.length) {
      throw new Error("Stream ownership must be resolved before fencing.");
    }
  }
};

/**
 * Internal provider primitive: caller authorizes and inventories these resources.
 * Blocks future payload writes, including run recreation and linked descendants.
 * Does not fence queues or erase data, and is not a complete deletion receipt.
 */
export const fenceEvePostgresResources = async (
  connection: Sql,
  input: {
    runIds: string[];
    streamIds: string[];
  }
) => {
  await connection.begin("isolation level read committed", async (query) => {
    await fenceEvePostgresResourcesInTransaction(query, input);
  });
};
