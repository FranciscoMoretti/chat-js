import { config } from "@/lib/config";
import { isPlaywrightTestEnvironment as getIsPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";

/* oxlint-disable node/no-process-env -- node/no-process-env (#537): isPlaywrightTestEnvironment reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior. */
const isPlaywrightTestEnvironment = getIsPlaywrightTestEnvironment(process.env);
/* oxlint-enable node/no-process-env */

const FILE_STORAGE_PREFIX = `${config.appPrefix}/files/`;
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (FILE_STORAGE_PREFIX, isPlaywrightTestEnvironment); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { FILE_STORAGE_PREFIX, isPlaywrightTestEnvironment };
/* oxlint-enable import/no-named-export */
