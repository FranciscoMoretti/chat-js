import { expect, test } from "vitest";

import { createEveLifecycleProvider } from "./provider";

test("managed and unknown worlds never advertise native erasure", () => {
  for (const world of ["vercel", "custom-world"]) {
    const provider = createEveLifecycleProvider({ world });
    expect(provider.supported).toBe(false);
    expect(provider).not.toHaveProperty("purge");
  }
});

test("PostgreSQL requires a configured database and excludes sandbox erasure", () => {
  expect(
    createEveLifecycleProvider({ world: "@workflow/world-postgres" }).supported
  ).toBe(false);
  const provider = createEveLifecycleProvider({
    databaseUrl: "postgres://localhost/native_test",
    world: "@workflow/world-postgres",
  });
  expect(provider.supported).toBe(true);
  if (!provider.supported) {
    throw new Error(provider.reason);
  }
  expect(provider.capabilities).toEqual({
    durableRetirement: true,
    lateWriteFence: true,
    payloadPurge: true,
    queuePurge: true,
    sandboxLifecycle: false,
  });
});
