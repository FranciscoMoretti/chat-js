import type {
  LifecycleInventory,
  SupportedLifecycleProvider,
} from "@/lib/eve/lifecycle/provider";
import {
  prepareEveNativeSessionPurge,
  purgeEveNativeSession,
  retireEveNativeSessions,
} from "./eve-native-purge";
import { assertPostgresLifecycleCompatibility } from "./compatibility";
import postgres from "postgres";
import { readEvePostgresRunInventory } from "./eve-run-inventory";

const taskIdentifier = "workflow_flows";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve check's awaited sequencing and rejected-Promise behavior. */
const createCompatibilityCheck =
  (databaseUrl: string): (() => Promise<void>) =>
  async (): Promise<void> => {
    const connection = postgres(databaseUrl, { max: 1 });
    try {
      await assertPostgresLifecycleCompatibility(connection);
    } finally {
      await connection.end();
    }
  };
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable oxc/no-async-await -- Inventory reads complete before the original connection is closed in finally. */
const createInventoryReader =
  (databaseUrl: string): ((sessionId: string) => Promise<LifecycleInventory>) =>
  async (sessionId: string): Promise<LifecycleInventory> => {
    const connection = postgres(databaseUrl, { max: 1 });
    try {
      await assertPostgresLifecycleCompatibility(connection);
      const inventory = await readEvePostgresRunInventory(
        connection,
        sessionId
      );
      return {
        activeRunIds: inventory.activeRunIds,
        ambiguousStreamIds: inventory.ambiguousStreamIds,
        missingRunIds: inventory.missingRunIds,
        runIds: inventory.runs.map((run) => run.id),
        streamIds: inventory.streamIds,
      };
    } finally {
      await connection.end();
    }
  };
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (createPostgresLifecycle); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export const createPostgresLifecycle = (
  databaseUrl: string
): SupportedLifecycleProvider => {
  const check = createCompatibilityCheck(databaseUrl);
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this return statement's awaited sequencing and rejected-Promise behavior. */
  return {
    capabilities: {
      durableRetirement: true,
      lateWriteFence: true,
      payloadPurge: true,
      queuePurge: true,
      sandboxLifecycle: false,
    },
    check,
    contractVersion: "1",
    inventory: createInventoryReader(databaseUrl),
    prepare: async (sessionId, retireAndSettle) => {
      await check();
      return await prepareEveNativeSessionPurge(
        databaseUrl,
        { sessionId, taskIdentifier },
        retireAndSettle
      );
    },
    purge: async (sessionId, retireAndSettle) => {
      await check();
      return await purgeEveNativeSession(
        databaseUrl,
        { sessionId, taskIdentifier },
        retireAndSettle
      );
    },
    retire: async (sessionIds, retireAndSettle) => {
      await check();
      await retireEveNativeSessions(
        databaseUrl,
        [...sessionIds],
        retireAndSettle
      );
    },
    supported: true,
    world: "@workflow/world-postgres",
  };
  /* oxlint-enable oxc/no-async-await */
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
