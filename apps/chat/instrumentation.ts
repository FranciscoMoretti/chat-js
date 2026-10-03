import { installedInstrumentation } from "@/features/installed-instrumentation";
import { config } from "@/lib/config";

/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): register reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
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
/* oxlint-enable node/no-process-env */
