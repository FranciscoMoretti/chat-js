import { config } from "@/lib/config";
import { isPlaywrightTestEnvironment as getIsPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";

export const isPlaywrightTestEnvironment = getIsPlaywrightTestEnvironment(
  process.env
);

export const FILE_STORAGE_PREFIX = `${config.appPrefix}/files/`;

export const ANONYMOUS_SESSION_COOKIES_KEY = "anonymous-session";
