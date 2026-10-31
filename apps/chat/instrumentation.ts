import { config } from "@/lib/config";
import { instrumentation } from "@/integrations/instrumentation";

export const register = async (): Promise<void> => {
  // Start every installed registration even if another one fails (e.g. a missing exporter credential).
  await Promise.all(
    instrumentation.map(async (registration) => {
      await registration({
        appPrefix: config.appPrefix,
        runtime: process.env.NEXT_RUNTIME,
      });
    })
  );
};
