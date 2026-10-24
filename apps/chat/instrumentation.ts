import { config } from "@/lib/config";
import { installedInstrumentation } from "@/composition/generated/installed-instrumentation";

export const register = async (): Promise<void> => {
  // Core lifecycle starts even if an installed exporter reports missing credentials.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startLocalEveGuestCleanup } =
      await import("./lib/eve/local-guest-cleanup-scheduler");
    startLocalEveGuestCleanup();
  }
  for (const registration of installedInstrumentation) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Register in order; propagate failures to Next.js.
    await registration({
      appPrefix: config.appPrefix,
      runtime: process.env.NEXT_RUNTIME,
    });
  }
};
