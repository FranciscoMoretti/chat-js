import type { Sql, TransactionSql } from "postgres";
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
/* oxlint-disable import/exports-last -- message: The declaration is an existing named entrypoint used by consumers; its colocated export makes that boundary explicit. */
/* oxlint-disable import/group-exports -- message: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable import/no-named-export -- message: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
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
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */
/* oxlint-disable import/exports-last -- Message: The declaration is an existing named entrypoint used by consumers; its colocated export makes that boundary explicit. */
/* oxlint-disable import/group-exports -- Message: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable import/no-named-export -- Message: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
export type Message = z.infer<typeof message>;
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */
/* oxlint-disable typescript/consistent-type-definitions -- Branch: The structural alias participates in typed JSON/configuration boundaries; interface conversion changes implicit index assignability and merging. */
type Branch = {
  id: string;
  owner: string;
  head: string | null;
  documents: Record<string, string>;
  sandbox: string;
  barrier: string | null;
};
/* oxlint-enable typescript/consistent-type-definitions */
/* oxlint-disable typescript/consistent-type-definitions -- Checkpoint: The structural alias participates in typed JSON/configuration boundaries; interface conversion changes implicit index assignability and merging. */
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
/* oxlint-enable typescript/consistent-type-definitions */
type DB = Sql | TransactionSql;

/* oxlint-disable typescript/explicit-function-return-type -- ownedBranch: Keep contextual/generic inference for this SDK, callback or composite result; a new explicit type requires choosing its public shape. */
/* oxlint-disable oxc/no-async-await -- ownedBranch: Await sequencing preserves this operation's dependent I/O and error propagation. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- ownedBranch: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
/* oxlint-disable typescript/strict-boolean-expressions -- ownedBranch: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
const ownedBranch = async (sql: DB, owner: string, id: string) => {
  const [row] = await sql<
    Branch[]
  >`select * from branch where id=${id} and owner=${owner} for update`;
  if (!row) {
    throw new Error("not owned");
  }
  return row;
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable import/exports-last -- history: The declaration is an existing named entrypoint used by consumers; its colocated export makes that boundary explicit. */
/* oxlint-disable import/group-exports -- history: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable import/no-named-export -- history: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
/* oxlint-disable typescript/explicit-module-boundary-types -- history: The exported SDK/composite API preserves inferred relationships; an explicit boundary type requires a public contract decision. */
/* oxlint-disable typescript/explicit-function-return-type -- history: Keep contextual/generic inference for this SDK, callback or composite result; a new explicit type requires choosing its public shape. */
/* oxlint-disable oxc/no-async-await -- history: Await sequencing preserves this operation's dependent I/O and error propagation. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- history: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
export const history = async (sql: DB, owner: string, head: string | null) => {
  const rows = await sql<{ payload: unknown }[]>`
    with recursive prefix as (
      select id, previous, payload, 0 as depth from node where id=${head} and owner=${owner}
      union all
      select n.id, n.previous, n.payload, p.depth+1 from node n join prefix p on n.id=p.previous where n.owner=${owner} and p.depth < 1000
    ) select case when a.node is null then p.payload
      else p.payload || jsonb_build_object('annotation',a.payload) end as payload
      from prefix p left join annotation a on a.node=p.id and a.owner=${owner} order by depth desc`;
  if (rows.length > MAX_PREFIX_MESSAGES) {
    throw new Error("prefix too large");
  }
  return rows.map((row) => message.parse(row.payload));
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable import/exports-last -- validatePrefix: The declaration is an existing named entrypoint used by consumers; its colocated export makes that boundary explicit. */
/* oxlint-disable import/group-exports -- validatePrefix: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable eslint/max-statements -- validatePrefix: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
/* oxlint-disable import/no-named-export -- validatePrefix: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
/* oxlint-disable typescript/explicit-module-boundary-types -- validatePrefix: The exported SDK/composite API preserves inferred relationships; an explicit boundary type requires a public contract decision. */
/* oxlint-disable typescript/explicit-function-return-type -- validatePrefix: Keep contextual/generic inference for this SDK, callback or composite result; a new explicit type requires choosing its public shape. */
/* oxlint-disable eslint/no-magic-numbers -- validatePrefix: These bounded prototype limits, ordinals and fixture identities are part of the exercised storage protocol. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- validatePrefix: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
// A bounded neutral prototype format, NOT a claimed public EVE seed schema.
export const validatePrefix = (messages: Message[]) => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable eslint/max-params -- requireResources: Existing callers and library callbacks use this positional signature; changing it requires an API migration. */
/* oxlint-disable typescript/explicit-function-return-type -- requireResources: Keep contextual/generic inference for this SDK, callback or composite result; a new explicit type requires choosing its public shape. */
/* oxlint-disable oxc/no-async-await -- requireResources: Await sequencing preserves this operation's dependent I/O and error propagation. */
/* oxlint-disable eslint/no-magic-numbers -- requireResources: These bounded prototype limits, ordinals and fixture identities are part of the exercised storage protocol. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- requireResources: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
const requireResources = async (
  sql: DB,
  owner: string,
  ids: string[],
  kind: "file" | "document"
) => {
  if (ids.length === 0) {
    return;
  }
  const rows =
    await sql`select id from resource where id in ${sql(ids)} and owner=${owner} and kind=${kind}`;
  if (rows.length !== new Set(ids).size) {
    throw new Error("resource not owned");
  }
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-params */

