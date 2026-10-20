import { afterAll, expect, test, vi } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "../lib/db/client";
import { env } from "../lib/env";
import { evePersistentSandbox, eveSandboxSession } from "../lib/db/schema";
import { assertEveTestDatabase } from "./eve-test-database";
import {
  reservePersistentSandbox,
  accessPersistentSandbox,
  retirePersistentSession,
  cleanupPersistentSession,
  stopDevelopmentPersistentSandboxes,
} from "../lib/eve/persistent-sandbox-store";

assertEveTestDatabase(env.DATABASE_URL);
const scope = {
  providerId: "vercel",
  accountId: "fixture",
  scopeId: "fixture",
};
const resolver = (operation: (name: string) => Promise<void>) => () => ({
  scope,
  persistent: { stop: operation, deleteAndConfirmAbsent: operation },
});
const sessions: string[] = [];
const identity = () => {
  const sessionId = crypto.randomUUID();
  sessions.push(sessionId);
  return {
    sessionId,
    rootSessionId: sessionId,
    ownerId: "fixture",
    devRunId: crypto.randomUUID(),
  };
};
afterAll(async () => {
  await db
    .delete(evePersistentSandbox)
    .where(inArray(evePersistentSandbox.sessionId, sessions));
  await db
    .delete(eveSandboxSession)
    .where(inArray(eveSandboxSession.sessionId, sessions));
});
test("interrupted creation stays unknown even after retirement; no missing lookup clears it", async () => {
  const id = identity();
  const allocation = await reservePersistentSandbox(id, scope);
  await expect(reservePersistentSandbox(id, scope)).rejects.toThrow(
    "unresolved"
  );
  await retirePersistentSession(id);
  const remove = vi.fn();
  await expect(cleanupPersistentSession(id, resolver(remove))).rejects.toThrow(
    "uncertain"
  );
  expect(remove).not.toHaveBeenCalled();
  expect(allocation.create).toBe(true);
});
test("known create can resume without reallocation; wrong scopes and retired cached handles fail", async () => {
  const id = identity();
  const allocation = await reservePersistentSandbox(id, scope);
  await accessPersistentSandbox(
    id,
    scope,
    allocation.name,
    async () => {
      await Promise.resolve();
    },
    true
  );
  expect(await reservePersistentSandbox(id, scope)).toEqual({
    name: allocation.name,
    create: false,
  });
  await expect(
    reservePersistentSandbox(id, { ...scope, scopeId: "foreign" })
  ).rejects.toThrow("replacement");
  const operation = vi.fn();
  await expect(
    accessPersistentSandbox(
      id,
      { ...scope, scopeId: "foreign" },
      allocation.name,
      operation
    )
  ).rejects.toThrow("scope changed");
  await retirePersistentSession(id);
  await expect(
    accessPersistentSandbox(id, scope, allocation.name, operation)
  ).rejects.toThrow("retired");
  expect(operation).not.toHaveBeenCalled();
  const remove = vi.fn(async () => {
    await Promise.resolve();
  });
  await cleanupPersistentSession(id, resolver(remove));
  await cleanupPersistentSession(id, resolver(remove));
  expect(remove).toHaveBeenCalledExactlyOnceWith(allocation.name);
});
test("retirement waits for an in-flight provider operation before allowing deletion", async () => {
  const id = identity();
  const allocation = await reservePersistentSandbox(id, scope);
  await accessPersistentSandbox(
    id,
    scope,
    allocation.name,
    async () => {
      await Promise.resolve();
    },
    true
  );
  const entered = Promise.withResolvers<boolean>();
  const release = Promise.withResolvers<boolean>();
  const order: string[] = [];
  const writer = accessPersistentSandbox(
    id,
    scope,
    allocation.name,
    async () => {
      entered.resolve(true);
      await release.promise;
      order.push("writer settled");
    }
  );
  await entered.promise;
  const retired = (async () => {
    await retirePersistentSession(id);
    order.push("retired");
  })();
  release.resolve(true);
  await Promise.all([writer, retired]);
  await cleanupPersistentSession(
    id,
    resolver(async () => {
      await Promise.resolve();
      order.push("deleted");
    })
  );
  expect(order).toEqual(["writer settled", "retired", "deleted"]);
});
test("shutdown stops only its dev run and retains files/ownership for resume", async () => {
  const id = identity();
  const allocation = await reservePersistentSandbox(id, scope);
  await accessPersistentSandbox(
    id,
    scope,
    allocation.name,
    async () => {
      await Promise.resolve();
    },
    true
  );
  const stop = vi.fn(async () => {
    await Promise.resolve();
  });
  await stopDevelopmentPersistentSandboxes("another-run", resolver(stop));
  expect(stop).not.toHaveBeenCalled();
  await stopDevelopmentPersistentSandboxes(id.devRunId, resolver(stop));
  expect(stop).toHaveBeenCalledExactlyOnceWith(allocation.name);
  const resumed = await reservePersistentSandbox(id, scope);
  expect(resumed.create).toBe(false);
});

