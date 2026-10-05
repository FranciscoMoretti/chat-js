import type { Sql } from "postgres";

import type { SnapshotProvider } from "./model";

/* oxlint-disable typescript/prefer-readonly-parameter-types -- mockProvider: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
/* oxlint-disable typescript/strict-boolean-expressions -- mockProvider: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
/**
 * Simulate the provider contract with deterministic database-backed snapshots.
 * @param {Sql} sql - Connection used to persist mock VM and snapshot state.
 * @returns {SnapshotProvider} A replay-safe snapshot provider for the branching prototype.
 */
export const mockProvider = (sql: Sql): SnapshotProvider => ({
  async capture(key, sandbox) {
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
  async restore(key, sandbox) {
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
});
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