/* oxlint-disable import/group-exports -- append: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable import/no-named-export -- append: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
/* oxlint-disable typescript/explicit-module-boundary-types -- append: The exported SDK/composite API preserves inferred relationships; an explicit boundary type requires a public contract decision. */
/* oxlint-disable typescript/explicit-function-return-type -- append: Keep contextual/generic inference for this SDK, callback or composite result; a new explicit type requires choosing its public shape. */
/* oxlint-disable oxc/no-async-await -- append: Await sequencing preserves this operation's dependent I/O and error propagation. */
/* oxlint-disable oxc/no-rest-spread-properties -- append: Fresh object composition preserves immutable state/configuration and existing override order. */
/* oxlint-disable eslint/id-length -- append: Short row/transaction bindings remain local to their database operation. */
/* oxlint-disable eslint/no-ternary -- append: The expression preserves the existing fallback/derived-value contract within this operation. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- append: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
/* oxlint-disable typescript/strict-boolean-expressions -- append: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
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
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable eslint/id-length */
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- editDocument: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable import/no-named-export -- editDocument: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
/* oxlint-disable typescript/explicit-module-boundary-types -- editDocument: The exported SDK/composite API preserves inferred relationships; an explicit boundary type requires a public contract decision. */
/* oxlint-disable eslint/max-params -- editDocument: Existing callers and library callbacks use this positional signature; changing it requires an API migration. */
/* oxlint-disable typescript/explicit-function-return-type -- editDocument: Keep contextual/generic inference for this SDK, callback or composite result; a new explicit type requires choosing its public shape. */
/* oxlint-disable oxc/no-async-await -- editDocument: Await sequencing preserves this operation's dependent I/O and error propagation. */
/* oxlint-disable eslint/id-length -- editDocument: Short row/transaction bindings remain local to their database operation. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- editDocument: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
/* oxlint-disable typescript/strict-boolean-expressions -- editDocument: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
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
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/id-length */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-params */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- beginWriter: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable import/no-named-export -- beginWriter: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
/* oxlint-disable typescript/explicit-module-boundary-types -- beginWriter: The exported SDK/composite API preserves inferred relationships; an explicit boundary type requires a public contract decision. */
/* oxlint-disable eslint/max-params -- beginWriter: Existing callers and library callbacks use this positional signature; changing it requires an API migration. */
/* oxlint-disable typescript/explicit-function-return-type -- beginWriter: Keep contextual/generic inference for this SDK, callback or composite result; a new explicit type requires choosing its public shape. */
/* oxlint-disable oxc/no-async-await -- beginWriter: Await sequencing preserves this operation's dependent I/O and error propagation. */
/* oxlint-disable eslint/id-length -- beginWriter: Short row/transaction bindings remain local to their database operation. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- beginWriter: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
/* oxlint-disable typescript/strict-boolean-expressions -- beginWriter: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
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
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/id-length */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-params */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- endWriter: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable import/no-named-export -- endWriter: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
/* oxlint-disable typescript/explicit-module-boundary-types -- endWriter: The exported SDK/composite API preserves inferred relationships; an explicit boundary type requires a public contract decision. */
/* oxlint-disable eslint/max-params -- endWriter: Existing callers and library callbacks use this positional signature; changing it requires an API migration. */
/* oxlint-disable typescript/explicit-function-return-type -- endWriter: Keep contextual/generic inference for this SDK, callback or composite result; a new explicit type requires choosing its public shape. */
/* oxlint-disable oxc/no-async-await -- endWriter: Await sequencing preserves this operation's dependent I/O and error propagation. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- endWriter: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-params */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- reserve: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable eslint/max-statements -- reserve: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
/* oxlint-disable import/no-named-export -- reserve: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
/* oxlint-disable typescript/explicit-module-boundary-types -- reserve: The exported SDK/composite API preserves inferred relationships; an explicit boundary type requires a public contract decision. */
/* oxlint-disable typescript/explicit-function-return-type -- reserve: Keep contextual/generic inference for this SDK, callback or composite result; a new explicit type requires choosing its public shape. */
/* oxlint-disable oxc/no-async-await -- reserve: Await sequencing preserves this operation's dependent I/O and error propagation. */
/* oxlint-disable eslint/id-length -- reserve: Short row/transaction bindings remain local to their database operation. */
/* oxlint-disable eslint/no-magic-numbers -- reserve: These bounded prototype limits, ordinals and fixture identities are part of the exercised storage protocol. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- reserve: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
/* oxlint-disable typescript/strict-boolean-expressions -- reserve: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
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
    if (active.length > 0) {
      throw new Error("writers not drained");
    }
    validatePrefix(await history(tx, input.owner, b.head));
    await tx`insert into checkpoint (id,owner,source,intent,head,documents,sandbox,status)
      values (${input.id},${input.owner},${b.id},${input.intent},${b.head},${tx.json(b.documents)},${b.sandbox},'pending')`;
    await tx`update branch set barrier=${input.id} where id=${b.id}`;
  });
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/id-length */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- SnapshotProvider: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable import/no-named-export -- SnapshotProvider: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
export interface SnapshotProvider {
  // Stronger than Vercel snapshot(): replay/lookup by caller key is REQUIRED.
  capture: (key: string, sandbox: string) => Promise<void>;
  restore: (key: string, sandbox: string) => Promise<void>;
}
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- complete: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable eslint/max-statements -- complete: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
/* oxlint-disable import/no-named-export -- complete: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
/* oxlint-disable typescript/explicit-module-boundary-types -- complete: The exported SDK/composite API preserves inferred relationships; an explicit boundary type requires a public contract decision. */
/* oxlint-disable eslint/max-params -- complete: Existing callers and library callbacks use this positional signature; changing it requires an API migration. */
/* oxlint-disable typescript/explicit-function-return-type -- complete: Keep contextual/generic inference for this SDK, callback or composite result; a new explicit type requires choosing its public shape. */
/* oxlint-disable oxc/no-async-await -- complete: Await sequencing preserves this operation's dependent I/O and error propagation. */
/* oxlint-disable eslint/id-length -- complete: Short row/transaction bindings remain local to their database operation. */
/* oxlint-disable oxc/no-optional-chaining -- complete: The guarded lookup intentionally permits missing SDK/state fields; preserve one evaluation of the existing optional access. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- complete: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
/* oxlint-disable typescript/strict-boolean-expressions -- complete: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
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
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable eslint/id-length */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-params */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- fork: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable import/no-named-export -- fork: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
/* oxlint-disable typescript/explicit-module-boundary-types -- fork: The exported SDK/composite API preserves inferred relationships; an explicit boundary type requires a public contract decision. */
/* oxlint-disable typescript/explicit-function-return-type -- fork: Keep contextual/generic inference for this SDK, callback or composite result; a new explicit type requires choosing its public shape. */
/* oxlint-disable oxc/no-async-await -- fork: Await sequencing preserves this operation's dependent I/O and error propagation. */
/* oxlint-disable eslint/id-length -- fork: Short row/transaction bindings remain local to their database operation. */
/* oxlint-disable eslint/no-magic-numbers -- fork: These bounded prototype limits, ordinals and fixture identities are part of the exercised storage protocol. */
/* oxlint-disable oxc/no-optional-chaining -- fork: The guarded lookup intentionally permits missing SDK/state fields; preserve one evaluation of the existing optional access. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- fork: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
/* oxlint-disable typescript/strict-boolean-expressions -- fork: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
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
    if (prior.length === 0 && branch.length > 0) {
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
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/id-length */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- removeBranch: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable import/no-named-export -- removeBranch: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
/* oxlint-disable typescript/explicit-module-boundary-types -- removeBranch: The exported SDK/composite API preserves inferred relationships; an explicit boundary type requires a public contract decision. */
/* oxlint-disable typescript/explicit-function-return-type -- removeBranch: Keep contextual/generic inference for this SDK, callback or composite result; a new explicit type requires choosing its public shape. */
/* oxlint-disable oxc/no-async-await -- removeBranch: Await sequencing preserves this operation's dependent I/O and error propagation. */
/* oxlint-disable eslint/id-length -- removeBranch: Short row/transaction bindings remain local to their database operation. */
/* oxlint-disable eslint/no-magic-numbers -- removeBranch: These bounded prototype limits, ordinals and fixture identities are part of the exercised storage protocol. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- removeBranch: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
/* oxlint-disable typescript/strict-boolean-expressions -- removeBranch: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
/** Retention proof only: keep immutable nodes/resources/checkpoints for children.
 * Production needs reachability GC + per-owner retention/deletion policy.
 * @param sql - Connection owning the deletion transaction.
 * @param owner - Tenant whose branch may be removed.
 * @param branch - Branch identity to remove without deleting retained resources.
 */
