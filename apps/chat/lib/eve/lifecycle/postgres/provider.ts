import postgres from "postgres";

import type {
  LifecycleInventory,
  SupportedLifecycleProvider,
} from "@/lib/eve/lifecycle/provider";

import { assertPostgresLifecycleCompatibility } from "./compatibility";
import {
  prepareEveNativeSessionPurge,
  purgeEveNativeSession,
  retireEveNativeSessions,
} from "./eve-native-purge";
import { readEvePostgresRunInventory } from "./eve-run-inventory";

const taskIdentifier = "workflow_flows";

/* oxlint-disable eslint/max-lines-per-function -- Keep the small provider operations together so the compatibility gate is visible at every entrypoint. */
export const createPostgresLifecycle = (
  databaseUrl: string
): SupportedLifecycleProvider => {
  const check = async (): Promise<void> => {
    const connection = postgres(databaseUrl, { max: 1 });
    try {
      await assertPostgresLifecycleCompatibility(connection);
    } finally {
      await connection.end();
    }
  };
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
    inventory: async (sessionId): Promise<LifecycleInventory> => {
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
    },
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
};
