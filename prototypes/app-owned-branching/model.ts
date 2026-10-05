import type { Sql, TransactionSql } from "postgres";
import type postgres from "postgres";
import { z } from "zod";

const MAX_PREFIX_MESSAGES = 1000;
const MAX_PREFIX_BYTES = 1_000_000;

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

const message = z
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

type Message = z.infer<typeof message>;

type DeepReadonly<Value> = Value extends readonly unknown[]
  ? { readonly [Index in keyof Value]: DeepReadonly<Value[Index]> }
  : Value extends object
    ? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
    : Value;

interface Branch {
  id: string;
  owner: string;
  head: string | null;
  documents: Record<string, string>;
  sandbox: string;
  barrier: string | null;
}

interface Checkpoint {
  id: string;
  owner: string;
  source: string | null;
  intent: string;
  head: string | null;
  documents: Record<string, string>;
  sandbox: string;
  status: "pending" | "ready" | "failed";
}

type DB = Sql | TransactionSql;

type ReadonlySqlTag = <
  RowType extends readonly (object | undefined)[] = postgres.Row[],
>(
  template: readonly string[] & { readonly raw: readonly string[] },
  ...parameters: readonly (string | number | null)[]
) => postgres.PendingQuery<RowType>;

const hasBarrier = (barrier: string | null): boolean =>
  barrier !== null && barrier !== "";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve ownedBranch's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable typescript/strict-boolean-expressions -- ownedBranch: The database result may be empty; this existing guard preserves its missing-row error. */
