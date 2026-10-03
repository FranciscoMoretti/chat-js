import { config } from "@/lib/config";
import { isPlaywrightTestEnvironment as getIsPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";

/* oxlint-disable import/group-exports, import/no-named-export, node/no-process-env --
 * import/group-exports (#523): isPlaywrightTestEnvironment stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named isPlaywrightTestEnvironment API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * node/no-process-env (#537): isPlaywrightTestEnvironment reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
export const isPlaywrightTestEnvironment = getIsPlaywrightTestEnvironment(
  process.env
);
/* oxlint-enable import/group-exports, import/no-named-export, node/no-process-env */

/* oxlint-disable import/group-exports, import/no-named-export --
 * import/group-exports (#523): FILE_STORAGE_PREFIX stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named FILE_STORAGE_PREFIX API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const FILE_STORAGE_PREFIX = `${config.appPrefix}/files/`;
/* oxlint-enable import/group-exports, import/no-named-export */
