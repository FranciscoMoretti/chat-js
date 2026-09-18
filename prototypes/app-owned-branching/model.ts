import type { Sql, TransactionSql } from "postgres";
import { z } from "zod";

const part = z.discriminatedUnion("type", [
  z.object({ text: z.string(), type: z.literal("text") }).strict(),
  z
    .object({
      mediaType: z.string(),
      object: z.string(),
      type: z.literal("file"),
    })
    .strict(),
  z
    .object({
      id: z.string(),
      input: z.string(),
      name: z.string(),
      type: z.literal("call"),
    })
    .strict(),
  z
    .object({ id: z.string(), output: z.string(), type: z.literal("result") })
    .strict(),
]);
export const message = z
  .object({
    annotation: z
      .object({
        model: z.string().optional(),
        selectedTool: z.string().nullable().optional(),
      })
      .strict()
      .optional(),
    parts: z.array(part),
    role: z.enum(["user", "assistant", "tool"]),
  })
  .strict();
export type Message = z.infer<typeof message>;
type Branch = {
  id: string;
  owner: string;
  head: string | null;
  documents: Record<string, string>;
  sandbox: string;
  barrier: string | null;
};
type Checkpoint = {
  id: string;
  owner: string;
  source: string | null;
  intent: string;
  head: string | null;
  documents: Record<string, string>;
  sandbox: string;
  status: "pending" | "ready" | "failed";
};
type DB = Sql | TransactionSql;

const ownedBranch = async (sql: DB, owner: string, id: string) => {
  const [row] = await sql<
    Branch[]
  >`select * from branch where id=${id} and owner=${owner} for update`;
  if (!row) {
    throw new Error("not owned");
  }
  return row;
};

export const history = async (sql: DB, owner: string, head: string | null) => {
  const rows = await sql<{ payload: unknown }[]>`
    with recursive prefix as (
      select id, previous, payload, 0 as depth from node where id=${head} and owner=${owner}
      union all
      select n.id, n.previous, n.payload, p.depth+1 from node n join prefix p on n.id=p.previous where n.owner=${owner} and p.depth < 1000
    ) select case when a.node is null then p.payload
      else p.payload || jsonb_build_object('annotation',a.payload) end as payload
      from prefix p left join annotation a on a.node=p.id and a.owner=${owner} order by depth desc`;
  if (rows.length > 1000) {
    throw new Error("prefix too large");
  }
  return rows.map((row) => message.parse(row.payload));
};

// A bounded neutral prototype format, NOT a claimed public EVE seed schema.
export const validatePrefix = (messages: Message[]) => {
  if (
    messages.length > 1000 ||
    Buffer.byteLength(JSON.stringify(messages)) > 1_000_000
  ) {
    throw new Error("prefix too large");
  }
  const pending = new Set<string>();
  const used = new Set<string>();
  for (const item of messages) {
    for (const p of item.parts) {
      if (p.type === "call") {
        if (item.role !== "assistant" || used.has(p.id)) {
          throw new Error("invalid tool call");
        }
        pending.add(p.id);
        used.add(p.id);
      } else if (p.type === "result") {
        if (item.role !== "tool" || !pending.delete(p.id)) {
          throw new Error("unpaired result");
        }
      } else if (pending.size && item.role !== "assistant") {
        throw new Error("unresolved tool boundary");
      }
    }
  }
  if (pending.size) {
    throw new Error("unresolved tool boundary");
  }
};

const requireResources = async (
  sql: DB,
  owner: string,
  ids: string[],
  kind: "file" | "document"
) => {
  if (!ids.length) {
    return;
  }
  const rows =
    await sql`select id from resource where id in ${sql(ids)} and owner=${owner} and kind=${kind}`;
  if (rows.length !== new Set(ids).size) {
    throw new Error("resource not owned");
  }
};

