import { config } from "@/lib/config";
import { isPlaywrightTestEnvironment as getIsPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";

/* oxlint-disable import/group-exports, node/no-process-env --
 * import/group-exports (#523): isPlaywrightTestEnvironment stays exported at its declaration so its public contract is visible beside its implementation.
 * node/no-process-env (#537): isPlaywrightTestEnvironment reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
export const isPlaywrightTestEnvironment = getIsPlaywrightTestEnvironment(
  process.env
);
/* oxlint-enable import/group-exports, node/no-process-env */

/* oxlint-disable import/group-exports --
 * import/group-exports (#523): FILE_STORAGE_PREFIX stays exported at its declaration so its public contract is visible beside its implementation.
 */
export const FILE_STORAGE_PREFIX = `${config.appPrefix}/files/`;
/* oxlint-enable import/group-exports */