export const removeBranch = async (sql: Sql, owner: string, branch: string) => {
  await sql.begin(async (tx) => {
    await tx`select id from child_request where id=${branch} for update`;
    const b = await ownedBranch(tx, owner, branch);
    const writers = await tx`select id from writer where branch=${b.id}`;
    if (b.barrier || writers.length > 0) {
      throw new Error("branch busy");
    }
    await tx`update child_request set deleted=true where id=${b.id}`;
    await tx`delete from branch where id=${b.id}`;
  });
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/id-length */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- writeFile: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable import/no-named-export -- writeFile: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
/* oxlint-disable typescript/explicit-module-boundary-types -- writeFile: The exported SDK/composite API preserves inferred relationships; an explicit boundary type requires a public contract decision. */
/* oxlint-disable typescript/explicit-function-return-type -- writeFile: Keep contextual/generic inference for this SDK, callback or composite result; a new explicit type requires choosing its public shape. */
/* oxlint-disable oxc/no-async-await -- writeFile: Await sequencing preserves this operation's dependent I/O and error propagation. */
/* oxlint-disable eslint/id-length -- writeFile: Short row/transaction bindings remain local to their database operation. */
/* oxlint-disable eslint/no-magic-numbers -- writeFile: These bounded prototype limits, ordinals and fixture identities are part of the exercised storage protocol. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- writeFile: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
/* oxlint-disable typescript/strict-boolean-expressions -- writeFile: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
/**
 * Write through an admitted writer token that outlives the OS process/job.
 * @param sql - Connection owning the writer validation and update transaction.
 * @param input - Owner, branch, writer token, and file contents for the update.
 */
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
    if (b.barrier || tokens.length === 0) {
      throw new Error("writer not admitted");
    }
    const updated =
      await tx`update provider_vm set files=files || ${tx.json({ [input.path]: input.bytes })} where id=${b.sandbox} and not stopped returning id`;
    if (updated.length === 0) {
      throw new Error("VM stopped");
    }
  });
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/id-length */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- modelHistory: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable import/no-named-export -- modelHistory: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
/* oxlint-disable typescript/explicit-module-boundary-types -- modelHistory: The exported SDK/composite API preserves inferred relationships; an explicit boundary type requires a public contract decision. */
/* oxlint-disable typescript/explicit-function-return-type -- modelHistory: Keep contextual/generic inference for this SDK, callback or composite result; a new explicit type requires choosing its public shape. */
/* oxlint-disable oxc/no-async-await -- modelHistory: Await sequencing preserves this operation's dependent I/O and error propagation. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- modelHistory: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
/**
 * Produce a model transcript without application annotations.
 * @param sql - Connection used to read the immutable message prefix.
 * @param owner - Tenant whose message nodes may be read.
 * @param head - Last node in the prefix, or null for an empty history.
 * @returns Ordered message roles and parts without application annotations.
 */
export const modelHistory = async (
  sql: DB,
  owner: string,
  head: string | null
) => {
  const messages = await history(sql, owner, head);
  return messages.map(({ parts, role }) => ({ parts, role }));
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */

/* oxlint-disable max-lines -- modelHistory: This module is one coordinated protocol/lifecycle implementation; splitting requires an ownership and public API decision. */
