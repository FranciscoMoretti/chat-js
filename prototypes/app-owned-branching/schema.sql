-- PROTOTYPE ONLY. Installed into a fresh disposable cluster by the test runner.
create table node (
  id text primary key,
  owner text not null,
  previous text references node(id),
  payload jsonb not null,
  unique (owner, id),
  foreign key (owner, previous) references node(owner, id)
);
create function immutable_node() returns trigger language plpgsql as $$
begin raise exception 'immutable message'; end $$;
create trigger immutable_node before update on node
  for each row execute function immutable_node();
create table branch (
  id text primary key,
  owner text not null,
  head text,
  documents jsonb not null default '{}',
  sandbox text not null,
  barrier text,
  foreign key (owner, head) references node(owner, id)
);
-- No TTL: a crashed writer is not evidence that its process stopped writing.
create table writer (
  id text primary key,
  branch text not null references branch(id),
  kind text not null
);
create table checkpoint (
  id text primary key,
  owner text not null,
  source text references branch(id) on delete set null,
  intent text not null,
  head text,
  documents jsonb not null,
  sandbox text not null,
  status text not null check (status in ('pending', 'ready', 'failed')),
  error text,
  foreign key (owner, head) references node(owner, id)
);
-- The mock provider journals effects separately from app checkpoint commits.
create table provider_snapshot (
  id text primary key,
  source text not null,
  files jsonb not null
);
create table provider_vm (
  id text primary key,
  files jsonb not null,
  stopped boolean not null default false
);
create table child_request (
  id text primary key,
  owner text not null,
  checkpoint text not null references checkpoint(id),
  deleted boolean not null default false
);

-- Each ID names immutable bytes or one immutable document revision. Production
-- would reuse existing document revisions and an owned object-storage grant.
create table resource (
  id text primary key,
  owner text not null,
  kind text not null check (kind in ('file','document')),
  bytes text not null
);
create trigger immutable_resource before update on resource
  for each row execute function immutable_node();

create table annotation (
  node text primary key references node(id),
  owner text not null,
  payload jsonb not null,
  foreign key (owner, node) references node(owner, id)
);
create trigger immutable_annotation before update on annotation
  for each row execute function immutable_node();
