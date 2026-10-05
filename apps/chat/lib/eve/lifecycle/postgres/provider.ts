import postgres from "postgres";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  LifecycleInventory,
  SupportedLifecycleProvider,
} from "@/lib/eve/lifecycle/provider";
/* oxlint-enable sort-imports */

import { assertPostgresLifecycleCompatibility } from "./compatibility";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  prepareEveNativeSessionPurge,
  purgeEveNativeSession,
  retireEveNativeSessions,
} from "./eve-native-purge";
/* oxlint-enable sort-imports */
import { readEvePostgresRunInventory } from "./eve-run-inventory";

const taskIdentifier = "workflow_flows";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (createPostgresLifecycle); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the small provider operations together so the compatibility gate is visible at every entrypoint. */
export const createPostgresLifecycle = (
  databaseUrl: string
): SupportedLifecycleProvider => {
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve check's awaited sequencing and rejected-Promise behavior. */
  const check = async (): Promise<void> => {
    const connection = postgres(databaseUrl, { max: 1 });
    try {
      await assertPostgresLifecycleCompatibility(connection);
    } finally {
      await connection.end();
    }
  };
  /* oxlint-enable oxc/no-async-await */
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
  /* oxlint-enable oxc/no-async-await */
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
