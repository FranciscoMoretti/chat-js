import type { Sql } from "postgres";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { SnapshotProvider } from "./model";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (mockProvider); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable sort-imports */

/* oxlint-disable typescript/strict-boolean-expressions -- mockProvider: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
/**
 * Simulate the provider contract with deterministic database-backed snapshots.
 * @param {Sql} sql - Connection used to persist mock VM and snapshot state.
 * @returns {SnapshotProvider} A replay-safe snapshot provider for the branching prototype.
 */
export const mockProvider = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- This provider opens the owner transaction with native sql.begin() and writes snapshot/VM rows through that transaction.
  sql: Sql
): SnapshotProvider => ({
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve capture's awaited sequencing and rejected-Promise behavior. */
  async capture(key, sandbox) {
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- This native transaction callback inserts the provider snapshot and updates the VM row through tx.
    await sql.begin(async (tx) => {
      const [vm] = await tx<
        { files: Record<string, string>; stopped: boolean }[]
      >`select * from provider_vm where id=${sandbox} for update`;
      const [existing] = await tx<
        { source: string }[]
      >`select source from provider_snapshot where id=${key}`;
      if (existing) {
        if (existing.source !== sandbox) {
          throw new Error("snapshot key conflict");
        }
        return;
      }
      if (!vm || vm.stopped) {
        throw new Error("VM unavailable");
      }
      await tx`insert into provider_snapshot (id,source,files) values (${key},${sandbox},${tx.json(vm.files)})`;
      await tx`update provider_vm set stopped=true where id=${sandbox}`;
    });
  },
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve restore's awaited sequencing and rejected-Promise behavior. */
  async restore(key, sandbox) {
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- This native transaction callback inserts the provider VM row through tx.
    await sql.begin(async (tx) => {
      const [snapshot] = await tx<
        { files: Record<string, string> }[]
      >`select files from provider_snapshot where id=${key}`;
      if (!snapshot) {
        throw new Error("snapshot absent");
      }
      await tx`insert into provider_vm (id,files) values (${sandbox},${tx.json(snapshot.files)}) on conflict do nothing`;
    });
  },
  /* oxlint-enable oxc/no-async-await */
});
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable typescript/strict-boolean-expressions */