const ownedBranch = async (
  sql: ReadonlySqlTag,
  owner: string,
  id: string
): Promise<Branch> => {
  const [row] = await sql<
    Branch[]
  >`select * from branch where id=${id} and owner=${owner} for update`;
  if (!row) {
    throw new Error("not owned");
  }
  return row;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve history's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/strict-boolean-expressions */

const history = async (
  sql: ReadonlySqlTag,
  owner: string,
  head: string | null
): Promise<Message[]> => {
  const rows = await sql<{ payload: unknown }[]>`
    with recursive prefix as (
      select id, previous, payload, 0 as depth from node where id=${head} and owner=${owner}
      union all
      select n.id, n.previous, n.payload, p.depth+1 from node n join prefix p on n.id=p.previous where n.owner=${owner} and p.depth < ${MAX_PREFIX_MESSAGES}
    ) select case when a.node is null then p.payload
      else p.payload || jsonb_build_object('annotation',a.payload) end as payload
      from prefix p left join annotation a on a.node=p.id and a.owner=${owner} order by depth desc`;
  if (rows.length > MAX_PREFIX_MESSAGES) {
    throw new Error("prefix too large");
  }
  return rows.map((row: Readonly<{ payload: unknown }>) =>
    message.parse(row.payload)
  );
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable eslint/max-statements -- validatePrefix: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
/* oxlint-disable eslint/no-magic-numbers -- validatePrefix: These bounded prototype limits, ordinals and fixture identities are part of the exercised storage protocol. */
// A bounded neutral prototype format, NOT a claimed public EVE seed schema.
const validatePrefix = (messages: readonly DeepReadonly<Message>[]): void => {
  if (
    messages.length > MAX_PREFIX_MESSAGES ||
    Buffer.byteLength(JSON.stringify(messages)) > MAX_PREFIX_BYTES
  ) {
    throw new Error("prefix too large");
  }
  const pending = new Set<string>();
  const used = new Set<string>();
  for (const item of messages) {
    for (const messagePart of item.parts) {
      if (messagePart.type === "call") {
        if (item.role !== "assistant" || used.has(messagePart.id)) {
          throw new Error("invalid tool call");
        }
        pending.add(messagePart.id);
        used.add(messagePart.id);
      } else if (messagePart.type === "result") {
        if (item.role !== "tool" || !pending.delete(messagePart.id)) {
          throw new Error("unpaired result");
        }
      } else if (pending.size > 0 && item.role !== "assistant") {
        throw new Error("unresolved tool boundary");
      }
    }
  }
  if (pending.size > 0) {
    throw new Error("unresolved tool boundary");
  }
};
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve requireResources's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-params -- requireResources: Existing callers and library callbacks use this positional signature; changing it requires an API migration. */
/* oxlint-disable eslint/no-magic-numbers -- requireResources: These bounded prototype limits, ordinals and fixture identities are part of the exercised storage protocol. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- requireResources: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
const requireResources = async (
  sql: DB,
  owner: string,
  ids: string[],
  kind: "file" | "document"
): Promise<void> => {
  if (ids.length === 0) {
    return;
  }
  const rows =
    await sql`select id from resource where id in ${sql(ids)} and owner=${owner} and kind=${kind}`;
  if (rows.length !== new Set(ids).size) {
    throw new Error("resource not owned");
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve append's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-params */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- append: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
const append = async (
  sql: Sql,
  input: DeepReadonly<{
    owner: string;
    branch: string;
    expectedHead: string | null;
    id: string;
    message: Message;
  }>
): Promise<void> => {
  const parsed = message.parse(input.message);
  const { annotation, ...payload } = parsed;
  await sql.begin(async (tx) => {
    const ownedBranchRecord = await ownedBranch(tx, input.owner, input.branch);
    await requireResources(
      tx,
      input.owner,
      payload.parts.flatMap((messagePart) =>
        messagePart.type === "file" ? [messagePart.object] : []
      ),
      "file"
    );
    if (hasBarrier(ownedBranchRecord.barrier)) {
      throw new Error("capture barrier");
    }
    if (ownedBranchRecord.head !== input.expectedHead) {
      throw new Error("stale head");
    }
    await tx`insert into node (id,owner,previous,payload) values (${input.id},${input.owner},${ownedBranchRecord.head},${tx.json(payload)})`;
    if (annotation) {
      await tx`insert into annotation (node,owner,payload) values (${input.id},${input.owner},${tx.json(annotation)})`;
    }
    await tx`update branch set head=${input.id} where id=${ownedBranchRecord.id}`;
  });
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve editDocument's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable eslint/max-params -- editDocument: Existing callers and library callbacks use this positional signature; changing it requires an API migration. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- editDocument: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
const editDocument = async (
  sql: Sql,
  owner: string,
  branch: string,
  revisions: Readonly<Record<string, string>>
): Promise<void> => {
  await sql.begin(async (tx) => {
    const ownedBranchRecord = await ownedBranch(tx, owner, branch);
    if (hasBarrier(ownedBranchRecord.barrier)) {
      throw new Error("capture barrier");
    }
    await requireResources(tx, owner, Object.values(revisions), "document");
    await tx`update branch set documents=${tx.json(revisions)} where id=${ownedBranchRecord.id}`;
  });
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve beginWriter's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/max-params */

/* oxlint-disable eslint/max-params -- beginWriter: Existing callers and library callbacks use this positional signature; changing it requires an API migration. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- beginWriter: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
const beginWriter = async (
  sql: Sql,
  owner: string,
  branch: string,
  id: string,
  kind: string
): Promise<void> => {
  await sql.begin(async (tx) => {
    const ownedBranchRecord = await ownedBranch(tx, owner, branch);
    if (hasBarrier(ownedBranchRecord.barrier)) {
      throw new Error("capture barrier");
    }
    await tx`insert into writer (id,branch,kind) values (${id},${branch},${kind})`;
  });
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve endWriter's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/max-params */

/* oxlint-disable eslint/max-params -- endWriter: Existing callers and library callbacks use this positional signature; changing it requires an API migration. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- endWriter: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
const endWriter = async (
  sql: Sql,
  owner: string,
  branch: string,
  id: string
): Promise<void> => {
  await sql.begin(async (tx) => {
    await ownedBranch(tx, owner, branch);
    await tx`delete from writer where id=${id} and branch=${branch}`;
  });
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve reserve's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/max-params */

/* oxlint-disable eslint/max-statements -- reserve: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
/* oxlint-disable eslint/no-magic-numbers -- reserve: These bounded prototype limits, ordinals and fixture identities are part of the exercised storage protocol. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- reserve: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
// Durable steps may retry this operation. The operation identity fixes the first
// admitted boundary; retry never resamples documents or the live sandbox.
const reserve = async (
  sql: Sql,
  input: Readonly<{ owner: string; source: string; id: string; intent: string }>
): Promise<void> => {
  await sql.begin(async (tx) => {
    const ownedBranchRecord = await ownedBranch(tx, input.owner, input.source);
    const existingRows = await tx<
      Checkpoint[]
    >`select * from checkpoint where id=${input.id}`;
    if (existingRows.length > 0) {
      const [existing] = existingRows;
      if (
        existing.owner !== input.owner ||
        existing.source !== input.source ||
        existing.intent !== input.intent
      ) {
        throw new Error("conflicting operation");
      }
      return;
    }
    if (hasBarrier(ownedBranchRecord.barrier)) {
      throw new Error("capture barrier");
    }
    const active =
      await tx`select id from writer where branch=${ownedBranchRecord.id}`;
    if (active.length > 0) {
      throw new Error("writers not drained");
    }
    validatePrefix(await history(tx, input.owner, ownedBranchRecord.head));
    await tx`insert into checkpoint (id,owner,source,intent,head,documents,sandbox,status)
      values (${input.id},${input.owner},${ownedBranchRecord.id},${input.intent},${ownedBranchRecord.head},${tx.json(ownedBranchRecord.documents)},${ownedBranchRecord.sandbox},'pending')`;
    await tx`update branch set barrier=${input.id} where id=${ownedBranchRecord.id}`;
  });
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-statements */

interface SnapshotProvider {
  // Stronger than Vercel snapshot(): replay/lookup by caller key is REQUIRED.
  capture: (key: string, sandbox: string) => Promise<void>;
  restore: (key: string, sandbox: string) => Promise<void>;
}

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve complete's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/max-statements -- complete: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
/* oxlint-disable eslint/max-params -- complete: Existing callers and library callbacks use this positional signature; changing it requires an API migration. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- complete: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
const complete = async (
  sql: Sql,
  provider: Readonly<SnapshotProvider>,
  owner: string,
  id: string,
  afterRestore?: () => void
): Promise<void> => {
  const [checkpoint] = await sql<
    Checkpoint[]
  >`select * from checkpoint where id=${id} and owner=${owner}`;
  if (checkpoint?.owner !== owner) {
    throw new Error("not owned");
  }
  if (checkpoint.status === "ready") {
    return;
  }
  if (checkpoint.source === null || checkpoint.source === "") {
    throw new Error("source missing");
  }
  const { source } = checkpoint;
  try {
    await provider.capture(id, checkpoint.sandbox);
    // Snapshot stops the original VM. Reopen parent before releasing admission.
    await provider.restore(id, `parent:${id}`);
    afterRestore?.();
    await sql.begin(async (tx) => {
      const ownedBranchRecord = await ownedBranch(tx, owner, source);
      const [current] = await tx<
        Checkpoint[]
      >`select * from checkpoint where id=${id} for update`;
      if (current?.status === "ready") {
        return;
      }
      if (ownedBranchRecord.barrier !== id) {
        throw new Error("lost barrier");
      }
      await tx`update checkpoint set status='ready', error=null where id=${id}`;
      await tx`update branch set sandbox=${`parent:${id}`}, barrier=null where id=${ownedBranchRecord.id}`;
    });
  } catch (error) {
    await sql`update checkpoint set status='failed', error=${String(error)} where id=${id} and status <> 'ready'`;
    // Keep the barrier: a provider error/timeout is not evidence of no effect.
    throw error;
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve fork's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/max-params */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/no-magic-numbers -- fork: These bounded prototype limits, ordinals and fixture identities are part of the exercised storage protocol. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- fork: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
const fork = async (
  sql: Sql,
  provider: Readonly<SnapshotProvider>,
  input: Readonly<{ owner: string; checkpoint: string; child: string }>
): Promise<void> => {
  const [checkpoint] = await sql<
    Checkpoint[]
  >`select * from checkpoint where id=${input.checkpoint} and owner=${input.owner} and status='ready'`;
  if (checkpoint?.status !== "ready") {
    throw new Error("checkpoint not ready or not owned");
  }
  await sql.begin(async (tx) => {
    const prior =
      await tx`select id from child_request where id=${input.child}`;
    const branch = await tx`select id from branch where id=${input.child}`;
    if (prior.length === 0 && branch.length > 0) {
      throw new Error("child already exists");
    }
    await tx`insert into child_request (id,owner,checkpoint) values (${input.child},${input.owner},${checkpoint.id}) on conflict do nothing`;
    const [request] = await tx<
      { owner: string; checkpoint: string; deleted: boolean }[]
    >`select owner,checkpoint,deleted from child_request where id=${input.child} for update`;
    if (
      request?.owner !== input.owner ||
      request.checkpoint !== checkpoint.id ||
      request.deleted
    ) {
      throw new Error("conflicting child");
    }
  });
  // Deterministic child identity + provider replay protects the allocation gap.
  const sandbox = `child:${input.child}`;
  await provider.restore(checkpoint.id, sandbox);
  await sql.begin(async (tx) => {
    const [request] = await tx<
      { deleted: boolean }[]
    >`select deleted from child_request where id=${input.child} for update`;
    if (request?.deleted ?? true) {
      throw new Error("child deleted");
    }
    await tx`insert into branch (id,owner,head,documents,sandbox)
      values (${input.child},${input.owner},${checkpoint.head},${tx.json(checkpoint.documents)},${sandbox}) on conflict do nothing`;
    const ownedBranchRecord = await ownedBranch(tx, input.owner, input.child);
    if (ownedBranchRecord.owner !== input.owner) {
      throw new Error("conflicting child");
    }
  });
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve removeBranch's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable eslint/no-magic-numbers -- removeBranch: These bounded prototype limits, ordinals and fixture identities are part of the exercised storage protocol. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- removeBranch: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
/** Retention proof only: keep immutable nodes/resources/checkpoints for children.
 * Production needs reachability GC + per-owner retention/deletion policy.
 * @param {Sql} sql - Connection owning the deletion transaction.
 * @param {string} owner - Tenant whose branch may be removed.
 * @param {string} branch - Branch identity to remove without deleting retained resources.
 */
const removeBranch = async (
  sql: Sql,
  owner: string,
  branch: string
): Promise<void> => {
  await sql.begin(async (tx) => {
    await tx`select id from child_request where id=${branch} for update`;
    const ownedBranchRecord = await ownedBranch(tx, owner, branch);
    const writers =
      await tx`select id from writer where branch=${ownedBranchRecord.id}`;
    if (hasBarrier(ownedBranchRecord.barrier) || writers.length > 0) {
      throw new Error("branch busy");
    }
    await tx`update child_request set deleted=true where id=${ownedBranchRecord.id}`;
    await tx`delete from branch where id=${ownedBranchRecord.id}`;
  });
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve writeFile's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable eslint/no-magic-numbers -- writeFile: These bounded prototype limits, ordinals and fixture identities are part of the exercised storage protocol. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- writeFile: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
/**
 * Write through an admitted writer token that outlives the OS process/job.
 * @param {Sql} sql - Connection owning the writer validation and update transaction.
 * @param {Readonly<{ owner: string; branch: string; writer: string; path: string; bytes: string; }>} input - Owner, branch, writer token, and file contents for the update.
 */
const writeFile = async (
  sql: Sql,
  input: Readonly<{
    owner: string;
    branch: string;
    writer: string;
    path: string;
    bytes: string;
  }>
): Promise<void> => {
  await sql.begin(async (tx) => {
    const ownedBranchRecord = await ownedBranch(tx, input.owner, input.branch);
    const tokens =
      await tx`select id from writer where id=${input.writer} and branch=${ownedBranchRecord.id}`;
    if (hasBarrier(ownedBranchRecord.barrier) || tokens.length === 0) {
      throw new Error("writer not admitted");
    }
    const updated =
      await tx`update provider_vm set files=files || ${tx.json({ [input.path]: input.bytes })} where id=${ownedBranchRecord.sandbox} and not stopped returning id`;
    if (updated.length === 0) {
      throw new Error("VM stopped");
    }
  });
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve modelHistory's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- modelHistory: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
/**
 * Produce a model transcript without application annotations.
 * @param {DB} sql - Connection used to read the immutable message prefix.
 * @param {string} owner - Tenant whose message nodes may be read.
 * @param {string | null} head - Last node in the prefix, or null for an empty history.
 * @returns {Promise<Pick<Message, "parts" | "role">[]>} Ordered message roles and parts without application annotations.
 */
const modelHistory = async (
  sql: DB,
  owner: string,
  head: string | null
): Promise<Pick<Message, "parts" | "role">[]> => {
  const messages = await history(sql, owner, head);
  return messages.map(({ parts, role }) => ({ parts, role }));
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-lines -- modelHistory: This module is one coordinated protocol/lifecycle implementation; splitting requires an ownership and public API decision. */
export {
  append,
  beginWriter,
  complete,
  editDocument,
  endWriter,
  fork,
  history,
  message,
  modelHistory,
  removeBranch,
  reserve,
  validatePrefix,
  writeFile,
};
export type { Message, SnapshotProvider };
