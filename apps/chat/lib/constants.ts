import { config } from "@/lib/config";
import { isPlaywrightTestEnvironment as getIsPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";

const isPlaywrightTestEnvironment = getIsPlaywrightTestEnvironment(process.env);

const FILE_STORAGE_PREFIX = `${config.appPrefix}/files/`;
export { FILE_STORAGE_PREFIX, isPlaywrightTestEnvironment };
