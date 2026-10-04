import postgres from "postgres";
import { afterAll, expect, test, vi } from "vitest";

import { env } from "@/lib/env";
import { createEveLifecycleProvider } from "@/lib/eve/lifecycle/provider";

import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);
const connection = postgres(env.DATABASE_URL, { max: 1 });
const provider = createEveLifecycleProvider({
  databaseUrl: env.DATABASE_URL,
  world: "@workflow/world-postgres",
});
if (!provider.supported) {
  throw new Error(provider.reason);
}
const lifecycle = provider;
afterAll(async () => {
  await connection.end();
});

test("setup installs the supported native lifecycle contract", async () => {
  await expect(lifecycle.check()).resolves.toBeUndefined();
});

test("a provider schema upgrade refuses retirement before side effects", async () => {
  const retire = vi
    .fn<() => Promise<void>>()
    .mockRejectedValue(new Error("Retirement must not run"));
  const future = "9999999999999";
  await connection`insert into workflow_drizzle.workflow_migrations (hash, created_at) values ('unsupported-test', ${future})`;
  try {
    await expect(
      lifecycle.retire([crypto.randomUUID()], retire)
    ).rejects.toThrow("Unsupported workflow lifecycle schema version");
    expect(retire).not.toHaveBeenCalled();
  } finally {
    await connection`delete from workflow_drizzle.workflow_migrations where hash = 'unsupported-test' and created_at = ${future}`;
  }
});

test("disabled queue fences refuse cleanup before retirement", async () => {
  const retire = vi
    .fn<() => Promise<void>>()
    .mockRejectedValue(new Error("Retirement must not run"));
  await connection`alter table graphile_worker._private_jobs disable trigger eve_queue_fence`;
  try {
    await expect(
      lifecycle.prepare(crypto.randomUUID(), retire)
    ).rejects.toThrow("Workflow lifecycle fences are missing or disabled");
    expect(retire).not.toHaveBeenCalled();
  } finally {
    await connection`alter table graphile_worker._private_jobs enable trigger eve_queue_fence`;
  }
});
