import { config } from "@/lib/config";
import { installedInstrumentation } from "@/features/installed-instrumentation";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (register); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve register's awaited sequencing and rejected-Promise behavior. */

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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable node/no-process-env */
