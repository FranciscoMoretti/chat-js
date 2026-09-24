import type { Sql } from "postgres";

import type { SnapshotProvider } from "./model";

/** Deterministic provider contract simulator, not an implementation of EVE SandboxBackend. */
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