export const append = async (
  sql: Sql,
  input: {
    owner: string;
    branch: string;
    expectedHead: string | null;
    id: string;
    message: Message;
  }
) => {
  const parsed = message.parse(input.message);
  const { annotation, ...payload } = parsed;
  await sql.begin(async (tx) => {
    const b = await ownedBranch(tx, input.owner, input.branch);
    await requireResources(
      tx,
      input.owner,
      payload.parts.flatMap((p) => (p.type === "file" ? [p.object] : [])),
      "file"
    );
    if (b.barrier) {
      throw new Error("capture barrier");
    }
    if (b.head !== input.expectedHead) {
      throw new Error("stale head");
    }
    await tx`insert into node (id,owner,previous,payload) values (${input.id},${input.owner},${b.head},${tx.json(payload)})`;
    if (annotation) {
      await tx`insert into annotation (node,owner,payload) values (${input.id},${input.owner},${tx.json(annotation)})`;
    }
    await tx`update branch set head=${input.id} where id=${b.id}`;
  });
};

export const editDocument = async (
  sql: Sql,
  owner: string,
  branch: string,
  revisions: Record<string, string>
) => {
  await sql.begin(async (tx) => {
    const b = await ownedBranch(tx, owner, branch);
    if (b.barrier) {
      throw new Error("capture barrier");
    }
    await requireResources(tx, owner, Object.values(revisions), "document");
    await tx`update branch set documents=${tx.json(revisions)} where id=${b.id}`;
  });
};

export const beginWriter = async (
  sql: Sql,
  owner: string,
  branch: string,
  id: string,
  kind: string
) => {
  await sql.begin(async (tx) => {
    const b = await ownedBranch(tx, owner, branch);
    if (b.barrier) {
      throw new Error("capture barrier");
    }
    await tx`insert into writer (id,branch,kind) values (${id},${branch},${kind})`;
  });
};

export const endWriter = async (
  sql: Sql,
  owner: string,
  branch: string,
  id: string
) => {
  await sql.begin(async (tx) => {
    await ownedBranch(tx, owner, branch);
    await tx`delete from writer where id=${id} and branch=${branch}`;
  });
};

// Durable steps may retry this operation. The operation identity fixes the first
// admitted boundary; retry never resamples documents or the live sandbox.
export const reserve = async (
  sql: Sql,
  input: { owner: string; source: string; id: string; intent: string }
) => {
  await sql.begin(async (tx) => {
    const b = await ownedBranch(tx, input.owner, input.source);
    const [existing] = await tx<
      Checkpoint[]
    >`select * from checkpoint where id=${input.id}`;
    if (existing) {
      if (
        existing.owner !== input.owner ||
        existing.source !== input.source ||
        existing.intent !== input.intent
      ) {
        throw new Error("conflicting operation");
      }
      return;
    }
    if (b.barrier) {
      throw new Error("capture barrier");
    }
    const active = await tx`select id from writer where branch=${b.id}`;
    if (active.length) {
      throw new Error("writers not drained");
    }
    validatePrefix(await history(tx, input.owner, b.head));
    await tx`insert into checkpoint (id,owner,source,intent,head,documents,sandbox,status)
      values (${input.id},${input.owner},${b.id},${input.intent},${b.head},${tx.json(b.documents)},${b.sandbox},'pending')`;
    await tx`update branch set barrier=${input.id} where id=${b.id}`;
  });
};

export interface SnapshotProvider {
  // Stronger than Vercel snapshot(): replay/lookup by caller key is REQUIRED.
  capture: (key: string, sandbox: string) => Promise<void>;
  restore: (key: string, sandbox: string) => Promise<void>;
}

export const complete = async (
  sql: Sql,
  provider: SnapshotProvider,
  owner: string,
  id: string,
  afterRestore?: () => void
) => {
  const [c] = await sql<
    Checkpoint[]
  >`select * from checkpoint where id=${id} and owner=${owner}`;
  if (!c) {
    throw new Error("not owned");
  }
  if (c.status === "ready") {
    return;
  }
  if (!c.source) {
    throw new Error("source missing");
  }
  const { source } = c;
  try {
    await provider.capture(id, c.sandbox);
    // Snapshot stops the original VM. Reopen parent before releasing admission.
    await provider.restore(id, `parent:${id}`);
    afterRestore?.();
    await sql.begin(async (tx) => {
      const b = await ownedBranch(tx, owner, source);
      const [current] = await tx<
        Checkpoint[]
      >`select * from checkpoint where id=${id} for update`;
      if (current?.status === "ready") {
        return;
      }
      if (b.barrier !== id) {
        throw new Error("lost barrier");
      }
      await tx`update checkpoint set status='ready', error=null where id=${id}`;
      await tx`update branch set sandbox=${`parent:${id}`}, barrier=null where id=${b.id}`;
    });
  } catch (error) {
    await sql`update checkpoint set status='failed', error=${String(error)} where id=${id} and status <> 'ready'`;
    // Keep the barrier: a provider error/timeout is not evidence of no effect.
    throw error;
  }
};

