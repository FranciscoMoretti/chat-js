interface GatewayCleanupOptions {
  environment: Record<string, string | undefined>;
  originalRegistryUrl: string | undefined;
  removeFiles: () => Promise<void>;
  server: Pick<Bun.Server<unknown>, "stop">;
}

export const cleanupGatewayFixture = async ({
  environment,
  originalRegistryUrl,
  removeFiles,
  server,
}: GatewayCleanupOptions): Promise<void> => {
  const failures: unknown[] = [];

  try {
    let stopping: Promise<void>;
    try {
      stopping = server.stop(true);
    } finally {
      if (originalRegistryUrl === undefined) {
        delete environment.CHATJS_REGISTRY_URL;
      } else {
        environment.CHATJS_REGISTRY_URL = originalRegistryUrl;
      }
    }
    await stopping;
  } catch (error) {
    failures.push(error);
  }

  // Attempt shutdown first, but still remove files if it fails.
  try {
    await removeFiles();
  } catch (error) {
    failures.push(error);
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, "Gateway fixture cleanup failed");
  }
};
