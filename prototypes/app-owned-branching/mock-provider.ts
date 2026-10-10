import type { SnapshotProvider, SqlConnection, SqlQueries } from "./model";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (mockProvider); the enabled import/no-default-export convention rejects the default-export alternative. */

/* oxlint-disable typescript/strict-boolean-expressions -- Postgres returns an empty row array for missing records, while its RowList iterator declares nonnullable elements; preserve the missing-row guards and stopped-VM check. */
/**
 * Simulate the provider contract with deterministic database-backed snapshots.
 * @param {SqlConnection} sql - Connection used to persist mock VM and snapshot state.
 * @returns {SnapshotProvider} A replay-safe snapshot provider for the branching prototype.
 */
export const mockProvider = (sql: SqlConnection): SnapshotProvider => ({
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve capture's awaited sequencing and rejected-Promise behavior. */
  async capture(key, sandbox) {
    await sql.begin(async (tx: SqlQueries) => {
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
    await sql.begin(async (tx: SqlQueries) => {
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