export const fork = async (
  sql: Sql,
  provider: SnapshotProvider,
  input: { owner: string; checkpoint: string; child: string }
) => {
  const [c] = await sql<
    Checkpoint[]
  >`select * from checkpoint where id=${input.checkpoint} and owner=${input.owner} and status='ready'`;
  if (!c) {
    throw new Error("checkpoint not ready or not owned");
  }
  await sql.begin(async (tx) => {
    const prior =
      await tx`select id from child_request where id=${input.child}`;
    const branch = await tx`select id from branch where id=${input.child}`;
    if (!prior.length && branch.length) {
      throw new Error("child already exists");
    }
    await tx`insert into child_request (id,owner,checkpoint) values (${input.child},${input.owner},${c.id}) on conflict do nothing`;
    const [request] = await tx<
      { owner: string; checkpoint: string; deleted: boolean }[]
    >`select owner,checkpoint,deleted from child_request where id=${input.child} for update`;
    if (
      request?.owner !== input.owner ||
      request.checkpoint !== c.id ||
      request.deleted
    ) {
      throw new Error("conflicting child");
    }
  });
  // Deterministic child identity + provider replay protects the allocation gap.
  const sandbox = `child:${input.child}`;
  await provider.restore(c.id, sandbox);
  await sql.begin(async (tx) => {
    const [request] = await tx<
      { deleted: boolean }[]
    >`select deleted from child_request where id=${input.child} for update`;
    if (!request || request.deleted) {
      throw new Error("child deleted");
    }
    await tx`insert into branch (id,owner,head,documents,sandbox)
      values (${input.child},${input.owner},${c.head},${tx.json(c.documents)},${sandbox}) on conflict do nothing`;
    const b = await ownedBranch(tx, input.owner, input.child);
    if (b.owner !== input.owner) {
      throw new Error("conflicting child");
    }
  });
};

/** Retention proof only: keep immutable nodes/resources/checkpoints for children.
 * Production needs reachability GC + per-owner retention/deletion policy. */
export const removeBranch = async (sql: Sql, owner: string, branch: string) => {
  await sql.begin(async (tx) => {
    await tx`select id from child_request where id=${branch} for update`;
    const b = await ownedBranch(tx, owner, branch);
    const writers = await tx`select id from writer where branch=${b.id}`;
    if (b.barrier || writers.length) {
      throw new Error("branch busy");
    }
    await tx`update child_request set deleted=true where id=${b.id}`;
    await tx`delete from branch where id=${b.id}`;
  });
};

/** Mock backend write path: the writer token outlives the whole OS process/job. */
export const writeFile = async (
  sql: Sql,
  input: {
    owner: string;
    branch: string;
    writer: string;
    path: string;
    bytes: string;
  }
) => {
  await sql.begin(async (tx) => {
    const b = await ownedBranch(tx, input.owner, input.branch);
    const tokens =
      await tx`select id from writer where id=${input.writer} and branch=${b.id}`;
    if (b.barrier || !tokens.length) {
      throw new Error("writer not admitted");
    }
    const updated =
      await tx`update provider_vm set files=files || ${tx.json({ [input.path]: input.bytes })} where id=${b.sandbox} and not stopped returning id`;
    if (!updated.length) {
      throw new Error("VM stopped");
    }
  });
};

/** App annotations are never serialized into the model's transcript. */
export const modelHistory = async (
  sql: DB,
  owner: string,
  head: string | null
) => {
  const messages = await history(sql, owner, head);
  return messages.map(({ parts, role }) => ({ parts, role }));
};
