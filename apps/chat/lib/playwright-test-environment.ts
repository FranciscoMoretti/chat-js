import { isNonEmptyString } from "@/lib/is-non-empty-string";

const isEnabledFlag = (value: string | undefined): boolean => {
  if (typeof value !== "string" || value === "") {
    return false;
  }

  const normalizedValue = value.trim().toLowerCase();
  return !["0", "false", "no", "off"].includes(normalizedValue);
};

export const isPlaywrightTestEnvironment = (
  env: Readonly<NodeJS.ProcessEnv> = process.env
): boolean =>
  isNonEmptyString(env.PLAYWRIGHT_TEST_BASE_URL) ||
  isEnabledFlag(env.PLAYWRIGHT) ||
  isEnabledFlag(env.CI_PLAYWRIGHT);
