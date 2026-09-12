const isEnabledFlag = (value: string | undefined): boolean => {
  if (!value) {
    return false;
  }

  const normalizedValue = value.trim().toLowerCase();
  return !["0", "false", "no", "off"].includes(normalizedValue);
};

export const isPlaywrightTestEnvironment = (
  env: NodeJS.ProcessEnv = process.env
): boolean =>
  Boolean(
    env.PLAYWRIGHT_TEST_BASE_URL ||
    isEnabledFlag(env.PLAYWRIGHT) ||
    isEnabledFlag(env.CI_PLAYWRIGHT)
  );