test("an unresolved allocation does not prevent stopping other sessions in the run", async () => {
  const unresolved = identity();
  await reservePersistentSandbox(unresolved, scope);
  const ready = { ...identity(), devRunId: unresolved.devRunId };
  const allocation = await reservePersistentSandbox(ready, scope);
  await accessPersistentSandbox(
    ready,
    scope,
    allocation.name,
    async () => {
      await Promise.resolve();
    },
    true
  );
  const stop = vi.fn<() => Promise<void>>().mockResolvedValue();
  await expect(
    stopDevelopmentPersistentSandboxes(unresolved.devRunId, resolver(stop))
  ).rejects.toThrow("Uncertain");
  expect(stop).toHaveBeenCalledExactlyOnceWith(allocation.name);
  stop.mockClear();
  await expect(
    stopDevelopmentPersistentSandboxes(unresolved.devRunId, resolver(stop))
  ).rejects.toThrow("Uncertain");
  expect(stop).not.toHaveBeenCalled();
});
test("retiring a root blocks a child's cached handles and new allocations", async () => {
  const root = identity();
  const child = { ...identity(), rootSessionId: root.sessionId };
  const allocation = await reservePersistentSandbox(child, scope);
  await accessPersistentSandbox(
    child,
    scope,
    allocation.name,
    async () => {
      await Promise.resolve();
    },
    true
  );
  await retirePersistentSession(root);
  await expect(
    accessPersistentSandbox(child, scope, allocation.name, async () => {
      await Promise.resolve();
    })
  ).rejects.toThrow("retired");
});

test("empty and already deleted sessions require no provider, but owned resources do", async () => {
  const id = identity();
  const missing = vi.fn((): never => {
    throw new Error("No provider installed");
  });
  await retirePersistentSession(id);
  await cleanupPersistentSession(id, missing);
  await stopDevelopmentPersistentSandboxes(id.devRunId, missing);
  expect(missing).not.toHaveBeenCalled();

  const owned = identity();
  const allocation = await reservePersistentSandbox(owned, scope);
  await accessPersistentSandbox(
    owned,
    scope,
    allocation.name,
    async () => {
      await Promise.resolve();
    },
    true
  );
  await expect(
    stopDevelopmentPersistentSandboxes(owned.devRunId, missing)
  ).rejects.toThrow("No provider");
  await retirePersistentSession(owned);
  await expect(cleanupPersistentSession(owned, missing)).rejects.toThrow(
    "No provider"
  );
  const wrong = () => ({
    ...resolver(async () => {
      await Promise.resolve();
    })(),
    scope: { ...scope, scopeId: "foreign" },
  });
  await expect(cleanupPersistentSession(owned, wrong)).rejects.toThrow(
    "scope changed"
  );
  await cleanupPersistentSession(
    owned,
    resolver(async () => {
      await Promise.resolve();
    })
  );
  missing.mockClear();
  await cleanupPersistentSession(owned, missing);
  expect(missing).not.toHaveBeenCalled();
});
