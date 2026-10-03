/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { installedInstrumentation } from "@/features/installed-instrumentation";
import { config } from "@/lib/config";
/* oxlint-enable sort-imports */

/* oxlint-disable import/no-named-export, import/prefer-default-export, node/no-process-env, oxc/no-async-await --
 * import/no-named-export (#527): Preserve the named register API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): register remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * node/no-process-env (#537): register reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 * oxc/no-async-await (#540): register sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
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
/* oxlint-enable import/no-named-export, import/prefer-default-export, node/no-process-env, oxc/no-async-await */
